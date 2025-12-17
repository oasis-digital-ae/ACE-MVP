# Architecture Overview - Football Trading Platform

## System Overview

A React-based trading platform for Premier League football clubs, built with TypeScript, Vite, and Supabase. Users can buy/sell shares in teams, track their portfolio, and watch market caps update based on real match results.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Marketplace │  │  Portfolio   │  │   Matches   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼─────────────────┼──────────────┘
          │                  │                 │
          └──────────────────┼─────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  AppContext      │
                    │  (State Mgmt)    │
                    └────────┬─────────┘
                             │
          ┌───────────────────┼───────────────────┐
          │                   │                    │
    ┌─────▼──────┐      ┌─────▼──────┐      ┌─────▼──────┐
    │   Teams    │      │  Orders    │      │ Positions │
    │  Service   │      │  Service   │      │  Service  │
    └─────┬──────┘      └─────┬───────┘      └─────┬──────┘
          │                   │                    │
          └───────────────────┼───────────────────┘
                              │
                      ┌───────▼────────┐
                      │ Supabase Client │
                      └───────┬────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼──────┐      ┌─────▼──────┐      ┌─────▼──────┐
    │ PostgreSQL │      │   Auth     │      │  Realtime   │
    │ Database   │      │ (Supabase)│      │Subscriptions│
    └─────┬──────┘      └────────────┘      └─────┬──────┘
          │                                        │
          └────────────────────────────────────────┘
                              │
                      ┌───────▼────────┐
                      │  DB Triggers   │
                      │ (Market Cap    │
                      │  Updates)      │
                      └───────┬────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼──────┐      ┌─────▼──────┐      ┌─────▼──────┐
    │  Netlify    │      │ Football   │      │Backend Jobs│
    │  Cron Job   │      │ Data API   │      │            │
    └─────┬──────┘      └─────┬───────┘      └─────┬──────┘
          │                   │                    │
          └───────────────────┼─────────────────────┘
```

---

## User Flow

### 1. Authentication Flow
```
User → AuthPage → Supabase Auth → User Session → AppContext → Dashboard
```

**Steps:**
1. User visits platform
2. If not authenticated → shown AuthPage (login/signup)
3. Supabase Auth handles authentication
4. User session stored in AuthContext
5. Authenticated users see trading dashboard

### 2. Trading Flow (Share Purchase)
```
User clicks Buy → Purchase Modal → Validate Input → 
Create Order → Decrease Available Shares → Update Position → Refresh UI
```

**Detailed steps:**
1. User browses marketplace (`/marketplace`)
2. Clicks "Buy" on a team
3. Modal opens with price, buy window status, available shares
4. User enters shares (validated against available_shares)
5. Order created in database (via atomic transaction)
6. Available shares decreases (platform inventory)
7. Market cap stays unchanged (no cash injection)
8. User position updated
9. Portfolio refreshes automatically
10. Success message shown

### 3. Market Update Flow (Match Result Processing)
```
Match Ends → Cron Job (30 min) → Fetch Data from Football API → 
Update Fixture → Trigger DB Function → Update Market Caps → 
Real-time Update → UI Refresh
```

**Step-by-step:**
1. Netlify cron job runs every 30 minutes
2. Checks for matches needing updates (upcoming in 48hrs)
3. Fetches live data from Football Data API
4. Updates fixture with scores, status
5. Database trigger fires on fixture update
6. Match result function processes market cap transfers
7. Winner gains market cap, loser loses
8. Total ledger records the change
9. Real-time subscriptions notify all clients
10. UI updates automatically for all users

---

## Data Flow

### Market Cap Calculation (Fixed Shares Model)
```
Initial Market Cap ($20,000) → Match Results (transfer) → 
Market Cap = Previous Cap + Transfers From Matches

Note: Purchases do NOT change market cap (no cash injection)
```

### Share Price Calculation (Fixed Shares Model)
```
Share Price = Market Cap / Total Shares (1000)

Price increases when:
- Team wins matches (gain market cap)

Price decreases when:
- Team loses matches (loses market cap)

Note: Purchases do NOT change price (market cap unchanged, total_shares fixed)
```

### Platform Inventory
```
Available Shares = Total Shares (1000) - User Holdings

- Platform owns all shares initially (1000 per team)
- Purchases decrease available_shares
- No minting capability (fixed supply)
```

### Real-time Updates
```
Supabase Realtime → AppContext → React State → Components re-render
```

Subscriptions active for:
- Team market caps (real-time share prices)
- User positions (portfolio updates)
- New orders (trade feed)
- Match results (live scores)

---

## Key Components

### Frontend (React)
- **AppContext**: Global state for teams, portfolio, matches
- **AuthContext**: User authentication and session
- **ClubValuesPage**: Marketplace view
- **PortfolioPage**: User investments
- **MatchResultsPage**: Match history and market impact
- **TeamDetailsSlideDown**: Detailed team view with chart

### Backend (Supabase)
- **PostgreSQL**: Teams, fixtures, orders, positions, ledger
- **Functions**: Atomic transactions, match processing
- **Triggers**: Automatic market cap updates
- **RLS**: Row-level security for data access
- **Realtime**: Live subscriptions for UI updates

### Infrastructure
- **Netlify**: Hosting + cron jobs for background tasks
- **Football Data API**: Match data source
- **Supabase Edge Functions**: Serverless functions

---

## Security Architecture

### Authentication
- Supabase Auth handles all user authentication
- Session tokens managed server-side
- Email verification required

### Authorization
- Row-Level Security (RLS) policies on all tables
- Users can only access their own data
- Admins have elevated permissions

### Data Protection
- HTTPS enforced (TLS/SSL)
- Input sanitization on all user inputs
- SQL injection protection via Supabase
- XSS protection via React

---

## Performance Considerations

### Code Splitting
- Heavy components lazy-loaded
- Route-based code splitting
- Dynamic imports for large dependencies

### Caching
- API responses cached via `football-api-cache`
- localStorage for team details
- React Query for data caching

### Database Optimization
- Indexed columns for fast queries
- Batch operations to reduce roundtrips
- Connection pooling via Supabase

---

## Monitoring & Observability

### Logging
- Client-side: Browser console + logger service
- Server-side: Supabase logs
- Background jobs: Netlify function logs

### Error Tracking
- Error boundaries on all pages
- Graceful error handling
- User-friendly error messages

### Analytics
- Page view tracking
- User action tracking
- Performance metrics

---

## Deployment Flow

1. **Development**: Local development server
2. **Build**: Vite builds optimized production bundle
3. **Deploy**: Netlify automatically deploys on git push
4. **Environment**: Environment variables configured
5. **Database**: Migrations run automatically via Supabase
6. **Monitoring**: Logs and monitoring active

---

## Future Enhancements

- [ ] Payment processing (Stripe integration)
- [ ] Sell shares functionality
- [ ] Advanced portfolio analytics
- [ ] Social features (follow other traders)
- [ ] Mobile app (React Native)
- [ ] Real-time chat support
- [ ] Advanced charting tools
- [ ] Match predictions betting
