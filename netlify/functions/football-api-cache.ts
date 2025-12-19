// Netlify Function for Football API Caching
// Provides server-side caching that benefits ALL users

import { rateLimiters } from './utils/rate-limiter';

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

// Get allowed origins from environment or default to production domain
const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (origins) {
    return origins.split(',').map(o => o.trim());
  }
  // Default to production domain and development
  return [
    'https://ace-mvp.netlify.app',
    'https://*.netlify.app',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
};

const getAllowedOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  
  const allowed = getAllowedOrigins();
  
  // Check exact match
  if (allowed.includes(origin)) {
    return origin;
  }
  
  // Check wildcard patterns
  for (const pattern of allowed) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) {
        return origin;
      }
    }
  }
  
  // Default: deny in production, allow localhost in development
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment && origin.includes('localhost')) {
    return origin;
  }
  
  return null;
};

export const handler = async (event: any, context: any) => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigin = getAllowedOrigin(origin);
  
  // CORS headers - only allow specific origins
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin || 'null',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: null,
    };
  }

  // Rate limiting - apply moderate rate limiting
  const rateLimit = rateLimiters.moderate(event);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      },
      body: JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      }),
    };
  }

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
        error: 'Server configuration error',
        message: 'API key not configured'
      }),
    };
  }

  try {
    // Extract path from different possible event formats (Netlify Edge vs regular function)
    let path = event.path || event.rawPath;
    
    // If path is the full URL, extract just the pathname
    if (path && path.startsWith('http')) {
      try {
        const url = new URL(path);
        path = url.pathname;
      } catch (e) {
        console.warn('Could not parse URL:', path);
      }
    }
    
    // Remove any trailing slashes and remove leading /api/football-api-cache if present
    path = path?.replace(/\/$/, '') || '';
    if (path.startsWith('/api/football-api-cache')) {
      path = path.replace('/api/football-api-cache', '');
    }
    
    const season = event.queryStringParameters?.season || '2024';
    
    console.log(`Function called with path: ${path}, season: ${season}`);
    console.log(`Original event.path: ${event.path}`);
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
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
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
             console.error(`Unsupported endpoint: ${path}`);
             return {
               statusCode: 400,
               headers: {
                 ...corsHeaders,
                 'Content-Type': 'application/json',
               },
               body: JSON.stringify({ 
                 error: `Unsupported endpoint: ${path}`,
                 details: 'The requested endpoint is not supported by this function'
               }),
             };
           }

           // Validate cache key
           if (!cacheKey) {
             console.error(`No cache key generated for path: ${path}`);
             return {
               statusCode: 400,
               headers: {
                 ...corsHeaders,
                 'Content-Type': 'application/json',
               },
               body: JSON.stringify({ 
                 error: `No cache key generated for path: ${path}`,
                 details: 'The requested path does not match any supported patterns'
               }),
             };
           }

           console.log(`Fetching from API: ${apiUrl}`);

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
