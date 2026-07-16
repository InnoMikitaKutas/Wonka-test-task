import type { QueryDeepPartialEntity, Repository } from 'typeorm';
import { EventEntity } from '../entities';
import { OptimisticConcurrencyError } from '../errors';

// What a caller appends. Ids and occurredAt come from the edge (where
// time and identity enter the system); the store never generates them.
export interface NewEvent {
  eventId: string;
  type: string;
  payload: unknown;
  occurredAt: string;
}

// One event as read back from the store, snake_case columns mapped to
// camelCase fields in the one place that does this conversion.
export interface StoredEvent {
  globalSeq: string;
  eventId: string;
  stream: string;
  streamVersion: number;
  schemaVersion: number;
  occurredAt: string;
  type: string;
  payload: unknown;
}

function toStoredEvent(row: EventEntity): StoredEvent {
  return {
    globalSeq: row.globalSeq,
    eventId: row.eventId,
    stream: row.stream,
    streamVersion: row.streamVersion,
    schemaVersion: row.schemaVersion,
    occurredAt:
      row.occurredAt instanceof Date ? row.occurredAt.toISOString() : row.occurredAt,
    type: row.type,
    payload: row.payload,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}

// The write-side core of the event store.
//
// UNIQUE (stream, streamVersion) is the optimistic-concurrency guard:
// appending with a stale expectedVersion collides with an event another
// writer already inserted at that version. UNIQUE (eventId) is the
// idempotency guard: replaying the same event twice is rejected instead
// of duplicated. Both surface as a Postgres unique violation (23505),
// which append turns into an OptimisticConcurrencyError.
export class EventStoreRepository {
  constructor(private readonly repo: Repository<EventEntity>) {}

  async currentVersion(stream: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('e')
      .select('MAX(e.streamVersion)', 'max')
      .where('e.stream = :stream', { stream })
      .getRawOne<{ max: string | null }>();
    return result?.max ? Number(result.max) : 0;
  }

  async append(
    stream: string,
    events: NewEvent[],
    expectedVersion: number,
  ): Promise<void> {
    try {
      await this.repo.manager.transaction(async (manager) => {
        // The jsonb payload column is typed unknown on the entity, which
        // TypeORM's deep-partial insert type cannot express structurally.
        // The cast is exact: these are the same rows, only widened back
        // through unknown to satisfy that type.
        const rows = events.map((event, index) => ({
          eventId: event.eventId,
          stream,
          streamVersion: expectedVersion + index + 1,
          type: event.type,
          schemaVersion: 1,
          occurredAt: new Date(event.occurredAt),
          payload: event.payload,
        })) as unknown as QueryDeepPartialEntity<EventEntity>[];
        await manager.insert(EventEntity, rows);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new OptimisticConcurrencyError(
          `concurrent append to ${stream} at version ${expectedVersion} lost the race`,
        );
      }
      throw err;
    }
  }

  async loadStreams(streams: string[]): Promise<StoredEvent[]> {
    if (streams.length === 0) {
      return [];
    }
    const rows = await this.repo
      .createQueryBuilder('e')
      .where('e.stream IN (:...streams)', { streams })
      .orderBy('e.globalSeq', 'ASC')
      .getMany();
    return rows.map(toStoredEvent);
  }

  async loadByTypes(types: string[]): Promise<StoredEvent[]> {
    if (types.length === 0) {
      return [];
    }
    const rows = await this.repo
      .createQueryBuilder('e')
      .where('e.type IN (:...types)', { types })
      .orderBy('e.globalSeq', 'ASC')
      .getMany();
    return rows.map(toStoredEvent);
  }

  async findReservationStream(reservationId: string): Promise<string | null> {
    const row = await this.repo
      .createQueryBuilder('e')
      .where('e.type = :type', { type: 'ReservationPlaced' })
      .andWhere("e.payload ->> 'reservationId' = :reservationId", { reservationId })
      .orderBy('e.globalSeq', 'ASC')
      .getOne();
    return row?.stream ?? null;
  }

  async readAfter(afterSeq: string, limit: number): Promise<StoredEvent[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .where('e.globalSeq > :afterSeq', { afterSeq })
      .orderBy('e.globalSeq', 'ASC')
      .limit(limit)
      .getMany();
    return rows.map(toStoredEvent);
  }
}
