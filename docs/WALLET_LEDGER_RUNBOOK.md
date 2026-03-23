# Wallet ledger fix — runbook (long-term)

## Related scripts

- **`scripts/reconcile-wallet-balances.ts`** — calls `reconcile_wallet_balances_from_transactions()` via service role.  
  **Only valid** after purchase rows use **negative** outflows (see migration `wallet_purchase_ledger_sign_backfill`).

## Invariant (target state)

| `type`                 | Sign of `amount_cents` | Meaning              |
|------------------------|------------------------|----------------------|
| `deposit`              | `+`                    | Money in             |
| `sale`                 | `+`                    | Proceeds in          |
| `credit_loan`          | `+`                    | Admin credit in      |
| `purchase`             | **`−`**                | Cash out             |
| `credit_loan_reversal` | `−`                    | Admin credit clawed back |

`profiles.wallet_balance` should always equal **`SUM(wallet_transactions.amount_cents)`** per user (ten-thousandths of USD).

## Code / migrations to keep

1. **`process_share_purchase_atomic`** must insert **negative** purchase amounts, e.g.  
   `VALUES (p_user_id, -v_total_amount_cents, 'usd', 'purchase', ...)`.  
   Implemented in `supabase/migrations/20260311150000_purchase_amount_tolerance.sql` — **do not remove** from the chain applied to production.

2. **One-time data repair:** `supabase/migrations/20260323073231_wallet_purchase_ledger_sign_backfill.sql` (version matches Supabase-hosted `apply_migration` record)  
   - Flips historical `purchase` rows with `amount_cents > 0` to `-ABS(amount_cents)`.  
   - Calls `reconcile_wallet_balances_from_transactions()` so `wallet_balance` matches the ledger.

## Before production

- **Backup** (or PITR) the database.
- Optional pre-check (SQL):

```sql
SELECT COUNT(*) AS wrong_sign_purchases
FROM wallet_transactions
WHERE type = 'purchase' AND amount_cents > 0;
```

- Deploy migrations; read migration logs for `RAISE NOTICE` flip count and `reconcile_result`.

## User-visible impact (“not noticeable” when?)

- **Most users who never had `wallet_balance` overwritten from a bad `SUM(tx)`:**  
  After the backfill, **`SUM(tx)` should already match `wallet_balance`** (RPC math was right).  
  Reconcile updates **0 rows** for them → **no balance change in the app.**

- **Anyone whose `wallet_balance` was set from the old (wrong) ledger sum:**  
  Balance **decreases** to the economically correct value. Treat as **bugfix**, not regression; communicate if that cohort is non-trivial.

## After deploy

- Spot-check a few users:  
  `wallet_balance = SUM(amount_cents)` from `wallet_transactions`.
- Confirm new buys create **`purchase` rows with `amount_cents < 0`**.
- Weekly leaderboard / any report using `SUM(wallet_transactions)` will align with balances after backfill.

### Rebuild historical `weekly_leaderboard`

Rows computed before the purchase-sign fix used wrong wallet snapshots. Regenerate from corrected data:

```bash
npx tsx scripts/calculate-weekly-leaderboard.ts --reset-all --weeks 52 --force
```

(`--reset-all` wipes the table, then inserts the last 52 completed UAE weeks with fixed `week_number` logic.)

## Rollback

- Restore DB from backup taken before this migration.  
  Do not attempt to “invert” rows in place without a backup (risk of double-flip).

## Ongoing hygiene

- Avoid ad-hoc `UPDATE profiles.wallet_balance` except through RPCs or `reconcile_wallet_balances_from_transactions()`.
- Consider a **scheduled assert** (internal): sample users where `wallet_balance <> SUM(tx)` and alert.
