import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { fixturesService } from '@/shared/lib/database';
import type { DatabaseFixture } from '@/shared/lib/database';
import ClickableTeamName from '@/shared/components/ClickableTeamName';
import TeamLogo from '@/shared/components/TeamLogo';

const MatchResultsPage: React.FC = () => {
  const [fixtures, setFixtures] = useState<DatabaseFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'finished' | 'upcoming'>('all');

  useEffect(() => {
    loadFixtures();
  }, []);

  const loadFixtures = async () => {
    try {
      setLoading(true);
      const fixturesData = await fixturesService.getAll();
      setFixtures(fixturesData);
    } catch (error) {
      console.error('Error loading fixtures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-400 border-blue-400">Scheduled</Badge>;
      case 'closed':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-400">Live</Badge>;
      case 'applied':
        return <Badge variant="outline" className="text-green-400 border-green-400">Finished</Badge>;
      case 'postponed':
        return <Badge variant="outline" className="text-red-400 border-red-400">Postponed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'home_win':
        return <Badge variant="default" className="bg-green-600">Home Win</Badge>;
      case 'away_win':
        return <Badge variant="default" className="bg-blue-600">Away Win</Badge>;
      case 'draw':
        return <Badge variant="default" className="bg-gray-600">Draw</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-gray-400">Pending</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  const filteredFixtures = fixtures.filter(fixture => {
    if (filter === 'finished') return fixture.status === 'applied';
    if (filter === 'upcoming') return fixture.status === 'scheduled';
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">Loading fixtures...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="bg-gray-800 border-gray-700 mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-2xl">Match Results</CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={() => setFilter('all')} 
              variant={filter === 'all' ? 'default' : 'outline'}
              className="text-sm"
            >
              All ({fixtures.length})
            </Button>
            <Button 
              onClick={() => setFilter('finished')} 
              variant={filter === 'finished' ? 'default' : 'outline'}
              className="text-sm"
            >
              Finished ({fixtures.filter(f => f.status === 'applied').length})
            </Button>
            <Button 
              onClick={() => setFilter('upcoming')} 
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              className="text-sm"
            >
              Upcoming ({fixtures.filter(f => f.status === 'scheduled').length})
            </Button>
            <Button onClick={loadFixtures} variant="outline" className="text-sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {filteredFixtures.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">
              {filter === 'all' 
                ? 'No fixtures found. Sync fixtures from the Football API Test page.'
                : `No ${filter} fixtures found.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFixtures
            .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
            .map((fixture) => (
            <Card key={fixture.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-400">
                      Matchday {fixture.matchday}
                    </div>
                    {getStatusBadge(fixture.status)}
                    {fixture.result !== 'pending' && getResultBadge(fixture.result)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatDate(fixture.kickoff_at)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <div className="text-lg font-semibold text-white flex items-center justify-center gap-2">
                      <TeamLogo 
                        teamName={fixture.home_team?.name || 'Home Team'} 
                        externalId={fixture.home_team?.external_id ? parseInt(fixture.home_team.external_id) : undefined}
                        size="sm" 
                      />
                      <ClickableTeamName
                        teamName={fixture.home_team?.name || 'Home Team'}
                        teamId={fixture.home_team?.external_id ? parseInt(fixture.home_team.external_id) : undefined}
                        className="hover:text-blue-400"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mx-8">
                    <div className="text-3xl font-bold text-white">
                      {fixture.home_score !== null ? fixture.home_score : '-'}
                    </div>
                    <div className="text-gray-400">vs</div>
                    <div className="text-3xl font-bold text-white">
                      {fixture.away_score !== null ? fixture.away_score : '-'}
                    </div>
                  </div>
                  
                  <div className="flex-1 text-center">
                    <div className="text-lg font-semibold text-white flex items-center justify-center gap-2">
                      <TeamLogo 
                        teamName={fixture.away_team?.name || 'Away Team'} 
                        externalId={fixture.away_team?.external_id ? parseInt(fixture.away_team.external_id) : undefined}
                        size="sm" 
                      />
                      <ClickableTeamName
                        teamName={fixture.away_team?.name || 'Away Team'}
                        teamId={fixture.away_team?.external_id ? parseInt(fixture.away_team.external_id) : undefined}
                        className="hover:text-blue-400"
                      />
                    </div>
                  </div>
                </div>

                {fixture.status === 'scheduled' && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-sm text-gray-400 text-center">
                      Buy window closes: {formatDate(fixture.buy_close_at)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchResultsPage;