-- Backfill and enforce correct event_description for match ledger rows
-- Idempotent: safe to run multiple times

-- 1) Normalize existing rows where we already know the opponent
UPDATE total_ledger tl
SET event_description = CONCAT('Match vs ', tl.opponent_team_name)
WHERE tl.trigger_event_type = 'fixture'
  AND tl.ledger_type IN ('match_win','match_loss','match_draw')
  AND tl.opponent_team_name IS NOT NULL
  AND tl.opponent_team_name <> ''
  AND tl.event_description IS DISTINCT FROM CONCAT('Match vs ', tl.opponent_team_name);

-- 2) For rows missing opponent_team_name, compute from fixtures/teams and set both
WITH fix AS (
  SELECT tl.id,
         CASE 
           WHEN tl.team_id = f.home_team_id THEN away_team.name
           WHEN tl.team_id = f.away_team_id THEN home_team.name
           ELSE NULL
         END AS opponent_name
  FROM total_ledger tl
  JOIN fixtures f ON tl.trigger_event_type = 'fixture' AND tl.trigger_event_id = f.id
  JOIN teams home_team ON f.home_team_id = home_team.id
  JOIN teams away_team ON f.away_team_id = away_team.id
  WHERE tl.ledger_type IN ('match_win','match_loss','match_draw')
    AND (tl.opponent_team_name IS NULL OR tl.opponent_team_name = '')
)
UPDATE total_ledger tl
SET opponent_team_name = fix.opponent_name,
    event_description = CONCAT('Match vs ', fix.opponent_name)
FROM fix
WHERE tl.id = fix.id
  AND fix.opponent_name IS NOT NULL;

-- 3) Trigger to keep descriptions correct on future writes/updates
CREATE OR REPLACE FUNCTION set_total_ledger_event_description()
RETURNS trigger AS $$
BEGIN
  IF (NEW.trigger_event_type = 'fixture' AND NEW.ledger_type IN ('match_win','match_loss','match_draw')) THEN
    -- If opponent_team_name is missing, derive it from fixtures/teams
    IF COALESCE(NEW.opponent_team_name, '') = '' THEN
      SELECT CASE WHEN NEW.team_id = f.home_team_id THEN away_team.name ELSE home_team.name END
        INTO NEW.opponent_team_name
      FROM fixtures f
      JOIN teams home_team ON f.home_team_id = home_team.id
      JOIN teams away_team ON f.away_team_id = away_team.id
      WHERE f.id = NEW.trigger_event_id;
    END IF;
    NEW.event_description := 'Match vs ' || NEW.opponent_team_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_total_ledger_description ON total_ledger;
CREATE TRIGGER trg_set_total_ledger_description
BEFORE INSERT OR UPDATE OF opponent_team_name, trigger_event_id, trigger_event_type, ledger_type, team_id
ON total_ledger
FOR EACH ROW
EXECUTE FUNCTION set_total_ledger_event_description();


