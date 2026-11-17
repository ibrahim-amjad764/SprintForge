import { NextRequest } from 'next/server';

const mockCaptureException = jest.fn();
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const mockChildError = jest.fn();
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({ error: mockChildError })),
  },
}));

import {
  REQUEST_ID_HEADER,
  getRequestId,
  getRequestLogger,
  serverError,
} from '@/lib/request-context';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('getRequestId', () => {
  it('returns the server-generated request id from headers', () => {
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-123' });
    expect(getRequestId(req)).toBe('req-123');
  });

  it("returns 'unknown' when the header is absent", () => {
    expect(getRequestId(makeRequest())).toBe('unknown');
  });
});

describe('getRequestLogger', () => {
  it('returns a child logger bound to the request id', () => {
    const logger = jest.requireMock('@/lib/logger').default;
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-abc' });
    getRequestLogger(req);
    expect(logger.child).toHaveBeenCalledWith({ reqId: 'req-abc' });
  });
});

describe('serverError', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a 500 JSON response preserving the error contract plus requestId', async () => {
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-500' });
    const res = serverError(req, new Error('db exploded'), 'Create failed');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Create failed');
    expect(body.requestId).toBe('req-500');
  });

  it('logs the error with the request-scoped logger', () => {
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-501' });
    const err = new Error('boom');
    serverError(req, err);
    expect(mockChildError).toHaveBeenCalledWith(
      { err },
      'Internal server error'
    );
  });

  it('reports the exception to Sentry with the request id', () => {
    const req = makeRequest({ [REQUEST_ID_HEADER]: 'req-502' });
    const err = new Error('sentry me');
    serverError(req, err);
    expect(mockCaptureException).toHaveBeenCalledWith(err, {
      extra: { reqId: 'req-502' },
    });
  });
});
