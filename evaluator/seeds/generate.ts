#!/usr/bin/env -S npx tsx
// Fixture generator for the ATS event log. See README.md in this
// folder.
//
// It simulates a realistic hiring timeline: candidates apply, move
// through pipeline stages, get scored, and sometimes get an offer.
// Interviewers open slots and some slots get a scheduled candidate.
// All randomness comes from one seeded PRNG, so the same --seed always
// produces the same file, byte for byte.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

interface GenerateArgs {
  seed: string;
  candidates: number;
  slots: number;
  out: string;
}

function parseArgs(argv: string[]): GenerateArgs {
  const args: GenerateArgs = {
    seed: 'wonka-demo-001',
    candidates: 2100,
    slots: 950,
    out: path.resolve(REPO_ROOT, 'task', 'fixtures'),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--seed') args.seed = argv[++i];
    else if (arg === '--candidates') args.candidates = Number(argv[++i]);
    else if (arg === '--slots') args.slots = Number(argv[++i]);
    else if (arg === '--out') args.out = path.resolve(argv[++i]);
  }
  return args;
}

// --- PRNG: fnv1a turns the seed string into a 32-bit int. mulberry32
// is the one and only generator used for every random choice below.
// No Math.random anywhere in this file. ---
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function hexDigits(rng: Rng, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

// Builds a uuid-like string (8-4-4-4-12) from PRNG bytes. The version
// nibble is fixed to "4" and the variant nibble to one of 8/9/a/b, so
// the result always passes zod's z.string().uuid().
function makeUuid(rng: Rng): string {
  const g1 = hexDigits(rng, 8);
  const g2 = hexDigits(rng, 4);
  const g3 = `4${hexDigits(rng, 3)}`;
  const g4 = `${pick(rng, ['8', '9', 'a', 'b'])}${hexDigits(rng, 3)}`;
  const g5 = hexDigits(rng, 12);
  return `${g1}-${g2}-${g3}-${g4}-${g5}`;
}

// --- small fixed vocab used to fill in payload fields ---
const FIRST_NAMES = [
  'Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Donald',
  'Katherine', 'Guido', 'Yukihiro', 'Anders', 'James', 'Brian', 'Radia',
];
const LAST_NAMES = [
  'Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov',
  'Knuth', 'Johnson', 'vanRossum', 'Matsumoto', 'Hejlsberg', 'Gosling',
  'Kernighan', 'Perlman',
];
const POSITIONS = [
  'Backend Engineer', 'Frontend Engineer', 'Data Analyst', 'Product Manager',
  'DevOps Engineer', 'QA Engineer', 'Product Designer', 'Recruiter',
  'Sales Engineer', 'Support Engineer',
];
const SOURCES = ['referral', 'careers-page', 'linkedin', 'agency', 'job-board', 'conference'];
const ASSESSORS = ['alice', 'bob', 'carol', 'dave', 'erin'];
const OFFER_NOTES = [
  'salary agreed', 'signing bonus approved', 'remote work approved',
  'start date confirmed', 'relocation package agreed',
];
const INTERVIEWERS = ['carol', 'dave', 'frank', 'grace', 'heidi', 'ivan'];

// Chance of advancing to the next stage, keyed by the current stage.
// This decreases as the stage rises, so the funnel narrows like a real
// hiring pipeline: most applicants pass screening, fewer reach an offer.
const ADVANCE_PROB: Record<number, number> = { 1: 0.9, 2: 0.75, 3: 0.6, 4: 0.45 };

interface Candidate {
  id: string;
  name: string;
  position: string;
  source: string;
  stage: number;
}

interface Slot {
  id: string;
  interviewer: string;
}

type Token =
  | { kind: 'submit'; id: string }
  | { kind: 'advance'; id: string }
  | { kind: 'score'; id: string }
  | { kind: 'offer'; id: string }
  | { kind: 'open'; id: string }
  | { kind: 'schedule'; id: string };

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(fnv1a(args.seed));

  // One global clock, advanced before every event. Never read from the
  // real wall clock during the simulation itself.
  let clock = Date.parse('2024-01-08T09:00:00.000Z');

  const streamVersions = new Map<string, number>();
  function nextVersion(stream: string): number {
    const v = (streamVersions.get(stream) ?? 0) + 1;
    streamVersions.set(stream, v);
    return v;
  }

  const lines: string[] = [];
  function emit(type: string, stream: string, payload: Record<string, unknown>): void {
    clock += randInt(rng, 30, 1800) * 1000;
    const occurredAt = new Date(clock).toISOString();
    const event = {
      eventId: makeUuid(rng),
      type,
      stream,
      streamVersion: nextVersion(stream),
      schemaVersion: 1,
      occurredAt,
      payload,
    };
    lines.push(JSON.stringify(event));
  }

  const candidates: Candidate[] = [];
  for (let i = 0; i < args.candidates; i++) {
    candidates.push({
      id: `c${String(i + 1).padStart(5, '0')}`,
      name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
      position: pick(rng, POSITIONS),
      source: pick(rng, SOURCES),
      stage: 0,
    });
  }
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  function mustGetCandidate(id: string): Candidate {
    const c = candidateById.get(id);
    if (!c) throw new Error(`invariant violated: no candidate ${id}`);
    return c;
  }

  const slots: Slot[] = [];
  for (let i = 0; i < args.slots; i++) {
    slots.push({ id: `s${String(i + 1).padStart(5, '0')}`, interviewer: pick(rng, INTERVIEWERS) });
  }
  const slotById = new Map(slots.map((s) => [s.id, s]));

  function mustGetSlot(id: string): Slot {
    const s = slotById.get(id);
    if (!s) throw new Error(`invariant violated: no slot ${id}`);
    return s;
  }

  // A pool of pending actions. Each round picks one at random, so
  // candidates and slots interleave instead of being processed in
  // grouped blocks. Every token is either resolved (event or a
  // permanent no-op) or, for a slot waiting on an eligible candidate,
  // put back to be retried later.
  const pool: Token[] = [];
  for (const c of candidates) pool.push({ kind: 'submit', id: c.id });
  for (const s of slots) pool.push({ kind: 'open', id: s.id });

  let stall = 0;
  const STALL_CAP = 200000;
  const ROUND_CAP = 5000000;
  let rounds = 0;

  while (pool.length > 0 && rounds < ROUND_CAP && stall < STALL_CAP) {
    rounds++;
    const idx = Math.floor(rng() * pool.length);
    const token = pool[idx];
    pool[idx] = pool[pool.length - 1];
    pool.pop();

    let progressed = true;

    switch (token.kind) {
      case 'submit': {
        const c = mustGetCandidate(token.id);
        emit('ApplicationReceived', `candidate-${c.id}`, {
          candidateId: c.id, name: c.name, position: c.position, source: c.source,
        });
        c.stage = 1;
        pool.push({ kind: 'advance', id: c.id });
        break;
      }
      case 'advance': {
        const c = mustGetCandidate(token.id);
        if (rng() < ADVANCE_PROB[c.stage]) {
          const fromStage = c.stage;
          const toStage = c.stage + 1;
          emit('StageChanged', `candidate-${c.id}`, { candidateId: c.id, fromStage, toStage });
          c.stage = toStage;
          if (c.stage === 2) pool.push({ kind: 'score', id: c.id });
          if (c.stage === 4) pool.push({ kind: 'offer', id: c.id });
          if (c.stage < 5) pool.push({ kind: 'advance', id: c.id });
        }
        break;
      }
      case 'score': {
        const c = mustGetCandidate(token.id);
        if (rng() < 0.6) {
          const score = (randInt(rng, 4000, 9999) / 100).toFixed(2);
          emit('ScoreAssigned', `candidate-${c.id}`, {
            candidateId: c.id, score, assessor: pick(rng, ASSESSORS),
          });
        }
        break;
      }
      case 'offer': {
        const c = mustGetCandidate(token.id);
        if (rng() < 0.7) {
          emit('OfferExtended', `candidate-${c.id}`, { candidateId: c.id, note: pick(rng, OFFER_NOTES) });
        }
        break;
      }
      case 'open': {
        const s = mustGetSlot(token.id);
        const startsAt = new Date(clock + randInt(rng, 3, 10) * 86400000).toISOString();
        emit('SlotOpened', `slot-${s.id}`, { slotId: s.id, interviewer: s.interviewer, startsAt });
        if (rng() < 0.55) pool.push({ kind: 'schedule', id: s.id });
        break;
      }
      case 'schedule': {
        const s = mustGetSlot(token.id);
        const eligible = candidates.filter((c) => c.stage >= 3);
        if (eligible.length === 0) {
          // No candidate has reached the interview stage yet. Try
          // again in a later round instead of giving up.
          pool.push(token);
          progressed = false;
        } else {
          const c = pick(rng, eligible);
          emit('InterviewScheduled', `slot-${s.id}`, { slotId: s.id, candidateId: c.id });
        }
        break;
      }
      default:
        break;
    }

    stall = progressed ? 0 : stall + 1;
  }

  fs.mkdirSync(args.out, { recursive: true });
  const outFile = path.join(args.out, 'events.jsonl');
  fs.writeFileSync(outFile, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Generated ${lines.length} events into ${outFile}`);
}

main();
