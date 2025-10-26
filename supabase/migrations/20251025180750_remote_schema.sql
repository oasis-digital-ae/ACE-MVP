

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_position_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_existing_position RECORD;
BEGIN
    -- Get existing latest position
    SELECT quantity, total_invested, id
    INTO v_existing_position
    FROM positions
    WHERE user_id = p_user_id 
      AND team_id = p_team_id 
      AND is_latest = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Start transaction (implicit in function)
    BEGIN
        -- Step 1: Set all existing latest positions to false
        UPDATE positions 
        SET is_latest = false,
            updated_at = NOW()
        WHERE user_id = p_user_id 
          AND team_id = p_team_id 
          AND is_latest = true;

        -- Step 2: Insert new position with is_latest = true
        INSERT INTO positions (
            user_id,
            team_id,
            quantity,
            total_invested,
            is_latest,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_team_id,
            p_quantity,
            p_total_invested,
            true,
            NOW(),
            NOW()
        );

        -- Return success result
        v_result := json_build_object(
            'success', true,
            'message', 'Position added successfully',
            'user_id', p_user_id,
            'team_id', p_team_id,
            'quantity', p_quantity,
            'total_invested', p_total_invested,
            'previous_position', CASE 
                WHEN v_existing_position.id IS NOT NULL THEN
                    json_build_object(
                        'id', v_existing_position.id,
                        'quantity', v_existing_position.quantity,
                        'total_invested', v_existing_position.total_invested
                    )
                ELSE NULL
            END
        );

        RETURN v_result;

    EXCEPTION
        WHEN OTHERS THEN
            -- Return error result
            v_result := json_build_object(
                'success', false,
                'error', SQLERRM,
                'error_code', SQLSTATE
            );
            RETURN v_result;
    END;
END;
$$;


ALTER FUNCTION "public"."add_position_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_position_with_history"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_existing_position RECORD;
    v_new_position_id INTEGER;
BEGIN
    -- Get existing latest position
    SELECT id, quantity, total_invested
    INTO v_existing_position
    FROM positions
    WHERE user_id = p_user_id 
      AND team_id = p_team_id 
      AND is_latest = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Start transaction (implicit in function)
    BEGIN
        -- Step 1: Set all existing latest positions to false
        -- This works because the constraint is deferred until end of transaction
        UPDATE positions 
        SET is_latest = false,
            updated_at = NOW()
        WHERE user_id = p_user_id 
          AND team_id = p_team_id 
          AND is_latest = true;

        -- Step 2: Insert new position with is_latest = true
        -- This also works because constraint is deferred
        INSERT INTO positions (
            user_id,
            team_id,
            quantity,
            total_invested,
            is_latest,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_team_id,
            p_quantity,
            p_total_invested,
            true,
            NOW(),
            NOW()
        ) RETURNING id INTO v_new_position_id;

        -- Return success result
        v_result := json_build_object(
            'success', true,
            'message', 'Position added successfully with history',
            'user_id', p_user_id,
            'team_id', p_team_id,
            'quantity', p_quantity,
            'total_invested', p_total_invested,
            'new_position_id', v_new_position_id,
            'previous_position', CASE 
                WHEN v_existing_position.id IS NOT NULL THEN
                    json_build_object(
                        'id', v_existing_position.id,
                        'quantity', v_existing_position.quantity,
                        'total_invested', v_existing_position.total_invested
                    )
                ELSE NULL
            END
        );

        RETURN v_result;

    EXCEPTION
        WHEN OTHERS THEN
            -- Return error result
            v_result := json_build_object(
                'success', false,
                'error', SQLERRM,
                'error_code', SQLSTATE
            );
            RETURN v_result;
    END;
END;
$$;


ALTER FUNCTION "public"."add_position_with_history"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_season_data"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Clear all data except teams and profiles
    DELETE FROM audit_log;
    DELETE FROM transfers_ledger;
    DELETE FROM positions;
    DELETE FROM orders;
    DELETE FROM fixtures;
    
    -- Reset teams to default values
    UPDATE teams SET 
        market_cap = 100.00,
        total_shares = 1000000,
        available_shares = 1000000,
        is_tradeable = true;
    
    RAISE NOTICE 'Season data cleared successfully';
END;
$$;


ALTER FUNCTION "public"."clear_season_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ledger_entry"("p_team_id" integer, "p_ledger_type" "text", "p_amount_transferred" numeric DEFAULT 0, "p_price_impact" numeric DEFAULT 0, "p_shares_traded" integer DEFAULT 0, "p_trigger_event_id" integer DEFAULT NULL::integer, "p_trigger_event_type" "text" DEFAULT NULL::"text", "p_opponent_team_id" integer DEFAULT NULL::integer, "p_opponent_team_name" "text" DEFAULT NULL::"text", "p_match_result" "text" DEFAULT NULL::"text", "p_match_score" "text" DEFAULT NULL::"text", "p_is_home_match" boolean DEFAULT NULL::boolean, "p_event_description" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_ledger_id INTEGER;
    v_current_state RECORD;
    v_opponent_name TEXT;
BEGIN
    -- Get current team state
    SELECT 
        market_cap,
        shares_outstanding,
        CASE 
            WHEN shares_outstanding > 0 THEN market_cap / shares_outstanding
            ELSE 20.00
        END as current_share_price
    INTO v_current_state
    FROM teams
    WHERE id = p_team_id;
    
    -- Get opponent name if not provided
    IF p_opponent_team_id IS NOT NULL AND p_opponent_team_name IS NULL THEN
        SELECT name INTO v_opponent_name FROM teams WHERE id = p_opponent_team_id;
    ELSE
        v_opponent_name := p_opponent_team_name;
    END IF;
    
    -- Create ledger entry
    INSERT INTO total_ledger (
        team_id,
        ledger_type,
        event_description,
        trigger_event_id,
        trigger_event_type,
        opponent_team_id,
        opponent_team_name,
        match_result,
        match_score,
        is_home_match,
        amount_transferred,
        price_impact,
        market_cap_before,
        market_cap_after,
        shares_outstanding_before,
        shares_outstanding_after,
        shares_traded,
        share_price_before,
        share_price_after,
        notes
    ) VALUES (
        p_team_id,
        p_ledger_type,
        COALESCE(p_event_description, p_ledger_type),
        p_trigger_event_id,
        p_trigger_event_type,
        p_opponent_team_id,
        v_opponent_name,
        p_match_result,
        p_match_score,
        p_is_home_match,
        p_amount_transferred,
        p_price_impact,
        v_current_state.market_cap,
        v_current_state.market_cap + p_price_impact,
        v_current_state.shares_outstanding,
        v_current_state.shares_outstanding + p_shares_traded,
        p_shares_traded,
        v_current_state.current_share_price,
        CASE 
            WHEN (v_current_state.shares_outstanding + p_shares_traded) > 0 
            THEN (v_current_state.market_cap + p_price_impact) / (v_current_state.shares_outstanding + p_shares_traded)
            ELSE v_current_state.current_share_price
        END,
        p_notes
    ) RETURNING id INTO v_ledger_id;
    
    RETURN v_ledger_id;
END;
$$;


ALTER FUNCTION "public"."create_ledger_entry"("p_team_id" integer, "p_ledger_type" "text", "p_amount_transferred" numeric, "p_price_impact" numeric, "p_shares_traded" integer, "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_opponent_team_id" integer, "p_opponent_team_name" "text", "p_match_result" "text", "p_match_score" "text", "p_is_home_match" boolean, "p_event_description" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer DEFAULT NULL::integer, "p_trigger_event_type" "text" DEFAULT NULL::"text", "p_match_result" "text" DEFAULT NULL::"text", "p_price_impact" numeric DEFAULT 0, "p_shares_traded" integer DEFAULT 0, "p_trade_amount" numeric DEFAULT 0) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_snapshot_id INTEGER;
    v_current_state RECORD;
BEGIN
    -- Get current team state (SIMPLIFIED)
    SELECT 
        market_cap,
        shares_outstanding,
        CASE 
            WHEN shares_outstanding > 0 
            THEN market_cap / shares_outstanding 
            ELSE 20.00 
        END as current_share_price
    INTO v_current_state
    FROM teams 
    WHERE id = p_team_id;
    
    -- Insert snapshot (SIMPLIFIED)
    INSERT INTO team_state_snapshots (
        team_id,
        snapshot_type,
        trigger_event_id,
        trigger_event_type,
        market_cap,
        shares_outstanding,
        current_share_price,
        match_result,
        price_impact,
        shares_traded,
        trade_amount
    ) VALUES (
        p_team_id,
        p_snapshot_type,
        p_trigger_event_id,
        p_trigger_event_type,
        v_current_state.market_cap,
        v_current_state.shares_outstanding,
        v_current_state.current_share_price,
        p_match_result,
        p_price_impact,
        p_shares_traded,
        p_trade_amount
    ) RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$;


ALTER FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer DEFAULT NULL::integer, "p_trigger_event_type" "text" DEFAULT NULL::"text", "p_match_result" "text" DEFAULT NULL::"text", "p_price_impact" numeric DEFAULT 0, "p_shares_traded" integer DEFAULT 0, "p_trade_amount" numeric DEFAULT 0, "p_effective_at" timestamp with time zone DEFAULT "now"()) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_snapshot_id INTEGER;
    v_current_state RECORD;
