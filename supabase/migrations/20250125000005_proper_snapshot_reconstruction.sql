-- Properly reconstruct snapshot data by processing fixtures in chronological order
-- This simulates the market cap progression as matches were played

-- Step 1: Reset all snapshot data to initial values
UPDATE fixtures 
SET 
  snapshot_home_cap = 100.00,
  snapshot_away_cap = 100.00
WHERE 
  snapshot_home_cap IS NULL 
  OR snapshot_away_cap IS NULL
  OR snapshot_home_cap = 0
  OR snapshot_away_cap = 0;

-- Step 2: Create a function to process fixtures chronologically
CREATE OR REPLACE FUNCTION reconstruct_market_cap_snapshots()
RETURNS VOID AS $$
DECLARE
  fixture_record RECORD;
  current_market_caps JSONB := '{}';
  team_id INTEGER;
  current_cap NUMERIC;
  transfer_amount NUMERIC;
  winner_id INTEGER;
  loser_id INTEGER;
BEGIN
  -- Initialize all teams at $100
  FOR team_id IN SELECT DISTINCT home_team_id FROM fixtures UNION SELECT DISTINCT away_team_id FROM fixtures LOOP
    current_market_caps := current_market_caps || jsonb_build_object(team_id::text, 100.00);
  END LOOP;
  
  -- Process each fixture in chronological order
  FOR fixture_record IN 
    SELECT id, home_team_id, away_team_id, result, kickoff_at
    FROM fixtures 
    WHERE status = 'applied' AND result != 'pending'
    ORDER BY kickoff_at ASC
  LOOP
    -- Get current market caps for both teams
    current_cap := (current_market_caps->>fixture_record.home_team_id::text)::numeric;
    current_market_caps := current_market_caps || jsonb_build_object(fixture_record.home_team_id::text, current_cap);
    
    current_cap := (current_market_caps->>fixture_record.away_team_id::text)::numeric;
    current_market_caps := current_market_caps || jsonb_build_object(fixture_record.away_team_id::text, current_cap);
    
    -- Update snapshot data for this fixture
    UPDATE fixtures 
    SET 
      snapshot_home_cap = (current_market_caps->>fixture_record.home_team_id::text)::numeric,
      snapshot_away_cap = (current_market_caps->>fixture_record.away_team_id::text)::numeric
    WHERE id = fixture_record.id;
    
    -- Apply market cap transfer based on result
    IF fixture_record.result = 'home_win' THEN
      winner_id := fixture_record.home_team_id;
      loser_id := fixture_record.away_team_id;
    ELSIF fixture_record.result = 'away_win' THEN
      winner_id := fixture_record.away_team_id;
      loser_id := fixture_record.home_team_id;
    ELSE
      -- Draw - no transfer
      CONTINUE;
    END IF;
    
    -- Calculate transfer amount (10% of loser's current market cap)
    transfer_amount := (current_market_caps->>loser_id::text)::numeric * 0.10;
    
    -- Update market caps for next fixture
    current_market_caps := current_market_caps || jsonb_build_object(
      winner_id::text, 
      (current_market_caps->>winner_id::text)::numeric + transfer_amount
    );
    current_market_caps := current_market_caps || jsonb_build_object(
      loser_id::text, 
      GREATEST((current_market_caps->>loser_id::text)::numeric - transfer_amount, 10.00)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Execute the reconstruction
SELECT reconstruct_market_cap_snapshots();

-- Step 4: Clean up the function
DROP FUNCTION reconstruct_market_cap_snapshots();
