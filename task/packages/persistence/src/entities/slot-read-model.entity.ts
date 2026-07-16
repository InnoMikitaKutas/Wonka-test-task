import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'slots_rm' })
export class SlotReadModelEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  interviewer!: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ name: 'scheduled_candidate', type: 'text', nullable: true })
  scheduledCandidate!: string | null;

  @Column({ name: 'reservation_id', type: 'text', nullable: true })
  reservationId!: string | null;

  @Column({ name: 'reservation_candidate', type: 'text', nullable: true })
  reservationCandidate!: string | null;

  @Column({ name: 'reservation_status', type: 'text', nullable: true })
  reservationStatus!: string | null;

  @Column({ name: 'reservation_expires_at', type: 'timestamptz', nullable: true })
  reservationExpiresAt!: Date | null;
}
