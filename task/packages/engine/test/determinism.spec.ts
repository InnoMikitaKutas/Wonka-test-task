import type { EventEnvelope } from '@ats/contracts';
import { initialState, reduce, stateHash } from '../src';

// Six hand-crafted events: one candidate moves from applied to interview,
// gets a score, and is scheduled into a slot. All timestamps are fixed
// string literals, not computed from the clock. See docs/adr/0001.
const EVENTS: EventEnvelope[] = [
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
    type: 'ApplicationReceived',
    stream: 'candidate-c1',
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt: '2024-01-08T09:00:00.000Z',
    payload: { candidateId: 'c1', name: 'Ada Lovelace', position: 'Engineer', source: 'referral' },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad3',
    type: 'StageChanged',
    stream: 'candidate-c1',
    streamVersion: 2,
    schemaVersion: 1,
    occurredAt: '2024-01-08T10:00:00.000Z',
    payload: { candidateId: 'c1', fromStage: 1, toStage: 2 },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad4',
    type: 'StageChanged',
    stream: 'candidate-c1',
    streamVersion: 3,
    schemaVersion: 1,
    occurredAt: '2024-01-09T09:00:00.000Z',
    payload: { candidateId: 'c1', fromStage: 2, toStage: 3 },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad5',
    type: 'ScoreAssigned',
    stream: 'candidate-c1',
    streamVersion: 4,
    schemaVersion: 1,
    occurredAt: '2024-01-09T10:00:00.000Z',
    payload: { candidateId: 'c1', score: '87.50', assessor: 'bob' },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad6',
    type: 'SlotOpened',
    stream: 'slot-s1',
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt: '2024-01-10T09:00:00.000Z',
    payload: { slotId: 's1', interviewer: 'carol', startsAt: '2024-01-15T10:00:00.000Z' },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad7',
    type: 'InterviewScheduled',
    stream: 'slot-s1',
    streamVersion: 2,
    schemaVersion: 1,
    occurredAt: '2024-01-10T09:30:00.000Z',
    payload: { slotId: 's1', candidateId: 'c1' },
  },
];

describe('determinism', () => {
  it('folding the same events twice from initialState gives the same hash', () => {
    const start = initialState();

    let a = start;
    for (const event of EVENTS) {
      a = reduce(a, event);
    }

    let b = initialState();
    for (const event of EVENTS) {
      b = reduce(b, event);
    }

    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('reduce never mutates the state it is given', () => {
    const start = initialState();
    const snapshotBeforeFold = { candidates: {}, slots: {} };
    expect(start).toEqual(snapshotBeforeFold);

    let state = start;
    for (const event of EVENTS) {
      state = reduce(state, event);
    }

    // The original object handed to the first reduce call must still
    // look like a fresh initial state. Folding must never write into it.
    expect(start).toEqual(snapshotBeforeFold);
  });
});
