import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { footballApiService } from '@/shared/lib/football-api';
import { fixturesService, teamsService, positionsService } from '@/shared/lib/database';
import { cashInjectionTracker, type CashInjectionWithDetails } from '@/shared/lib/cash-injection-tracker';
import { supabase } from '@/shared/lib/supabase';
import type { TeamDetails, FootballMatch, Standing } from '@/shared/lib/football-api';
import type { DatabaseFixture, DatabaseTeam } from '@/shared/lib/database';
import type { DatabasePositionWithTeam } from '@/shared/types/database.types';
import { formatCurrency, formatNumber } from '@/shared/lib/formatters';
import { Loader2, TrendingUp, TrendingDown, Minus, DollarSign, Calendar, Users, ArrowRight } from 'lucide-react';
import TeamLogo from '@/shared/components/TeamLogo';

interface TeamDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  teamName: string;
  userId?: string; // Optional user ID for P/L calculations
}

const TeamDetailsModal: React.FC<TeamDetailsModalProps> = ({ isOpen, onClose, teamId, teamName, userId }) => {
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [teamMatches, setTeamMatches] = useState<FootballMatch[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [teams, setTeams] = useState<DatabaseTeam[]>([]);
  const [userPosition, setUserPosition] = useState<DatabasePositionWithTeam | null>(null);
  const [cashInjections, setCashInjections] = useState<CashInjectionWithDetails[]>([]);
  const [injectionSummary, setInjectionSummary] = useState<{
    totalInjections: number;
    totalAmount: number;
    averageInjection: number;
    largestInjection: number;
    injectionCount: number;
  } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false); // Guard to prevent multiple simultaneous loads

  useEffect(() => {
    if (isOpen && teamId && !isLoadingData) {
      loadTeamData();
    } else if (!isOpen) {
      // Reset loading state when modal closes
      setLoading(false);
      setError(null);
      setIsLoadingData(false);
    }
  }, [isOpen, teamId]);

  const loadTeamData = async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingData) {
      console.log('Load already in progress, skipping...');
      return;
    }
    
    setIsLoadingData(true);
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading team data for teamId:', teamId, 'teamName:', teamName);
      
      // First, get all teams to find the external ID for this team
      const allTeams = await teamsService.getAll();
      const team = allTeams.find(t => t.id === teamId);
      
      if (!team) {
        throw new Error(`Team with ID ${teamId} not found`);
      }
      
      const externalTeamId = team.external_id;
      console.log('Using external team ID:', externalTeamId, 'for team:', team.name);
      
      // Try to get Premier League data (this will use Netlify function if available)
      // Skip this if it takes too long - it's optional data
      let premierLeague = null;
      try {
        // Don't wait too long for this optional data
        const premierLeagueData = await Promise.race([
          footballApiService.getPremierLeagueData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]) as any;
        premierLeague = premierLeagueData;
      } catch (error) {
        console.warn('Premier League API failed or timed out, continuing without it:', error);
        premierLeague = null;
      }

      // Check if we have Premier League data
      if (!premierLeague) {
        console.warn('No Premier League data available');
      }

      // Get fixtures data
      const [fixturesData] = await Promise.allSettled([
        fixturesService.getAll()
      ]);

      // Extract successful results
      const fixtures = fixturesData.status === 'fulfilled' ? fixturesData.value : [];

      // Try to get detailed team information
      let teamDetails = null;
      if (externalTeamId) {
        try {
          const basicTeamInfo = premierLeague?.teams?.find(t => t.id === externalTeamId);
          if (basicTeamInfo) {
            teamDetails = basicTeamInfo;
          }
        } catch (detailError) {
          console.warn('Failed to fetch detailed team info, using basic info:', detailError);
          teamDetails = null;
        }
      }

      // Set the data regardless of success or failure
      setTeamDetails(teamDetails);
      setTeamMatches(teamMatches);
      setStandings(standings);
      setTeams(allTeams);
      
      console.log('Team data loaded:', { 
        details: teamDetails ? 'loaded' : 'failed', 
        matches: teamMatches.length, 
        standings: standings.length 
      });

      // Load match history first (this should always work)
      console.log('🚀 About to load match history...');
      console.log('Fixture count:', fixtures.length);
      console.log('Teams count:', allTeams.length);
      
      try {
        await loadMatchHistory(fixtures, allTeams, null);
        console.log('✅ Match history loaded!');
      } catch (matchHistoryError) {
        console.error('Error loading match history:', matchHistoryError);
        // Continue even if match history fails
      }
      
      // Load user position if userId is provided (optional, don't block on this)
      let currentUserPosition = null;
      if (userId) {
        try {
          currentUserPosition = await Promise.race([
            loadUserPositionAndReturn(userId, teamId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]) as any;
          
          // Update match history with position data if available
          if (currentUserPosition) {
            try {
              await loadMatchHistory(fixtures, allTeams, currentUserPosition);
            } catch (updateError) {
              console.warn('Error updating match history with position:', updateError);
            }
          }
        } catch (positionError) {
          console.warn('Could not load user position (user may not have any positions yet):', positionError);
          // Don't fail the entire modal - just continue without position data
        }
      }

      // Load cash injections (non-blocking, with timeout)
      try {
        await Promise.race([
          loadCashInjections(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (cashError) {
        console.warn('Error loading cash injections (non-critical):', cashError);
        // Continue even if cash injections fail - this is optional data
      }

    } catch (err) {
      console.error('Error loading team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };

  const loadUserPositionAndReturn = async (userId: string, teamId: number) => {
    try {
      console.log('Attempting to load user position for userId:', userId, 'teamId:', teamId);
      const position = await positionsService.getUserPosition(userId, teamId);
      console.log('User position result:', position);
      setUserPosition(position);
      return position; // Return the position directly
    } catch (error) {
      console.error('Error loading user position:', error);
      setUserPosition(null);
      return null;
    }
  };

  const loadCashInjections = async () => {
    try {
      console.log('Loading cash injections for team:', teamId);
      const [injectionsData, summaryData] = await Promise.all([
        cashInjectionTracker.getTeamInjections(teamId),
        cashInjectionTracker.getTeamInjectionSummary(teamId)
      ]);
      
      console.log('Cash injections data:', injectionsData);
      console.log('Summary data:', summaryData);
      
      setCashInjections(injectionsData);
      setInjectionSummary(summaryData);
    } catch (error) {
      console.error('Error loading cash injections:', error);
    }
  };

  const loadMatchHistory = async (fixturesData: DatabaseFixture[], teamsData: DatabaseTeam[], currentUserPosition?: any) => {
    try {
      console.log('🎯🎯🎯 LOAD MATCH HISTORY FUNCTION CALLED 🎯🎯🎯');
      console.log('Loading match history from total_ledger for teamId:', teamId);
      
      // Query total_ledger for match history instead of fixtures
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('total_ledger')
        .select('*')
        .eq('team_id', teamId)
        .in('ledger_type', ['match_win', 'match_loss', 'match_draw'])
        .order('event_date', { ascending: false })
        .limit(100); // Add limit to prevent huge queries
      
      if (ledgerError) {
        console.error('❌❌❌ ERROR LOADING FROM TOTAL_LEDGER ❌❌❌');
        console.error('Error:', ledgerError);
        setMatchHistory([]);
        return;
      }
      
      console.log('✅✅✅ SUCCESSFULLY QUERIED TOTAL_LEDGER ✅✅✅');
      console.log('Total ledger entries found:', ledgerData?.length || 0);
      
      // Log first few event_dates from ledger to debug
      if (ledgerData && ledgerData.length > 0) {
        console.log('🔍 🔍 🔍 SAMPLE EVENT_DATES FROM DATABASE 🔍 🔍 🔍');
        console.log(ledgerData.slice(0, 5).map(l => ({
          id: l.id,
          event_date: l.event_date,
          ledger_type: l.ledger_type
        })));
        console.log('🔍 🔍 🔍 END OF SAMPLE EVENT_DATES 🔍 🔍 🔍');
      }
      
      // Deduplicate match events by trigger_event_id (keep most recent by created_at or id)
      const matchEventsMap = new Map<number, typeof ledgerData[0]>();
      
      (ledgerData || []).forEach(event => {
        const triggerEventId = event.trigger_event_id;
        if (!triggerEventId) {
          // Skip events without trigger_event_id (shouldn't happen for match events)
          return;
        }
        
        const existing = matchEventsMap.get(triggerEventId);
        if (!existing) {
          matchEventsMap.set(triggerEventId, event);
          return;
        }
        
        // Compare by created_at (most recent) or id (fallback)
        const existingTime = existing.created_at ? new Date(existing.created_at).getTime() : 0;
        const currentTime = event.created_at ? new Date(event.created_at).getTime() : 0;
        
        if (currentTime > existingTime || (currentTime === existingTime && event.id > existing.id)) {
          // Replace with more recent entry
          matchEventsMap.set(triggerEventId, event);
        }
      });
      
      // Use deduplicated match events
      const deduplicatedLedgerData = Array.from(matchEventsMap.values());
      
      // OPTIMIZED: Create team lookup map for O(1) access
      const teamMap = new Map(teamsData.map(team => [team.id, team]));
      
      // Get fixture data for reference
      const fixtures = fixturesData;
      const fixturesMap = new Map(fixtures.map(f => [f.id, f]));

      const matchHistoryData = deduplicatedLedgerData
        .map(ledgerEntry => {
          try {
            // Get fixture details
            const fixture = ledgerEntry.trigger_event_id ? fixturesMap.get(ledgerEntry.trigger_event_id) : null;
            
            if (!fixture) {
              console.warn('Fixture not found for ledger entry:', ledgerEntry.id);
              return null;
            }
            
            // Get opponent from FIXTURE data (source of truth) not from ledger
            let opponentId: number | null = null;
            if (fixture.home_team_id === ledgerEntry.team_id) {
              // Team is home, opponent is away
              opponentId = fixture.away_team_id;
            } else if (fixture.away_team_id === ledgerEntry.team_id) {
              // Team is away, opponent is home
              opponentId = fixture.home_team_id;
            }
            
            const opponent = opponentId ? teamMap.get(opponentId) : null;
            
            if (!opponent) {
              console.warn(`Could not find opponent team for ledger entry ${ledgerEntry.id}`);
              return null;
            }

            // Use ledger data directly
            const result = ledgerEntry.ledger_type === 'match_win' ? 'win' 
              : ledgerEntry.ledger_type === 'match_loss' ? 'loss' 
              : 'draw' as 'win' | 'loss' | 'draw';
            
            const isHome = ledgerEntry.is_home_match;
            const preMatchCap = parseFloat(ledgerEntry.market_cap_before?.toString() || '0');
            const postMatchCap = parseFloat(ledgerEntry.market_cap_after?.toString() || '0');
            const priceImpact = parseFloat(ledgerEntry.price_impact?.toString() || '0');
            const priceImpactPercent = preMatchCap > 0 ? (priceImpact / preMatchCap) * 100 : 0;
            
            const preMatchSharePrice = parseFloat(ledgerEntry.share_price_before?.toString() || '0');
            const postMatchSharePrice = parseFloat(ledgerEntry.share_price_after?.toString() || '0');

            // Calculate user P/L if user has position
            const userPos = currentUserPosition || userPosition;
            let userPL = 0;
            if (userPos && userPos.quantity > 0) {
              const preMatchValue = userPos.quantity * preMatchSharePrice;
              const postMatchValue = userPos.quantity * postMatchSharePrice;
              userPL = postMatchValue - preMatchValue;
            }

            const score = ledgerEntry.match_score || '0-0';
            
            // ALWAYS use event_date from ledger, never fall back to fixture
            const displayDate = ledgerEntry.event_date;
            
            // Override corrupted event_description with correct opponent name
            const correctDescription = `Match vs ${opponent.name}`;
            
            return {
              fixture: {
                ...fixture,
                kickoff_at: displayDate, // ALWAYS use the ledger event_date
                // Override description with correct opponent
                id: fixture.id
              },
              opponent,
              isHome,
              result,
              score,
              preMatchCap,
              postMatchCap,
              priceImpact,
              priceImpactPercent,
              preMatchSharePrice,
              postMatchSharePrice,
              userPL,
              description: correctDescription // Use correct description
            };
          } catch (entryError) {
            console.error(`Error processing ledger entry ${ledgerEntry.id}:`, entryError);
            return null; // Skip this entry if there's an error
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.fixture.kickoff_at).getTime() - new Date(a.fixture.kickoff_at).getTime());

      console.log('Final match history data:', matchHistoryData.length);
      console.log('Match history details:', matchHistoryData);
      
      setMatchHistory(matchHistoryData);
    } catch (error) {
      console.error('Error loading match history:', error);
      // Set empty array on error to prevent infinite loading
      setMatchHistory([]);
    }
  };

  const formatDate = (dateString: string | Date) => {
    // Handle Date objects and strings
    let date: Date;
    if (typeof dateString !== 'string') {
      date = dateString;
    } else {
      date = new Date(dateString);
    }
    
    // Format using the actual date without timezone conversion
    // Extract date components directly to avoid timezone issues
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Format as "MMM D, YYYY" (e.g., "Oct 26, 2025")
    const formatted = new Date(year, month, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return formatted;
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'loss':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      case 'draw':
        return <Minus className="h-4 w-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win':
        return 'bg-green-600';
      case 'loss':
        return 'bg-red-600';
      case 'draw':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-green-400" />
            {teamName} - Match History & Share Price Impact
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <span className="ml-2 text-gray-400">Loading team data...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <Button
              onClick={loadTeamData}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && (
          <div className="w-full space-y-4">
            <Tabs defaultValue="match-history" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                <TabsTrigger value="match-history" className="data-[state=active]:bg-gray-700">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Match History
                </TabsTrigger>
                <TabsTrigger value="cash-injections" className="data-[state=active]:bg-gray-700">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Cash Injections
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="match-history" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Match History & Share Price Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                {matchHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No completed matches found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Matches will appear here once they are completed and market cap transfers are applied.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matchHistory.map((match, index) => {
                      console.log('Match history item:', {
                        fixtureId: match.fixture.id,
                        kickoff_at: match.fixture.kickoff_at,
                        result: match.result,
                        score: match.score
                      });
                      return (
                      <Card key={match.fixture.id} className="bg-gray-800 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-xs">
                                {formatDate(match.fixture.kickoff_at)}
                              </Badge>
                              <span className="text-gray-400">
                                vs
                              </span>
                              <TeamLogo 
                                teamName={match.opponent.name} 
                                externalId={match.opponent.external_id ? parseInt(match.opponent.external_id.toString()) : undefined}
                                size="sm" 
                              />
                              <span className="font-medium text-white">
                                {match.opponent.name}
                              </span>
                              <span className="text-sm font-mono text-gray-400">
                                {match.score}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getResultIcon(match.result)}
                              <Badge className={getResultColor(match.result)}>
                                {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="text-gray-400">Market Cap Impact</div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300">
                                  {formatCurrency(match.preMatchCap)} → {formatCurrency(match.postMatchCap)}
                                </span>
                                <span className={`text-xs ${match.priceImpactPercent > 0 ? 'text-green-400' : match.priceImpactPercent < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                  {match.priceImpactPercent > 0 ? '+' : ''}{match.priceImpactPercent.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="text-gray-400">Share Price</div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300">
                                  {formatCurrency(match.preMatchSharePrice)} → {formatCurrency(match.postMatchSharePrice)}
                                </span>
                              </div>
                            </div>
                            
                            {userId && match.userPL !== 0 && (
                              <div className="space-y-2">
                                <div className="text-gray-400">Your P/L</div>
                                <div className={`font-medium ${match.userPL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {match.userPL > 0 ? '+' : ''}{formatCurrency(match.userPL)}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="cash-injections" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Cash Injections
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Summary Cards */}
                    {injectionSummary && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Total Injections</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{injectionSummary.totalInjections}</div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Total Amount</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency(injectionSummary.totalAmount)}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Average Injection</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {formatCurrency(injectionSummary.averageInjection)}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500">Largest Injection</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                              {formatCurrency(injectionSummary.largestInjection)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Cash Injections Timeline */}
                    {cashInjections.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No cash injections recorded yet</p>
                        <p className="text-sm">Cash injections will appear here when users purchase shares</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cashInjections.map((injection) => (
                          <div key={injection.id} className="border rounded-lg p-4 hover:bg-gray-700">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">
                                  {injection.amount >= 1000 ? '💰' : injection.amount >= 500 ? '💵' : injection.amount >= 100 ? '💸' : '💳'}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={injection.amount >= 1000 ? 'bg-green-500' : injection.amount >= 500 ? 'bg-blue-500' : injection.amount >= 100 ? 'bg-yellow-500' : 'bg-gray-500'}>
                                      {injection.amount >= 1000 ? 'Large' : injection.amount >= 500 ? 'Medium' : injection.amount >= 100 ? 'Small' : 'Micro'}
                                    </Badge>
                                    <span className="text-sm text-gray-500">
                                      {new Date(injection.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-lg">
                                        {formatCurrency(injection.amount)}
                                      </span>
                                      <span className="text-sm text-gray-500">
                                        ({formatNumber(injection.shares_purchased)} shares @ {formatCurrency(injection.price_per_share)})
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <Users className="h-4 w-4" />
                                      <span>by {injection.user_email}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <TrendingUp className="h-4 w-4" />
                                      <span>
                                        Market cap: {formatCurrency(injection.market_cap_before)} → {formatCurrency(injection.market_cap_after)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-sm text-gray-500 mb-1">Market Cap Impact</div>
                                <div className="text-lg font-semibold text-green-600">
                                  +{formatCurrency(injection.amount)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {((injection.amount / injection.market_cap_before) * 100).toFixed(2)}% increase
                                </div>
                              </div>
                            </div>
                            
                            {/* Fixture Context */}
                            {(injection.fixture_before || injection.fixture_after) && (
                              <div className="mt-3 pt-3 border-t border-gray-600">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  <span>Between matches:</span>
                                  {injection.fixture_before && (
                                    <span>
                                      vs {injection.fixture_before.opponent} ({injection.fixture_before.result})
                                    </span>
                                  )}
                                  {injection.fixture_before && injection.fixture_after && (
                                    <ArrowRight className="h-3 w-3" />
                                  )}
                                  {injection.fixture_after && (
                                    <span>
                                      vs {injection.fixture_after.opponent}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeamDetailsModal;