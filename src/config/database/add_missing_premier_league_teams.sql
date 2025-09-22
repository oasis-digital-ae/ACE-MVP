-- =====================================================
-- ADD MISSING PREMIER LEAGUE TEAMS
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script adds the missing teams that are causing fixture sync failures
-- Based on the error logs showing missing teams

-- =====================================================
-- 1. ADD FULHAM FC
-- =====================================================

INSERT INTO teams (
    name, 
    short_name, 
    external_id, 
    market_cap, 
    initial_market_cap,
    shares_outstanding, 
    total_shares, 
    available_shares, 
    launch_price,
    is_tradeable, 
    created_at, 
    updated_at
) VALUES (
    'Fulham FC',
    'Fulham',
    63,  -- External ID from Football API
    100.00,
    100.00,
    5,
    5,
    5,
    20.00,
    true,
    NOW(),
    NOW()
) ON CONFLICT (external_id) DO NOTHING;

-- =====================================================
-- 2. ADD EVERTON FC
-- =====================================================

INSERT INTO teams (
    name, 
    short_name, 
    external_id, 
    market_cap, 
    initial_market_cap,
    shares_outstanding, 
    total_shares, 
    available_shares, 
    launch_price,
    is_tradeable, 
    created_at, 
    updated_at
) VALUES (
    'Everton FC',
    'Everton',
    62,  -- External ID from Football API
    100.00,
    100.00,
    5,
    5,
    5,
    20.00,
    true,
    NOW(),
    NOW()
) ON CONFLICT (external_id) DO NOTHING;

-- =====================================================
-- 3. ADD AFC BOURNEMOUTH
-- =====================================================

INSERT INTO teams (
    name, 
    short_name, 
    external_id, 
    market_cap, 
    initial_market_cap,
    shares_outstanding, 
    total_shares, 
    available_shares, 
    launch_price,
    is_tradeable, 
    created_at, 
    updated_at
) VALUES (
    'AFC Bournemouth',
    'Bournemouth',
    1044,  -- External ID from Football API
    100.00,
    100.00,
    5,
    5,
    5,
    20.00,
    true,
    NOW(),
    NOW()
) ON CONFLICT (external_id) DO NOTHING;

-- =====================================================
-- 4. VERIFY THE ADDITIONS
-- =====================================================

SELECT 
    id,
    name,
    external_id,
    market_cap,
    shares_outstanding,
    launch_price
FROM teams 
WHERE name IN ('Fulham FC', 'Everton FC', 'AFC Bournemouth')
ORDER BY name;

-- =====================================================
-- 5. CHECK TOTAL TEAM COUNT
-- =====================================================

SELECT COUNT(*) as total_teams FROM teams;

-- =====================================================
-- 6. SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
    team_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO team_count FROM teams;
    
    RAISE NOTICE '✅ Missing Premier League teams added!';
    RAISE NOTICE '➕ Added: Fulham FC, Everton FC, AFC Bournemouth';
    RAISE NOTICE '📊 Total teams in database: %', team_count;
    RAISE NOTICE '🎯 Fixture sync should now work without mapping errors';
    RAISE NOTICE '🔄 Try running fixture sync again';
END $$;
