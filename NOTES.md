# Implementation notes

## Reservation policy

The assignment says reservations expire after 24 hours, while the product notes
and abandoned `legacy/holds.ts` draft say 12 hours. I treated the candidate-side
acceptance criteria and fixed HTTP contract as authoritative and implemented 24
hours. This should be confirmed with product before production rollout.

I did not extend `legacy/holds.ts`: it reads wall-clock time inside the helper and
would conflict with ADR 0001. Reservation expiry is instead decided from command
envelope timestamps and materialized as events.

## Design

- `ReservationPlaced`, `ReservationConfirmed`, and `ReservationExpired` are
  additive event types; v1 schemas and fixture history remain untouched.
- Reservation state is folded by the pure engine. Sweep is an explicit command.
- A `reservations_rm` projection is added with a separate migration.
- No runtime dependencies were added.

## Known limitations

The API currently rebuilds the reservation decision state from the complete event
log. That is intentionally simple for this task but should become a targeted
aggregate load before event volume grows.
