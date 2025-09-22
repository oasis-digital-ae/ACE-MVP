import { supabase } from './supabase';
import { supabaseUrl, debugMode } from './env';
import { apiCache, ApiCacheService } from './api-cache';

// Football Data API v4 types
export interface FootballMatch {
  id: number;
  competition: {
    id: number;
    name: string;
    code: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  utcDate: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED';
  matchday: number;
  stage: string;
  group: string | null;
  lastUpdated: string;
  odds: {
    msg: string;
  };
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  referees: Array<{
    id: number;
    name: string;
    type: string;
    nationality: string;
  }>;
}

export interface FootballTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  website: string;
  founded: number;
  clubColors: string;
  venue: string;
  lastUpdated: string;
}

export interface Standing {
  position: number;
  team: FootballTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface Scorer {
  player: {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    position: string;
  };
  team: FootballTeam;
  goals: number;
  assists: number;
  penalties: number;
}

export interface HeadToHeadData {
  numberOfMatches: number;
  totalGoals: number;
  homeTeam: {
    id: number;
    name: string;
    wins: number;
    draws: number;
    losses: number;
  };
  awayTeam: {
    id: number;
    name: string;
    wins: number;
    draws: number;
    losses: number;
  };
  lastUpdated: string;
}

export interface TeamDetails extends FootballTeam {
  squad: Array<{
    id: number;
    name: string;
    position: string;
    dateOfBirth: string;
    nationality: string;
    shirtNumber: number;
  }>;
  coach: {
    id: number;
    name: string;
    nationality: string;
  };
}

// API configuration - Detect environment properly for Netlify Edge Functions
const isNetlifyDev = window.location.hostname === 'localhost' && (window.location.port === '8888' || window.location.port === '8080');
const isProduction = (import.meta as any).env?.VITE_APP_ENV === 'production';
const isViteDev = window.location.hostname === 'localhost' && window.location.port === '5173';

// For two-terminal setup: use Netlify Edge Functions when available
const FOOTBALL_API_BASE = isProduction 
  ? '/api/football-api-cache'  // Netlify Edge Function (production)
  : isNetlifyDev 
    ? '/api/football-api-cache'  // Netlify Edge Function (local dev with netlify dev)
    : isViteDev
      ? 'http://localhost:8888/api/football-api-cache'  // Cross-origin to Netlify dev
      : `${supabaseUrl}/functions/v1/football-api`; // Supabase Edge Function (fallback)

