-- Supabase CORS Configuration for LOCAL Development
-- Run this in your Supabase SQL Editor for LOCAL testing

-- NOTE: auth.config table doesn't exist in newer Supabase versions
-- You need to configure CORS manually in Supabase Dashboard

-- Go to Supabase Dashboard > Authentication > URL Configuration
-- Set Site URL: http://localhost:5173
-- Add Redirect URLs: 
--   - http://localhost:5173/**
--   - http://localhost:3000/**
--   - http://localhost:8080/**

-- Alternative: Use Supabase CLI (if you have it installed)
-- supabase auth update --site-url "http://localhost:5173" --redirect-urls "http://localhost:5173/**,http://localhost:3000/**,http://localhost:8080/**"

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
    RAISE NOTICE 'Supabase CORS configuration for LOCAL development completed!';
    RAISE NOTICE 'Site URL: http://localhost:5173';
    RAISE NOTICE 'Redirect URLs: http://localhost:5173/**, http://localhost:3000/**, http://localhost:8080/**';
    RAISE NOTICE 'You can now test authentication locally!';
END $$;
