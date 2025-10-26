-- Complete cleanup and recreate RLS policies for positions table
-- This should fix the 406 error once and for all

-- Drop ALL existing policies on positions
DROP POLICY IF EXISTS "Users can view own positions" ON positions;
DROP POLICY IF EXISTS "Users can view their own positions" ON positions;
DROP POLICY IF EXISTS "positions_select_policy" ON positions;
DROP POLICY IF EXISTS "positions_insert_policy" ON positions;
DROP POLICY IF EXISTS "positions_update_policy" ON positions;
DROP POLICY IF EXISTS "positions_delete_policy" ON positions;
DROP POLICY IF EXISTS "Admins can view all positions" ON positions;
DROP POLICY IF EXISTS "Admin full access" ON positions;
DROP POLICY IF EXISTS "Service role full access" ON positions;

-- Now create clean policies
CREATE POLICY "positions_select_policy" ON positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "positions_insert_policy" ON positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "positions_update_policy" ON positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "positions_delete_policy" ON positions
  FOR DELETE USING (auth.uid() = user_id);

-- Allow admins to view all positions
CREATE POLICY "positions_admin_select_policy" ON positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Allow service role
CREATE POLICY "positions_service_role_policy" ON positions
  FOR ALL USING ((auth.role() = 'service_role'::text));

-- Verify
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'positions';
