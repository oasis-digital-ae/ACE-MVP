import { fixturesService, teamsService } from './database';
import { footballApiService } from './football-api';
import { supabase } from './supabase';

// Match processing service for handling real fixture data
export const matchProcessingService = {
  // Process all fixtures that need snapshots (kickoff time has passed)
  async processKickoffSnapshots(): Promise<void> {
    try {
      console.log('Processing kickoff snapshots...');
      
      const fixturesNeedingSnapshot = await fixturesService.getFixturesNeedingSnapshot();
      console.log(`Found ${fixturesNeedingSnapshot.length} fixtures needing snapshots`);
      
      if (!Array.isArray(fixturesNeedingSnapshot)) {
        throw new Error('getFixturesNeedingSnapshot did not return an array');
      }
      
      for (const fixture of fixturesNeedingSnapshot) {
        try {
          // Capture market cap snapshot
          await teamsService.captureMarketCapSnapshot(fixture.id);
          
          // Mark fixture as closed (trading closed)
          await fixturesService.markFixtureAsClosed(fixture.id);
          
          console.log(`✅ Processed kickoff snapshot for ${fixture.home_team?.name} vs ${fixture.away_team?.name}`);
        } catch (error) {
          console.error(`❌ Error processing snapshot for fixture ${fixture.id}:`, error);
        }
      }
      
      console.log(`Kickoff snapshot processing completed: ${fixturesNeedingSnapshot.length} fixtures processed`);
    } catch (error) {
      console.error('Error processing kickoff snapshots:', error);
      throw error;
    }
  },

  // Process all finished matches and apply market cap transfers
  async processFinishedMatches(): Promise<void> {
    try {
      console.log('Processing finished matches...');
      
      const fixturesNeedingProcessing = await fixturesService.getFixturesNeedingProcessing();
      console.log(`Found ${fixturesNeedingProcessing.length} fixtures needing processing`);
      
      if (!Array.isArray(fixturesNeedingProcessing)) {
        throw new Error('getFixturesNeedingProcessing did not return an array');
      }
      
      for (const fixture of fixturesNeedingProcessing) {
        try {
          // Market cap updates are now handled by the fixture trigger
          // Just ensure the fixture is marked as applied
          await fixturesService.markFixtureAsApplied(fixture.id);
          
          console.log(`✅ Processed match result for ${fixture.home_team?.name} vs ${fixture.away_team?.name} (trigger will handle market cap updates)`);
        } catch (error) {
          console.error(`❌ Error processing match result for fixture ${fixture.id}:`, error);
        }
      }
      
      console.log(`Finished match processing completed: ${fixturesNeedingProcessing.length} fixtures processed`);
    } catch (error) {
      console.error('Error processing finished matches:', error);
      throw error;
    }
  },

  // Update fixture results from Football API
  async updateFixtureResults(): Promise<void> {
    try {
      console.log('Updating fixture results from Football API...');
      
      // Get all fixtures that are finished in the API but not yet processed
      const fixtures = await fixturesService.getAll();
      
      if (!Array.isArray(fixtures)) {
        throw new Error('getAll did not return an array');
      }
      
      let updatedCount = 0;
      
      for (const fixture of fixtures) {
        if (fixture.external_id && fixture.status === 'applied' && fixture.result === 'pending') {
          try {
            // Validate external_id is a valid number
            const matchId = parseInt(fixture.external_id);
            if (isNaN(matchId)) {
              console.log(`⚠️ Skipping fixture ${fixture.id} - invalid external_id: ${fixture.external_id}`);
              continue;
            }

            // Get match details from Football API
            const matchDetails = await footballApiService.getMatchDetails(matchId);
            
            // Update fixture with latest result
            const newResult = footballApiService.convertMatchStatus(matchDetails.status, matchDetails.score);
            const newStatus = footballApiService.convertMatchStatusToFixtureStatus(matchDetails.status);
            
            if (newResult !== fixture.result || newStatus !== fixture.status) {
              await fixturesService.updateResult(fixture.id, newResult);
              
              if (newStatus === 'applied') {
                await fixturesService.markFixtureAsApplied(fixture.id);
              }
              
              updatedCount++;
              console.log(`✅ Updated fixture ${fixture.id}: ${newResult} (${newStatus})`);
            }
          } catch (error) {
            console.error(`❌ Error updating fixture ${fixture.id} (external_id: ${fixture.external_id}):`, error);
            // Continue processing other fixtures even if one fails
          }
        }
      }
      
      console.log(`Fixture result update completed: ${updatedCount} fixtures updated`);
    } catch (error) {
      console.error('Error updating fixture results:', error);
      throw error;
    }
  },

  // Run the complete match processing workflow
  async runMatchProcessingWorkflow(): Promise<void> {
    try {
      console.log('🚀 Starting match processing workflow...');
      
      // Step 1: Update fixture results from API
      await this.updateFixtureResults();
      
      // Step 2: Process kickoff snapshots
      await this.processKickoffSnapshots();
      
      // Step 3: Process finished matches
      await this.processFinishedMatches();
      
      console.log('✅ Match processing workflow completed successfully');
    } catch (error) {
      console.error('❌ Error in match processing workflow:', error);
      throw error;
    }
  },

  // Simulate a match result for testing (manually set result)
  async simulateMatchResult(fixtureId: string, result: 'home_win' | 'away_win' | 'draw'): Promise<void> {
    try {
      console.log(`Simulating match result for fixture ${fixtureId}: ${result}`);
      
      // Update fixture result - the trigger will handle market cap updates
      await fixturesService.updateResult(fixtureId, result);
      
      // Mark as applied
      await fixturesService.markFixtureAsApplied(fixtureId);
      
      console.log(`✅ Simulated match result completed for fixture ${fixtureId} (trigger will handle market cap updates)`);
    } catch (error) {
      console.error(`❌ Error simulating match result for fixture ${fixtureId}:`, error);
      throw error;
    }
  },

  // Simulate a match result without requiring snapshots (for real-time simulation)
  async simulateMatchResultDirect(fixtureId: string, result: 'home_win' | 'away_win' | 'draw'): Promise<void> {
    try {
      console.log(`Simulating match result directly for fixture ${fixtureId}: ${result}`);
      
      // Get fixture data
      const fixtures = await fixturesService.getAll();
      const fixture = fixtures.find(f => f.id === fixtureId);
      
      if (!fixture) {
        throw new Error(`Fixture not found: ${fixtureId}`);
      }

      // Update fixture result and status - the trigger will handle market cap updates
      await fixturesService.updateResult(fixtureId, result);
      await fixturesService.markFixtureAsApplied(fixtureId);

      console.log(`✅ Direct simulation completed for fixture ${fixtureId} (trigger will handle market cap updates)`);
    } catch (error) {
      console.error(`❌ Error in direct match simulation for fixture ${fixtureId}:`, error);
      throw error;
    }
  },

  // Process all completed fixtures for market cap backfill
  // This handles fixtures that were synced from API without market cap transfers
  async processAllCompletedFixturesForMarketCap(): Promise<{
    processed: number;
    skipped: number;
    errors: Array<{fixtureId: number; error: string}>;
  }> {
    const results = {
      processed: 0,
      skipped: 0,
      errors: []
    };

    try {
      console.log('Processing all completed fixtures for market cap backfill...');

      // Get all completed fixtures
      const { data: allFixtures, error: fetchError } = await supabase
        .from('fixtures')
        .select('id, kickoff_at, home_team_id, away_team_id, result, status, snapshot_home_cap, snapshot_away_cap')
        .eq('status', 'applied')
        .neq('result', 'pending')
        .order('kickoff_at', { ascending: true });

      if (fetchError) {
        throw new Error(`Error fetching fixtures: ${fetchError.message}`);
      }

      if (!allFixtures || allFixtures.length === 0) {
        console.log('No completed fixtures found to process');
        return results;
      }

      console.log(`Found ${allFixtures.length} completed fixtures`);

      // Get already processed fixtures
      const { data: processedFixtures, error: ledgerError } = await supabase
        .from('transfers_ledger')
        .select('fixture_id');

      if (ledgerError) {
        console.error('Warning: Could not check processed fixtures:', ledgerError);
      }

      const processedIds = new Set(processedFixtures?.map(t => t.fixture_id) || []);

      // Process unprocessed fixtures
      for (const fixture of allFixtures) {
        if (processedIds.has(fixture.id)) {
          results.skipped++;
          continue;
        }

        // Check if snapshots exist
        if (!fixture.snapshot_home_cap || !fixture.snapshot_away_cap) {
          results.errors.push({
            fixtureId: fixture.id,
            error: 'Missing snapshot data'
          });
          console.warn(`⚠️ Fixture ${fixture.id} missing snapshot data, skipping`);
          continue;
        }

        try {
          const { data, error } = await supabase.rpc('process_match_result_atomic', {
            p_fixture_id: fixture.id
          });

          if (error) {
            throw error;
          }

          results.processed++;
          console.log(`✅ Processed fixture ${fixture.id}`);
        } catch (error: any) {
          results.errors.push({
            fixtureId: fixture.id,
            error: error.message
          });
          console.error(`❌ Error processing fixture ${fixture.id}:`, error);
        }
      }

      console.log(`Backfill complete: ${results.processed} processed, ${results.skipped} skipped, ${results.errors.length} errors`);
      
      return results;
      
    } catch (error) {
      console.error('Error in processAllCompletedFixturesForMarketCap:', error);
      throw error;
    }
  }
};
