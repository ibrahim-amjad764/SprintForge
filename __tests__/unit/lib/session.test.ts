// __tests__/unit/lib/session.test.ts
//
// Unit tests for lib/session.ts — DB-backed session validation,
// tokenVersion revocation, and logout version bumping.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
}));

let validateSessionToken: typeof import('@/lib/session').validateSessionToken;
let requireSession: typeof import('@/lib/session').requireSession;
let assertTokenVersion: typeof import('@/lib/session').assertTokenVersion;
let bumpTokenVersion: typeof import('@/lib/session').bumpTokenVersion;
let extractTokenVersion: typeof import('@/lib/session').extractTokenVersion;
let createToken: typeof import('@/lib/auth').createToken;
let findByIdMock: jest.Mock;
let updateOneMock: jest.Mock;
let mockJwtVerify: jest.Mock;
let mockSignJWT: jest.Mock;

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

function tokenPayload(overrides: Record<string, unknown> = {}) {
  return { payload: { userId: 'user-1', tokenVersion: 0, ...overrides } };
}

function requestWithToken(token?: string, method = 'GET'): NextRequest {
  return {
    method,
    cookies: {
      get: (name: string) =>
        name === 'token' && token ? { value: token } : undefined,
    },
    headers: { get: () => null },
    nextUrl: { origin: 'http://localhost:3000', pathname: '/api/x' },
  } as unknown as NextRequest;
}

beforeAll(async () => {
  const sessionModule = await import('@/lib/session');
  validateSessionToken = sessionModule.validateSessionToken;
  requireSession = sessionModule.requireSession;
  assertTokenVersion = sessionModule.assertTokenVersion;
  bumpTokenVersion = sessionModule.bumpTokenVersion;
  extractTokenVersion = sessionModule.extractTokenVersion;

  const authModule = await import('@/lib/auth');
  createToken = authModule.createToken;

  const userModule = await import('@/models/User');
  const User = userModule.default as unknown as {
    findById: jest.Mock;
    updateOne: jest.Mock;
  };
  findByIdMock = User.findById;
  updateOneMock = User.updateOne;

  mockJwtVerify = jwtVerify as unknown as jest.Mock;
  mockSignJWT = SignJWT as unknown as jest.Mock;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockJwtVerify.mockResolvedValue(tokenPayload());
  findByIdMock.mockReturnValue(chain({ tokenVersion: 0, role: 'USER' }));
});

describe('createToken — tokenVersion claim', () => {
  it('embeds tokenVersion in the JWT payload', async () => {
    await createToken('user-1', 'USER', 3);
    expect(mockSignJWT).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', role: 'USER', tokenVersion: 3 }),
    );
  });

  it('omits tokenVersion when not provided (backward compatible)', async () => {
    await createToken('user-1');
    const payload = mockSignJWT.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.tokenVersion).toBeUndefined();
  });
});

describe('extractTokenVersion', () => {
  it('treats missing claim as version 0 (legacy tokens)', () => {
    expect(extractTokenVersion({})).toBe(0);
    expect(extractTokenVersion({ tokenVersion: null })).toBe(0);
    expect(extractTokenVersion({ tokenVersion: undefined })).toBe(0);
  });

  it('accepts non-negative integers', () => {
    expect(extractTokenVersion({ tokenVersion: 0 })).toBe(0);
    expect(extractTokenVersion({ tokenVersion: 7 })).toBe(7);
  });

  it('rejects malformed claims', () => {
    expect(extractTokenVersion({ tokenVersion: 'abc' })).toBeNull();
    expect(extractTokenVersion({ tokenVersion: -1 })).toBeNull();
    expect(extractTokenVersion({ tokenVersion: 1.5 })).toBeNull();
    expect(extractTokenVersion({ tokenVersion: NaN })).toBeNull();
    expect(extractTokenVersion({ tokenVersion: {} })).toBeNull();
  });
});

