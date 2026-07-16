import type { Repository } from 'typeorm';
import { CandidateReadModelEntity, ProjectorStateEntity, SlotReadModelEntity } from '../src/entities';
import {
  CandidateReadModelRepository,
  ProjectorStateRepository,
  SlotReadModelRepository,
} from '../src/repositories';

function fakeInsertBuilder() {
  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ identifiers: [] }),
  };
  return builder;
}

describe('CandidateReadModelRepository', () => {
  it('upsertOnApplication builds an insert-only upsert with stage 1', async () => {
    const builder = fakeInsertBuilder();
    const repo = {
      createQueryBuilder: jest.fn(() => builder),
      findOneBy: jest.fn(),
      update: jest.fn(),
    } as unknown as Repository<CandidateReadModelEntity>;
    const candidates = new CandidateReadModelRepository(repo);

    await candidates.upsertOnApplication('c1', 'Ada', 'Engineer', 'referral', '2024-01-01T00:00:00.000Z');

    expect(builder.into).toHaveBeenCalledWith(CandidateReadModelEntity);
    expect(builder.values).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', stage: 1, score: null, offerNote: null }),
    );
    expect(builder.orIgnore).toHaveBeenCalled();
  });

  it('updateStage updates only stage and updatedAt for the given id', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const repo = { update } as unknown as Repository<CandidateReadModelEntity>;
    const candidates = new CandidateReadModelRepository(repo);

    await candidates.updateStage('c1', 3, '2024-01-02T00:00:00.000Z');

    expect(update).toHaveBeenCalledWith(
      { id: 'c1' },
      { stage: 3, updatedAt: new Date('2024-01-02T00:00:00.000Z') },
    );
  });

  it('updateScore keeps the score as a string', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const repo = { update } as unknown as Repository<CandidateReadModelEntity>;
    const candidates = new CandidateReadModelRepository(repo);

    await candidates.updateScore('c1', '4.50', '2024-01-02T00:00:00.000Z');

    expect(update).toHaveBeenCalledWith(
      { id: 'c1' },
      { score: '4.50', updatedAt: new Date('2024-01-02T00:00:00.000Z') },
    );
  });

  it('findById delegates to the repository', async () => {
    const findOneBy = jest.fn().mockResolvedValue(null);
    const repo = { findOneBy } as unknown as Repository<CandidateReadModelEntity>;
    const candidates = new CandidateReadModelRepository(repo);

    await expect(candidates.findById('missing')).resolves.toBeNull();
    expect(findOneBy).toHaveBeenCalledWith({ id: 'missing' });
  });
});

describe('SlotReadModelRepository', () => {
  it('upsertOnOpen builds an insert-only upsert with no scheduled candidate', async () => {
    const builder = fakeInsertBuilder();
    const repo = { createQueryBuilder: jest.fn(() => builder) } as unknown as Repository<SlotReadModelEntity>;
    const slots = new SlotReadModelRepository(repo);

    await slots.upsertOnOpen('s1', 'frank', '2024-01-10T09:00:00.000Z');

    expect(builder.into).toHaveBeenCalledWith(SlotReadModelEntity);
    expect(builder.values).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', interviewer: 'frank', scheduledCandidate: null }),
    );
  });

  it('setScheduledCandidate updates only that column', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const repo = { update } as unknown as Repository<SlotReadModelEntity>;
    const slots = new SlotReadModelRepository(repo);

    await slots.setScheduledCandidate('s1', 'c1');

    expect(update).toHaveBeenCalledWith({ id: 's1' }, { scheduledCandidate: 'c1' });
  });
});

describe('ProjectorStateRepository', () => {
  it('getLastSeq returns the existing row without inserting', async () => {
    const findOneBy = jest.fn().mockResolvedValue({ id: 1, lastSeq: '42' });
    const builder = fakeInsertBuilder();
    const repo = {
      findOneBy,
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as Repository<ProjectorStateEntity>;
    const state = new ProjectorStateRepository(repo);

    await expect(state.getLastSeq()).resolves.toBe('42');
    expect(builder.execute).not.toHaveBeenCalled();
  });

  it('getLastSeq creates the id = 1 row at 0 when missing', async () => {
    const findOneBy = jest.fn().mockResolvedValue(null);
    const builder = fakeInsertBuilder();
    const repo = {
      findOneBy,
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as Repository<ProjectorStateEntity>;
    const state = new ProjectorStateRepository(repo);

    await expect(state.getLastSeq()).resolves.toBe('0');
    expect(builder.values).toHaveBeenCalledWith({ id: 1, lastSeq: '0' });
  });

  it('setLastSeq updates the id = 1 row', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const repo = { update } as unknown as Repository<ProjectorStateEntity>;
    const state = new ProjectorStateRepository(repo);

    await state.setLastSeq('99');

    expect(update).toHaveBeenCalledWith({ id: 1 }, { lastSeq: '99' });
  });
});
