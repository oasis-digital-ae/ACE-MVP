-- Add Admin Policies for Orders and Positions
-- Allow admins to view all orders and positions for admin dashboard functionality

-- ============================================
-- 1. ORDERS TABLE ADMIN POLICY
-- ============================================
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS orders_admin_select ON public.orders;

-- Allow admins to view all orders (not just their own)
CREATE POLICY orders_admin_select ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- 2. POSITIONS TABLE ADMIN POLICY
-- ============================================
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS positions_admin_select ON public.positions;

-- Allow admins to view all positions (not just their own)
CREATE POLICY positions_admin_select ON public.positions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- 3. COMMENTS
-- ============================================
COMMENT ON POLICY orders_admin_select ON public.orders IS 
  'Allows admins to view all orders for admin dashboard and trading activity monitoring';

COMMENT ON POLICY positions_admin_select ON public.positions IS 
  'Allows admins to view all positions for admin dashboard and user portfolio monitoring';

