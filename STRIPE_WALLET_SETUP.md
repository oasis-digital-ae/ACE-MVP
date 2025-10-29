# Stripe Wallet Setup Guide

This guide walks you through setting up the Stripe wallet integration and testing it locally.

## Step 1: Run Database Migrations

You need to apply 3 new migration files to your Supabase database:

### Option A: Using Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**
   - Visit [supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run each migration in order:**

   **Migration 1: Wallet Balance and Deposits**
   - Open `supabase/migrations/20251029121000_wallet_balance_and_deposits.sql`
   - Copy the entire file content
   - Paste into SQL Editor
   - Click "Run" (or press Ctrl+Enter)

   **Migration 2: Wallet Transactions and Credit RPC**
   - Open `supabase/migrations/20251029121500_wallet_transactions_and_credit_rpc.sql`
   - Copy the entire file content
   - Paste into SQL Editor
   - Click "Run"

   **Migration 3: Update Purchase Function with Wallet Check**
   - Open `supabase/migrations/20251029122000_add_wallet_check_to_purchase.sql`
   - Copy the entire file content
   - Paste into SQL Editor
   - Click "Run"

   **Migration 4: Fix Total Ledger Descriptions (from earlier)**
   - Open `supabase/migrations/20251029114000_fix_total_ledger_descriptions.sql`
   - Copy the entire file content
   - Paste into SQL Editor
   - Click "Run"

4. **Verify migrations worked:**
   ```sql
   -- Check if wallet_balance column exists
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'wallet_balance';
   
   -- Check if credit_wallet function exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'credit_wallet';
   ```

### Option B: Using Supabase CLI (If you have it set up)

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

---

## Step 2: Verify Environment Variables

Make sure these are set in **both** your local `.env` file and Netlify:

### Local `.env` file:

```env
# Stripe (Client-side)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SKMf2GzkZpB3x9eRgcGphPea6TGU0aXkQtGu8TlEhJfFKOeKldiMzKu9hh3ZivVVTv5LDLYAawMbSFKRjSZ8GDZ00WTA4bKrY

# Stripe (Server-side - for Netlify Functions)
STRIPE_SECRET_KEY=sk_test_51SKMf2GzkZpB3x9e4EjL95j95GnrKUxRgmUZ9T40TGOmofxgnlxhhxXT1IWg0UaMICMv6FvZUSg8ZV8irDMbd3wA001i5pjhPW
STRIPE_WEBHOOK_SECRET=whsec_...  # You'll get this in Step 3

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Site URL (for return URLs)
SITE_URL=http://localhost:8888  # For local dev
```

### In Netlify Dashboard:
- Go to: Site Settings → Environment variables
- Add all the above variables (use `https://ace-mvp.netlify.app` for `SITE_URL` in production)

---

## Step 3: Set Up Stripe Webhook (Local Testing)

### A. Install Stripe CLI (if not already installed)

**Windows (using Scoop or Chocolatey):**
```bash
# Using Scoop
scoop install stripe

# Using Chocolatey
choco install stripe
```

**Or download manually:**
- Visit: https://stripe.com/docs/stripe-cli
- Download the Windows binary
- Add to PATH

**Verify installation:**
```bash
stripe --version
```

### B. Login to Stripe CLI

```bash
stripe login
```
This will open a browser to authenticate with your Stripe account.

### C. Forward Webhooks Locally

```bash
stripe listen --forward-to http://localhost:8888/.netlify/functions/stripe-webhook
```

**Important:** This command will:
- Output a webhook signing secret that looks like `whsec_...`
- Forward all Stripe events to your local function
- Keep running until you stop it (Ctrl+C)

**Copy the `whsec_...` secret** and add it to your `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...the_secret_from_stripe_cli
```

### D. Test Webhook Forwarding

In another terminal, trigger a test event:
```bash
stripe trigger payment_intent.succeeded
```

You should see the event in the `stripe listen` terminal.

---

## Step 4: Test Locally

### 1. Start Local Development

```bash
# Start Netlify Dev (handles both frontend and functions)
netlify dev

# Or if you prefer Vite directly:
npm run dev
```

**Note:** If using `netlify dev`, it will:
- Start your Vite frontend on `http://localhost:8888`
- Expose Netlify Functions at `/.netlify/functions/`
- Load environment variables from `.env`

### 2. Test Deposit Flow

1. **Open the app** in your browser: `http://localhost:8888`
2. **Login** to your account
3. **Click "Deposit"** button in the navigation bar
4. **Enter an amount** (minimum $10)
5. **Click "Continue to Payment"**
6. **Use Stripe test card:**
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)
7. **Complete payment**
8. **Check your wallet balance** - it should update (may take 1-2 seconds for webhook)

