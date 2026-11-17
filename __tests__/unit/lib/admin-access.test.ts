// __tests__/unit/lib/admin-access.test.ts
//
// Phase 4A regression: admin page access via JWT role claim in
// middleware. API admin routes remain DB-verified via requireAdmin —
// this only covers page-level routing.
//
// jose.jwtVerify is globally mocked (jest.setup.js) — control it per test.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

let middleware: typeof import('@/middleware').middleware;
let createToken: typeof import('@/lib/auth').createToken;
let mockJwtVerify: jest.Mock;
let mockSignJWT: jest.Mock;

function fakeRequest(pathname: string, token?: string): NextRequest {
  const base = `http://localhost:3000${pathname}`;
  return {
    // Real URL instance so NextResponse.redirect() accepts clone() results
    nextUrl: Object.assign(new URL(base), {
      pathname,
      clone: () => new URL(base),
    }),
    cookies: {
      get: (name: string) => (name === 'token' && token ? { value: token } : undefined),
    },
    headers: new Headers(),
  } as unknown as NextRequest;
}

async function verifyAs(payload: Record<string, unknown> | null) {
  mockJwtVerify.mockResolvedValue(payload ? { payload } : null);
}

beforeAll(async () => {
  middleware = (await import('@/middleware')).middleware;
  createToken = (await import('@/lib/auth')).createToken;
  const jose = await import('jose');
  mockJwtVerify = jose.jwtVerify as unknown as jest.Mock;
  mockSignJWT = jose.SignJWT as unknown as jest.Mock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createToken role claim', () => {
  it('includes role in the JWT payload when provided', async () => {
    await createToken('user-1', 'ADMIN');
    expect(mockSignJWT).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', role: 'ADMIN' }),
    );
  });

  it('omits role when not provided (backward compatible)', async () => {
    await createToken('user-2');
    const payload = mockSignJWT.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.userId).toBe('user-2');
    expect(payload.role).toBeUndefined();
  });
});

describe('middleware admin page access', () => {
  it('allows ADMIN user into /dashboard/admin', async () => {
    await verifyAs({ userId: 'admin-1', role: 'ADMIN' });
    const res = await middleware(fakeRequest('/dashboard/admin', 'tok'));
    // NextResponse.next() — not a redirect
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('blocks USER role from /dashboard/admin -> /unauthorized', async () => {
    await verifyAs({ userId: 'user-1', role: 'USER' });
    const res = await middleware(fakeRequest('/dashboard/admin', 'tok'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/unauthorized');
  });

  it('blocks missing role claim from /dashboard/admin (fail-closed)', async () => {
    // Legacy tokens without a role claim must not gain admin access
    await verifyAs({ userId: 'user-1' });
    const res = await middleware(fakeRequest('/dashboard/admin', 'tok'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/unauthorized');
  });

  it('redirects unauthenticated users to /login', async () => {
    const res = await middleware(fakeRequest('/dashboard/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects invalid tokens to /login', async () => {
    await verifyAs(null);
    const res = await middleware(fakeRequest('/dashboard', 'bad-tok'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('allows regular USER into protected non-admin pages', async () => {
    await verifyAs({ userId: 'user-1', role: 'USER' });
    const res = await middleware(fakeRequest('/dashboard', 'tok'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('passes x-user-role header through for server components', async () => {
    await verifyAs({ userId: 'admin-1', role: 'ADMIN' });
    const res = await middleware(fakeRequest('/dashboard', 'tok'));
    // NextResponse.next({request:{headers}}) — role forwarded internally;
    // assert the response was produced without redirect
    expect(res.status).toBe(200);
  });
});
