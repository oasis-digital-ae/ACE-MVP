-- Complete Database Reset - Start Fresh
-- This script resets all data to initial state (market cap 100, shares 5)

-- =====================================================
-- 1. CLEAR ALL TRANSACTION DATA
-- =====================================================

-- Clear all ledgers and transaction history
DELETE FROM total_ledger;
DELETE FROM transfers_ledger;
DELETE FROM audit_log;

-- Clear user positions and orders
DELETE FROM positions;
DELETE FROM orders;

-- Clear fixtures (but keep teams for now)
DELETE FROM fixtures;

-- =====================================================
-- 2. RESET TEAMS TO INITIAL STATE
-- =====================================================

-- Reset all teams to initial values
UPDATE teams SET
  market_cap = 100.00,
  shares_outstanding = 5,
  total_shares = 5,
  available_shares = 5,
  initial_market_cap = 100.00,
  launch_price = 20.00,
  updated_at = NOW();

-- =====================================================
-- 3. RESET SEQUENCES
-- =====================================================

-- Reset all sequence counters
ALTER SEQUENCE total_ledger_id_seq RESTART WITH 1;
ALTER SEQUENCE transfers_ledger_id_seq RESTART WITH 1;
ALTER SEQUENCE audit_log_id_seq RESTART WITH 1;
ALTER SEQUENCE positions_id_seq RESTART WITH 1;
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE fixtures_id_seq RESTART WITH 1;

-- =====================================================
-- 4. INSERT INITIAL LEDGER ENTRIES
-- =====================================================

-- Create initial ledger entries for all teams
INSERT INTO total_ledger (
  team_id, ledger_type, market_cap_before, market_cap_after,
  shares_outstanding_before, shares_outstanding_after,
  share_price_before, share_price_after, price_impact,
  trigger_event_type, event_description, created_by
)
SELECT 
  id, 'initial_state', 100.00, 100.00,
  5, 5,
  20.00, 20.00, 0,
  'initial', 'Initial team state - Market cap $100, Shares 5, Price $20', 'system'
FROM teams;

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
  team_count INTEGER;
  ledger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO team_count FROM teams;
  SELECT COUNT(*) INTO ledger_count FROM total_ledger;
  
  RAISE NOTICE '✅ Database reset complete!';
  RAISE NOTICE 'Teams reset: %', team_count;
  RAISE NOTICE 'Initial ledger entries: %', ledger_count;
  RAISE NOTICE 'All teams now have market cap $100 and 5 shares';
END $$;
