-- Relax total amount validation tolerance for purchase
-- Frontend (price * qty) and backend (ROUND(price*10000) * qty) can differ due to floating-point rounding.
-- Allow 100 ten-thousandths ($0.01) tolerance.

CREATE OR REPLACE FUNCTION public.process_share_purchase_atomic(p_user_id uuid, p_team_id integer, p_shares integer, p_price_per_share numeric, p_total_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_team RECORD;
  v_position RECORD;
  v_nav_cents_per_share BIGINT;
  v_order_id INTEGER;
  v_position_id INTEGER;
  v_market_cap_before_cents BIGINT;
  v_market_cap_after_cents BIGINT;
  v_shares_outstanding_before INTEGER;
  v_shares_outstanding_after INTEGER;
  v_wallet_balance_cents BIGINT;
  v_new_wallet_balance_cents BIGINT;
  v_price_per_share_cents BIGINT;
  v_total_amount_cents BIGINT;
  v_exact_total_amount_cents BIGINT;
  v_existing_total_invested_cents BIGINT;
  v_new_total_invested_cents BIGINT;
  v_total_pnl_cents BIGINT;
BEGIN
  v_price_per_share_cents := ROUND(p_price_per_share * 10000)::BIGINT;
  v_total_amount_cents := ROUND(p_total_amount * 10000)::BIGINT;

  PERFORM set_config('app.allow_wallet_update', 'true', true);

  SELECT * INTO v_team
  FROM teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  IF p_shares <= 0 THEN
    RAISE EXCEPTION 'Invalid share quantity: %', p_shares;
  END IF;

  IF v_total_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Invalid total amount: % cents', v_total_amount_cents;
  END IF;

  v_nav_cents_per_share := CASE
    WHEN v_team.total_shares > 0 THEN (v_team.market_cap / v_team.total_shares)::BIGINT
    ELSE 50000
  END;
  v_exact_total_amount_cents := v_nav_cents_per_share * p_shares;

  -- Allow 100 ten-thousandths ($0.01) tolerance for floating-point rounding between frontend and backend
  IF ABS(v_total_amount_cents - v_exact_total_amount_cents) > 100 THEN
    PERFORM set_config('app.allow_wallet_update', '', true);
    RAISE EXCEPTION 'Total amount mismatch: expected % cents (based on price % cents * shares %), got % cents',
      v_exact_total_amount_cents, v_nav_cents_per_share, p_shares, v_total_amount_cents;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='wallet_balance'
  ) THEN
    SELECT COALESCE(wallet_balance, 0) INTO v_wallet_balance_cents
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='wallet_balance'
  ) THEN
    SELECT COALESCE(wallet_balance, 0) INTO v_wallet_balance_cents
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;
  ELSE
    v_wallet_balance_cents := 0;
  END IF;

  IF v_wallet_balance_cents < v_total_amount_cents THEN
    PERFORM set_config('app.allow_wallet_update', '', true);
    RETURN json_build_object(
      'success', false,
      'error', format('Insufficient wallet balance. Required: % cents, Available: % cents', v_total_amount_cents, v_wallet_balance_cents)
    );
  END IF;

  v_new_wallet_balance_cents := v_wallet_balance_cents - v_total_amount_cents;

  IF ABS(v_price_per_share_cents - v_nav_cents_per_share) > 10 THEN
    PERFORM set_config('app.allow_wallet_update', '', true);
    RAISE EXCEPTION 'Price mismatch: expected % cents, got % cents', v_nav_cents_per_share, v_price_per_share_cents;
  END IF;

  v_market_cap_before_cents := v_team.market_cap;
  v_market_cap_after_cents := v_market_cap_before_cents;
  v_shares_outstanding_before := COALESCE(v_team.available_shares, 1000);
  v_shares_outstanding_after := v_shares_outstanding_before - p_shares;

  IF v_shares_outstanding_after < 0 THEN
    PERFORM set_config('app.allow_wallet_update', '', true);
    RETURN json_build_object(
      'success', false,
      'error', format('Insufficient available shares. Required: %, Available: %', p_shares, v_shares_outstanding_before)
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='wallet_balance'
  ) THEN
    UPDATE profiles
    SET wallet_balance = v_new_wallet_balance_cents
    WHERE id = p_user_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='wallet_balance'
  ) THEN
    UPDATE users
    SET wallet_balance = v_new_wallet_balance_cents
    WHERE id = p_user_id;
  END IF;

  INSERT INTO orders (
    user_id, team_id, order_type, quantity,
    price_per_share, total_amount, status,
    executed_at, market_cap_before, market_cap_after,
    shares_outstanding_before, shares_outstanding_after
  ) VALUES (
    p_user_id, p_team_id, 'BUY', p_shares,
    v_nav_cents_per_share, v_exact_total_amount_cents, 'FILLED',
    NOW(), v_market_cap_before_cents, v_market_cap_after_cents,
    v_shares_outstanding_before, v_shares_outstanding_after
  ) RETURNING id INTO v_order_id;

  INSERT INTO wallet_transactions(user_id, amount_cents, currency, type, ref)
  VALUES (p_user_id, -v_total_amount_cents, 'usd', 'purchase', 'order_' || v_order_id);

  SELECT id, COALESCE(total_invested, 0) INTO v_position_id, v_existing_total_invested_cents
  FROM positions
  WHERE user_id = p_user_id AND team_id = p_team_id
  FOR UPDATE;

  IF FOUND THEN
    v_new_total_invested_cents := v_existing_total_invested_cents + v_exact_total_amount_cents;
    UPDATE positions
    SET quantity = quantity + p_shares,
        total_invested = v_new_total_invested_cents,
        updated_at = NOW()
    WHERE id = v_position_id;

    v_total_pnl_cents := calculate_position_total_pnl(p_user_id, p_team_id);
    UPDATE positions SET total_pnl = v_total_pnl_cents, updated_at = NOW() WHERE id = v_position_id;
  ELSE
    INSERT INTO positions (user_id, team_id, quantity, total_invested, total_pnl)
    VALUES (p_user_id, p_team_id, p_shares, v_exact_total_amount_cents, 0);
  END IF;

  UPDATE teams
  SET available_shares = v_shares_outstanding_after,
      updated_at = NOW()
  WHERE id = p_team_id;

  INSERT INTO total_ledger (
    team_id, ledger_type, event_date, event_description,
    trigger_event_id, trigger_event_type,
    market_cap_before, market_cap_after,
    shares_outstanding_before, shares_outstanding_after,
    share_price_before, share_price_after,
    price_impact, created_by
  ) VALUES (
    p_team_id, 'share_purchase', NOW(), 'Share purchase (no market cap change)',
    v_order_id, 'order',
    v_market_cap_before_cents, v_market_cap_after_cents,
    v_shares_outstanding_before, v_shares_outstanding_after,
    v_nav_cents_per_share, v_nav_cents_per_share,
    v_total_amount_cents, p_user_id::text
  );

  PERFORM set_config('app.allow_wallet_update', '', true);

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', (v_total_amount_cents / 10000.0)::NUMERIC(15,4),
    'wallet_balance', (v_new_wallet_balance_cents / 10000.0)::NUMERIC(15,4),
    'price_per_share', (v_nav_cents_per_share / 10000.0)::NUMERIC(10,4)
  );

EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.allow_wallet_update', '', true);
    RAISE EXCEPTION 'Purchase failed: %', SQLERRM;
END;
$function$;
