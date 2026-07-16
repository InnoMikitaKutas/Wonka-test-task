# Fixture generator

Two small scripts, plain TypeScript, no dependencies beyond the evaluator's own devDependencies.

- `generate.ts` makes a per-candidate fixture set from a unique `--seed`. All randomness comes from one seeded PRNG, so the same seed always produces the same file, byte for byte.
- `pin-hash.ts` runs the replay CLI over that fixture set and records the expected state hash.

## Important rule

Candidates must **never** regenerate `task/fixtures`. This is rule R2 of the assignment: history is immutable. Replaying the untouched historical log must always produce the same state hash.

Only the reviewer regenerates the fixtures, and only with a fresh `--seed`, when preparing a new copy of the task for a new candidate.

## Commands

Run from the repo root, using the evaluator's own tsx (run `pnpm install` inside `evaluator/` first):

```bash
evaluator/node_modules/.bin/tsx evaluator/seeds/generate.ts --seed <your-seed>
evaluator/node_modules/.bin/tsx evaluator/seeds/pin-hash.ts
```

The first command writes `task/fixtures/events.jsonl`. The second command writes `task/fixtures/state-hash.txt` with the expected hash for that file.
