// __tests__/integration/api/search-analytics.test.ts
//
// Phase 9: /api/search and /api/analytics/overview contracts —
// auth enforcement, empty-query handling, and response shape.

import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/services/search.service', () => ({
  globalSearch: jest.fn(async () => ({
    tasks: [{ _id: 't1', title: 'Fix login' }],
    projects: [],
    users: [],
  })),
}));

jest.mock('@/services/analytics.service', () => ({
  getAnalytics: jest.fn(async () => ({
    totalTasks: 10,
    completedTasks: 4,
    completionRate: 40,
    workload: [],
    velocity: [],
  })),
}));

import { requireSession } from '@/lib/session';
import { globalSearch } from '@/services/search.service';
import { getAnalytics } from '@/services/analytics.service';
import { GET as searchGET } from '@/app/api/search/route';
import { GET as analyticsGET } from '@/app/api/analytics/overview/route';

const mockRequireSession = requireSession as jest.Mock;
const mockGlobalSearch = globalSearch as jest.Mock;
const mockGetAnalytics = getAnalytics as jest.Mock;

const authed: AuthResult = {
  user: { userId: 'user-1', role: 'USER' },
  response: null,
} as unknown as AuthResult;
const unauth: AuthResult = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as unknown as AuthResult;

function req(query = ''): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
    headers: new Headers({ cookie: 'token=fake' }),
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSession.mockResolvedValue(authed);
});

describe('GET /api/search', () => {
  it('rejects unauthenticated requests', async () => {
    mockRequireSession.mockResolvedValue(unauth);
    const res = await searchGET(req('q=test'));
    expect(res.status).toBe(401);
    expect(mockGlobalSearch).not.toHaveBeenCalled();
  });

  it('returns empty arrays when q is missing', async () => {
    const res = await searchGET(req(''));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ tasks: [], projects: [], users: [] });
    expect(mockGlobalSearch).not.toHaveBeenCalled();
  });

  it('returns scoped search results for a valid query', async () => {
    const res = await searchGET(req('q=login'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.tasks).toHaveLength(1);
    expect(mockGlobalSearch).toHaveBeenCalledWith('login', 'user-1');
  });
});

describe('GET /api/analytics/overview', () => {
  it('rejects unauthenticated requests', async () => {
    mockRequireSession.mockResolvedValue(unauth);
    const res = await analyticsGET(req());
    expect(res.status).toBe(401);
    expect(mockGetAnalytics).not.toHaveBeenCalled();
  });

  it('returns analytics for the session user', async () => {
    const res = await analyticsGET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.completionRate).toBe(40);
    expect(mockGetAnalytics).toHaveBeenCalledWith('user-1');
  });
});
