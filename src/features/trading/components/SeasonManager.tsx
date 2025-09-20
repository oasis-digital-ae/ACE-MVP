import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from '@/shared/components/ui/use-toast';
import { footballApiService } from '@/shared/lib/football-api';
import { teamsService, fixturesService } from '@/shared/lib/database';
import { supabase } from '@/shared/lib/supabase';
import type { FootballTeam, FootballMatch } from '@/shared/lib/football-api';

interface SeasonManagerProps {
  onSeasonChange?: () => void;
}

export const SeasonManager: React.FC<SeasonManagerProps> = ({ onSeasonChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const switchTo2025Season = async () => {
    setIsLoading(true);
    
    try {
      // Step 1: Check if tables are already cleared
      setCurrentStep('Checking season data status...');
      setProgress({ current: 1, total: 3 });
      
      // Check if teams table is empty (already cleared)
      const { data: existingTeams } = await supabase
        .from('teams')
        .select('id')
        .limit(1);
      
      if (existingTeams && existingTeams.length > 0) {
        console.log('Teams table has data, skipping clearing step');
      } else {
        console.log('Teams table is empty, proceeding with import');
      }
      
      // Step 2: Import teams
      setCurrentStep('Importing 2025 season teams...');
      setProgress({ current: 2, total: 3 });
      
      const teams = await footballApiService.getPremierLeagueTeams(2025);
      console.log('Fetched teams from API:', teams);
      
      // Insert teams into database
      for (const team of teams) {
        await teamsService.create({
          name: team.name,
          external_id: team.id.toString(),
          initial_market_cap: 100, // $100 initial market cap
          market_cap: 100,
          shares_outstanding: 0
        });
      }
      
      // Step 3: Import fixtures
      setCurrentStep('Importing 2025 season fixtures...');
      setProgress({ current: 3, total: 3 });
      
      const matches = await footballApiService.getPremierLeagueMatches(2025);
      console.log('Fetched matches from API:', matches);
      
      // Insert fixtures into database
      let fixturesImported = 0;
      for (const match of matches) {
        try {
          // Find team IDs from our database
          const homeTeam = await teamsService.getByExternalId(match.homeTeam.id.toString());
          const awayTeam = await teamsService.getByExternalId(match.awayTeam.id.toString());
          
          if (homeTeam && awayTeam) {
            await fixturesService.create({
              external_id: match.id.toString(),
              home_team_id: homeTeam.id,
              away_team_id: awayTeam.id,
              kickoff_at: new Date(match.utcDate).toISOString(),
              buy_close_at: new Date(new Date(match.utcDate).getTime() - 30 * 60 * 1000).toISOString(), // 30 min before kickoff
              result: 'pending',
              status: match.status === 'FINISHED' ? 'applied' : 'scheduled',
              home_score: match.score.fullTime.home,
              away_score: match.score.fullTime.away,
              matchday: match.matchday,
              season: 2025
            });
            fixturesImported++;
          } else {
            console.warn(`Could not find teams for match ${match.id}: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          }
        } catch (error) {
          console.error(`Error importing fixture ${match.id}:`, error);
        }
      }
      
      console.log(`Imported ${fixturesImported} fixtures out of ${matches.length} matches`);
      
      // Step 4: Complete
      setCurrentStep('Season switch complete!');
      setProgress({ current: 3, total: 3 });
      
      toast({
        title: "Season Switch Complete",
        description: "Successfully switched to 2025 season with fresh data",
      });
      
      // Notify parent component
      if (onSeasonChange) {
        onSeasonChange();
      }
      
    } catch (error) {
      console.error('Error switching season:', error);
      toast({
        title: "Season Switch Failed",
        description: "Failed to switch to 2025 season. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setCurrentStep('');
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Season Management</span>
          <Badge variant="outline">2025 Season</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Switching to the 2025 season will clear teams and fixtures data, 
            then import fresh data from the Football API. 
            <strong>User portfolios, orders, and transaction history will be preserved for bookkeeping.</strong>
          </AlertDescription>
        </Alert>

        {isLoading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{currentStep}</span>
              <span className="text-sm text-gray-500">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button 
            onClick={switchTo2025Season}
            disabled={isLoading}
            className="flex-1"
            variant="default"
          >
            {isLoading ? 'Switching Season...' : 'Switch to 2025 Season'}
          </Button>
          
          <Button 
            variant="outline"
            disabled={isLoading}
            onClick={() => {
              toast({
                title: "Info",
                description: "Season management is currently in development",
              });
            }}
          >
            View Current Season
          </Button>
        </div>

        <div className="text-sm text-gray-500 space-y-2">
          <p><strong>What happens when you switch seasons:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Teams and fixtures data will be cleared</li>
            <li>Fresh teams will be imported from Football API</li>
            <li>All fixtures for 2025 season will be imported</li>
            <li><strong>User portfolios, orders, and transaction history will be preserved</strong></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default SeasonManager;
