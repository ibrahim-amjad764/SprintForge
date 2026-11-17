// __tests__/integration/api/ratelimit.test.ts
//
// Per-user rate limiting on cost/scan-heavy endpoints (5D-1):
// AI completions (20/hr), global search (60/min), admin GETs (120/min).
// The real lib/rate-limit bucket map is exercised — unique userIds
// per suite avoid cross-test interference.

import type { NextRequest } from 'next/server';
import type { AuthResult } from '@/lib/auth';

jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
  validateSessionToken: jest.fn(),
}));

jest.mock('@/lib/admin', () => ({
  requireAdmin: jest.fn(),
  checkAdmin: jest.fn(),
}));

jest.mock('@/lib/db', () => ({ connectDB: jest.fn(async () => {}) }));

jest.mock('@/lib/authorization', () => ({
  getMembershipForProject: jest.fn(async () => ({ workspaceId: 'ws-1', role: 'EDITOR' })),
}));

jest.mock('@/services/ai.service', () => ({
  generateSummary: jest.fn(async () => ({ summary: 'ok' })),
}));

jest.mock('@/services/search.service', () => ({
  globalSearch: jest.fn(async () => ({ tasks: [], projects: [], users: [] })),
}));

jest.mock('@/services/admin.service', () => ({
  getUsersPaginated: jest.fn(async () => ({ users: [], pagination: {} })),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), flush: jest.fn() },
}));

import { requireSession } from '@/lib/session';
import { requireAdmin } from '@/lib/admin';
import { POST as aiSummaryPOST } from '@/app/api/ai/summary/route';
import { GET as searchGET } from '@/app/api/search/route';
import { GET as adminUsersGET } from '@/app/api/admin/users/route';

const mockRequireSession = requireSession as jest.Mock;
const mockRequireAdmin = requireAdmin as jest.Mock;

function authed(userId: string): AuthResult {
  return { user: { userId, role: 'USER' }, response: null } as unknown as AuthResult;
}
function adminAuthed(userId: string): AuthResult {
  return { user: { userId, role: 'ADMIN' }, response: null } as unknown as AuthResult;
}

function postReq(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

function getReq(query = ''): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('AI endpoint rate limit (20/hour per user)', () => {
  it('allows requests under the limit and 429s beyond it', async () => {
    mockRequireSession.mockResolvedValue(authed('ai-user-1'));

    // 20 allowed
    for (let i = 0; i < 20; i++) {
      const res = await aiSummaryPOST(postReq({ project: 'p1' }));
      expect(res.status).not.toBe(429);
    }
    // 21st is limited
    const limited = await aiSummaryPOST(postReq({ project: 'p1' }));
    expect(limited.status).toBe(429);
  });

  it('different users have independent buckets', async () => {
    mockRequireSession.mockResolvedValue(authed('ai-user-2'));
    const res = await aiSummaryPOST(postReq({ project: 'p1' }));
    expect(res.status).not.toBe(429);
  });
});

describe('Search rate limit (60/min per user)', () => {
  it('429s after 60 searches', async () => {
    mockRequireSession.mockResolvedValue(authed('search-user-1'));
    for (let i = 0; i < 60; i++) {
      const res = await searchGET(getReq('q=test'));
      expect(res.status).not.toBe(429);
    }
    const limited = await searchGET(getReq('q=test'));
    expect(limited.status).toBe(429);
  });
});

describe('Admin GET rate limit (120/min per admin)', () => {
  it('429s after 120 admin requests', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuthed('admin-rl-1'));
    for (let i = 0; i < 120; i++) {
      const res = await adminUsersGET(getReq());
      expect(res.status).not.toBe(429);
    }
    const limited = await adminUsersGET(getReq());
    expect(limited.status).toBe(429);
  });
});
