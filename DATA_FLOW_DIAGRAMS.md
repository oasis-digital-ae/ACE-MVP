# Data Flow Diagrams - Football Trading Platform

## 1. Share Purchase Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Modal
    participant AppContext
    participant OrdersService
    participant Supabase
    participant DB
    participant Trigger
    participant Realtime
    participant OtherUsers
    
    User->>UI: Click "Buy" button
    UI->>Modal: Open PurchaseConfirmationModal
    Modal->>UI: Show buy window status
    Modal->>User: Enter share quantity
    User->>Modal: Click "Confirm"
    
    Modal->>AppContext: purchaseClub(clubId, units)
    AppContext->>OrdersService: ordersService.create()
    
    OrdersService->>Supabase: INSERT into orders
    Supabase->>DB: Begin transaction
    DB->>Trigger: process_share_purchase_atomic()
    
    Trigger->>DB: Lock team row (SELECT ... FOR UPDATE)
    Trigger->>DB: Read current market_cap
    Trigger->>DB: Calculate new_market_cap = old + (quantity * price)
    Trigger->>DB: UPDATE teams SET market_cap = new_market_cap
    Trigger->>DB: UPDATE teams SET shares_outstanding += quantity
    Trigger->>DB: INSERT into orders
    Trigger->>DB: UPDATE/INSERT positions
    Trigger->>DB: INSERT into total_ledger
    Trigger->>DB: INSERT into audit_log
    Trigger->>DB: Commit transaction
    
    DB-->>Supabase: Transaction successful
    Supabase-->>OrdersService: Return order data
    OrdersService-->>AppContext: Order created
    
    AppContext->>Supabase: Refresh teams data
    AppContext->>AppContext: Update local state
    AppContext-->>UI: Update marketplace
    
    DB->>Realtime: Publish market_update event
    Realtime->>OtherUsers: Push update to all subscribers
    OtherUsers->>OtherUsers: Update UI automatically
```

**Key Points:**
- Atomic transaction ensures data consistency
- Market cap updated immediately
- Real-time update to all users
- Audit log records every transaction

---

## 2. Match Result Processing Flow

```mermaid
sequenceDiagram
    participant Cron
    participant UpdateMatches
    participant FootballAPI
    participant Supabase
    participant FixturesTable
    participant Trigger
    participant MatchFunction
    participant TeamsTable
    participant TotalLedger
    participant Realtime
    participant Frontend
    
    Cron->>UpdateMatches: Run every 30 min
    UpdateMatches->>Supabase: Query fixtures (next 48hrs)
    Supabase->>FixturesTable: SELECT fixtures
    FixturesTable-->>UpdateMatches: Return fixtures
    
    UpdateMatches->>FootballAPI: GET match/{id}
    FootballAPI-->>UpdateMatches: Match data (scores, status)
    
    UpdateMatches->>Supabase: UPDATE fixture
    Supabase->>FixturesTable: UPDATE status, scores
    
    FixturesTable->>Trigger: on_fixture_update
    Trigger->>MatchFunction: process_match_result(fixture_id)
    
    MatchFunction->>TeamsTable: Read home/away team data
    MatchFunction->>MatchFunction: Calculate transfer amount
    
    alt Home Win
        MatchFunction->>TeamsTable: home_team.market_cap += transfer
        MatchFunction->>TeamsTable: away_team.market_cap -= transfer
    else Away Win
        MatchFunction->>TeamsTable: away_team.market_cap += transfer
        MatchFunction->>TeamsTable: home_team.market_cap -= transfer
    else Draw
        MatchFunction->>MatchFunction: No transfer
    end
    
    MatchFunction->>TotalLedger: INSERT for home team
    MatchFunction->>TotalLedger: INSERT for away team
    MatchFunction->>FixturesTable: UPDATE status = 'applied'
    
    MatchFunction-->>Trigger: Complete
    Trigger-->>Supabase: Success
    
    TeamsTable->>Realtime: Publish update event
    Realtime->>Frontend: Push market cap changes
    Frontend->>Frontend: Re-render components
