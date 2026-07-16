import type { Repository } from 'typeorm';
import { ReservationReadModelEntity } from '../entities';

export class ReservationReadModelRepository {
  constructor(private readonly repo: Repository<ReservationReadModelEntity>) {}

  async upsertOnPlace(
    id: string,
    slotId: string,
    candidateId: string,
    expiresAt: string,
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ReservationReadModelEntity)
      .values({
        id,
        slotId,
        candidateId,
        status: 'pending',
        expiresAt: new Date(expiresAt),
      })
      .orIgnore()
      .execute();
  }

  async updateStatus(id: string, status: 'confirmed' | 'expired'): Promise<void> {
    await this.repo.update({ id }, { status });
  }
}
