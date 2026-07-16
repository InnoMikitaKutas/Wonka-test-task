import { DomainError } from '@ats/engine';
import {
  OptimisticConcurrencyError,
  type CandidateReadModelEntity,
} from '@ats/persistence';
import { CandidatesService } from '../src/candidates/candidates.service';
import { Clock } from '../src/common/clock.service';
import { IdGenerator } from '../src/common/id.service';
import {
  createCandidateReadModelRepository,
  createEventStoreRepository,
  storedEvent,
} from './support/repository-mocks';

function setup() {
  const eventStore = createEventStoreRepository();
  const candidateReadModel = createCandidateReadModelRepository();
  const clock = new Clock();
  const idGenerator = new IdGenerator();
  const service = new CandidatesService(
    eventStore,
    candidateReadModel,
    clock,
    idGenerator,
  );
  return { eventStore, candidateReadModel, clock, idGenerator, service };
}

const applicationPayload = {
  candidateId: 'candidate-1',
  name: 'Ada Lovelace',
  position: 'Engineer',
  source: 'referral',
};

describe('CandidatesService.submitApplication', () => {
  it('appends one ApplicationReceived with expectedVersion 0 for a new candidate', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('candidate-1')
      .mockReturnValueOnce('command-1')
      .mockReturnValueOnce('event-1');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(0);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    const result = await service.submitApplication({
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });

    expect(result).toEqual({ candidateId: 'candidate-1' });
    expect(eventStore.loadStreams).toHaveBeenCalledWith(['candidate-candidate-1']);
    expect(append).toHaveBeenCalledWith(
      'candidate-candidate-1',
      [
        {
          eventId: 'event-1',
          type: 'ApplicationReceived',
          payload: applicationPayload,
          occurredAt: expect.any(String),
        },
      ],
      0,
    );
  });

  it('rejects a second submission for an existing candidate with CONFLICT', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('candidate-1')
      .mockReturnValueOnce('command-2');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
    ]);
    const append = jest.spyOn(eventStore, 'append');

    const promise = service.submitApplication({
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });

    await expect(promise).rejects.toBeInstanceOf(DomainError);
    await expect(promise).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(append).not.toHaveBeenCalled();
  });

  it('propagates an OptimisticConcurrencyError from append unchanged', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('candidate-2')
      .mockReturnValueOnce('command-3')
      .mockReturnValueOnce('event-2');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(0);
    jest
      .spyOn(eventStore, 'append')
      .mockRejectedValue(new OptimisticConcurrencyError('lost the race'));

    await expect(
      service.submitApplication({
        name: 'Grace Hopper',
        position: 'Engineer',
        source: 'referral',
      }),
    ).rejects.toBeInstanceOf(OptimisticConcurrencyError);
  });
});

describe('CandidatesService.changeStage', () => {
  it('appends a StageChanged event when the target stage differs', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('command-4')
      .mockReturnValueOnce('event-3');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
    ]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(1);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    const result = await service.changeStage('candidate-1', { toStage: 2 });

    expect(result).toEqual({ ok: true });
    expect(append).toHaveBeenCalledWith(
      'candidate-candidate-1',
      [
        {
          eventId: 'event-3',
          type: 'StageChanged',
          payload: { candidateId: 'candidate-1', fromStage: 1, toStage: 2 },
          occurredAt: expect.any(String),
        },
      ],
      1,
    );
  });

  it('rejects moving to the same stage with VALIDATION', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
    ]);

    await expect(
      service.changeStage('candidate-1', { toStage: 1 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('rejects an unknown candidate with NOT_FOUND', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);

    await expect(service.changeStage('missing', { toStage: 2 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('CandidatesService.assignScore', () => {
  it('appends a ScoreAssigned event for an existing candidate', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('command-5')
      .mockReturnValueOnce('event-4');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
    ]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(1);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    const result = await service.assignScore('candidate-1', {
      score: '87.50',
      assessor: 'panel-1',
    });

    expect(result).toEqual({ ok: true });
    expect(append).toHaveBeenCalledWith(
      'candidate-candidate-1',
      [
        {
          eventId: 'event-4',
          type: 'ScoreAssigned',
          payload: { candidateId: 'candidate-1', score: '87.50', assessor: 'panel-1' },
          occurredAt: expect.any(String),
        },
      ],
      1,
    );
  });

  it('rejects an unknown candidate with NOT_FOUND', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);

    await expect(
      service.assignScore('missing', { score: '87.50', assessor: 'panel-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('CandidatesService.extendOffer', () => {
  it('appends an OfferExtended event when the candidate is at the offer stage', async () => {
    const { eventStore, idGenerator, service } = setup();
    jest
      .spyOn(idGenerator, 'next')
      .mockReturnValueOnce('command-6')
      .mockReturnValueOnce('event-5');
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
      storedEvent({
        type: 'StageChanged',
        stream: 'candidate-candidate-1',
        streamVersion: 2,
        payload: { candidateId: 'candidate-1', fromStage: 1, toStage: 4 },
      }),
    ]);
    jest.spyOn(eventStore, 'currentVersion').mockResolvedValue(2);
    const append = jest.spyOn(eventStore, 'append').mockResolvedValue(undefined);

    const result = await service.extendOffer('candidate-1', { note: 'welcome aboard' });

    expect(result).toEqual({ ok: true });
    expect(append).toHaveBeenCalledWith(
      'candidate-candidate-1',
      [
        {
          eventId: 'event-5',
          type: 'OfferExtended',
          payload: { candidateId: 'candidate-1', note: 'welcome aboard' },
          occurredAt: expect.any(String),
        },
      ],
      2,
    );
  });

  it('rejects extending an offer outside the offer stage with VALIDATION', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([
      storedEvent({
        type: 'ApplicationReceived',
        stream: 'candidate-candidate-1',
        payload: applicationPayload,
      }),
    ]);

    await expect(
      service.extendOffer('candidate-1', { note: 'welcome aboard' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects an unknown candidate with NOT_FOUND', async () => {
    const { eventStore, service } = setup();
    jest.spyOn(eventStore, 'loadStreams').mockResolvedValue([]);

    await expect(
      service.extendOffer('missing', { note: 'welcome aboard' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('CandidatesService.getCandidate', () => {
  it('returns the candidate view when the candidate exists', async () => {
    const { candidateReadModel, service } = setup();
    const entity: CandidateReadModelEntity = {
      id: 'candidate-1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
      stage: 2,
      score: null,
      offerNote: null,
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    jest.spyOn(candidateReadModel, 'findById').mockResolvedValue(entity);

    await expect(service.getCandidate('candidate-1')).resolves.toEqual({
      id: 'candidate-1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
      stage: 2,
      score: null,
      offerNote: null,
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('rejects an unknown candidate with NOT_FOUND', async () => {
    const { candidateReadModel, service } = setup();
    jest.spyOn(candidateReadModel, 'findById').mockResolvedValue(null);

    await expect(service.getCandidate('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
