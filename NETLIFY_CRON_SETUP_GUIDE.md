# Netlify Scheduled Functions Setup Guide

## ✅ What I've Created

1. **`netlify/functions/update-matches.ts`** - A scheduled function that runs every 30 minutes
2. **Installed `@netlify/functions`** package
3. **Disabled browser-based updates** in `src/features/trading/contexts/AppContext.tsx`

## 📋 Step-by-Step Setup

### Step 1: Add Environment Variables

In your **Netlify Dashboard** → **Site Settings** → **Environment Variables**, add:

```
VITE_SUPABASE_URL = your_supabase_url
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
VITE_FOOTBALL_API_KEY = your_football_api_key
```

**Important:** The `SUPABASE_SERVICE_ROLE_KEY` is different from your regular Supabase key. You can find it in:
- Supabase Dashboard → Project Settings → API → `service_role` key (keep this secret!)

### Step 2: Deploy to Netlify

```bash
# Build the project
npm run build

# Deploy to Netlify
netlify deploy --prod
```

Or just commit and push to your Git repository (if connected to Netlify).

### Step 3: Verify the Function

1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Look for `update-matches`
3. It should show a **"Scheduled"** badge
4. You'll see the next execution time

## 🚨 Limitations & Important Notes

### 1. **30-Second Execution Time Limit** ⚠️
- Scheduled Functions have a **MAXIMUM 30 seconds** execution time limit
- The function processes ALL fixtures in one run
- For Premier League (~380 fixtures), typical processing is under 30 seconds
- If you exceed 30 seconds, the function will timeout
- **Solution:** Use Netlify **Background Functions** for up to 15 minutes (see note below)

### 2. **Only Runs on Published Deploys**
- Scheduled functions **DO NOT RUN** on:
  - Branch previews
  - Deploy previews
  - Development environments
- They **ONLY RUN** on production (published) deploys
- **Solution:** Always test locally before deploying

### 3. **Cannot Be Invoked via URL**
- You can't call this function with a URL like `/api/update-matches`
- It runs automatically on the schedule
- To test locally: `netlify dev` then the function will run on schedule

### 4. **Doesn't Work with Site-Wide Password Protection**
- If you enable site-wide password protection in Netlify, this won't work
- **Solution:** Keep your site public or use IP restrictions instead

### 5. **Incompatible with Split Testing**
- If you enable A/B testing, scheduled functions won't run
- **Solution:** Disable split testing on your site

### 6. **External API Rate Limits**
- Football API has rate limits (check your plan)
- The function fetches one fixture at a time
- **Solution:** The function is designed to stay within limits

### 7. **Serverless Cold Starts**
- First invocation might be slow (~2-5 seconds)
- Subsequent invocations are fast
- **Solution:** This is normal for serverless functions

### 8. **No Response Body**
- Scheduled functions don't return responses that users can see
- Check logs in Netlify Dashboard → Functions → `update-matches` → View logs

## 🔧 How It Works

The function:
1. **Runs every 30 minutes** automatically
2. **Captures snapshots** 30 minutes before match kickoff
3. **Updates live matches** every 30 minutes during games
4. **Updates finished matches** when results are available
5. **Processes in batches** to stay under 30-second limit

## 🧪 Testing Locally

```bash
# Start Netlify dev
netlify dev

# In another terminal, invoke the function manually
netlify functions:invoke update-matches
```

## 📊 Monitoring

Check the function logs:
1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Click on `update-matches`
3. View **"Invocation log"** to see execution history

Look for log messages like:
- `🏈 Match update function started`
- `📊 Checking X fixtures...`
- `✅ Updated fixture X: applied - home_win`
- `📸 Capturing snapshots for fixture X`

## 🔄 Alternative Schedules

To change the schedule, edit `netlify/functions/update-matches.ts`:

```typescript
// Every hour
export const config = { schedule: '@hourly' };

// Every 15 minutes
export const config = { schedule: '*/15 * * * *' };

// Every day at midnight
export const config = { schedule: '0 0 * * *' };
```

## ⚠️ What Changed in Your Code

**Before:** Each user's browser was fetching match data and updating the database independently.

**Now:** Only the Netlify function (running server-side) updates the database. Users just read the data.

**Location of change:** `src/features/trading/contexts/AppContext.tsx` - line 208 is now commented out.

## 🐛 Troubleshooting

### Function not running?
- Check that your site is published (not a preview)
- Verify environment variables are set
- Check function logs for errors

### Too many fixtures, timing out?
- The function processes all fixtures in one run
- Netlify Scheduled Functions have a 30-second limit
- If you hit timeout, switch to **Background Functions** (15-minute limit):
  - Change `schedule: '*/30 * * * *'` to use `@netlify/functions` background mode
  - Or reduce the time window: change `48 hours` to `24 hours`

### API rate limit errors?
- Increase cache time or reduce update frequency
- Check your Football API plan limits

## 📝 Next Steps

1. Add environment variables in Netlify Dashboard
2. Deploy: `git push` or `netlify deploy --prod`
3. Monitor the function logs
4. Users can now just refresh their browser to see updated matches

---

**Need help?** Check the Netlify documentation: https://docs.netlify.com/build/functions/scheduled-functions/

