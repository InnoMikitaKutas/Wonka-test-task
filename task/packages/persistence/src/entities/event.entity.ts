import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

// The event store: the single source of truth every read model is
// projected from. UNIQUE (stream, streamVersion) is the optimistic-
// concurrency guard, and UNIQUE (eventId) is the idempotency guard.
// Both must survive any future schema change.
@Entity({ name: 'events' })
@Unique(['stream', 'streamVersion'])
@Index(['stream'])
export class EventEntity {
  // bigserial, kept as string: a JS number would lose precision once
  // the sequence passes 2^53.
  @PrimaryGeneratedColumn({ name: 'global_seq', type: 'bigint' })
  globalSeq!: string;

  @Column({ name: 'event_id', type: 'uuid', unique: true })
  eventId!: string;

  @Column({ type: 'text' })
  stream!: string;

  @Column({ name: 'stream_version', type: 'int' })
  streamVersion!: number;

  @Column({ type: 'text' })
  type!: string;

  @Column({ name: 'schema_version', type: 'int', default: 1 })
  schemaVersion!: number;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: unknown;
}
