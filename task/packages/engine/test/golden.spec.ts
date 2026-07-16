import fs from 'node:fs';
import path from 'node:path';
import { parseEventLine } from '@ats/contracts';
import { initialState, reduce, stateHash } from '../src';

// Resolves to task/fixtures from this test file's location.
const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'fixtures');
const eventsPath = path.join(fixturesDir, 'events.jsonl');
const hashPath = path.join(fixturesDir, 'state-hash.txt');

describe('golden replay', () => {
  it('replaying fixtures/events.jsonl matches the pinned state hash', () => {
    if (!fs.existsSync(eventsPath) || !fs.existsSync(hashPath)) {
      throw new Error(
        'Missing fixtures/events.jsonl or fixtures/state-hash.txt. These ship ' +
          'with the repo; this checkout looks incomplete.',
      );
    }

    const raw = fs.readFileSync(eventsPath, 'utf8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);

    let state = initialState();
    for (const line of lines) {
      const event = parseEventLine(line);
      state = reduce(state, event);
    }

    const actual = `sha256:${stateHash(state)}`;
    const expected = fs.readFileSync(hashPath, 'utf8').trim();
    expect(actual).toBe(expected);
  });
});
