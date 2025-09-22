-- =====================================================
-- RESET TEAMS TABLE ONLY
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This script resets only the teams table to initial state
-- Preserves all other data (positions, orders, fixtures, etc.)

-- =====================================================
-- 1. CLEAR TEAMS TABLE
-- =====================================================

-- Clear all teams data
DELETE FROM teams;

-- Reset teams sequence
ALTER SEQUENCE teams_id_seq RESTART WITH 1;

-- =====================================================
-- 2. INSERT INITIAL TEAMS DATA
-- =====================================================

-- Insert Premier League teams with initial values
INSERT INTO teams (external_id, name, short_name, logo_url, launch_price, initial_market_cap, market_cap, total_shares, available_shares, shares_outstanding) VALUES
(57, 'Arsenal FC', 'ARS', 'https://crests.football-data.org/57.png', 20.00, 100.00, 100.00, 5, 5, 5),
(65, 'Manchester City FC', 'MCI', 'https://crests.football-data.org/65.png', 20.00, 100.00, 100.00, 5, 5, 5),
(61, 'Chelsea FC', 'CHE', 'https://crests.football-data.org/61.png', 20.00, 100.00, 100.00, 5, 5, 5),
(66, 'Manchester United FC', 'MUN', 'https://crests.football-data.org/66.png', 20.00, 100.00, 100.00, 5, 5, 5),
(64, 'Liverpool FC', 'LIV', 'https://crests.football-data.org/64.png', 20.00, 100.00, 100.00, 5, 5, 5),
(73, 'Tottenham Hotspur FC', 'TOT', 'https://crests.football-data.org/73.png', 20.00, 100.00, 100.00, 5, 5, 5),
(67, 'Newcastle United FC', 'NEW', 'https://crests.football-data.org/67.png', 20.00, 100.00, 100.00, 5, 5, 5),
(563, 'West Ham United FC', 'WHU', 'https://crests.football-data.org/563.png', 20.00, 100.00, 100.00, 5, 5, 5),
(354, 'Brighton & Hove Albion FC', 'BHA', 'https://crests.football-data.org/354.png', 20.00, 100.00, 100.00, 5, 5, 5),
(397, 'Aston Villa FC', 'AVL', 'https://crests.football-data.org/397.png', 20.00, 100.00, 100.00, 5, 5, 5),
(402, 'Brentford FC', 'BRE', 'https://crests.football-data.org/402.png', 20.00, 100.00, 100.00, 5, 5, 5),
(351, 'Nottingham Forest FC', 'NFO', 'https://crests.football-data.org/351.png', 20.00, 100.00, 100.00, 5, 5, 5),
(76, 'Wolverhampton Wanderers FC', 'WOL', 'https://crests.football-data.org/76.png', 20.00, 100.00, 100.00, 5, 5, 5),
(346, 'Crystal Palace FC', 'CRY', 'https://crests.football-data.org/346.png', 20.00, 100.00, 100.00, 5, 5, 5),
(328, 'Burnley FC', 'BUR', 'https://crests.football-data.org/328.png', 20.00, 100.00, 100.00, 5, 5, 5),
(389, 'Luton Town FC', 'LUT', 'https://crests.football-data.org/389.png', 20.00, 100.00, 100.00, 5, 5, 5),
(340, 'Southampton FC', 'SOU', 'https://crests.football-data.org/340.png', 20.00, 100.00, 100.00, 5, 5, 5),
(394, 'Leicester City FC', 'LEI', 'https://crests.football-data.org/394.png', 20.00, 100.00, 100.00, 5, 5, 5),
(68, 'Norwich City FC', 'NOR', 'https://crests.football-data.org/68.png', 20.00, 100.00, 100.00, 5, 5, 5),
(715, 'Ipswich Town FC', 'IPS', 'https://crests.football-data.org/715.png', 20.00, 100.00, 100.00, 5, 5, 5);

-- =====================================================
-- 3. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Teams table reset complete!';
    RAISE NOTICE '📊 Teams: 20 Premier League teams inserted';
    RAISE NOTICE '💰 Initial values: $100 market cap, $20 launch price, 5 shares';
    RAISE NOTICE '🔄 Teams sequence reset to 1';
    RAISE NOTICE '💾 Other data preserved (positions, orders, fixtures)';
END $$;

