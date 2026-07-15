# ADR 0001: Time enters the system only through envelopes

Status: accepted

## Context

The event log is our source of truth. We rebuild read models from it, we debug incidents by replaying it, and we validate every projection change by comparing replayed state. All of that works only if replay is deterministic: the same log must produce the same state, byte for byte, on every run and on every machine.

## Decision

- Code in `engine` and `projector` never reads the wall clock, never uses randomness, and never does I/O.
- Every command envelope gets its `occurredAt` timestamp once, at the API edge, when the command is accepted.
- Events inherit time from the command that produced them.
- Time-dependent state (deadlines, expiry) is derived by comparing envelope timestamps, never by asking "what time is it now" inside domain logic.
- Behavior that must happen "when time passes" is triggered by an explicit command (for example, a scheduled sweep), whose envelope carries the clock.

## Consequences

- Replaying the same log always produces the same state hash. `tools/replay` relies on this.
- Tests can time-travel by crafting envelopes; no clock mocking is needed in the engine.
- Anything that needs the current time lives at the edges (API, schedulers), never in domain logic.