describe('validateSessionToken', () => {
  it('returns session user when versions match', async () => {
    const session = await validateSessionToken('tok');
    expect(session).toEqual({
      userId: 'user-1',
      role: 'USER',
      tokenVersion: 0,
    });
    expect(findByIdMock).toHaveBeenCalledWith('user-1');
  });

  it('returns fresh DB role, not the JWT role claim', async () => {
    mockJwtVerify.mockResolvedValue(
      tokenPayload({ role: 'ADMIN' }), // stale/forged claim
    );
    findByIdMock.mockReturnValue(chain({ tokenVersion: 0, role: 'USER' }));
    const session = await validateSessionToken('tok');
    expect(session?.role).toBe('USER');
  });

  it('rejects mismatched tokenVersion (revoked session)', async () => {
    findByIdMock.mockReturnValue(chain({ tokenVersion: 1, role: 'USER' }));
    expect(await validateSessionToken('tok')).toBeNull();
  });

  it('rejects when DB tokenVersion field is missing but claim is non-zero', async () => {
    mockJwtVerify.mockResolvedValue(tokenPayload({ tokenVersion: 2 }));
    findByIdMock.mockReturnValue(chain({ role: 'USER' })); // no field → 0
    expect(await validateSessionToken('tok')).toBeNull();
  });

  it('treats missing DB field as version 0 (legacy users)', async () => {
    findByIdMock.mockReturnValue(chain({ role: 'USER' }));
    expect(await validateSessionToken('tok')).not.toBeNull();
  });

  it('rejects when user does not exist', async () => {
    findByIdMock.mockReturnValue(chain(null));
    expect(await validateSessionToken('tok')).toBeNull();
  });

  it('rejects invalid/expired JWT', async () => {
    mockJwtVerify.mockRejectedValue(new Error('expired'));
    expect(await validateSessionToken('tok')).toBeNull();
    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it('rejects malformed tokenVersion claim', async () => {
    mockJwtVerify.mockResolvedValue(tokenPayload({ tokenVersion: 'x' }));
    expect(await validateSessionToken('tok')).toBeNull();
    expect(findByIdMock).not.toHaveBeenCalled();
  });
});

describe('requireSession', () => {
  it('returns 401 when no token cookie', async () => {
    const res = await requireSession(requestWithToken());
    expect(res.response?.status).toBe(401);
  });

  it('returns 401 for revoked session', async () => {
    findByIdMock.mockReturnValue(chain({ tokenVersion: 5, role: 'USER' }));
    const res = await requireSession(requestWithToken('tok'));
    expect(res.response?.status).toBe(401);
  });

  it('returns user for valid session', async () => {
    const res = await requireSession(requestWithToken('tok'));
    expect(res.response).toBeNull();
    expect(res.user?.userId).toBe('user-1');
  });

  it('preserves CSRF check on mutations', async () => {
    const req = {
      ...requestWithToken('tok', 'POST'),
      headers: { get: (h: string) => (h === 'origin' ? 'https://evil.com' : null) },
    } as unknown as NextRequest;
    const res = await requireSession(req);
    expect(res.response?.status).toBe(403);
  });
});

describe('assertTokenVersion (Socket.IO)', () => {
  it('returns true when versions match', async () => {
    expect(await assertTokenVersion('user-1', 0)).toBe(true);
  });

  it('returns false on mismatch or missing user', async () => {
    findByIdMock.mockReturnValue(chain({ tokenVersion: 9 }));
    expect(await assertTokenVersion('user-1', 0)).toBe(false);
    findByIdMock.mockReturnValue(chain(null));
    expect(await assertTokenVersion('user-1', 0)).toBe(false);
  });
});

describe('bumpTokenVersion', () => {
  it('atomically increments tokenVersion', async () => {
    await bumpTokenVersion('user-1');
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'user-1' },
      { $inc: { tokenVersion: 1 } },
    );
  });
});
