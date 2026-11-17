// __tests__/integration/api/pagination.test.ts
//
// Phase 4C: opt-in pagination on GET /api/notifications and
// GET /api/tasks — response shape, param validation, max-limit
// enforcement, and preserved authorization/membership checks.
//
// NOTE: @swc/jest does not hoist jest.mock — dynamic imports in
// beforeAll after mock registration.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getAuthUser: jest.fn(),
  verifyToken: jest.fn(),
  createToken: jest.fn(),
}));

// Routes authenticate via requireSession (DB-backed tokenVersion check).
jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
  validateSessionToken: jest.fn(),
  assertTokenVersion: jest.fn(),
  bumpTokenVersion: jest.fn(),
  extractTokenVersion: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => true),
}));

// Authorization chain models (same shape as batch3-idor tests)
const mockMemberFindOne = jest.fn();
const mockWorkspaceFindById = jest.fn();
const mockProjectFindById = jest.fn();

jest.mock('@/models/WorkspaceMember', () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => mockMemberFindOne(...args),
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('@/models/Workspace', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockWorkspaceFindById(...args),
    find: jest.fn(),
  },
}));

jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockProjectFindById(...args),
    find: jest.fn(),
  },
}));

jest.mock('@/models/Task', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

jest.mock('@/models/Team', () => ({
  __esModule: true,
  default: { findById: jest.fn(), findByIdAndUpdate: jest.fn() },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/services/task.service', () => ({
  createTask: jest.fn(),
  getTasks: jest.fn(async () => [{ _id: 'legacy-task' }]),
  getTasksByWorkspace: jest.fn(async () => [{ _id: 'legacy-task' }]),
  getTasksPaginated: jest.fn(async () => ({
    items: [{ _id: 't-page' }],
    total: 45,
    page: 1,
    limit: 20,
    hasMore: true,
  })),
  getTasksByWorkspacePaginated: jest.fn(async () => ({
    items: [{ _id: 't-page' }],
    total: 45,
    page: 1,
    limit: 20,
    hasMore: true,
  })),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));

jest.mock('@/services/notification.service', () => ({
  getUserNotifications: jest.fn(async () => [{ _id: 'n-legacy' }]),
  getUserNotificationsPaginated: jest.fn(async () => ({
    items: [{ _id: 'n1' }, { _id: 'n2' }],
    total: 42,
    page: 1,
    limit: 20,
    hasMore: true,
  })),
  markAllAsRead: jest.fn(async () => {}),
  getUnreadCount: jest.fn(async () => 3),
  markRead: jest.fn(async () => ({})),
}));

let tasksGET: typeof import('@/app/api/tasks/route').GET;
let notificationsGET: typeof import('@/app/api/notifications/route').GET;

let mockRequireAuth: jest.MockedFunction<(request: NextRequest) => Promise<AuthResult>>;
let mockGetTasks: jest.Mock;
let mockGetTasksPaginated: jest.Mock;
let mockGetTasksWsPaginated: jest.Mock;
let mockGetUserNotifications: jest.Mock;
let mockGetUserNotificationsPaginated: jest.Mock;

const authUser = { user: { userId: 'user-1' }, response: null } as const;
const unauth = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as const;

function getRequest(query: string, pathname = '/api/tasks'): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query), pathname },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    populate: jest.fn().mockReturnThis(),
  };
}

const memberOf = (role = 'EDITOR') =>
  mockMemberFindOne.mockReturnValue(chain({ role }));
const nonMember = () => {
  mockMemberFindOne.mockReturnValue(chain(null));
  mockWorkspaceFindById.mockReturnValue(chain({ owner: 'someone-else' }));
};

beforeAll(async () => {
  const sessionModule = await import('@/lib/session');
  mockRequireAuth = jest.mocked(sessionModule.requireSession) as typeof mockRequireAuth;

  const taskService = await import('@/services/task.service');
  mockGetTasks = taskService.getTasks as unknown as jest.Mock;
  mockGetTasksPaginated = taskService.getTasksPaginated as unknown as jest.Mock;
  mockGetTasksWsPaginated = taskService.getTasksByWorkspacePaginated as unknown as jest.Mock;

  const notifService = await import('@/services/notification.service');
  mockGetUserNotifications = notifService.getUserNotifications as unknown as jest.Mock;
  mockGetUserNotificationsPaginated = notifService.getUserNotificationsPaginated as unknown as jest.Mock;

  tasksGET = (await import('@/app/api/tasks/route')).GET;
  notificationsGET = (await import('@/app/api/notifications/route')).GET;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authUser);
});

