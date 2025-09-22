-- =====================================================
-- CHECK EMAIL CONFIGURATION
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script helps diagnose email configuration issues

-- =====================================================
-- 1. CHECK AUTH CONFIGURATION
-- =====================================================

-- Check if auth schema exists and is accessible
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'auth'
ORDER BY tablename;

-- =====================================================
-- 2. CHECK RECENT AUTH EVENTS
-- =====================================================

-- Check recent authentication events (if accessible)
SELECT 
    id,
    event_type,
    created_at,
    user_id,
    metadata
FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 3. CHECK USER REGISTRATIONS
-- =====================================================

-- Check recent user registrations
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 4. CHECK PROFILES TABLE
-- =====================================================

-- Check if profiles are being created
SELECT 
    id,
    email,
    created_at,
    updated_at
FROM profiles 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Email configuration check completed!';
    RAISE NOTICE '📧 Check the results above for:';
    RAISE NOTICE '   - Recent user registrations';
    RAISE NOTICE '   - Email confirmation status';
    RAISE NOTICE '   - Authentication events';
    RAISE NOTICE '🔍 If no recent users found, check:';
    RAISE NOTICE '   1. Supabase Dashboard → Authentication → Settings';
    RAISE NOTICE '   2. SMTP configuration';
    RAISE NOTICE '   3. Email templates';
    RAISE NOTICE '   4. Site URL and redirect URLs';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '   - Configure SMTP settings';
    RAISE NOTICE '   - Update email templates';
    RAISE NOTICE '   - Test with different email providers';
END $$;
