-- Simplify transfers_ledger to only handle match transfers
-- Remove user transaction columns and constraints

-- First, drop all policies that depend on the columns we're about to remove
DROP POLICY IF EXISTS "Users can view own transfers" ON transfers_ledger;
DROP POLICY IF EXISTS "Service role can manage all transfers" ON transfers_ledger;
DROP POLICY IF EXISTS "Anyone can insert transfers" ON transfers_ledger;
DROP POLICY IF EXISTS "Anyone can insert match transfers" ON transfers_ledger;

-- Remove user transaction columns that are not needed for match transfers      
ALTER TABLE transfers_ledger
DROP COLUMN IF EXISTS user_id,
DROP COLUMN IF EXISTS transaction_type,
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS price_per_share,
DROP COLUMN IF EXISTS total_amount,
DROP COLUMN IF EXISTS order_id,
DROP COLUMN IF EXISTS team_id;

-- Remove the transfer_type column since we only handle match transfers now
ALTER TABLE transfers_ledger 
DROP COLUMN IF EXISTS transfer_type;

-- Make the match transfer columns NOT NULL since they're all required
ALTER TABLE transfers_ledger 
ALTER COLUMN fixture_id SET NOT NULL,
ALTER COLUMN winner_team_id SET NOT NULL,
ALTER COLUMN loser_team_id SET NOT NULL,
ALTER COLUMN transfer_amount SET NOT NULL;

-- Add is_latest column if it doesn't exist (for tracking latest transfers)
ALTER TABLE transfers_ledger 
ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true;

-- Remove the complex check constraint since we only have one type now
ALTER TABLE transfers_ledger 
DROP CONSTRAINT IF EXISTS check_user_transaction_fields;

-- Recreate simple policies
CREATE POLICY "Anyone can view match transfers" ON transfers_ledger FOR SELECT USING (true);
CREATE POLICY "Service role can manage all transfers" ON transfers_ledger FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can insert match transfers" ON transfers_ledger FOR INSERT WITH CHECK (true);

-- Update comments
COMMENT ON TABLE transfers_ledger IS 'Records market cap transfers between teams based on match results only';
COMMENT ON COLUMN transfers_ledger.fixture_id IS 'Reference to the fixture that caused this transfer';
COMMENT ON COLUMN transfers_ledger.winner_team_id IS 'Team that won the match and gained market cap';
COMMENT ON COLUMN transfers_ledger.loser_team_id IS 'Team that lost the match and lost market cap';
COMMENT ON COLUMN transfers_ledger.transfer_amount IS 'Amount of market cap transferred from loser to winner';
COMMENT ON COLUMN transfers_ledger.applied_at IS 'When this transfer was applied to the market';
COMMENT ON COLUMN transfers_ledger.is_latest IS 'Whether this is the latest transfer record (for historical tracking)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'transfers_ledger simplified to only handle match transfers!';
    RAISE NOTICE 'Removed user transaction columns and constraints';
    RAISE NOTICE 'Table now only tracks match result transfers';
END $$;
