/**
 * Backfill Weekly Leaderboard
 *
 * Populates weekly_leaderboard for the current week and optionally past weeks.
 * Uses same logic as netlify/functions/update-weeklyleaderboard.ts for consistency.
 *
 * Usage:
 *   npx tsx scripts/calculate-weekly-leaderboard.ts
 *   npx tsx scripts/calculate-weekly-leaderboard.ts --weeks 4
 *
 * Options:
 *   --weeks N   Backfill last N weeks (default: 1 = current week only)
 *   --force     Delete existing rows for the week(s) and regenerate (fixes inflated values)
 *
 * Requirements (from .env):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';

// Import centralized calculation utilities
import {
  calculateLeaderboard,
  toLeaderboardDbFormat,
  validateLeaderboardEntries,
  type UserLeaderboardData
} from '../src/shared/lib/utils/leaderboard-calculations';
import { fromCents } from '../src/shared/lib/utils/decimal';

// Load .env if present
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

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * UAE week boundaries: Monday 03:00 → next Monday 02:59
 * Matches netlify/functions/update-weeklyleaderboard.ts logic.
 * @param weeksAgo 1 = most recent COMPLETED week, 2 = week before that, etc.
 *                 (weeksAgo=0 would be "current" week which may not have ended - we skip it)
 */
function getUAEWeekBounds(weeksAgo = 1) {
  const nowUTC = new Date();
  const nowUAE = new Date(nowUTC.getTime() + 4 * 60 * 60 * 1000);

  // Process COMPLETED weeks only (move back so we get the week that just ended)
  const baseUAE = new Date(nowUAE);
  baseUAE.setUTCDate(nowUAE.getUTCDate() - 7 * weeksAgo);

  const day = baseUAE.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;

  const weekStartUAE = new Date(baseUAE);
  weekStartUAE.setUTCDate(baseUAE.getUTCDate() + diffToMonday);
  weekStartUAE.setUTCHours(3, 0, 0, 0);

  const weekEndUAE = new Date(weekStartUAE);
  weekEndUAE.setUTCDate(weekStartUAE.getUTCDate() + 7);
  weekEndUAE.setUTCHours(2, 59, 59, 0); // Match DB format (22:59:59 UTC)

  return {
    week_start: new Date(weekStartUAE.getTime() - 4 * 60 * 60 * 1000),
    week_end: new Date(weekEndUAE.getTime() - 4 * 60 * 60 * 1000),
  };
}

/**
 * DB stores ten-thousandths: amount_cents, share_price_after, wallet_balance.
 * Shared fromCents = fromTenThousandths (÷10000). Returns Decimal; use .toNumber() for numeric.
 */

