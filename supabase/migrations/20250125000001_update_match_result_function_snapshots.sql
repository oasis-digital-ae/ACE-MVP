-- Update process_match_result_atomic to use snapshot values
-- This ensures market cap transfers are based on values at kickoff time

CREATE OR REPLACE FUNCTION process_match_result_atomic(p_fixture_id INTEGER)
RETURNS JSON AS $$
DECLARE
  v_fixture RECORD;
  v_transfer_amount NUMERIC;
  v_winner_team_id INTEGER;
  v_loser_team_id INTEGER;
  v_home_snapshot_cap NUMERIC;
  v_away_snapshot_cap NUMERIC;
BEGIN
  -- Get fixture with snapshot market cap data
  SELECT f.*, f.snapshot_home_cap, f.snapshot_away_cap
  INTO v_fixture
  FROM fixtures f
  WHERE f.id = p_fixture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixture not found: %', p_fixture_id;
  END IF;
  
  IF v_fixture.result = 'pending' THEN
    RAISE EXCEPTION 'Cannot process pending fixture';
  END IF;

  -- Use snapshot values for transfer calculation
  v_home_snapshot_cap := v_fixture.snapshot_home_cap;
  v_away_snapshot_cap := v_fixture.snapshot_away_cap;
  
  -- Ensure snapshots exist
  IF v_home_snapshot_cap IS NULL OR v_away_snapshot_cap IS NULL THEN
      RAISE EXCEPTION 'Snapshot market caps missing for fixture %', p_fixture_id;
  END IF;

  -- Calculate transfer amount (10% of loser's snapshot market cap)
  IF v_fixture.result = 'home_win' THEN
    v_winner_team_id := v_fixture.home_team_id;
    v_loser_team_id := v_fixture.away_team_id;
    v_transfer_amount := v_away_snapshot_cap * 0.10;
  ELSIF v_fixture.result = 'away_win' THEN
    v_winner_team_id := v_fixture.away_team_id;
    v_loser_team_id := v_fixture.home_team_id;
    v_transfer_amount := v_home_snapshot_cap * 0.10;
  ELSE
    -- Draw - no transfer
    RETURN json_build_object('success', true, 'transfer_amount', 0, 'message', 'Draw - no market cap transfer');
  END IF;
  
  -- Update teams atomically
  UPDATE teams SET
    market_cap = market_cap + v_transfer_amount,
    updated_at = NOW()
  WHERE id = v_winner_team_id;
  
  UPDATE teams SET
    market_cap = GREATEST(market_cap - v_transfer_amount, 10), -- Minimum $10 market cap
    updated_at = NOW()
  WHERE id = v_loser_team_id;
  
  -- Record transfer in ledger
  INSERT INTO transfers_ledger (
    fixture_id, winner_team_id, loser_team_id, transfer_amount
  ) VALUES (
    p_fixture_id, v_winner_team_id, v_loser_team_id, v_transfer_amount
  );
  
  RETURN json_build_object(
    'success', true,
    'transfer_amount', v_transfer_amount,
    'winner_team_id', v_winner_team_id,
    'loser_team_id', v_loser_team_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Match result processing failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
