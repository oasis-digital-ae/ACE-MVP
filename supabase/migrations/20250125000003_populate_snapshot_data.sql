-- Populate snapshot data for existing fixtures that were synced from API
-- This backfills snapshot_home_cap and snapshot_away_cap for fixtures that are missing this data

UPDATE fixtures 
SET 
  snapshot_home_cap = (
    SELECT market_cap 
    FROM teams 
    WHERE teams.id = fixtures.home_team_id
  ),
  snapshot_away_cap = (
    SELECT market_cap 
    FROM teams 
    WHERE teams.id = fixtures.away_team_id
  )
WHERE 
  snapshot_home_cap IS NULL 
  OR snapshot_away_cap IS NULL
  OR snapshot_home_cap = 0
  OR snapshot_away_cap = 0;
