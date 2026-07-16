import { parseEventLine } from '../src/registry';
import { ScoreAssignedPayload } from '../src/events';

function envelope(
  type: string,
  stream: string,
  payload: unknown,
  streamVersion = 1,
): string {
  return JSON.stringify({
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
    type,
    stream,
    streamVersion,
    schemaVersion: 1,
    occurredAt: '2024-01-08T09:00:00.000Z',
    payload,
  });
}

describe('registry.parseEventLine', () => {
  const samples: Array<[string, string, unknown]> = [
    [
      'ApplicationReceived',
      'candidate-c1',
      { candidateId: 'c1', name: 'Ada', position: 'Engineer', source: 'referral' },
    ],
    ['StageChanged', 'candidate-c1', { candidateId: 'c1', fromStage: 1, toStage: 2 }],
    [
      'ScoreAssigned',
      'candidate-c1',
      { candidateId: 'c1', score: '87.50', assessor: 'bob' },
    ],
    ['OfferExtended', 'candidate-c1', { candidateId: 'c1', note: 'salary agreed' }],
    [
      'SlotOpened',
      'slot-s1',
      { slotId: 's1', interviewer: 'carol', startsAt: '2024-01-15T10:00:00.000Z' },
    ],
    ['InterviewScheduled', 'slot-s1', { slotId: 's1', candidateId: 'c1' }],
    [
      'ReservationPlaced',
      'slot-s1',
      {
        reservationId: 'r1',
        slotId: 's1',
        candidateId: 'c1',
        expiresAt: '2024-01-09T09:00:00.000Z',
      },
    ],
    ['ReservationConfirmed', 'slot-s1', { reservationId: 'r1' }],
    ['ReservationExpired', 'slot-s1', { reservationId: 'r1' }],
  ];

  it.each(samples)('round-trips a valid %s', (type, stream, payload) => {
    const parsed = parseEventLine(envelope(type, stream, payload));
    expect(parsed.type).toBe(type);
    expect(parsed.stream).toBe(stream);
    expect(parsed.payload).toEqual(payload);
  });

  it('rejects an unknown event type', () => {
    const line = envelope('CandidateDeleted', 'candidate-c1', { candidateId: 'c1' });
    expect(() => parseEventLine(line)).toThrow(/unknown event type/);
  });

  it('rejects a bad payload with the event type in the message', () => {
    const line = envelope('StageChanged', 'candidate-c1', { candidateId: 'c1' });
    expect(() => parseEventLine(line)).toThrow(/invalid payload for StageChanged/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseEventLine('{nope')).toThrow(/invalid JSON/);
  });
});

describe('score schema', () => {
  it('accepts a two-decimal string', () => {
    expect(
      ScoreAssignedPayload.safeParse({
        candidateId: 'c1',
        score: '87.50',
        assessor: 'bob',
      }).success,
    ).toBe(true);
  });

  it('rejects "87.5" (one decimal digit)', () => {
    expect(
      ScoreAssignedPayload.safeParse({
        candidateId: 'c1',
        score: '87.5',
        assessor: 'bob',
      }).success,
    ).toBe(false);
  });

  it('rejects the number 87.5', () => {
    expect(
      ScoreAssignedPayload.safeParse({
        candidateId: 'c1',
        score: 87.5,
        assessor: 'bob',
      }).success,
    ).toBe(false);
  });
});
