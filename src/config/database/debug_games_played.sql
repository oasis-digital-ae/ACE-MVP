-- =====================================================
-- DEBUG FIXTURES FOR GAMES PLAYED
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script helps debug why games played shows 0
-- Run this in your Supabase SQL editor to check fixture data

-- =====================================================
-- 1. CHECK FIXTURE STATUS DISTRIBUTION
-- =====================================================

SELECT 
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN result != 'pending' THEN 1 END) as non_pending_results
FROM fixtures 
GROUP BY status
ORDER BY status;

-- =====================================================
-- 2. CHECK TEAMS AND THEIR FIXTURES
-- =====================================================

SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(f.id) as total_fixtures,
    COUNT(CASE WHEN f.status = 'applied' AND f.result != 'pending' THEN 1 END) as games_played
FROM teams t
LEFT JOIN fixtures f ON (f.home_team_id = t.id OR f.away_team_id = t.id)
GROUP BY t.id, t.name
ORDER BY games_played DESC, t.name;

-- =====================================================
-- 3. SAMPLE APPLIED FIXTURES
-- =====================================================

SELECT 
    f.id,
    f.status,
    f.result,
    ht.name as home_team,
    at.name as away_team,
    f.home_score,
    f.away_score,
    f.kickoff_at
FROM fixtures f
JOIN teams ht ON f.home_team_id = ht.id
JOIN teams at ON f.away_team_id = at.id
WHERE f.status = 'applied' AND f.result != 'pending'
ORDER BY f.kickoff_at DESC
LIMIT 10;

-- =====================================================
-- 4. CHECK FOR ANY FIXTURES AT ALL
-- =====================================================

SELECT COUNT(*) as total_fixtures FROM fixtures;

-- =====================================================
-- 5. CHECK SIMULATED GAMES PLAYED COUNTS (NEW LOGIC)
-- =====================================================

SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(CASE WHEN f.status = 'applied' AND f.result != 'pending' AND f.snapshot_home_cap IS NOT NULL AND f.snapshot_away_cap IS NOT NULL THEN 1 END) as simulated_games_played
FROM teams t
LEFT JOIN fixtures f ON (f.home_team_id = t.id OR f.away_team_id = t.id)
GROUP BY t.id, t.name
ORDER BY simulated_games_played DESC, t.name;

-- =====================================================
-- 6. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Games played debug queries completed!';
    RAISE NOTICE '📊 Check the results above to understand games played counts';
    RAISE NOTICE '🔍 Look for:';
    RAISE NOTICE '   - Are there any fixtures in the database?';
    RAISE NOTICE '   - Do any fixtures have status = "applied"?';
    RAISE NOTICE '   - Do any fixtures have result != "pending"?';
    RAISE NOTICE '   - Are team IDs matching correctly?';
    RAISE NOTICE '   - NEW: Only fixtures with snapshot data count as simulated games';
    RAISE NOTICE '   - The app now distinguishes between API-synced and simulated fixtures';
    RAISE NOTICE '🎯 To see incremental updates:';
    RAISE NOTICE '   1. Run reset_fixtures_for_simulation.sql to start fresh';
    RAISE NOTICE '   2. Simulate matches one by one';
    RAISE NOTICE '   3. Games played will increment for each simulated match';
END $$;
