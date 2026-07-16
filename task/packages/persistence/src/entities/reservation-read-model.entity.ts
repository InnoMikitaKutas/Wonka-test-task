import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'reservations_rm' })
export class ReservationReadModelEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'slot_id', type: 'text' })
  slotId!: string;

  @Column({ name: 'candidate_id', type: 'text' })
  candidateId!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
