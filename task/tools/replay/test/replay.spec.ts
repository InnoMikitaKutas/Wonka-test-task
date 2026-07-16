import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EventEnvelope } from '@ats/contracts';
import { initialState, reduce, stateHash } from '@ats/engine';
import { runReplay } from '../src/index';

// Three hand-crafted events, fixed ids and fixed timestamps only.
const EVENTS: EventEnvelope[] = [
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
    type: 'ApplicationReceived',
    stream: 'candidate-c1',
    streamVersion: 1,
    schemaVersion: 1,
    occurredAt: '2024-01-08T09:00:00.000Z',
    payload: { candidateId: 'c1', name: 'Ada Lovelace', position: 'Engineer', source: 'referral' },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad3',
    type: 'StageChanged',
    stream: 'candidate-c1',
    streamVersion: 2,
    schemaVersion: 1,
    occurredAt: '2024-01-08T10:00:00.000Z',
    payload: { candidateId: 'c1', fromStage: 1, toStage: 2 },
  },
  {
    eventId: '7d444840-9dc0-11d1-b245-5ffdce74fad4',
    type: 'ScoreAssigned',
    stream: 'candidate-c1',
    streamVersion: 3,
    schemaVersion: 1,
    occurredAt: '2024-01-08T11:00:00.000Z',
    payload: { candidateId: 'c1', score: '91.25', assessor: 'bob' },
  },
];

function expectedHash(): string {
  let state = initialState();
  for (const event of EVENTS) {
    state = reduce(state, event);
  }
  return `sha256:${stateHash(state)}`;
}

describe('runReplay', () => {
  it('replays a file of events and matches a hash computed directly via the engine', () => {
    const tmpFile = path.join(os.tmpdir(), `replay-test-${process.pid}.jsonl`);
    const content = EVENTS.map((event) => JSON.stringify(event)).join('\n') + '\n';
    fs.writeFileSync(tmpFile, content, 'utf8');

    try {
      const result = runReplay(tmpFile);
      expect(result).toBe(expectedHash());
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('is deterministic: replaying the same file twice gives the identical string', () => {
    const tmpFile = path.join(os.tmpdir(), `replay-test-repeat-${process.pid}.jsonl`);
    const content = EVENTS.map((event) => JSON.stringify(event)).join('\n') + '\n';
    fs.writeFileSync(tmpFile, content, 'utf8');

    try {
      const first = runReplay(tmpFile);
      const second = runReplay(tmpFile);
      expect(first).toBe(second);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
