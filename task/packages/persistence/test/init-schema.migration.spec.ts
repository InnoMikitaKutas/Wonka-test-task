import type { QueryRunner } from 'typeorm';
import { InitSchema1710000000000 } from '../src/migrations/1710000000000-InitSchema';

function fakeQueryRunner() {
  return { query: jest.fn().mockResolvedValue(undefined) } as unknown as QueryRunner;
}

describe('InitSchema1710000000000', () => {
  it('creates the four tables with their constraints on up()', async () => {
    const queryRunner = fakeQueryRunner();
    const migration = new InitSchema1710000000000();

    await migration.up(queryRunner);

    const statements = (queryRunner.query as jest.Mock).mock.calls.map((call) => call[0] as string);
    const combined = statements.join('\n');

    expect(combined).toContain('CREATE TABLE IF NOT EXISTS events');
    expect(combined).toContain('UNIQUE (stream, stream_version)');
    expect(combined).toContain('event_id       UUID UNIQUE NOT NULL');
    expect(combined).toContain('CREATE INDEX IF NOT EXISTS idx_events_stream ON events (stream)');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS candidates_rm');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS slots_rm');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS projector_state');
    expect(combined).toContain('CHECK (id = 1)');
  });

  it('drops the tables in reverse dependency order on down()', async () => {
    const queryRunner = fakeQueryRunner();
    const migration = new InitSchema1710000000000();

    await migration.down(queryRunner);

    const statements = (queryRunner.query as jest.Mock).mock.calls.map((call) => call[0] as string);
    expect(statements).toEqual([
      'DROP TABLE IF EXISTS projector_state',
      'DROP TABLE IF EXISTS slots_rm',
      'DROP TABLE IF EXISTS candidates_rm',
      'DROP INDEX IF EXISTS idx_events_stream',
      'DROP TABLE IF EXISTS events',
    ]);
  });
});
