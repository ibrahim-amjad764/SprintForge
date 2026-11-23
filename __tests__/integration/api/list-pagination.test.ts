// __tests__/integration/api/list-pagination.test.ts
//
// Phase 7: consistent opt-in pagination on GET /api/projects,
// GET /api/teams, and GET /api/workspace — response contract,
// param validation, max-limit enforcement, empty/partial pages,
// stable-sort delegation, authorization, and legacy compatibility.

import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/lib/authorization', () => ({
  getWorkspaceMembership: jest.fn(async () => ({ role: 'OWNER' })),
  canWriteWorkspace: jest.fn(() => true),
}));

jest.mock('@/services/project.service', () => ({
  createProject: jest.fn(),
  getProjects: jest.fn(async () => [{ _id: 'p1' }]),
  getProjectsPaginated: jest.fn(),
}));

jest.mock('@/services/team.service', () => ({
  createTeam: jest.fn(),
  getTeams: jest.fn(async () => [{ _id: 't1' }]),
  getTeamsPaginated: jest.fn(),
}));

jest.mock('@/services/workspace.service', () => ({
  createWorkspace: jest.fn(),
  getUserWorkspaces: jest.fn(async () => [{ _id: 'w1' }]),
  getUserWorkspacesPaginated: jest.fn(),
}));

jest.mock('@/services/billing.service', () => ({
  assertPlanLimit: jest.fn(async () => ({ ok: true, data: null })),
}));

jest.mock('@/models/Project', () => ({ __esModule: true, default: {} }));

jest.mock('@/services/webhook.service', () => ({
  dispatchWorkspaceCreatedEvent: jest.fn(),
}));
jest.mock('@/services/vcs-provisioning.service', () => ({
  autoProvisionRepository: jest.fn(),
}));
jest.mock('@/services/idp-mapping.service', () => ({
  autoSyncIdpGroups: jest.fn(),
}));
jest.mock('@/services/data-retention.service', () => ({
  scheduleDataRetention: jest.fn(),
}));
jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
  validateSessionToken: jest.fn(async () => ({ userId: 'user-1' })),
}));

import { requireSession } from '@/lib/session';
import { getWorkspaceMembership } from '@/lib/authorization';
import {
  getProjects,
  getProjectsPaginated,
} from '@/services/project.service';
import { getTeams, getTeamsPaginated } from '@/services/team.service';
import {
  getUserWorkspaces,
  getUserWorkspacesPaginated,
} from '@/services/workspace.service';
import { GET as projectsGET } from '@/app/api/projects/route';
import { GET as teamsGET } from '@/app/api/teams/route';
import { GET as workspaceGET } from '@/app/api/workspace/route';

const mockRequireSession = requireSession as jest.Mock;
const mockMembership = getWorkspaceMembership as jest.Mock;
const mockGetProjects = getProjects as jest.Mock;
const mockGetProjectsPaginated = getProjectsPaginated as jest.Mock;
const mockGetTeams = getTeams as jest.Mock;
const mockGetTeamsPaginated = getTeamsPaginated as jest.Mock;
const mockGetWorkspaces = getUserWorkspaces as jest.Mock;
const mockGetWorkspacesPaginated = getUserWorkspacesPaginated as jest.Mock;

const authed: AuthResult = {
  user: { userId: 'user-1', role: 'USER' },
  response: null,
} as unknown as AuthResult;
const unauth: AuthResult = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as unknown as AuthResult;

function req(query = '', withCookie = true): NextRequest {
  const headers = new Headers();
  if (withCookie) headers.set('cookie', 'token=fake');
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
    headers,
    cookies: { get: () => ({ value: 'fake' }) },
  } as unknown as NextRequest;
}

const paged = (n: number, total: number, page = 1, limit = 20) => ({
  items: Array.from({ length: n }, (_, i) => ({ _id: `i${i}` })),
  total,
  page,
  limit,
  hasMore: page * limit < total,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSession.mockResolvedValue(authed);
  mockMembership.mockResolvedValue({ role: 'OWNER' });
});

