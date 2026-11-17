// __tests__/integration/api/admin.test.ts
//
// Admin Dashboard v2 API coverage: authorization matrix on every
// endpoint, pagination validation, role-mutation guards, and audit
// logging of administrative mutations.

import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

jest.mock('@/lib/admin', () => ({
  requireAdmin: jest.fn(),
  checkAdmin: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/services/admin.service', () => ({
  getUsersPaginated: jest.fn(),
  getWorkspacesPaginated: jest.fn(),
  getAdminStats: jest.fn(),
  setUserRole: jest.fn(),
}));

jest.mock('@/services/audit.service', () => ({
  getLogsPaginated: jest.fn(),
  createAudit: jest.fn(async () => ({})),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), flush: jest.fn() },
}));

import { requireAdmin } from '@/lib/admin';
import {
  getUsersPaginated,
  getWorkspacesPaginated,
  getAdminStats,
  setUserRole,
} from '@/services/admin.service';
import { getLogsPaginated, createAudit } from '@/services/audit.service';
import { GET as usersGET } from '@/app/api/admin/users/route';
import { PATCH as userPatch } from '@/app/api/admin/users/[id]/route';
import { GET as workspacesGET } from '@/app/api/admin/workspaces/route';
import { GET as statsGET } from '@/app/api/admin/stats/route';
import { GET as logsGET } from '@/app/api/admin/logs/route';

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockGetUsers = getUsersPaginated as jest.Mock;
const mockGetWorkspaces = getWorkspacesPaginated as jest.Mock;
const mockGetStats = getAdminStats as jest.Mock;
const mockSetRole = setUserRole as jest.Mock;
const mockGetLogs = getLogsPaginated as jest.Mock;
const mockCreateAudit = createAudit as jest.Mock;

const adminAuth = {
  user: { userId: 'admin-1', role: 'ADMIN' },
  response: null,
} as unknown as AuthResult;
const forbidden = {
  user: null,
  response: errorResponse('Forbidden', 403),
} as unknown as AuthResult;
const unauthenticated = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as unknown as AuthResult;

function getRequest(query = ''): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
  } as unknown as NextRequest;
}

function patchRequest(body: unknown): NextRequest {
  return {
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  } as unknown as NextRequest;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const paginated = { users: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUsers.mockResolvedValue(paginated);
  mockGetWorkspaces.mockResolvedValue({ workspaces: [], pagination: paginated.pagination });
  mockGetStats.mockResolvedValue({ totalUsers: 0 });
  mockGetLogs.mockResolvedValue({ logs: [], pagination: paginated.pagination });
});

describe('authorization matrix', () => {
  const cases: Array<[string, (req: NextRequest) => Promise<Response>]> = [
    ['GET /api/admin/users', (r) => usersGET(r)],
    ['GET /api/admin/workspaces', (r) => workspacesGET(r)],
    ['GET /api/admin/stats', (r) => statsGET(r)],
    ['GET /api/admin/logs', (r) => logsGET(r)],
    ['PATCH /api/admin/users/[id]', (r) => userPatch(r, ctx('u2'))],
  ];

  for (const [name, handler] of cases) {
    it(`${name} returns 401 unauthenticated`, async () => {
      mockRequireAdmin.mockResolvedValue(unauthenticated);
      const res = await handler(getRequest());
      expect(res.status).toBe(401);
    });

    it(`${name} returns 403 for non-admin`, async () => {
      mockRequireAdmin.mockResolvedValue(forbidden);
      const res = await handler(getRequest());
      expect(res.status).toBe(403);
    });
  }
});