  // Debug logging removed for security

// Test API connection
export const testApiConnection = async (): Promise<boolean> => {
  try {
    const url = `${FOOTBALL_API_BASE}/competitions/PL/teams`;
    
    const response = await fetch(url);
    
    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

// Football API service
export const footballApiService = {
  async getPremierLeagueMatches(season?: number): Promise<FootballMatch[]> {
    // Default to 2024-25 season (2024 represents the 2024-25 season)
    const seasonParam = season || 2024;
    
    const url = `${FOOTBALL_API_BASE}/competitions/PL/matches?season=${seasonParam}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Football API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Log season information from the API response
    if (data.matches && data.matches.length > 0) {
      const firstMatch = data.matches[0];
      // Removed console.log for security
    }
    
    return data.matches || [];
  },

  async getMatchDetails(matchId: number): Promise<FootballMatch> {
    const response = await fetch(
      `${FOOTBALL_API_BASE}/matches/${matchId}`
    );

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async getPremierLeagueTeams(season?: number): Promise<FootballTeam[]> {
    // Default to 2024-25 season (2024 represents the 2024-25 season)
    const seasonParam = season || 2024;
    
    // Use appropriate API endpoint based on environment
    const teamsEndpoint = (isProduction || isNetlifyDev)
      ? `/api/football-api-cache/competitions/PL/teams?season=${seasonParam}`
      : `${FOOTBALL_API_BASE}/competitions/PL/teams?season=${seasonParam}`;
    
    
    const response = await fetch(teamsEndpoint, {
      headers: (!isProduction && !isNetlifyDev) ? {
        'X-Auth-Token': (import.meta as any).env?.VITE_FOOTBALL_API_KEY || ''
      } : {}
    });

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.teams || [];
  },

  async getCurrentSeason(season?: number): Promise<{ id: number; startDate: string; endDate: string; currentMatchday: number } | null> {
    try {
      // Default to 2024-25 season (2024 represents the 2024-25 season)
      const seasonParam = season || 2024;
      
      // Get season info from the matches endpoint
      const response = await fetch(
        `${FOOTBALL_API_BASE}/competitions/PL/matches?season=${seasonParam}`
      );

      if (!response.ok) {
        throw new Error(`Football API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.matches && data.matches.length > 0) {
        const firstMatch = data.matches[0];
        const seasonInfo = firstMatch.season;
        
        if (seasonInfo) {
          // Removed console.log for security
          return seasonInfo;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting season:`, error);
      return null;
    }
  },

  // Helper function to normalize team names for matching
  normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+(fc|afc|united|city|town|albion)\s*$/i, '') // Remove common suffixes
      .replace(/\s+&\s+/g, ' ') // Replace "&" with space
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  },

  // Helper function to find matching team
  findMatchingTeam(apiTeamName: string, dbTeams: any[]): any | null {
    const normalizedApiName = this.normalizeTeamName(apiTeamName);
    
    // First try exact normalized match
    let match = dbTeams.find(dbTeam => 
      this.normalizeTeamName(dbTeam.name) === normalizedApiName
    );
    
    if (match) return match;
    
    // Try partial matching
    match = dbTeams.find(dbTeam => {
      const normalizedDbName = this.normalizeTeamName(dbTeam.name);
      return normalizedApiName.includes(normalizedDbName) || 
             normalizedDbName.includes(normalizedApiName);
    });
    
    return match;
  },
  convertMatchToFixture(match: FootballMatch) {
    return {
      external_id: match.id.toString(),
      home_team_id: null, // Will be mapped to our team ID
      away_team_id: null, // Will be mapped to our team ID
      kickoff_at: new Date(match.utcDate).toISOString(),
      buy_close_at: new Date(new Date(match.utcDate).getTime() - 24 * 60 * 60 * 1000).toISOString(), // 24h before
      result: this.convertMatchStatus(match.status, match.score),
      status: this.convertMatchStatusToFixtureStatus(match.status),
      home_score: match.score.fullTime.home,
      away_score: match.score.fullTime.away,
      matchday: match.matchday,
      season: match.season.id,
    };
  },

  convertMatchStatus(status: string, score: any): 'home_win' | 'away_win' | 'draw' | 'pending' {
    if (status !== 'FINISHED') return 'pending';
    
    if (!score.fullTime.home || !score.fullTime.away) return 'pending';
    
    if (score.fullTime.home > score.fullTime.away) return 'home_win';
    if (score.fullTime.away > score.fullTime.home) return 'away_win';
    return 'draw';
  },

  convertMatchStatusToFixtureStatus(status: string): 'scheduled' | 'closed' | 'applied' | 'postponed' {
    switch (status) {
      case 'SCHEDULED': return 'scheduled';
      case 'LIVE':
      case 'IN_PLAY':
      case 'PAUSED': return 'closed';
      case 'FINISHED': return 'applied';
      case 'POSTPONED':
      case 'SUSPENDED':
      case 'CANCELLED': return 'postponed';
      default: return 'scheduled';
    }
  },

  // Optimized: Single API call for all Premier League data
  // Uses appropriate API endpoint based on environment
  async getPremierLeagueData(season?: number): Promise<{
    standings: Standing[];
    teams: TeamDetails[];
    matches: FootballMatch[];
  }> {
    const seasonParam = season || 2024;
    
    
    // Use appropriate API endpoint based on environment
    const standingsEndpoint = (isProduction || isNetlifyDev)
      ? `/api/football-api-cache/premier-league-data?season=${seasonParam}`
      : `${FOOTBALL_API_BASE}/competitions/PL/standings?season=${seasonParam}`;
    
    const matchesEndpoint = (isProduction || isNetlifyDev)
      ? `/api/football-api-cache/premier-league-matches?season=${seasonParam}`
      : `${FOOTBALL_API_BASE}/competitions/PL/matches?season=${seasonParam}`;
    
    
    // Make only 2 API calls instead of 20+ calls
    const [standingsResponse, matchesResponse] = await Promise.all([
      fetch(standingsEndpoint, {
        headers: (!isProduction && !isNetlifyDev) ? {
          'X-Auth-Token': (import.meta as any).env?.VITE_FOOTBALL_API_KEY || ''
        } : {}
      }),
      fetch(matchesEndpoint, {
        headers: (!isProduction && !isNetlifyDev) ? {
          'X-Auth-Token': (import.meta as any).env?.VITE_FOOTBALL_API_KEY || ''
        } : {}
      })
    ]);

    if (!standingsResponse.ok) {
      throw new Error(`Football API standings error: ${standingsResponse.status} ${standingsResponse.statusText}`);
    }
    
    if (!matchesResponse.ok) {
      throw new Error(`Football API matches error: ${matchesResponse.status} ${matchesResponse.statusText}`);
    }

    const standingsData = await standingsResponse.json();
    const matchesData = await matchesResponse.json();
    
    const standings = standingsData.standings?.[0]?.table || [];
    const matches = matchesData.matches || [];
    
    // Extract team details from standings
    // Note: Standings endpoint only provides basic team info, not detailed info like founded, venue, clubColors
    const teams: TeamDetails[] = standings.map((standing: any) => ({
      id: standing.team.id,
      name: standing.team.name,
      shortName: standing.team.shortName,
      tla: standing.team.tla,
      crest: standing.team.crest,
      website: standing.team.website || '', // May not be available in standings
      founded: standing.team.founded || null, // Not available in standings
      clubColors: standing.team.clubColors || '', // Not available in standings
      venue: standing.team.venue || null, // Not available in standings
      squad: [], // Not available in standings
      staff: [], // Not available in standings
      lastUpdated: standing.team.lastUpdated
    }));

    return {
      standings,
      teams,
      matches
    };
  },

  // Get detailed team information for a specific team (cached)
  async getTeamDetailsCached(externalTeamId: number): Promise<TeamDetails | null> {
    const cacheKey = `team_details_${externalTeamId}`;
    
    return apiCache.getOrFetch(
      cacheKey,
      async () => {
        try {
          const apiEndpoint = (isProduction || isNetlifyDev)
            ? `/api/football-api-cache/teams/${externalTeamId}`
            : `${FOOTBALL_API_BASE}/teams/${externalTeamId}`;
          
          const response = await fetch(apiEndpoint, {
            headers: (!isProduction && !isNetlifyDev) ? {
              'X-Auth-Token': (import.meta as any).env?.VITE_FOOTBALL_API_KEY || ''
            } : {}
          });

          if (!response.ok) {
            throw new Error(`Football API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error(`Error fetching team details for ${externalTeamId}:`, error);
          return null;
        }
      },
      15 * 60 * 1000 // Cache for 15 minutes
    );
  },

  async getTopScorers(season?: number, limit: number = 10): Promise<Scorer[]> {
    const seasonParam = season || 2024;
    // Removed console.log for security
    
    const response = await fetch(
      `${FOOTBALL_API_BASE}/competitions/PL/scorers?season=${seasonParam}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.scorers || [];
  },

  async getMatchHeadToHead(matchId: number): Promise<HeadToHeadData> {
    // Removed console.log for security
    
    const response = await fetch(
      `${FOOTBALL_API_BASE}/matches/${matchId}/head2head`
    );

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async getLiveMatches(): Promise<FootballMatch[]> {
    // Removed console.log for security
    
    const response = await fetch(
      `${FOOTBALL_API_BASE}/matches?status=LIVE&competitions=PL`
    );

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.matches || [];
  },

  // Mock live matches for testing
  async getMockLiveMatches(): Promise<FootballMatch[]> {
    // Removed console.log for security
    
    // Return mock live matches for testing
    return [
      {
        id: 12345,
        competition: {
          id: 2021,
          name: 'Premier League',
          code: 'PL'
        },
        season: {
          id: 2024,
          startDate: '2024-08-17',
          endDate: '2025-05-25',
          currentMatchday: 15
        },
        utcDate: new Date().toISOString(),
        status: 'LIVE',
        matchday: 15,
        stage: 'REGULAR_SEASON',
        group: null,
        lastUpdated: new Date().toISOString(),
        odds: {
          msg: 'Odds available'
        },
        score: {
          winner: null,
          duration: '45+2',
          fullTime: {
            home: 1,
            away: 0
          },
          halfTime: {
            home: 1,
            away: 0
          }
        },
        homeTeam: {
          id: 57,
          name: 'Arsenal',
          shortName: 'Arsenal',
          tla: 'ARS',
          crest: 'https://crests.football-data.org/57.png'
        },
        awayTeam: {
          id: 65,
          name: 'Manchester City',
          shortName: 'Man City',
          tla: 'MCI',
          crest: 'https://crests.football-data.org/65.png'
        },
        referees: []
      },
      {
        id: 12346,
        competition: {
          id: 2021,
          name: 'Premier League',
          code: 'PL'
        },
        season: {
          id: 2024,
          startDate: '2024-08-17',
          endDate: '2025-05-25',
          currentMatchday: 15
        },
        utcDate: new Date().toISOString(),
        status: 'IN_PLAY',
        matchday: 15,
        stage: 'REGULAR_SEASON',
        group: null,
        lastUpdated: new Date().toISOString(),
        odds: {
          msg: 'Odds available'
        },
        score: {
          winner: null,
          duration: '67',
          fullTime: {
            home: 2,
            away: 1
          },
          halfTime: {
            home: 1,
            away: 1
          }
        },
        homeTeam: {
          id: 64,
          name: 'Liverpool',
          shortName: 'Liverpool',
          tla: 'LIV',
          crest: 'https://crests.football-data.org/64.png'
        },
        awayTeam: {
          id: 61,
          name: 'Chelsea',
          shortName: 'Chelsea',
          tla: 'CHE',
          crest: 'https://crests.football-data.org/61.png'
        },
        referees: []
      },
      {
        id: 12347,
        competition: {
          id: 2021,
          name: 'Premier League',
          code: 'PL'
        },
        season: {
          id: 2024,
          startDate: '2024-08-17',
          endDate: '2025-05-25',
          currentMatchday: 15
        },
        utcDate: new Date().toISOString(),
        status: 'PAUSED',
        matchday: 15,
        stage: 'REGULAR_SEASON',
        group: null,
        lastUpdated: new Date().toISOString(),
        odds: {
          msg: 'Odds available'
        },
        score: {
          winner: null,
          duration: 'HT',
          fullTime: {
            home: 0,
            away: 0
          },
          halfTime: {
            home: 0,
            away: 0
          }
        },
        homeTeam: {
          id: 66,
          name: 'Manchester United',
          shortName: 'Man United',
          tla: 'MUN',
          crest: 'https://crests.football-data.org/66.png'
        },
        awayTeam: {
          id: 354,
          name: 'Crystal Palace',
          shortName: 'Crystal Palace',
          tla: 'CRY',
          crest: 'https://crests.football-data.org/354.png'
        },
        referees: []
      }
    ];
  },

  async getTeamDetails(teamId: number): Promise<TeamDetails> {
    const cacheKey = ApiCacheService.getKey.teamDetails(teamId);
    
    return apiCache.getOrFetch(
      cacheKey,
      async () => {
        // Removed console.log for security
        
        const response = await fetch(
          `${FOOTBALL_API_BASE}/teams/${teamId}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Football API error for team ${teamId}:`, response.status, response.statusText, errorText);
          throw new Error(`Football API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      },
      10 * 60 * 1000 // 10 minutes
    );
  },

