import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Get allowed origins from environment
const getAllowedOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
    'https://ace-mvp.netlify.app',
    'https://*.netlify.app',
    'http://localhost:5173',
    'http://localhost:8888'
  ];
  
  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // Check wildcard patterns
  for (const pattern of allowedOrigins) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) {
        return origin;
      }
    }
  }
  
  // Allow localhost in development
  if (origin.includes('localhost')) {
    return origin;
  }
  
  return null;
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = getAllowedOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allowedOrigin || 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/football-api/', '')
    
    // Validate path to prevent path traversal
    if (path.includes('..') || path.includes('//')) {
      throw new Error('Invalid path')
    }
    
    // Get API key from environment
    const apiKey = Deno.env.get('FOOTBALL_API_KEY')
    if (!apiKey) {
      throw new Error('Football API key not configured')
    }

    // Forward the request to football-data.org
    const footballUrl = `https://api.football-data.org/v4/${path}${url.search}`
    
    const response = await fetch(footballUrl, {
      headers: {
        'X-Auth-Token': apiKey,
        'User-Agent': 'ACE-MVP/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

