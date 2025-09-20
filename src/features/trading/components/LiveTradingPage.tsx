import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useAppContext } from '../contexts/AppContext';
import ClickableTeamName from '@/shared/components/ClickableTeamName';
import { Play, Pause, RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import { teamsService, convertTeamToClub } from '@/shared/lib/database';

const LiveTradingPage: React.FC = () => {
  const { liveMatches, refreshLiveMatches, standings, refreshStandings, clubs } = useAppContext();
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [mockScores, setMockScores] = useState<Record<number, { home: number; away: number }>>({});
  const [marketCapHistory, setMarketCapHistory] = useState<Record<string, number[]>>({});
  const [winPercentages, setWinPercentages] = useState<Record<string, number>>({});

  useEffect(() => {
    // Initial load with error handling
    const loadData = async () => {
      try {
        await refreshLiveMatches();
        await refreshStandings();
      } catch (error) {
        console.error('Error loading live trading data:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    // Initialize mock scores and market data when liveMatches change
    if (liveMatches.length > 0) {
      const initialScores: Record<number, { home: number; away: number }> = {};
      const initialMarketCaps: Record<string, number[]> = {};
      const initialWinPercentages: Record<string, number> = {};
      
      liveMatches.forEach(match => {
        initialScores[match.id] = {
          home: match.score.fullTime.home || 0,
          away: match.score.fullTime.away || 0
        };
        
        // Get real market cap from clubs data with fallback matching
        let homeClub = clubs.find(club => club.name === match.homeTeam.name);
        let awayClub = clubs.find(club => club.name === match.awayTeam.name);
        
        // Fallback: try partial matching if exact match fails
        if (!homeClub) {
          homeClub = clubs.find(club => 
            club.name.toLowerCase().includes(match.homeTeam.name.toLowerCase()) ||
            match.homeTeam.name.toLowerCase().includes(club.name.toLowerCase())
          );
        }
        
        if (!awayClub) {
          awayClub = clubs.find(club => 
            club.name.toLowerCase().includes(match.awayTeam.name.toLowerCase()) ||
            match.awayTeam.name.toLowerCase().includes(club.name.toLowerCase())
          );
        }
        
        // Debug logging
        console.log('Team matching debug:', {
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          homeClubFound: !!homeClub,
          awayClubFound: !!awayClub,
          homeClubName: homeClub?.name,
          awayClubName: awayClub?.name,
          homeClubMarketCap: homeClub?.marketCap,
          awayClubMarketCap: awayClub?.marketCap,
          allClubNames: clubs.map(c => c.name)
        });
        
        // Initialize market cap history with real data from database
        // Use the raw marketCap from clubs (which is the total market cap)
        // If the market cap is too small (< 1000), use realistic Premier League values
        const getRealisticMarketCap = (club: any, teamName: string) => {
          if (club && club.marketCap > 1000) {
            return club.marketCap;
          }
          // Use realistic Premier League market cap values (in millions)
          const realisticValues: Record<string, number> = {
            'Arsenal': 2000000000,      // $2B
            'Manchester City': 1500000000, // $1.5B
            'Liverpool': 1800000000,     // $1.8B
            'Chelsea': 1200000000,      // $1.2B
            'Manchester United': 1600000000, // $1.6B
            'Tottenham Hotspur': 1000000000, // $1B
            'Newcastle United': 800000000,  // $800M
            'Aston Villa': 600000000,    // $600M
            'West Ham United': 500000000, // $500M
            'Crystal Palace': 400000000, // $400M
          };
          return realisticValues[teamName] || 500000000; // Default $500M
        };
        
        initialMarketCaps[match.homeTeam.name] = [getRealisticMarketCap(homeClub, match.homeTeam.name)];
        initialMarketCaps[match.awayTeam.name] = [getRealisticMarketCap(awayClub, match.awayTeam.name)];
        
        // Initialize win percentages (mock data for now)
        initialWinPercentages[match.homeTeam.name] = Math.random() * 100;
        initialWinPercentages[match.awayTeam.name] = Math.random() * 100;
      });
      
      setMockScores(initialScores);
      setMarketCapHistory(initialMarketCaps);
      setWinPercentages(initialWinPercentages);
    }
  }, [liveMatches, clubs]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLive) {
      // Update every 5 seconds when live
      interval = setInterval(async () => {
        refreshLiveMatches();
        refreshStandings();
        setLastUpdate(new Date());
        
        // Simulate market fluctuations
        setMarketCapHistory(prev => {
          const newHistory = { ...prev };
          Object.keys(newHistory).forEach(teamName => {
            const currentCap = newHistory[teamName][newHistory[teamName].length - 1];
            // Random fluctuation between -5% and +5%
            const fluctuation = (Math.random() - 0.5) * 0.1; // -5% to +5%
            const newCap = Math.max(currentCap * (1 + fluctuation), 100000000); // Minimum 100M
            newHistory[teamName] = [...newHistory[teamName], newCap];
          });
          return newHistory;
        });
        
        // Sync with real database data periodically (every 5 updates = 2.5 minutes)
        if (Math.random() < 0.2) { // 20% chance to sync with real data
          try {
            const dbTeams = await teamsService.getAll();
            const convertedClubs = dbTeams.map(convertTeamToClub);
            
            setMarketCapHistory(prev => {
              const newHistory = { ...prev };
              Object.keys(newHistory).forEach(teamName => {
                let realClub = convertedClubs.find(club => club.name === teamName);
                
                // Fallback: try partial matching if exact match fails
                if (!realClub) {
                  realClub = convertedClubs.find(club => 
                    club.name.toLowerCase().includes(teamName.toLowerCase()) ||
                    teamName.toLowerCase().includes(club.name.toLowerCase())
                  );
                }
                
                if (realClub) {
                  // Blend real data with simulated data (70% real, 30% simulated)
                  // But only if the real data is realistic (> 1000)
                  const realCap = realClub.marketCap > 1000 ? realClub.marketCap : 
                    (() => {
                      const realisticValues: Record<string, number> = {
                        'Arsenal': 2000000000,
                        'Manchester City': 1500000000,
                        'Liverpool': 1800000000,
                        'Chelsea': 1200000000,
                        'Manchester United': 1600000000,
                        'Tottenham Hotspur': 1000000000,
                        'Newcastle United': 800000000,
                        'Aston Villa': 600000000,
                        'West Ham United': 500000000,
                        'Crystal Palace': 400000000,
                      };
                      return realisticValues[teamName] || 500000000;
                    })();
                  
                  const simulatedCap = newHistory[teamName][newHistory[teamName].length - 1];
                  const blendedCap = realCap * 0.7 + simulatedCap * 0.3;
                  newHistory[teamName] = [...newHistory[teamName], blendedCap];
                  
                  console.log('Synced market cap:', {
                    teamName,
                    realClubName: realClub.name,
                    realCap,
                    simulatedCap,
                    blendedCap
                  });
                }
              });
              return newHistory;
            });
          } catch (error) {
            console.error('Error syncing with database:', error);
          }
        }
        
        // Simulate win percentage changes
        setWinPercentages(prev => {
          const newPercentages = { ...prev };
          Object.keys(newPercentages).forEach(teamName => {
            const currentPercentage = newPercentages[teamName];
            // Small random change between -2% and +2%
            const change = (Math.random() - 0.5) * 4; // -2% to +2%
            const newPercentage = Math.max(0, Math.min(100, currentPercentage + change));
            newPercentages[teamName] = newPercentage;
          });
          return newPercentages;
        });
        
        // Simulate random score updates
        setMockScores(prev => {
          const newScores = { ...prev };
          Object.keys(newScores).forEach(matchId => {
            const id = parseInt(matchId);
            // Use current liveMatches from state instead of dependency
            const match = liveMatches.find(m => m.id === id);
            if (match && (match.status === 'LIVE' || match.status === 'IN_PLAY')) {
              // Randomly update scores (10% chance per update)
              if (Math.random() < 0.1) {
                const isHomeGoal = Math.random() < 0.5;
                if (isHomeGoal) {
                  newScores[id].home += 1;
                } else {
                  newScores[id].away += 1;
                }
              }
            }
          });
          return newScores;
        });
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, refreshLiveMatches, refreshStandings]);

  const simulateGoal = (matchId: number, isHome: boolean) => {
    setMockScores(prev => {
      const currentScores = prev[matchId] || { home: 0, away: 0 };
      return {
        ...prev,
        [matchId]: {
          home: isHome ? currentScores.home + 1 : currentScores.home,
          away: isHome ? currentScores.away : currentScores.away + 1
        }
      };
    });
  };

  const toggleLiveMode = () => {
    setIsLive(!isLive);
    if (!isLive) {
      setLastUpdate(new Date());
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMarketCapChange = (teamName: string) => {
    const history = marketCapHistory[teamName];
    if (!history || history.length < 2) return { change: 0, percentage: 0 };
    
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    const change = current - previous;
    const percentage = (change / previous) * 100;
    
    return { change, percentage };
  };

  const getCurrentMarketCap = (teamName: string) => {
    const history = marketCapHistory[teamName];
    return history ? history[history.length - 1] : 0;
  };

  const getMatchStatus = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <Badge className="bg-red-500 text-white animate-pulse">LIVE</Badge>;
      case 'IN_PLAY':
        return <Badge className="bg-red-500 text-white animate-pulse">IN PLAY</Badge>;
      case 'PAUSED':
        return <Badge className="bg-yellow-500 text-white">PAUSED</Badge>;
      case 'FINISHED':
        return <Badge className="bg-green-500 text-white">FINISHED</Badge>;
      case 'SCHEDULED':
        return <Badge variant="outline">SCHEDULED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTeamPosition = (teamId: number) => {
    const teamStanding = standings.find(s => s.team.id === teamId);
    return teamStanding ? `#${teamStanding.position}` : 'N/A';
  };

  const getPositionTrend = (teamId: number) => {
    const teamStanding = standings.find(s => s.team.id === teamId);
    if (!teamStanding) return null;
    
    // This would need historical data to show actual trends
    // For now, we'll show a placeholder
    return Math.random() > 0.5 ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8" />
            Live Market Updates
            <Badge className="bg-yellow-500 text-black">TEST MODE</Badge>
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time market cap fluctuations and win percentage changes
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Market caps: Real data from database + simulated fluctuations | Win rates: Simulated for demo
          </p>
          <div className="text-xs text-gray-500 mt-1">
            <strong>Debug Info:</strong> {clubs.length} clubs loaded | 
            Live matches: {liveMatches.length} | 
            Market cap history: {Object.keys(marketCapHistory).length} teams
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm text-gray-400">
              {isLive ? 'Live Updates' : 'Manual Mode'}
            </span>
          </div>
          
          {lastUpdate && (
            <div className="text-sm text-gray-400">
              Last update: {formatTime(lastUpdate)}
            </div>
          )}
          
          <Button
            onClick={toggleLiveMode}
            variant={isLive ? "destructive" : "default"}
            className="flex items-center gap-2"
          >
            {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isLive ? 'Stop Live' : 'Start Live'}
          </Button>
          
          <Button
            onClick={() => {
              refreshLiveMatches();
              refreshStandings();
              setLastUpdate(new Date());
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Live Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Matches ({liveMatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No live matches at the moment</p>
              <p className="text-sm mt-2">Check back during match times</p>
            </div>
          ) : (
            <div className="space-y-4">
              {liveMatches.map((match) => (
                <div key={match.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getMatchStatus(match.status)}
                      <span className="text-sm text-gray-600">
                        Matchday {match.matchday}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(match.utcDate).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <ClickableTeamName
                            teamName={match.homeTeam.name}
                            teamId={match.homeTeam.id}
                            className="font-medium hover:text-blue-600"
                          />
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{getTeamPosition(match.homeTeam.id)}</span>
                            {getPositionTrend(match.homeTeam.id)}
                          </div>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Market Cap:</span>
                            <span className="font-medium">{formatCurrency(getCurrentMarketCap(match.homeTeam.name))}</span>
                            {(() => {
                              const { change, percentage } = getMarketCapChange(match.homeTeam.name);
                              return (
                                <span className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {change >= 0 ? '+' : ''}{percentage.toFixed(2)}%
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Win Rate:</span>
                            <span className="font-medium">{winPercentages[match.homeTeam.name]?.toFixed(1) || '0.0'}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mx-8">
                      <div className="text-2xl font-bold">
                        {mockScores[match.id]?.home !== undefined ? mockScores[match.id].home : (match.score.fullTime.home !== null ? match.score.fullTime.home : '-')}
                      </div>
                      <div className="text-gray-400">vs</div>
                      <div className="text-2xl font-bold">
                        {mockScores[match.id]?.away !== undefined ? mockScores[match.id].away : (match.score.fullTime.away !== null ? match.score.fullTime.away : '-')}
                      </div>
                    </div>
                    
                    <div className="flex-1 text-right">
                      <div className="space-y-2">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            {getPositionTrend(match.awayTeam.id)}
                            <span>{getTeamPosition(match.awayTeam.id)}</span>
                          </div>
                          <ClickableTeamName
                            teamName={match.awayTeam.name}
                            teamId={match.awayTeam.id}
                            className="font-medium hover:text-blue-600"
                          />
                        </div>
                        <div className="text-sm space-y-1 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-600">Market Cap:</span>
                            <span className="font-medium">{formatCurrency(getCurrentMarketCap(match.awayTeam.name))}</span>
                            {(() => {
                              const { change, percentage } = getMarketCapChange(match.awayTeam.name);
                              return (
                                <span className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {change >= 0 ? '+' : ''}{percentage.toFixed(2)}%
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-600">Win Rate:</span>
                            <span className="font-medium">{winPercentages[match.awayTeam.name]?.toFixed(1) || '0.0'}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {match.status === 'LIVE' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Duration: {match.score.duration}
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            View Team Details
                          </Button>
                          <Button size="sm" variant="outline">
                            Market Analysis
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => simulateGoal(match.id, true)}
                          >
                            +1 Home
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => simulateGoal(match.id, false)}
                          >
                            +1 Away
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{liveMatches.length}</div>
            <p className="text-sm text-gray-600">Currently playing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Market Volatility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">High</div>
            <p className="text-sm text-gray-600">Live match impact</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">5s</div>
            <p className="text-sm text-gray-600">When live mode is on</p>
          </CardContent>
        </Card>
      </div>

      {/* Market Analysis Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Live Market Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <strong>Watch market cap fluctuations:</strong> Live match events cause real-time changes in team valuations (updates every 5 seconds)
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <strong>Monitor win percentages:</strong> Team performance metrics update dynamically during matches
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div>
                <strong>Track momentum shifts:</strong> Goals and key events trigger immediate market reactions
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
              <div>
                <strong>Analyze patterns:</strong> Historical data helps predict future market movements
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveTradingPage;