```

**Transfer Calculation:**
```sql
transfer_amount = loser.market_cap * 0.10

Winner.market_cap += transfer_amount
Loser.market_cap -= transfer_amount
```

---

## 3. Real-time Market Update Flow

```mermaid
sequenceDiagram
    participant DB
    participant Trigger
    participant Realtime
    participant Subscription1
    participant Subscription2
    participant Subscription3
    
    DB->>Trigger: Market cap changed (INSERT/UPDATE)
    Trigger->>Realtime: Publish event
    Realtime->>Realtime: Channel.broadcast()
    
    Realtime->>Subscription1: Push update (User 1)
    Realtime->>Subscription2: Push update (User 2)
    Realtime->>Subscription3: Push update (User 3)
    
    Subscription1->>Subscription1: Update state
    Subscription2->>Subscription2: Update state
    Subscription3->>Subscription3: Update state
```

**Subscribed Channels:**
- `market-updates` - Team market cap changes
- `new-orders` - New trades executed
- `position-updates` - User position changes
- `fixture-updates` - Match status changes

---

## 4. Portfolio Calculation Flow

```mermaid
sequenceDiagram
    participant User
    participant PortfolioPage
    participant PositionsService
    participant TeamsService
    participant AppContext
    participant Calculations
    
    User->>PortfolioPage: Navigate to /portfolio
    PortfolioPage->>PositionsService: Get user positions
    PositionsService->>PositionsService: Query positions table
    
    PortfolioPage->>TeamsService: Get all teams
    TeamsService->>TeamsService: Query teams table
    
    PositionsService-->>PortfolioPage: Return positions
    TeamsService-->>PortfolioPage: Return teams
    
    PortfolioPage->>Calculations: For each position
    
    Calculations->>Calculations: currentPrice = team.market_cap / team.shares_outstanding
    Calculations->>Calculations: avgCost = position.total_invested / position.quantity
    Calculations->>Calculations: totalValue = currentPrice * position.quantity
    Calculations->>Calculations: profitLoss = (currentPrice - avgCost) * position.quantity
    
    Calculations-->>PortfolioPage: Portfolio data
    PortfolioPage->>AppContext: Update portfolio state
    AppContext-->>PortfolioPage: Render components
```

**Calculation Logic:**
```typescript
interface PortfolioItem {
  clubId: string;
  clubName: string;
  units: number;
  purchasePrice: number; // average cost
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  percentChange: number;
}
```

---

## 5. Snapshot Capture Flow

```mermaid
sequenceDiagram
    participant Cron
    participant MatchService
    participant FixturesQuery
    participant TeamsQuery
    participant FixturesUpdate
    
    Cron->>MatchService: Run every 30 min
    MatchService->>FixturesQuery: Get upcoming matches (next 48hrs)
    FixturesQuery-->>MatchService: Fixtures list
    
    MatchService->>MatchService: For each fixture
    
    MatchService->>MatchService: Check if in 30-min window
    
    alt In 30-min window
        MatchService->>TeamsQuery: Get home_team.market_cap
        MatchService->>TeamsQuery: Get away_team.market_cap
        
        TeamsQuery-->>MatchService: home_cap, away_cap
        
        MatchService->>FixturesUpdate: UPDATE snapshot_home_cap, snapshot_away_cap
        MatchService->>FixturesUpdate: UPDATE status = 'closed'
        
        FixturesUpdate->>FixturesUpdate: Commit changes
    end
    
    MatchService->>MatchService: Continue to next fixture
