// Background function to update match data from Football API
// Can run for up to 15 minutes
// Processes all fixtures in a single run
// Trigger via cron job, webhook, or manual invocation

import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Football API configuration
const FOOTBALL_API_BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = process.env.VITE_FOOTBALL_API_KEY!;

interface MatchData {
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'FINISHED' | 'PAUSED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED';
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  console.log('🏈 Match update function started');

  // For background functions, we need to return immediately
  // and continue processing asynchronously
  const startTime = Date.now();
  
  // Process in background and don't await it
  processUpdate().catch(error => {
    console.error('❌ Background processing error:', error);
  });

  // Return response immediately for background function
  return {
    statusCode: 202, // Accepted
    body: JSON.stringify({
      message: 'Match update started',
      timestamp: new Date().toISOString(),
    }),
  };
};

async function processUpdate() {
  const results = {
    checked: 0,
    updated: 0,
    errors: 0,
    snapshots: 0,
  };

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get fixtures that need updates
    // - Status is scheduled or closed
    // - Kickoff within last 2 hours or next 48 hours
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Get fixtures that need updating
    const { data: fixtures, error: fetchError } = await supabase
      .from('fixtures')
      .select('*')
      .in('status', ['scheduled', 'closed'])
      .gte('kickoff_at', twoHoursAgo.toISOString())
      .lte('kickoff_at', twoDaysLater.toISOString());

    if (fetchError) {
      console.error('❌ Error fetching fixtures:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch fixtures', details: fetchError.message }),
      };
    }

    if (!fixtures || fixtures.length === 0) {
      console.log('✅ No fixtures need updating');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No fixtures to update', results }),
      };
    }

    console.log(`📊 Checking ${fixtures.length} fixtures...`);

    // Process each fixture
    for (const fixture of fixtures) {
      try {
        // Skip fixtures without external_id
        if (!fixture.external_id) {
          continue;
        }

        results.checked++;

        const kickoffTime = new Date(fixture.kickoff_at);
        const matchEndTime = new Date(kickoffTime.getTime() + 120 * 60 * 1000);
        const buyCloseTime = new Date(kickoffTime.getTime() - 30 * 60 * 1000);
        const timeToBuyClose = buyCloseTime.getTime() - now.getTime();

        // Capture snapshots 30 min before kickoff
        if (fixture.status === 'scheduled' && (fixture.snapshot_home_cap === null || fixture.snapshot_away_cap === null)) {
          if (timeToBuyClose <= 5 * 60 * 1000 && timeToBuyClose >= -5 * 60 * 1000) {
            console.log(`📸 Capturing snapshots for fixture ${fixture.id}`);
            
            // Get current market caps
            const { data: homeTeam } = await supabase
              .from('teams')
              .select('market_cap')
              .eq('id', fixture.home_team_id)
              .single();

            const { data: awayTeam } = await supabase
              .from('teams')
              .select('market_cap')
              .eq('id', fixture.away_team_id)
              .single();

            // Update fixture with snapshots
            await supabase
              .from('fixtures')
              .update({
                snapshot_home_cap: homeTeam?.market_cap || 100,
                snapshot_away_cap: awayTeam?.market_cap || 100,
              })
              .eq('id', fixture.id);

            results.snapshots++;
          }
        }

        // Update live match data
        if (now >= kickoffTime && now <= matchEndTime) {
          console.log(`🔥 Updating live match fixture ${fixture.id}`);

          // Fetch from Football API
          const response = await fetch(`${FOOTBALL_API_BASE_URL}/matches/${fixture.external_id}`, {
            headers: {
              'X-Auth-Token': API_KEY,
            },
          });

          if (!response.ok) {
            console.error(`❌ Failed to fetch match ${fixture.external_id} from API`);
            results.errors++;
            continue;
          }

          const matchData: MatchData = await response.json();

          // Convert API status to database status
          let newStatus = fixture.status;
          let newResult = fixture.result;

          if (matchData.status === 'FINISHED') {
            newStatus = 'applied';
            // Determine result based on scores
            if (matchData.score.fullTime.home && matchData.score.fullTime.away) {
              const homeScore = matchData.score.fullTime.home;
              const awayScore = matchData.score.fullTime.away;
              
              if (homeScore > awayScore) newResult = 'home_win';
              else if (awayScore > homeScore) newResult = 'away_win';
              else newResult = 'draw';
            }
          } else if (matchData.status === 'IN_PLAY' || matchData.status === 'LIVE') {
            newStatus = 'closed';
          }

          // Update fixture if changed
          if (newStatus !== fixture.status || newResult !== fixture.result) {
            await supabase
              .from('fixtures')
              .update({
                status: newStatus,
                result: newResult,
                home_score: matchData.score.fullTime.home,
                away_score: matchData.score.fullTime.away,
                updated_at: now.toISOString(),
              })
              .eq('id', fixture.id);

            console.log(`✅ Updated fixture ${fixture.id}: ${newStatus} - ${newResult}`);
            results.updated++;
          }
        }

      } catch (error) {
        console.error(`❌ Error processing fixture ${fixture.id}:`, error);
        results.errors++;
      }
    }

    console.log(`✅ Match update complete: ${results.updated} updated, ${results.snapshots} snapshots, ${results.errors} errors`);

  } catch (error) {
    console.error('❌ Fatal error in match update function:', error);
    results.errors++;
  }

  console.log(`✅ Background match update complete:`, results);
  return results;
}

// Export schedule configuration for Netlify to pick up
// This makes it a scheduled background function
export const config = {
  schedule: '*/30 * * * *', // Every 30 minutes
};

