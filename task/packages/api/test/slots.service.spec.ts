import type { SlotReadModelEntity } from '@ats/persistence';
import { SlotsService } from '../src/slots/slots.service';
import { Clock } from '../src/common/clock.service';
import { IdGenerator } from '../src/common/id.service';
import {
  createEventStoreRepository,
  createSlotReadModelRepository,
  storedEvent,
} from './support/repository-mocks';

function setup() {
  const eventStore = createEventStoreRepository();
  const slotReadModel = createSlotReadModelRepository();
  const clock = new Clock();
  const idGenerator = new IdGenerator();
  const service = new SlotsService(eventStore, slotReadModel, clock, idGenerator);
  return { eventStore, slotReadModel, clock, idGenerator, service };
}

const applicationPayload = {
  candidateId: 'candidate-1',
  name: 'Ada Lovelace',
  position: 'Engineer',
  source: 'referral',
};

describe('SlotsService.openSlot', () => {
  it('appends one SlotOpened with expectedVersion 0 for a new slot', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('slot-1')
      .mockReturnValueOnce('command-1')
      .mockReturnValueOnce('event-1');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(0);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    const result = await service.openSlot({
      interviewer: 'Grace Hopper',
      startsAt: '2024-02-01T10:00:00.000Z',
    });

    expect(result).toEqual({ slotId: 'slot-1' });
    expect(eventStore.loadStreams).toHaveBeenCalledWith(['slot-slot-1']);
    expect(append).toHaveBeenCalledWith(
      'slot-slot-1',
      [
        {
          eventId: 'event-1',
          type: 'SlotOpened',
          payload: {
            slotId: 'slot-1',
            interviewer: 'Grace Hopper',
            startsAt: '2024-02-01T10:00:00.000Z',
          },
          occurredAt: expect.any(String),
        },
      ],
      0,
    );
  });
});

describe('SlotsService.scheduleInterview', () => {
  it('appends an InterviewScheduled event when the slot is open and the candidate qualifies', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('command-2')
      .mockReturnValueOnce('event-2');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'SlotOpened',
        stream: 'slot-slot-1',
        payload: {
          slotId: 'slot-1',
          interviewer: 'Grace Hopper',
          startsAt: '2024-02-01T10:00:00.000Z',
        },
      }),
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
      storedEvent({
        type: 'StageChanged',
        stream: 'candidate-candidate-1',
        payload: { candidateId: 'candidate-1', fromStage: 1, toStage: 3 },
      }),
    ]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(1);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    const result = await service.scheduleInterview('slot-1', {
      candidateId: 'candidate-1',
    });

    expect(result).toEqual({ ok: true });
    expect(eventStore.loadStreams).toHaveBeenCalledWith([
      'slot-slot-1',
      'candidate-candidate-1',
    ]);
    expect(append).toHaveBeenCalledWith(
      'slot-slot-1',
      [
        {
          eventId: 'event-2',
          type: 'InterviewScheduled',
          payload: { slotId: 'slot-1', candidateId: 'candidate-1' },
          occurredAt: expect.any(String),
        },
      ],
      1,
    );
  });

  it('rejects scheduling an already taken slot with CONFLICT', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'SlotOpened',
        stream: 'slot-slot-1',
        payload: {
          slotId: 'slot-1',
          interviewer: 'Grace Hopper',
          startsAt: '2024-02-01T10:00:00.000Z',
        },
      }),
      storedEvent({
        type: 'InterviewScheduled',
        stream: 'slot-slot-1',
        payload: { slotId: 'slot-1', candidateId: 'candidate-other' },
      }),
    ]);
    const append = jest.spyOn(eventStore, 'append');

    await expect(
      service.scheduleInterview('slot-1', { candidateId: 'candidate-1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(append).not.toHaveBeenCalled();
  });

  it('rejects a candidate before the interview stage with VALIDATION', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'SlotOpened',
        stream: 'slot-slot-1',
        payload: {
          slotId: 'slot-1',
          interviewer: 'Grace Hopper',
          startsAt: '2024-02-01T10:00:00.000Z',
        },
      }),
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
    ]);

    await expect(
      service.scheduleInterview('slot-1', { candidateId: 'candidate-1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects an unknown slot with NOT_FOUND', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);

    await expect(
      service.scheduleInterview('missing', { candidateId: 'candidate-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('SlotsService.getSlot', () => {
  it('returns the slot view when the slot exists', async () => {
    const { slotReadModel, service } = setup();
    const entity: SlotReadModelEntity = {
      id: 'slot-1',
      interviewer: 'Grace Hopper',
      startsAt: new Date('2024-02-01T10:00:00.000Z'),
      scheduledCandidate: null,
    };
    jest.spyOn(slotReadModel, 'findById').mockResolvedValue(entity);

    await expect(service.getSlot('slot-1')).resolves.toEqual({
      id: 'slot-1',
      interviewer: 'Grace Hopper',
      startsAt: '2024-02-01T10:00:00.000Z',
      scheduledCandidateId: null,
    });
  });

  it('rejects an unknown slot with NOT_FOUND', async () => {
    const { slotReadModel, service } = setup();
    jest.spyOn(slotReadModel, 'findById').mockResolvedValue(null);

    await expect(service.getSlot('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
