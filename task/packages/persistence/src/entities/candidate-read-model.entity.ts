import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'candidates_rm' })
export class CandidateReadModelEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  position!: string | null;

  @Column({ type: 'text', nullable: true })
  source!: string | null;

  @Column({ type: 'int' })
  stage!: number;

  // Kept as string, never cast to a number.
  @Column({ type: 'text', nullable: true })
  score!: string | null;

  @Column({ name: 'offer_note', type: 'text', nullable: true })
  offerNote!: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt!: Date | null;
}
