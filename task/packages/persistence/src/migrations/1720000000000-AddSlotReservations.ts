import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlotReservations1720000000000 implements MigrationInterface {
  name = 'AddSlotReservations1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE slots_rm
        ADD COLUMN IF NOT EXISTS reservation_id TEXT,
        ADD COLUMN IF NOT EXISTS reservation_candidate TEXT,
        ADD COLUMN IF NOT EXISTS reservation_status TEXT,
        ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE slots_rm
        DROP COLUMN IF EXISTS reservation_expires_at,
        DROP COLUMN IF EXISTS reservation_status,
        DROP COLUMN IF EXISTS reservation_candidate,
        DROP COLUMN IF EXISTS reservation_id
    `);
  }
}
