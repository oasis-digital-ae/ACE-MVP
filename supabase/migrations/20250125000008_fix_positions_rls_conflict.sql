-- Fix RLS Policy Conflict on Positions Table
-- Remove duplicate policies that are causing 406 errors

-- Drop all existing policies on positions table to start clean
DROP POLICY IF EXISTS "Users can view own positions" ON positions;
DROP POLICY IF EXISTS "Users can view their own positions" ON positions;
DROP POLICY IF EXISTS "positions_select_policy" ON positions;
DROP POLICY IF EXISTS "positions_insert_policy" ON positions;
DROP POLICY IF EXISTS "positions_update_policy" ON positions;
DROP POLICY IF EXISTS "positions_delete_policy" ON positions;
DROP POLICY IF EXISTS "Admins can view all positions" ON positions;

-- Create clean, non-conflicting policies
CREATE POLICY "positions_select_policy" ON positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "positions_insert_policy" ON positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "positions_update_policy" ON positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "positions_delete_policy" ON positions
  FOR DELETE USING (auth.uid() = user_id);

-- Allow admins to view all positions
CREATE POLICY "Admins can view all positions" ON positions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Positions RLS policies fixed successfully';
END $$;
