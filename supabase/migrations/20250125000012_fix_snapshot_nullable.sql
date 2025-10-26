-- Fix snapshot fields to be nullable in fixtures table
-- Snapshots are only captured 30 minutes before kickoff, not for all fixtures

-- Make snapshot fields nullable
ALTER TABLE fixtures 
ALTER COLUMN snapshot_home_cap DROP NOT NULL,
ALTER COLUMN snapshot_away_cap DROP NOT NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Snapshot fields made nullable successfully!';
    RAISE NOTICE 'Fixtures can now be synced without snapshot data';
    RAISE NOTICE 'Snapshots will be captured 30 minutes before kickoff';
END $$;