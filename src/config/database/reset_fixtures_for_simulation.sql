-- =====================================================
-- RESET FIXTURES FOR SIMULATION
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script resets all applied fixtures to scheduled status
-- so you can start fresh with simulation and see incremental games played updates

-- =====================================================
-- 1. BACKUP CURRENT STATE (OPTIONAL)
-- =====================================================

-- Create a backup table of current fixture states
CREATE TABLE IF NOT EXISTS fixtures_backup AS 
SELECT * FROM fixtures WHERE status = 'applied';

-- =====================================================
-- 2. RESET APPLIED FIXTURES TO SCHEDULED
-- =====================================================

-- Reset all applied fixtures to scheduled status
UPDATE fixtures 
SET 
    status = 'scheduled',
    result = 'pending',
    home_score = NULL,
    away_score = NULL,
    snapshot_home_cap = NULL,
    snapshot_away_cap = NULL
WHERE status = 'applied';

-- =====================================================
-- 3. VERIFY THE RESET
-- =====================================================

-- Check the new status distribution
SELECT 
    status,
    COUNT(*) as count
FROM fixtures 
GROUP BY status
ORDER BY status;

-- =====================================================
-- 4. CHECK GAMES PLAYED COUNTS (SHOULD NOW BE 0)
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
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
    reset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO reset_count FROM fixtures WHERE status = 'scheduled';
    
    RAISE NOTICE '✅ Fixtures reset for simulation!';
    RAISE NOTICE '🔄 Reset % fixtures to scheduled status', reset_count;
    RAISE NOTICE '📊 Games played counts should now show 0 for all teams';
    RAISE NOTICE '🎯 Now you can simulate matches and see incremental updates';
    RAISE NOTICE '💡 Each simulated match will increment games played by 1';
    RAISE NOTICE '📋 Backup created in fixtures_backup table (if needed)';
END $$;
