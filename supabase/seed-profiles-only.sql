-- Test users for staging only (password: TestPassword123!)
-- Used when syncing prod→staging: prod data is copied, then this seeds auth+profiles (no PII from prod).
-- wallet_balance: 10000000 = $1,000 (matches main seed)
-- DO NOT use in production.

DO $$
DECLARE
  v_instance_id uuid;
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES
    (v_instance_id, v_admin_id, 'authenticated', 'authenticated', 'admin@staging.local', crypt('TestPassword123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
    (v_instance_id, v_user_id, 'authenticated', 'authenticated', 'testuser@staging.local', crypt('TestPassword123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
  ON CONFLICT (id) DO UPDATE SET
    confirmation_token = COALESCE(auth.users.confirmation_token, ''),
    email_change = COALESCE(auth.users.email_change, ''),
    email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
    recovery_token = COALESCE(auth.users.recovery_token, '');

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES
    (v_admin_id, v_admin_id, format('{"sub":"%s","email":"admin@staging.local"}', v_admin_id)::jsonb, 'email', v_admin_id::text, now(), now(), now()),
    (v_user_id, v_user_id, format('{"sub":"%s","email":"testuser@staging.local"}', v_user_id)::jsonb, 'email', v_user_id::text, now(), now(), now())
  ON CONFLICT (id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

  -- wallet_balance in ten-thousandths: 10000000 = $1,000 (matches main seed)
  INSERT INTO public.profiles (id, username, full_name, email, is_admin, wallet_balance, portfolio_value)
  VALUES
    (v_admin_id, 'admin_staging', 'Staging Admin', 'admin@staging.local', true, 10000000, 0),
    (v_user_id, 'testuser_staging', 'Test User', 'testuser@staging.local', false, 10000000, 0)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.username,
    email = EXCLUDED.email,
    is_admin = EXCLUDED.is_admin,
    wallet_balance = EXCLUDED.wallet_balance,
    portfolio_value = EXCLUDED.portfolio_value,
    updated_at = now();

  -- Insert deposit transactions so Total Deposited and P&L display correctly in Net Worth
  -- Without these, totalDeposits=0 and P&L incorrectly shows entire balance as profit
  INSERT INTO public.wallet_transactions (user_id, amount_cents, currency, type, ref)
  VALUES
    (v_admin_id, 10000000, 'usd', 'deposit', 'seed_initial_admin'),
    (v_user_id, 10000000, 'usd', 'deposit', 'seed_initial_testuser')
  ON CONFLICT (user_id, ref) WHERE ref IS NOT NULL DO NOTHING;
END $$;
