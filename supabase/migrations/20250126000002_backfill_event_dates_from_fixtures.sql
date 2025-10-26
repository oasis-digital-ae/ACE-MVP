-- Backfill event_date in total_ledger by joining with fixtures table
-- This fixes entries that were created with updated_at instead of kickoff_at

UPDATE total_ledger tl
SET event_date = f.kickoff_at
FROM fixtures f
WHERE tl.trigger_event_type = 'fixture'
  AND tl.trigger_event_id = f.id
  AND tl.event_date != f.kickoff_at;

