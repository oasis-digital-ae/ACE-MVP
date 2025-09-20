# Database Migrations

This directory contains the essential database migration files for the Football MVP application.

## Files

### `consolidated_migration.sql`
The main database schema file. This creates all tables, indexes, RLS policies, and functions needed for the application.

**Usage**: Run this first to set up the complete database schema.

### `simplify_transfers_ledger.sql`
Migration to fix the transfers_ledger table schema. This removes unused columns and sets up the table to only handle match result transfers.

**Usage**: Run this after the consolidated migration to fix the transfers_ledger table.

## Setup Instructions

1. **Initial Setup**: Run `consolidated_migration.sql` in your Supabase SQL Editor
2. **Fix Transfers**: Run `simplify_transfers_ledger.sql` in your Supabase SQL Editor
3. **Verify**: Check that all tables are created and RLS policies are active

## Database Schema

The application uses the following main tables:
- `profiles` - User profiles
- `teams` - Football teams with market cap data
- `fixtures` - Match fixtures and results
- `orders` - User purchase orders
- `positions` - User share holdings (with transaction history)
- `transfers_ledger` - Market cap transfers from match results
- `audit_log` - System audit trail

## Environment Variables

Make sure these are set in your Supabase project:
- `NEXT_PUBLIC_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_FOOTBALL_API_KEY`
