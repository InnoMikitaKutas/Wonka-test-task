import {
  CandidateReadModelRepository,
  EventStoreRepository,
  SlotReadModelRepository,
  type StoredEvent,
} from '@ats/persistence';

// The underlying typeorm Repository types, inferred from each class's own
// constructor rather than imported from typeorm directly: persistence owns
// that dependency, tests only consume what it exports.
type EventStoreRepo = ConstructorParameters<typeof EventStoreRepository>[0];
type CandidateReadModelRepo = ConstructorParameters<
  typeof CandidateReadModelRepository
>[0];
type SlotReadModelRepo = ConstructorParameters<typeof SlotReadModelRepository>[0];

// Builds a real repository instance backed by a throwaway typeorm
// Repository. Tests never touch the underlying repository directly:
// every method that matters is replaced with jest.spyOn, so the
// service under test talks to a fully typed mock with no `any`.
export function createEventStoreRepository(): EventStoreRepository {
  return new EventStoreRepository({} as unknown as EventStoreRepo);
}

export function createCandidateReadModelRepository(): CandidateReadModelRepository {
  return new CandidateReadModelRepository({} as unknown as CandidateReadModelRepo);
}

export function createSlotReadModelRepository(): SlotReadModelRepository {
  return new SlotReadModelRepository({} as unknown as SlotReadModelRepo);
}

type StoredEventInput = Pick<StoredEvent, 'type' | 'stream' | 'payload'> &
  Partial<Omit<StoredEvent, 'type' | 'stream' | 'payload'>>;

export function storedEvent(input: StoredEventInput): StoredEvent {
  return {
    globalSeq: '1',
    eventId: 'event-1',
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt: '2024-01-01T00:00:00.000Z',
    ...input,
  };
}
