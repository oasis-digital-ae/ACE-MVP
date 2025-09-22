# Netlify Function Debug Guide - Environment Variable Set

## Problem
`VITE_FOOTBALL_API_KEY` is set in Netlify environment variables, but function still returns HTML instead of JSON.

## Debugging Steps

### 1. Check Function Logs
**Go to Netlify Dashboard:**
1. **Functions** → **football-api-cache**
2. **View logs** or **View function**
3. Look for error messages

**Common errors to look for:**
- `Football API key not configured`
- `Unsupported endpoint`
- `Football API error: 429` (rate limit)
- `Football API error: 401` (invalid key)

### 2. Test Function Endpoints Directly

**Test these URLs in your browser:**

```
# Test premier-league-data endpoint
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/premier-league-data?season=2024

# Test standings endpoint
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/standings?season=2024

# Test matches endpoint
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/matches?season=2024

# Test teams endpoint
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/teams?season=2024
```

**Expected:** JSON response
**If HTML:** Function is not working

### 3. Check Function Deployment

**Verify function files exist:**
1. **Go to Netlify Dashboard** → **Deploys**
2. **Check latest deploy** → **Functions**
3. **Verify `football-api-cache`** is listed

**If function is missing:**
- Check if `netlify/functions/football-api-cache.ts` exists in your repo
- Redeploy the site

### 4. Check Environment Variable Access

**The function uses:**
```typescript
const API_KEY = process.env.VITE_FOOTBALL_API_KEY;
```

**Possible issues:**
- Environment variable name mismatch
- Function not redeployed after adding env var
- Environment variable not available in function context

### 5. Test API Key Directly

**Test your API key with curl:**
```bash
curl -H "X-Auth-Token: YOUR_API_KEY" https://api.football-data.org/v4/competitions/PL/standings?season=2024
```

**Expected:** JSON response with standings
**If error:** API key issue

### 6. Check Function Path Matching

**The function handles these paths:**
- `/premier-league-data` ✅
- `/competitions/PL/standings` ✅
- `/competitions/PL/matches` ✅
- `/competitions/PL/teams` ✅

**Check if the path is being matched correctly.**

### 7. Common Issues & Solutions

#### Issue: Function Returns 404
**Solution:**
- Function not deployed
- Redeploy the site
- Check function file exists

#### Issue: Function Returns 500
**Solution:**
- Check function logs
- Environment variable issue
- API key invalid

#### Issue: Function Returns HTML
**Solution:**
- Function throwing error
- Check function logs
- Verify API key format

#### Issue: Path Not Matched
**Solution:**
- Check function path matching logic
- Verify URL structure
- Test different endpoints

### 8. Quick Fixes

#### Fix 1: Redeploy After Adding Env Var
```bash
# Trigger redeploy
git commit --allow-empty -m "Redeploy with env vars"
git push
```

#### Fix 2: Check Environment Variable Name
**In Netlify Dashboard:**
- Verify exact name: `VITE_FOOTBALL_API_KEY`
- Check for typos
- Ensure it's set for production

#### Fix 3: Test Function Locally
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Test function locally
netlify dev
```

### 9. Alternative Solution

**If function continues to fail, use direct API calls:**

**Modify `TeamDetailsModal.tsx`:**
```typescript
// Replace Netlify function call with direct API
const premierLeagueData = await Promise.all([
  footballApiService.getPremierLeagueStandings(),
  footballApiService.getPremierLeagueMatches()
]);

const premierLeague = {
  standings: premierLeagueData[0],
  matches: premierLeagueData[1],
  teams: premierLeagueData[0].map(s => s.team)
};
```

### 10. Debugging Checklist

- [ ] Environment variable `VITE_FOOTBALL_API_KEY` is set
- [ ] Function `football-api-cache` is deployed
- [ ] Function logs show no errors
- [ ] API key works with direct curl test
- [ ] Function endpoints return JSON (not HTML)
- [ ] Path matching works correctly
- [ ] Site has been redeployed after adding env var

### 11. Next Steps

1. **Check function logs** in Netlify Dashboard
2. **Test function endpoints** directly
3. **Verify API key** with curl
4. **Redeploy** if needed
5. **Use fallback** if function continues to fail

## Most Likely Causes

1. **Function not redeployed** after adding env var
2. **API key format issue** (extra spaces, wrong format)
3. **Function path not matching** correctly
4. **Function throwing error** and returning HTML error page
5. **Rate limit exceeded** (429 error)

## Quick Test

**Try this URL in your browser:**
```
https://ace-mvp.netlify.app/.netlify/functions/football-api-cache/competitions/PL/standings?season=2024
```

**If it returns JSON:** Function is working
**If it returns HTML:** Function has an issue
**If it returns 404:** Function not deployed
