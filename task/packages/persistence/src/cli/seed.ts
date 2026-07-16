import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import type { DataSource, QueryDeepPartialEntity, QueryRunner } from 'typeorm';
import type { EventEnvelope } from '@ats/contracts';
import { createDataSource } from '../data-source';
import { EventEntity } from '../entities';

const DEFAULT_FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'fixtures',
  'events.jsonl',
);

const BATCH_SIZE = 500;

// The jsonb payload column is typed unknown on the entity, which
// TypeORM's deep-partial insert type cannot express structurally. The
// cast is exact: this is the same row, only widened back through
// unknown to satisfy that type.
function toInsertRow(event: EventEnvelope): QueryDeepPartialEntity<EventEntity> {
  return {
    eventId: event.eventId,
    stream: event.stream,
    streamVersion: event.streamVersion,
    type: event.type,
    schemaVersion: event.schemaVersion,
    occurredAt: new Date(event.occurredAt),
    payload: event.payload,
  } as unknown as QueryDeepPartialEntity<EventEntity>;
}

// Inserts one batch, in the transaction the caller already opened.
// ON CONFLICT DO NOTHING (via orIgnore) makes a rerun over the same
// fixture safe: rows already present are skipped, not duplicated.
async function insertBatch(queryRunner: QueryRunner, batch: EventEnvelope[]): Promise<void> {
  if (batch.length === 0) return;
  await queryRunner.manager
    .createQueryBuilder()
    .insert()
    .into(EventEntity)
    .values(batch.map(toInsertRow))
    .orIgnore()
    .execute();
}

// Reads the fixture in file order and inserts it in one transaction,
// so global_seq follows the file order. Returns the number of rows
// actually inserted.
//
// The count is the row-count delta across the transaction rather than
// the insert result's identifiers: TypeORM reports one identifier per
// submitted row regardless of ON CONFLICT DO NOTHING skips, so it
// cannot tell a real insert from a skipped duplicate.
export async function seed(
  dataSource: DataSource,
  fixturePath: string = DEFAULT_FIXTURE_PATH,
): Promise<number> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const before = await queryRunner.manager.count(EventEntity);

    const rl = createInterface({
      input: createReadStream(fixturePath, 'utf8'),
      crlfDelay: Infinity,
    });
    let batch: EventEnvelope[] = [];
    for await (const line of rl) {
      if (line.trim() === '') continue;
      batch.push(JSON.parse(line) as EventEnvelope);
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(queryRunner, batch);
        batch = [];
      }
    }
    await insertBatch(queryRunner, batch);

    const after = await queryRunner.manager.count(EventEntity);
    await queryRunner.commitTransaction();
    return after - before;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}

async function main(): Promise<void> {
  const dataSource = createDataSource();
  await dataSource.initialize();
  try {
    const inserted = await seed(dataSource);
    console.log(`inserted ${inserted} event(s)`);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