describe('GET /api/notifications — pagination', () => {
  it('returns paginated shape when page/limit provided', async () => {
    const res = await notificationsGET(
      getRequest('user=ignored&page=2&limit=10', '/api/notifications'),
    );
    expect(res.status).toBe(200);
    expect(mockGetUserNotificationsPaginated).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
      skip: 10,
    });
    expect(mockGetUserNotifications).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(42);
    expect(body.data.hasMore).toBe(true);
  });

  it('uses default limit 20 when only page is given', async () => {
    await notificationsGET(getRequest('page=3', '/api/notifications'));
    expect(mockGetUserNotificationsPaginated).toHaveBeenCalledWith('user-1', {
      page: 3,
      limit: 20,
      skip: 40,
    });
  });

  it('preserves legacy array response without pagination params', async () => {
    const res = await notificationsGET(getRequest('user=user-1', '/api/notifications'));
    expect(res.status).toBe(200);
    expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1');
    expect(mockGetUserNotificationsPaginated).not.toHaveBeenCalled();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('rejects limit above maximum with 400', async () => {
    const res = await notificationsGET(
      getRequest('limit=101', '/api/notifications'),
    );
    expect(res.status).toBe(400);
    expect(mockGetUserNotificationsPaginated).not.toHaveBeenCalled();
  });

  it('rejects invalid page values with 400', async () => {
    for (const q of ['page=abc', 'page=0', 'page=-2', 'page=1.5']) {
      const res = await notificationsGET(getRequest(q, '/api/notifications'));
      expect(res.status).toBe(400);
    }
    expect(mockGetUserNotificationsPaginated).not.toHaveBeenCalled();
  });

  it('never derives user identity from query params', async () => {
    await notificationsGET(
      getRequest('user=attacker&page=1&limit=5', '/api/notifications'),
    );
    expect(mockGetUserNotificationsPaginated).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
    );
  });
});

describe('GET /api/tasks — pagination', () => {
  it('returns paginated tasks for project queries', async () => {
    mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-1' }));
    memberOf('EDITOR');

    const res = await tasksGET(getRequest('project=p1&page=1&limit=25'));
    expect(res.status).toBe(200);
    expect(mockGetTasksPaginated).toHaveBeenCalledWith('p1', {
      page: 1,
      limit: 25,
      skip: 0,
    });
    expect(mockGetTasks).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.hasMore).toBe(true);
  });

  it('returns paginated tasks for workspace queries', async () => {
    memberOf('VIEWER'); // read access is enough for GET

    const res = await tasksGET(getRequest('workspace=ws-1&page=2&limit=10'));
    expect(res.status).toBe(200);
    expect(mockGetTasksWsPaginated).toHaveBeenCalledWith('ws-1', {
      page: 2,
      limit: 10,
      skip: 10,
    });
  });

  it('still enforces membership before serving paginated results', async () => {
    mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-x' }));
    nonMember();

    const res = await tasksGET(getRequest('project=p1&page=1&limit=20'));
    expect(res.status).toBe(403);
    expect(mockGetTasksPaginated).not.toHaveBeenCalled();
  });

  it('preserves legacy array response without pagination params', async () => {
    mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-1' }));
    memberOf();

    const res = await tasksGET(getRequest('project=p1'));
    expect(res.status).toBe(200);
    expect(mockGetTasks).toHaveBeenCalledWith('p1');
    expect(mockGetTasksPaginated).not.toHaveBeenCalled();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('rejects invalid pagination before touching services', async () => {
    mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-1' }));
    memberOf();

    const res = await tasksGET(getRequest('project=p1&limit=500'));
    expect(res.status).toBe(400);
    expect(mockGetTasksPaginated).not.toHaveBeenCalled();
    expect(mockGetTasks).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated regardless of params', async () => {
    mockRequireAuth.mockResolvedValue(unauth);
    const res = await tasksGET(getRequest('project=p1&page=1'));
    expect(res.status).toBe(401);
  });
});
