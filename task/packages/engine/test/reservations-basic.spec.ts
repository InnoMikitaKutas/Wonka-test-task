import type { CommandEnvelope, EventDraft, EventEnvelope } from '@ats/contracts';
import { decide, initialState, reduce, type State } from '../src';

const COMMAND_ID = '33333333-3333-4333-8333-333333333333';
const EVENT_ID = '44444444-4444-4444-8444-444444444444';
const T0 = '2024-01-08T09:00:00.000Z';

function command(type: string, payload: unknown, occurredAt = T0): CommandEnvelope {
  return { commandId: COMMAND_ID, type, occurredAt, payload };
}

function fold(state: State, draft: EventDraft, occurredAt: string): State {
  const event: EventEnvelope = {
    eventId: EVENT_ID,
    type: draft.type,
    stream: draft.stream,
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt,
    payload: draft.payload,
  };
  return reduce(state, event);
}

describe('reservations basic flow', () => {
  it('places and confirms a pending reservation before its deadline', () => {
    const placed = decide(
      initialState(),
      command('ReserveSlot', { reservationId: 'r1', slotId: 's1', candidateId: 'c1' }),
    )[0];
    expect(placed).toMatchObject({
      type: 'ReservationPlaced',
      payload: { reservationId: 'r1', slotId: 's1' },
    });

    const afterPlace = fold(initialState(), placed, T0);
    const confirmed = decide(
      afterPlace,
      command('ConfirmReservation', { reservationId: 'r1' }, '2024-01-09T08:59:59.000Z'),
    );
    expect(confirmed).toEqual([
      {
        type: 'ReservationConfirmed',
        stream: 'reservation-r1',
        payload: { reservationId: 'r1', slotId: 's1' },
      },
    ]);
  });

  it('sweeps an overdue reservation and then permits another reservation', () => {
    const placed = decide(
      initialState(),
      command('ReserveSlot', { reservationId: 'r1', slotId: 's1', candidateId: 'c1' }),
    )[0];
    const afterPlace = fold(initialState(), placed, T0);
    const sweepAt = '2024-01-09T09:00:00.001Z';
    const expired = decide(afterPlace, command('Sweep', {}, sweepAt))[0];
    expect(expired.type).toBe('ReservationExpired');

    const afterExpiry = fold(afterPlace, expired, sweepAt);
    const replacement = decide(
      afterExpiry,
      command(
        'ReserveSlot',
        { reservationId: 'r2', slotId: 's1', candidateId: 'c2' },
        sweepAt,
      ),
    );
    expect(replacement[0]).toMatchObject({
      type: 'ReservationPlaced',
      payload: { reservationId: 'r2', slotId: 's1' },
    });
  });
});
