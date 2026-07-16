import type { Repository } from 'typeorm';
import { ProjectorStateEntity } from '../entities';

const ROW_ID = 1;

export class ProjectorStateRepository {
  constructor(private readonly repo: Repository<ProjectorStateEntity>) {}

  // Ensures the row id = 1 exists, creating it at 0 the first time the
  // projector runs against a fresh database.
  async getLastSeq(): Promise<string> {
    const existing = await this.repo.findOneBy({ id: ROW_ID });
    if (existing) {
      return existing.lastSeq;
    }
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ProjectorStateEntity)
      .values({ id: ROW_ID, lastSeq: '0' })
      .orIgnore()
      .execute();
    return '0';
  }

  async setLastSeq(seq: string): Promise<void> {
    await this.repo.update({ id: ROW_ID }, { lastSeq: seq });
  }
}