describe('GET /api/projects — pagination', () => {
  it('returns paginated shape with page/limit', async () => {
    mockGetProjectsPaginated.mockResolvedValue(paged(2, 5, 1, 2));
    const res = await projectsGET(req('workspace=ws-1&page=1&limit=2'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items).toHaveLength(2);
    expect(json.data).toMatchObject({
      total: 5,
      page: 1,
      limit: 2,
      hasMore: true,
    });
    expect(mockGetProjectsPaginated).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ page: 1, limit: 2 }),
    );
  });

  it('preserves legacy full-array response without pagination params', async () => {
    const res = await projectsGET(req('workspace=ws-1'));
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(mockGetProjects).toHaveBeenCalledWith('ws-1');
    expect(mockGetProjectsPaginated).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination params with 400', async () => {
    const res = await projectsGET(req('workspace=ws-1&page=0'));
    expect(res.status).toBe(400);
    expect(mockGetProjectsPaginated).not.toHaveBeenCalled();
  });

  it('enforces max limit of 100', async () => {
    const res = await projectsGET(req('workspace=ws-1&limit=500'));
    expect(res.status).toBe(400);
  });

  it('returns empty page correctly', async () => {
    mockGetProjectsPaginated.mockResolvedValue(paged(0, 0, 3, 20));
    const res = await projectsGET(req('workspace=ws-1&page=3'));
    const json = await res.json();
    expect(json.data.items).toEqual([]);
    expect(json.data.hasMore).toBe(false);
  });

  it('denies non-members before touching the service', async () => {
    mockMembership.mockResolvedValue(null);
    const res = await projectsGET(req('workspace=ws-1&page=1'));
    expect(res.status).toBe(403);
    expect(mockGetProjectsPaginated).not.toHaveBeenCalled();
  });
});

describe('GET /api/teams — pagination', () => {
  it('returns paginated shape and forwards search', async () => {
    mockGetTeamsPaginated.mockResolvedValue(paged(20, 45, 1, 20));
    const res = await teamsGET(req('workspace=ws-1&page=1&limit=20&search=core'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.total).toBe(45);
    expect(json.data.hasMore).toBe(true);
    expect(mockGetTeamsPaginated).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ page: 1, limit: 20 }),
      'core',
    );
  });

  it('partial last page reports hasMore=false', async () => {
    mockGetTeamsPaginated.mockResolvedValue(paged(5, 45, 3, 20));
    const res = await teamsGET(req('workspace=ws-1&page=3&limit=20'));
    const json = await res.json();
    expect(json.data.items).toHaveLength(5);
    expect(json.data.hasMore).toBe(false);
  });

  it('preserves legacy array response', async () => {
    const res = await teamsGET(req('workspace=ws-1'));
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(mockGetTeams).toHaveBeenCalledWith('ws-1');
  });

  it('rejects invalid limit', async () => {
    const res = await teamsGET(req('workspace=ws-1&limit=abc'));
    expect(res.status).toBe(400);
  });

  it('returns 401 unauthenticated', async () => {
    mockRequireSession.mockResolvedValue(unauth);
    const res = await teamsGET(req('workspace=ws-1&page=1'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/workspace — pagination', () => {
  it('returns paginated user workspaces', async () => {
    mockGetWorkspacesPaginated.mockResolvedValue(paged(20, 45, 1, 20));
    const res = await workspaceGET(req('page=1&limit=20'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ total: 45, page: 1, hasMore: true });
    expect(mockGetWorkspacesPaginated).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('preserves legacy array response', async () => {
    const res = await workspaceGET(req(''));
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(mockGetWorkspaces).toHaveBeenCalledWith('user-1');
  });

  it('rejects invalid page', async () => {
    const res = await workspaceGET(req('page=-1'));
    expect(res.status).toBe(400);
  });
});
