import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { requireAuth, getAuthUser } from '@/lib/auth';

// jose is mocked globally in jest.setup.js — jwtVerify is a jest.fn
// that each test configures to simulate valid/invalid tokens.
const mockJwtVerify = jest.mocked(jwtVerify);

// Minimal request stub — requireAuth only reads request.cookies.get("token")
function requestWithToken(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === 'token' && token ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

describe('requireAuth / getAuthUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no token cookie is present', async () => {
    const auth = await requireAuth(requestWithToken());

    expect(auth.user).toBeNull();
    expect(auth.response).not.toBeNull();
    expect(auth.response!.status).toBe(401);
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  it('returns 401 when the token cannot be verified', async () => {
    mockJwtVerify.mockRejectedValue(new Error('invalid token'));

    const auth = await requireAuth(requestWithToken('bad.token'));

    expect(auth.user).toBeNull();
    expect(auth.response!.status).toBe(401);
  });

  it('returns the user for a valid token', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { userId: 'user-123' },
      protectedHeader: {},
    } as never);

    const auth = await requireAuth(requestWithToken('valid.token'));

    expect(auth.response).toBeNull();
    expect(auth.user?.userId).toBe('user-123');
  });

  it('returns 401 when the payload has no userId', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: 'no-user-id' },
      protectedHeader: {},
    } as never);

    const auth = await requireAuth(requestWithToken('valid.token'));

    expect(auth.user).toBeNull();
    expect(auth.response!.status).toBe(401);
  });

  it('getAuthUser returns null without a token', async () => {
    const user = await getAuthUser(requestWithToken());
    expect(user).toBeNull();
  });

  it('getAuthUser returns payload for a valid token', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { userId: 'user-456' },
      protectedHeader: {},
    } as never);

    const user = await getAuthUser(requestWithToken('valid.token'));

    expect(user?.userId).toBe('user-456');
  });
});
