import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

// IMPORTANT: @swc/jest does not hoist jest.mock — everything is loaded via
// dynamic import() in beforeAll after mock registration.

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getAuthUser: jest.fn(),
  verifyToken: jest.fn(),
  createToken: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

// Authorization chain models
const mockMemberFindOne = jest.fn();
const mockWorkspaceFindById = jest.fn();
const mockProjectFindById = jest.fn();
const mockTaskFindById = jest.fn();
const mockTeamFindById = jest.fn();
const mockMemberFind = jest.fn();
const mockMemberFindById = jest.fn();

jest.mock('@/models/WorkspaceMember', () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => mockMemberFindOne(...args),
    find: (...args: unknown[]) => mockMemberFind(...args),
    findById: (...args: unknown[]) => mockMemberFindById(...args),
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
  default: {
    findById: (...args: unknown[]) => mockTaskFindById(...args),
  },
}));

jest.mock('@/models/Team', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockTeamFindById(...args),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('@/models/Attachment', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ task: 'task-1' }),
      }),
    })),
  },
}));

jest.mock('@/models/Notification', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('@/models/TimeEntry', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('@/models/File', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

// Services
jest.mock('@/services/task.service', () => ({
  createTask: jest.fn(async (d: unknown) => ({ _id: 't1', ...(d as object) })),
  getTasks: jest.fn(async () => [{ _id: 'task-1' }]),
  getTasksByWorkspace: jest.fn(async () => [{ _id: 'task-1' }]),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));

jest.mock('@/services/comment.service', () => ({
  createComment: jest.fn(async (d: unknown) => ({ _id: 'c1', ...(d as object) })),
  getComments: jest.fn(async () => []),
}));

jest.mock('@/services/notification.service', () => ({
  getUserNotifications: jest.fn(async () => [{ _id: 'n1' }]),
  markAllAsRead: jest.fn(async () => {}),
  getUnreadCount: jest.fn(async () => ({ count: 3 })),
  markRead: jest.fn(async () => ({})),
}));

jest.mock('@/services/workspace.service', () => ({
  getWorkspaceMembers: jest.fn(async () => []),
  addWorkspaceMember: jest.fn(async (d: unknown) => ({ _id: 'm1', ...(d as object) })),
  updateWorkspaceMember: jest.fn(),
  removeWorkspaceMember: jest.fn(),
  updateWorkspace: jest.fn(),
  deleteWorkspace: jest.fn(),
  getWorkspaceById: jest.fn(),
  createWorkspace: jest.fn(),
  getUserWorkspaces: jest.fn(async () => []),
}));

jest.mock('@/services/attachment.service', () => ({
  deleteAttachment: jest.fn(async () => ({})),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

let tasksGET: typeof import('@/app/api/tasks/route').GET;
let commentsPOST: typeof import('@/app/api/comments/route').POST;
let notificationsGET: typeof import('@/app/api/notifications/route').GET;
let membersPOST: typeof import('@/app/api/workspaces/[id]/members/route').POST;
let attachmentDELETE: typeof import('@/app/api/attachments/[id]/route').DELETE;

let mockRequireAuth: jest.MockedFunction<(request: NextRequest) => Promise<AuthResult>>;
let mockGetTasks: jest.MockedFunction<() => Promise<unknown[]>>;
let mockCreateComment: jest.MockedFunction<(d: unknown) => Promise<unknown>>;
let mockGetUserNotifications: jest.MockedFunction<(u: string) => Promise<unknown[]>>;
let mockAddMember: jest.MockedFunction<(d: unknown) => Promise<unknown>>;
let mockDeleteAttachment: jest.MockedFunction<(id: string) => Promise<unknown>>;

const authUser = { user: { userId: 'user-1' }, response: null } as const;
const unauth = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as const;

function getRequest(query: string, pathname = '/api/notifications'): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query), pathname },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

function jsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams() },
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
  const authModule = await import('@/lib/auth');
  mockRequireAuth = jest.mocked(authModule.requireAuth) as typeof mockRequireAuth;

  const taskService = await import('@/services/task.service');
  mockGetTasks = jest.mocked(taskService.getTasks) as typeof mockGetTasks;

  const commentService = await import('@/services/comment.service');
  mockCreateComment = jest.mocked(commentService.createComment) as typeof mockCreateComment;

  const notifService = await import('@/services/notification.service');
  mockGetUserNotifications = jest.mocked(notifService.getUserNotifications) as typeof mockGetUserNotifications;

  const wsService = await import('@/services/workspace.service');
  mockAddMember = jest.mocked(wsService.addWorkspaceMember) as typeof mockAddMember;

  const attService = await import('@/services/attachment.service');
  mockDeleteAttachment = jest.mocked(attService.deleteAttachment) as typeof mockDeleteAttachment;

  tasksGET = (await import('@/app/api/tasks/route')).GET;
  commentsPOST = (await import('@/app/api/comments/route')).POST;
  notificationsGET = (await import('@/app/api/notifications/route')).GET;
  membersPOST = (await import('@/app/api/workspaces/[id]/members/route')).POST;
  attachmentDELETE = (await import('@/app/api/attachments/[id]/route')).DELETE;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue(authUser);
});

describe('Batch 3 — API auth + IDOR', () => {
  describe('GET /api/tasks?project=', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(unauth);
      const res = await tasksGET(getRequest('project=p1'));
      expect(res.status).toBe(401);
    });

    it('returns 403 for a project in a workspace the user cannot access', async () => {
      mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-x' }));
      nonMember();
      const res = await tasksGET(getRequest('project=p1'));
      expect(res.status).toBe(403);
      expect(mockGetTasks).not.toHaveBeenCalled();
    });

    it('returns tasks for a workspace member', async () => {
      mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-1' }));
      memberOf('EDITOR');
      const res = await tasksGET(getRequest('project=p1'));
      expect(res.status).toBe(200);
      expect(mockGetTasks).toHaveBeenCalledWith('p1');
    });

    it('returns 403 for workspace-scoped query without membership', async () => {
      nonMember();
      const res = await tasksGET(getRequest('workspace=ws-x'));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/comments', () => {
    it('forces the authenticated user — ignores body.user', async () => {
      mockTaskFindById.mockReturnValue(chain({ project: { workspace: 'ws-1' } }));
      memberOf();

      const res = await commentsPOST(
        jsonRequest({ task: 'task-1', user: 'attacker-id', text: 'hi' }),
      );
      expect(res.status).toBe(200);
      expect(mockCreateComment).toHaveBeenCalledWith(
        expect.objectContaining({ user: 'user-1' }),
      );
    });

    it('returns 403 for a task in an inaccessible workspace', async () => {
      mockTaskFindById.mockReturnValue(chain({ project: { workspace: 'ws-x' } }));
      nonMember();

      const res = await commentsPOST(
        jsonRequest({ task: 'task-1', user: 'user-1', text: 'hi' }),
      );
      expect(res.status).toBe(403);
      expect(mockCreateComment).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/notifications', () => {
    it('always uses the JWT user — ignores ?user= param', async () => {
      const res = await notificationsGET(getRequest('user=victim-id'));
      expect(res.status).toBe(200);
      expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1');
    });

    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(unauth);
      const res = await notificationsGET(getRequest('user=user-1'));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/workspaces/[id]/members', () => {
    const ctx = { params: Promise.resolve({ id: 'ws-1' }) };

    it('returns 403 for a regular member (non-admin)', async () => {
      memberOf('EDITOR');
      const res = await membersPOST(jsonRequest({ user: 'u2', role: 'ADMIN' }), ctx);
      expect(res.status).toBe(403);
      expect(mockAddMember).not.toHaveBeenCalled();
    });

    it('returns 403 for a non-member', async () => {
      nonMember();
      const res = await membersPOST(jsonRequest({ user: 'u2' }), ctx);
      expect(res.status).toBe(403);
    });

    it('allows an admin and sanitizes invalid roles', async () => {
      memberOf('ADMIN');
      const res = await membersPOST(
        jsonRequest({ user: 'u2', role: 'SUPERUSER' }),
        ctx,
      );
      expect(res.status).toBe(200);
      expect(mockAddMember).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'VIEWER' }),
      );
    });

    it('prevents an admin from granting OWNER role', async () => {
      memberOf('ADMIN');
      const res = await membersPOST(
        jsonRequest({ user: 'u2', role: 'OWNER' }),
        ctx,
      );
      expect(res.status).toBe(403);
      expect(mockAddMember).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/attachments/[id]', () => {
    const ctx = { params: Promise.resolve({ id: 'att-1' }) };

    it('returns 403 when attachment task is in an inaccessible workspace', async () => {
      mockTaskFindById.mockReturnValue(chain({ project: { workspace: 'ws-x' } }));
      nonMember();

      const res = await attachmentDELETE({} as NextRequest, ctx);
      expect(res.status).toBe(403);
      expect(mockDeleteAttachment).not.toHaveBeenCalled();
    });

    it('allows a workspace member to delete', async () => {
      mockTaskFindById.mockReturnValue(chain({ project: { workspace: 'ws-1' } }));
      memberOf();

      const res = await attachmentDELETE({} as NextRequest, ctx);
      expect(res.status).toBe(200);
      expect(mockDeleteAttachment).toHaveBeenCalledWith('att-1');
    });
  });
});
