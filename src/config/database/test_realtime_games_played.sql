-- =====================================================
-- TEST REAL-TIME GAMES PLAYED UPDATES
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script helps test the real-time games played updates
-- Run this to create some test fixtures and verify the functionality

-- =====================================================
-- 1. CREATE TEST FIXTURES FOR SIMULATION
-- =====================================================

-- First, let's see what fixtures we have
SELECT 
    f.id,
    f.status,
    f.result,
    ht.name as home_team,
    at.name as away_team,
    f.kickoff_at
FROM fixtures f
JOIN teams ht ON f.home_team_id = ht.id
JOIN teams at ON f.away_team_id = at.id
WHERE f.status = 'scheduled'
ORDER BY f.kickoff_at
LIMIT 10;

-- =====================================================
-- 2. CHECK CURRENT GAMES PLAYED COUNTS
-- =====================================================

SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(CASE WHEN f.status = 'applied' AND f.result != 'pending' THEN 1 END) as games_played
FROM teams t
LEFT JOIN fixtures f ON (f.home_team_id = t.id OR f.away_team_id = t.id)
GROUP BY t.id, t.name
ORDER BY games_played DESC, t.name;

-- =====================================================
-- 3. SIMULATE A SINGLE MATCH (EXAMPLE)
-- =====================================================

-- Pick a scheduled fixture to simulate
-- Replace FIXTURE_ID with an actual fixture ID from step 1
/*
UPDATE fixtures 
SET 
    status = 'applied',
    result = 'home_win',
    home_score = 2,
    away_score = 1,
    snapshot_home_cap = (SELECT market_cap FROM teams WHERE id = home_team_id),
    snapshot_away_cap = (SELECT market_cap FROM teams WHERE id = away_team_id)
WHERE id = FIXTURE_ID;

-- Process the match result to update market caps
-- This would normally be done by the application
*/

-- =====================================================
-- 4. VERIFY GAMES PLAYED UPDATED
-- =====================================================

-- After simulating a match, run this again to see the updated count
/*
SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(CASE WHEN f.status = 'applied' AND f.result != 'pending' THEN 1 END) as games_played
FROM teams t
LEFT JOIN fixtures f ON (f.home_team_id = t.id OR f.away_team_id = t.id)
GROUP BY t.id, t.name
ORDER BY games_played DESC, t.name;
*/

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Real-time games played test queries completed!';
    RAISE NOTICE '📊 Steps to test real-time updates:';
    RAISE NOTICE '   1. Check current games played counts above';
    RAISE NOTICE '   2. Go to Season Simulation in the app';
    RAISE NOTICE '   3. Simulate a single match';
    RAISE NOTICE '   4. Check that games played count updates immediately';
    RAISE NOTICE '   5. Repeat for more matches to see incremental updates';
    RAISE NOTICE '🎯 The games played count should now update in real-time!';
END $$;
