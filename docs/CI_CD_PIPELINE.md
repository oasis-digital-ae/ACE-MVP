# CI/CD Pipeline: Staging → Production

This guide explains how to connect your staging Supabase database to a staging website and promote changes to production.

## Staging as Exact Replica of Production (Prod→Staging Sync)

Staging is kept as an **exact replica of production** for teams, fixtures, market data, and ledgers. User data (profiles, auth) is **never copied** to avoid PII. Changes on staging never affect production.

### What Gets Synced

| Data | Synced from Prod? | Notes |
|------|-------------------|-------|
| teams, fixtures, team_market_data | ✅ Yes | Exact copy |
| total_ledger, transfers_ledger | ✅ Yes | Match results, market state |
| **profiles** | ❌ No | PII – staging uses seed test users only |
| auth.users, auth.identities | ❌ No | PII – staging uses seed test accounts |
| orders, positions, deposits, wallet_transactions, etc. | ❌ No | User-linked; cleared on staging |

### When Sync Runs

- **On every push to `main`** – GitHub Action syncs prod → staging
- **Daily at 02:00 UTC** – Scheduled sync
- **Manually** – Actions → Sync Prod to Staging → Run workflow

### Setup Required

1. **GitHub Secrets** (Settings → Secrets and variables → Actions):

   | Secret | Description |
   |--------|-------------|
   | `PROD_DATABASE_URL` | Direct Postgres URI for **production**. Supabase Dashboard → Production project → Settings → Database → Connection string (URI, **session mode**, not pooler) |
   | `STAGING_DATABASE_URL` | Direct Postgres URI for **staging** branch. Same path in the staging project. |

   Use the **Connection pooler** (Session mode) string—**not** the direct `db.[ref].supabase.co` URL. GitHub Actions cannot reach Supabase's direct DB host (IPv6). In Supabase Dashboard → Settings → Database → Connection string, choose **URI** and **Session** mode; use the pooler host (e.g. `aws-0-[region].pooler.supabase.com`, port 5432).

2. **Staging schema** must match production. If using Supabase branching, ensure the staging branch runs migrations from `main` (e.g. branch from `main` or merge `main` into your staging branch before sync).

### Manual Sync (Optional)

Run locally with Postgres client installed:

```bash
PROD_DATABASE_URL="postgresql://..." STAGING_DATABASE_URL="postgresql://..." ./scripts/sync-prod-to-staging.sh
```

### Test Accounts (Staging Only)

After sync, use these seed accounts (not from production):

- `admin@staging.local` / `TestPassword123!`
- `testuser@staging.local` / `TestPassword123!`

---

## Pipeline Summary

| Step | Action | Result |
|------|--------|--------|
| 1 | Push to `staging` or `fix/*` branch | Netlify branch deploy → staging site → staging DB |
| 2 | Merge to `main` | Netlify production deploy → production site → production DB |
| 3 | PR opened | GitHub Actions runs lint + tests (optional) |

## Local Development

Create a `.env` file in the **project root** (same folder as `package.json`):

```bash
# Copy the example and edit with your values
cp .env.example .env
```

Then edit `.env` and set:

- `VITE_SUPABASE_URL` – your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – anon public key
- `SUPABASE_URL` – same as above (used by scripts)
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (for scripts that need admin access)

Vite loads `.env` automatically when you run `npm run dev`. The `.env` file is gitignored and must not be committed.

### Using Staging Locally

If `.env` has **production** values, you can use a separate file for staging:

1. Copy the staging template and add your staging Supabase credentials:
   ```bash
   cp .env.staging.example .env.staging
   # Edit .env.staging with staging URL and keys from Supabase branch Settings → API
   ```

2. Run against staging:
   ```bash
   npm run dev:staging   # uses .env.staging (staging DB)
   npm run dev           # uses .env (production DB)
   ```

Vite loads `.env.staging` when `--mode staging` is used; those variables override `.env` for Supabase URLs and keys.

### Netlify CLI with Staging

If you use `netlify dev` (to test functions locally), you have two options:

1. **Netlify branch context** (if you’ve set staging env vars in Netlify UI or via `netlify env:set`):
   ```bash
   netlify dev --context branch:staging
   ```

2. **Local `.env.staging`** (loads your local `.env.staging` file):
   ```bash
   npm run dev:netlify:staging
   ```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Git Branches                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  main/production  ──────►  Netlify Production Deploy  ──►  Production Site  │
