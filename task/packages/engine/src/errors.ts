export type DomainErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION' | 'GONE';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
