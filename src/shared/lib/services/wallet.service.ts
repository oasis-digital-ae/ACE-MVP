import { supabase } from '@/shared/lib/supabase';
import { fromCents } from '@/shared/lib/utils/decimal';

export interface WalletBalance {
  balance: number;
  user_id: string;
}

export const walletService = {
  async getBalance(userId: string): Promise<number> {
    // Check profiles table first (common pattern)
    // Database stores wallet_balance as BIGINT (cents), convert to dollars
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .maybeSingle();

    if (!profileError && profile?.wallet_balance !== null && profile?.wallet_balance !== undefined) {
      return fromCents(profile.wallet_balance).toNumber();
    }

    // Fallback to users table if profiles doesn't have wallet_balance
    const { data: user } = await supabase.auth.getUser();
    if (user?.user?.id === userId) {
      // Note: Users table might not have wallet_balance, but profiles should
      return 0;
    }

    return 0;
  },
  async getWalletTransactions(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getTotalDeposits(userId: string): Promise<number> {
    // Get total deposits for a user (sum of all deposit transactions)
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('amount_cents')
      .eq('user_id', userId)
      .eq('type', 'deposit');

    if (error) {
      throw error;
    }

    // Sum up all deposits and convert from cents to dollars
    const total = (data || []).reduce((sum, tx) => sum + fromCents(tx.amount_cents || 0).toNumber(), 0);
    return total;
  },

  /**
   * Get net credit (loans minus reversals) for a user.
   * Credit is a liability; positive = user owes this to the platform.
   */
  async getTotalCredit(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('amount_cents, type')
      .eq('user_id', userId)
      .in('type', ['credit_loan', 'credit_loan_reversal']);

    if (error) throw error;

    let totalCents = 0;
    (data || []).forEach(tx => {
      const amt = tx.amount_cents || 0;
      totalCents += tx.type === 'credit_loan' ? amt : -amt;
    });
    return fromCents(Math.max(0, totalCents)).toNumber();
  },
};

