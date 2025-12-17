// Admin service for managing admin panel data
import { supabase } from '../supabase';
import { logger } from '../logger';
import { auditService } from './audit.service';
import type { 
  SystemStats, 
  TeamMarketCapOverview, 
  UserInvestment, 
  TradeHistoryEntry, 
  TradeHistoryFilters,
  TimelineEvent,
  FixtureEvent,
  OrderEvent
} from '@/features/admin/types/admin.types';

export const adminService = {
  /**
   * Check if current user is admin
   */
  async checkAdminStatus(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) {
        logger.error('Error checking admin status:', error);
        return false;
      }

      return profile?.is_admin ?? false;
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  },

  /**
   * Get system statistics for admin dashboard
   */
  async getSystemStats(): Promise<SystemStats> {

    try {
      // Get total cash injected (sum of BUY orders only - SELL orders return cash to users)
      // Fixed Shares Model: Purchases don't change market cap, only available_shares
      const { data: cashData, error: cashError } = await supabase
        .from('orders')
        .select('total_amount, order_type')
        .eq('status', 'FILLED')
        .eq('order_type', 'BUY'); // Only count purchases, not sales

      if (cashError) throw cashError;

      const totalCashInjected = (cashData || []).reduce((sum, order) => sum + order.total_amount, 0);

      // Get total active users (users with positions > 0)
      const { data: usersData, error: usersError } = await supabase
        .from('positions')
        .select('user_id')
        .gt('quantity', 0);

      if (usersError) throw usersError;

      const totalActiveUsers = new Set(usersData?.map(p => p.user_id) || []).size;

      // Get total trades executed (both BUY and SELL orders)
      const { data: tradesData, error: tradesError } = await supabase
        .from('orders')
        .select('total_amount, order_type')
        .eq('status', 'FILLED');

      if (tradesError) throw tradesError;

      const totalTradesExecuted = tradesData?.length || 0;
      // Calculate average trade size from all trades (BUY and SELL)
      const totalTradeVolume = (tradesData || []).reduce((sum, order) => sum + order.total_amount, 0);
      const averageTradeSize = totalTradesExecuted > 0 ? totalTradeVolume / totalTradesExecuted : 0;

      // Get market cap overview by team (Fixed Shares Model)
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          market_cap,
          total_shares,
          available_shares,
          shares_outstanding
        `);

      if (teamsError) throw teamsError;

      // Get total investments per team separately
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('positions')
        .select('team_id, total_invested');

      if (investmentsError) throw investmentsError;

      // Calculate total investments per team
      const teamInvestments = new Map<number, number>();
      (investmentsData || []).forEach(investment => {
        const current = teamInvestments.get(investment.team_id) || 0;
        teamInvestments.set(investment.team_id, current + investment.total_invested);
      });

      const marketCapOverview: TeamMarketCapOverview[] = (teamsData || []).map(team => {
        const totalInvestments = teamInvestments.get(team.id) || 0;
        // Fixed Shares Model: Price = market_cap / total_shares (1000)
        // Market cap only changes on match results, not on purchases/sales
        const totalShares = team.total_shares || 1000;
        const sharePrice = totalShares > 0 ? team.market_cap / totalShares : 0;

        return {
          teamId: team.id,
          teamName: team.name,
          currentMarketCap: team.market_cap,
          totalInvestments,
          sharePrice,
          availableShares: team.available_shares || 1000 // Available shares for purchase (out of 1000 total fixed shares)
        };
      });

      return {
        totalCashInjected,
        totalActiveUsers,
        totalTradesExecuted,
        averageTradeSize,
        marketCapOverview,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching system stats:', error);
      throw error;
    }
  },

  /**
   * Get individual trade records (orders) - includes both BUY and SELL orders
   * Fixed Shares Model: Market cap does NOT change on purchases/sales, only available_shares changes
   */
  async getUserInvestments(): Promise<UserInvestment[]> {

    try {
      // Get all filled orders (both BUY and SELL) with user and team details
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          team_id,
          order_type,
          quantity,
          price_per_share,
          total_amount,
          status,
          executed_at,
          created_at,
          market_cap_before,
          market_cap_after,
          shares_outstanding_before,
          shares_outstanding_after,
          profiles!inner(username, full_name),
          teams!inner(name, market_cap, total_shares, available_shares, shares_outstanding)
        `)
        .eq('status', 'FILLED')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Convert each order to UserInvestment format (one row per trade)
      const userInvestments: UserInvestment[] = (ordersData || []).map(order => {
        // Calculate current value from team data (Fixed Shares Model)
        // Price = market_cap / total_shares (1000 fixed)
        const teamMarketCap = order.teams?.market_cap || 0;
        const teamTotalShares = order.teams?.total_shares || 1000; // Fixed at 1000 shares
        const currentSharePrice = teamTotalShares > 0 ? teamMarketCap / teamTotalShares : 0;
        const currentValue = order.quantity * currentSharePrice;
        // For BUY: profitLoss = currentValue - cost
        // For SELL: profitLoss calculation would need cost basis (not calculated here)
        const profitLoss = order.order_type === 'BUY' 
          ? currentValue - order.total_amount 
          : 0; // SELL profitLoss would need cost basis calculation

        return {
          userId: order.user_id,
          username: order.profiles?.username || 'Unknown',
          fullName: order.profiles?.full_name,
          totalInvested: order.total_amount,
          numberOfTeams: 1, // Each row represents one team purchase
          largestPosition: {
            teamName: order.teams?.name || 'Unknown',
            amount: order.total_amount
          },
          firstInvestmentDate: order.created_at && !isNaN(new Date(order.created_at).getTime()) 
            ? new Date(order.created_at).toISOString() 
            : new Date().toISOString(),
          lastActivityDate: order.created_at && !isNaN(new Date(order.created_at).getTime()) 
            ? new Date(order.created_at).toISOString() 
            : new Date().toISOString(),
          totalPortfolioValue: currentValue,
          profitLoss: profitLoss,
          // Additional fields for individual purchases
          orderId: order.id,
          orderType: order.order_type,
          shares: order.quantity,
          pricePerShare: order.price_per_share,
          teamName: order.teams?.name || 'Unknown',
          executedAt: order.executed_at,
          marketCapBefore: order.market_cap_before,
          marketCapAfter: order.market_cap_after, // In Fixed Shares Model: market_cap_before === market_cap_after for trades
          sharesOutstandingBefore: order.shares_outstanding_before, // This is total_shares (1000) in fixed model
          sharesOutstandingAfter: order.shares_outstanding_after, // This is total_shares (1000) in fixed model
          currentSharePrice: currentSharePrice
        };
      });

      return userInvestments;
    } catch (error) {
      logger.error('Error fetching user investments:', error);
      throw error;
    }
  },

  /**
   * Get trade history with filtering
   */
  async getTradeHistory(filters: TradeHistoryFilters = {}): Promise<TradeHistoryEntry[]> {

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          profiles!inner(username),
          teams!inner(name)
        `);

      // Apply filters
      if (filters.dateRange) {
        query = query
          .gte('executed_at', filters.dateRange.start)
          .lte('executed_at', filters.dateRange.end);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.teamId) {
        query = query.eq('team_id', filters.teamId);
      }

      if (filters.orderType && filters.orderType !== 'ALL') {
        query = query.eq('order_type', filters.orderType);
      }

      if (filters.minAmount) {
        query = query.gte('total_amount', filters.minAmount);
      }

      if (filters.maxAmount) {
        query = query.lte('total_amount', filters.maxAmount);
      }

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query
        .order('executed_at', { ascending: false })
        .limit(1000); // Limit for performance

      if (error) throw error;

      return (data || []).map(order => ({
        ...order,
        username: order.profiles?.username || 'Unknown',
        teamName: order.teams?.name || 'Unknown'
      }));
    } catch (error) {
      logger.error('Error fetching trade history:', error);
      throw error;
    }
  },

  /**
   * Get public orders and fixtures timeline for a team
   */
  async getOrdersAndFixturesTimeline(teamId: number): Promise<TimelineEvent[]> {
    try {
      // Get filled orders for the team
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          executed_at,
          order_type,
          quantity,
          price_per_share,
          total_amount,
          market_cap_before,
          market_cap_after,
          profiles!inner(username),
          teams!inner(name)
        `)
        .eq('team_id', teamId)
        .eq('status', 'FILLED')
        .order('executed_at', { ascending: false })
        .limit(50);

      if (ordersError) throw ordersError;

      // Get fixtures for the team
      const { data: fixturesData, error: fixturesError } = await supabase
        .from('fixtures')
        .select(`
          id,
          kickoff_at,
          home_score,
          away_score,
          result,
          status,
          snapshot_home_cap,
          snapshot_away_cap,
          home_team_id,
          away_team_id,
          home_team:teams!fixtures_home_team_id_fkey(name),
          away_team:teams!fixtures_away_team_id_fkey(name)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'applied')
        .order('kickoff_at', { ascending: false })
        .limit(20);

      if (fixturesError) throw fixturesError;

      // Convert orders to timeline events
      const orderEvents: TimelineEvent[] = (ordersData || []).map(order => ({
        type: 'order' as const,
        timestamp: new Date(order.executed_at),
        data: {
          id: order.id,
          username: order.profiles?.username || 'Unknown',
          teamName: order.teams?.name || 'Unknown',
          orderType: order.order_type as 'BUY' | 'SELL',
          quantity: order.quantity,
          pricePerShare: order.price_per_share,
          totalAmount: order.total_amount,
          marketCapBefore: order.market_cap_before,
          marketCapAfter: order.market_cap_after
        } as OrderEvent
      }));

      // Convert fixtures to timeline events
      const fixtureEvents: TimelineEvent[] = (fixturesData || []).map(fixture => {
        const isHomeTeam = fixture.home_team_id === teamId;
        const marketCapBefore = isHomeTeam ? fixture.snapshot_home_cap : fixture.snapshot_away_cap;
        const marketCapAfter = isHomeTeam ? 
          (fixture.result === 'home_win' ? marketCapBefore * 1.1 : 
           fixture.result === 'away_win' ? marketCapBefore * 0.9 : marketCapBefore) :
          (fixture.result === 'away_win' ? marketCapBefore * 1.1 : 
           fixture.result === 'home_win' ? marketCapBefore * 0.9 : marketCapBefore);

        return {
          type: 'fixture' as const,
          timestamp: new Date(fixture.kickoff_at),
          data: {
            id: fixture.id,
            homeTeam: fixture.home_team?.name || 'Unknown',
            awayTeam: fixture.away_team?.name || 'Unknown',
            homeScore: fixture.home_score,
            awayScore: fixture.away_score,
            result: fixture.result as 'home_win' | 'away_win' | 'draw',
            marketCapBefore,
            marketCapAfter,
            marketCapChange: marketCapAfter - marketCapBefore,
            marketCapChangePercent: ((marketCapAfter - marketCapBefore) / marketCapBefore) * 100
          } as FixtureEvent
        };
      });

      // Combine and sort by timestamp
      const allEvents = [...orderEvents, ...fixtureEvents];
      return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      logger.error('Error fetching timeline events:', error);
      throw error;
    }
  },

  /**
   * Get system activity data for real-time monitoring
   */
  async getSystemActivity(): Promise<{
    recentTrades: number;
    systemStatus: 'normal' | 'high_volume' | 'error';
    lastCheck: string;
    dbResponseTime: number;
    activeUsers: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Get recent trades (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentTrades, error: tradesError } = await supabase
        .from('orders')
        .select('id')
        .gte('created_at', oneHourAgo)
        .eq('status', 'FILLED');

      if (tradesError) {
        logger.error('Error fetching recent trades:', tradesError);
        throw new Error(`Failed to fetch recent trades: ${tradesError.message}`);
      }

      // Get active users
      const { data: activeUsers, error: usersError } = await supabase
        .from('positions')
        .select('user_id')
        .gt('quantity', 0);

      if (usersError) {
        logger.error('Error fetching active users:', usersError);
        throw new Error(`Failed to fetch active users: ${usersError.message}`);
      }

      const dbResponseTime = Date.now() - startTime;
      const uniqueActiveUsers = new Set(activeUsers?.map(p => p.user_id) || []).size;
      const tradeCount = recentTrades?.length || 0;

      return {
        recentTrades: tradeCount,
        systemStatus: tradeCount > 20 ? 'high_volume' : 'normal',
        lastCheck: new Date().toISOString(),
        dbResponseTime,
        activeUsers: uniqueActiveUsers
      };
    } catch (error) {
      logger.error('Error in getSystemActivity:', error);
      throw error;
    }
  },

  /**
   * Log admin action for audit trail
   */
  async logAdminAction(action: string, details: Record<string, any>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No authenticated user for audit logging');
        return;
      }

      // Use the dedicated audit service
      await auditService.logAdminAction(user.id, action, details);
    } catch (error) {
      logger.error('Error logging admin action:', error);
      // Don't throw - audit logging shouldn't break the main flow
    }
  }
};
