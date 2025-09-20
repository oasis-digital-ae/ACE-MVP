import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { teamsService, fixturesService, positionsService } from '@/shared/lib/database';
import { matchProcessingService } from '@/shared/lib/match-processing';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { supabase } from '@/shared/lib/supabase';

const SeasonSimulation: React.FC = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [simulationResults, setSimulationResults] = useState<string>('');
    const [currentStep, setCurrentStep] = useState(0);
    const [availableGames, setAvailableGames] = useState<any[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<string>('');
    const [nextGame, setNextGame] = useState<any>(null);
    const [teams, setTeams] = useState<any[]>([]);

    // Load available games on component mount
    useEffect(() => {
        loadAvailableGames();
    }, []);

    const loadAvailableGames = async () => {
        try {
            const [fixtures, teamsData] = await Promise.all([
                fixturesService.getAll(),
                teamsService.getAll()
            ]);
            
            setTeams(teamsData);
            
            if (fixtures) {
                console.log('All fixtures:', fixtures);
                console.log('Fixture statuses:', fixtures.map(f => ({ id: f.id, status: f.status, result: f.result })));
                
                // Get games that can be simulated (scheduled or have results but no market cap snapshots)
                // For now, let's show ALL fixtures for testing
                const simulatableGames = fixtures.filter(f => 
                    f.status === 'scheduled' || 
                    f.status === 'applied' ||
                    f.status === 'closed' ||
                    f.status === 'postponed' ||
                    !f.status // Handle null/undefined status
                );
                
                console.log('Simulatable games:', simulatableGames);
                setAvailableGames(simulatableGames);
                
                // Find the next game (earliest kickoff time)
                if (simulatableGames.length > 0) {
                    const sortedGames = simulatableGames.sort((a, b) => 
                        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
                    );
                    setNextGame(sortedGames[0]);
                    setSelectedGameId(sortedGames[0].id.toString());
                }
            }
        } catch (error) {
            console.error('Error loading available games:', error);
        }
    };

    const simulateSingleGame = async (gameId?: string) => {
        if (!user) {
            setSimulationResults('❌ You must be logged in to run simulation');
            return;
        }

        setIsLoading(true);
        setSimulationResults('');

        try {
            const gameToSimulate = gameId ? 
                availableGames.find(g => g.id === gameId) : 
                nextGame;

            if (!gameToSimulate) {
                setSimulationResults('❌ No game selected for simulation');
                return;
            }

            // Simulate realistic result based on market caps
            const teams = await teamsService.getAll();
            const homeTeam = teams.find(t => t.id === gameToSimulate.home_team_id);
            const awayTeam = teams.find(t => t.id === gameToSimulate.away_team_id);

            if (!homeTeam || !awayTeam) {
                setSimulationResults('❌ Team data not found');
                return;
            }

            const homeMarketCap = homeTeam.market_cap;
            const awayMarketCap = awayTeam.market_cap;
            
            // Higher market cap = higher chance to win
            const homeWinProb = homeMarketCap / (homeMarketCap + awayMarketCap);
            const random = Math.random();
            
            let result: 'home_win' | 'away_win' | 'draw';
            let homeScore: number;
            let awayScore: number;
            
            if (random < homeWinProb * 0.7) {
                result = 'home_win';
                homeScore = Math.floor(Math.random() * 3) + 1;
                awayScore = Math.floor(Math.random() * 2);
            } else if (random < homeWinProb * 0.7 + (1 - homeWinProb) * 0.7) {
                result = 'away_win';
                awayScore = Math.floor(Math.random() * 3) + 1;
                homeScore = Math.floor(Math.random() * 2);
            } else {
                result = 'draw';
                homeScore = Math.floor(Math.random() * 2) + 1;
                awayScore = homeScore;
            }

            // Update the fixture with simulated result
            const { error } = await supabase
                .from('fixtures')
                .update({
                    status: 'applied',
                    result: result,
                    home_score: homeScore,
                    away_score: awayScore,
                    snapshot_home_cap: homeTeam.market_cap,
                    snapshot_away_cap: awayTeam.market_cap
                })
                .eq('id', gameToSimulate.id);

            if (error) {
                setSimulationResults(`❌ Error updating fixture: ${error.message}`);
            } else {
                // Process the match result immediately to update market caps
                try {
                    await teamsService.captureMarketCapSnapshot(gameToSimulate.id);
                    await teamsService.processMatchResult(gameToSimulate.id);
                    
                    // Reload teams to show updated market caps
                    const updatedTeams = await teamsService.getAll();
                    const updatedHomeTeam = updatedTeams.find(t => t.id === homeTeam.id);
                    const updatedAwayTeam = updatedTeams.find(t => t.id === awayTeam.id);
                    
                    let marketCapUpdate = '';
                    if (updatedHomeTeam && updatedAwayTeam) {
                        const homePrice = updatedHomeTeam.shares_outstanding > 0 ? updatedHomeTeam.market_cap / updatedHomeTeam.shares_outstanding : 20;
                        const awayPrice = updatedAwayTeam.shares_outstanding > 0 ? updatedAwayTeam.market_cap / updatedAwayTeam.shares_outstanding : 20;
                        
                        marketCapUpdate = `\n📊 Market Cap Updates:\n`;
                        marketCapUpdate += `• ${homeTeam.name}: $${homeTeam.market_cap.toFixed(2)} → $${updatedHomeTeam.market_cap.toFixed(2)} (Price: $${homePrice.toFixed(2)})\n`;
                        marketCapUpdate += `• ${awayTeam.name}: $${awayTeam.market_cap.toFixed(2)} → $${updatedAwayTeam.market_cap.toFixed(2)} (Price: $${awayPrice.toFixed(2)})\n`;
                    }
                    
                    setSimulationResults(`✅ ${homeTeam.name} vs ${awayTeam.name}: ${homeScore}-${awayScore} (${result})${marketCapUpdate}\n\n🎉 Match processed! Market caps updated based on result.`);
                } catch (processError) {
                    setSimulationResults(`✅ ${homeTeam.name} vs ${awayTeam.name}: ${homeScore}-${awayScore} (${result})\n\n❌ Error processing match result: ${processError}`);
                }
            }

        } catch (error) {
            setSimulationResults(`❌ Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const simulateNextGame = async () => {
        if (nextGame) {
            await simulateSingleGame(nextGame.id);
        } else {
            setSimulationResults('❌ No next game available');
        }
    };

    const simulateSeason = async () => {
        if (!user) {
            setSimulationResults('❌ You must be logged in to run simulation');
            return;
        }

        setIsLoading(true);
        setSimulationResults('');
        setCurrentStep(0);

        try {
            let results = '🏆 Premier League Season Simulation\n';
            results += '=====================================\n\n';

            // Step 1: Show initial state
            setCurrentStep(1);
            results += '📊 STEP 1: Initial Market State\n';
            results += '-------------------------------\n';

            const teams = await teamsService.getAll();
            if (!teams || teams.length === 0) {
                throw new Error('No teams found in database');
            }
            results += `✅ Found ${teams.length} teams\n`;

            const userPositions = await positionsService.getUserPositions(user.id);
            results += `✅ User positions loaded (${userPositions.length} holdings)\n\n`;

            results += `Current Market State:\n`;
            teams.slice(0, 5).forEach(team => {
                const price = team.shares_outstanding > 0 ? team.market_cap / team.shares_outstanding : 20;
                results += `• ${team.name}: Market Cap $${team.market_cap.toFixed(2)}, Price $${price.toFixed(2)}\n`;
            });
            results += '\n';

            if (userPositions.length > 0) {
                results += `Your Holdings:\n`;
                userPositions.forEach(pos => {
                    const team = teams.find(t => t.id === pos.team_id);
                    if (team) {
                        const nav = team.shares_outstanding > 0 ? team.market_cap / team.shares_outstanding : 20;
                        const avgCost = pos.quantity > 0 ? pos.total_invested / pos.quantity : 0;
                        const profitLoss = (nav - avgCost) * pos.quantity;
                        results += `• ${team.name}: ${pos.quantity} shares @ avg $${avgCost.toFixed(2)} = $${(pos.quantity * nav).toFixed(2)} (${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)})\n`;
                    }
                });
                results += '\n';
            }

            // Step 2: Process current fixtures
            setCurrentStep(2);
            results += '⚽ STEP 2: Processing Current Fixtures\n';
            results += '-------------------------------------\n';

            const fixtures = await fixturesService.getAll();
            if (!fixtures) {
                throw new Error('Failed to fetch fixtures from database');
            }
            results += `✅ Found ${fixtures.length} total fixtures\n`;
            
            // Find fixtures that have results but need market cap processing
            const fixturesToProcess = fixtures.filter(f => 
                f.status === 'applied' && 
                f.result !== 'pending' && 
                f.result !== null &&
                (f.snapshot_home_cap === null || f.snapshot_away_cap === null)
            );
            
            results += `✅ Found ${fixturesToProcess.length} fixtures ready for processing\n\n`;

            if (fixturesToProcess.length === 0) {
                results += 'ℹ️ No fixtures need processing right now.\n';
                results += 'All fixtures either:\n';
                results += '• Haven\'t been played yet (status = scheduled)\n';
                results += '• Already been processed (have market cap snapshots)\n';
                results += '• Have pending results\n\n';
                
                // Show some scheduled fixtures for reference
                const scheduledFixtures = fixtures.filter(f => f.status === 'scheduled').slice(0, 5);
                if (scheduledFixtures.length > 0) {
                    results += '📅 Upcoming fixtures:\n';
                    scheduledFixtures.forEach(f => {
                        const homeTeam = teams.find(t => t.id === f.home_team_id);
                        const awayTeam = teams.find(t => t.id === f.away_team_id);
                        if (homeTeam && awayTeam) {
                            results += `• ${homeTeam.name} vs ${awayTeam.name}\n`;
                        }
                    });
                }
                
                setSimulationResults(results);
                setIsLoading(false);
                return;
            }

            // Process fixtures
            let processedCount = 0;
            for (const fixture of fixturesToProcess.slice(0, 20)) { // Process max 20 at a time
                try {
                    // Get team names for display
                    const homeTeam = teams.find(t => t.id === fixture.home_team_id);
                    const awayTeam = teams.find(t => t.id === fixture.away_team_id);
                    const teamNames = homeTeam && awayTeam ? `${homeTeam.name} vs ${awayTeam.name}` : `Fixture ${fixture.id}`;
                    
                    // Capture snapshot if missing
                    if (!fixture.snapshot_home_cap || !fixture.snapshot_away_cap) {
                        await teamsService.captureMarketCapSnapshot(fixture.id);
                    }
                    
                    // Process the match result
                    await teamsService.processMatchResult(fixture.id);
                    
                    processedCount++;
                    const score = `${fixture.home_score || 0}-${fixture.away_score || 0}`;
                    results += `✅ ${teamNames}: ${score} (${fixture.result})\n`;
                    
                    // Update progress
                    setSimulationResults(results);
                    
                } catch (error) {
                    results += `❌ Error processing fixture ${fixture.id}: ${error}\n`;
                }
            }

            results += `\n🎉 Processed ${processedCount} fixtures!\n\n`;

            // Step 3: Show final state
            setCurrentStep(3);
            results += '📊 STEP 3: Final Market State\n';
            results += '-----------------------------\n';

            // Reload teams to show updated market caps
            const updatedTeams = await teamsService.getAll();
            results += `Updated Market Caps:\n`;
            updatedTeams.slice(0, 5).forEach(team => {
                const price = team.shares_outstanding > 0 ? team.market_cap / team.shares_outstanding : 20;
                results += `• ${team.name}: Market Cap $${team.market_cap.toFixed(2)}, Price $${price.toFixed(2)}\n`;
            });

            if (userPositions.length > 0) {
                results += `\nYour Updated Holdings:\n`;
                const updatedPositions = await positionsService.getUserPositions(user.id);
                updatedPositions.forEach(pos => {
                    const team = updatedTeams.find(t => t.id === pos.team_id);
                    if (team) {
                        const nav = team.shares_outstanding > 0 ? team.market_cap / team.shares_outstanding : 20;
                        const avgCost = pos.quantity > 0 ? pos.total_invested / pos.quantity : 0;
                        const profitLoss = (nav - avgCost) * pos.quantity;
                        results += `• ${team.name}: ${pos.quantity} shares @ avg $${avgCost.toFixed(2)} = $${(pos.quantity * nav).toFixed(2)} (${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)})\n`;
                    }
                });
            }

            results += `\n🏆 Simulation Complete! Market caps updated based on match results.\n`;

            setSimulationResults(results);
        } catch (error) {
            console.error('Simulation error:', error);
            setSimulationResults(`❌ Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const simulateMatchResults = async () => {
        if (!user) {
            setSimulationResults('❌ You must be logged in to simulate match results');
            return;
        }

        setIsLoading(true);
        setSimulationResults('');

        try {
            let results = '🎮 Simulating Match Results\n';
            results += '===========================\n\n';

            // Get scheduled fixtures
            const fixtures = await fixturesService.getAll();
            const scheduledFixtures = fixtures.filter(f => f.status === 'scheduled').slice(0, 5);
            
            if (scheduledFixtures.length === 0) {
                results += 'ℹ️ No scheduled fixtures found to simulate.\n';
                results += 'All fixtures may have already been played or processed.\n';
                setSimulationResults(results);
                setIsLoading(false);
                return;
            }

            results += `Found ${scheduledFixtures.length} scheduled fixtures to simulate:\n\n`;

            // Get teams for reference
            const teams = await teamsService.getAll();
            const teamsMap = new Map(teams.map(team => [team.id, team]));

            // Simulate results for each fixture
            for (const fixture of scheduledFixtures) {
                const homeTeam = teamsMap.get(fixture.home_team_id);
                const awayTeam = teamsMap.get(fixture.away_team_id);
                
                if (!homeTeam || !awayTeam) {
                    results += `❌ Skipping fixture ${fixture.id} - team data missing\n`;
                    continue;
                }

                // Simulate a realistic result based on market caps
                const homeMarketCap = homeTeam.market_cap;
                const awayMarketCap = awayTeam.market_cap;
                
                // Higher market cap = higher chance to win
                const homeWinProb = homeMarketCap / (homeMarketCap + awayMarketCap);
                const random = Math.random();
                
                let result: 'home_win' | 'away_win' | 'draw';
                let homeScore: number;
                let awayScore: number;
                
                if (random < homeWinProb * 0.7) { // 70% of win probability goes to actual win
                    result = 'home_win';
                    homeScore = Math.floor(Math.random() * 3) + 1;
                    awayScore = Math.floor(Math.random() * 2);
                } else if (random < homeWinProb * 0.7 + (1 - homeWinProb) * 0.7) {
                    result = 'away_win';
                    awayScore = Math.floor(Math.random() * 3) + 1;
                    homeScore = Math.floor(Math.random() * 2);
                } else {
                    result = 'draw';
                    homeScore = Math.floor(Math.random() * 2) + 1;
                    awayScore = homeScore;
                }

                // Update the fixture with simulated result
                const { error } = await supabase
                    .from('fixtures')
                    .update({
                        status: 'applied',
                        result: result,
                        home_score: homeScore,
                        away_score: awayScore,
                        snapshot_home_cap: homeTeam.market_cap,
                        snapshot_away_cap: awayTeam.market_cap
                    })
                    .eq('id', fixture.id);

                if (error) {
                    results += `❌ Error updating fixture ${fixture.id}: ${error.message}\n`;
                } else {
                    results += `✅ ${homeTeam.name} vs ${awayTeam.name}: ${homeScore}-${awayScore} (${result})\n`;
                }
            }

            results += `\n🎉 Simulated ${scheduledFixtures.length} match results!\n`;
            results += `Now run "Run Season Simulation" to process these results and update market caps.\n`;

            setSimulationResults(results);
        } catch (error) {
            console.error('Simulation error:', error);
            setSimulationResults(`❌ Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const resetSimulation = () => {
        setSimulationResults('');
        setCurrentStep(0);
    };

    const forceResetSimulation = async () => {
        if (!user) return;
        
        setIsLoading(true);
        try {
            await teamsService.forceResetAll();
            setSimulationResults('🔄 Force reset completed! All teams reset to $100 market cap.\n');
        } catch (error) {
            setSimulationResults(`❌ Reset failed: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Per-Game Simulation Card */}
            <Card>
                <CardHeader>
                    <CardTitle>⚽ Per-Game Simulation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select a game to simulate" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableGames.map((game) => {
                                    const homeTeam = teams.find(t => t.id === game.home_team_id);
                                    const awayTeam = teams.find(t => t.id === game.away_team_id);
                                    return (
                                        <SelectItem key={game.id} value={game.id}>
                                            {homeTeam?.name || 'Home'} vs {awayTeam?.name || 'Away'}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={() => simulateSingleGame(selectedGameId)}
                            disabled={isLoading || !selectedGameId}
                        >
                            {isLoading ? 'Simulating...' : 'Simulate Selected Game'}
                        </Button>
                        <Button
                            onClick={simulateNextGame}
                            disabled={isLoading || !nextGame}
                            variant="outline"
                        >
                            {isLoading ? 'Simulating...' : 'Simulate Next Game'}
                        </Button>
                    </div>
                    
                    {/* Debug Info */}
                    <div className="text-sm text-gray-400 space-y-2">
                        <p>Available games: {availableGames.length}</p>
                        <p>Teams loaded: {teams.length}</p>
                        {availableGames.length === 0 && (
                            <p className="text-yellow-400">No games available for simulation. Check console for details.</p>
                        )}
                        <Button
                            onClick={loadAvailableGames}
                            disabled={isLoading}
                            variant="secondary"
                            size="sm"
                        >
                            🔄 Refresh Games
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Full Season Simulation Card */}
            <Card>
                <CardHeader>
                    <CardTitle>🏆 Full Season Simulation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 flex-wrap">
                        <Button
                            onClick={simulateMatchResults}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? 'Simulating...' : '🎮 Simulate New Results'}
                        </Button>
                        <Button
                            onClick={simulateSeason}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            {isLoading ? 'Running Simulation...' : '🏆 Run Season Simulation'}
                        </Button>
                        <Button
                            onClick={resetSimulation}
                            disabled={isLoading}
                            variant="outline"
                        >
                            Reset Simulation
                        </Button>
                        <Button
                            onClick={forceResetSimulation}
                            disabled={isLoading}
                            variant="destructive"
                        >
                            Force Reset (Ignore Investments)
                        </Button>
                    </div>

                    {currentStep > 0 && (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                {currentStep === 1 ? 'Loading...' : 
                                 currentStep === 2 ? 'Processing...' : 
                                 currentStep === 3 ? 'Complete!' : 'Ready'}
                            </Badge>
                            <span className="text-sm text-gray-400">
                                Step {currentStep} of 3
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Results Display */}
            {simulationResults && (
                <Card>
                    <CardHeader>
                        <CardTitle>📊 Simulation Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-800 p-4 rounded-lg overflow-auto max-h-96">
                            {simulationResults}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default SeasonSimulation;