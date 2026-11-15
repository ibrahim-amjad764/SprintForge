import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

// Batch 4 tests exercise the REAL requireAuth + isSameOriginMutation chain.
// Only jose.jwtVerify (crypto boundary), DB, models and services are mocked.

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

const mockMemberFindOne = jest.fn();
const mockWorkspaceFindById = jest.fn();
const mockProjectFindById = jest.fn();
const mockTaskFindById = jest.fn();
const mockTeamFindById = jest.fn();

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

jest.mock('@/services/task.service', () => ({
  createTask: jest.fn(async (d: unknown) => ({ _id: 't1', ...(d as object) })),
  getTasks: jest.fn(async () => []),
  getTasksByWorkspace: jest.fn(async () => []),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));

jest.mock('@/services/comment.service', () => ({
  createComment: jest.fn(async (d: unknown) => ({ _id: 'c1', ...(d as object) })),
  getComments: jest.fn(async () => []),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

let tasksPOST: typeof import('@/app/api/tasks/route').POST;
let tasksGET: typeof import('@/app/api/tasks/route').GET;
let commentsPOST: typeof import('@/app/api/comments/route').POST;
let mockJwtVerify: jest.Mock;
let mockCreateTask: jest.Mock;
let mockCreateComment: jest.Mock;

const APP_ORIGIN = 'http://localhost:3000';

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    populate: jest.fn().mockReturnThis(),
  };
}

function memberWithRole(role: string) {
  mockMemberFindOne.mockReturnValue(chain({ role }));
}

function apiRequest(opts: {
  method?: string;
  query?: string;
  body?: unknown;
  origin?: string | null;
  withToken?: boolean;
}): NextRequest {
  const method = opts.method ?? 'GET';
  const headersList: Record<string, string> = {};
  if (opts.origin) headersList.origin = opts.origin;

  return {
    method,
    cookies: {
      get: (name: string) =>
        name === 'token' && opts.withToken !== false ? { value: 'tok' } : undefined,
    },
    headers: { get: (h: string) => headersList[h.toLowerCase()] ?? null },
    nextUrl: {
      searchParams: new URLSearchParams(opts.query ?? ''),
      origin: APP_ORIGIN,
      pathname: '/api/test',
    },
    json: async () => opts.body ?? {},
  } as unknown as NextRequest;
}

beforeAll(async () => {
  tasksPOST = (await import('@/app/api/tasks/route')).POST;
  tasksGET = (await import('@/app/api/tasks/route')).GET;
  commentsPOST = (await import('@/app/api/comments/route')).POST;

  const jose = await import('jose');
  mockJwtVerify = jose.jwtVerify as unknown as jest.Mock;

  const taskService = await import('@/services/task.service');
  mockCreateTask = taskService.createTask as unknown as jest.Mock;

  const commentService = await import('@/services/comment.service');
  mockCreateComment = commentService.createComment as unknown as jest.Mock;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockJwtVerify.mockResolvedValue({ payload: { userId: 'user-1' } });
  // Default: project p1 lives in ws-1
  mockProjectFindById.mockReturnValue(chain({ workspace: 'ws-1' }));
});

describe('Batch 4 — RBAC role enforcement', () => {
  it('VIEWER cannot create a task (403)', async () => {
    memberWithRole('VIEWER');
    const res = await tasksPOST(
      apiRequest({
        method: 'POST',
        body: { title: 'T', project: 'p1' },
        origin: APP_ORIGIN,
      }),
    );
    expect(res.status).toBe(403);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('COMMENTER cannot create a task (403)', async () => {
    memberWithRole('COMMENTER');
    const res = await tasksPOST(
      apiRequest({
        method: 'POST',
        body: { title: 'T', project: 'p1' },
        origin: APP_ORIGIN,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('EDITOR can create a task (200)', async () => {
    memberWithRole('EDITOR');
    const res = await tasksPOST(
      apiRequest({
        method: 'POST',
        body: { title: 'T', project: 'p1' },
        origin: APP_ORIGIN,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockCreateTask).toHaveBeenCalled();
  });

  it('VIEWER can still read tasks (200)', async () => {
    memberWithRole('VIEWER');
    const res = await tasksGET(apiRequest({ query: 'project=p1' }));
    expect(res.status).toBe(200);
  });

  it('VIEWER cannot comment (403)', async () => {
    mockTaskFindById.mockReturnValue(chain({ project: { workspace: 'ws-1' } }));
    memberWithRole('VIEWER');
    const res = await commentsPOST(
      apiRequest({
        method: 'POST',
        body: { task: 'task-1', text: 'hi' },
        origin: APP_ORIGIN,
      }),
    );
    expect(res.status).toBe(403);
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it('COMMENTER can comment (200)', async () => {
    mockTaskFindById.mockReturnValue(chain({ project: { workspace: 'ws-1' } }));
    memberWithRole('COMMENTER');
    const res = await commentsPOST(
      apiRequest({
        method: 'POST',
        body: { task: 'task-1', text: 'hi' },
        origin: APP_ORIGIN,
      }),
    );
    expect(res.status).toBe(200);
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user-1' }),
    );
  });
});

describe('Batch 4 — CSRF via real requireAuth', () => {
  it('rejects cross-origin POST even for authorized EDITOR (403)', async () => {
    memberWithRole('EDITOR');
    const res = await tasksPOST(
      apiRequest({
        method: 'POST',
        body: { title: 'T', project: 'p1' },
        origin: 'https://evil.example.com',
      }),
    );
    expect(res.status).toBe(403);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('allows same-origin POST for authorized EDITOR (200)', async () => {
    memberWithRole('EDITOR');
    const res = await tasksPOST(
      apiRequest({
        method: 'POST',
        body: { title: 'T', project: 'p1' },
        origin: APP_ORIGIN,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects missing/invalid token with 401 before CSRF', async () => {
    mockJwtVerify.mockResolvedValue(null);
    const res = await tasksPOST(
      apiRequest({
        method: 'POST',
        body: { title: 'T', project: 'p1' },
        origin: APP_ORIGIN,
        withToken: false,
      }),
    );
    expect(res.status).toBe(401);
  });
});
