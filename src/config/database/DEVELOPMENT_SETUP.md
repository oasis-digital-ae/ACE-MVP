# 🔧 Development Environment Setup Guide

## Supabase CORS Configuration Options

You have **3 options** for setting up Supabase CORS:

### Option 1: Universal Setup (Recommended) 🌟
**File:** `src/config/database/universal_cors_setup.sql`

**What it does:**
- Configures Supabase for BOTH local and production
- Allows authentication on all common localhost ports
- Allows authentication on your Netlify production URL

**When to use:** 
- ✅ **Recommended for most developers**
- ✅ Works for both `npm run dev` and `netlify dev`
- ✅ No need to switch configurations

**Run once and forget!**

### Option 2: Local Development Only
**File:** `src/config/database/local_cors_setup.sql`

**What it does:**
- Configures Supabase ONLY for local development
- Allows authentication on localhost ports

**When to use:**
- ✅ When you want to restrict production access
- ✅ When testing local-only features

### Option 3: Production Only
**File:** `src/config/database/netlify_cors_setup.sql`

**What it does:**
- Configures Supabase ONLY for production
- Allows authentication on your Netlify URL

**When to use:**
- ✅ When you want to restrict local access
- ✅ For production-only deployments

## 🚀 Quick Start (Recommended)

1. **Run Universal Setup:**
   ```sql
   -- Execute this in Supabase SQL Editor
   -- File: src/config/database/universal_cors_setup.sql
   ```

2. **Start Local Development:**
   ```bash
   npm run dev
   # or
   netlify dev
   ```

3. **Test Authentication:**
   - Sign up/Login should work on localhost
   - Sign up/Login should work on production

## 🔄 Switching Between Configurations

If you need to switch configurations:

1. **Go to Supabase Dashboard**
2. **Authentication > URL Configuration**
3. **Update Site URL and Redirect URLs**
4. **Save changes**

## 📝 Manual Configuration

Instead of SQL scripts, you can manually configure:

1. **Supabase Dashboard > Authentication > URL Configuration**
2. **Set Site URL:** `https://ace-mvp.netlify.app`
3. **Add Redirect URLs:**
   - `https://ace-mvp.netlify.app/**`
   - `http://localhost:5173/**`
   - `http://localhost:3000/**`
   - `http://localhost:8080/**`

## 🎯 Development Workflow

### For Local Development:
```bash
# Option 1: Use Vite dev server
npm run dev
# URL: http://localhost:5173

# Option 2: Use Netlify dev server
netlify dev
# URL: http://localhost:8888
```

### For Production Testing:
```bash
# Deploy to Netlify
git push origin main
# URL: https://ace-mvp.netlify.app
```

## ⚠️ Important Notes

- **Universal setup is recommended** - it works for both environments
- **Authentication will work** on both local and production
- **No need to switch configurations** between development and production
- **RLS policies are enabled** for all tables
- **All redirect URLs are configured** for common development ports

## 🔍 Troubleshooting

### Authentication Not Working?
1. Check Supabase Dashboard > Authentication > URL Configuration
2. Verify your current URL is in the redirect URLs list
3. Check browser console for CORS errors

### Local Development Issues?
1. Make sure you're using the correct port (5173 for Vite, 8888 for Netlify)
2. Check if your local URL is in the redirect URLs
3. Try clearing browser cache and cookies

### Production Issues?
1. Verify Netlify URL is correct in Supabase
2. Check environment variables in Netlify
3. Ensure all redirect URLs include your production domain

