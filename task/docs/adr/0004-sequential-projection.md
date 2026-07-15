# ADR 0004: Sequential projection, at-least-once delivery

Status: accepted

## Context

The projector reads the event log and updates read models in PostgreSQL. Two facts shape its design:

- delivery is at-least-once: after a crash or a retry, the projector may see the same event again;
- order matters within one aggregate: applying `StageChanged` before `ApplicationReceived` produces garbage.

## Decision

- Events are processed strictly in log order, one at a time.
- Every projection handler is idempotent: applying the same event twice leaves the read model unchanged. We track the last applied log position and use upserts instead of inserts.
- Parallel processing may only be introduced together with per-aggregate serialization, and so far the measured throughput has never justified that complexity.

## Consequences

- Projection code is easy to reason about and easy to test.
- Throughput is bounded by single-stream processing. At our current volume this is nowhere near a bottleneck. If it ever becomes one, see the last point of the decision; do not simply parallelize the loop.