```

**Purpose:**
- Capture market cap at 30 min before kickoff
- Prevent trading during match
- Use snapshots to calculate fair market cap transfers

---

## 6. Initial Data Load Flow

```mermaid
sequenceDiagram
    participant User
    participant AuthContext
    participant AppContext
    participant TeamsService
    participant PositionsService
    participant FixturesService
    participant OrdersService
    participant Database
    
    User->>AuthContext: Load page
    AuthContext->>AuthContext: Check session
    
    alt Not authenticated
        AuthContext->>User: Show AuthPage
    else Authenticated
        AuthContext->>AppContext: Initialize
        
        AppContext->>TeamsService: GetAll teams
        AppContext->>PositionsService: GetUser positions
        AppContext->>FixturesService: GetRecent fixtures
        AppContext->>OrdersService: GetUser orders
        
        TeamsService->>Database: SELECT from teams
        PositionsService->>Database: SELECT from positions WHERE user_id
        FixturesService->>Database: SELECT from fixtures ORDER BY kickoff_at DESC LIMIT 20
        OrdersService->>Database: SELECT from orders WHERE user_id
        
        Database-->>TeamsService: Teams data
        Database-->>PositionsService: Positions data
        Database-->>FixturesService: Fixtures data
        Database-->>OrdersService: Orders data
        
        TeamsService-->>AppContext: Clubs array
        PositionsService-->>AppContext: Portfolio array
        FixturesService-->>AppContext: Matches array
        OrdersService-->>AppContext: Transactions array
        
        AppContext->>AppContext: Update state
        AppContext->>User: Render dashboard
    end
```

**Parallel Queries:**
All services fetch data concurrently using `Promise.all()` for faster initial load.

---

## 7. Market Cap Update from Order

```mermaid
flowchart TD
    A[User clicks Buy] --> B[Modal opens]
    B --> C[User enters shares]
    C --> D[Calculate total value]
    D --> E{Validate input}
    E -->|Invalid| F[Show error]
    E -->|Valid| G[Create order]
    G --> H[process_share_purchase_atomic]
    H --> I[Lock team row]
    I --> J[Read current market_cap]
    J --> K[Calculate new market_cap]
    K --> L[UPDATE teams.market_cap]
    L --> M[UPDATE teams.shares_outstanding]
    M --> N[INSERT into orders]
    N --> O[UPDATE positions]
    O --> P[INSERT into total_ledger]
    P --> Q[Commit transaction]
    Q --> R[Return success]
    R --> S[Update UI]
    S --> T[Show success message]
    T --> U[Close modal]
    
    L --> V[Trigger real-time update]
    V --> W[All users see new share price]
```

---

## Key Data Relationships

### One-to-Many Relationships
```
teams (1) → fixtures (many)
teams (1) → orders (many)
teams (1) → positions (many)
users (1) → orders (many)
users (1) → positions (many)
fixtures (1) → total_ledger (many)
```

### Join Queries
```sql
-- Get fixture with team names
SELECT f.*, h.name as home_team, a.name as away_team
FROM fixtures f
JOIN teams h ON f.home_team_id = h.id
JOIN teams a ON f.away_team_id = a.id;

-- Get positions with team data
SELECT p.*, t.name as team_name, t.market_cap
FROM positions p
JOIN teams t ON p.team_id = t.id
WHERE p.user_id = $1;
```

---

## Error Handling Flow

```mermaid
flowchart TD
    A[User action] --> B[Service call]
    B --> C{API call}
    C -->|Success| D[Update state]
    C -->|Error| E{Error type}
    E -->|Network error| F[Show retry button]
    E -->|Validation error| G[Show error message]
    E -->|Database error| H[Log error]
    H --> I[Show generic error]
    
    F --> J[User retries]
    J --> C
    
    D --> K[Update UI]
    K --> L[Show success message]
```

---

## Performance Flow

1. **Code Splitting**: Heavy components loaded lazily
2. **Memoization**: Expensive calculations cached with useMemo
3. **Batch Updates**: Multiple state updates batched
4. **Debouncing**: Rapid inputs debounced
5. **Pagination**: Large lists paginated
6. **Virtual Scrolling**: Long lists rendered efficiently
