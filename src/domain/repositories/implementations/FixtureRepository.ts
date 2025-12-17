// Fixture repository implementation
import { IFixtureRepository } from '../IFixtureRepository';
import { fixturesService, type DatabaseFixture, type DatabaseFixtureWithTeams } from '@/shared/lib/services/fixtures.service';
import type { FixtureId, TeamId } from '@/domain/types';

export class FixtureRepository implements IFixtureRepository {
  async getAll(): Promise<DatabaseFixture[]> {
    return await fixturesService.getAll();
  }

  async getById(id: FixtureId): Promise<DatabaseFixture | null> {
    return await fixturesService.getById(id);
  }

  async getByStatus(status: string): Promise<DatabaseFixture[]> {
    return await fixturesService.getByStatus(status as 'scheduled' | 'closed' | 'completed' | 'applied');
  }

  async getByTeam(teamId: TeamId): Promise<DatabaseFixtureWithTeams[]> {
    return await fixturesService.getByTeam(teamId);
  }
}
