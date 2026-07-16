import type { Repository } from 'typeorm';
import { CandidateReadModelEntity } from '../entities';

export class CandidateReadModelRepository {
  constructor(private readonly repo: Repository<CandidateReadModelEntity>) {}

  async findById(id: string): Promise<CandidateReadModelEntity | null> {
    return this.repo.findOneBy({ id });
  }

  // A redelivered ApplicationReceived must not overwrite whatever later
  // events already changed, so creation is insert-only.
  async upsertOnApplication(
    id: string,
    name: string,
    position: string,
    source: string,
    updatedAt: string,
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(CandidateReadModelEntity)
      .values({
        id,
        name,
        position,
        source,
        stage: 1,
        score: null,
        offerNote: null,
        updatedAt: new Date(updatedAt),
      })
      .orIgnore()
      .execute();
  }

  async updateStage(id: string, stage: number, updatedAt: string): Promise<void> {
    await this.repo.update({ id }, { stage, updatedAt: new Date(updatedAt) });
  }

  // Score stays the string the event carries, never cast to a number.
  async updateScore(id: string, score: string, updatedAt: string): Promise<void> {
    await this.repo.update({ id }, { score, updatedAt: new Date(updatedAt) });
  }

  async setOfferNote(id: string, note: string, updatedAt: string): Promise<void> {
    await this.repo.update({ id }, { offerNote: note, updatedAt: new Date(updatedAt) });
  }
}
