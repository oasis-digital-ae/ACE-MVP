// Netlify Function for Football API Caching
// Provides server-side caching that benefits ALL users

// Server-side cache (persists across requests)
const serverCache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();

// Cache TTL constants (in milliseconds)
const CACHE_TTL = {
  PREMIER_LEAGUE: 10 * 60 * 1000,      // 10 minutes (increased from 5)
  TEAM_DETAILS: 15 * 60 * 1000,        // 15 minutes (increased from 10)
  TEAM_MATCHES: 5 * 60 * 1000,         // 5 minutes (increased from 2)
};

// Football API configuration
const FOOTBALL_API_BASE = 'https://api.football-data.org/v4';
const API_KEY = process.env.VITE_FOOTBALL_API_KEY;

export const handler = async (event: any, context: any) => {
  // Enable CORS for all origins
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: null,
    };
  }

  try {
    const path = event.path;
    const season = event.queryStringParameters?.season || '2024';
    
    console.log(`Function called with path: ${path}, season: ${season}`);
    console.log(`API Key present: ${!!API_KEY}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

           // Generate cache key based on endpoint
           let cacheKey = '';
           let ttl = CACHE_TTL.PREMIER_LEAGUE;

           if (path.includes('/premier-league-data') || path.includes('/competitions/PL/standings')) {
             cacheKey = `premier_league_standings_${season}`;
             ttl = CACHE_TTL.PREMIER_LEAGUE;
           } else if (path.includes('/premier-league-matches') || path.includes('/competitions/PL/matches')) {
             cacheKey = `premier_league_matches_${season}`;
             ttl = CACHE_TTL.PREMIER_LEAGUE;
           } else if (path.includes('/competitions/PL/teams')) {
             cacheKey = `premier_league_teams_${season}`;
             ttl = CACHE_TTL.PREMIER_LEAGUE;
           } else if (path.includes('/all-teams')) {
             cacheKey = `all_teams_details`;
             ttl = CACHE_TTL.TEAM_DETAILS; // Cache for 15 minutes
           } else if (path.includes('/teams/') && path.includes('/matches')) {
             const teamId = path.split('/teams/')[1]?.split('/')[0];
             cacheKey = `team_matches_${teamId}_${season}`;
             ttl = CACHE_TTL.TEAM_MATCHES;
           } else if (path.includes('/teams/') && !path.includes('/matches')) {
             const teamId = path.split('/teams/')[1];
             cacheKey = `team_details_${teamId}`;
             ttl = CACHE_TTL.TEAM_DETAILS;
           }

    // Check server-side cache first
    const cached = serverCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
        },
        body: JSON.stringify(cached.data),
      };
    }

           // Cache miss - fetch from Football API
           let apiUrl = '';
           if (path.includes('/premier-league-data') || path.includes('/competitions/PL/standings')) {
             apiUrl = `${FOOTBALL_API_BASE}/competitions/PL/standings?season=${season}`;
           } else if (path.includes('/premier-league-matches') || path.includes('/competitions/PL/matches')) {
             apiUrl = `${FOOTBALL_API_BASE}/competitions/PL/matches?season=${season}`;
           } else if (path.includes('/competitions/PL/teams')) {
             apiUrl = `${FOOTBALL_API_BASE}/competitions/PL/teams?season=${season}`;
           } else if (path.includes('/all-teams')) {
             apiUrl = `${FOOTBALL_API_BASE}/teams/`;
           } else if (path.includes('/teams/') && path.includes('/matches')) {
             const teamId = path.split('/teams/')[1]?.split('/')[0];
             apiUrl = `${FOOTBALL_API_BASE}/teams/${teamId}/matches?season=${season}`;
           } else if (path.includes('/teams/') && !path.includes('/matches')) {
             const teamId = path.split('/teams/')[1];
             apiUrl = `${FOOTBALL_API_BASE}/teams/${teamId}`;
           }

           // Validate API URL before making request
           if (!apiUrl) {
             throw new Error(`Unsupported endpoint: ${path}`);
           }

           console.log(`Fetching from API: ${apiUrl}`);

           // Validate API key
           if (!API_KEY) {
             console.error('Football API key not configured');
             return {
               statusCode: 500,
               headers: {
                 ...corsHeaders,
                 'Content-Type': 'application/json',
               },
               body: JSON.stringify({ 
                 error: 'Football API key not configured',
                 details: 'VITE_FOOTBALL_API_KEY environment variable is missing'
               }),
             };
           }

    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Football API error: ${response.status} ${response.statusText}`, errorText);
      return {
        statusCode: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: `Football API error: ${response.status}`,
          details: errorText
        }),
      };
    }

    const data = await response.json();

    // Cache the response
    serverCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Clean up old cache entries (keep only last 100)
    if (serverCache.size > 100) {
      const entries = Array.from(serverCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - 100);
      toDelete.forEach(([key]) => serverCache.delete(key));
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Cache-Key': cacheKey,
        'X-Cache-TTL': ttl.toString(),
      },
      body: JSON.stringify(data),
    };

  } catch (error: any) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
