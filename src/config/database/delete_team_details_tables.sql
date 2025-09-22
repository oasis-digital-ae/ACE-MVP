-- =====================================================
-- DELETE TEAM DETAILS TABLES
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script safely removes the team_details table and related objects
-- Run this in your Supabase SQL editor

-- =====================================================
-- 1. DROP VIEWS FIRST (if they exist)
-- =====================================================

-- Drop the team_sync_status view
DROP VIEW IF EXISTS team_sync_status;

-- =====================================================
-- 2. DROP FUNCTIONS (if they exist)
-- =====================================================

-- Drop sync functions
DROP FUNCTION IF EXISTS sync_team_details(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_team_details();

-- =====================================================
-- 3. DROP TABLE
-- =====================================================

-- Drop the team_details table (this will also drop all indexes and constraints)
DROP TABLE IF EXISTS team_details CASCADE;

-- =====================================================
-- 4. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Team details tables and related objects deleted successfully!';
    RAISE NOTICE '🗑️ Removed: team_details table';
    RAISE NOTICE '🗑️ Removed: team_sync_status view';
    RAISE NOTICE '🗑️ Removed: sync functions';
    RAISE NOTICE '🔄 Database is back to original state';
END $$;
