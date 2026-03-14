-- Migration: Convert monetary storage from cents to ten-thousandths of a dollar
-- This enables 4 decimal place precision (e.g. $3.5656) for purchases and display
-- 
-- Before: 1 unit = $0.01 (cents)
-- After:  1 unit = $0.0001 (ten-thousandths)
-- Formula: new_value = old_value * 100
--
-- Run this on STAGING first. Do NOT run on production until validated.

BEGIN;

-- positions
UPDATE positions 
SET total_invested = total_invested * 100 
WHERE total_invested IS NOT NULL AND total_invested > 0;

UPDATE positions 
SET total_pnl = total_pnl * 100 
WHERE total_pnl IS NOT NULL;

-- orders (update market_cap_before and market_cap_after together to satisfy orders_market_cap_after_check)
UPDATE orders 
SET 
  price_per_share = price_per_share * 100,
  total_amount = total_amount * 100,
  market_cap_before = market_cap_before * 100,
  market_cap_after = market_cap_after * 100
WHERE (price_per_share IS NOT NULL AND total_amount IS NOT NULL)
   OR market_cap_before IS NOT NULL
   OR market_cap_after IS NOT NULL;

-- teams
UPDATE teams 
SET market_cap = market_cap * 100 
WHERE market_cap IS NOT NULL;

UPDATE teams 
SET initial_market_cap = initial_market_cap * 100 
WHERE initial_market_cap IS NOT NULL;

UPDATE teams 
SET launch_price = launch_price * 100 
WHERE launch_price IS NOT NULL;

-- profiles (wallet)
UPDATE profiles 
SET wallet_balance = wallet_balance * 100 
WHERE wallet_balance IS NOT NULL AND wallet_balance > 0;

-- wallet_transactions
UPDATE wallet_transactions 
SET amount_cents = amount_cents * 100 
WHERE amount_cents IS NOT NULL;

-- total_ledger (NULL * 100 remains NULL in PostgreSQL)
UPDATE total_ledger 
SET 
  market_cap_before = market_cap_before * 100,
  market_cap_after = market_cap_after * 100,
  share_price_before = share_price_before * 100,
  share_price_after = share_price_after * 100,
  amount_transferred = amount_transferred * 100,
  price_impact = price_impact * 100;

-- transfers_ledger
UPDATE transfers_ledger 
SET transfer_amount = transfer_amount * 100 
WHERE transfer_amount IS NOT NULL;

-- fixtures
UPDATE fixtures 
SET snapshot_home_cap = snapshot_home_cap * 100 
WHERE snapshot_home_cap IS NOT NULL;

UPDATE fixtures 
SET snapshot_away_cap = snapshot_away_cap * 100 
WHERE snapshot_away_cap IS NOT NULL;

COMMIT;
