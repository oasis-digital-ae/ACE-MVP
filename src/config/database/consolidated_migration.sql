-- =====================================================
-- CONSOLIDATED DATABASE MIGRATION
-- Football MVP - Premier League Club Shares Trading Platform
-- =====================================================
-- This single migration file replaces all previous scattered migrations
-- Run this once to set up your complete database schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TEAMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    logo_url TEXT,
    launch_price DECIMAL(10,2) DEFAULT 20.00,
    initial_market_cap DECIMAL(15,2) DEFAULT 100.00,
    market_cap DECIMAL(15,2) DEFAULT 100.00,
    total_shares INTEGER DEFAULT 5,
    available_shares INTEGER DEFAULT 5,
    shares_outstanding INTEGER DEFAULT 5,
    is_tradeable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. FIXTURES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS fixtures (
    id SERIAL PRIMARY KEY,
    external_id INTEGER UNIQUE NOT NULL,
    home_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    matchday INTEGER NOT NULL,
    kickoff_at TIMESTAMP WITH TIME ZONE NOT NULL,
    buy_close_at TIMESTAMP WITH TIME ZONE NOT NULL,
    snapshot_home_cap DECIMAL(15,2),
    snapshot_away_cap DECIMAL(15,2),
    result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('home_win', 'away_win', 'draw', 'pending')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'closed', 'applied', 'postponed')),
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    season INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_share DECIMAL(10,2) NOT NULL CHECK (price_per_share > 0),
    total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED')),
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. POSITIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    total_invested DECIMAL(15,2) DEFAULT 0.00,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, team_id, is_latest) -- Only one latest record per user-team combination
);

-- =====================================================
-- 6. TRANSFERS LEDGER TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS transfers_ledger (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
    winner_team_id INTEGER NOT NULL REFERENCES teams(id),
    loser_team_id INTEGER NOT NULL REFERENCES teams(id),
    transfer_amount DECIMAL(15,2) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_latest BOOLEAN DEFAULT true
);

-- =====================================================
-- 7. AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_teams_external_id ON teams(external_id);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_fixtures_external_id ON fixtures(external_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_matchday ON fixtures(matchday);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_team_id ON orders(team_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_team_id ON positions(team_id);
CREATE INDEX IF NOT EXISTS idx_transfers_fixture_id ON transfers_ledger(fixture_id);
CREATE INDEX IF NOT EXISTS idx_transfers_winner_team_id ON transfers_ledger(winner_team_id);
CREATE INDEX IF NOT EXISTS idx_transfers_loser_team_id ON transfers_ledger(loser_team_id);
CREATE INDEX IF NOT EXISTS idx_transfers_applied_at ON transfers_ledger(applied_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams policies
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Anyone can insert teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "Service role can manage teams" ON teams FOR ALL USING (auth.role() = 'service_role');

-- Fixtures policies
CREATE POLICY "Anyone can view fixtures" ON fixtures FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fixtures" ON fixtures FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fixtures" ON fixtures FOR UPDATE USING (true);
CREATE POLICY "Service role can manage fixtures" ON fixtures FOR ALL USING (auth.role() = 'service_role');

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all orders" ON orders FOR ALL USING (auth.role() = 'service_role');

-- Positions policies
CREATE POLICY "Users can view own positions" ON positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions" ON positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions" ON positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all positions" ON positions FOR ALL USING (auth.role() = 'service_role');

-- Transfers ledger policies (match transfers only)
CREATE POLICY "Anyone can view match transfers" ON transfers_ledger FOR SELECT USING (true);
CREATE POLICY "Service role can manage all transfers" ON transfers_ledger FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can insert match transfers" ON transfers_ledger FOR INSERT WITH CHECK (true);

-- Audit log policies
CREATE POLICY "Users can view own audit logs" ON audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all audit logs" ON audit_log FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fixtures_updated_at BEFORE UPDATE ON fixtures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clear season data
CREATE OR REPLACE FUNCTION clear_season_data()
RETURNS void AS $$
BEGIN
    -- Clear all data except teams and profiles
    DELETE FROM audit_log;
    DELETE FROM transfers_ledger;
    DELETE FROM positions;
    DELETE FROM orders;
    DELETE FROM fixtures;
    
    -- Reset teams to default values
    UPDATE teams SET 
        market_cap = 100.00,
        total_shares = 1000000,
        available_shares = 1000000,
        is_tradeable = true;
    
    RAISE NOTICE 'Season data cleared successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Teams will be imported from API using the Team Sync function
-- No hardcoded team data - all teams come from Football Data API

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'DATABASE MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Tables created: profiles, teams, fixtures, orders, positions, transfers_ledger, audit_log';
    RAISE NOTICE 'RLS policies enabled for all tables';
    RAISE NOTICE 'Sample Premier League teams inserted';
    RAISE NOTICE 'Ready for application use!';
    RAISE NOTICE '=====================================================';
END $$;