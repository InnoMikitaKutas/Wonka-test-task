# ADR 0002: Event contracts are additive-only

Status: accepted

## Context

Events live in the log forever. Consumers (projector, analytics, replay tooling) read events that were written months ago. Changing the shape or meaning of an already-released event type breaks replay of history, and history cannot be rewritten.

## Decision

- An existing event schema never changes shape or meaning after release.
- Evolution happens by adding a new event type, or by adding an optional field with a safe default.
- Renaming, removing, or retyping an existing field is forbidden.
- If a truly new shape is needed, publish a new versioned event type and keep reading the old one.

## Consequences

- Old logs replay unchanged; fixture files are never regenerated.
- The event registry in `packages/contracts` only grows.
- Consumers must tolerate events that carry only the old fields.
