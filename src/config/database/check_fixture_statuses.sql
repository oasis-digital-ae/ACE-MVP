-- =====================================================
-- CHECK CURRENT FIXTURE STATUSES
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script checks the current status of fixtures to understand
-- why games played is showing all matches instead of just simulated ones

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
-- 2. CHECK TEAMS AND THEIR FIXTURES BY STATUS
-- =====================================================

SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(CASE WHEN f.status = 'scheduled' THEN 1 END) as scheduled_games,
    COUNT(CASE WHEN f.status = 'applied' AND f.result != 'pending' THEN 1 END) as completed_games,
    COUNT(f.id) as total_fixtures
FROM teams t
LEFT JOIN fixtures f ON (f.home_team_id = t.id OR f.away_team_id = t.id)
GROUP BY t.id, t.name
ORDER BY completed_games DESC, t.name;

-- =====================================================
-- 3. SAMPLE APPLIED FIXTURES (SHOWING WHY GAMES PLAYED IS HIGH)
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
-- 4. CHECK FOR SCHEDULED FIXTURES (AVAILABLE FOR SIMULATION)
-- =====================================================

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
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fixture status analysis completed!';
    RAISE NOTICE '📊 This explains why games played shows high numbers:';
    RAISE NOTICE '   - If you see many "applied" fixtures, those are from 2024 season data';
    RAISE NOTICE '   - Games played counts ALL applied fixtures, not just simulated ones';
    RAISE NOTICE '   - To see incremental updates, you need fixtures with status="scheduled"';
    RAISE NOTICE '🔧 Solutions:';
    RAISE NOTICE '   1. Reset fixtures to "scheduled" status for simulation';
    RAISE NOTICE '   2. Or modify games played to only count simulated fixtures';
    RAISE NOTICE '   3. Or create a separate counter for simulated matches';
END $$;
