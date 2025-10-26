-- Update existing ledger entries to use fixture dates
UPDATE total_ledger tl
SET event_date = (
  SELECT kickoff_at 
  FROM fixtures f 
  WHERE f.id = tl.trigger_event_id 
  AND tl.trigger_event_type = 'fixture'
)
WHERE tl.trigger_event_type = 'fixture'
AND EXISTS (
  SELECT 1 FROM fixtures f WHERE f.id = tl.trigger_event_id
);

-- Success message
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated 
  FROM total_ledger 
  WHERE trigger_event_type = 'fixture';
  
  RAISE NOTICE '✅ Updated % ledger entries with correct fixture dates!', v_updated;
END $$;
