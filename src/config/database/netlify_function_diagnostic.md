# Netlify Function Diagnostic Script

## Problem
Team details modal is getting HTML instead of JSON from Netlify function.

## Quick Diagnostic Steps

### 1. Test Function Directly
Open these URLs in your browser to test the function:

```
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/premier-league-data?season=2024
```

**Expected:** JSON response with standings and matches
**If HTML:** Function is not working

### 2. Check Netlify Dashboard
1. Go to **Netlify Dashboard** → **Functions**
2. Look for `football-api-cache` function
3. Check function logs for errors

### 3. Check Environment Variables
1. Go to **Netlify Dashboard** → **Site Settings** → **Environment Variables**
2. Verify `VITE_FOOTBALL_API_KEY` is set
3. Check if the value is correct

### 4. Test Different Endpoints
Try these endpoints to see which ones work:

```
# Premier League data (standings + matches)
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/premier-league-data?season=2024

# Just standings
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/standings?season=2024

# Just matches
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/matches?season=2024

# Teams
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/teams?season=2024
```

## Immediate Fix Options

### Option 1: Fix Netlify Function (Recommended)
1. **Check environment variables** in Netlify Dashboard
2. **Redeploy** the site
3. **Test function** directly

### Option 2: Use Direct API Calls (Temporary)
Modify `TeamDetailsModal.tsx` to use direct API calls instead of Netlify function:

```typescript
// In TeamDetailsModal.tsx, replace:
const premierLeagueData = await footballApiService.getPremierLeagueData();

// With:
const premierLeagueData = await footballApiService.getPremierLeagueDataDirect();
```

### Option 3: Implement Better Fallback
Add better error handling in `TeamDetailsModal.tsx`:

```typescript
try {
  const premierLeagueData = await footballApiService.getPremierLeagueData();
  // Process data
} catch (error) {
  console.warn('Netlify function failed, using direct API calls');
  // Fallback to direct API calls
  const standings = await footballApiService.getPremierLeagueStandings();
  const matches = await footballApiService.getPremierLeagueMatches();
  // Process data
}
```

## Most Likely Solution

The issue is probably:
1. **Missing `VITE_FOOTBALL_API_KEY`** in Netlify environment variables
2. **Function not deployed** properly
3. **Function throwing an error** and returning HTML error page

**Quick fix:** Add the environment variable in Netlify Dashboard and redeploy.
