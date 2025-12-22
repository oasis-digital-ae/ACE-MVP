# Deployment Security Setup Guide

## Production URL
**Application URL**: `https://ace-mvp.netlify.app/`

## Required Environment Variables

### Netlify Dashboard
Go to: **Site Settings → Environment Variables**

Add/Update:
```bash
ALLOWED_ORIGINS=https://ace-mvp.netlify.app,https://*.netlify.app
VITE_FOOTBALL_API_KEY=your_football_api_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Dashboard
Go to: **Project Settings → Edge Functions → Environment Variables**

Add/Update:
```bash
ALLOWED_ORIGINS=https://ace-mvp.netlify.app,https://*.netlify.app
FOOTBALL_API_KEY=your_football_api_key_here
```

## Security Features Enabled

✅ **Rate Limiting**: 100 requests/minute per IP  
✅ **CORS**: Restricted to production domain + localhost (dev)  
✅ **Input Validation**: Database functions available  
✅ **Authentication**: Required for all RPC functions  
✅ **API Key Security**: No hardcoded keys in client code  

## Verification Steps

1. **Test CORS**:
   ```bash
   curl -H "Origin: https://ace-mvp.netlify.app" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        https://your-site.netlify.app/.netlify/functions/football-api-cache
   ```
   Should return `Access-Control-Allow-Origin: https://ace-mvp.netlify.app`

2. **Test Rate Limiting**:
   - Make 101 requests rapidly
   - 101st request should return `429 Too Many Requests`
   - Check for `X-RateLimit-*` headers

3. **Verify API Key**:
   - Check browser console for any API key exposure
   - Should see error if `VITE_FOOTBALL_API_KEY` not set

## Security Monitoring

- Check `audit_log` table for security events
- Monitor rate limit violations (429 responses)
- Review Supabase logs for suspicious activity
- Check Netlify function logs for errors

## Troubleshooting

**CORS Errors**:
- Verify `ALLOWED_ORIGINS` is set correctly
- Check that origin matches exactly (including https/http)
- Ensure wildcard patterns are supported

**Rate Limiting Too Strict**:
- Adjust limits in `netlify/functions/utils/rate-limiter.ts`
- Modify `moderate` rate limiter settings

**API Key Issues**:
- Ensure `VITE_FOOTBALL_API_KEY` is set in Netlify
- Check function logs for API key errors
- Verify API key is valid and not expired


