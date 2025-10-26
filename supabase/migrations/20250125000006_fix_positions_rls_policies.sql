-- Fix conflicting RLS policies on positions table
-- Remove duplicate policies and keep only the correct one

-- Drop all existing policies on positions table
DROP POLICY IF EXISTS "All users can view all positions" ON positions;
DROP POLICY IF EXISTS "Users can view own positions" ON positions;
DROP POLICY IF EXISTS "Users can view their own positions" ON positions;
DROP POLICY IF EXISTS "Users can insert their own positions" ON positions;
DROP POLICY IF EXISTS "Users can update their own positions" ON positions;
DROP POLICY IF EXISTS "Users can delete their own positions" ON positions;

-- Create clean, non-conflicting policies
CREATE POLICY "positions_select_policy" ON positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "positions_insert_policy" ON positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "positions_update_policy" ON positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "positions_delete_policy" ON positions
  FOR DELETE USING (auth.uid() = user_id);
