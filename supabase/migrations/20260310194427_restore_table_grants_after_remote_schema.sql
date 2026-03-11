-- Restore table grants revoked by 20260307035027_remote_schema.sql
-- That migration (from db pull) revokes all grants but RLS requires table-level access.
-- Without these grants, "permission denied for table X" (42501) occurs for authenticated users.
-- Supabase convention: grant to anon/authenticated/service_role; RLS policies filter rows.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deposits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deposits TO authenticated;
GRANT ALL ON TABLE public.deposits TO service_role;

GRANT SELECT ON TABLE public.teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;

GRANT SELECT ON TABLE public.fixtures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fixtures TO authenticated;
GRANT ALL ON TABLE public.fixtures TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.positions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.positions TO authenticated;
GRANT ALL ON TABLE public.positions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet_transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet_transactions TO authenticated;
GRANT ALL ON TABLE public.wallet_transactions TO service_role;

GRANT SELECT ON TABLE public.team_market_data TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_market_data TO authenticated;
GRANT ALL ON TABLE public.team_market_data TO service_role;

GRANT SELECT ON TABLE public.weekly_leaderboard TO anon;
GRANT SELECT ON TABLE public.weekly_leaderboard TO authenticated;
GRANT ALL ON TABLE public.weekly_leaderboard TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.total_ledger TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.total_ledger TO authenticated;
GRANT ALL ON TABLE public.total_ledger TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transfers_ledger TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transfers_ledger TO authenticated;
GRANT ALL ON TABLE public.transfers_ledger TO service_role;
