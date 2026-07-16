import type { CommandEnvelope, EventDraft, EventEnvelope } from '@ats/contracts';
import { decide, DomainError, initialState, reduce, type State } from '../src';

// Fixed values so tests never touch the clock or a random source.
// See docs/adr/0001: time enters only through envelopes.
const FIXED_COMMAND_ID = '11111111-1111-4111-8111-111111111111';
const FIXED_EVENT_ID = '22222222-2222-4222-8222-222222222222';
const T0 = '2024-01-08T09:00:00.000Z';
const T1 = '2024-01-08T09:05:00.000Z';

function command(type: string, payload: unknown, occurredAt = T0): CommandEnvelope {
  return { commandId: FIXED_COMMAND_ID, type, occurredAt, payload };
}

// Turns EventDrafts into full envelopes and folds them into state.
// This is how the real edge behaves: it assigns eventId, copies
// occurredAt from the command, and assigns the next stream version.
function foldDrafts(
  state: State,
  drafts: EventDraft[],
  occurredAt: string,
  streamVersions: Map<string, number>,
): State {
  let next = state;
  for (const draft of drafts) {
    const version = (streamVersions.get(draft.stream) ?? 0) + 1;
    streamVersions.set(draft.stream, version);
    const envelope: EventEnvelope = {
      eventId: FIXED_EVENT_ID,
      type: draft.type,
      stream: draft.stream,
      streamVersion: version,
      schemaVersion: 1,
      occurredAt,
      payload: draft.payload,
    };
    next = reduce(next, envelope);
  }
  return next;
}

// Runs one command against the state and folds the resulting drafts back
// in, so tests can build up multi-step scenarios (a candidate reaching
// stage 4, a slot with a scheduled interview, and so on).
function apply(
  state: State,
  streamVersions: Map<string, number>,
  type: string,
  payload: unknown,
  occurredAt = T0,
): State {
  const drafts = decide(state, command(type, payload, occurredAt));
  return foldDrafts(state, drafts, occurredAt, streamVersions);
}

describe('decide (happy paths)', () => {
  it('SubmitApplication produces one ApplicationReceived draft, and folding it creates a stage 1 candidate', () => {
    const state = initialState();
    const drafts = decide(
      state,
      command('SubmitApplication', {
        candidateId: 'c1',
        name: 'Ada Lovelace',
        position: 'Engineer',
        source: 'referral',
      }),
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual({
      type: 'ApplicationReceived',
      stream: 'candidate-c1',
      payload: {
        candidateId: 'c1',
        name: 'Ada Lovelace',
        position: 'Engineer',
        source: 'referral',
      },
    });

    const streamVersions = new Map<string, number>();
    const next = foldDrafts(state, drafts, T0, streamVersions);
    expect(next.candidates['c1']).toMatchObject({ id: 'c1', stage: 1 });
  });

  it('ChangeStage from 1 to 2 produces a StageChanged draft with fromStage 1 and toStage 2', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    state = apply(state, streamVersions, 'SubmitApplication', {
      candidateId: 'c1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });

    const drafts = decide(state, command('ChangeStage', { candidateId: 'c1', toStage: 2 }, T1));
    expect(drafts).toEqual([
      {
        type: 'StageChanged',
        stream: 'candidate-c1',
        payload: { candidateId: 'c1', fromStage: 1, toStage: 2 },
      },
    ]);

    const next = foldDrafts(state, drafts, T1, streamVersions);
    expect(next.candidates['c1'].stage).toBe(2);
  });
});

describe('decide (error rules)', () => {
  it('SubmitApplication twice throws CONFLICT', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    state = apply(state, streamVersions, 'SubmitApplication', {
      candidateId: 'c1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });

    let caught: DomainError | undefined;
    try {
      decide(
        state,
        command('SubmitApplication', {
          candidateId: 'c1',
          name: 'Ada Lovelace',
          position: 'Engineer',
          source: 'referral',
        }),
      );
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('CONFLICT');
  });

  it('ChangeStage on a missing candidate throws NOT_FOUND', () => {
    const state = initialState();
    let caught: DomainError | undefined;
    try {
      decide(state, command('ChangeStage', { candidateId: 'ghost', toStage: 2 }));
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('NOT_FOUND');
  });

  it('ChangeStage to the current stage throws VALIDATION', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    state = apply(state, streamVersions, 'SubmitApplication', {
      candidateId: 'c1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });

    let caught: DomainError | undefined;
    try {
      decide(state, command('ChangeStage', { candidateId: 'c1', toStage: 1 }));
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('VALIDATION');
  });

  it('ExtendOffer when the candidate is not at stage 4 throws VALIDATION', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    state = apply(state, streamVersions, 'SubmitApplication', {
      candidateId: 'c1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });

    let caught: DomainError | undefined;
    try {
      decide(state, command('ExtendOffer', { candidateId: 'c1', note: 'salary agreed' }));
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('VALIDATION');
  });

  it('OpenSlot twice throws CONFLICT', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    state = apply(state, streamVersions, 'OpenSlot', {
      slotId: 's1',
      interviewer: 'Carol',
      startsAt: '2024-01-15T10:00:00.000Z',
    });

    let caught: DomainError | undefined;
    try {
      decide(
        state,
        command('OpenSlot', {
          slotId: 's1',
          interviewer: 'Carol',
          startsAt: '2024-01-15T10:00:00.000Z',
        }),
      );
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('CONFLICT');
  });

  it('ScheduleInterview on an already taken slot throws CONFLICT', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    // Bring a candidate up to stage 3 (interview), one step at a time.
    state = apply(state, streamVersions, 'SubmitApplication', {
      candidateId: 'c1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });
    state = apply(state, streamVersions, 'ChangeStage', { candidateId: 'c1', toStage: 2 });
    state = apply(state, streamVersions, 'ChangeStage', { candidateId: 'c1', toStage: 3 });
    state = apply(state, streamVersions, 'OpenSlot', {
      slotId: 's1',
      interviewer: 'Carol',
      startsAt: '2024-01-15T10:00:00.000Z',
    });
    state = apply(state, streamVersions, 'ScheduleInterview', { slotId: 's1', candidateId: 'c1' });

    let caught: DomainError | undefined;
    try {
      decide(state, command('ScheduleInterview', { slotId: 's1', candidateId: 'c1' }));
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('CONFLICT');
  });

  it('ScheduleInterview when the candidate is before the interview stage throws VALIDATION', () => {
    const streamVersions = new Map<string, number>();
    let state = initialState();
    state = apply(state, streamVersions, 'SubmitApplication', {
      candidateId: 'c1',
      name: 'Ada Lovelace',
      position: 'Engineer',
      source: 'referral',
    });
    state = apply(state, streamVersions, 'OpenSlot', {
      slotId: 's1',
      interviewer: 'Carol',
      startsAt: '2024-01-15T10:00:00.000Z',
    });

    let caught: DomainError | undefined;
    try {
      decide(state, command('ScheduleInterview', { slotId: 's1', candidateId: 'c1' }));
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('VALIDATION');
  });

  it('an unknown command type throws VALIDATION', () => {
    const state = initialState();
    let caught: DomainError | undefined;
    try {
      decide(state, command('DoSomethingUnknown', {}));
    } catch (err) {
      caught = err as DomainError;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect(caught?.code).toBe('VALIDATION');
  });
});