│       │                           │                            │            │
│       │                    (SUPABASE_URL = prod)         (prod DB)          │
│       │                                                                     │
│  staging / fix/*  ──────►  Netlify Branch Deploy   ──►  Staging Site        │
│       │                           │                            │            │
│       │                    (SUPABASE_URL = staging)      (staging DB)        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Supabase Branching                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Production Project (main)  ───►  https://zuwpcgfgrwvqsbmyfbwj.supabase.co  │
│  Staging Branch             ───►  https://liyiquukzktuyaznhwmq.supabase.co  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Step 1: Get Staging Supabase Credentials

Your staging branch database (`liyiquukzktuyaznhwmq` from the logs) has its own URL and keys:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **main project** → **Branches** (or go to the branch project directly)
3. Open the **staging branch** (e.g. `fix/wallet-migration-clean`)
4. Go to **Settings → API** and copy:
   - **Project URL** (e.g. `https://liyiquukzktuyaznhwmq.supabase.co`)
   - **anon public** key (for frontend)
   - **service_role** key (for Netlify functions – keep secret)

## Step 2: Configure Netlify Branch-Specific Env Vars

Netlify lets you set different env vars per branch. Configure staging so branch deploys use the staging DB.

### Option A: Netlify UI (Recommended)

1. Go to **Netlify Dashboard** → your site → **Site configuration** → **Environment variables**
2. For each variable, add **branch-specific overrides**:
   - **Production (main branch)** – keep your existing production values
   - **Branch deploys** – add a scope for your staging branch name

3. Add/override these for your **staging branch** (e.g. `fix/wallet-migration-clean` or `staging`):

   | Variable | Production Value | Staging Override |
   |----------|------------------|------------------|
   | `VITE_SUPABASE_URL` | `https://zuwpcgfgrwvqsbmyfbwj.supabase.co` | `https://liyiquukzktuyaznhwmq.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | (prod anon key) | (staging anon key) |
   | `SUPABASE_URL` | (same as above) | (staging URL) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (prod service_role) | (staging service_role) |

4. To add a branch override:
   - Click the variable
   - Under "Scopes", add a new scope
   - Choose **Branch** and enter the branch name (e.g. `staging`, `fix/wallet-migration-clean`)
   - Set the staging value

### Option B: Netlify CLI

```bash
# Set staging env vars for a specific branch
netlify env:set VITE_SUPABASE_URL "https://liyiquukzktuyaznhwmq.supabase.co" --context branch:staging
netlify env:set VITE_SUPABASE_ANON_KEY "your-staging-anon-key" --context branch:staging
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-staging-service-role-key" --context branch:staging
```

## Step 3: Deploy and Verify Staging

1. Push to your staging branch (e.g. `fix/wallet-migration-clean` or `staging`):
   ```bash
   git push origin fix/wallet-migration-clean
   ```

2. Netlify builds and deploys a preview for that branch.

3. Check your branch deploy URL (e.g. `https://fix-wallet-migration-clean--your-site.netlify.app`).

4. Confirm:
   - Login with `admin@staging.local` / `TestPassword123!`
   - Data comes from the staging DB (teams, fixtures, seed data)

## Step 4: Promote to Production

When staging looks good:

```bash
# Merge your staging/fix branch into main
git checkout main
git pull origin main
git merge fix/wallet-migration-clean
git push origin main
```

- Netlify deploys `main` with production env vars and production Supabase.
- No extra config is needed; production vars are used automatically.

## Recommended Workflow

```
1. Create feature branch from main
   git checkout -b feat/my-feature

2. Develop, commit, push
   git add . && git commit -m "..." && git push origin feat/my-feature

3. Netlify creates a Deploy Preview (uses production DB by default)
   → For isolated testing, create a Supabase branch from this branch

4. Merge to staging branch (optional)
   git checkout staging && git merge feat/my-feature && git push
   → Staging site uses staging DB

5. When ready for production
   git checkout main && git merge staging && git push
   → Production site uses production DB
```

## Scheduled Functions (update-matches, update-weeklyleaderboard)

Netlify scheduled functions run in the context of the main production deploy. They use production env vars only.

If you want staging-specific schedules (e.g. test leaderboard on staging):

- Option 1: Trigger manually or via a script pointing at staging.
- Option 2: Use a separate Netlify site for staging with its own functions and env vars.

## Quick Reference: Env Vars Used

| Component | Env Vars |
|-----------|----------|
| **Vite (frontend)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Netlify Functions** | `SUPABASE_URL` or `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the browser client. Netlify functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Troubleshooting

- **Staging site still uses production DB**  
  Check that branch-specific env vars are set for the correct branch and that you’re using the right Deploy Preview URL.

- **Build fails on branch deploy**  
  Ensure all required env vars exist for that branch context; Netlify uses branch overrides when defined.

- **Supabase branch URL**  
  Each Supabase branch has its own project ref (in the URL). Use the branch’s URL and keys, not the main project’s.
