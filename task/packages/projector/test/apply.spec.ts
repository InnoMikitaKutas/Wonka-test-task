import {
  CandidateReadModelRepository,
  SlotReadModelRepository,
  type StoredEvent,
} from '@ats/persistence';
import { applyEvent, type ReadModelRepositories } from '../src/apply';

// The real repository classes take a typeorm Repository in their
// constructor. Tests never talk to one: every method that matters is
// replaced with jest.spyOn, so the placeholder cast below is the only
// thing standing in for it.
type CandidateRepo = ConstructorParameters<typeof CandidateReadModelRepository>[0];
type SlotRepo = ConstructorParameters<typeof SlotReadModelRepository>[0];

function setup(): ReadModelRepositories {
  return {
    candidateReadModel: new CandidateReadModelRepository({} as unknown as CandidateRepo),
    slotReadModel: new SlotReadModelRepository({} as unknown as SlotRepo),
  };
}

function storedEvent(type: string, payload: unknown): StoredEvent {
  return {
    globalSeq: '1',
    eventId: 'event-1',
    stream: 'candidate-c1',
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt: '2024-01-01T00:00:00.000Z',
    type,
    payload,
  };
}

describe('applyEvent', () => {
  it('ApplicationReceived calls upsertOnApplication with the payload fields', async () => {
    const repos = setup();
    const upsert = jest
      .spyOn(repos.candidateReadModel, 'upsertOnApplication')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('ApplicationReceived', {
        candidateId: 'c1',
        name: 'Ada Lovelace',
        position: 'Engineer',
        source: 'referral',
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      'c1',
      'Ada Lovelace',
      'Engineer',
      'referral',
      '2024-01-01T00:00:00.000Z',
    );
  });

  it('StageChanged calls updateStage with the target stage', async () => {
    const repos = setup();
    const updateStage = jest
      .spyOn(repos.candidateReadModel, 'updateStage')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('StageChanged', { candidateId: 'c1', fromStage: 1, toStage: 2 }),
    );

    expect(updateStage).toHaveBeenCalledWith('c1', 2, '2024-01-01T00:00:00.000Z');
  });

  it('ScoreAssigned calls updateScore with the score kept as a string', async () => {
    const repos = setup();
    const updateScore = jest
      .spyOn(repos.candidateReadModel, 'updateScore')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('ScoreAssigned', {
        candidateId: 'c1',
        score: '87.50',
        assessor: 'panel-1',
      }),
    );

    expect(updateScore).toHaveBeenCalledWith('c1', '87.50', '2024-01-01T00:00:00.000Z');
  });

  it('OfferExtended calls setOfferNote with the note', async () => {
    const repos = setup();
    const setOfferNote = jest
      .spyOn(repos.candidateReadModel, 'setOfferNote')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('OfferExtended', { candidateId: 'c1', note: 'welcome aboard' }),
    );

    expect(setOfferNote).toHaveBeenCalledWith(
      'c1',
      'welcome aboard',
      '2024-01-01T00:00:00.000Z',
    );
  });

  it('SlotOpened calls upsertOnOpen with the slot fields', async () => {
    const repos = setup();
    const upsertOnOpen = jest
      .spyOn(repos.slotReadModel, 'upsertOnOpen')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('SlotOpened', {
        slotId: 's1',
        interviewer: 'frank',
        startsAt: '2024-01-10T09:00:00.000Z',
      }),
    );

    expect(upsertOnOpen).toHaveBeenCalledWith('s1', 'frank', '2024-01-10T09:00:00.000Z');
  });

  it('InterviewScheduled calls setScheduledCandidate with both ids', async () => {
    const repos = setup();
    const setScheduledCandidate = jest
      .spyOn(repos.slotReadModel, 'setScheduledCandidate')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('InterviewScheduled', { slotId: 's1', candidateId: 'c1' }),
    );

    expect(setScheduledCandidate).toHaveBeenCalledWith('s1', 'c1');
  });

  it('ReservationPlaced records a pending reservation on the slot', async () => {
    const repos = setup();
    const placeReservation = jest
      .spyOn(repos.slotReadModel, 'placeReservation')
      .mockResolvedValue(undefined);

    await applyEvent(
      repos,
      storedEvent('ReservationPlaced', {
        reservationId: 'r1',
        slotId: 's1',
        candidateId: 'c1',
        expiresAt: '2024-01-09T00:00:00.000Z',
      }),
    );

    expect(placeReservation).toHaveBeenCalledWith(
      's1',
      'r1',
      'c1',
      '2024-01-09T00:00:00.000Z',
    );
  });

  it('ReservationConfirmed updates only the matching slot reservation', async () => {
    const repos = setup();
    const confirmReservation = jest
      .spyOn(repos.slotReadModel, 'confirmReservation')
      .mockResolvedValue(undefined);

    await applyEvent(repos, {
      ...storedEvent('ReservationConfirmed', { reservationId: 'r1' }),
      stream: 'slot-s1',
    });

    expect(confirmReservation).toHaveBeenCalledWith('s1', 'r1');
  });

  it('ReservationExpired updates only the matching slot reservation', async () => {
    const repos = setup();
    const expireReservation = jest
      .spyOn(repos.slotReadModel, 'expireReservation')
      .mockResolvedValue(undefined);

    await applyEvent(repos, {
      ...storedEvent('ReservationExpired', { reservationId: 'r1' }),
      stream: 'slot-s1',
    });

    expect(expireReservation).toHaveBeenCalledWith('s1', 'r1');
  });

  it('skips an unknown event type without throwing or touching a repository', async () => {
    const repos = setup();
    const upsert = jest.spyOn(repos.candidateReadModel, 'upsertOnApplication');
    const upsertOnOpen = jest.spyOn(repos.slotReadModel, 'upsertOnOpen');

    await expect(
      applyEvent(repos, storedEvent('SomeFutureEvent', { anything: 'goes' })),
    ).resolves.toBeUndefined();

    expect(upsert).not.toHaveBeenCalled();
    expect(upsertOnOpen).not.toHaveBeenCalled();
  });
});