  async getTeamMatches(teamId: number, season?: number): Promise<FootballMatch[]> {
    const seasonParam = season || 2024;
    const cacheKey = ApiCacheService.getKey.teamMatches(teamId, seasonParam);
    
    return apiCache.getOrFetch(
      cacheKey,
      async () => {
        // Removed console.log for security
        
        const response = await fetch(
          `${FOOTBALL_API_BASE}/teams/${teamId}/matches?season=${seasonParam}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Football API error for team ${teamId} matches:`, response.status, response.statusText, errorText);
          throw new Error(`Football API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.matches || [];
      },
      2 * 60 * 1000 // 2 minutes
    );
  },
};

// Database integration service
export const footballIntegrationService = {
  async syncPremierLeagueTeams(): Promise<void> {
    try {
      // Removed console.log for security
      
      // Get all Premier League teams from the API
      const teams = await footballApiService.getPremierLeagueTeams();
      // Removed console.log for security
      
      // Get existing teams from database
      const { data: existingTeams, error: fetchError } = await supabase
        .from('teams')
        .select('id, external_id, name');
      
      if (fetchError) throw fetchError;
      
      // Removed console.log for security
      
      let updatedCount = 0;
      let createdCount = 0;
      
      for (const apiTeam of teams) {
        const existingTeam = existingTeams?.find(t => t.external_id === apiTeam.id.toString());
        
        const teamData = {
          external_id: apiTeam.id,
          name: apiTeam.name, // Use exact API name
          short_name: apiTeam.shortName, // Use exact API short name
          logo_url: apiTeam.crest,
          updated_at: new Date().toISOString()
        };
        
        if (existingTeam) {
          // Update existing team with basic info only
          const { error: updateError } = await supabase
            .from('teams')
            .update(teamData)
            .eq('id', existingTeam.id);
          
          if (updateError) {
            console.error(`❌ Error updating team ${apiTeam.name}:`, updateError);
          } else {
            // Removed console.log for security
            updatedCount++;
          }
        } else {
          // Create new team with correct initial values
          const { error: insertError } = await supabase
            .from('teams')
            .insert({
              ...teamData,
              initial_market_cap: 100.00,
              market_cap: 100.00,
              shares_outstanding: 5,
              total_shares: 5,
              available_shares: 5,
              is_tradeable: true
            });
          
          if (insertError) {
            console.error(`❌ Error creating team ${apiTeam.name}:`, insertError);
          } else {
            // Removed console.log for security
            createdCount++;
          }
        }
      }
      
      // Removed console.log for security
      
    } catch (error) {
      console.error('❌ Error syncing Premier League teams:', error);
      throw error;
    }
  },

  async syncPremierLeagueFixtures(season?: number): Promise<void> {
    try {
      
      // Get matches from football API with same season as teams
      const matches = await footballApiService.getPremierLeagueMatches(season);

      // Get our teams for mapping
      const { data: ourTeams, error } = await supabase
        .from('teams')
        .select('id, name, external_id');

      console.log('Database query result:', { data: ourTeams, error });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!ourTeams || ourTeams.length === 0) {
        throw new Error('No teams found in database');
      }


      // Create a mapping from football API team names to our team IDs
      // Since we now use exact API names in the database, we can use simple exact matching
      const teamMapping = new Map<string, number>();
      
      ourTeams.forEach(team => {
        teamMapping.set(team.name, team.id);
      });

      // Removed console.log for security

      // Process each match
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const match of matches) {
        const homeTeamId = teamMapping.get(match.homeTeam.name);
        const awayTeamId = teamMapping.get(match.awayTeam.name);

        if (!homeTeamId || !awayTeamId) {
          console.warn(`Could not map teams for match ${match.id}: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          console.warn(`Available team names:`, ourTeams.map(t => t.name));
          skippedCount++;
          continue;
        }

        const fixture = footballApiService.convertMatchToFixture(match);
        fixture.home_team_id = homeTeamId;
        fixture.away_team_id = awayTeamId;

        // Check if fixture already exists
        const { data: existingFixtures, error: checkError } = await supabase
          .from('fixtures')
          .select('id')
          .eq('external_id', fixture.external_id);

        if (checkError) {
          console.error(`Error checking fixture ${fixture.external_id}:`, checkError);
          skippedCount++;
          continue;
        }

        if (existingFixtures && existingFixtures.length > 0) {
          // Update existing fixture
          const { error: updateError } = await supabase
            .from('fixtures')
            .update({
              result: fixture.result,
              status: fixture.status,
              home_score: fixture.home_score,
              away_score: fixture.away_score,
            })
            .eq('external_id', fixture.external_id);
          
          if (updateError) {
            console.error(`Error updating fixture ${fixture.external_id}:`, updateError);
            skippedCount++;
            continue;
          }
        } else {
          // Insert new fixture
          const { error: insertError } = await supabase
            .from('fixtures')
            .insert(fixture);
          
          if (insertError) {
            console.error(`Error inserting fixture ${fixture.external_id}:`, insertError);
            skippedCount++;
            continue;
          }
        }
        
        processedCount++;
      }

    } catch (error) {
      console.error('Error syncing fixtures:', error);
      throw error;
    }
  },

