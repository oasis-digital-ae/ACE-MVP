# Weekly Leaderboard Integration - Summary

## ✅ Changes Made

### 1. New Centralized Calculation Module
**File**: `src/shared/lib/utils/leaderboard-calculations.ts`

- All weekly leaderboard calculations in one place
- Uses `Decimal.js` for precision (same as rest of app)
- Functions:
  - `calculateWeeklyReturn()` - ROI formula with deposit adjustment
  - `calculateAccountValue()` - Wallet + Portfolio
  - `calculateLeaderboard()` - Full ranking logic
  - `toLeaderboardDbFormat()` / `fromLeaderboardDbFormat()` - DB conversion
  - `validateLeaderboardEntries()` - Data validation

### 2. Updated Netlify Function
**File**: `netlify/functions/update-weeklyleaderboard.ts`

- ✅ Now uses centralized TypeScript calculations
- ✅ Fetches data directly from database tables
- ✅ No longer uses SQL RPC function `generate_weekly_leaderboard_exact_v2`
- ✅ Guaranteed to match frontend calculations

### 3. Updated Backfill Script
**File**: `scripts/calculate-weekly-leaderboard.ts`

- ✅ Uses same centralized calculations as Netlify function
- ✅ Perfect consistency with automated weekly runs

### 4. Enhanced Decimal Utilities
**File**: `src/shared/lib/utils/decimal.ts`

- Added `fromCentsToNumber()` helper for convenient cent-to-dollar conversion

### 5. Comprehensive Documentation
**Files**: 
- `docs/LEADERBOARD_CALCULATION_SYNC.md` - Full technical documentation
- `docs/LEADERBOARD_INTEGRATION_SUMMARY.md` - This file

## 🎯 Benefits

| Before | After |
|--------|-------|
| SQL calculations in backend | TypeScript calculations everywhere |
| Different rounding behavior | Consistent Decimal.js precision |
| Discrepancies between frontend/backend | Perfect synchronization |
| Hard to test SQL logic | Easy to test TypeScript functions |
| Two places to maintain | One source of truth |

## 📊 Weekly Return Formula

```typescript
Weekly Return = (End Account - Start Account - Deposits) / (Start Account + Deposits)
```

**Why adjust for deposits?**
- Without adjustment: Depositing $50 into $100 would show 50% return ❌
- With adjustment: Only actual trading gains/losses count ✅

## 🗄️ Database Format

All monetary values stored as **bigint (cents)**:
- $147.26 → stored as `14726`
- Convert: `toCents(dollars)` before saving, `fromCentsToNumber(cents)` after loading

Weekly return stored as **numeric(10, 6) (decimal fraction)**:
- 5.23% → stored as `0.052300`
- Display: Multiply by 100 for percentage

## 🚀 Usage

### For Developers

**Import centralized calculations**:
```typescript
import {
  calculateWeeklyReturn,
  calculateLeaderboard,
  toLeaderboardDbFormat,
  fromLeaderboardDbFormat
} from '@/shared/lib/utils/leaderboard-calculations';
```

**Calculate return**:
```typescript
const weeklyReturn = calculateWeeklyReturn(
  startAccountValue,  // e.g., 100.00
  endAccountValue,    // e.g., 110.50
  depositsWeek        // e.g., 50.00
);
// Returns: 0.0700 (7.00%)
```

**Display percentage**:
```typescript
const percentage = weeklyReturn * 100;  // 7.00
const formatted = `${percentage.toFixed(2)}%`;  // "7.00%"
```

### For Operations

**Manual leaderboard generation**:
```bash
# Test locally
npx tsx scripts/calculate-weekly-leaderboard.ts --weeks 1

# Backfill last 4 weeks
npx tsx scripts/calculate-weekly-leaderboard.ts --weeks 4
```

**Trigger Netlify function manually**:
```bash
curl -X POST https://ace-mvp.netlify.app/.netlify/functions/update-weeklyleaderboard \
  -H "x-manual-run: true"
```

## ✅ Verification Checklist

After deploying:

- [ ] Weekly leaderboard cron runs successfully (Monday 03:00 UAE)
- [ ] Calculated values match frontend portfolio calculations
- [ ] No validation errors in function logs
- [ ] Rankings make sense (highest return = rank 1)
- [ ] Database values stored correctly (check cents conversion)
- [ ] Historical leaderboards remain unchanged
- [ ] Frontend displays percentages correctly

## 🐛 Troubleshooting

### Leaderboard not generating

1. Check Netlify function logs
2. Verify environment variables are set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
3. Run backfill script locally to test

### Values don't match portfolio

- Leaderboard uses **historical snapshots** at week boundaries
- Portfolio shows **current** values
- This is expected behavior

### Negative returns after deposits

- Check deposit amounts are recorded correctly in `wallet_transactions`
- Verify formula accounts for deposits: `(end - start - deposits) / (start + deposits)`

## 📝 Key Files

| File | Purpose |
|------|---------|
| `src/shared/lib/utils/leaderboard-calculations.ts` | Core calculation logic |
| `netlify/functions/update-weeklyleaderboard.ts` | Automated weekly generation |
| `scripts/calculate-weekly-leaderboard.ts` | Manual backfill tool |
| `src/features/leaderboard/components/LeaderboardPage.tsx` | Frontend display |
| `docs/LEADERBOARD_CALCULATION_SYNC.md` | Full documentation |

## 🎓 Next Steps

1. Deploy changes to production
2. Monitor first automated run (Monday 03:00 UAE)
3. Verify calculations match expected values
4. Update any team documentation

---

**Questions?** Check the full documentation in `docs/LEADERBOARD_CALCULATION_SYNC.md`
