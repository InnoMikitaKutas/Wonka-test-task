import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DataSource, QueryRunner } from 'typeorm';
import { seed } from '../src/cli/seed';

// manager.count(EventEntity) is called once before the batches and once
// after; countSequence supplies those two values in order. The insert
// count is the delta, not the insert result, since TypeORM's insert
// result reports one identifier per submitted row even when
// ON CONFLICT DO NOTHING silently skips a duplicate.
function fakeQueryRunner(countSequence: number[]) {
  let countCall = 0;
  const count = jest.fn().mockImplementation(() => {
    const value = countSequence[countCall] ?? 0;
    countCall += 1;
    return Promise.resolve(value);
  });
  const execute = jest.fn().mockResolvedValue({ identifiers: [] });
  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute,
  };
  const manager = { createQueryBuilder: jest.fn(() => builder), count };
  const queryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager,
  } as unknown as QueryRunner;
  return { queryRunner, builder };
}

function fakeDataSource(queryRunner: QueryRunner): DataSource {
  return { createQueryRunner: jest.fn(() => queryRunner) } as unknown as DataSource;
}

function line(eventId: string, stream: string): string {
  return JSON.stringify({
    eventId,
    type: 'ApplicationReceived',
    stream,
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt: '2024-01-01T00:00:00.000Z',
    payload: { candidateId: stream },
  });
}

describe('seed', () => {
  let dir: string;
  let fixturePath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'persistence-seed-'));
    fixturePath = path.join(dir, 'events.jsonl');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('skips blank lines, inserts the rest in file order, and returns the row-count delta', async () => {
    writeFileSync(fixturePath, [line('e1', 'candidate-c1'), '', line('e2', 'candidate-c2'), ''].join('\n'));

    const { queryRunner, builder } = fakeQueryRunner([0, 2]);

    const inserted = await seed(fakeDataSource(queryRunner), fixturePath);

    expect(inserted).toBe(2);
    expect(builder.values).toHaveBeenCalledTimes(1);
    expect(builder.values).toHaveBeenCalledWith([
      expect.objectContaining({ eventId: 'e1' }),
      expect.objectContaining({ eventId: 'e2' }),
    ]);
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('returns 0 when every row already exists', async () => {
    writeFileSync(fixturePath, line('e1', 'candidate-c1'));

    const { queryRunner } = fakeQueryRunner([5, 5]);

    const inserted = await seed(fakeDataSource(queryRunner), fixturePath);

    expect(inserted).toBe(0);
  });

  it('rolls back and rethrows when the insert fails', async () => {
    writeFileSync(fixturePath, line('e1', 'candidate-c1'));

    const { queryRunner, builder } = fakeQueryRunner([0]);
    builder.execute.mockRejectedValueOnce(new Error('boom'));

    await expect(seed(fakeDataSource(queryRunner), fixturePath)).rejects.toThrow('boom');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});
