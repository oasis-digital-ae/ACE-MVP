-- Migration: Update process_share_purchase_atomic and process_share_sale_atomic
-- to use ten-thousandths (4 decimal precision) instead of cents
-- REQUIRES: 20260304120000_monetary_precision_ten_thousandths.sql to have run first (data migration)
--
-- For production: 20260307 migrations were already applied with cents logic.
-- This migration updates the functions to ten-thousandths after the data migration.

-- Include the updated function definitions (same as 20260307 migrations)
