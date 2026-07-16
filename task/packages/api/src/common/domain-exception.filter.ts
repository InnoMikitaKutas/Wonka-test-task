import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { DomainError, type DomainErrorCode } from '@ats/engine';
import { OptimisticConcurrencyError } from '@ats/persistence';

// Minimal shape we need from the http response. Avoids a hard
// dependency on @types/express just for a type annotation.
interface HttpResponse {
  status(code: number): { json(body: unknown): void };
}

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  GONE: 410,
};

// Maps engine and persistence errors to HTTP responses. This is the one
// place that translates a DomainError code, or a persistence-level
// OptimisticConcurrencyError, into a status code, so every route stays
// consistent. Anything else falls through to a 500.
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();

    if (exception instanceof DomainError) {
      const status = STATUS_BY_CODE[exception.code] ?? 500;
      response.status(status).json({
        error: exception.code.toLowerCase(),
        message: exception.message,
      });
      return;
    }

    if (exception instanceof OptimisticConcurrencyError) {
      response.status(409).json({ error: 'conflict', reason: 'version_conflict' });
      return;
    }

    // Nest's own errors (an unmatched route, a failed validation pipe)
    // already carry the right status. Pass them through instead of
    // turning them into a 500.
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response
        .status(exception.getStatus())
        .json(typeof body === 'string' ? { error: 'http_error', message: body } : body);
      return;
    }

    if (exception instanceof Error) {
      response.status(500).json({ error: exception.name, message: exception.message });
      return;
    }

    response.status(500).json({ error: 'internal_error', message: 'unknown error' });
  }
}
