import { createDataSource } from '../data-source';

async function main(): Promise<void> {
  const dataSource = createDataSource();
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations();
    console.log(applied.length === 0 ? 'nothing to apply' : `applied ${applied.length} migration(s)`);
  } finally {
    await dataSource.destroy();
  }
}

// Only run the CLI when this file is the program entry point, so
// importing it for tests never opens a connection.
if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
