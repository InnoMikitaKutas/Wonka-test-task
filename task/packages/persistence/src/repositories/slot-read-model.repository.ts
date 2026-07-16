import type { Repository } from 'typeorm';
import { SlotReadModelEntity } from '../entities';

export class SlotReadModelRepository {
  constructor(private readonly repo: Repository<SlotReadModelEntity>) {}

  async findById(id: string): Promise<SlotReadModelEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async upsertOnOpen(id: string, interviewer: string, startsAt: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(SlotReadModelEntity)
      .values({ id, interviewer, startsAt: new Date(startsAt), scheduledCandidate: null })
      .orIgnore()
      .execute();
  }

  async setScheduledCandidate(id: string, candidateId: string): Promise<void> {
    await this.repo.update({ id }, { scheduledCandidate: candidateId });
  }

  async placeReservation(
    slotId: string,
    reservationId: string,
    candidateId: string,
    expiresAt: string,
  ): Promise<void> {
    await this.repo.update(
      { id: slotId },
      {
        reservationId,
        reservationCandidate: candidateId,
        reservationStatus: 'pending',
        reservationExpiresAt: new Date(expiresAt),
      },
    );
  }

  async confirmReservation(slotId: string, reservationId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(SlotReadModelEntity)
      .set({ reservationStatus: 'confirmed' })
      .where('id = :slotId', { slotId })
      .andWhere('reservation_id = :reservationId', { reservationId })
      .execute();
  }

  async expireReservation(slotId: string, reservationId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(SlotReadModelEntity)
      .set({ reservationStatus: 'expired' })
      .where('id = :slotId', { slotId })
      .andWhere('reservation_id = :reservationId', { reservationId })
      .execute();
  }
}
