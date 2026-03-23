/**
 * Repair profiles.wallet_balance from SUM(wallet_transactions.amount_cents).
 *
 * Prerequisite: `purchase` rows must be **negative** (see docs/WALLET_LEDGER_RUNBOOK.md).
 * Running this on a ledger with wrong purchase signs will corrupt balances.
 *
 * Requires service role (same as other admin scripts).
 *
 * Usage:
 *   npx tsx scripts/reconcile-wallet-balances.ts
 *
 * Env: VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * After this, optionally refresh portfolio marks in SQL:
 *   SELECT refresh_all_portfolio_values();
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const env = readFileSync(envPath, 'utf-8').replace(/\r/g, '');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY and Supabase URL in env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Calling reconcile_wallet_balances_from_transactions() ...');
  const { data, error } = await supabase.rpc('reconcile_wallet_balances_from_transactions');
  if (error) {
    console.error('RPC failed:', error.message);
    process.exit(1);
  }
  console.log('Result:', JSON.stringify(data, null, 2));
  console.log('\nOptional: run in SQL editor: SELECT refresh_all_portfolio_values();');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
