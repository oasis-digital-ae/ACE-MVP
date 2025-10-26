-- Add INSERT trigger for fixtures to handle API-synced fixtures with results
-- This trigger processes market cap transfers when fixtures are inserted with final results

CREATE OR REPLACE FUNCTION process_fixture_insert_for_market_cap()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the new fixture already has a result (i.e., not 'pending')
  -- This handles API-synced fixtures that are inserted with final results
  IF NEW.result IS NOT NULL AND NEW.result != 'pending' THEN
    PERFORM process_match_result_atomic(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS fixture_insert_market_cap_trigger ON fixtures;
CREATE TRIGGER fixture_insert_market_cap_trigger
AFTER INSERT ON fixtures
FOR EACH ROW
EXECUTE FUNCTION process_fixture_insert_for_market_cap();
