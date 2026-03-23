-- =============================================================================
-- Wallet ledger: normalize purchase row signs + re-sync profiles.wallet_balance
-- =============================================================================
-- Historical bug: process_share_purchase_atomic inserted POSITIVE amount_cents for
-- purchases while debiting profiles.wallet_balance. That made SUM(wallet_transactions)
-- meaningless as "cash balance" and broke reconcile_wallet_balances_from_transactions.
--
-- New purchases must use negative amounts (see purchase_amount_tolerance migration).
--
-- This migration is IDEMPOTENT:
--   - Only flips rows where type = 'purchase' AND amount_cents > 0.
--   - reconcile_* only updates profiles where wallet_balance IS DISTINCT FROM sum(tx).
--
-- User-visible impact:
--   - If wallet_balance was always maintained by RPCs (never reconciled to bad sum):
--       sum(tx) after fix should equal existing wallet_balance → few/no profile updates.
--   - If reconcile was run while purchases were positive: balances will DROP to the
--       correct economic value (that correction is intentional).
--
-- Run after backup; review RAISE NOTICE counts in migration logs.
-- =============================================================================

DO $body$
DECLARE
  v_flipped bigint;
BEGIN
  UPDATE public.wallet_transactions wt
  SET amount_cents = -ABS(wt.amount_cents)
  WHERE wt.type = 'purchase'
    AND wt.amount_cents > 0;

  GET DIAGNOSTICS v_flipped = ROW_COUNT;
  RAISE NOTICE 'wallet_purchase_ledger_sign_backfill: flipped % purchase row(s) to negative', v_flipped;
END;
$body$;

COMMENT ON COLUMN public.wallet_transactions.amount_cents IS
  'Signed amount in ten-thousandths of currency unit (e.g. USD): inflows (deposit, sale, credit_loan) positive; outflows (purchase, credit_loan_reversal) negative.';

-- Re-align profiles from ledger (uses app.allow_wallet_update for trigger bypass)
SELECT public.reconcile_wallet_balances_from_transactions() AS reconcile_result;

COMMENT ON FUNCTION public.reconcile_wallet_balances_from_transactions() IS
  'Sets profiles.wallet_balance from SUM(wallet_transactions.amount_cents). '
  'Requires purchase rows to be stored as NEGATIVE outflows. '
  'Run via service role or migrations after backups.';
