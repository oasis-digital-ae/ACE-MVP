/**
 * Compare today's match status: Database vs Football API
 * Run: npx tsx scripts/check-api-matches.ts
 * Env: VITE_FOOTBALL_API_KEY or FOOTBALL_API_KEY (or: node --env-file=.env node_modules/.bin/tsx scripts/check-api-matches.ts)
 */
const API_KEY = process.env.VITE_FOOTBALL_API_KEY || process.env.FOOTBALL_API_KEY;
const BASE = 'https://api.football-data.org/v4';

async function fetchMatch(id: number) {
  const res = await fetch(`${BASE}/matches/${id}`, {
    headers: { 'X-Auth-Token': API_KEY || '' },
  });
  const text = await res.text();
  if (!res.ok) {
    return { error: `${res.status} ${res.statusText}`, body: text.slice(0, 200) };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'Invalid JSON', body: text.slice(0, 200) };
  }
}

async function main() {
  console.log('=== Today\'s matches: Database vs API ===\n');
  console.log('API Key present:', !!API_KEY);
  if (!API_KEY) {
    console.log('Set VITE_FOOTBALL_API_KEY or FOOTBALL_API_KEY to fetch from API\n');
  }
  console.log('');

  // Today's match IDs from DB: 538055, 538058, 538060, 538061, 538063
  const todayIds = [538055, 538058, 538060, 538061, 538063];
  const dbMatches: Record<number, { home: string; away: string; kickoff: string }> = {
    538055: { home: 'AFC Bournemouth', away: 'Sunderland AFC', kickoff: '12:30 UTC' },
    538058: { home: 'Burnley FC', away: 'Brentford FC', kickoff: '15:00 UTC' },
    538060: { home: 'Liverpool FC', away: 'West Ham United FC', kickoff: '15:00 UTC' },
    538061: { home: 'Leeds United FC', away: 'Manchester City FC', kickoff: '17:30 UTC' },
    538063: { home: 'Newcastle United FC', away: 'Everton FC', kickoff: '15:00 UTC' },
  };

  console.log('| External ID | Kickoff  | DB Status   | DB Score | API Status    | API Score |');
  console.log('|-------------|----------|-------------|---------|---------------|----------|');

  for (const id of todayIds) {
    const info = dbMatches[id] || { home: '?', away: '?', kickoff: '?' };
    const dbStatus = 'scheduled';
    const dbScore = '0-0';
    let apiStatus = '-';
    let apiScore = '-';
    if (API_KEY) {
      const data = await fetchMatch(id);
      if (data.error) {
        apiStatus = String(data.error);
      } else {
        apiStatus = (data as any).status || '-';
        const ft = (data as any).score?.fullTime;
        apiScore = ft != null ? `${ft.home ?? '-'}-${ft.away ?? '-'}` : '-';
      }
    }
    console.log(`| ${id} | ${info.kickoff} | ${dbStatus.padEnd(11)} | ${dbScore.padEnd(7)} | ${apiStatus.padEnd(13)} | ${apiScore.padEnd(8)} |`);
  }

  if (API_KEY) {
    console.log('\n--- Bulk API: Today\'s matches from PL endpoint ---');
    const res = await fetch(`${BASE}/competitions/PL/matches?season=2025`, {
      headers: { 'X-Auth-Token': API_KEY },
    });
    if (res.ok) {
      const json = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const matches = (json.matches || []).filter((m: any) => m.utcDate?.startsWith(today));
      console.log(`Found ${matches.length} matches for ${today}:`);
      matches.forEach((m: any) => {
        const ft = m.score?.fullTime;
        const score = ft != null ? `${ft.home}-${ft.away}` : '-';
        console.log(`  ${m.homeTeam?.name} vs ${m.awayTeam?.name}: ${m.status} ${score}`);
      });
    }
  }
}

main().catch(console.error);
