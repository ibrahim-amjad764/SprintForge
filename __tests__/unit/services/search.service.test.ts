// __tests__/unit/services/search.service.test.ts
//
// Phase 9: global search must stay workspace-scoped (IDOR-safe),
// match title AND description, escape regex input, cap results,
// and return UI-ready snippets.
//
// NOTE: @swc/jest does not hoist jest.mock — modules are loaded via
// dynamic import() in beforeAll, after the mocks below have run.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/models/Task', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock('@/models/Workspace', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock('@/models/WorkspaceMember', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

type SearchService = typeof import('@/services/search.service');

let globalSearch: SearchService['globalSearch'];
let mockTaskFind: jest.Mock;
let mockProjectFind: jest.Mock;
let mockUserFind: jest.Mock;
let mockWorkspaceFind: jest.Mock;
let mockMemberFind: jest.Mock;

// Chainable mongoose-query stub: every builder method returns the
// same object; lean()/distinct() resolve the canned rows.
type Row = Record<string, unknown>;

function makeQuery(rows: Row[]) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'sort', 'limit', 'populate']) {
    q[m] = jest.fn(() => q);
  }
  q.lean = jest.fn(async () => rows);
  q.distinct = jest.fn(async () =>
    rows.map((r) => (r as { _id?: unknown })._id ?? r)
  );
  return q;
}

beforeAll(async () => {
  const service = await import('@/services/search.service');
  globalSearch = service.globalSearch;

  const taskModule = await import('@/models/Task');
  const projectModule = await import('@/models/Project');
  const userModule = await import('@/models/User');
  const workspaceModule = await import('@/models/Workspace');
  const memberModule = await import('@/models/WorkspaceMember');

  mockTaskFind = taskModule.default.find as jest.Mock;
  mockProjectFind = projectModule.default.find as jest.Mock;
  mockUserFind = userModule.default.find as jest.Mock;
  mockWorkspaceFind = workspaceModule.default.find as jest.Mock;
  mockMemberFind = memberModule.default.find as jest.Mock;
});

function stubScope() {
  // 1) WorkspaceMember.find({ user }) -> member workspace ids
  mockMemberFind.mockReturnValueOnce(makeQuery([{ _id: 'wm1', workspace: 'ws-1' }]));
  // 2) Workspace.find({ owner }) -> owned workspace ids
  mockWorkspaceFind.mockReturnValueOnce(makeQuery([{ _id: 'ws-owned' }]));
  // 3) WorkspaceMember.find({ workspace: { $in } }) -> member user ids
  mockMemberFind.mockReturnValueOnce(makeQuery([{ _id: 'u2' }]));
  // 4) Project.find -> distinct project ids
  mockProjectFind.mockReturnValueOnce(makeQuery([{ _id: 'p1' }]));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('globalSearch', () => {
  it('returns empty results for queries shorter than 2 chars', async () => {
    const res = await globalSearch('a', 'user-1');
    expect(res).toEqual({ tasks: [], projects: [], users: [] });
    expect(mockMemberFind).not.toHaveBeenCalled();
  });

  it('returns empty results when user has no workspaces', async () => {
    mockMemberFind.mockReturnValueOnce(makeQuery([]));
    mockWorkspaceFind.mockReturnValueOnce(makeQuery([]));
    const res = await globalSearch('report', 'user-1');
    expect(res).toEqual({ tasks: [], projects: [], users: [] });
    expect(mockTaskFind).not.toHaveBeenCalled();
  });

  it('scopes task search to projects inside accessible workspaces and matches title OR description', async () => {
    stubScope();
    mockProjectFind.mockReturnValueOnce(
      makeQuery([{ _id: 'p1', name: 'Website', workspace: 'ws-1', description: 'desc', snippet: '' }])
    );
    mockTaskFind.mockReturnValueOnce(
      makeQuery([{ _id: 't1', title: 'Fix bug', description: 'report crash', status: 'TODO', project: 'p1' }])
    );
    mockUserFind.mockReturnValueOnce(makeQuery([{ _id: 'u2', name: 'Alice', email: 'a@x.dev' }]));

    const res = await globalSearch('bug', 'user-1');

    const taskQuery = mockTaskFind.mock.calls[0][0];
    expect(taskQuery.project).toEqual({ $in: ['p1'] });
    expect(taskQuery.$or).toHaveLength(2);
    expect(taskQuery.$or[0].title).toBeInstanceOf(RegExp);
    expect(taskQuery.$or[1].description).toBeInstanceOf(RegExp);
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0]).toMatchObject({ _id: 't1', title: 'Fix bug', status: 'TODO' });
    expect(res.users[0].name).toBe('Alice');
  });

  it('escapes regex metacharacters in the query', async () => {
    stubScope();
    mockProjectFind.mockReturnValueOnce(makeQuery([]));
    mockTaskFind.mockReturnValueOnce(makeQuery([]));
    mockUserFind.mockReturnValueOnce(makeQuery([]));

    await globalSearch('a.b(c)*', 'user-1');
    const taskQuery = mockTaskFind.mock.calls[0][0];
    const pattern = taskQuery.$or[0].title.source;
    expect(pattern).toContain('\\.');
    expect(pattern).toContain('\\(');
    expect(pattern).toContain('\\*');
  });

  it('truncates descriptions into snippets', async () => {
    stubScope();
    const longDesc = 'word '.repeat(60).trim();
    mockProjectFind.mockReturnValueOnce(makeQuery([]));
    mockTaskFind.mockReturnValueOnce(
      makeQuery([{ _id: 't1', title: 'T', description: longDesc, status: 'TODO', project: 'p1' }])
    );
    mockUserFind.mockReturnValueOnce(makeQuery([]));

    const res = await globalSearch('word', 'user-1');
    expect(res.tasks[0].snippet.length).toBeLessThanOrEqual(162);
  });
});
