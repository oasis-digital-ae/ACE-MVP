import { footballApiService } from './football-api';
import { supabase } from './supabase';
import { logger } from './logger';

export interface SeasonInfo {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
}

export interface SeasonUpdateResult {
  success: boolean;
  message: string;
  oldSeason?: number;
  newSeason?: number;
  teamsUpdated?: number;
  fixturesUpdated?: number;
}

export const seasonManagementService = {
  /**
   * Get the current active season from the Football API
   */
  async getCurrentActiveSeason(): Promise<SeasonInfo | null> {
    try {
      // Try to get current season from API
      const seasonInfo = await footballApiService.getCurrentSeason();
      
      if (seasonInfo) {
        return seasonInfo;
      }
      
      // Fallback: Calculate season based on current date
      // Premier League seasons run August to May
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1; // 0-based to 1-based
      
      // If we're in August-December, it's the current year's season
      // If we're in January-July, it's the previous year's season
      const seasonYear = month >= 8 ? year : year - 1;
      
      return {
        id: seasonYear,
        startDate: `${seasonYear}-08-01`,
        endDate: `${seasonYear + 1}-05-31`,
        currentMatchday: 1 // Default, will be updated when fixtures are synced
      };
    } catch (error) {
      logger.error('Error getting current active season:', error);
      return null;
    }
  },

  /**
   * Check if the database needs a season update
   */
  async needsSeasonUpdate(): Promise<{ needsUpdate: boolean; currentSeason?: number; apiSeason?: number; message?: string }> {
    try {
      // Get current season from API
      const apiSeason = await this.getCurrentActiveSeason();
      if (!apiSeason) {
        return { needsUpdate: false, message: 'Unable to determine current season from API' };
      }

      // Get current season from database (check fixtures table)
      const { data: fixtures, error } = await supabase
        .from('fixtures')
        .select('season')
        .order('season', { ascending: false })
        .limit(1);

      if (error) {
        logger.warn('Error checking database season:', error);
        return { needsUpdate: true, apiSeason: apiSeason.id, message: 'Unable to check database season' };
      }

      const dbSeason = fixtures && fixtures.length > 0 ? fixtures[0].season : null;
      
      if (!dbSeason) {
        return { needsUpdate: true, apiSeason: apiSeason.id, message: 'No season data in database' };
      }

      const needsUpdate = dbSeason !== apiSeason.id;
      
      return {
        needsUpdate,
        currentSeason: dbSeason,
        apiSeason: apiSeason.id,
        message: needsUpdate ? `Database has season ${dbSeason}, API has season ${apiSeason.id}` : 'Seasons match'
      };
    } catch (error) {
      logger.error('Error checking season update needs:', error);
      return { needsUpdate: false, message: 'Error checking season status' };
    }
  },

  /**
   * Update database to new season data
   */
  async updateToNewSeason(season?: number): Promise<SeasonUpdateResult> {
    try {
      const seasonInfo = season ? await this.getCurrentActiveSeason() : null;
      const targetSeason = season || seasonInfo?.id;
      
      if (!targetSeason) {
        return { success: false, message: 'Unable to determine target season' };
      }

      logger.info(`Starting season update to ${targetSeason}`);

      // Step 1: Clear old fixtures (but preserve teams for now)
      const { error: fixturesError } = await supabase
        .from('fixtures')
        .delete()
        .neq('id', 0); // Delete all fixtures

      if (fixturesError) {
        logger.error('Error clearing fixtures:', fixturesError);
        return { success: false, message: 'Failed to clear old fixtures' };
      }

      // Step 2: Sync teams for new season (updates external_ids)
      logger.info('Syncing teams for new season...');
      const teamsResult = await footballApiService.syncTeams(targetSeason);
      
      if (!teamsResult.success) {
        return { success: false, message: `Failed to sync teams: ${teamsResult.message}` };
      }

      // Step 3: Sync fixtures for new season with 30-minute buy window
      logger.info('Syncing fixtures for new season...');
      const fixturesResult = await footballApiService.syncFixtures(targetSeason);
      
      if (!fixturesResult.success) {
        return { success: false, message: `Failed to sync fixtures: ${fixturesResult.message}` };
      }

      logger.info(`Season update completed successfully to ${targetSeason}`);
      
      return {
        success: true,
        message: `Successfully updated to season ${targetSeason}`,
        newSeason: targetSeason,
        teamsUpdated: teamsResult.teamsUpdated,
        fixturesUpdated: fixturesResult.fixturesUpdated
      };
    } catch (error) {
      logger.error('Error updating season:', error);
      return { success: false, message: `Season update failed: ${error}` };
    }
  },

  /**
   * Auto-check and update season if needed
   */
  async autoCheckSeasonUpdate(): Promise<SeasonUpdateResult | null> {
    try {
      const checkResult = await this.needsSeasonUpdate();
      
      if (checkResult.needsUpdate) {
        logger.info(`Season update needed: ${checkResult.message}`);
        
        // Auto-update to new season
        const updateResult = await this.updateToNewSeason();
        
        if (updateResult.success) {
          logger.info(`Auto season update completed: ${updateResult.message}`);
        } else {
          logger.error(`Auto season update failed: ${updateResult.message}`);
        }
        
        return updateResult;
      } else {
        logger.debug(`No season update needed: ${checkResult.message}`);
        return null;
      }
    } catch (error) {
      logger.error('Error in auto season check:', error);
      return { success: false, message: `Auto season check failed: ${error}` };
    }
  },

  /**
   * Get season status information for display
   */
  async getSeasonStatus(): Promise<{
    apiSeason: SeasonInfo | null;
    dbSeason: number | null;
    needsUpdate: boolean;
    message: string;
  }> {
    try {
      const apiSeason = await this.getCurrentActiveSeason();
      const updateCheck = await this.needsSeasonUpdate();
      
      return {
        apiSeason,
        dbSeason: updateCheck.currentSeason || null,
        needsUpdate: updateCheck.needsUpdate,
        message: updateCheck.message || 'Season status check completed'
      };
    } catch (error) {
      logger.error('Error getting season status:', error);
      return {
        apiSeason: null,
        dbSeason: null,
        needsUpdate: false,
        message: `Error checking season status: ${error}`
      };
    }
  }
};

export default seasonManagementService;

