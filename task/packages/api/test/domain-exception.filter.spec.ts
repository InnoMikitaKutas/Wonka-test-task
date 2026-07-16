import { NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { DomainError, type DomainErrorCode } from '@ats/engine';
import { OptimisticConcurrencyError } from '@ats/persistence';
import { DomainExceptionFilter } from '../src/common/domain-exception.filter';

// Fake response object that supports the same chain the filter uses:
// response.status(code).json(body). Both calls are captured for
// assertions and status() returns the same object so the chain works.
function fakeResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function fakeHost(res: ReturnType<typeof fakeResponse>): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  const cases: Array<[DomainErrorCode, number]> = [
    ['NOT_FOUND', 404],
    ['VALIDATION', 422],
    ['CONFLICT', 409],
    ['GONE', 410],
  ];

  it.each(cases)('maps DomainError code %s to status %d', (code, expectedStatus) => {
    const res = fakeResponse();
    filter.catch(new DomainError(code, 'boom'), fakeHost(res));

    expect(res.status).toHaveBeenCalledWith(expectedStatus);
    expect(res.json).toHaveBeenCalledWith({ error: code.toLowerCase(), message: 'boom' });
  });

  it('maps OptimisticConcurrencyError to 409', () => {
    const res = fakeResponse();
    filter.catch(new OptimisticConcurrencyError('lost the race'), fakeHost(res));

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'conflict',
      reason: 'version_conflict',
    });
  });

  it('passes a Nest HttpException through with its own status', () => {
    const res = fakeResponse();
    // This is what an unmatched route produces. It must stay a 404, not
    // become a 500.
    filter.catch(new NotFoundException('Cannot POST /x/y'), fakeHost(res));

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('maps unknown errors to 500', () => {
    const res = fakeResponse();
    filter.catch(new Error('nope'), fakeHost(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error', message: 'nope' });
  });
});
