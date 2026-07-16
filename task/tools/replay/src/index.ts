import fs from 'node:fs';
import { Command } from 'commander';
import { parseEventLine } from '@ats/contracts';
import { initialState, reduce, stateHash } from '@ats/engine';

// Replays an event log file through the engine and returns its state hash.
// This is the whole measuring instrument: read lines, parse each one,
// fold it into state, hash the result. No clock, no randomness, no
// hidden state. See docs/adr/0001.
export function runReplay(filePath: string): string {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);

  let state = initialState();
  for (const line of lines) {
    const event = parseEventLine(line);
    state = reduce(state, event);
  }

  return `sha256:${stateHash(state)}`;
}

function runCli(): void {
  // `pnpm replay -- --file x` forwards a literal "--" before our flags.
  // Commander reads a bare "--" as "end of options", so drop one if the
  // caller's args start with it.
  const argv = process.argv.slice();
  if (argv[2] === '--') {
    argv.splice(2, 1);
  }

  const program = new Command();
  program
    .requiredOption('--file <path>', 'path to an event log file (JSONL)')
    .parse(argv);

  const opts = program.opts() as { file: string };

  try {
    const hash = runReplay(opts.file);
    process.stdout.write(`state=${hash}\n`);
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`replay failed: ${message}\n`);
    process.exit(1);
  }
}

// Only run the CLI when this file is the program entry point. This keeps
// tests safe: importing runReplay must never trigger process.exit.
if (require.main === module) {
  runCli();
}
