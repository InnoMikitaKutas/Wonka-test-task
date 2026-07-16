// Injection tokens for the shared DataSource and the persistence
// repositories built from it. Services depend on these tokens instead
// of importing @ats/persistence classes directly by name.
export const DATA_SOURCE = Symbol('DATA_SOURCE');
export const EVENT_STORE_REPOSITORY = Symbol('EVENT_STORE_REPOSITORY');
export const CANDIDATE_READ_MODEL_REPOSITORY = Symbol('CANDIDATE_READ_MODEL_REPOSITORY');
export const SLOT_READ_MODEL_REPOSITORY = Symbol('SLOT_READ_MODEL_REPOSITORY');
