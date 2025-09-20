# 🚀 Netlify Deployment Checklist

## Pre-Deployment Setup

### 1. Database Setup ✅
- [ ] Run `src/config/database/consolidated_migration.sql` in Supabase
- [ ] Run `src/config/database/simplify_transfers_ledger.sql` in Supabase
- [ ] Verify all tables are created correctly
- [ ] Test database connections

### 2. Environment Variables ✅
Set these in your Netlify site settings:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Football Data API
VITE_FOOTBALL_API_KEY=your_api_key

# Application Configuration
VITE_APP_ENV=production
VITE_DEBUG_MODE=false
```

### 3. Supabase Configuration ✅
- [ ] Enable RLS policies
- [ ] Set up authentication providers
- [ ] Configure CORS for your Netlify domain
- [ ] Deploy Edge Functions (football-api)

## Deployment Methods

### Method 1: Git Integration (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository
   - Netlify will auto-detect settings from `netlify.toml`

3. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `18`

4. **Set Environment Variables**
   - Go to Site settings > Environment variables
   - Add all required variables

5. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete
   - Your site will be live!

### Method 2: Manual Deploy

1. **Build Locally**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `dist` folder
   - Set environment variables in site settings

## Post-Deployment Testing

### 1. Basic Functionality ✅
- [ ] Site loads correctly
- [ ] Authentication works
- [ ] Database connections work
- [ ] API calls succeed

### 2. Trading Features ✅
- [ ] Can view marketplace
- [ ] Can purchase shares
- [ ] Portfolio updates correctly
- [ ] Transaction history works

### 3. Match Simulation ✅
- [ ] Can simulate matches
- [ ] Market caps update
- [ ] Transfer ledger records
- [ ] Per-game simulation works

### 4. Team Details ✅
- [ ] Team details modal opens
- [ ] External API data loads
- [ ] Team logos display
- [ ] Match history shows

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (should be 18+)
   - Verify all dependencies are installed
   - Check for TypeScript errors

2. **Environment Variables**
   - Ensure all required variables are set
   - Check variable names match exactly
   - Verify Supabase URL format

3. **Database Issues**
   - Check RLS policies are enabled
   - Verify CORS settings
   - Test database connections

4. **API Issues**
   - Verify Football Data API key
   - Check Edge Function deployment
   - Test API endpoints

### Support

If you encounter issues:
1. Check Netlify build logs
2. Check Supabase logs
3. Test locally first
4. Review environment variables

## Success! 🎉

Once deployed, your Football MVP will be live at:
`https://your-site-name.netlify.app`

Users can now:
- ✅ Sign up and log in
- ✅ Trade Premier League shares
- ✅ Simulate match results
- ✅ Track their portfolio
- ✅ View team details and statistics
