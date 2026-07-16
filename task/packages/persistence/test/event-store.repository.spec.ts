import type { EntityManager, Repository } from 'typeorm';
import { EventEntity } from '../src/entities';
import { EventStoreRepository, type NewEvent } from '../src/repositories';
import { OptimisticConcurrencyError } from '../src/errors';

// Chainable fake query builder: every method returns itself except the
// terminal getter, which resolves to whatever the test configured.
function fakeQueryBuilder(result: unknown) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function fakeRepo(queryBuilderResult: unknown, transactionImpl?: EntityManager['transaction']) {
  const manager = {
    transaction: transactionImpl ?? jest.fn(),
  } as unknown as EntityManager;
  const repo = {
    createQueryBuilder: jest.fn(() => fakeQueryBuilder(queryBuilderResult)),
    manager,
  } as unknown as Repository<EventEntity>;
  return repo;
}

describe('EventStoreRepository.currentVersion', () => {
  it('returns 0 for a stream with no events', async () => {
    const repo = fakeRepo({ max: null });
    const store = new EventStoreRepository(repo);

    await expect(store.currentVersion('candidate-c1')).resolves.toBe(0);
  });

  it('returns the max stream_version as a number', async () => {
    const repo = fakeRepo({ max: '7' });
    const store = new EventStoreRepository(repo);

    await expect(store.currentVersion('candidate-c1')).resolves.toBe(7);
  });
});

describe('EventStoreRepository.append', () => {
  const events: NewEvent[] = [
    { eventId: 'e1', type: 'StageChanged', payload: { toStage: 2 }, occurredAt: '2024-01-01T00:00:00.000Z' },
    { eventId: 'e2', type: 'ScoreAssigned', payload: { score: '4.5' }, occurredAt: '2024-01-01T00:00:01.000Z' },
  ];

  it('inserts each event with stream_version = expectedVersion + index + 1', async () => {
    const insert = jest.fn().mockResolvedValue({ identifiers: [] });
    const managerInTx = { insert } as unknown as EntityManager;
    const transaction = jest.fn(async (cb: (manager: EntityManager) => Promise<void>) => {
      await cb(managerInTx);
    }) as unknown as EntityManager['transaction'];
    const repo = fakeRepo(undefined, transaction);
    const store = new EventStoreRepository(repo);

    await store.append('candidate-c1', events, 3);

    expect(insert).toHaveBeenCalledTimes(1);
    const [entity, rows] = insert.mock.calls[0] as [unknown, Array<Record<string, unknown>>];
    expect(entity).toBe(EventEntity);
    expect(rows).toEqual([
      expect.objectContaining({ eventId: 'e1', streamVersion: 4, schemaVersion: 1 }),
      expect.objectContaining({ eventId: 'e2', streamVersion: 5, schemaVersion: 1 }),
    ]);
  });

  it('throws OptimisticConcurrencyError on a unique violation (23505)', async () => {
    const transaction = jest.fn().mockRejectedValue({ code: '23505' }) as unknown as EntityManager['transaction'];
    const repo = fakeRepo(undefined, transaction);
    const store = new EventStoreRepository(repo);

    await expect(store.append('candidate-c1', events, 3)).rejects.toBeInstanceOf(
      OptimisticConcurrencyError,
    );
  });

  it('rethrows any other error unchanged', async () => {
    const boom = new Error('connection lost');
    const transaction = jest.fn().mockRejectedValue(boom) as unknown as EntityManager['transaction'];
    const repo = fakeRepo(undefined, transaction);
    const store = new EventStoreRepository(repo);

    await expect(store.append('candidate-c1', events, 3)).rejects.toBe(boom);
  });
});

describe('EventStoreRepository.loadStreams', () => {
  it('maps snake_case-shaped rows to camelCase StoredEvent, ordered by globalSeq', async () => {
    const row: EventEntity = {
      globalSeq: '10',
      eventId: 'e1',
      stream: 'candidate-c1',
      streamVersion: 1,
      type: 'ApplicationReceived',
      schemaVersion: 1,
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: { candidateId: 'c1' },
    };
    const repo = fakeRepo([row]);
    const store = new EventStoreRepository(repo);

    const result = await store.loadStreams(['candidate-c1']);

    expect(result).toEqual([
      {
        globalSeq: '10',
        eventId: 'e1',
        stream: 'candidate-c1',
        streamVersion: 1,
        schemaVersion: 1,
        occurredAt: '2024-01-01T00:00:00.000Z',
        type: 'ApplicationReceived',
        payload: { candidateId: 'c1' },
      },
    ]);
  });
});

describe('EventStoreRepository.readAfter', () => {
  it('keeps globalSeq as a string on the returned rows', async () => {
    const row: EventEntity = {
      globalSeq: '9007199254740993',
      eventId: 'e2',
      stream: 'slot-s1',
      streamVersion: 1,
      type: 'SlotOpened',
      schemaVersion: 1,
      occurredAt: new Date('2024-01-02T00:00:00.000Z'),
      payload: { slotId: 's1' },
    };
    const repo = fakeRepo([row]);
    const store = new EventStoreRepository(repo);

    const result = await store.readAfter('0', 100);

    expect(result[0].globalSeq).toBe('9007199254740993');
    expect(typeof result[0].globalSeq).toBe('string');
  });
});
