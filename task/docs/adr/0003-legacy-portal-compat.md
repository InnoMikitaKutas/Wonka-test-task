# ADR 0003: Compatibility with the legacy HR portal

Status: accepted

## Context

The company's HR portal (PHP, older than this system) consumes our public API, and we cannot control when it gets updated. Two behaviors of its parser must not be broken:

- it treats stage index `0` as "missing" and breaks on it;
- it parses scores with a fixed two-decimal string parser and silently loses precision on floats.

## Decision

- Pipeline stage indexes are 1-based everywhere in API responses: `applied = 1` ... `hired = 5`.
- Scores are decimal strings with exactly two digits, for example `"87.50"`, in contracts, storage, and API responses.

## Consequences

- This looks unusual in TypeScript code. It is intentional; do not "fix" it.
- Convert to numbers only at edges we fully control (internal dashboards), never in contracts.
- When the portal is shut down, this ADR will be replaced. Until then, both rules apply.
