// __tests__/unit/lib/error-handler.test.ts
//
// Phase 10: apiError must log server-side, return a 500 Response with
// the { success:false, message } contract, and never leak error.message.
//
// NOTE: @swc/jest does not hoist jest.mock — modules are loaded via
// dynamic import() in beforeAll, after the mocks below have run.

import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

type ErrorHandler = typeof import('@/utils/error-handler');

let apiError: ErrorHandler['apiError'];
let mockLoggerError: jest.Mock;

beforeAll(async () => {
  const handler = await import('@/utils/error-handler');
  apiError = handler.apiError;
  const loggerModule = await import('@/lib/logger');
  mockLoggerError = loggerModule.default.error as jest.Mock;
});

beforeEach(() => jest.clearAllMocks());

describe('apiError', () => {
  it('returns a 500 response with the success:false contract', async () => {
    const res = apiError(new Error('db exploded'), 'Search failed');
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ success: false, message: 'Search failed' });
  });

  it('logs the underlying error server-side', () => {
    const err = new Error('secret internals');
    apiError(err, 'Server error');
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err },
      'API request failed'
    );
  });

  it('does not leak error.message to the client', async () => {
    const res = apiError(new Error('mongodb://user:pass@host'), 'Server error');
    const json = await res.json();
    expect(json.message).toBe('Server error');
    expect(JSON.stringify(json)).not.toContain('mongodb');
  });

  it('defaults to a generic message', async () => {
    const res = apiError(new Error('x'));
    const json = await res.json();
    expect(json.message).toBe('Server error');
  });
});
