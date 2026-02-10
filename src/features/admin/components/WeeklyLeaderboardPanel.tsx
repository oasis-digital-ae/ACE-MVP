import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ArrowUp, ArrowDown, ArrowUpDown, Trophy } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { formatCurrency } from '@/shared/lib/formatters';
import { useToast } from '@/shared/hooks/use-toast';

interface WeekOption {
  id: string;
  weekStart: string;
  weekEnd: string;
  label: string;
}

interface AdminLeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  startWalletValue: number;
  startPortfolioValue: number;
  startAccountValue: number;
  endWalletValue: number;
  endPortfolioValue: number;
  endAccountValue: number;
  totalDeposits: number;
  weeklyReturn: number;
}

export const AdminWeeklyLeaderboardPanel: React.FC = () => {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeekOption | null>(null);
  const [data, setData] = useState<AdminLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'rank' | 'username' | 'weeklyReturn'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  /* -------------------- LOAD WEEKS -------------------- */
  useEffect(() => {
    const loadWeeks = async () => {
      try {
        // Get distinct weeks from weekly_leaderboard table
        const { data: weeksData, error } = await supabase
          .from('weekly_leaderboard')
          .select('week_start, week_end')
          .order('week_start', { ascending: false });

        if (error) throw error;        // Remove duplicates and format
        const uniqueWeeks = Array.from(
          new Map(weeksData.map(w => [`${w.week_start}_${w.week_end}`, w])).values()
        );

        const formatted = uniqueWeeks.map((w, i) => {
          const startDate = new Date(w.week_start);
          const endDate = new Date(w.week_end);
          
          // Format: "2nd Feb 2026"
          const formatDate = (date: Date) => {
            const day = date.getDate();
            const suffix = day === 1 || day === 21 || day === 31 ? 'st' 
              : day === 2 || day === 22 ? 'nd'
              : day === 3 || day === 23 ? 'rd'
              : 'th';
            const month = date.toLocaleDateString('en-GB', { month: 'short' });
            const year = date.getFullYear();
            return `${day}${suffix} ${month} ${year}`;
          };

          return {
            id: `${w.week_start}_${w.week_end}`,
            weekStart: w.week_start,
            weekEnd: w.week_end,
            label: `Week ${uniqueWeeks.length - i}: ${formatDate(startDate)} - ${formatDate(endDate)}${i === 0 ? ' (Latest)' : ''}`
          };
        });

        setWeeks(formatted);
        setSelectedWeek(formatted[0]); // always latest
      } catch (error) {
        console.error('Error loading weeks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load weekly leaderboard weeks',
          variant: 'destructive'
        });
      }
    };

    loadWeeks();
  }, [toast]);

  /* -------------------- LOAD DATA -------------------- */
  useEffect(() => {
    if (!selectedWeek) return;

    const loadLeaderboard = async () => {
      setLoading(true);

      try {        // Read directly from weekly_leaderboard table
        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from('weekly_leaderboard')
          .select('user_id, rank, start_wallet_value, start_portfolio_value, start_account_value, end_wallet_value, end_portfolio_value, end_account_value, deposits_week, weekly_return, week_start, week_end')
          .eq('week_start', selectedWeek.weekStart)
          .eq('week_end', selectedWeek.weekEnd)
          .order('rank', { ascending: true });

        if (leaderboardError) throw leaderboardError;

        // Get user profiles for usernames
        const userIds = leaderboardData.map(row => row.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, username')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Create a map of userId to username
        const userMap = new Map(
          profiles.map(p => [
            p.id,
            p.full_name?.trim() && !/^User [0-9a-fA-F]{8}$/.test(p.full_name)
              ? p.full_name.trim()
              : [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.username || 'Unknown User'
          ])
        );        // Map the data
        const mappedData = leaderboardData.map(row => ({
          rank: row.rank,
          userId: row.user_id,
          username: userMap.get(row.user_id) || 'Unknown User',
          startWalletValue: row.start_wallet_value,
          startPortfolioValue: row.start_portfolio_value,
          startAccountValue: row.start_account_value,
          endWalletValue: row.end_wallet_value,
          endPortfolioValue: row.end_portfolio_value,
          endAccountValue: row.end_account_value,
          totalDeposits: row.deposits_week,
          weeklyReturn: Number(row.weekly_return)
        }));

        setData(mappedData);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        toast({
          title: 'Error',
          description: 'Failed to load weekly leaderboard data',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [selectedWeek, toast]);

  /* -------------------- SORT -------------------- */
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'username':
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
        case 'weeklyReturn':
          aVal = a.weeklyReturn;
          bVal = b.weeklyReturn;
          break;
        case 'rank':
        default:
          aVal = a.rank;
          bVal = b.rank;
      }

      return sortDirection === 'asc'
        ? aVal > bVal ? 1 : -1
        : aVal < bVal ? 1 : -1;
    });
  }, [data, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  };
  /* -------------------- UI -------------------- */
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            Admin Weekly Leaderboard
            {selectedWeek && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                {(() => {
                  const startDate = new Date(selectedWeek.weekStart);
                  const endDate = new Date(selectedWeek.weekEnd);
                  
                  const formatDateTime = (date: Date) => {
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = date.toLocaleDateString('en-GB', { month: 'short' });
                    const year = date.getFullYear();
                    const time = date.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit',
                      hour12: true 
                    });
                    return `${day}/${month}/${year} ${time}`;
                  };

                  return `${formatDateTime(startDate)} to ${formatDateTime(endDate)}`;
                })()}
              </Badge>
            )}
          </div><Select
            value={selectedWeek?.id}
            onValueChange={(id) => {
              const week = weeks.find(w => w.id === id);
              if (week) setSelectedWeek(week);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weeks.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="rounded-md border">
            <Table>              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => setSortField('rank')} className="flex items-center gap-1">
                      Rank <SortIcon field="rank" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => setSortField('username')} className="flex items-center gap-1">
                      User <SortIcon field="username" />
                    </button>
                  </TableHead>
                  <TableHead className="text-center">Start Wallet Value</TableHead>
                  <TableHead className="text-center">Start Portfolio Value</TableHead>
                  <TableHead className="text-center">Start Account Value</TableHead>
                  <TableHead className="text-center">End Wallet Value</TableHead>
                  <TableHead className="text-center">End Portfolio Value</TableHead>
                  <TableHead className="text-center">End Account Value</TableHead>
                  <TableHead className="text-center">Total Deposits</TableHead>
                  <TableHead className="text-center">
                    <button onClick={() => setSortField('weeklyReturn')} className="flex items-center gap-1 ml-auto">
                      % Weekly Return <SortIcon field="weeklyReturn" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>              <TableBody>
                {sortedData.map(row => (
                  <TableRow key={row.userId}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell className="font-medium">{row.username}</TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.startWalletValue / 100)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.startPortfolioValue / 100)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.startAccountValue / 100)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.endWalletValue / 100)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.endPortfolioValue / 100)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.endAccountValue / 100)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(row.totalDeposits / 100)}
                    </TableCell>
                    <TableCell className={`text-center font-mono font-semibold ${
                      row.weeklyReturn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {row.weeklyReturn >= 0 ? '+' : ''}
                      {(row.weeklyReturn * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};