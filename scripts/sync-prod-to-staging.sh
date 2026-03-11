#!/usr/bin/env bash
# Sync production database to staging (excluding profiles for PII)
# Requires: PROD_DATABASE_URL, STAGING_DATABASE_URL (direct Postgres connection strings)
# Get from: Supabase Dashboard > Project > Settings > Database > Connection string (URI, session mode)

set -euo pipefail

PROD_URL="${PROD_DATABASE_URL:?Set PROD_DATABASE_URL}"
STAGING_URL="${STAGING_DATABASE_URL:?Set STAGING_DATABASE_URL}"

# Tables to copy from prod (exact replica) - no user/PII data
# team_market_data is a VIEW over teams (not a table); excluded from dump/truncate
SYNC_TABLES="public.teams public.fixtures public.total_ledger public.transfers_ledger"

# Tables to clear and NOT copy (user-linked or PII)
# profiles: PII - use seed instead
# User data tables: reference profiles, cleared for clean staging
CLEAR_TABLES="public.weekly_leaderboard public.audit_log public.rate_limits public.wallet_transactions public.deposits public.positions public.orders public.profiles"

echo "==> Syncing prod to staging (excluding profiles for PII)..."

# 1. Dump data from prod (teams, fixtures, market data, ledgers only)
echo "==> Dumping data from production..."
DUMP_FILE=$(mktemp -u).dump
pg_dump "$PROD_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  -t public.teams \
  -t public.fixtures \
  -t public.total_ledger \
  -t public.transfers_ledger \
  -Fc \
  -f "$DUMP_FILE"

# 2. On staging: truncate tables we're about to overwrite (FK-safe order)
echo "==> Truncating staging tables..."
psql "$STAGING_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE TABLE
  public.transfers_ledger,
  public.total_ledger,
  public.fixtures,
  public.teams
CASCADE;
SQL

# 3. Restore prod data into staging
echo "==> Restoring prod data to staging..."
pg_restore \
  --data-only \
  --no-owner \
  --no-acl \
  -d "$STAGING_URL" \
  "$DUMP_FILE"
rm -f "$DUMP_FILE"

# 4. Truncate user tables (staging uses seed for profiles)
echo "==> Clearing user tables on staging..."
psql "$STAGING_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE TABLE
  public.weekly_leaderboard,
  public.audit_log,
  public.rate_limits,
  public.wallet_transactions,
  public.deposits,
  public.positions,
  public.orders
CASCADE;

-- Clear profiles (PII); seed will repopulate with test users
TRUNCATE TABLE public.profiles CASCADE;

-- Clear auth (PII); seed will repopulate with test accounts
DELETE FROM auth.identities;
DELETE FROM auth.users;
SQL

# 5. Run seed for profiles + auth (test users)
echo "==> Seeding staging with test users..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="$SCRIPT_DIR/../supabase/seed-profiles-only.sql"
if [[ -f "$SEED_FILE" ]]; then
  psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f "$SEED_FILE"
  echo "==> Seed applied."
else
  echo "!! Seed file not found: $SEED_FILE"
  exit 1
fi

echo "==> Sync complete. Staging has prod data (teams, fixtures, ledgers) and seed test users (no PII)."
