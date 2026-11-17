// __tests__/integration/api/auth/logout.test.ts
//
// Logout semantics: global session invalidation via atomic
// tokenVersion increment + unconditional cookie clearing.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
  buildAuthCookie: jest.fn(
    (token: string, maxAge: number) =>
      `token=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`,
  ),
}));

jest.mock('@/lib/session', () => ({
  bumpTokenVersion: jest.fn(async () => {}),
}));

const mockUserFindById = jest.fn();
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

let logoutPOST: typeof import('@/app/api/auth/logout/route').POST;
let mockVerifyToken: jest.Mock;
let mockBumpTokenVersion: jest.Mock;

function reqWithToken(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === 'token' && token ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

function chain(result: unknown) {
  return { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(result) };
}

beforeAll(async () => {
  logoutPOST = (await import('@/app/api/auth/logout/route')).POST;
  mockVerifyToken = (await import('@/lib/auth')).verifyToken as jest.Mock;
  mockBumpTokenVersion = (await import('@/lib/session')).bumpTokenVersion as jest.Mock;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ userId: 'user-1' });
  mockUserFindById.mockReturnValue(chain({ _id: 'user-1' }));
});

describe('POST /api/auth/logout', () => {
  it('increments tokenVersion for a verified token of an existing user', async () => {
    const res = await logoutPOST(reqWithToken('valid'));
    expect(res.status).toBe(200);
    expect(mockBumpTokenVersion).toHaveBeenCalledWith('user-1');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('does not increment for an invalid/expired token but still clears cookie', async () => {
    mockVerifyToken.mockRejectedValue(new Error('expired'));
    const res = await logoutPOST(reqWithToken('stale'));
    expect(res.status).toBe(200);
    expect(mockBumpTokenVersion).not.toHaveBeenCalled();
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('does not increment when the user no longer exists', async () => {
    mockUserFindById.mockReturnValue(chain(null));
    const res = await logoutPOST(reqWithToken('valid'));
    expect(res.status).toBe(200);
    expect(mockBumpTokenVersion).not.toHaveBeenCalled();
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('clears cookie even with no token present', async () => {
    const res = await logoutPOST(reqWithToken());
    expect(res.status).toBe(200);
    expect(mockBumpTokenVersion).not.toHaveBeenCalled();
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
