-- Simple snapshot reconstruction for existing fixtures
-- Reset all snapshots to initial values and let the proper reconstruction handle it

UPDATE fixtures 
SET 
  snapshot_home_cap = 100.00,
  snapshot_away_cap = 100.00
WHERE 
  snapshot_home_cap IS NULL 
  OR snapshot_away_cap IS NULL
  OR snapshot_home_cap = 0
  OR snapshot_away_cap = 0;