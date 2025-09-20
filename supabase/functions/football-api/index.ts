import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.replace('/football-api/', '')
    
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

