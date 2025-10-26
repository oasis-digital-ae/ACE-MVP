import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, CheckCircle, RefreshCw, Loader2, Database, TrendingUp } from 'lucide-react';
import { matchProcessingService } from '@/shared/lib/match-processing';
import { footballIntegrationService } from '@/shared/lib/football-api';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

interface FixtureStats {
  total: number;
  completed: number;
  processed: number;
  pending: number;
}

interface ProcessingResult {
  processed: number;
  skipped: number;
  errors: Array<{fixtureId: number; error: string}>;
}

export const MarketCapProcessingPanel: React.FC = () => {
  const [fixtureStats, setFixtureStats] = useState<FixtureStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadFixtureStats = async () => {
    setIsLoading(true);
    try {
      // Get total fixtures
      const { data: totalFixtures, error: totalError } = await supabase
        .from('fixtures')
        .select('id', { count: 'exact' });

      if (totalError) throw totalError;

      // Get completed fixtures
      const { data: completedFixtures, error: completedError } = await supabase
        .from('fixtures')
        .select('id', { count: 'exact' })
        .eq('status', 'applied')
        .neq('result', 'pending');

      if (completedError) throw completedError;

      // Get processed fixtures (have entries in transfers_ledger)
      const { data: processedFixtures, error: processedError } = await supabase
        .from('transfers_ledger')
        .select('fixture_id', { count: 'exact' });

      if (processedError) throw processedError;

      const stats: FixtureStats = {
        total: totalFixtures?.length || 0,
        completed: completedFixtures?.length || 0,
        processed: processedFixtures?.length || 0,
        pending: (completedFixtures?.length || 0) - (processedFixtures?.length || 0)
      };

      setFixtureStats(stats);
      logger.debug('Fixture stats loaded:', stats);
    } catch (error) {
      logger.error('Failed to load fixture stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load fixture statistics. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFixtureStats();
  }, []);

  const handleProcessAll = async () => {
    setIsProcessing(true);
    setProcessingResult(null);
    
    try {
      logger.info('Starting market cap backfill processing...');
      const result = await matchProcessingService.processAllCompletedFixturesForMarketCap();
      
      setProcessingResult(result);
      
      if (result.errors.length > 0) {
        toast({
          title: 'Processing Completed with Errors',
          description: `Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Processing Completed Successfully',
          description: `Processed: ${result.processed}, Skipped: ${result.skipped}`,
          variant: 'default',
        });
      }
      
      // Refresh stats after processing
      await loadFixtureStats();
      
    } catch (error) {
      logger.error('Error processing fixtures:', error);
      toast({
        title: 'Processing Failed',
        description: 'An unexpected error occurred during processing.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncFixtures = async () => {
    setIsSyncing(true);
    
    try {
      logger.info('Starting fixture sync from Football API...');
      toast({
        title: 'Syncing Fixtures',
        description: 'Fetching latest fixture data from Football API...',
      });
      
      await footballIntegrationService.syncPremierLeagueFixtures();
      
      toast({
        title: 'Sync Complete',
        description: 'Successfully synced fixtures from Football API!',
      });
      
      await loadFixtureStats();
    } catch (error) {
      logger.error('Error syncing fixtures:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync fixtures. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetMarketCaps = async () => {
    if (!confirm('⚠️ This will reset ALL team market caps to $100.00. This action cannot be undone. Continue?')) {
      return;
    }

    setIsResetting(true);
    
    try {
      logger.info('Resetting all team market caps to $100.00...');
      
      const { error } = await supabase
        .from('teams')
        .update({ 
          market_cap: 100.00,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Clear transfers ledger
      const { error: ledgerError } = await supabase
        .from('transfers_ledger')
        .delete()
        .neq('id', 0);

      if (ledgerError) throw ledgerError;

      toast({
        title: 'Market Caps Reset',
        description: 'All team market caps have been reset to $100.00',
        variant: 'default',
      });

      // Refresh stats after reset
      await loadFixtureStats();
      
    } catch (error) {
      logger.error('Error resetting market caps:', error);
      toast({
        title: 'Reset Failed',
        description: 'An unexpected error occurred during reset.',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusColor = (count: number, total: number) => {
    if (count === total) return 'text-green-400';
    if (count > 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-gray-800/95 backdrop-blur-md border border-trading-primary/30 text-white">
      <CardHeader>
        <CardTitle className="text-xl font-bold gradient-text flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Market Cap Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-trading-primary" />
            <span className="ml-2">Loading fixture statistics...</span>
          </div>
        ) : (
          <>
            {/* Statistics Display */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{fixtureStats?.total || 0}</div>
                <div className="text-sm text-gray-400">Total Fixtures</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${getStatusColor(fixtureStats?.completed || 0, fixtureStats?.total || 0)}`}>
                  {fixtureStats?.completed || 0}
                </div>
                <div className="text-sm text-gray-400">Completed</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${getStatusColor(fixtureStats?.processed || 0, fixtureStats?.completed || 0)}`}>
                  {fixtureStats?.processed || 0}
                </div>
                <div className="text-sm text-gray-400">Processed</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${getStatusColor(fixtureStats?.pending || 0, fixtureStats?.completed || 0)}`}>
                  {fixtureStats?.pending || 0}
                </div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>

            {/* Processing Status */}
            {fixtureStats && fixtureStats.pending > 0 ? (
              <div className="bg-yellow-900/30 border border-yellow-600/50 text-yellow-300 p-3 rounded-md flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>{fixtureStats.pending} completed fixtures need market cap processing</span>
              </div>
            ) : (
              <div className="bg-green-900/30 border border-green-600/50 text-green-300 p-3 rounded-md flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <span>All completed fixtures have been processed</span>
              </div>
            )}

            {/* Processing Results */}
            {processingResult && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Processing Results:</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-400 font-medium">Processed:</span> {processingResult.processed}
                  </div>
                  <div>
                    <span className="text-blue-400 font-medium">Skipped:</span> {processingResult.skipped}
                  </div>
                  <div>
                    <span className="text-red-400 font-medium">Errors:</span> {processingResult.errors.length}
                  </div>
                </div>
                {processingResult.errors.length > 0 && (
                  <div className="mt-3">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-red-400">View Errors</summary>
                      <div className="mt-2 space-y-1">
                        {processingResult.errors.map((error, index) => (
                          <div key={index} className="text-red-300">
                            Fixture {error.fixtureId}: {error.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSyncFixtures}
                disabled={isSyncing || isProcessing || isResetting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-600/90 hover:to-blue-700/90 text-white font-semibold py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="mr-2 h-4 w-4" />
                )}
                {isSyncing ? 'Syncing...' : 'Sync Fixtures from API'}
              </Button>
              
              <Button
                onClick={handleProcessAll}
                disabled={isProcessing || isResetting || (fixtureStats?.pending || 0) === 0}
                className="flex-1 bg-gradient-to-r from-trading-primary to-trading-secondary hover:from-trading-primary/90 hover:to-trading-secondary/90 text-white font-semibold py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isProcessing ? 'Processing...' : 'Process All Match Results'}
              </Button>

              <Button
                onClick={handleResetMarketCaps}
                disabled={isProcessing || isResetting || isSyncing}
                variant="destructive"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Database className="mr-2 h-4 w-4" />
                )}
                {isResetting ? 'Resetting...' : 'Reset Market Caps'}
              </Button>
            </div>

            <div className="text-sm text-gray-500 space-y-1">
              <p><strong>Sync Fixtures:</strong> Fetches latest fixture statuses from Football API (updates LIVE match status).</p>
              <p><strong>Process All:</strong> Runs market cap transfers for all completed fixtures that haven't been processed yet.</p>
              <p><strong>Reset Market Caps:</strong> Resets all team market caps to $100.00 and clears transfer history.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
