-- Simulate Completed Matches
-- Process all completed matches to apply market cap transfers based on actual results
-- This simulates what would have happened if the fixed shares model was active from the start

DO $$
DECLARE
  v_fixture RECORD;
  v_processed_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  -- Process all completed fixtures (including already applied ones, since we're resetting)
  -- Order by kickoff_at to process chronologically
  FOR v_fixture IN 
    SELECT f.id, f.result, f.status, f.home_team_id, f.away_team_id,
           f.snapshot_home_cap, f.snapshot_away_cap, f.home_score, f.away_score
    FROM fixtures f
    WHERE f.status IN ('applied', 'FINISHED', 'finished')
      AND f.result IN ('home_win', 'away_win', 'draw')
      AND f.kickoff_at <= NOW() -- Only process matches up to current time
    ORDER BY f.kickoff_at ASC
  LOOP
    BEGIN
      -- Call the match result processing function
      -- This will apply market cap transfers based on the match result
      PERFORM process_match_result_atomic(v_fixture.id);
      
      v_processed_count := v_processed_count + 1;
      
      -- Log progress every 10 matches
      IF v_processed_count % 10 = 0 THEN
        RAISE NOTICE 'Processed % matches...', v_processed_count;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error processing fixture %: %', v_fixture.id, SQLERRM;
        -- Continue with next fixture
    END;
  END LOOP;
  
  RAISE NOTICE 'Match simulation complete: % processed, % errors', v_processed_count, v_error_count;
END $$;

-- Note: This calls process_match_result_atomic function which handles market cap transfers
-- The function uses snapshot market caps from fixtures to calculate transfers
-- Market cap changes will update share prices (market_cap / total_shares = market_cap / 1000)

