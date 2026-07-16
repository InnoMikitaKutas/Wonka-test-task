import { MigrationInterface, QueryRunner } from 'typeorm';

// Reproduces db/migrations/001_init.sql exactly. UNIQUE (stream, stream_version)
// is the optimistic-concurrency guard, and UNIQUE (event_id) is the
// idempotency guard: an append that loses either race must fail.
export class InitSchema1710000000000 implements MigrationInterface {
  name = 'InitSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS events (
        global_seq     BIGSERIAL PRIMARY KEY,
        event_id       UUID UNIQUE NOT NULL,
        stream         TEXT NOT NULL,
        stream_version INT NOT NULL,
        type           TEXT NOT NULL,
        schema_version INT NOT NULL DEFAULT 1,
        occurred_at    TIMESTAMPTZ NOT NULL,
        payload        JSONB NOT NULL,
        UNIQUE (stream, stream_version)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_events_stream ON events (stream)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS candidates_rm (
        id         TEXT PRIMARY KEY,
        name       TEXT,
        position   TEXT,
        source     TEXT,
        stage      INT NOT NULL,
        score      TEXT,
        offer_note TEXT,
        updated_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS slots_rm (
        id                  TEXT PRIMARY KEY,
        interviewer         TEXT,
        starts_at           TIMESTAMPTZ,
        scheduled_candidate TEXT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projector_state (
        id       INT PRIMARY KEY CHECK (id = 1),
        last_seq BIGINT NOT NULL DEFAULT 0
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS projector_state');
    await queryRunner.query('DROP TABLE IF EXISTS slots_rm');
    await queryRunner.query('DROP TABLE IF EXISTS candidates_rm');
    await queryRunner.query('DROP INDEX IF EXISTS idx_events_stream');
    await queryRunner.query('DROP TABLE IF EXISTS events');
  }
}