### 3. Test Purchase Flow

1. **Navigate to Marketplace**
2. **Click "Buy" on any team**
3. **Check balance** - if insufficient, you'll see a warning
4. **Enter share quantity**
5. **Click "Confirm Purchase"**
6. **Verify**:
   - Order created
   - Wallet balance deducted
   - Shares added to portfolio

---

## Step 5: Set Up Production Webhook

### A. Create Webhook in Stripe Dashboard

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/test/webhooks
2. **Click "Add endpoint"**
3. **Enter endpoint URL**:
   ```
   https://ace-mvp.netlify.app/.netlify/functions/stripe-webhook
   ```
4. **Select events to listen to:**
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed` (optional)
   - `charge.refunded` (optional)
   - `charge.dispute.created` (optional)
5. **Click "Add endpoint"**

### B. Copy Webhook Secret

1. **Click on the newly created webhook**
2. **Click "Reveal" next to "Signing secret"**
3. **Copy the secret** (starts with `whsec_`)
4. **Add to Netlify Environment Variables**:
   - Go to Netlify Dashboard → Site Settings → Environment variables
   - Add: `STRIPE_WEBHOOK_SECRET` = `whsec_...`
5. **Redeploy your site** (or trigger a new deploy)

### C. Test Production Webhook

1. **Make a test deposit** on your production site
2. **Use test card** `4242 4242 4242 4242`
3. **Check Stripe Dashboard** → Webhooks → Your endpoint → "Events"
4. **Verify** events are being received and processed

---

## Step 6: Verify Everything Works

### Database Checks

Run these in Supabase SQL Editor:

```sql
-- Check wallet balance column
SELECT id, username, wallet_balance FROM profiles LIMIT 5;

-- Check wallet transactions
SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 5;

-- Check stripe events
SELECT * FROM stripe_events ORDER BY created_at DESC LIMIT 5;
```

### Functional Checks

1. ✅ **Deposit works** - Can add funds via Stripe
2. ✅ **Balance displays** - Shows in navigation bar
3. ✅ **Purchase checks balance** - Blocks if insufficient
4. ✅ **Balance deducts** - Decreases after purchase
5. ✅ **Webhook credits** - Balance increases after successful payment

---

## Troubleshooting

### Issue: "Insufficient balance" even after deposit

**Solution:**
- Check webhook is working: Stripe Dashboard → Webhooks → Events
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Check Supabase logs for errors in `credit_wallet` function

### Issue: Functions returning 500 errors

**Solution:**
- Check Netlify Functions logs: `netlify functions:log`
- Verify all environment variables are set
- Check Stripe keys are correct (test vs live)

### Issue: Webhook not receiving events

**Solution:**
- Verify webhook URL is correct
- Check webhook secret matches
- Ensure endpoint returns 200 status
- Check Stripe Dashboard → Webhooks → Events for delivery status

---

## Next Steps

Once everything is working:
1. ✅ Test with real payment flows
2. ✅ Monitor webhook delivery in Stripe Dashboard
3. ✅ Set up error alerts for failed webhooks
4. ✅ Test edge cases (refunds, disputes, etc.)

---

## Need Help?

- Check Netlify Functions logs: `netlify functions:log`
- Check Supabase logs: Dashboard → Logs
- Check Stripe Dashboard → Webhooks → Events for delivery issues
- Verify all environment variables are set correctly

