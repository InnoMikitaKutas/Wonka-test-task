import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Reservations1720000000000 implements MigrationInterface {
  name = 'Reservations1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reservations_rm (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_reservations_slot ON reservations_rm (slot_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS reservations_rm');
  }
}
