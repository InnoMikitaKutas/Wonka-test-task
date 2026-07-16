import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'projector_state' })
export class ProjectorStateEntity {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  // bigint, kept as string for the same reason as EventEntity.globalSeq.
  @Column({ name: 'last_seq', type: 'bigint', default: 0 })
  lastSeq!: string;
}