describe('GET /api/admin/users', () => {
  it('returns paginated users for admins', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    const res = await usersGET(getRequest('page=2&limit=10&q=ali&role=ADMIN'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.users).toEqual([]);
    expect(mockGetUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10, q: 'ali', role: 'ADMIN' })
    );
  });

  it('rejects invalid pagination', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    const res = await usersGET(getRequest('limit=500'));
    expect(res.status).toBe(400);
    expect(mockGetUsers).not.toHaveBeenCalled();
  });

  it('passes no role filter when absent', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    await usersGET(getRequest());
    expect(mockGetUsers).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined, role: undefined })
    );
  });
});

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    mockSetRole.mockReset();
  });

  it('updates role and writes an audit entry', async () => {
    mockSetRole.mockResolvedValue({
      status: 'ok',
      user: { _id: 'u2', role: 'ADMIN' },
    });
    const res = await userPatch(patchRequest({ role: 'ADMIN' }), ctx('u2'));
    expect(res.status).toBe(200);
    expect(mockSetRole).toHaveBeenCalledWith('u2', 'ADMIN', 'admin-1');
    expect(mockCreateAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'admin-1',
        action: 'ADMIN_ROLE_CHANGE',
        target: 'user:u2',
      })
    );
  });

  it('rejects invalid JSON body', async () => {
    const res = await userPatch(patchRequest(new Error('bad json')), ctx('u2'));
    expect(res.status).toBe(400);
    expect(mockSetRole).not.toHaveBeenCalled();
  });

  it('rejects non-string role', async () => {
    mockSetRole.mockResolvedValue({ status: 'invalid_role' });
    const res = await userPatch(patchRequest({ role: 42 }), ctx('u2'));
    expect(res.status).toBe(400);
    expect(mockSetRole).toHaveBeenCalledWith('u2', '', 'admin-1');
    expect(mockCreateAudit).not.toHaveBeenCalled();
  });

  it('maps invalid_role to 400', async () => {
    mockSetRole.mockResolvedValue({ status: 'invalid_role' });
    const res = await userPatch(patchRequest({ role: 'SUPERUSER' }), ctx('u2'));
    expect(res.status).toBe(400);
    expect(mockCreateAudit).not.toHaveBeenCalled();
  });

  it('maps self_demotion to 400', async () => {
    mockSetRole.mockResolvedValue({ status: 'self_demotion' });
    const res = await userPatch(patchRequest({ role: 'USER' }), ctx('admin-1'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/own admin/i);
    expect(mockCreateAudit).not.toHaveBeenCalled();
  });

  it('maps last_admin to 409', async () => {
    mockSetRole.mockResolvedValue({ status: 'last_admin' });
    const res = await userPatch(patchRequest({ role: 'USER' }), ctx('u2'));
    expect(res.status).toBe(409);
    expect(mockCreateAudit).not.toHaveBeenCalled();
  });

  it('maps not_found to 404', async () => {
    mockSetRole.mockResolvedValue({ status: 'not_found' });
    const res = await userPatch(patchRequest({ role: 'ADMIN' }), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 200 without audit entry when role is unchanged', async () => {
    mockSetRole.mockResolvedValue({
      status: 'unchanged',
      user: { _id: 'u2', role: 'ADMIN' },
    });
    const res = await userPatch(patchRequest({ role: 'ADMIN' }), ctx('u2'));
    expect(res.status).toBe(200);
    expect(mockCreateAudit).not.toHaveBeenCalled();
  });

  it('still returns success when audit write fails', async () => {
    mockSetRole.mockResolvedValue({
      status: 'ok',
      user: { _id: 'u2', role: 'USER' },
    });
    mockCreateAudit.mockRejectedValueOnce(new Error('db down'));
    const res = await userPatch(patchRequest({ role: 'USER' }), ctx('u2'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/workspaces|stats|logs', () => {
  it('workspaces returns paginated data', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    const res = await workspacesGET(getRequest('q=acme&page=1'));
    expect(res.status).toBe(200);
    expect(mockGetWorkspaces).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'acme', page: 1 })
    );
  });

  it('stats returns counts', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    const res = await statsGET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalUsers).toBe(0);
  });

  it('logs passes filters through', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    const res = await logsGET(
      getRequest('q=role&action=ADMIN_ROLE_CHANGE&user=abc&page=3')
    );
    expect(res.status).toBe(200);
    expect(mockGetLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'role',
        action: 'ADMIN_ROLE_CHANGE',
        user: 'abc',
        page: 3,
      })
    );
  });

  it('logs rejects invalid pagination', async () => {
    mockRequireAdmin.mockResolvedValue(adminAuth);
    const res = await logsGET(getRequest('page=0'));
    expect(res.status).toBe(400);
  });
});
