import { fixturesService, teamsService } from './database';
import { matchProcessingService } from './match-processing';

// Season simulation service for demonstrating the trading system
export const seasonSimulationService = {
  // Get all fixtures for the 2024-25 season
  async getAllSeasonFixtures(): Promise<any[]> {
    const fixtures = await fixturesService.getAll();
    
    // Sort by matchday and kickoff time
    return fixtures.sort((a, b) => {
      // First sort by matchday if available
      if (a.matchday && b.matchday) {
        if (a.matchday !== b.matchday) {
          return a.matchday - b.matchday;
        }
      }
      // Then sort by kickoff time
      return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
    });
  },

  // Get fixtures by matchday
  async getFixturesByMatchday(matchday: number): Promise<any[]> {
    const fixtures = await fixturesService.getAll();
    return fixtures.filter(f => f.matchday === matchday);
  },

  // Get current season progress
  async getSeasonProgress(): Promise<{
    totalFixtures: number;
    completedFixtures: number;
    upcomingFixtures: number;
    currentMatchday: number;
    seasonStart: string;
    seasonEnd: string;
  }> {
    const fixtures = await fixturesService.getAll();
    const now = new Date();
    
    const completedFixtures = fixtures.filter(f => f.status === 'applied' && f.result !== 'pending');
    const upcomingFixtures = fixtures.filter(f => f.status === 'scheduled');
    
    // Find current matchday (highest matchday with completed fixtures)
    const completedMatchdays = completedFixtures
      .map(f => f.matchday)
      .filter(md => md !== null)
      .sort((a, b) => b - a);
    
    const currentMatchday = completedMatchdays.length > 0 ? completedMatchdays[0] : 0;
    
    // Get season dates from fixtures
    const seasonStart = fixtures.length > 0 ? fixtures[0].kickoff_at : '';
    const seasonEnd = fixtures.length > 0 ? fixtures[fixtures.length - 1].kickoff_at : '';
    
    return {
      totalFixtures: fixtures.length,
      completedFixtures: completedFixtures.length,
      upcomingFixtures: upcomingFixtures.length,
      currentMatchday,
      seasonStart,
      seasonEnd
    };
  },

  // Simulate a single matchday
  async simulateMatchday(matchday: number, simulationSpeed: number = 1000): Promise<void> {
    const fixtures = await this.getFixturesByMatchday(matchday);
    
    console.log(`🎮 Simulating Matchday ${matchday} with ${fixtures.length} fixtures...`);
    
    for (const fixture of fixtures) {
      if (fixture.status === 'scheduled') {
        // Simulate a realistic result based on team market caps
        const result = await this.simulateRealisticResult(fixture);
        
        // Apply the result
        await matchProcessingService.simulateMatchResult(fixture.id, result);
        
        console.log(`✅ ${fixture.home_team?.name} vs ${fixture.away_team?.name}: ${result}`);
        
        // Add delay for realistic simulation
        if (simulationSpeed > 0) {
          await new Promise(resolve => setTimeout(resolve, simulationSpeed));
        }
      }
    }
    
    console.log(`🎉 Matchday ${matchday} simulation completed!`);
  },

  // Simulate a realistic result based on team market caps
  async simulateRealisticResult(fixture: any): Promise<'home_win' | 'away_win' | 'draw'> {
    // Get current team market caps
    const homeTeam = await teamsService.getById(fixture.home_team_id);
    const awayTeam = await teamsService.getById(fixture.away_team_id);
    
    if (!homeTeam || !awayTeam) {
      // Fallback to random result if teams not found
      const results = ['home_win', 'away_win', 'draw'] as const;
      return results[Math.floor(Math.random() * results.length)];
    }
    
    // Calculate probability based on market cap ratio
    const homeCap = homeTeam.market_cap;
    const awayCap = awayTeam.market_cap;
    const totalCap = homeCap + awayCap;
    
    const homeWinProbability = homeCap / totalCap;
    const awayWinProbability = awayCap / totalCap;
    const drawProbability = 0.25; // 25% chance of draw
    
    // Adjust probabilities to account for draw
    const adjustedHomeWin = homeWinProbability * (1 - drawProbability);
    const adjustedAwayWin = awayWinProbability * (1 - drawProbability);
    
    const random = Math.random();
    
    if (random < adjustedHomeWin) {
      return 'home_win';
    } else if (random < adjustedHomeWin + adjustedAwayWin) {
      return 'away_win';
    } else {
      return 'draw';
    }
  },

  // Simulate the entire season
  async simulateEntireSeason(simulationSpeed: number = 1000): Promise<void> {
    console.log('🚀 Starting 2024-25 Premier League Season Simulation...');
    
    const progress = await this.getSeasonProgress();
    const totalMatchdays = Math.max(...(await this.getAllSeasonFixtures()).map(f => f.matchday || 0));
    
    console.log(`📊 Season Overview:`);
    console.log(`- Total Matchdays: ${totalMatchdays}`);
    console.log(`- Total Fixtures: ${progress.totalFixtures}`);
    console.log(`- Current Progress: ${progress.completedFixtures}/${progress.totalFixtures} fixtures completed`);
    
    // Simulate each matchday
    for (let matchday = 1; matchday <= totalMatchdays; matchday++) {
      const fixtures = await this.getFixturesByMatchday(matchday);
      
      if (fixtures.length > 0) {
        console.log(`\n📅 Simulating Matchday ${matchday}...`);
        await this.simulateMatchday(matchday, simulationSpeed);
        
        // Show progress
        const currentProgress = await this.getSeasonProgress();
        console.log(`📈 Progress: ${currentProgress.completedFixtures}/${currentProgress.totalFixtures} fixtures completed`);
      }
    }
    
    console.log('\n🎉 2024-25 Premier League Season Simulation Completed!');
  },

  // Get team performance summary
  async getTeamPerformanceSummary(): Promise<{
    teamId: string;
    teamName: string;
    initialMarketCap: number;
    currentMarketCap: number;
    totalChange: number;
    percentChange: number;
    wins: number;
    losses: number;
    draws: number;
  }[]> {
    const teams = await teamsService.getAll();
    const fixtures = await fixturesService.getAll();
    
    return teams.map(team => {
      // Count wins, losses, draws for this team
      const teamFixtures = fixtures.filter(f => 
        f.home_team_id === team.id || f.away_team_id === team.id
      );
      
      let wins = 0;
      let losses = 0;
      let draws = 0;
      
      teamFixtures.forEach(fixture => {
        if (fixture.result === 'pending') return;
        
        const isHomeTeam = fixture.home_team_id === team.id;
        
        if (fixture.result === 'draw') {
          draws++;
        } else if (
          (isHomeTeam && fixture.result === 'home_win') ||
          (!isHomeTeam && fixture.result === 'away_win')
        ) {
          wins++;
        } else {
          losses++;
        }
      });
      
      const totalChange = team.market_cap - team.initial_market_cap;
      const percentChange = (totalChange / team.initial_market_cap) * 100;
      
      return {
        teamId: team.id,
        teamName: team.name,
        initialMarketCap: team.initial_market_cap,
        currentMarketCap: team.market_cap,
        totalChange,
        percentChange,
        wins,
        losses,
        draws
      };
    }).sort((a, b) => b.currentMarketCap - a.currentMarketCap);
  },

  // Reset season simulation (for testing)
  async resetSeasonSimulation(): Promise<void> {
    console.log('🔄 Resetting season simulation...');
    
    const fixtures = await fixturesService.getAll();
    
    // Reset all fixtures to scheduled status with pending results
    for (const fixture of fixtures) {
      await fixturesService.updateResult(fixture.id, 'pending');
      // Note: We'd need to add a method to reset fixture status
    }
    
    // Reset team market caps to initial values
    const teams = await teamsService.getAll();
    for (const team of teams) {
      await teamsService.updateMarketCap(team.id, team.initial_market_cap);
    }
    
    console.log('✅ Season simulation reset completed');
  }
};

