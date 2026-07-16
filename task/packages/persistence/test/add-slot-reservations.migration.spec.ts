import type { QueryRunner } from 'typeorm';
import { AddSlotReservations1720000000000 } from '../src/migrations/1720000000000-AddSlotReservations';

function fakeQueryRunner() {
  return { query: jest.fn().mockResolvedValue(undefined) } as unknown as QueryRunner;
}

describe('AddSlotReservations1720000000000', () => {
  it('adds reservation projection columns', async () => {
    const queryRunner = fakeQueryRunner();
    await new AddSlotReservations1720000000000().up(queryRunner);

    const statement = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(statement).toContain('reservation_id');
    expect(statement).toContain('reservation_candidate');
    expect(statement).toContain('reservation_status');
    expect(statement).toContain('reservation_expires_at');
  });

  it('drops reservation projection columns on rollback', async () => {
    const queryRunner = fakeQueryRunner();
    await new AddSlotReservations1720000000000().down(queryRunner);

    const statement = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(statement).toContain('DROP COLUMN IF EXISTS reservation_expires_at');
    expect(statement).toContain('DROP COLUMN IF EXISTS reservation_id');
  });
});
