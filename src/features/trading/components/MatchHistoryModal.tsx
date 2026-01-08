import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { formatCurrency } from '@/shared/lib/formatters';
import { fixturesService, teamsService } from '@/shared/lib/database';
import { supabase } from '@/shared/lib/supabase';
import type { DatabaseFixture, DatabaseTeam } from '@/shared/lib/database';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fromCents, roundForDisplay } from '@/shared/lib/utils/decimal';
import { calculatePriceImpactPercent } from '@/shared/lib/utils/calculations';

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
}

interface MatchWithPriceImpact {
  fixture: DatabaseFixture;
  opponent: string;
  isHome: boolean;
  result: 'win' | 'loss' | 'draw';
  score: string;
  preMatchCap: number;
  postMatchCap: number;
  priceImpact: number;
  priceImpactPercent: number;
}

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({
  isOpen,
  onClose,
  clubId,
  clubName
}) => {
  const [matches, setMatches] = useState<MatchWithPriceImpact[]>([]);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<DatabaseTeam[]>([]);

  useEffect(() => {
    if (isOpen && clubId) {
      loadMatchHistory();
    }
  }, [isOpen, clubId]);

  const loadMatchHistory = async () => {
    setLoading(true);
    try {
      const clubIdNum = parseInt(clubId);
      
      // Load ledger data, fixtures, and teams
      const [ledgerResult, fixturesData, teamsData] = await Promise.all([
        supabase
          .from('total_ledger')
          .select('*')
          .eq('team_id', clubIdNum)
          .in('ledger_type', ['match_win', 'match_loss', 'match_draw'])
          .order('event_date', { ascending: false }),
        fixturesService.getAll(),
        teamsService.getAll()
      ]);

      if (ledgerResult.error) {
        throw ledgerResult.error;
      }

      setTeams(teamsData);

      // Create maps for quick lookup
      const fixturesMap = new Map((fixturesData || []).map(f => [f.id, f]));
      const teamsMap = new Map((teamsData || []).map(t => [t.id, t]));

      // Process ledger entries to get match history
      const matchesWithImpacts: MatchWithPriceImpact[] = [];
      
      for (const ledgerEntry of (ledgerResult.data || [])) {
        const fixture = fixturesMap.get(ledgerEntry.trigger_event_id || 0);
        if (!fixture) {
          continue; // Skip if fixture not found
        }

        const isHome = fixture.home_team_id === clubIdNum;
        const opponent = isHome ? 
          teamsMap.get(fixture.away_team_id)?.name || 'Unknown' :
          teamsMap.get(fixture.home_team_id)?.name || 'Unknown';

        const result: 'win' | 'loss' | 'draw' = 
          ledgerEntry.ledger_type === 'match_win' ? 'win' :
          ledgerEntry.ledger_type === 'match_loss' ? 'loss' : 'draw';

        // Use actual values from ledger (stored in cents)
        const preMatchCap = roundForDisplay(fromCents(ledgerEntry.market_cap_before || 0));
        const postMatchCap = roundForDisplay(fromCents(ledgerEntry.market_cap_after || 0));
        
        // Use amount_transferred directly from database to avoid rounding errors
        const transferAmountDollars = roundForDisplay(fromCents(ledgerEntry.amount_transferred || 0));
        const priceImpact = result === 'win' 
          ? transferAmountDollars  // Winner gains the transfer amount
          : result === 'loss' 
          ? -transferAmountDollars  // Loser loses the transfer amount
          : 0; // Draw: no transfer

        const priceImpactPercent = calculatePriceImpactPercent(postMatchCap, preMatchCap);
        const score = `${fixture.home_score || 0}-${fixture.away_score || 0}`;

        matchesWithImpacts.push({
          fixture,
          opponent,
          isHome,
          result,
          score,
          preMatchCap,
          postMatchCap,
          priceImpact,
          priceImpactPercent
        });
      }

      // Sort by kickoff date (most recent first)
      matchesWithImpacts.sort((a, b) => 
        new Date(b.fixture.kickoff_at).getTime() - new Date(a.fixture.kickoff_at).getTime()
      );

      setMatches(matchesWithImpacts);
    } catch (error) {
      console.error('Error loading match history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'loss':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      case 'draw':
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getResultBadge = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win':
        return <Badge className="bg-green-600 text-white">W</Badge>;
      case 'loss':
        return <Badge className="bg-red-600 text-white">L</Badge>;
      case 'draw':
        return <Badge className="bg-gray-600 text-white">D</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {getResultIcon('win')}
            {clubName} - Match History & Share Price Impact
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">Loading match history...</div>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No completed matches found</p>
            <p className="text-sm text-gray-500 mt-2">
              Matches will appear here once they are completed and market cap transfers are applied.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match, index) => (
              <Card key={match.fixture.id} className="bg-gray-700 border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-400">
                        {formatDate(match.fixture.kickoff_at)}
                      </div>
                      <div className="font-medium">
                        {match.isHome ? 'vs' : '@'} {match.opponent}
                      </div>
                      <div className="text-sm font-mono text-gray-300">
                        {match.score}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getResultBadge(match.result)}
                      <Badge variant="outline" className="text-xs">
                        Matchday {match.fixture.matchday}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-400">Pre-Match Market Cap</div>
                      <div className="font-medium">{formatCurrency(match.preMatchCap)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-400">Post-Match Market Cap</div>
                      <div className="font-medium">{formatCurrency(match.postMatchCap)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-gray-400">Price Impact</div>
                      <div className={`font-medium flex items-center gap-1 ${
                        match.priceImpact > 0 ? 'text-green-400' : 
                        match.priceImpact < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {getResultIcon(match.result)}
                        {match.priceImpact > 0 ? '+' : ''}{formatCurrency(match.priceImpact)}
                        <span className="text-xs">
                          ({match.priceImpactPercent > 0 ? '+' : ''}{match.priceImpactPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {match.result !== 'draw' && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="text-xs text-gray-400">
                        {match.result === 'win' 
                          ? `Gained 10% of ${match.opponent}'s market cap`
                          : `Lost 10% of own market cap`
                        }
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};