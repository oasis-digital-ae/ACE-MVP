# Credit Wallet Diagnostic & Fix Guide

## Current Status

✅ **Function Exists**: `credit_wallet` function is deployed  
✅ **Permissions**: Function has EXECUTE grants for `authenticated`, `anon`, `service_role`  
✅ **Security**: Function is `SECURITY DEFINER` (runs with elevated privileges)  
✅ **Trigger**: Updated to allow RPC functions via session variable  
✅ **Frontend Code**: Updated with better error handling and logging  

## Error: "TypeError: Failed to fetch"

This is a **network-level error**, not a database error. Possible causes:

### 1. **Network Connectivity**
- Check internet connection
- Check if Supabase is accessible: `https://zuwpcgfgrwvqsbmyfbwj.supabase.co`
- Check browser console Network tab for failed requests

### 2. **Environment Variables**
Verify these are set correctly in your deployment:
```
VITE_SUPABASE_URL=https://zuwpcgfgrwvqsbmyfbwj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. **Session/Authentication**
- User must be logged in
- Session token must be valid
- Check browser console for auth errors

### 4. **CORS Issues**
- Check browser console for CORS errors
- Verify Supabase project settings allow your domain

## Debugging Steps

### Step 1: Check Browser Console
Open DevTools → Console and look for:
- Detailed error messages
- Network request failures
- Authentication errors

### Step 2: Check Network Tab
Open DevTools → Network:
- Look for request to `/rest/v1/rpc/credit_wallet`
- Check status code (should be 200)
- Check request headers (Authorization should be present)
- Check response body for error details

### Step 3: Test in Browser Console
```javascript
// Test if Supabase client is configured correctly
console.log('Supabase URL:', supabase.supabaseUrl);
console.log('Supabase Key:', supabase.supabaseKey?.substring(0, 20) + '...');

// Test session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Test RPC call directly
const { data, error } = await supabase.rpc('credit_wallet', {
  p_user_id: session.user.id,
  p_amount_cents: 100000,
  p_ref: 'test_' + Date.now(),
  p_currency: 'usd'
});
console.log('Result:', { data, error });
```

### Step 4: Verify Function is Accessible
The function should be accessible at:
```
POST https://zuwpcgfgrwvqsbmyfbwj.supabase.co/rest/v1/rpc/credit_wallet
Headers:
  Authorization: Bearer <anon_key>
  apikey: <anon_key>
  Content-Type: application/json
Body:
{
  "p_user_id": "<user_id>",
  "p_amount_cents": 100000,
  "p_ref": "test_123",
  "p_currency": "usd"
}
```

## Enhanced Error Handling

The DepositModal now includes:
- ✅ Session validation before RPC call
- ✅ Detailed console logging
- ✅ Better error messages
- ✅ Network error detection

## Next Steps

1. **Check Browser Console** - Look for detailed error messages
2. **Check Network Tab** - See if request is being made and what response is received
3. **Test RPC Call** - Use browser console to test directly
4. **Verify Environment Variables** - Ensure they're set in production
5. **Check Supabase Dashboard** - Verify function exists and is accessible

## Quick Fix: Test Directly

If you want to test immediately, you can run this in the browser console:

```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  console.error('Not logged in');
} else {
  // Call credit_wallet
  const { data, error } = await supabase.rpc('credit_wallet', {
    p_user_id: user.id,
    p_amount_cents: 100000,
    p_ref: 'manual_test_' + Date.now(),
    p_currency: 'usd'
  });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Wallet credited.');
  }
}
```

This will help identify if it's a frontend issue or a backend issue.


