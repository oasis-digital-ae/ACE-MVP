# Netlify Function Troubleshooting Guide

## Problem
Getting "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" error when clicking "Sync Teams" on production.

## Root Cause
The Netlify function is returning HTML instead of JSON, which typically means:
1. Function is not deployed properly
2. Environment variables are missing
3. Function is throwing an error and returning HTML error page
4. Function path is incorrect

## Solution Steps

### 1. Check Netlify Function Deployment

#### A. Verify Function Files
Ensure these files exist in your repository:
```
netlify/functions/football-api-cache.ts
netlify.toml
```

#### B. Check Netlify Dashboard
1. Go to **Netlify Dashboard** → **Functions**
2. Verify `football-api-cache` function is listed
3. Check function logs for errors

#### C. Test Function Directly
Try accessing the function directly:
```
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/teams?season=2024
```

### 2. Check Environment Variables

#### A. Netlify Dashboard Environment Variables
1. Go to **Netlify Dashboard** → **Site Settings** → **Environment Variables**
2. Verify `VITE_FOOTBALL_API_KEY` is set
3. Check if the value is correct (should start with letters/numbers)

#### B. Function Environment Variables
The function uses `process.env.VITE_FOOTBALL_API_KEY` to access the API key.

### 3. Check Function Logs

#### A. Netlify Dashboard Logs
1. Go to **Netlify Dashboard** → **Functions** → **football-api-cache**
2. Click **View logs**
3. Look for error messages

#### B. Common Error Messages
- `Football API key not configured` → Environment variable missing
- `Football API error: 429` → Rate limit exceeded
- `Football API error: 401` → Invalid API key
- `Unsupported endpoint` → Function path not matching

### 4. Debug Function Endpoints

#### A. Check Function Path Matching
The function handles these paths:
- `/competitions/PL/teams` ✅
- `/competitions/PL/standings` ✅
- `/competitions/PL/matches` ✅
- `/teams/{id}` ✅
- `/teams/{id}/matches` ✅

#### B. Test Each Endpoint
```bash
# Test teams endpoint
curl "https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/teams?season=2024"

# Test standings endpoint
curl "https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/standings?season=2024"
```

### 5. Fix Common Issues

#### Issue: Function Not Deployed
**Solution:**
1. Ensure `netlify/functions/football-api-cache.ts` exists
2. Redeploy the site
3. Check Netlify build logs

#### Issue: Environment Variable Missing
**Solution:**
1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add `VITE_FOOTBALL_API_KEY` with your Football Data API key
3. Redeploy the site

#### Issue: API Key Invalid
**Solution:**
1. Verify API key is correct
2. Check API key has proper permissions
3. Test API key directly: `curl -H "X-Auth-Token: YOUR_KEY" https://api.football-data.org/v4/competitions/PL/teams`

#### Issue: Rate Limit Exceeded
**Solution:**
1. Wait for rate limit to reset (10 calls/minute)
2. Implement better caching
3. Use batch requests

### 6. Alternative Solutions

#### A. Use Direct API Calls (Temporary)
If function continues to fail, modify `football-api.ts` to use direct API calls:

```typescript
// In getPremierLeagueTeams function
const teamsEndpoint = `${FOOTBALL_API_BASE}/competitions/PL/teams?season=${seasonParam}`;

const response = await fetch(teamsEndpoint, {
  headers: {
    'X-Auth-Token': (import.meta as any).env?.VITE_FOOTBALL_API_KEY || ''
  }
});
```

#### B. Implement Fallback Logic
Add fallback to direct API if function fails:

```typescript
try {
  // Try Netlify function first
  const response = await fetch(`/api/football-api-cache/competitions/PL/teams?season=${seasonParam}`);
  if (response.ok) {
    return await response.json();
  }
} catch (error) {
  console.warn('Netlify function failed, falling back to direct API');
}

// Fallback to direct API
const response = await fetch(`${FOOTBALL_API_BASE}/competitions/PL/teams?season=${seasonParam}`, {
  headers: {
    'X-Auth-Token': (import.meta as any).env?.VITE_FOOTBALL_API_KEY || ''
  }
});
```

### 7. Testing Steps

#### A. Local Testing
```bash
# Test function locally
netlify dev

# Test endpoint
curl "http://localhost:8888/.netlify/functions/football-api-cache/competitions/PL/teams?season=2024"
```

#### B. Production Testing
```bash
# Test production function
curl "https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/teams?season=2024"
```

### 8. Quick Fix

If you need immediate functionality:

1. **Go to Netlify Dashboard** → **Site Settings** → **Environment Variables**
2. **Add/Update** `VITE_FOOTBALL_API_KEY` with your Football Data API key
3. **Redeploy** the site
4. **Test** the sync teams functionality

### 9. Monitoring

#### A. Set Up Monitoring
1. Check Netlify function logs regularly
2. Monitor API rate limits
3. Set up alerts for function failures

#### B. Performance Optimization
1. Implement proper caching
2. Use batch API calls
3. Monitor function execution time

## Expected Result

After fixing the issues:
- ✅ Sync Teams button works without errors
- ✅ Function returns proper JSON responses
- ✅ Teams are synced from Football Data API
- ✅ No HTML error pages returned

## Next Steps

1. **Fix environment variables** in Netlify Dashboard
2. **Redeploy** the site
3. **Test** sync teams functionality
4. **Monitor** function logs for any remaining issues
5. **Implement** fallback logic if needed
