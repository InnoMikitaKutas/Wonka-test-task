#!/usr/bin/env -S npx tsx
// Runs the replay CLI over the generated fixture and pins the resulting
// state hash to task/fixtures/state-hash.txt. This is the expected
// value the golden test in packages/engine compares against.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TASK_DIR = path.join(REPO_ROOT, 'task');

interface ExecError {
  stdout?: unknown;
  stderr?: unknown;
  message?: unknown;
}

function main(): void {
  let stdout: string;
  try {
    stdout = execSync('pnpm replay -- --file fixtures/events.jsonl', {
      cwd: TASK_DIR,
      encoding: 'utf8',
    });
  } catch (err) {
    const shape = (typeof err === 'object' && err !== null ? err : {}) as ExecError;
    console.error('pin-hash: pnpm replay failed to run.');
    console.error(typeof shape.stdout === 'string' ? shape.stdout : '');
    console.error(typeof shape.stderr === 'string' ? shape.stderr : String(shape.message ?? err));
    process.exit(1);
  }

  const match = stdout.match(/state=(sha256:[0-9a-f]{64})/);
  if (!match) {
    console.error('pin-hash: could not find a "state=sha256:<hex>" line in replay output.');
    console.error('Replay output was:');
    console.error(stdout);
    process.exit(1);
  }

  const hash = match[1];
  const hashPath = path.join(TASK_DIR, 'fixtures', 'state-hash.txt');
  fs.mkdirSync(path.dirname(hashPath), { recursive: true });
  fs.writeFileSync(hashPath, `${hash}\n`, 'utf8');

  console.log(hash);
}

main();
