/**
 * Map weekly leaderboard windows (UAE Monday→Monday, stored in UTC) to
 * Premier League gameweek numbers using fixtures.kickoff_at + matchday.
 *
 * week_number in weekly_leaderboard should match official PL matchday (1–38).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

function parseEnvSeason(): number | null {
  const raw =
    process.env.PL_LEADERBOARD_SEASON ??
    process.env.VITE_PL_LEADERBOARD_SEASON;
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

/** Active PL season year as stored on fixtures.season (e.g. 2025 for 2025–26). */
export async function resolvePlSeasonForLeaderboard(
  supabase: SupabaseClient
): Promise<number> {
  const envSeason = parseEnvSeason();
  if (envSeason != null) return envSeason;

  const { data, error } = await supabase
    .from('fixtures')
    .select('season')
    .not('season', 'is', null)
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[pl-leaderboard] season query failed:', error.message);
  }
  if (data?.season != null) return data.season;

  // Fallback: August–May season label
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return m >= 8 ? y : y - 1;
}

/**
 * PL gameweek (matchday) that overlaps the leaderboard window.
 * Uses max(matchday) among fixtures with kickoff in [weekStart, weekEnd).
 * If none (e.g. Fri kickoff before Monday week_start), widens start by 3 days.
 */
export async function resolvePlGameweekForLeaderboardWindow(
  supabase: SupabaseClient,
  weekStartIso: string,
  weekEndIso: string
): Promise<number> {
  const season = await resolvePlSeasonForLeaderboard(supabase);

  const queryMaxMatchday = async (startIso: string): Promise<number | null> => {
    const { data, error } = await supabase
      .from('fixtures')
      .select('matchday')
      .eq('season', season)
      .gte('kickoff_at', startIso)
      .lt('kickoff_at', weekEndIso)
      .order('matchday', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[pl-leaderboard] matchday query failed:', error.message);
      return null;
    }
    return data?.matchday ?? null;
  };

  let gw = await queryMaxMatchday(weekStartIso);
  if (gw != null) return gw;

  const paddedStart = new Date(
    new Date(weekStartIso).getTime() - 3 * 24 * 60 * 60 * 1000
  ).toISOString();
  gw = await queryMaxMatchday(paddedStart);
  if (gw != null) return gw;

  throw new Error(
    `[pl-leaderboard] No fixtures found for season ${season} between ${weekStartIso} and ${weekEndIso}. ` +
      'Sync fixtures or set PL_LEADERBOARD_SEASON.'
  );
}
