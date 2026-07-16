// Holds / reservations. Boundary tests left by D. and enabled with the feature.
import type { EventEnvelope } from '@ats/contracts';
import { decide, DomainError, initialState, reduce, type State } from '../src';

const T0 = '2024-01-08T09:00:00.000Z';

// Narrow test interfaces keep each scenario focused on the command and
// draft shapes it exercises.
interface ReserveSlotCommand {
  commandId: string;
  type: 'ReserveSlot';
  occurredAt: string;
  payload: { reservationId: string; slotId: string; candidateId: string };
}

interface SweepCommand {
  commandId: string;
  type: 'Sweep';
  occurredAt: string;
  payload: Record<string, never>;
}

interface ConfirmReservationCommand {
  commandId: string;
  type: 'ConfirmReservation';
  occurredAt: string;
  payload: { reservationId: string };
}

interface ReservationPlacedDraft {
  type: 'ReservationPlaced';
  stream: string;
  payload: {
    reservationId: string;
    slotId: string;
    candidateId: string;
    expiresAt: string;
  };
}

interface ReservationExpiredDraft {
  type: 'ReservationExpired';
  stream: string;
  payload: { reservationId: string };
}

type FutureDecide<Cmd, Draft> = (state: State, command: Cmd) => Draft[];

describe('reservations', () => {
  it('expires a pending reservation exactly at its expiresAt boundary', () => {
    const state: State = initialState();

    const placeReservation = decide as unknown as FutureDecide<
      ReserveSlotCommand,
      ReservationPlacedDraft
    >;
    const placeDrafts = placeReservation(state, {
      commandId: '33333333-3333-4333-8333-333333333333',
      type: 'ReserveSlot',
      occurredAt: T0,
      payload: { reservationId: 'r1', slotId: 's1', candidateId: 'c1' },
    });

    expect(placeDrafts).toHaveLength(1);
    expect(placeDrafts[0].type).toBe('ReservationPlaced');
    const expiresAt = placeDrafts[0].payload.expiresAt;
    expect(expiresAt).toBeTruthy();

    const placedEvent: EventEnvelope = {
      eventId: '44444444-4444-4444-8444-444444444444',
      type: placeDrafts[0].type,
      stream: placeDrafts[0].stream,
      streamVersion: 1,
      schemaVersion: 1,
      occurredAt: T0,
      payload: placeDrafts[0].payload,
    };
    const afterPlace = reduce(state, placedEvent);

    // The boundary is inclusive. At exactly expiresAt, the reservation
    // is already expired, so a sweep at that instant must catch it.
    const sweep = decide as unknown as FutureDecide<
      SweepCommand,
      ReservationPlacedDraft | ReservationExpiredDraft
    >;
    const sweepDrafts = sweep(afterPlace, {
      commandId: '33333333-3333-4333-8333-333333333333',
      type: 'Sweep',
      occurredAt: expiresAt,
      payload: {},
    });
    expect(sweepDrafts.some((d) => d.type === 'ReservationExpired')).toBe(true);

    // Expiry is derived from the incoming envelope time, so the slot is
    // immediately reusable at the boundary even before a sweep is projected.
    const replacement = placeReservation(afterPlace, {
      commandId: '66666666-6666-4666-8666-666666666666',
      type: 'ReserveSlot',
      occurredAt: expiresAt,
      payload: { reservationId: 'r2', slotId: 's1', candidateId: 'c2' },
    });
    expect(replacement).toHaveLength(1);
    expect(replacement[0].payload.reservationId).toBe('r2');
  });

  it('rejects confirming an expired reservation', () => {
    const state: State = initialState();

    const placeReservation = decide as unknown as FutureDecide<
      ReserveSlotCommand,
      ReservationPlacedDraft
    >;
    const placeDrafts = placeReservation(state, {
      commandId: '33333333-3333-4333-8333-333333333333',
      type: 'ReserveSlot',
      occurredAt: T0,
      payload: { reservationId: 'r1', slotId: 's1', candidateId: 'c1' },
    });
    const expiresAt = placeDrafts[0].payload.expiresAt;

    const placedEvent: EventEnvelope = {
      eventId: '55555555-5555-4555-8555-555555555555',
      type: placeDrafts[0].type,
      stream: placeDrafts[0].stream,
      streamVersion: 1,
      schemaVersion: 1,
      occurredAt: T0,
      payload: placeDrafts[0].payload,
    };
    const afterPlace = reduce(state, placedEvent);

    const confirmReservation = decide as unknown as FutureDecide<
      ConfirmReservationCommand,
      never
    >;
    let caught: DomainError | undefined;
    try {
      confirmReservation(afterPlace, {
        commandId: '33333333-3333-4333-8333-333333333333',
        type: 'ConfirmReservation',
        occurredAt: expiresAt,
        payload: { reservationId: 'r1' },
      });
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught?.code).toBe('GONE');
  });
});
