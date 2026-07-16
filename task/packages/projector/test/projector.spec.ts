import {
  CandidateReadModelRepository,
  EventStoreRepository,
  ProjectorStateRepository,
  SlotReadModelRepository,
  type StoredEvent,
} from '@ats/persistence';
import { catchUp, type ProjectorDeps } from '../src/projector';

// See apply.spec.ts: these placeholders stand in for a typeorm
// Repository, which every test replaces piece by piece with jest.spyOn.
type EventStoreRepo = ConstructorParameters<typeof EventStoreRepository>[0];
type ProjectorStateRepo = ConstructorParameters<typeof ProjectorStateRepository>[0];
type CandidateRepo = ConstructorParameters<typeof CandidateReadModelRepository>[0];
type SlotRepo = ConstructorParameters<typeof SlotReadModelRepository>[0];

function setup(): ProjectorDeps {
  return {
    eventStore: new EventStoreRepository({} as unknown as EventStoreRepo),
    projectorState: new ProjectorStateRepository({} as unknown as ProjectorStateRepo),
    candidateReadModel: new CandidateReadModelRepository({} as unknown as CandidateRepo),
    slotReadModel: new SlotReadModelRepository({} as unknown as SlotRepo),
  };
}

function storedEvent(globalSeq: string, type: string, payload: unknown): StoredEvent {
  return {
    globalSeq,
    eventId: `event-${globalSeq}`,
    stream: 'candidate-c1',
    streamVersion: Number(globalSeq),
    schemaVersion: 1,
    occurredAt: '2024-01-01T00:00:00.000Z',
    type,
    payload,
  };
}

describe('catchUp', () => {
  it('applies a batch strictly in order and advances last_seq after each event', async () => {
    const deps = setup();
    jest.spyOn(deps.projectorState, 'getLastSeq').mockResolvedValue('10');
    const setLastSeq = jest
      .spyOn(deps.projectorState, 'setLastSeq')
      .mockResolvedValue(undefined);
    const readAfter = jest
      .spyOn(deps.eventStore, 'readAfter')
      .mockResolvedValueOnce([
        storedEvent('11', 'ApplicationReceived', {
          candidateId: 'c1',
          name: 'Ada Lovelace',
          position: 'Engineer',
          source: 'referral',
        }),
        storedEvent('12', 'StageChanged', {
          candidateId: 'c1',
          fromStage: 1,
          toStage: 2,
        }),
      ])
      .mockResolvedValueOnce([]);

    const order: string[] = [];
    jest
      .spyOn(deps.candidateReadModel, 'upsertOnApplication')
      .mockImplementation(async () => {
        order.push('apply:11');
      });
    jest.spyOn(deps.candidateReadModel, 'updateStage').mockImplementation(async () => {
      order.push('apply:12');
    });
    setLastSeq.mockImplementation(async (seq) => {
      order.push(`lastSeq:${seq}`);
    });

    const processed = await catchUp(deps);

    expect(processed).toBe(2);
    expect(order).toEqual(['apply:11', 'lastSeq:11', 'apply:12', 'lastSeq:12']);
    expect(readAfter).toHaveBeenNthCalledWith(1, '10', expect.any(Number));
    expect(readAfter).toHaveBeenNthCalledWith(2, '12', expect.any(Number));
  });

  it('processes 0 events when catch-up is already current (idempotent)', async () => {
    const deps = setup();
    jest.spyOn(deps.projectorState, 'getLastSeq').mockResolvedValue('12');
    const setLastSeq = jest.spyOn(deps.projectorState, 'setLastSeq');
    jest.spyOn(deps.eventStore, 'readAfter').mockResolvedValue([]);

    const processed = await catchUp(deps);

    expect(processed).toBe(0);
    expect(setLastSeq).not.toHaveBeenCalled();
  });
});
