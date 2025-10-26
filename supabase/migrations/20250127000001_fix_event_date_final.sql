-- Fix event_date in total_ledger to use actual fixture kickoff dates
-- This migration fixes the fixture_result_trigger function and backfills existing data

-- Step 1: Update the fixture_result_trigger function to use kickoff_at
CREATE OR REPLACE FUNCTION fixture_result_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_percentage NUMERIC := 0.10;  -- 10% transfer
    v_transfer_amount NUMERIC;
    v_winner_team_id INTEGER;
    v_loser_team_id INTEGER;
    v_home_ledger_type TEXT;
    v_away_ledger_type TEXT;
    v_home_price_impact NUMERIC;
    v_away_price_impact NUMERIC;
    v_match_score TEXT;
    
    -- Team data
    v_home_team RECORD;
    v_away_team RECORD;
    v_home_current_cap NUMERIC;
    v_away_current_cap NUMERIC;
    v_home_shares INTEGER;
    v_away_shares INTEGER;
    v_opponent_team_id INTEGER;
    v_opponent_team_name TEXT;
BEGIN
    -- Get team info
    SELECT * INTO v_home_team FROM teams WHERE id = NEW.home_team_id;
    SELECT * INTO v_away_team FROM teams WHERE id = NEW.away_team_id;
    
    IF v_home_team IS NULL OR v_away_team IS NULL THEN
        RETURN NEW;
    END IF;
    
    v_home_current_cap := v_home_team.market_cap;
    v_away_current_cap := v_away_team.market_cap;
    v_home_shares := v_home_team.shares_outstanding;
    v_away_shares := v_away_team.shares_outstanding;
    
    -- Build match score string
    IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
        v_match_score := CONCAT(NEW.home_score, '-', NEW.away_score);
    ELSE
        v_match_score := '0-0';
    END IF;
    
    -- Determine winner/loser and transfer amounts
    CASE NEW.result
        WHEN 'home_win' THEN
            v_winner_team_id := NEW.home_team_id;
            v_loser_team_id := NEW.away_team_id;
            v_home_ledger_type := 'match_win';
            v_away_ledger_type := 'match_loss';
            v_transfer_amount := v_away_current_cap * v_transfer_percentage;
            v_home_price_impact := v_transfer_amount;
            v_away_price_impact := -v_transfer_amount;
            v_opponent_team_id := NEW.away_team_id;
            v_opponent_team_name := v_away_team.name;
        WHEN 'away_win' THEN
            v_winner_team_id := NEW.away_team_id;
            v_loser_team_id := NEW.home_team_id;
            v_home_ledger_type := 'match_loss';
            v_away_ledger_type := 'match_win';
            v_transfer_amount := v_home_current_cap * v_transfer_percentage;
            v_home_price_impact := -v_transfer_amount;
            v_away_price_impact := v_transfer_amount;
            v_opponent_team_id := NEW.home_team_id;
            v_opponent_team_name := v_home_team.name;
        WHEN 'draw' THEN
            v_home_ledger_type := 'match_draw';
            v_away_ledger_type := 'match_draw';
            v_transfer_amount := 0;
            v_home_price_impact := 0;
            v_away_price_impact := 0;
            v_opponent_team_id := NEW.away_team_id;
            v_opponent_team_name := v_away_team.name;
    END CASE;
    
    -- Insert into total_ledger for home team
    INSERT INTO total_ledger (
        team_id, ledger_type, event_date, event_description,
        trigger_event_id, trigger_event_type,
        opponent_team_id, opponent_team_name,
        match_result, match_score, is_home_match,
        amount_transferred, price_impact,
        market_cap_before, market_cap_after,
        shares_outstanding_before, shares_outstanding_after,
        share_price_before, share_price_after,
        created_by
    ) VALUES (
        NEW.home_team_id, v_home_ledger_type,
        NEW.kickoff_at,  -- ✅ FIXED: Use kickoff_at instead of updated_at
        CONCAT('Match vs ', v_away_team.name),
        NEW.id, 'fixture',
        NEW.away_team_id, v_away_team.name,
        CASE 
            WHEN v_home_ledger_type = 'match_win' THEN 'win'
            WHEN v_home_ledger_type = 'match_loss' THEN 'loss'
            ELSE 'draw'
        END,
        v_match_score, true,
        v_transfer_amount, v_home_price_impact,
        v_home_current_cap, v_home_current_cap + v_home_price_impact,
        v_home_shares, v_home_shares,
        CASE WHEN v_home_shares > 0 THEN v_home_current_cap / v_home_shares ELSE 0 END,
        CASE WHEN v_home_shares > 0 THEN (v_home_current_cap + v_home_price_impact) / v_home_shares ELSE 0 END,
        'system'
    );
    
    -- Insert into total_ledger for away team
    INSERT INTO total_ledger (
        team_id, ledger_type, event_date, event_description,
        trigger_event_id, trigger_event_type,
        opponent_team_id, opponent_team_name,
        match_result, match_score, is_home_match,
        amount_transferred, price_impact,
        market_cap_before, market_cap_after,
        shares_outstanding_before, shares_outstanding_after,
        share_price_before, share_price_after,
        created_by
    ) VALUES (
        NEW.away_team_id, v_away_ledger_type,
        NEW.kickoff_at,  -- ✅ FIXED: Use kickoff_at instead of updated_at
        CONCAT('Match vs ', v_home_team.name),
        NEW.id, 'fixture',
        NEW.home_team_id, v_home_team.name,
        CASE 
            WHEN v_away_ledger_type = 'match_win' THEN 'win'
            WHEN v_away_ledger_type = 'match_loss' THEN 'loss'
            ELSE 'draw'
        END,
        v_match_score, false,
        v_transfer_amount, v_away_price_impact,
        v_away_current_cap, v_away_current_cap + v_away_price_impact,
        v_away_shares, v_away_shares,
        CASE WHEN v_away_shares > 0 THEN v_away_current_cap / v_away_shares ELSE 0 END,
        CASE WHEN v_away_shares > 0 THEN (v_away_current_cap + v_away_price_impact) / v_away_shares ELSE 0 END,
        'system'
    );
    
    -- Update team market caps
    UPDATE teams SET market_cap = v_home_current_cap + v_home_price_impact, updated_at = NOW() WHERE id = NEW.home_team_id;
    UPDATE teams SET market_cap = v_away_current_cap + v_away_price_impact, updated_at = NOW() WHERE id = NEW.away_team_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Backfill existing event_date values from fixtures
UPDATE total_ledger tl
SET event_date = f.kickoff_at
FROM fixtures f
WHERE tl.trigger_event_type = 'fixture'
  AND tl.trigger_event_id = f.id
  AND tl.event_date != f.kickoff_at;

