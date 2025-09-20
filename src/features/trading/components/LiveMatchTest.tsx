import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { footballApiService } from '@/shared/lib/football-api';
import { Play, TestTube, RefreshCw } from 'lucide-react';

const LiveMatchTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testMockLiveMatches = async () => {
    setIsLoading(true);
    setTestResults('');
    
    try {
      setTestResults('Testing mock live matches...\n\n');
      
      const mockMatches = await footballApiService.getMockLiveMatches();
      
      setTestResults(prev => prev + `✅ Found ${mockMatches.length} mock live matches:\n\n`);
      
      mockMatches.forEach((match, index) => {
        setTestResults(prev => prev + 
          `${index + 1}. ${match.homeTeam.name} vs ${match.awayTeam.name}\n` +
          `   Status: ${match.status}\n` +
          `   Score: ${match.score.fullTime.home} - ${match.score.fullTime.away}\n` +
          `   Duration: ${match.score.duration}\n` +
          `   Matchday: ${match.matchday}\n\n`
        );
      });
      
      setTestResults(prev => prev + '🎉 Mock live matches test completed!\n\n');
      setTestResults(prev => prev + '💡 You can now test the Live Trading Dashboard with these matches.');
      
    } catch (error) {
      console.error('Mock live matches test error:', error);
      setTestResults(prev => prev + `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testRealLiveMatches = async () => {
    setIsLoading(true);
    setTestResults('');
    
    try {
      setTestResults('Testing real live matches API...\n\n');
      
      const realMatches = await footballApiService.getLiveMatches();
      
      if (realMatches.length === 0) {
        setTestResults(prev => prev + 'ℹ️ No live matches currently playing.\n\n');
        setTestResults(prev => prev + '💡 This is normal - live matches only appear during actual match times.\n');
        setTestResults(prev => prev + '💡 Use the mock data for testing the Live Trading Dashboard.');
      } else {
        setTestResults(prev => prev + `✅ Found ${realMatches.length} real live matches:\n\n`);
        
        realMatches.forEach((match, index) => {
          setTestResults(prev => prev + 
            `${index + 1}. ${match.homeTeam.name} vs ${match.awayTeam.name}\n` +
            `   Status: ${match.status}\n` +
            `   Score: ${match.score.fullTime.home} - ${match.score.fullTime.away}\n` +
            `   Duration: ${match.score.duration}\n\n`
          );
        });
      }
      
    } catch (error) {
      console.error('Real live matches test error:', error);
      setTestResults(prev => prev + `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`);
      setTestResults(prev => prev + '💡 This might be due to API limits or network issues.\n');
      setTestResults(prev => prev + '💡 Use the mock data for testing instead.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Live Match Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={testMockLiveMatches}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Test Mock Live Matches
            </Button>
            
            <Button
              onClick={testRealLiveMatches}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Test Real Live Matches
            </Button>
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="text-blue-600">
              💡 Mock Data: Always available for testing
            </Badge>
            <Badge variant="outline" className="text-green-600">
              ✅ Real Data: Only available during live matches
            </Badge>
          </div>

          {testResults && (
            <div className="p-4 rounded-md bg-gray-900 text-gray-100 text-sm font-mono whitespace-pre-line max-h-96 overflow-y-auto border border-gray-700">
              {testResults}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Test Live Trading Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium">1. Navigate to Live Trading</h4>
            <p className="text-sm text-gray-600">
              Go to the "Live Trading" page in the navigation menu.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Start Live Mode</h4>
            <p className="text-sm text-gray-600">
              Click "Start Live" to begin automatic updates every 30 seconds.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Simulate Goals</h4>
            <p className="text-sm text-gray-600">
              Use the "+1 Home" and "+1 Away" buttons to simulate goals and see live updates.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">4. Test Team Details</h4>
            <p className="text-sm text-gray-600">
              Click on team names to see detailed team information and statistics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveMatchTest;
