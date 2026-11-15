import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import type { AuthResult } from '@/lib/auth';

// jose is mocked globally in jest.setup.js — jwtVerify is a jest.fn.
// IMPORTANT: @swc/jest does not hoist jest.mock, so mocked modules must be
// loaded via dynamic import() AFTER the jest.mock calls below have run.
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

let requireAdmin: (request: NextRequest) => Promise<AuthResult>;
let checkAdmin: (userId: string) => Promise<boolean>;
let findByIdMock: jest.Mock;

const mockJwtVerify = jest.mocked(jwtVerify);

// Request stub carrying a session cookie; jwtVerify decides validity.
const request = {
  cookies: {
    get: (name: string) => (name === 'token' ? { value: 'session-token' } : undefined),
  },
} as unknown as NextRequest;

beforeAll(async () => {
  const adminModule = await import('@/lib/admin');
  requireAdmin = adminModule.requireAdmin;
  checkAdmin = adminModule.checkAdmin;

  const userModule = await import('@/models/User');
  findByIdMock = (userModule.default as unknown as { findById: jest.Mock })
    .findById;
});

function validTokenFor(userId: string) {
  mockJwtVerify.mockResolvedValue({
    payload: { userId },
    protectedHeader: {},
  } as never);
}

function mockUserLookup(role: string | null) {
  findByIdMock.mockReturnValue({
    select: () => ({
      lean: async () => (role === null ? null : { role }),
    }),
  });
}

describe('requireAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the token is invalid', async () => {
    mockJwtVerify.mockRejectedValue(new Error('invalid token'));

    const result = await requireAdmin(request);

    expect(result.response?.status).toBe(401);
    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it('returns the user when the DB role is ADMIN', async () => {
    validTokenFor('admin-1');
    mockUserLookup('ADMIN');

    const result = await requireAdmin(request);

    expect(result.response).toBeNull();
    expect(result.user?.userId).toBe('admin-1');
  });

  it('returns 403 when the DB role is USER', async () => {
    validTokenFor('user-1');
    mockUserLookup('USER');

    const result = await requireAdmin(request);

    expect(result.user).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it('returns 403 when the user no longer exists', async () => {
    validTokenFor('ghost');
    mockUserLookup(null);

    const result = await requireAdmin(request);

    expect(result.response?.status).toBe(403);
  });

  it('fails closed (403) when the database check throws', async () => {
    validTokenFor('user-1');
    findByIdMock.mockImplementation(() => {
      throw new Error('db down');
    });

    const result = await requireAdmin(request);

    expect(result.response?.status).toBe(403);
  });
});

describe('checkAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true only for ADMIN role', async () => {
    mockUserLookup('ADMIN');
    expect(await checkAdmin('u1')).toBe(true);

    mockUserLookup('USER');
    expect(await checkAdmin('u1')).toBe(false);
  });
});
