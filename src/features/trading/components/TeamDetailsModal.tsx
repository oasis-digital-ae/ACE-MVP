import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { footballApiService } from '@/shared/lib/football-api';
import { fixturesService, teamsService, positionsService } from '@/shared/lib/database';
import type { TeamDetails, FootballMatch, Standing } from '@/shared/lib/football-api';
import type { DatabaseFixture, DatabaseTeam } from '@/shared/lib/database';
import type { DatabasePositionWithTeam } from '@/shared/types/database.types';
import { formatCurrency } from '@/shared/lib/formatters';
import { Loader2, ExternalLink, MapPin, Calendar, Users, Trophy, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamData();
    }
  }, [isOpen, teamId]);

  const loadTeamData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading team data for teamId:', teamId, 'teamName:', teamName);
      
      // First, get all teams to find the external ID for this team
      const allTeams = await teamsService.getAll();
      const team = allTeams.find(t => t.id === teamId);
      
      if (!team) {
        throw new Error(`Team not found in database for ID: ${teamId}`);
      }
      
      const externalTeamId = team.external_id;
      console.log('Using external team ID:', externalTeamId, 'for team:', teamName);
      
      // OPTIMIZED: Single API call gets all Premier League data with fallback
      // This reduces API calls from 3 to 1 per team click!
      let premierLeague = null;
      try {
        const premierLeagueData = await footballApiService.getPremierLeagueData();
        premierLeague = premierLeagueData;
      } catch (error) {
        console.warn('Netlify function failed, attempting fallback with direct API calls:', error);
        
        // Fallback: Use direct API calls
        try {
          const [standingsData, matchesData] = await Promise.allSettled([
            footballApiService.getPremierLeagueStandings(),
            footballApiService.getPremierLeagueMatches()
          ]);
          
          const standings = standingsData.status === 'fulfilled' ? standingsData.value : [];
          const matches = matchesData.status === 'fulfilled' ? matchesData.value : [];
          
          // Reconstruct the data structure
          premierLeague = {
            standings,
            matches,
            teams: standings.map(s => s.team)
          };
          
          console.log('Fallback successful:', { standings: standings.length, matches: matches.length });
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          premierLeague = null;
        }
      }

      const [fixturesData] = await Promise.allSettled([
        fixturesService.getAll()
      ]);

      // Extract successful results
      const fixtures = fixturesData.status === 'fulfilled' ? fixturesData.value : [];

      // Find specific team data from the Premier League data
      const basicTeamInfo = premierLeague?.teams.find(t => t.id === externalTeamId) || null;
      const teamMatches = premierLeague?.matches.filter(m => 
        m.homeTeam.id === externalTeamId || m.awayTeam.id === externalTeamId
      ) || [];
      const standings = premierLeague?.standings || [];

      // Get detailed team information from cached all-teams data
      let teamDetails = basicTeamInfo;
      if (basicTeamInfo) {
        try {
          // Fetch detailed team info for this specific team (cached for 15 minutes)
          const detailedTeamInfo = await footballApiService.getTeamDetailsCached(externalTeamId);
          
          teamDetails = detailedTeamInfo || basicTeamInfo;
        } catch (detailError) {
          console.warn('Failed to fetch detailed team info, using basic info:', detailError);
          teamDetails = basicTeamInfo;
        }
      }

      // Log any API failures and try fallback
      if (premierLeagueData.status === 'rejected') {
        console.warn(`Failed to fetch Premier League data:`, premierLeagueData.reason);
        console.log('Attempting fallback with individual API calls...');
        
        try {
          // Fallback: Use individual API calls
          const [standingsData, teamDetailsData, teamMatchesData] = await Promise.allSettled([
            footballApiService.getPremierLeagueData().then(data => data.standings),
            footballApiService.getTeamDetails(externalTeamId),
            footballApiService.getTeamMatches(externalTeamId)
          ]);
          
          const standings = standingsData.status === 'fulfilled' ? standingsData.value : [];
          const basicTeamDetails = teamDetailsData.status === 'fulfilled' ? teamDetailsData.value : null;
          const teamMatches = teamMatchesData.status === 'fulfilled' ? teamMatchesData.value : [];
          
          // Try to get detailed team information even in fallback
          let teamDetails = basicTeamDetails;
          if (basicTeamDetails) {
            try {
              const detailedTeamInfo = await footballApiService.getTeamDetailsCached(externalTeamId);
              teamDetails = detailedTeamInfo || basicTeamDetails;
            } catch (detailError) {
              console.warn('Failed to fetch detailed team info in fallback:', detailError);
              teamDetails = basicTeamDetails;
            }
          }
          
          setTeamDetails(teamDetails);
          setTeamMatches(teamMatches);
          setStandings(standings);
          setTeams(allTeams);
          
          console.log('Fallback successful:', { 
            details: teamDetails ? 'loaded' : 'failed', 
            matches: teamMatches.length, 
            standings: standings.length 
          });
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          setError(`Failed to load team data: ${premierLeagueData.reason.message || 'API error'}`);
        }
      } else {
        setTeamDetails(teamDetails);
        setTeamMatches(teamMatches);
        setStandings(standings);
        setTeams(allTeams);
        
        console.log('Successfully loaded team data:', { 
          details: teamDetails ? 'loaded' : 'failed', 
          matches: teamMatches.length, 
          standings: standings.length 
        });
      }

      // Load user position if userId is provided
      let currentUserPosition = null;
      if (userId) {
        currentUserPosition = await loadUserPositionAndReturn(userId, teamId);
      }

      // Process match history for this team
      await loadMatchHistory(fixtures, allTeams, currentUserPosition);
    } catch (err) {
      console.error('Error loading team data:', err);
      console.error('TeamId that failed:', teamId);
      console.error('TeamName:', teamName);
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPositionAndReturn = async (userId: string, teamId: number) => {
    try {
      console.log(`Loading user position for userId: ${userId}, teamId: ${teamId}`);
      const positions = await positionsService.getUserPositions(userId);
      console.log(`All user positions:`, positions);
      const position = positions.find(p => p.team_id === teamId);
      console.log(`Found position for team ${teamId}:`, position);
      setUserPosition(position || null);
      return position || null;
    } catch (error) {
      console.error('Error loading user position:', error);
      setUserPosition(null);
      return null;
    }
  };

  const loadUserPosition = async (userId: string, teamId: number) => {
    try {
      console.log(`Loading user position for userId: ${userId}, teamId: ${teamId}`);
      const positions = await positionsService.getUserPositions(userId);
      console.log(`All user positions:`, positions);
      const position = positions.find(p => p.team_id === teamId);
      console.log(`Found position for team ${teamId}:`, position);
      setUserPosition(position || null);
    } catch (error) {
      console.error('Error loading user position:', error);
      setUserPosition(null);
    }
  };

  const loadMatchHistory = async (fixturesData: DatabaseFixture[], teamsData: DatabaseTeam[], currentUserPosition?: any) => {
    try {
      // Find the team in our database by database ID
      const team = teamsData.find(t => t.id === teamId);
      if (!team) {
        console.log('Team not found in database for ID:', teamId);
        return;
      }

      // Filter fixtures for this team that have been completed
      const clubFixtures = fixturesData.filter(fixture => 
        (fixture.home_team_id === team.id || fixture.away_team_id === team.id) &&
        fixture.status === 'applied' && 
        fixture.result !== 'pending' &&
        fixture.snapshot_home_cap !== null &&
        fixture.snapshot_away_cap !== null
      );

      // Process each fixture to calculate price impacts and P/L
      const matchesWithImpacts = clubFixtures.map(fixture => {
        const isHome = fixture.home_team_id === team.id;
        const opponent = isHome ? 
          teamsData.find(t => t.id === fixture.away_team_id)?.name || 'Unknown' :
          teamsData.find(t => t.id === fixture.home_team_id)?.name || 'Unknown';

        // Calculate pre-match market cap from snapshot
        const preMatchCap = isHome ? 
          (fixture.snapshot_home_cap || 0) : 
          (fixture.snapshot_away_cap || 0);

        // Calculate post-match market cap based on result
        let postMatchCap = preMatchCap;
        let result: 'win' | 'loss' | 'draw' = 'draw';
        let priceImpact = 0;
        let priceImpactPercent = 0;

        if (fixture.result === 'home_win') {
          if (isHome) {
            result = 'win';
            // Winner gets 10% of loser's market cap
            const loserCap = fixture.snapshot_away_cap || 0;
            priceImpact = loserCap * 0.10;
            postMatchCap = preMatchCap + priceImpact;
          } else {
            result = 'loss';
            // Loser loses 10% of their market cap
            priceImpact = -preMatchCap * 0.10;
            postMatchCap = preMatchCap + priceImpact;
          }
        } else if (fixture.result === 'away_win') {
          if (isHome) {
            result = 'loss';
            // Loser loses 10% of their market cap
            priceImpact = -preMatchCap * 0.10;
            postMatchCap = preMatchCap + priceImpact;
          } else {
            result = 'win';
            // Winner gets 10% of loser's market cap
            const loserCap = fixture.snapshot_home_cap || 0;
            priceImpact = loserCap * 0.10;
            postMatchCap = preMatchCap + priceImpact;
          }
        } else {
          result = 'draw';
          priceImpact = 0;
          postMatchCap = preMatchCap;
        }

        priceImpactPercent = preMatchCap > 0 ? (priceImpact / preMatchCap) * 100 : 0;

        // Calculate pre-match and post-match share prices
        const preMatchSharesOutstanding = team.shares_outstanding;
        const postMatchSharesOutstanding = team.shares_outstanding; // Assuming shares outstanding doesn't change from match results
        
        const preMatchSharePrice = preMatchSharesOutstanding > 0 ? preMatchCap / preMatchSharesOutstanding : 0;
        const postMatchSharePrice = postMatchSharesOutstanding > 0 ? postMatchCap / postMatchSharesOutstanding : 0;

        // Calculate P/L for user if they own shares
        let userPL = 0;
        let userPLPercent = 0;
        const userPos = currentUserPosition || userPosition;
        if (userPos && userPos.quantity > 0) {
          // Calculate P/L based on share price change
          const sharePriceChange = postMatchSharePrice - preMatchSharePrice;
          userPL = sharePriceChange * userPos.quantity;
          userPLPercent = preMatchSharePrice > 0 ? (sharePriceChange / preMatchSharePrice) * 100 : 0;
          
          // Debug logging
          console.log(`P/L Debug for ${team.name}:`, {
            userPosition: userPos,
            preMatchSharePrice,
            postMatchSharePrice,
            sharePriceChange,
            userPL,
            userPLPercent
          });
        } else {
          console.log(`No user position for ${team.name}:`, { userPosition: userPos, teamId });
        }

        const score = `${fixture.home_score || 0}-${fixture.away_score || 0}`;

        return {
          fixture,
          opponent,
          isHome,
          result,
          score,
          preMatchCap,
          postMatchCap,
          priceImpact,
          priceImpactPercent,
          userPL,
          userPLPercent,
          preMatchSharePrice,
          postMatchSharePrice
        };
      });

      // Sort by kickoff date (most recent first)
      matchesWithImpacts.sort((a, b) => 
        new Date(b.fixture.kickoff_at).getTime() - new Date(a.fixture.kickoff_at).getTime()
      );

      setMatchHistory(matchesWithImpacts);
    } catch (error) {
      console.error('Error loading match history:', error);
    }
  };

  const getTeamPosition = () => {
    const teamStanding = standings.find(s => s.team.id === teamId);
    return teamStanding ? teamStanding.position : null;
  };

  const getRecentForm = () => {
    const recentMatches = teamMatches.slice(0, 5);
    return recentMatches.map(match => {
      if (match.status !== 'FINISHED') return null;
      
      const isHome = match.homeTeam.id === teamId;
      const teamScore = isHome ? match.score.fullTime.home : match.score.fullTime.away;
      const opponentScore = isHome ? match.score.fullTime.away : match.score.fullTime.home;
      
      if (teamScore > opponentScore) return 'W';
      if (teamScore < opponentScore) return 'L';
      return 'D';
    }).filter(Boolean);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  const getMatchResult = (match: FootballMatch) => {
    if (match.status !== 'FINISHED') return null;
    
    const isHome = match.homeTeam.id === teamId;
    const teamScore = isHome ? match.score.fullTime.home : match.score.fullTime.away;
    const opponentScore = isHome ? match.score.fullTime.away : match.score.fullTime.away;
    const opponentName = isHome ? match.awayTeam.name : match.homeTeam.name;
    
    if (teamScore > opponentScore) return { result: 'W', score: `${teamScore}-${opponentScore}`, opponent: opponentName };
    if (teamScore < opponentScore) return { result: 'L', score: `${teamScore}-${opponentScore}`, opponent: opponentName };
    return { result: 'D', score: `${teamScore}-${opponentScore}`, opponent: opponentName };
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {teamDetails?.crest && (
              <img 
                src={teamDetails.crest} 
                alt={teamName}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            {teamName} Details
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading team data...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <div className="text-sm text-gray-400 mb-4">
              <p>Team ID: {teamId}</p>
              <p>Team Name: {teamName}</p>
              <p className="mt-2 text-yellow-500">
                Note: This team may not be available in the current Premier League season API data.
              </p>
            </div>
            <Button onClick={loadTeamData} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {!error && !loading && !teamDetails && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <h3 className="text-lg font-semibold mb-2">{teamName}</h3>
              <p className="text-sm">Team details not available from API</p>
              <p className="text-xs mt-2 text-yellow-500">
                This team may not be in the current Premier League season
              </p>
            </div>
            <Button onClick={loadTeamData} variant="outline">
              Retry
            </Button>
          </div>
        )}

        {teamDetails && !loading && (
          <Tabs defaultValue="match-history" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="match-history">Match History</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="squad">Squad</TabsTrigger>
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="match-history" className="space-y-4">
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
                      {matchHistory.map((match, index) => (
                        <Card key={match.fixture.id} className="">
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
                                <div className="text-xs text-gray-500">
                                  Share Price: {formatCurrency(match.preMatchSharePrice)}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-gray-400">Post-Match Market Cap</div>
                                <div className="font-medium">{formatCurrency(match.postMatchCap)}</div>
                                <div className="text-xs text-gray-500">
                                  Share Price: {formatCurrency(match.postMatchSharePrice)}
                                </div>
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
                                    ({match.priceImpactPercent > 0 ? '+' : ''}{match.priceImpactPercent.toFixed(1)}%)
                                  </span>
                                </div>
                                {userPosition && userPosition.quantity > 0 && (
                                  <div className={`text-xs font-medium flex items-center gap-1 ${
                                    match.userPL > 0 ? 'text-green-400' : 
                                    match.userPL < 0 ? 'text-red-400' : 'text-gray-400'
                                  }`}>
                                    Your P/L: {match.userPL > 0 ? '+' : ''}{formatCurrency(match.userPL)}
                                    <span className="text-xs">
                                      ({match.userPLPercent > 0 ? '+' : ''}{match.userPLPercent.toFixed(1)}%)
                                    </span>
                                  </div>
                                )}
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <MapPin className="h-5 w-5" />
                      Club Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <strong>Founded:</strong> {teamDetails.founded}
                    </div>
                    <div>
                      <strong>Venue:</strong> {teamDetails.venue}
                    </div>
                    <div>
                      <strong>Club Colors:</strong> {teamDetails.clubColors}
                    </div>
                    <div>
                      <strong>Website:</strong>{' '}
                      <a 
                        href={teamDetails.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        Visit Website <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Card className="">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Trophy className="h-5 w-5" />
                      Current Season
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {getTeamPosition() && (
                      <div>
                        <strong>League Position:</strong> #{getTeamPosition()}
                      </div>
                    )}
                    <div>
                      <strong>Recent Form:</strong>{' '}
                      <div className="flex gap-1 mt-1">
                        {getRecentForm().map((result, index) => (
                          <Badge 
                            key={index}
                            variant={result === 'W' ? 'success' : result === 'L' ? 'destructive' : 'secondary'}
                            className="w-6 h-6 flex items-center justify-center text-xs"
                          >
                            {result}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {teamDetails.coach && (
                <Card className="">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Users className="h-5 w-5" />
                      Coaching Staff
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div>
                        <strong>Manager:</strong> {teamDetails.coach.name}
                      </div>
                      <div>
                        <strong>Nationality:</strong> {teamDetails.coach.nationality}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="squad" className="space-y-4">
              <Card className="">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Users className="h-5 w-5" />
                    Squad ({teamDetails.squad?.length || 0} players)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamDetails.squad?.map((player) => (
                      <div key={player.id} className="border border-gray-600 rounded-lg p-3 hover:bg-gray-600 bg-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white">{player.name}</div>
                            <div className="text-sm text-gray-300">{player.position}</div>
                          </div>
                          <Badge variant="outline">#{player.shirtNumber}</Badge>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {player.nationality} • {new Date(player.dateOfBirth).getFullYear()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matches" className="space-y-4">
              <Card className="">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Calendar className="h-5 w-5" />
                    Recent Matches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {teamMatches.slice(0, 10).map((match) => {
                      const result = getMatchResult(match);
                      const isHome = match.homeTeam.id === teamId;
                      
                      return (
                        <div key={match.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-600">
                              {formatDate(match.utcDate)}
                            </div>
                            <div className="font-medium">
                              {isHome ? 'vs' : '@'} {isHome ? match.awayTeam.name : match.homeTeam.name}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {result && (
                              <>
                                <Badge 
                                  variant={result.result === 'W' ? 'success' : result.result === 'L' ? 'destructive' : 'secondary'}
                                >
                                  {result.result}
                                </Badge>
                                <span className="text-sm font-mono">{result.score}</span>
                              </>
                            )}
                            <Badge variant="outline">
                              {match.status === 'FINISHED' ? 'Finished' : 
                               match.status === 'LIVE' ? 'Live' : 
                               match.status === 'SCHEDULED' ? 'Scheduled' : match.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Target className="h-5 w-5" />
                      Season Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const teamStanding = standings.find(s => s.team.id === teamId);
                      if (!teamStanding) return <p>No statistics available</p>;
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Games Played:</span>
                            <span className="font-medium">{teamStanding.playedGames}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Wins:</span>
                            <span className="font-medium text-green-600">{teamStanding.won}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Draws:</span>
                            <span className="font-medium text-yellow-600">{teamStanding.draw}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Losses:</span>
                            <span className="font-medium text-red-600">{teamStanding.lost}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Goals For:</span>
                            <span className="font-medium">{teamStanding.goalsFor}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Goals Against:</span>
                            <span className="font-medium">{teamStanding.goalsAgainst}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Goal Difference:</span>
                            <span className="font-medium">{teamStanding.goalDifference > 0 ? '+' : ''}{teamStanding.goalDifference}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-bold">Points:</span>
                            <span className="font-bold text-lg">{teamStanding.points}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className="">
                  <CardHeader>
                    <CardTitle className="">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const teamStanding = standings.find(s => s.team.id === teamId);
                      if (!teamStanding) return <p>No metrics available</p>;
                      
                      const winRate = teamStanding.playedGames > 0 ? 
                        ((teamStanding.won / teamStanding.playedGames) * 100).toFixed(1) : '0';
                      const avgGoalsFor = teamStanding.playedGames > 0 ? 
                        (teamStanding.goalsFor / teamStanding.playedGames).toFixed(1) : '0';
                      const avgGoalsAgainst = teamStanding.playedGames > 0 ? 
                        (teamStanding.goalsAgainst / teamStanding.playedGames).toFixed(1) : '0';
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Win Rate:</span>
                            <span className="font-medium">{winRate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Goals For:</span>
                            <span className="font-medium">{avgGoalsFor}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Goals Against:</span>
                            <span className="font-medium">{avgGoalsAgainst}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeamDetailsModal;
