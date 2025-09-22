# 🔧 Supabase CORS Configuration - Manual Setup

## ❌ SQL Scripts Don't Work
The `auth.config` table doesn't exist in newer Supabase versions, so you need to configure CORS manually.

## ✅ Manual Configuration Steps

### **Step 1: Go to Supabase Dashboard**
1. Open [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project

### **Step 2: Navigate to Authentication Settings**
1. Click **"Authentication"** in the left sidebar
2. Click **"URL Configuration"** tab

### **Step 3: Configure Site URL**
Set **Site URL** to:
```
https://ace-mvp.netlify.app
```

### **Step 4: Configure Redirect URLs**
Add these **Redirect URLs** (one per line):
```
https://ace-mvp.netlify.app/**
http://localhost:5173/**
http://localhost:3000/**
http://localhost:8080/**
```

### **Step 5: Save Changes**
Click **"Save"** button

## 🎯 **Result**
- ✅ **Production:** Authentication works on `https://ace-mvp.netlify.app`
- ✅ **Local Development:** Authentication works on `http://localhost:5173`
- ✅ **Netlify Dev:** Authentication works on `http://localhost:8888`

## 🔄 **Alternative: Supabase CLI**
If you have Supabase CLI installed:

```bash
supabase auth update \
  --site-url "https://ace-mvp.netlify.app" \
  --redirect-urls "https://ace-mvp.netlify.app/**,http://localhost:5173/**,http://localhost:3000/**,http://localhost:8080/**"
```

## 🚀 **Test Your Setup**

### **Local Development:**
```bash
npm run dev
# Open http://localhost:5173
# Try signing up/login - should work!
```

### **Production:**
```bash
git push origin main
# Open https://ace-mvp.netlify.app
# Try signing up/login - should work!
```

## ⚠️ **Important Notes**
- **Manual configuration is required** - SQL scripts won't work
- **Both local and production** will work with this setup
- **No need to switch configurations** between environments
- **Save changes** after updating URLs

## 🔍 **Troubleshooting**
- **Authentication not working?** Check if your URL is in the redirect URLs list
- **CORS errors?** Verify the Site URL matches your current domain
- **Still having issues?** Try clearing browser cache and cookies

