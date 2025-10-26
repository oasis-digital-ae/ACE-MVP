-- Backfill total_ledger entries for completed matches
-- This script processes all completed fixtures that haven't been logged to total_ledger

DO $$
DECLARE
  v_fixture RECORD;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of total_ledger for completed matches...';
  
  -- Get all completed fixtures that haven't been processed yet
  FOR v_fixture IN 
    SELECT f.*, 
           ft1.name as home_team_name, 
           ft2.name as away_team_name
    FROM fixtures f
    JOIN teams ft1 ON f.home_team_id = ft1.id
    JOIN teams ft2 ON f.away_team_id = ft2.id
    WHERE f.status = 'applied'
      AND f.result != 'pending'
      -- Check if already processed (exists in total_ledger)
      AND NOT EXISTS (
        SELECT 1 FROM total_ledger 
        WHERE trigger_event_type = 'fixture' 
          AND trigger_event_id = f.id
      )
    ORDER BY f.kickoff_at ASC
  LOOP
    BEGIN
      -- Skip if snapshots are missing
      IF v_fixture.snapshot_home_cap IS NULL OR v_fixture.snapshot_away_cap IS NULL THEN
        RAISE NOTICE 'Skipping fixture % (missing snapshots)', v_fixture.id;
        CONTINUE;
      END IF;
      
      -- Call the updated function
      PERFORM process_match_result_atomic(v_fixture.id);
      
      v_processed := v_processed + 1;
      
      IF v_processed % 10 = 0 THEN
        RAISE NOTICE 'Processed % fixtures...', v_processed;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error processing fixture %: %', v_fixture.id, SQLERRM;
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: % fixtures processed, % errors', v_processed, v_errors;
END $$;
