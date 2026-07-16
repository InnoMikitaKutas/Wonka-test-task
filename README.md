# An AI-resistant take-home assignment for Node.js engineers

> The brief: "Design a test task for a Node.js developer that cannot be solved with AI. How will you verify it?"

The honest answer first: no self-contained coding task is impossible for modern AI tools. But a task can be designed so that careless AI use becomes visible and measurable.

## Position

I use AI coding tools every day, so I will not pretend that agents cannot implement a feature, an event-sourced aggregate, or a whole microservice. They can.

What agents still do badly, in a stable and measurable way:

- they lose track of small rules that are spread across a large codebase;
- they violate negative constraints ("do not touch X");
- they follow statistical habits: `Date.now()` in domain logic, `Promise.all` over ordered streams, editing a schema in place;
- they do not stop to ask a question when the spec contradicts itself.

These are exactly the skills that separate an engineer who owns a system from someone who forwards prompts. So this assessment is built as a detector, in three layers:

1. **The take-home** is a realistic monorepo with nine "landmines": real production rules that AI agents tend to break out of habit. Careless AI use leaves objective, machine-checkable traces.
2. **A hidden evaluator** scores the submission: functional acceptance, landmine detectors, and analysis of the diff and the git history. The candidate knows what the rules are, but not how they are measured. So the only way to pass is to actually follow them.
3. **A defense call** measures the one thing no agent can fake for the candidate: the mental model.

## How it works

- **The task:** implement interview slot reservations with auto-expiry in a small applicant tracking system (ATS). The system is an event-sourced monorepo: NestJS API, pure TypeScript domain engine, a projector, a replay CLI, and a FastAPI analytics service.
- **The landmines:** determinism, event immutability, per-aggregate ordering, race-safe writes under concurrency, legacy compatibility that looks wrong but is right, scope discipline, one planted spec contradiction, a half-finished decoy module, and cross-language contract drift. Each one is documented inside the repo, so the task stays fair.
- **The verification:** a private evaluator produces a structured scorecard. Every tripped landmine becomes an agenda item for the defense call, where the candidate can win points back by explaining what went wrong. A structured rubric instead of gut feeling.

## Repository map

```
.
├── README.md
├── docs/
│   ├── 01-assignment.md             <- the task
│   ├── 02-ai-resistance.md          <- the landmine list and why agents fail on it
│   ├── 03-evaluation.md             <- evaluator design, scoring rubric, defense call flow
│   └── 04-reference-walkthrough.md  <- how I would pass this take-home assignment, step by step
├── task/                            <- the monorepo the candidate works in
│   ├── packages/{contracts,engine,api,projector}   (TypeScript / Node)
│   ├── services/analytics                          (Python / FastAPI)
│   ├── tools/replay                                (TypeScript CLI)
│   ├── fixtures/events.jsonl                       (seeded, unique per candidate)
│   └── docs/{adr/, product-notes.md}
└── evaluator/                       <- hidden test suite, detectors, rubric, seed generator
```

## Example solution branches

Two example solutions live on their own branches, both starting from this commit on `main`:

- `solution/strong` - a clean solution that follows `docs/04-reference-walkthrough.md` and clears all nine landmines.
- `solution/weak` - a deliberately careless solution that trips several landmines, kept as a contrast for calibrating the evaluator.
