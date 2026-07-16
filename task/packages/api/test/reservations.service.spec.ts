import { ReservationsService } from '../src/reservations/reservations.service';
import { Clock } from '../src/common/clock.service';
import { IdGenerator } from '../src/common/id.service';
import { createEventStoreRepository, storedEvent } from './support/repository-mocks';

const T0 = '2024-01-08T09:00:00.000Z';

function setup() {
  const eventStore = createEventStoreRepository();
  const clock = new Clock();
  const idGenerator = new IdGenerator();
  const service = new ReservationsService(eventStore, clock, idGenerator);
  jest.spyOn(clock, 'now').mockReturnValue(T0);
  return { eventStore, clock, idGenerator, service };
}

describe('ReservationsService', () => {
  it('places a pending reservation on the slot stream with its snapshot version', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('reservation-1')
      .mockReturnValueOnce('command-1')
      .mockReturnValueOnce('event-1');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'SlotOpened',
        stream: 'slot-slot-1',
        streamVersion: 1,
        payload: {
          slotId: 'slot-1',
          interviewer: 'Grace Hopper',
          startsAt: '2024-02-01T10:00:00.000Z',
        },
      }),
    ]);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    await expect(service.reserve('candidate-1', { slotId: 'slot-1' })).resolves.toEqual({
      reservationId: 'reservation-1',
      status: 'pending',
      expiresAt: '2024-01-09T09:00:00.000Z',
    });
    expect(append).toHaveBeenCalledWith(
      'slot-slot-1',
      [
        {
          eventId: 'event-1',
          type: 'ReservationPlaced',
          occurredAt: T0,
          payload: {
            reservationId: 'reservation-1',
            slotId: 'slot-1',
            candidateId: 'candidate-1',
            expiresAt: '2024-01-09T09:00:00.000Z',
          },
        },
      ],
      1,
    );
  });

  it('confirms an unexpired pending reservation', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest.spyOn(eventStore, 'findReservationStream').mockResolvedValue('slot-slot-1');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ReservationPlaced',
        stream: 'slot-slot-1',
        streamVersion: 2,
        payload: {
          reservationId: 'reservation-1',
          slotId: 'slot-1',
          candidateId: 'candidate-1',
          expiresAt: '2024-01-09T09:00:00.000Z',
        },
      }),
    ]);
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('command-1')
      .mockReturnValueOnce('event-1');
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    await expect(service.confirm('reservation-1')).resolves.toEqual({
      status: 'confirmed',
    });
    expect(append).toHaveBeenCalledWith(
      'slot-slot-1',
      [
        {
          eventId: 'event-1',
          type: 'ReservationConfirmed',
          occurredAt: T0,
          payload: { reservationId: 'reservation-1' },
        },
      ],
      2,
    );
  });

  it('returns zero on a sweep with no reservations', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest.spyOn(eventStore, 'loadByTypes').mockResolvedValue([]);
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);
    jest.spyOn(idGenerator, 'next').mockReturnValueOnce('command-1');
    const append = jest.spyOn(eventStore, 'append');

    await expect(service.sweep()).resolves.toEqual({ expired: 0 });
    expect(append).not.toHaveBeenCalled();
  });
});
