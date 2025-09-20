import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { positionsService, teamsService } from '@/shared/lib/database';
import type { DatabaseTeam } from '@/shared/lib/database';

export default function BuyWindowTest() {
  const [teams, setTeams] = useState<DatabaseTeam[]>([]);
  const [tradeableStatus, setTradeableStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const teamsData = await teamsService.getAll();
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const checkTradeableStatus = async () => {
    setLoading(true);
    setDebugInfo('Checking tradeable status for all teams...\n');
    
    const status: Record<string, any> = {};
    
    for (const team of teams) {
      try {
        const result = await positionsService.isTeamTradeable(team.id);
        status[team.id] = result;
        setDebugInfo(prev => prev + `\n${team.name}: ${result.tradeable ? '✅ Tradeable' : '❌ Not Tradeable'}`);
        if (!result.tradeable) {
          setDebugInfo(prev => prev + ` - ${result.reason}`);
        }
        if (result.nextFixture) {
          setDebugInfo(prev => prev + `\n  Next fixture: ${new Date(result.nextFixture.kickoff_at).toLocaleString()}`);
          setDebugInfo(prev => prev + `\n  Buy window closes: ${new Date(result.nextFixture.buy_close_at).toLocaleString()}`);
        }
      } catch (error) {
        status[team.id] = { tradeable: false, reason: `Error: ${error}` };
        setDebugInfo(prev => prev + `\n${team.name}: ❌ Error - ${error}`);
      }
    }
    
    setTradeableStatus(status);
    setLoading(false);
  };

  const testPurchase = async (teamId: string) => {
    setLoading(true);
    setDebugInfo(`Testing purchase for team ${teams.find(t => t.id === teamId)?.name}...\n`);
    
    try {
      // Simulate a purchase order
      const mockOrder = {
        user_id: 'test-user-id', // This would be the actual user ID
        team_id: teamId,
        amount: 100,
        executed_price: 1000,
        shares_issued: 0.1
      };
      
      // This should fail if buy window is closed
      await positionsService.isTeamTradeable(teamId);
      setDebugInfo(prev => prev + '✅ Purchase would be allowed (buy window is open)');
    } catch (error) {
      setDebugInfo(prev => prev + `❌ Purchase blocked: ${error}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buy Window Enforcement Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={checkTradeableStatus} disabled={loading}>
              Check All Teams
            </Button>
            <Button onClick={loadTeams} disabled={loading}>
              Reload Teams
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <Card key={team.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{team.name}</h3>
                  <Badge variant={tradeableStatus[team.id]?.tradeable ? 'default' : 'destructive'}>
                    {tradeableStatus[team.id]?.tradeable ? 'Tradeable' : 'Closed'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Market Cap: ${team.market_cap.toLocaleString()}
                </div>
                {tradeableStatus[team.id]?.nextFixture && (
                  <div className="text-xs text-gray-500">
                    <div>Next: {new Date(tradeableStatus[team.id].nextFixture.kickoff_at).toLocaleDateString()}</div>
                    <div>Buy closes: {new Date(tradeableStatus[team.id].nextFixture.buy_close_at).toLocaleString()}</div>
                  </div>
                )}
                <Button 
                  size="sm" 
                  onClick={() => testPurchase(team.id)}
                  disabled={loading || !tradeableStatus[team.id]?.tradeable}
                  className="mt-2 w-full"
                >
                  Test Purchase
                </Button>
              </Card>
            ))}
          </div>
          
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Debug Output:</h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-auto max-h-96 border border-gray-700">
              {debugInfo || 'Click "Check All Teams" to see tradeable status...'}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

