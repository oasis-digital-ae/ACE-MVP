-- =====================================================
-- CHECK FOR ALL MISSING PREMIER LEAGUE TEAMS
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script helps identify all teams that might be missing
-- Run this to see what teams are in the current Premier League season

-- =====================================================
-- 1. CURRENT TEAMS IN DATABASE
-- =====================================================

SELECT 
    name,
    external_id,
    market_cap,
    shares_outstanding
FROM teams 
ORDER BY name;

-- =====================================================
-- 2. EXPECTED PREMIER LEAGUE TEAMS (2024-25 SEASON)
-- =====================================================

-- These are the 20 teams in the current Premier League season
-- If any are missing, they need to be added

WITH expected_teams AS (
    SELECT unnest(ARRAY[
        'Arsenal FC',
        'Aston Villa FC', 
        'AFC Bournemouth',
        'Brentford FC',
        'Brighton & Hove Albion FC',
        'Chelsea FC',
        'Crystal Palace FC',
        'Everton FC',
        'Fulham FC',
        'Ipswich Town FC',
        'Leicester City FC',
        'Liverpool FC',
        'Luton Town FC',
        'Manchester City FC',
        'Manchester United FC',
        'Newcastle United FC',
        'Norwich City FC',
        'Nottingham Forest FC',
        'Southampton FC',
        'Tottenham Hotspur FC',
        'West Ham United FC',
        'Wolverhampton Wanderers FC'
    ]) AS team_name
)
SELECT 
    et.team_name,
    CASE 
        WHEN t.name IS NULL THEN 'MISSING'
        ELSE 'PRESENT'
    END as status,
    t.external_id,
    t.market_cap
FROM expected_teams et
LEFT JOIN teams t ON t.name = et.team_name
ORDER BY et.team_name;

-- =====================================================
-- 3. MISSING TEAMS SUMMARY
-- =====================================================

WITH expected_teams AS (
    SELECT unnest(ARRAY[
        'Arsenal FC',
        'Aston Villa FC', 
        'AFC Bournemouth',
        'Brentford FC',
        'Brighton & Hove Albion FC',
        'Chelsea FC',
        'Crystal Palace FC',
        'Everton FC',
        'Fulham FC',
        'Ipswich Town FC',
        'Leicester City FC',
        'Liverpool FC',
        'Luton Town FC',
        'Manchester City FC',
        'Manchester United FC',
        'Newcastle United FC',
        'Norwich City FC',
        'Nottingham Forest FC',
        'Southampton FC',
        'Tottenham Hotspur FC',
        'West Ham United FC',
        'Wolverhampton Wanderers FC'
    ]) AS team_name
)
SELECT 
    COUNT(*) as missing_teams,
    STRING_AGG(et.team_name, ', ') as missing_team_names
FROM expected_teams et
LEFT JOIN teams t ON t.name = et.team_name
WHERE t.name IS NULL;

-- =====================================================
-- 4. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Premier League team comparison completed!';
    RAISE NOTICE '📊 Check the results above to see:';
    RAISE NOTICE '   - Which teams are present in your database';
    RAISE NOTICE '   - Which teams are missing (status = MISSING)';
    RAISE NOTICE '   - Summary of missing teams';
    RAISE NOTICE '🔧 Next steps:';
    RAISE NOTICE '   1. Run add_missing_premier_league_teams.sql for basic missing teams';
    RAISE NOTICE '   2. Add any additional missing teams found above';
    RAISE NOTICE '   3. Try fixture sync again';
END $$;
