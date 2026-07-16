import { bootstrap } from './data-source';
import { catchUp } from './projector';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(): Promise<void> {
  const repos = await bootstrap();
  try {
    const count = await catchUp(repos);
    console.log(`projected ${count} events`);
  } finally {
    await repos.dataSource.destroy();
  }
}

async function runWatch(): Promise<void> {
  const repos = await bootstrap();
  console.log('projector watching for new events every 1000ms (ctrl-c to stop)');
  // Runs until the process is killed.
  while (true) {
    const count = await catchUp(repos);
    if (count > 0) {
      console.log(`projected ${count} events`);
    }
    await sleep(1000);
  }
}

function fail(err: unknown): void {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--watch')) {
    runWatch().catch(fail);
  } else {
    runOnce().catch(fail);
  }
}

// Only run the CLI when this file is the program entry point, so
// importing catchUp for tests never connects to the database or starts
// the --watch loop.
if (require.main === module) {
  main();
}

export { catchUp };
