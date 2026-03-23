-- One-off / periodic repair: set profiles.wallet_balance from SUM(wallet_transactions.amount_cents).
-- Source of truth for cash in/out is wallet_transactions; leaderboard already uses that sum.
-- Direct UPDATE is blocked by prevent_profile_field_updates unless app.allow_wallet_update or service_role.

CREATE OR REPLACE FUNCTION public.reconcile_wallet_balances_from_transactions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_with_tx bigint;
  v_zeroed_no_tx bigint;
BEGIN
  PERFORM set_config('app.allow_wallet_update', 'true', true);

  WITH sums AS (
    SELECT user_id, COALESCE(SUM(amount_cents), 0)::bigint AS total
    FROM wallet_transactions
    GROUP BY user_id
  )
  UPDATE profiles p
  SET wallet_balance = s.total
  FROM sums s
  WHERE p.id = s.user_id
    AND p.wallet_balance IS DISTINCT FROM s.total;
  GET DIAGNOSTICS v_updated_with_tx = ROW_COUNT;

  UPDATE profiles p
  SET wallet_balance = 0
  WHERE NOT EXISTS (SELECT 1 FROM wallet_transactions wt WHERE wt.user_id = p.id)
    AND p.wallet_balance IS DISTINCT FROM 0;
  GET DIAGNOSTICS v_zeroed_no_tx = ROW_COUNT;

  PERFORM set_config('app.allow_wallet_update', '', true);

  RETURN jsonb_build_object(
    'profiles_updated_from_tx_sum', v_updated_with_tx,
    'profiles_zeroed_no_transactions', v_zeroed_no_tx
  );
END;
$$;

ALTER FUNCTION public.reconcile_wallet_balances_from_transactions() OWNER TO postgres;

COMMENT ON FUNCTION public.reconcile_wallet_balances_from_transactions() IS
  'Sets profiles.wallet_balance from SUM(wallet_transactions.amount_cents) for all users. '
  'Run via service role or Supabase SQL after backups. Then consider SELECT refresh_all_portfolio_values();';

REVOKE ALL ON FUNCTION public.reconcile_wallet_balances_from_transactions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_wallet_balances_from_transactions() TO service_role;
