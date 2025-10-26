-- Nuclear option: Disable and re-enable RLS on positions
ALTER TABLE positions DISABLE ROW LEVEL SECURITY;

-- Wait a moment, then re-enable
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "positions_select_policy" ON positions;
DROP POLICY IF EXISTS "positions_insert_policy" ON positions;
DROP POLICY IF EXISTS "positions_update_policy" ON positions;
DROP POLICY IF EXISTS "positions_delete_policy" ON positions;
DROP POLICY IF EXISTS "positions_admin_select_policy" ON positions;
DROP POLICY IF EXISTS "positions_service_role_policy" ON positions;
DROP POLICY IF EXISTS "positions_admin_select" ON positions;
DROP POLICY IF EXISTS "positions_service_role" ON positions;

-- Now create clean, simple policies
CREATE POLICY "positions_select_policy" ON positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "positions_insert_policy" ON positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "positions_update_policy" ON positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "positions_delete_policy" ON positions
  FOR DELETE USING (auth.uid() = user_id);

-- Allow admins to view all
CREATE POLICY "positions_admin_select" ON positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Allow service role
CREATE POLICY "positions_service_role" ON positions
  FOR ALL USING ((auth.role() = 'service_role'::text));
