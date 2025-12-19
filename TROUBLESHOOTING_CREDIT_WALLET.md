# Troubleshooting credit_wallet "Failed to fetch" Error

## Issue
Getting "TypeError: Failed to fetch" when trying to credit $1000 to wallet via `credit_wallet` RPC function.

## Possible Causes

### 1. Network/Connectivity Issues
- **Symptom**: "Failed to fetch" error
- **Check**: Browser console Network tab to see if request is being made
- **Solution**: Check internet connection, firewall, VPN

### 2. CORS Issues
- **Symptom**: CORS error in console
- **Check**: Browser console for CORS errors
- **Solution**: Verify Supabase CORS settings allow your domain

### 3. Authentication Token Expired
- **Symptom**: 401 Unauthorized errors
- **Check**: Session validity in browser console
- **Solution**: User needs to log in again

### 4. Supabase URL/Key Misconfiguration
- **Symptom**: Network errors or 404s
- **Check**: Environment variables in `.env` file
- **Solution**: Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct

### 5. Function Not Found
- **Symptom**: 404 or function not found error
- **Check**: Function exists in database
- **Solution**: Verify function is deployed

### 6. RLS Policy Blocking
- **Symptom**: Permission denied errors
- **Check**: RLS policies on `profiles` table
- **Solution**: Function is SECURITY DEFINER, should bypass RLS

## Verification Steps

1. **Check Browser Console**
   - Open DevTools → Console
   - Look for detailed error messages
   - Check Network tab for failed requests

2. **Verify Environment Variables**
   ```bash
   # Check if these are set correctly
   VITE_SUPABASE_URL=https://zuwpcgfgrwvqsbmyfbwj.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

3. **Test Session**
   ```javascript
   // In browser console
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Session:', session);
   ```

4. **Test RPC Call Directly**
   ```javascript
   // In browser console (replace USER_ID with actual user ID)
   const { data, error } = await supabase.rpc('credit_wallet', {
     p_user_id: 'USER_ID',
     p_amount_cents: 100000,
     p_ref: 'test_' + Date.now(),
     p_currency: 'usd'
   });
   console.log('Result:', { data, error });
   ```

## Enhanced Error Handling

The DepositModal now includes:
- Session validation before RPC call
- Detailed console logging
- Better error messages
- Network error detection

## Next Steps

1. Check browser console for detailed error messages
2. Verify session is valid
3. Check Network tab for request details
4. Verify environment variables are set correctly
5. Test RPC call directly in browser console
