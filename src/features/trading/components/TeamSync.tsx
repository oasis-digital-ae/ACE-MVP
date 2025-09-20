import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { footballIntegrationService } from '@/shared/lib/football-api';
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';

export const TeamSync: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    setResult('Syncing team details from Football API...');
    setIsSuccess(false);
    setIsError(false);
    
    try {
      await footballIntegrationService.syncPremierLeagueTeams();
      setResult('✅ Successfully synced team details from Football API!');
      setIsSuccess(true);
    } catch (error) {
      setResult(`❌ Error syncing team details: ${error}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Users className="w-5 h-5" />
        Team Sync
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Sync basic team information (external ID, name, short name, logo) from the Football Data API. Detailed team info is fetched dynamically when needed.
      </p>
      <Button
        onClick={handleSync}
        disabled={isLoading}
        className="w-full"
        variant={isSuccess ? "default" : isError ? "destructive" : "outline"}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Syncing Teams...
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Sync Complete
          </>
        ) : isError ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            Sync Failed
          </>
        ) : (
          <>
            <Users className="w-4 h-4 mr-2" />
            Sync Teams
          </>
        )}
      </Button>
      {result && (
        <div className={`mt-2 p-2 rounded border text-sm ${
          isSuccess ? 'bg-green-50 border-green-200 text-green-800' : 
          isError ? 'bg-red-50 border-red-200 text-red-800' : 
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
};