  async syncTeamNamesFromApi(season?: number): Promise<void> {
    try {
      console.log('Syncing team names from Football API...');
      
      const apiTeams = await footballApiService.getPremierLeagueTeams(season);
      console.log(`Found ${apiTeams.length} teams in API`);
      
      // Get current teams from database
      const { data: dbTeams, error: dbError } = await supabase
        .from('teams')
        .select('id, name, external_id');
      
      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }
      
      console.log(`Found ${dbTeams?.length || 0} teams in database`);
      
      // Create a map of existing teams by name for quick lookup (primary method)
      const existingTeamsByName = new Map<string, any>();
      dbTeams?.forEach(team => {
        existingTeamsByName.set(team.name, team);
      });
      
      // Create a map of existing teams by external_id for quick lookup (secondary method)
      const existingTeamsByExternalId = new Map<string, any>();
      dbTeams?.forEach(team => {
        if (team.external_id) {
          existingTeamsByExternalId.set(team.external_id, team);
        }
      });
      
      let updatedCount = 0;
      let createdCount = 0;
      let unchangedCount = 0;
      
      for (const apiTeam of apiTeams) {
        const apiTeamExternalId = apiTeam.id.toString();
        
        // First, try to find by external ID (if it exists)
        let existingTeam = existingTeamsByExternalId.get(apiTeamExternalId);
        
        if (existingTeam) {
          // Team exists with this external ID, update name if different
          if (existingTeam.name !== apiTeam.name) {
            const { error: updateError } = await supabase
              .from('teams')
              .update({ name: apiTeam.name })
              .eq('id', existingTeam.id);
            
            if (updateError) {
              console.error(`Error updating team "${existingTeam.name}":`, updateError);
            } else {
              console.log(`Updated team name: "${existingTeam.name}" → "${apiTeam.name}"`);
              updatedCount++;
            }
          } else {
            unchangedCount++;
          }
        } else {
          // Try to find by name (for existing teams without external_id)
          existingTeam = existingTeamsByName.get(apiTeam.name);
          
          if (existingTeam) {
            // Update existing team with external ID
            const { error: updateError } = await supabase
              .from('teams')
              .update({ external_id: apiTeamExternalId })
              .eq('id', existingTeam.id);
            
            if (updateError) {
              console.error(`Error updating external ID for "${apiTeam.name}":`, updateError);
            } else {
              console.log(`Updated external ID for existing team "${apiTeam.name}": ${apiTeamExternalId}`);
              updatedCount++;
            }
          } else {
            // Create new team (only if it truly doesn't exist)
            const { error: insertError } = await supabase
              .from('teams')
              .insert({
                name: apiTeam.name,
                external_id: apiTeamExternalId,
                initial_market_cap: 100, // Default market cap
                market_cap: 100,
                shares_outstanding: 0
              });
            
            if (insertError) {
              console.error(`Error creating team "${apiTeam.name}":`, insertError);
            } else {
              console.log(`Created new team: "${apiTeam.name}"`);
              createdCount++;
            }
          }
        }
      }
      
      // Remove teams that are no longer in the API (optional - be careful with this)
      // This would remove relegated teams from your database
      // Uncomment if you want this behavior:
      /*
      const apiTeamNames = new Set(apiTeams.map(t => t.name));
      const teamsToRemove = dbTeams?.filter(team => !apiTeamNames.has(team.name)) || [];
      
      for (const teamToRemove of teamsToRemove) {
        await supabase
          .from('teams')
          .delete()
          .eq('id', teamToRemove.id);
        console.log(`Removed team: "${teamToRemove.name}" (no longer in API)`);
      }
      */
      
      console.log(`Team sync completed: ${updatedCount} updated, ${createdCount} created, ${unchangedCount} unchanged`);
    } catch (error) {
      console.error('Error syncing team names:', error);
      throw error;
    }
  },
};
