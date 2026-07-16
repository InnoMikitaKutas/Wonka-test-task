// Thrown when an append loses the optimistic-concurrency race: another
// writer already took the expected stream_version, or the event_id was
// already used. Both cases surface as a Postgres unique violation
// (code 23505) on the events table.
export class OptimisticConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticConcurrencyError';
  }
}
