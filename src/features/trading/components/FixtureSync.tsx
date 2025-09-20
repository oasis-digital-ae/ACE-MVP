import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { footballIntegrationService } from '@/shared/lib/football-api';
import { Loader2, Database, CheckCircle } from 'lucide-react';

export const FixtureSync: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    setResult('Syncing fixtures from Football API...');
    setIsSuccess(false);
    
    try {
      await footballIntegrationService.syncPremierLeagueFixtures();
      setResult('✅ Successfully synced fixtures from Football API!');
      setIsSuccess(true);
    } catch (error) {
      setResult(`❌ Error syncing fixtures: ${error}`);
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Database className="w-5 h-5" />
        Fixture Sync
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Sync Premier League fixtures from the Football Data API to the database.
      </p>
      <Button
        onClick={handleSync}
        disabled={isLoading}
        className="w-full"
        variant={isSuccess ? "default" : "outline"}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Syncing...
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Sync Complete
          </>
        ) : (
          <>
            <Database className="w-4 h-4 mr-2" />
            Sync Fixtures
          </>
        )}
      </Button>
      {result && (
        <div className={`mt-2 p-2 rounded border text-sm ${
          isSuccess ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
};