BEGIN
    -- Get current team state
    SELECT
        market_cap,
        shares_outstanding,
        CASE
            WHEN shares_outstanding > 0
            THEN market_cap / shares_outstanding
            ELSE 20.00
        END as current_share_price
    INTO v_current_state
    FROM teams
    WHERE id = p_team_id;

    -- Insert snapshot
    INSERT INTO team_state_snapshots (
        team_id,
        snapshot_type,
        trigger_event_id,
        trigger_event_type,
        market_cap,
        shares_outstanding,
        current_share_price,
        match_result,
        price_impact,
        shares_traded,
        trade_amount,
        effective_at
    ) VALUES (
        p_team_id,
        p_snapshot_type,
        p_trigger_event_id,
        p_trigger_event_type,
        v_current_state.market_cap,
        v_current_state.shares_outstanding,
        v_current_state.current_share_price,
        p_match_result,
        p_price_impact,
        p_shares_traded,
        p_trade_amount,
        p_effective_at
    ) RETURNING id INTO v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$;


ALTER FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric, "p_effective_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fixture_result_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_home_team RECORD;
    v_away_team RECORD;
    v_home_ledger_type TEXT;
    v_away_ledger_type TEXT;
    v_home_price_impact DECIMAL(15,2) := 0;
    v_away_price_impact DECIMAL(15,2) := 0;
    v_transfer_percentage DECIMAL(5,4) := 0.10; -- 10% transfer rate
    v_transfer_amount DECIMAL(15,2) := 0;
    v_home_current_cap DECIMAL(15,2);
    v_away_current_cap DECIMAL(15,2);
    v_home_shares INTEGER;
    v_away_shares INTEGER;
BEGIN
    -- Only proceed if result changed from 'pending' to something else
    IF OLD.result = 'pending' AND NEW.result != 'pending' THEN
        
        -- Get current team states (market cap and shares)
        SELECT market_cap, shares_outstanding INTO v_home_current_cap, v_home_shares 
        FROM teams WHERE id = NEW.home_team_id;
        
        SELECT market_cap, shares_outstanding INTO v_away_current_cap, v_away_shares 
        FROM teams WHERE id = NEW.away_team_id;
        
        -- Get team details for names
        SELECT * INTO v_home_team FROM teams WHERE id = NEW.home_team_id;
        SELECT * INTO v_away_team FROM teams WHERE id = NEW.away_team_id;
        
        -- Calculate transfer amount based on losing team's market cap
        CASE NEW.result
            WHEN 'home_win' THEN
                v_home_ledger_type := 'match_win';
                v_away_ledger_type := 'match_loss';
                v_transfer_amount := v_away_current_cap * v_transfer_percentage; -- 10% of away team (loser)
                v_home_price_impact := v_transfer_amount;
                v_away_price_impact := -v_transfer_amount;
            WHEN 'away_win' THEN
                v_home_ledger_type := 'match_loss';
                v_away_ledger_type := 'match_win';
                v_transfer_amount := v_home_current_cap * v_transfer_percentage; -- 10% of home team (loser)
                v_home_price_impact := -v_transfer_amount;
                v_away_price_impact := v_transfer_amount;
            WHEN 'draw' THEN
                v_home_ledger_type := 'match_draw';
                v_away_ledger_type := 'match_draw';
                v_transfer_amount := 0;
                v_home_price_impact := 0;
                v_away_price_impact := 0;
        END CASE;
        
        -- Create ledger entry for home team with correct market cap values
        INSERT INTO total_ledger (
            team_id,
            ledger_type,
            event_date,
            event_description,
            trigger_event_id,
            trigger_event_type,
            opponent_team_id,
            opponent_team_name,
            match_result,
            match_score,
            is_home_match,
            amount_transferred,
            price_impact,
            market_cap_before,
            market_cap_after,
            shares_outstanding_before,
            shares_outstanding_after,
            shares_traded,
            share_price_before,
            share_price_after,
            created_at,
            created_by
        ) VALUES (
            NEW.home_team_id,
            v_home_ledger_type,
            NEW.updated_at,
            CONCAT('Match vs ', v_away_team.name),
            NEW.id,
            'fixture',
            NEW.away_team_id,
            v_away_team.name,
            CASE 
                WHEN v_home_ledger_type = 'match_win' THEN 'win'
                WHEN v_home_ledger_type = 'match_loss' THEN 'loss'
                ELSE 'draw'
            END,
            CASE 
                WHEN NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL 
                THEN CONCAT(NEW.home_score, '-', NEW.away_score)
                ELSE NULL
            END,
            true,
            v_transfer_amount,
            v_home_price_impact,
            v_home_current_cap,  -- Correct market cap before
            v_home_current_cap + v_home_price_impact,  -- Correct market cap after
            v_home_shares,
            v_home_shares,
            0,
            CASE WHEN v_home_shares > 0 THEN v_home_current_cap / v_home_shares ELSE 0 END,
            CASE WHEN v_home_shares > 0 THEN (v_home_current_cap + v_home_price_impact) / v_home_shares ELSE 0 END,
            NOW(),
            'system'
        );
        
        -- Create ledger entry for away team with correct market cap values
        INSERT INTO total_ledger (
            team_id,
            ledger_type,
            event_date,
            event_description,
            trigger_event_id,
            trigger_event_type,
            opponent_team_id,
            opponent_team_name,
            match_result,
            match_score,
            is_home_match,
            amount_transferred,
            price_impact,
            market_cap_before,
            market_cap_after,
            shares_outstanding_before,
            shares_outstanding_after,
            shares_traded,
            share_price_before,
            share_price_after,
            created_at,
            created_by
        ) VALUES (
            NEW.away_team_id,
            v_away_ledger_type,
            NEW.updated_at,
            CONCAT('Match @ ', v_home_team.name),
            NEW.id,
            'fixture',
            NEW.home_team_id,
            v_home_team.name,
            CASE 
                WHEN v_away_ledger_type = 'match_win' THEN 'win'
                WHEN v_away_ledger_type = 'match_loss' THEN 'loss'
                ELSE 'draw'
            END,
            CASE 
                WHEN NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL 
                THEN CONCAT(NEW.home_score, '-', NEW.away_score)
                ELSE NULL
            END,
            false,
            v_transfer_amount,
            v_away_price_impact,
            v_away_current_cap,  -- Correct market cap before
            v_away_current_cap + v_away_price_impact,  -- Correct market cap after
            v_away_shares,
            v_away_shares,
            0,
            CASE WHEN v_away_shares > 0 THEN v_away_current_cap / v_away_shares ELSE 0 END,
            CASE WHEN v_away_shares > 0 THEN (v_away_current_cap + v_away_price_impact) / v_away_shares ELSE 0 END,
            NOW(),
            'system'
        );
        
        -- Update team market caps
        UPDATE teams 
        SET market_cap = market_cap + v_home_price_impact
        WHERE id = NEW.home_team_id;
        
        UPDATE teams 
        SET market_cap = market_cap + v_away_price_impact
        WHERE id = NEW.away_team_id;
        
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fixture_result_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_complete_timeline"("p_team_id" integer) RETURNS TABLE("event_order" integer, "event_type" "text", "event_date" timestamp with time zone, "description" "text", "market_cap_before" numeric, "market_cap_after" numeric, "shares_outstanding" integer, "share_price_before" numeric, "share_price_after" numeric, "price_impact" numeric, "shares_traded" integer, "trade_amount" numeric, "opponent_team_id" integer, "opponent_name" "text", "match_result" "text", "score" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Return timeline from total_ledger
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY tl.event_date)::INTEGER as event_order,
        CASE 
            WHEN tl.ledger_type = 'initial_state' THEN 'initial'
            WHEN tl.ledger_type LIKE 'match_%' THEN 'match'
            WHEN tl.ledger_type LIKE 'share_%' THEN 'purchase'
            ELSE 'other'
        END as event_type,
        tl.event_date,
        CASE 
            WHEN tl.ledger_type LIKE 'match_%' AND tl.opponent_team_name IS NOT NULL THEN
                CASE 
                    WHEN tl.is_home_match THEN 'vs ' || tl.opponent_team_name
                    ELSE '@ ' || tl.opponent_team_name
                END
            ELSE tl.event_description
        END as description,
        tl.market_cap_before,
        tl.market_cap_after,
        tl.shares_outstanding_after as shares_outstanding,
        tl.share_price_before,
        tl.share_price_after,
        tl.price_impact,
        tl.shares_traded,
        tl.amount_transferred as trade_amount,
        tl.opponent_team_id,
        tl.opponent_team_name,
        tl.match_result,
        tl.match_score as score
    FROM total_ledger tl
    WHERE tl.team_id = p_team_id
    ORDER BY tl.event_date ASC;
END;
$$;


ALTER FUNCTION "public"."get_team_complete_timeline"("p_team_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_state_at_time"("p_team_id" integer, "p_at_time" timestamp with time zone) RETURNS TABLE("market_cap" numeric, "shares_outstanding" integer, "current_share_price" numeric, "snapshot_type" "text", "effective_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.market_cap,
        s.shares_outstanding,
        s.current_share_price,
        s.snapshot_type,
        s.effective_at
    FROM team_state_snapshots s
    WHERE s.team_id = p_team_id 
        AND s.effective_at < p_at_time
    ORDER BY s.effective_at DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_team_state_at_time"("p_team_id" integer, "p_at_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_state_history"("p_team_id" integer, "p_from_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("effective_at" timestamp with time zone, "market_cap" numeric, "current_share_price" numeric, "snapshot_type" "text", "price_impact" numeric, "shares_traded" integer, "match_result" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.effective_at,
        s.market_cap,
        s.current_share_price,
        s.snapshot_type,
        s.price_impact,
        s.shares_traded,
        s.match_result
    FROM team_state_snapshots s
    WHERE s.team_id = p_team_id
        AND (p_from_date IS NULL OR s.effective_at >= p_from_date)
        AND (p_to_date IS NULL OR s.effective_at <= p_to_date)
    ORDER BY s.effective_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_team_state_history"("p_team_id" integer, "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_timeline"("p_team_id" integer) RETURNS TABLE("event_order" integer, "event_type" "text", "event_date" timestamp with time zone, "description" "text", "market_cap_before" numeric, "market_cap_after" numeric, "shares_outstanding" integer, "share_price_before" numeric, "share_price_after" numeric, "price_impact" numeric, "shares_traded" integer, "trade_amount" numeric, "opponent_team_id" integer, "opponent_name" "text", "match_result" "text", "score" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY tl.event_date)::INTEGER as event_order,
        tl.ledger_type as event_type,
        tl.event_date,
        CASE 
            WHEN tl.ledger_type LIKE 'match_%' AND tl.opponent_team_name IS NOT NULL THEN
                CASE 
                    WHEN tl.is_home_match THEN 'vs ' || tl.opponent_team_name
                    ELSE '@ ' || tl.opponent_team_name
                END
            ELSE tl.event_description
        END as description,
        tl.market_cap_before,
        tl.market_cap_after,
        tl.shares_outstanding_after as shares_outstanding,
        tl.share_price_before,
        tl.share_price_after,
        tl.price_impact,
        tl.shares_traded,
        tl.amount_transferred as trade_amount,
        tl.opponent_team_id,
        tl.opponent_team_name as opponent_name,
        tl.match_result,
        tl.match_score as score
    FROM total_ledger tl
    WHERE tl.team_id = p_team_id
    ORDER BY tl.event_date;
END;
$$;


ALTER FUNCTION "public"."get_team_timeline"("p_team_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_portfolio"("user_uuid" "uuid") RETURNS TABLE("team_id" integer, "team_name" "text", "shares" numeric, "avg_cost" numeric, "current_price" numeric, "total_value" numeric, "profit_loss" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.team_id,
    t.name as team_name,
    p.shares,
    p.avg_cost,
    CASE 
      WHEN t.shares_outstanding > 0 THEN t.market_cap / t.shares_outstanding
      ELSE 20.00
    END as current_price,
    p.shares * (CASE 
      WHEN t.shares_outstanding > 0 THEN t.market_cap / t.shares_outstanding
      ELSE 20.00
    END) as total_value,
    p.shares * ((CASE 
      WHEN t.shares_outstanding > 0 THEN t.market_cap / t.shares_outstanding
      ELSE 20.00
    END) - p.avg_cost) as profit_loss
  FROM positions p
  JOIN teams t ON p.team_id = t.id
  WHERE p.user_id = user_uuid;
END;
$$;


ALTER FUNCTION "public"."get_user_portfolio"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_buy_window_open"("p_team_id" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_upcoming_fixtures INTEGER;
  v_buy_close_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if there are upcoming fixtures for this team
  SELECT COUNT(*), MIN(buy_close_at)
  INTO v_upcoming_fixtures, v_buy_close_time
  FROM fixtures 
  WHERE (home_team_id = p_team_id OR away_team_id = p_team_id)
    AND kickoff_at > NOW()
    AND status = 'SCHEDULED';
  
  -- If no upcoming fixtures, trading is always open
  IF v_upcoming_fixtures = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Check if current time is before buy close time
  RETURN NOW() < v_buy_close_time;
END;
$$;


ALTER FUNCTION "public"."is_buy_window_open"("p_team_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_tradeable"("team_id" integer) RETURNS TABLE("tradeable" boolean, "reason" "text", "next_kickoff" timestamp with time zone, "next_buy_close" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN f.kickoff_at IS NULL THEN true
      WHEN NOW() <= f.buy_close_at THEN true
      ELSE false
    END as tradeable,
    CASE 
      WHEN f.kickoff_at IS NULL THEN 'No upcoming matches'
      WHEN NOW() <= f.buy_close_at THEN 'Trading window open'
      ELSE 'Trading closed - buy window expired'
    END as reason,
    f.kickoff_at as next_kickoff,
    f.buy_close_at as next_buy_close
  FROM (
    SELECT 
      kickoff_at,
      buy_close_at
    FROM fixtures 
    WHERE (home_team_id = team_id OR away_team_id = team_id)
      AND kickoff_at > NOW()
      AND status = 'scheduled'
    ORDER BY kickoff_at ASC
    LIMIT 1
  ) f;
END;
$$;


ALTER FUNCTION "public"."is_team_tradeable"("team_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_match_result_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log when a fixture status changes to 'applied' (match result processed)
  IF NEW.status = 'applied' AND OLD.status != 'applied' THEN
    INSERT INTO audit_log (
      user_id,
      action,
      table_name,
      record_id,
      new_values,
      created_at
    ) VALUES (
      NULL, -- System action
      'match_result_processed',
      'fixtures',
      NEW.id,
      jsonb_build_object(
        'home_team_id', NEW.home_team_id,
        'away_team_id', NEW.away_team_id,
        'result', NEW.result,
        'home_score', NEW.home_score,
        'away_score', NEW.away_score,
        'status', NEW.status,
        'kickoff_at', NEW.kickoff_at
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_match_result_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_match_result_atomic"("p_fixture_id" integer) RETURNS json
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_fixture RECORD;
  v_home_team RECORD;
  v_away_team RECORD;
  v_transfer_amount NUMERIC;
  v_winner_team_id INTEGER;
  v_loser_team_id INTEGER;
BEGIN
  -- Get fixture with team data
  SELECT f.*, ht.market_cap as home_market_cap, at.market_cap as away_market_cap
  INTO v_fixture
  FROM fixtures f
  JOIN teams ht ON f.home_team_id = ht.id
  JOIN teams at ON f.away_team_id = at.id
  WHERE f.id = p_fixture_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixture not found: %', p_fixture_id;
  END IF;
  
  IF v_fixture.result = 'pending' THEN
    RAISE EXCEPTION 'Cannot process pending fixture';
  END IF;
  
  -- Calculate transfer amount (10% of loser's market cap)
  IF v_fixture.result = 'home_win' THEN
    v_winner_team_id := v_fixture.home_team_id;
    v_loser_team_id := v_fixture.away_team_id;
    v_transfer_amount := v_fixture.away_market_cap * 0.10;
  ELSIF v_fixture.result = 'away_win' THEN
    v_winner_team_id := v_fixture.away_team_id;
    v_loser_team_id := v_fixture.home_team_id;
    v_transfer_amount := v_fixture.home_market_cap * 0.10;
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
$_$;


ALTER FUNCTION "public"."process_match_result_atomic"("p_fixture_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_share_purchase_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_shares" integer, "p_price_per_share" numeric, "p_total_amount" numeric) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_team RECORD;
  v_nav NUMERIC;
  v_order_id INTEGER;
  v_position_id INTEGER;
  v_market_cap_before NUMERIC;
  v_market_cap_after NUMERIC;
  v_shares_outstanding_before INTEGER;
  v_shares_outstanding_after INTEGER;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Get current team data with row lock to prevent race conditions
  SELECT * INTO v_team 
  FROM teams 
  WHERE id = p_team_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;
  
  -- Validate inputs
  IF p_shares <= 0 THEN
    RAISE EXCEPTION 'Invalid share quantity: %', p_shares;
  END IF;
  
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid total amount: %', p_total_amount;
  END IF;
  
  -- Calculate NAV and validate price
  v_nav := CASE 
    WHEN v_team.shares_outstanding > 0 THEN v_team.market_cap / v_team.shares_outstanding
    ELSE 20.00
  END;
  
  -- Validate price matches calculated NAV (allow small floating point differences)
  IF ABS(p_price_per_share - v_nav) > 0.01 THEN
    RAISE EXCEPTION 'Price mismatch: expected %, got %', v_nav, p_price_per_share;
  END IF;
  
  -- Store current values for audit trail
  v_market_cap_before := v_team.market_cap;
  v_shares_outstanding_before := v_team.shares_outstanding;
  
  -- Calculate new values
  v_market_cap_after := v_market_cap_before + p_total_amount;
  v_shares_outstanding_after := v_shares_outstanding_before + p_shares;
  
  -- Create order record with immutable snapshots
  INSERT INTO orders (
    user_id, team_id, order_type, quantity, 
    price_per_share, total_amount, status, 
    executed_at, market_cap_before, market_cap_after,
    shares_outstanding_before, shares_outstanding_after
  ) VALUES (
    p_user_id, p_team_id, 'BUY', p_shares,
    p_price_per_share, p_total_amount, 'FILLED',
    NOW(), v_market_cap_before, v_market_cap_after,
    v_shares_outstanding_before, v_shares_outstanding_after
  ) RETURNING id INTO v_order_id;
  
  -- Log the purchase for audit trail
  INSERT INTO audit_log (
    user_id,
    action,
    table_name,
    record_id,
    new_values,
    created_at
  ) VALUES (
    p_user_id,
    'share_purchase',
    'orders',
    v_order_id,
    jsonb_build_object(
      'team_id', p_team_id,
      'shares', p_shares,
      'price_per_share', p_price_per_share,
      'total_amount', p_total_amount,
      'market_cap_before', v_market_cap_before,
      'market_cap_after', v_market_cap_after,
      'shares_outstanding_before', v_shares_outstanding_before,
      'shares_outstanding_after', v_shares_outstanding_after
    ),
    NOW()
  );
  
  -- Update team market cap and shares atomically
  UPDATE teams SET
    market_cap = v_market_cap_after,
    shares_outstanding = v_shares_outstanding_after,
    updated_at = NOW()
  WHERE id = p_team_id;
  
  -- Update or create user position atomically
  INSERT INTO positions (user_id, team_id, quantity, total_invested)
  VALUES (p_user_id, p_team_id, p_shares, p_total_amount)
  ON CONFLICT (user_id, team_id) 
  DO UPDATE SET
    quantity = positions.quantity + p_shares,
    total_invested = positions.total_invested + p_total_amount,
    updated_at = NOW();
  
  -- Return success with transaction details
  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'market_cap_before', v_market_cap_before,
    'market_cap_after', v_market_cap_after,
    'shares_outstanding_before', v_shares_outstanding_before,
    'shares_outstanding_after', v_shares_outstanding_after
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."process_share_purchase_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_shares" integer, "p_price_per_share" numeric, "p_total_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_marketplace_complete"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_teams_reset INTEGER := 0;
    v_ledger_cleared INTEGER := 0;
    v_transfers_cleared INTEGER := 0;
    v_orders_cleared INTEGER := 0;
    v_positions_cleared INTEGER := 0;
    v_fixtures_reset INTEGER := 0;
BEGIN
    -- Step 1: Clear all dependent data first (to avoid foreign key issues)
    
    -- Clear total_ledger (with WHERE clause)
    DELETE FROM total_ledger WHERE id > 0;
    GET DIAGNOSTICS v_ledger_cleared = ROW_COUNT;
    
    -- Clear transfers_ledger (with WHERE clause)
    DELETE FROM transfers_ledger WHERE id > 0;
    GET DIAGNOSTICS v_transfers_cleared = ROW_COUNT;
    
    -- Clear orders (with WHERE clause)
    DELETE FROM orders WHERE id > 0;
    GET DIAGNOSTICS v_orders_cleared = ROW_COUNT;
    
    -- Clear positions (with WHERE clause)
    DELETE FROM positions WHERE id > 0;
    GET DIAGNOSTICS v_positions_cleared = ROW_COUNT;
    
    -- Step 2: Reset fixtures to pending state
    UPDATE fixtures 
    SET 
        result = 'pending',
        home_score = 0,
        away_score = 0,
        status = 'scheduled',
        updated_at = NOW()
    WHERE result != 'pending';
    GET DIAGNOSTICS v_fixtures_reset = ROW_COUNT;
    
    -- Step 3: Reset teams to initial state (with WHERE clause)
    UPDATE teams 
    SET 
        market_cap = initial_market_cap,
        shares_outstanding = 5,
        total_shares = 5,
        available_shares = 5,
        updated_at = NOW()
    WHERE id > 0;
    GET DIAGNOSTICS v_teams_reset = ROW_COUNT;
    
    -- Step 4: Create initial ledger entries for all teams
    INSERT INTO total_ledger (
        team_id,
        ledger_type,
        event_date,
        event_description,
        trigger_event_type,
        amount_transferred,
        price_impact,
        market_cap_before,
        market_cap_after,
        shares_outstanding_before,
        shares_outstanding_after,
        shares_traded,
        share_price_before,
        share_price_after,
        created_at,
        created_by,
        notes
    )
    SELECT 
        t.id,
        'initial_state',
        NOW(),
        'Initial State',
        'initial',
        0,
        0,
        t.initial_market_cap,
        t.initial_market_cap,
        5,
        5,
        0,
        t.launch_price,
        t.launch_price,
        NOW(),
        'system',
        'Marketplace reset - initial state'
    FROM teams t;
    
    -- Return summary
    RETURN FORMAT(
        'Marketplace reset complete: %s teams reset, %s ledger entries cleared, %s transfers cleared, %s orders cleared, %s positions cleared, %s fixtures reset',
        v_teams_reset,
        v_ledger_cleared,
        v_transfers_cleared,
        v_orders_cleared,
        v_positions_cleared,
        v_fixtures_reset
    );
END;
$$;


ALTER FUNCTION "public"."reset_marketplace_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."total_ledger_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_ledger_type TEXT;
    v_price_impact DECIMAL(15,2) := 0;
    v_shares_traded INTEGER := 0;
    v_recent_transfer RECORD;
    v_draw_fixture RECORD;
    v_fixture RECORD;
    v_transfer_exists BOOLEAN := FALSE;
    v_draw_exists BOOLEAN := FALSE;
BEGIN
    -- Calculate the changes
    v_price_impact := NEW.market_cap - OLD.market_cap;
    v_shares_traded := NEW.shares_outstanding - OLD.shares_outstanding;
    
    -- Only proceed if there are actual changes
    IF v_price_impact != 0 OR v_shares_traded != 0 THEN
        
        -- First, check for recent draw fixtures (no transfers for draws)
        SELECT * INTO v_draw_fixture
        FROM fixtures 
        WHERE (home_team_id = NEW.id OR away_team_id = NEW.id)
        AND result = 'draw'
        AND status = 'applied'
        AND updated_at >= NOW() - INTERVAL '1 hour'
        ORDER BY updated_at DESC
        LIMIT 1;
        
        v_draw_exists := (v_draw_fixture.id IS NOT NULL);
        
        IF v_draw_exists THEN
            -- Create match_draw entry
            PERFORM create_ledger_entry(
                NEW.id,
                'match_draw',
                0, -- No transfer amount for draws
                v_price_impact,
                v_shares_traded,
                v_draw_fixture.id,
                'fixture',
                CASE WHEN v_draw_fixture.home_team_id = NEW.id THEN v_draw_fixture.away_team_id ELSE v_draw_fixture.home_team_id END,
                NULL, -- Will be filled by function
                'draw',
                CASE 
                    WHEN v_draw_fixture.home_score IS NOT NULL AND v_draw_fixture.away_score IS NOT NULL 
                    THEN CONCAT(v_draw_fixture.home_score, '-', v_draw_fixture.away_score)
                    ELSE NULL
                END,
                (v_draw_fixture.home_team_id = NEW.id),
                CONCAT('Match vs ', CASE WHEN v_draw_fixture.home_team_id = NEW.id THEN 'away team' ELSE 'home team' END)
            );
            
        ELSE
            -- Look for the most recent transfer for this team (NO TIME WINDOW)
            SELECT * INTO v_recent_transfer
            FROM transfers_ledger 
            WHERE (winner_team_id = NEW.id OR loser_team_id = NEW.id)
            ORDER BY applied_at DESC
            LIMIT 1;
            
            -- Check if we found a transfer
            v_transfer_exists := (v_recent_transfer.id IS NOT NULL);
            
            IF v_transfer_exists THEN
                -- Get fixture details
                SELECT * INTO v_fixture
                FROM fixtures 
                WHERE id = v_recent_transfer.fixture_id;
                
                -- Determine match result and ledger type
                IF v_recent_transfer.winner_team_id = NEW.id THEN
                    v_ledger_type := 'match_win';
                ELSIF v_recent_transfer.loser_team_id = NEW.id THEN
                    v_ledger_type := 'match_loss';
                ELSE
                    v_ledger_type := 'match_draw';
                END IF;
                
                -- Create match entry
                PERFORM create_ledger_entry(
                    NEW.id,
                    v_ledger_type,
                    v_recent_transfer.transfer_amount,
                    v_price_impact,
                    v_shares_traded,
                    v_recent_transfer.id,
                    'fixture',
                    CASE WHEN v_fixture.home_team_id = NEW.id THEN v_fixture.away_team_id ELSE v_fixture.home_team_id END,
                    NULL, -- Will be filled by function
                    CASE 
                        WHEN v_ledger_type = 'match_win' THEN 'win'
                        WHEN v_ledger_type = 'match_loss' THEN 'loss'
                        ELSE 'draw'
                    END,
                    CASE 
                        WHEN v_fixture.home_score IS NOT NULL AND v_fixture.away_score IS NOT NULL 
                        THEN CONCAT(v_fixture.home_score, '-', v_fixture.away_score)
                        ELSE NULL
                    END,
                    (v_fixture.home_team_id = NEW.id),
                    CONCAT('Match vs ', CASE WHEN v_fixture.home_team_id = NEW.id THEN 'away team' ELSE 'home team' END)
                );
                
            ELSIF v_shares_traded != 0 THEN
                -- Share purchase/sale (no transfer found)
                IF v_shares_traded > 0 THEN
                    v_ledger_type := 'share_purchase';
                ELSE
                    v_ledger_type := 'share_sale';
                END IF;
                
                PERFORM create_ledger_entry(
                    NEW.id,
                    v_ledger_type,
                    ABS(v_shares_traded) * (OLD.market_cap / OLD.shares_outstanding),
                    v_price_impact,
                    v_shares_traded,
                    NULL,
                    'order',
                    NULL, NULL, NULL, NULL, NULL,
                    CONCAT(ABS(v_shares_traded), ' shares ', CASE WHEN v_shares_traded > 0 THEN 'purchased' ELSE 'sold' END)
                );
                
            ELSE
                -- Manual adjustment (market cap change without shares or transfer)
                PERFORM create_ledger_entry(
                    NEW.id,
                    'manual_adjustment',
                    0,
                    v_price_impact,
                    0,
                    NULL,
                    'manual',
                    NULL, NULL, NULL, NULL, NULL,
                    'Market cap adjustment'
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."total_ledger_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_team_snapshot_on_market_cap_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only create snapshot if market_cap actually changed
    IF OLD.market_cap IS DISTINCT FROM NEW.market_cap THEN
        PERFORM create_team_snapshot(
            NEW.id,
            'match_result',
            NULL, -- Will be set by the calling context
            'fixture',
            NULL, -- Will be set by the calling context
            NEW.market_cap - OLD.market_cap
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_team_snapshot_on_market_cap_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."truncate_profiles_table"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Truncate profiles table (cascades to positions and orders due to foreign keys)
    TRUNCATE TABLE profiles CASCADE;
    
    -- Log the operation
    RAISE NOTICE 'Profiles table truncated successfully - all user data deleted';
END;
$$;


ALTER FUNCTION "public"."truncate_profiles_table"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" integer,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."total_ledger" (
    "id" integer NOT NULL,
    "team_id" integer NOT NULL,
    "ledger_type" "text" NOT NULL,
    "event_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_description" "text",
    "trigger_event_id" integer,
    "trigger_event_type" "text",
    "opponent_team_id" integer,
    "opponent_team_name" "text",
    "match_result" "text",
    "match_score" "text",
    "is_home_match" boolean,
    "amount_transferred" numeric(15,2) DEFAULT 0 NOT NULL,
    "price_impact" numeric(15,2) DEFAULT 0 NOT NULL,
    "market_cap_before" numeric(15,2) NOT NULL,
    "market_cap_after" numeric(15,2) NOT NULL,
    "shares_outstanding_before" integer NOT NULL,
    "shares_outstanding_after" integer NOT NULL,
    "shares_traded" integer DEFAULT 0 NOT NULL,
    "share_price_before" numeric(10,2) NOT NULL,
    "share_price_after" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text" DEFAULT 'system'::"text",
    "notes" "text",
    CONSTRAINT "total_ledger_ledger_type_check" CHECK (("ledger_type" = ANY (ARRAY['share_purchase'::"text", 'share_sale'::"text", 'match_win'::"text", 'match_loss'::"text", 'match_draw'::"text", 'initial_state'::"text", 'manual_adjustment'::"text"]))),
    CONSTRAINT "total_ledger_match_result_check" CHECK (("match_result" = ANY (ARRAY['win'::"text", 'loss'::"text", 'draw'::"text"]))),
    CONSTRAINT "total_ledger_trigger_event_type_check" CHECK (("trigger_event_type" = ANY (ARRAY['order'::"text", 'fixture'::"text", 'manual'::"text", 'initial'::"text"]))),
    CONSTRAINT "valid_market_caps" CHECK ((("market_cap_before" >= (0)::numeric) AND ("market_cap_after" >= (0)::numeric))),
    CONSTRAINT "valid_share_counts" CHECK ((("shares_outstanding_before" >= 0) AND ("shares_outstanding_after" >= 0))),
    CONSTRAINT "valid_share_prices" CHECK ((("share_price_before" >= (0)::numeric) AND ("share_price_after" >= (0)::numeric)))
);


ALTER TABLE "public"."total_ledger" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."current_team_states" AS
 SELECT DISTINCT ON ("team_id") "team_id",
    "market_cap_after" AS "current_market_cap",
    "shares_outstanding_after" AS "current_shares_outstanding",
    "share_price_after" AS "current_share_price",
    "event_date" AS "last_updated"
   FROM "public"."total_ledger"
  ORDER BY "team_id", "event_date" DESC;


ALTER VIEW "public"."current_team_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fixtures" (
    "id" integer NOT NULL,
    "external_id" integer NOT NULL,
    "home_team_id" integer,
    "away_team_id" integer,
    "matchday" integer NOT NULL,
    "status" "text" DEFAULT 'SCHEDULED'::"text" NOT NULL,
    "home_score" integer DEFAULT 0,
    "away_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "kickoff_at" timestamp with time zone NOT NULL,
    "buy_close_at" timestamp with time zone NOT NULL,
    "snapshot_home_cap" numeric(15,2),
    "snapshot_away_cap" numeric(15,2),
    "result" "text" DEFAULT 'pending'::"text",
    "season" integer,
    CONSTRAINT "fixtures_result_check" CHECK (("result" = ANY (ARRAY['home_win'::"text", 'away_win'::"text", 'draw'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."fixtures" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fixtures_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fixtures_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fixtures_id_seq" OWNED BY "public"."fixtures"."id";



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "team_id" integer,
    "order_type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "price_per_share" numeric(10,2) NOT NULL,
    "total_amount" numeric(15,2) NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "executed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "market_cap_before" numeric,
    "market_cap_after" numeric,
    "shares_outstanding_before" integer,
    "shares_outstanding_after" integer,
    CONSTRAINT "orders_market_cap_after_check" CHECK (("market_cap_after" >= "market_cap_before")),
    CONSTRAINT "orders_market_cap_before_check" CHECK (("market_cap_before" >= (0)::numeric)),
    CONSTRAINT "orders_order_type_check" CHECK (("order_type" = ANY (ARRAY['BUY'::"text", 'SELL'::"text"]))),
    CONSTRAINT "orders_price_per_share_check" CHECK (("price_per_share" > (0)::numeric)),
    CONSTRAINT "orders_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "orders_shares_outstanding_check" CHECK (("shares_outstanding_after" >= "shares_outstanding_before")),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'FILLED'::"text", 'CANCELLED'::"text"]))),
    CONSTRAINT "orders_total_amount_check" CHECK (("total_amount" > (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."orders_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."orders_id_seq" OWNED BY "public"."orders"."id";



CREATE TABLE IF NOT EXISTS "public"."positions" (
    "user_id" "uuid",
    "team_id" integer,
    "quantity" numeric,
    "total_invested" numeric,
    "id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_investments" CHECK (("total_invested" >= (0)::numeric)),
    CONSTRAINT "valid_quantities" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."positions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."positions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."positions_id_seq" OWNED BY "public"."positions"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_admin" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" integer NOT NULL,
    "external_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text" NOT NULL,
    "logo_url" "text",
    "initial_market_cap" numeric(15,2) DEFAULT 100.00,
    "market_cap" numeric(15,2) DEFAULT 100.00,
    "total_shares" integer DEFAULT 5,
    "available_shares" integer DEFAULT 5,
    "shares_outstanding" integer DEFAULT 5,
    "is_tradeable" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "launch_price" numeric(10,2) DEFAULT 20.00
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_market_data" AS
 SELECT "id",
    "name",
    "short_name",
    "external_id",
    "logo_url",
    "launch_price",
    "initial_market_cap",
    "market_cap",
    "shares_outstanding",
        CASE
            WHEN ("shares_outstanding" > 0) THEN ("market_cap" / ("shares_outstanding")::numeric)
            ELSE 20.00
        END AS "current_price",
    "is_tradeable",
    "created_at",
    "updated_at"
   FROM "public"."teams" "t";


ALTER VIEW "public"."team_market_data" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_performance_summary" AS
 SELECT "t"."id" AS "team_id",
    "t"."name" AS "team_name",
    "t"."initial_market_cap",
    "cls"."current_market_cap",
    "cls"."current_shares_outstanding",
    "cls"."current_share_price",
    "cls"."last_updated",
    ("cls"."current_market_cap" - "t"."initial_market_cap") AS "total_market_cap_change",
    "round"(((("cls"."current_market_cap" - "t"."initial_market_cap") / "t"."initial_market_cap") * (100)::numeric), 2) AS "market_cap_change_percent",
    ( SELECT "count"(*) AS "count"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = 'match_win'::"text"))) AS "wins",
    ( SELECT "count"(*) AS "count"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = 'match_loss'::"text"))) AS "losses",
    ( SELECT "count"(*) AS "count"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = 'match_draw'::"text"))) AS "draws",
    ( SELECT "count"(*) AS "count"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = 'share_purchase'::"text"))) AS "share_purchases",
    ( SELECT "count"(*) AS "count"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = 'share_sale'::"text"))) AS "share_sales",
    ( SELECT COALESCE("sum"("total_ledger"."shares_traded"), (0)::bigint) AS "coalesce"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = ANY (ARRAY['share_purchase'::"text", 'share_sale'::"text"])))) AS "total_shares_traded",
    ( SELECT COALESCE("sum"("total_ledger"."amount_transferred"), (0)::numeric) AS "coalesce"
           FROM "public"."total_ledger"
          WHERE (("total_ledger"."team_id" = "t"."id") AND ("total_ledger"."ledger_type" = ANY (ARRAY['share_purchase'::"text", 'share_sale'::"text"])))) AS "total_trade_volume"
   FROM ("public"."teams" "t"
     LEFT JOIN "public"."current_team_states" "cls" ON (("t"."id" = "cls"."team_id")))
  ORDER BY "cls"."current_market_cap" DESC;


ALTER VIEW "public"."team_performance_summary" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teams_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teams_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."teams_id_seq" OWNED BY "public"."teams"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."total_ledger_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."total_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."total_ledger_id_seq" OWNED BY "public"."total_ledger"."id";



CREATE TABLE IF NOT EXISTS "public"."transfers_ledger" (
    "id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fixture_id" integer NOT NULL,
    "winner_team_id" integer NOT NULL,
    "loser_team_id" integer NOT NULL,
    "transfer_amount" numeric(15,2) NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "is_latest" boolean DEFAULT true
);


ALTER TABLE "public"."transfers_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."transfers_ledger" IS 'Records market cap transfers between teams based on match results only';



COMMENT ON COLUMN "public"."transfers_ledger"."fixture_id" IS 'Reference to the fixture that caused this transfer';



COMMENT ON COLUMN "public"."transfers_ledger"."winner_team_id" IS 'Team that won the match and gained market cap';



COMMENT ON COLUMN "public"."transfers_ledger"."loser_team_id" IS 'Team that lost the match and lost market cap';



COMMENT ON COLUMN "public"."transfers_ledger"."transfer_amount" IS 'Amount of market cap transferred from loser to winner';



COMMENT ON COLUMN "public"."transfers_ledger"."applied_at" IS 'When this transfer was applied to the market';



COMMENT ON COLUMN "public"."transfers_ledger"."is_latest" IS 'Whether this is the latest transfer record (for historical tracking)';



CREATE SEQUENCE IF NOT EXISTS "public"."transfers_ledger_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transfers_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transfers_ledger_id_seq" OWNED BY "public"."transfers_ledger"."id";



ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."fixtures" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fixtures_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."orders" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."orders_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."positions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."positions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."teams" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teams_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."total_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."total_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transfers_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transfers_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_user_team_unique" UNIQUE ("user_id", "team_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."total_ledger"
    ADD CONSTRAINT "total_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfers_ledger"
    ADD CONSTRAINT "transfers_ledger_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_user_id" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_fixtures_applied" ON "public"."fixtures" USING "btree" ("kickoff_at") WHERE ("status" = 'applied'::"text");



CREATE INDEX "idx_fixtures_external_id" ON "public"."fixtures" USING "btree" ("external_id");



CREATE INDEX "idx_fixtures_kickoff_status" ON "public"."fixtures" USING "btree" ("kickoff_at", "status");



CREATE INDEX "idx_fixtures_matchday" ON "public"."fixtures" USING "btree" ("matchday");



CREATE INDEX "idx_fixtures_scheduled" ON "public"."fixtures" USING "btree" ("kickoff_at") WHERE ("status" = 'scheduled'::"text");



CREATE INDEX "idx_fixtures_status" ON "public"."fixtures" USING "btree" ("status");



CREATE INDEX "idx_fixtures_team_results" ON "public"."fixtures" USING "btree" ("home_team_id", "away_team_id", "result", "status", "kickoff_at");



CREATE INDEX "idx_fixtures_team_status" ON "public"."fixtures" USING "btree" ("home_team_id", "away_team_id", "status");



CREATE INDEX "idx_orders_executed_at" ON "public"."orders" USING "btree" ("executed_at");



CREATE INDEX "idx_orders_market_cap_after" ON "public"."orders" USING "btree" ("market_cap_after");



CREATE INDEX "idx_orders_market_cap_before" ON "public"."orders" USING "btree" ("market_cap_before");



CREATE INDEX "idx_orders_pending" ON "public"."orders" USING "btree" ("created_at") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_team_id" ON "public"."orders" USING "btree" ("team_id");



CREATE INDEX "idx_orders_team_status" ON "public"."orders" USING "btree" ("team_id", "status", "created_at");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_orders_user_status" ON "public"."orders" USING "btree" ("user_id", "status", "created_at");



CREATE INDEX "idx_profiles_is_admin" ON "public"."profiles" USING "btree" ("is_admin") WHERE ("is_admin" = true);



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "idx_teams_external_id" ON "public"."teams" USING "btree" ("external_id");



CREATE INDEX "idx_teams_market_cap_calc" ON "public"."teams" USING "btree" ((("market_cap" / (NULLIF("shares_outstanding", 0))::numeric)));



CREATE INDEX "idx_teams_market_data" ON "public"."teams" USING "btree" ("id", "name", "market_cap", "shares_outstanding");



CREATE INDEX "idx_teams_name" ON "public"."teams" USING "btree" ("name");



CREATE INDEX "idx_teams_name_lower" ON "public"."teams" USING "btree" ("lower"("name"));



CREATE INDEX "idx_total_ledger_event_date" ON "public"."total_ledger" USING "btree" ("event_date");



CREATE INDEX "idx_total_ledger_ledger_type" ON "public"."total_ledger" USING "btree" ("ledger_type");



CREATE INDEX "idx_total_ledger_team_date" ON "public"."total_ledger" USING "btree" ("team_id", "event_date");



CREATE INDEX "idx_total_ledger_team_id" ON "public"."total_ledger" USING "btree" ("team_id");



CREATE INDEX "idx_total_ledger_trigger_event" ON "public"."total_ledger" USING "btree" ("trigger_event_type", "trigger_event_id");



CREATE INDEX "idx_transfers_applied_at" ON "public"."transfers_ledger" USING "btree" ("applied_at");



CREATE INDEX "idx_transfers_fixture_id" ON "public"."transfers_ledger" USING "btree" ("fixture_id");



CREATE INDEX "idx_transfers_loser_team_id" ON "public"."transfers_ledger" USING "btree" ("loser_team_id");



CREATE INDEX "idx_transfers_team_applied" ON "public"."transfers_ledger" USING "btree" ("winner_team_id", "loser_team_id", "applied_at");



CREATE INDEX "idx_transfers_winner_team_id" ON "public"."transfers_ledger" USING "btree" ("winner_team_id");



CREATE OR REPLACE TRIGGER "fixture_result_trigger" AFTER UPDATE ON "public"."fixtures" FOR EACH ROW WHEN ((("old"."result" = 'pending'::"text") AND ("new"."result" <> 'pending'::"text"))) EXECUTE FUNCTION "public"."fixture_result_trigger"();



CREATE OR REPLACE TRIGGER "match_result_audit_trigger" AFTER UPDATE ON "public"."fixtures" FOR EACH ROW EXECUTE FUNCTION "public"."log_match_result_audit"();



CREATE OR REPLACE TRIGGER "update_fixtures_updated_at" BEFORE UPDATE ON "public"."fixtures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."total_ledger"
    ADD CONSTRAINT "total_ledger_opponent_team_id_fkey" FOREIGN KEY ("opponent_team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."total_ledger"
    ADD CONSTRAINT "total_ledger_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfers_ledger"
    ADD CONSTRAINT "transfers_ledger_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id");



ALTER TABLE ONLY "public"."transfers_ledger"
    ADD CONSTRAINT "transfers_ledger_loser_team_id_fkey" FOREIGN KEY ("loser_team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."transfers_ledger"
    ADD CONSTRAINT "transfers_ledger_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id");



CREATE POLICY "All users can view all orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "All users can view all positions" ON "public"."positions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Anyone can insert fixtures" ON "public"."fixtures" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert match transfers" ON "public"."transfers_ledger" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert teams" ON "public"."teams" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can update fixtures" ON "public"."fixtures" FOR UPDATE USING (true);



CREATE POLICY "Anyone can update teams" ON "public"."teams" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view filled orders" ON "public"."orders" FOR SELECT USING (("status" = 'FILLED'::"text"));



CREATE POLICY "Anyone can view fixtures" ON "public"."fixtures" FOR SELECT USING (true);



CREATE POLICY "Anyone can view match transfers" ON "public"."transfers_ledger" FOR SELECT USING (true);



CREATE POLICY "Anyone can view teams" ON "public"."teams" FOR SELECT USING (true);



CREATE POLICY "Service role can manage all audit logs" ON "public"."audit_log" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all orders" ON "public"."orders" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all transfers" ON "public"."transfers_ledger" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage fixtures" ON "public"."fixtures" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage teams" ON "public"."teams" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "System can insert audit logs" ON "public"."audit_log" FOR INSERT WITH CHECK (("user_id" IS NULL));



CREATE POLICY "Users can delete their own positions" ON "public"."positions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own audit logs" ON "public"."audit_log" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own positions" ON "public"."positions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own orders" ON "public"."orders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own positions" ON "public"."positions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can view own audit logs" ON "public"."audit_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own positions" ON "public"."positions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own positions" ON "public"."positions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fixtures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transfers_ledger" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_position_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."add_position_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_position_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_position_with_history"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."add_position_with_history"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_position_with_history"("p_user_id" "uuid", "p_team_id" integer, "p_quantity" integer, "p_total_invested" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_season_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_season_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_season_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ledger_entry"("p_team_id" integer, "p_ledger_type" "text", "p_amount_transferred" numeric, "p_price_impact" numeric, "p_shares_traded" integer, "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_opponent_team_id" integer, "p_opponent_team_name" "text", "p_match_result" "text", "p_match_score" "text", "p_is_home_match" boolean, "p_event_description" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_ledger_entry"("p_team_id" integer, "p_ledger_type" "text", "p_amount_transferred" numeric, "p_price_impact" numeric, "p_shares_traded" integer, "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_opponent_team_id" integer, "p_opponent_team_name" "text", "p_match_result" "text", "p_match_score" "text", "p_is_home_match" boolean, "p_event_description" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ledger_entry"("p_team_id" integer, "p_ledger_type" "text", "p_amount_transferred" numeric, "p_price_impact" numeric, "p_shares_traded" integer, "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_opponent_team_id" integer, "p_opponent_team_name" "text", "p_match_result" "text", "p_match_score" "text", "p_is_home_match" boolean, "p_event_description" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric, "p_effective_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric, "p_effective_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team_snapshot"("p_team_id" integer, "p_snapshot_type" "text", "p_trigger_event_id" integer, "p_trigger_event_type" "text", "p_match_result" "text", "p_price_impact" numeric, "p_shares_traded" integer, "p_trade_amount" numeric, "p_effective_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."fixture_result_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."fixture_result_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fixture_result_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_complete_timeline"("p_team_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_complete_timeline"("p_team_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_complete_timeline"("p_team_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_state_at_time"("p_team_id" integer, "p_at_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_state_at_time"("p_team_id" integer, "p_at_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_state_at_time"("p_team_id" integer, "p_at_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_state_history"("p_team_id" integer, "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_state_history"("p_team_id" integer, "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_state_history"("p_team_id" integer, "p_from_date" timestamp with time zone, "p_to_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_timeline"("p_team_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_timeline"("p_team_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_timeline"("p_team_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_portfolio"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_portfolio"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_portfolio"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_buy_window_open"("p_team_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_buy_window_open"("p_team_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_buy_window_open"("p_team_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_tradeable"("team_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_tradeable"("team_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_tradeable"("team_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_match_result_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_match_result_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_match_result_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_match_result_atomic"("p_fixture_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_match_result_atomic"("p_fixture_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_match_result_atomic"("p_fixture_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_share_purchase_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_shares" integer, "p_price_per_share" numeric, "p_total_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."process_share_purchase_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_shares" integer, "p_price_per_share" numeric, "p_total_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_share_purchase_atomic"("p_user_id" "uuid", "p_team_id" integer, "p_shares" integer, "p_price_per_share" numeric, "p_total_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_marketplace_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_marketplace_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_marketplace_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."total_ledger_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."total_ledger_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."total_ledger_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_team_snapshot_on_market_cap_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_team_snapshot_on_market_cap_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_team_snapshot_on_market_cap_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."truncate_profiles_table"() TO "anon";
GRANT ALL ON FUNCTION "public"."truncate_profiles_table"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."truncate_profiles_table"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."total_ledger" TO "anon";
GRANT ALL ON TABLE "public"."total_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."total_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."current_team_states" TO "anon";
GRANT ALL ON TABLE "public"."current_team_states" TO "authenticated";
GRANT ALL ON TABLE "public"."current_team_states" TO "service_role";



GRANT ALL ON TABLE "public"."fixtures" TO "anon";
GRANT ALL ON TABLE "public"."fixtures" TO "authenticated";
GRANT ALL ON TABLE "public"."fixtures" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fixtures_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fixtures_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fixtures_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."team_market_data" TO "anon";
GRANT ALL ON TABLE "public"."team_market_data" TO "authenticated";
GRANT ALL ON TABLE "public"."team_market_data" TO "service_role";



GRANT ALL ON TABLE "public"."team_performance_summary" TO "anon";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."total_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."total_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."total_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transfers_ledger" TO "anon";
GRANT ALL ON TABLE "public"."transfers_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."transfers_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transfers_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transfers_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transfers_ledger_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


