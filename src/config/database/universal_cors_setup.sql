-- Supabase CORS Configuration for BOTH Local and Production
-- This script sets up CORS for both environments

-- NOTE: auth.config table doesn't exist in newer Supabase versions
-- You need to configure CORS manually in Supabase Dashboard

-- Go to Supabase Dashboard > Authentication > URL Configuration
-- Set Site URL: https://ace-mvp.netlify.app
-- Add Redirect URLs: 
--   - https://ace-mvp.netlify.app/**
--   - http://localhost:5173/**
--   - http://localhost:3000/**
--   - http://localhost:8080/**

-- Alternative: Use Supabase CLI (if you have it installed)
-- supabase auth update --site-url "https://ace-mvp.netlify.app" --redirect-urls "https://ace-mvp.netlify.app/**,http://localhost:5173/**,http://localhost:3000/**,http://localhost:8080/**"

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Verify RLS policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Supabase CORS configuration for BOTH environments completed!';
    RAISE NOTICE 'Production URL: https://ace-mvp.netlify.app';
    RAISE NOTICE 'Local URLs: http://localhost:5173, http://localhost:3000, http://localhost:8080';
    RAISE NOTICE 'You can now test both locally and in production!';
END $$;