/** Portfolio at timestamp: reconstruct from orders + total_ledger (matches Netlify function) */
async function calculatePortfolioAtTimestamp(
  userId: string,
  timestamp: string
): Promise<number> {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('team_id, order_type, quantity, executed_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'FILLED');

  if (ordersError || !orders?.length) return 0;

  const ordersBeforeTimestamp = orders.filter((o) => {
    const t = o.executed_at || o.created_at;
    return t && t <= timestamp;
  });
  if (ordersBeforeTimestamp.length === 0) return 0;

  const teamQuantities = new Map<number, Decimal>();
  for (const order of ordersBeforeTimestamp) {
    const cur = teamQuantities.get(order.team_id) ?? new Decimal(0);
    const qty = new Decimal(order.quantity);
    teamQuantities.set(
      order.team_id,
      order.order_type === 'BUY' ? cur.plus(qty) : cur.minus(qty)
    );
  }

  let portfolioValue = new Decimal(0);
  for (const [teamId, quantity] of teamQuantities) {
    if (quantity.lte(0)) continue;
    const { data: ledger } = await supabase
      .from('total_ledger')
      .select('share_price_after')
      .eq('team_id', teamId)
      .lte('event_date', timestamp)
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    let price: Decimal;
    if (ledger?.share_price_after != null) {
      price = fromCents(ledger.share_price_after);
    } else {
      const { data: team } = await supabase
        .from('teams')
        .select('launch_price')
        .eq('id', teamId)
        .single();
      price = fromCents(team?.launch_price ?? 200000);
    }
    portfolioValue = portfolioValue.plus(price.times(quantity));
  }
  return portfolioValue.toNumber();
}

/**
 * Fetch user wallet and portfolio data. Matches Netlify update-weeklyleaderboard logic:
 * - Wallet: sum amount_cents from wallet_transactions (ten-thousandths → dollars via fromCents)
 * - Portfolio: orders + total_ledger
 */
async function fetchUserLeaderboardData(
  weekStart: string,
  weekEnd: string
): Promise<UserLeaderboardData[]> {
  console.log('   📊 Fetching user data...');

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name');

  if (profilesError || !profiles?.length) {
    if (profilesError) console.error('   ❌ Failed to fetch profiles:', profilesError);
    return [];
  }

  const userData: UserLeaderboardData[] = [];

  for (const profile of profiles) {
    const userId = profile.id;

    const [
      { data: startTransactions },
      { data: endTransactions },
      { data: deposits }
    ] = await Promise.all([
      supabase
        .from('wallet_transactions')
        .select('amount_cents')
        .eq('user_id', userId)
        .lt('created_at', weekStart)
        .order('created_at', { ascending: true }),
      supabase
        .from('wallet_transactions')
        .select('amount_cents')
        .eq('user_id', userId)
        .lt('created_at', weekEnd)
        .order('created_at', { ascending: true }),
      supabase
        .from('wallet_transactions')
        .select('amount_cents')
        .eq('user_id', userId)
        .eq('type', 'deposit')
        .gte('created_at', weekStart)
        .lt('created_at', weekEnd)
    ]);

    let startWalletBalance = 0;
    for (const tx of startTransactions || []) {
      startWalletBalance += fromCents(tx.amount_cents).toNumber();
    }
    let endWalletBalance = 0;
    for (const tx of endTransactions || []) {
      endWalletBalance += fromCents(tx.amount_cents).toNumber();
    }
    const depositsWeek = (deposits || []).reduce(
      (sum, tx) => sum + fromCents(tx.amount_cents).toNumber(),
      0
    );

    const [startPortfolioValue, endPortfolioValue] = await Promise.all([
      calculatePortfolioAtTimestamp(userId, weekStart),
      calculatePortfolioAtTimestamp(userId, weekEnd)
    ]);

    const startAccountValue = new Decimal(startWalletBalance).plus(startPortfolioValue).toNumber();
    const endAccountValue = new Decimal(endWalletBalance).plus(endPortfolioValue).toNumber();
    const hasActivity = startAccountValue > 0 || endAccountValue > 0 || depositsWeek > 0;
    if (!hasActivity) continue;

    userData.push({
      user_id: userId,
      full_name: profile.full_name,
      start_wallet_value: startWalletBalance,
      start_portfolio_value: startPortfolioValue,
      start_account_value: startAccountValue,
      end_wallet_value: endWalletBalance,
      end_portfolio_value: endPortfolioValue,
      end_account_value: endAccountValue,
      deposits_week: depositsWeek
    });
  }

  console.log(`   Processed ${userData.length} users with activity`);
  return userData;
}

async function backfillWeeklyLeaderboard(weeksToBackfill: number) {
  console.log(`🚀 Weekly Leaderboard Backfill (last ${weeksToBackfill} week(s))`);
  console.log('');

  // When regenerating, remove any "future" weeks (week_end > now) so Admin shows completed weeks
  if (forceRegenerate) {
    const nowIso = new Date().toISOString();
    const { error: futureDelErr } = await supabase
      .from('weekly_leaderboard')
      .delete()
      .gt('week_end', nowIso);
    if (futureDelErr) {
      console.warn('   ⚠️ Could not delete future weeks:', futureDelErr.message);
    } else {
      console.log('   🗑️  Cleaned up any future/invalid weeks');
    }
  }

  let totalInserted = 0;

  for (let i = 1; i <= weeksToBackfill; i++) {
    const { week_start, week_end } = getUAEWeekBounds(i);
    const isLatest = i === 1; // Most recently completed week = latest

    console.log(
      `📅 Week ${i} (${weeksToBackfill - i + 1} of ${weeksToBackfill}): ${week_start.toISOString().slice(0, 10)} → ${week_end.toISOString().slice(0, 10)} ${isLatest ? '(latest completed)' : ''}`
    );

    // Skip if already processed
    const { count } = await supabase
      .from('weekly_leaderboard')
      .select('id', { count: 'exact', head: true })
      .eq('week_start', week_start.toISOString());

    if (count && count > 0) {
      if (!forceRegenerate) {
        console.log('   ⏭️  Already processed, skipping (use --force to regenerate)');
        continue;
      }
      const { error: delErr } = await supabase
        .from('weekly_leaderboard')
        .delete()
        .eq('week_start', week_start.toISOString())
        .eq('week_end', week_end.toISOString());
      if (delErr) {
        console.error('   ❌ Failed to delete existing rows:', delErr.message);
        throw delErr;
      }
      console.log('   🗑️  Deleted existing rows (--force)');
    }

    // Fetch user data and compute leaderboard using TypeScript
    const userData = await fetchUserLeaderboardData(
      week_start.toISOString(),
      week_end.toISOString()
    );

    if (userData.length === 0) {
      console.log('   ⚠️  No users with accounts, skipping insert');
      continue;
    }

    // Calculate leaderboard using centralized calculation logic
    const leaderboardEntries = calculateLeaderboard(userData);

    // Validate calculations
    const validationErrors = validateLeaderboardEntries(leaderboardEntries);
    if (validationErrors.length > 0) {
      console.error('   ❌ Validation errors:', validationErrors);
      throw new Error('Validation failed');
    }

    console.log(`   ✅ Calculated leaderboard for ${leaderboardEntries.length} users`);

    // Get week_number: for backfill, use max - i so oldest week gets lowest number
    const { data: maxWeek } = await supabase
      .from('weekly_leaderboard')
      .select('week_number')
      .order('week_number', { ascending: false })
      .limit(1)
      .single();

    const maxNum = maxWeek?.week_number ?? 0;
    const weekNumber = maxNum + (weeksToBackfill - i + 1); // Most recent completed = highest

    // Reset is_latest if this is the current week
    if (isLatest) {
      await supabase
        .from('weekly_leaderboard')
        .update({ is_latest: false })
        .eq('is_latest', true);
    }    // Insert (include week_number to match table structure)
    const rows = leaderboardEntries.map((entry) => ({
      ...toLeaderboardDbFormat(entry),
      week_start: week_start.toISOString(),
      week_end: week_end.toISOString(),
      week_number: weekNumber,
      is_latest: isLatest,
    }));

    const { error: insertError } = await supabase
      .from('weekly_leaderboard')
      .insert(rows);

    if (insertError) {
      console.error('   ❌ Insert error:', insertError.message);
      throw insertError;
    }

    totalInserted += rows.length;
    console.log(`   ✅ Inserted ${rows.length} rows`);
  }

  console.log('');
  console.log(`✅ Backfill complete. Total rows inserted: ${totalInserted}`);
}

// Parse args: --weeks N, --force (delete existing week data before re-inserting)
const weeksIdx = process.argv.indexOf('--weeks');
const weeksToBackfill =
  weeksIdx >= 0
    ? parseInt(process.argv[weeksIdx + 1] || process.argv[weeksIdx]?.split('=')[1] || '1', 10)
    : 1;
const forceRegenerate = process.argv.includes('--force');

if (weeksToBackfill < 1 || weeksToBackfill > 52) {
  console.error('❌ --weeks must be between 1 and 52');
  process.exit(1);
}

backfillWeeklyLeaderboard(weeksToBackfill)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
