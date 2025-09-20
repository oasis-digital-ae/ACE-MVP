import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { footballApiService, footballIntegrationService } from '@/shared/lib/football-api';
import { fixturesService } from '@/shared/lib/database';
import { supabase } from '@/shared/lib/supabase';

const FootballApiTest: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testFootballApi = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Testing Football API integration...\n');

      // Test 1: Get Premier League teams
      setDebugInfo(prev => prev + '1. Fetching Premier League teams...\n');
      const teams = await footballApiService.getPremierLeagueTeams(2024);
      setDebugInfo(prev => prev + `✅ Found ${teams.length} teams\n`);

      // Test 2: Get Premier League matches
      setDebugInfo(prev => prev + '2. Fetching Premier League matches...\n');
      const matches = await footballApiService.getPremierLeagueMatches();
      setDebugInfo(prev => prev + `✅ Found ${matches.length} matches\n`);

      // Show some sample data
      if (matches.length > 0) {
        const sampleMatch = matches[0];
        setDebugInfo(prev => prev + `\nSample match:\n`);
        setDebugInfo(prev => prev + `- ${sampleMatch.homeTeam.name} vs ${sampleMatch.awayTeam.name}\n`);
        setDebugInfo(prev => prev + `- Date: ${new Date(sampleMatch.utcDate).toLocaleString()}\n`);
        setDebugInfo(prev => prev + `- Status: ${sampleMatch.status}\n`);
        setDebugInfo(prev => prev + `- Matchday: ${sampleMatch.matchday}\n`);
      }

      setDebugInfo(prev => prev + '\n🎉 Football API test completed successfully!');

    } catch (error) {
      console.error('Football API test error:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncTeamNames = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Syncing team names from Football API...\n');
      await footballIntegrationService.syncTeamNamesFromApi();
      setDebugInfo(prev => prev + '\n🎉 Team names sync completed successfully!');

    } catch (error) {
      console.error('Team names sync error:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const syncFixtures = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Syncing fixtures with database...\n');

      // First sync team names from API
      setDebugInfo(prev => prev + '1. Syncing team names from API...\n');
      await footballIntegrationService.syncTeamNamesFromApi(2024);
      setDebugInfo(prev => prev + '✅ Team names synced from API\n');

      // Then sync fixtures
      setDebugInfo(prev => prev + '2. Syncing fixtures...\n');
      await footballIntegrationService.syncPremierLeagueFixtures(2024);
      setDebugInfo(prev => prev + '✅ Fixtures synced\n');

      setDebugInfo(prev => prev + '\n🎉 Fixture sync completed successfully!');

    } catch (error) {
      console.error('Fixture sync error:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const viewSyncedFixtures = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Loading synced fixtures from database...\n');
      
      const fixtures = await fixturesService.getAll();
      setDebugInfo(prev => prev + `✅ Found ${fixtures.length} fixtures in database\n\n`);
      
      if (fixtures.length > 0) {
        setDebugInfo(prev => prev + 'Sample fixtures:\n');
        fixtures.slice(0, 10).forEach((fixture, index) => {
          setDebugInfo(prev => prev + `${index + 1}. ${fixture.home_team?.name || 'Unknown'} vs ${fixture.away_team?.name || 'Unknown'}\n`);
          setDebugInfo(prev => prev + `   Kickoff: ${new Date(fixture.kickoff_at).toLocaleString()}\n`);
          setDebugInfo(prev => prev + `   Buy Close: ${new Date(fixture.buy_close_at).toLocaleString()}\n`);
          setDebugInfo(prev => prev + `   Status: ${fixture.status}, Result: ${fixture.result}\n`);
          if (fixture.home_score !== null && fixture.away_score !== null) {
            setDebugInfo(prev => prev + `   Score: ${fixture.home_score}-${fixture.away_score}\n`);
          }
          setDebugInfo(prev => prev + `   External ID: ${fixture.external_id}\n\n`);
        });
        
        if (fixtures.length > 10) {
          setDebugInfo(prev => prev + `... and ${fixtures.length - 10} more fixtures\n`);
        }
      } else {
        setDebugInfo(prev => prev + 'No fixtures found in database. Try running "Sync Fixtures" first.\n');
      }

    } catch (error) {
      console.error('Error loading fixtures:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const compareTeamNames = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Comparing team names between Football API and Database...\n\n');
      
      // Get teams from Football API
      setDebugInfo(prev => prev + '1. Football API Teams:\n');
      const apiTeams = await footballApiService.getPremierLeagueTeams(2024);
      apiTeams.forEach(team => {
        setDebugInfo(prev => prev + `   - ${team.name}\n`);
      });
      
      setDebugInfo(prev => prev + '\n2. Database Teams:\n');
      const { data: dbTeams } = await supabase
        .from('teams')
        .select('id, name, external_id');
      
      if (dbTeams) {
        dbTeams.forEach(team => {
          setDebugInfo(prev => prev + `   - ${team.name} (External ID: ${team.external_id || 'NULL'})\n`);
        });
      }
      
      setDebugInfo(prev => prev + '\n3. Team Name Matching Analysis:\n');
      
      // Check which API teams can be matched to DB teams
      for (const apiTeam of apiTeams) {
        const matchingDbTeam = dbTeams?.find(dbTeam => 
          dbTeam.name.toLowerCase() === apiTeam.name.toLowerCase()
        );
        
        if (matchingDbTeam) {
          setDebugInfo(prev => prev + `   ✅ "${apiTeam.name}" matches "${matchingDbTeam.name}"\n`);
        } else {
          setDebugInfo(prev => prev + `   ❌ "${apiTeam.name}" - NO MATCH FOUND\n`);
        }
      }

    } catch (error) {
      console.error('Error comparing team names:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllFixtures = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Clearing all fixtures from database...\n');
      
      // First check how many fixtures exist
      const fixtures = await fixturesService.getAll();
      setDebugInfo(prev => prev + `Found ${fixtures.length} fixtures to clear\n`);
      
      await fixturesService.clearAllFixtures();
      setDebugInfo(prev => prev + '✅ All fixtures cleared successfully!\n');
      setDebugInfo(prev => prev + '\nYou can now run "Sync Fixtures" to import fresh data.');

    } catch (error) {
      console.error('Clear fixtures error:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkCurrentSeason = async () => {
    setIsLoading(true);
    setDebugInfo('');

    try {
      setDebugInfo('Checking 2024-25 Premier League season...\n\n');
      
      // First try to get season info
      setDebugInfo(prev => prev + '1. Fetching season information...\n');
      const currentSeason = await footballApiService.getCurrentSeason(2024);
      
      if (currentSeason) {
        setDebugInfo(prev => prev + `✅ Season: ${currentSeason.id} (${currentSeason.id}-${currentSeason.id + 1})\n`);
        setDebugInfo(prev => prev + `📅 Start Date: ${new Date(currentSeason.startDate).toLocaleDateString()}\n`);
        setDebugInfo(prev => prev + `📅 End Date: ${new Date(currentSeason.endDate).toLocaleDateString()}\n`);
        setDebugInfo(prev => prev + `⚽ Current Matchday: ${currentSeason.currentMatchday}\n\n`);
      } else {
        setDebugInfo(prev => prev + '⚠️ Could not get season info from API\n\n');
      }
      
      // Also check what season we're fetching matches for
      setDebugInfo(prev => prev + '2. Fetching sample matches to verify season...\n');
      const matches = await footballApiService.getPremierLeagueMatches(2024);
      
      if (matches.length > 0) {
        const firstMatch = matches[0];
        setDebugInfo(prev => prev + `📊 Sample match season: ${firstMatch.season?.id}\n`);
        setDebugInfo(prev => prev + `📊 Sample match date: ${new Date(firstMatch.utcDate).toLocaleDateString()}\n`);
        setDebugInfo(prev => prev + `📊 Total matches found: ${matches.length}\n`);
        setDebugInfo(prev => prev + `📊 Sample match: ${firstMatch.homeTeam.name} vs ${firstMatch.awayTeam.name}\n`);
      } else {
        setDebugInfo(prev => prev + '❌ No matches found\n');
      }

    } catch (error) {
      console.error('Error checking current season:', error);
      const err = error as any;
      const message = (err && (err.message || err.error_description || err.error || err.details))
        || (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setDebugInfo(prev => prev + `\n❌ Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Football API Integration Test</CardTitle>
        <CardDescription>
          Test the football-data.org API integration and fixture sync
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testFootballApi} 
            disabled={isLoading}
          >
            {isLoading ? 'Testing...' : 'Test API'}
          </Button>
          <Button 
            onClick={syncTeamNames} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Syncing...' : 'Sync Team Names'}
          </Button>
          <Button 
            onClick={syncFixtures} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Syncing...' : 'Sync Fixtures'}
          </Button>
          <Button 
            onClick={viewSyncedFixtures} 
            disabled={isLoading}
            variant="secondary"
          >
            {isLoading ? 'Loading...' : 'View Synced Fixtures'}
          </Button>
          <Button 
            onClick={compareTeamNames} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Comparing...' : 'Compare Team Names'}
          </Button>
          <Button 
            onClick={checkCurrentSeason} 
            disabled={isLoading}
            variant="secondary"
          >
            {isLoading ? 'Checking...' : 'Check Season'}
          </Button>
          <Button 
            onClick={clearAllFixtures} 
            disabled={isLoading}
            variant="destructive"
          >
            {isLoading ? 'Clearing...' : 'Clear All Fixtures'}
          </Button>
        </div>
        
        {debugInfo && (
          <div className="p-3 rounded-md bg-gray-900 text-gray-100 text-sm font-mono whitespace-pre-line border border-gray-700">
            {debugInfo}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FootballApiTest;
