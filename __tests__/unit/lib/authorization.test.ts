// __tests__/unit/lib/authorization.test.ts
//
// NOTE: @swc/jest does not hoist jest.mock — modules under test are
// loaded via dynamic import() inside the tests, after mocks register.

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

const mockMemberFindOne = jest.fn();
const mockWorkspaceFindById = jest.fn();
const mockProjectFindById = jest.fn();
const mockTaskFindById = jest.fn();
const mockTeamFindById = jest.fn();
const mockMemberFind = jest.fn();
const mockWorkspaceFind = jest.fn();
const mockProjectFind = jest.fn();

jest.mock('@/models/WorkspaceMember', () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => mockMemberFindOne(...args),
    find: (...args: unknown[]) => mockMemberFind(...args),
  },
}));

jest.mock('@/models/Workspace', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockWorkspaceFindById(...args),
    find: (...args: unknown[]) => mockWorkspaceFind(...args),
  },
}));

jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockProjectFindById(...args),
    find: (...args: unknown[]) => mockProjectFind(...args),
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
  },
}));

function chain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    populate: jest.fn().mockReturnThis(),
  };
}

const WS = 'ws-1';
const USER = 'user-1';
const OTHER = 'user-2';

describe('lib/authorization', () => {
  let auth: typeof import('@/lib/authorization');

  beforeAll(async () => {
    auth = await import('@/lib/authorization');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkspaceMembership', () => {
    it('returns membership when a WorkspaceMember row exists', async () => {
      mockMemberFindOne.mockReturnValue(chain({ role: 'EDITOR' }));
      const m = await auth.getWorkspaceMembership(WS, USER);
      expect(m).toEqual({ workspaceId: WS, role: 'EDITOR' });
    });

    it('falls back to workspace owner when no member row exists', async () => {
      mockMemberFindOne.mockReturnValue(chain(null));
      mockWorkspaceFindById.mockReturnValue(chain({ owner: USER }));
      const m = await auth.getWorkspaceMembership(WS, USER);
      expect(m).toEqual({ workspaceId: WS, role: 'OWNER' });
    });

    it('returns null for non-member non-owner', async () => {
      mockMemberFindOne.mockReturnValue(chain(null));
      mockWorkspaceFindById.mockReturnValue(chain({ owner: OTHER }));
      const m = await auth.getWorkspaceMembership(WS, USER);
      expect(m).toBeNull();
    });

    it('returns null when workspace does not exist', async () => {
      mockMemberFindOne.mockReturnValue(chain(null));
      mockWorkspaceFindById.mockReturnValue(chain(null));
      const m = await auth.getWorkspaceMembership(WS, USER);
      expect(m).toBeNull();
    });
  });

  describe('getMembershipForProject', () => {
    it('resolves project -> workspace -> membership', async () => {
      mockProjectFindById.mockReturnValue(chain({ workspace: WS }));
      mockMemberFindOne.mockReturnValue(chain({ role: 'VIEWER' }));
      const m = await auth.getMembershipForProject('proj-1', USER);
      expect(m?.role).toBe('VIEWER');
    });

    it('returns null for a project in an inaccessible workspace', async () => {
      mockProjectFindById.mockReturnValue(chain({ workspace: WS }));
      mockMemberFindOne.mockReturnValue(chain(null));
      mockWorkspaceFindById.mockReturnValue(chain({ owner: OTHER }));
      const m = await auth.getMembershipForProject('proj-1', USER);
      expect(m).toBeNull();
    });

    it('returns null when project does not exist', async () => {
      mockProjectFindById.mockReturnValue(chain(null));
      const m = await auth.getMembershipForProject('missing', USER);
      expect(m).toBeNull();
    });
  });

  describe('getMembershipForTask', () => {
    it('resolves task -> project -> workspace -> membership', async () => {
      mockTaskFindById.mockReturnValue(
        chain({ project: { workspace: WS } }),
      );
      mockMemberFindOne.mockReturnValue(chain({ role: 'EDITOR' }));
      const m = await auth.getMembershipForTask('task-1', USER);
      expect(m?.workspaceId).toBe(WS);
    });

    it('returns null for cross-workspace task access', async () => {
      mockTaskFindById.mockReturnValue(
        chain({ project: { workspace: 'ws-other' } }),
      );
      mockMemberFindOne.mockReturnValue(chain(null));
      mockWorkspaceFindById.mockReturnValue(chain({ owner: OTHER }));
      const m = await auth.getMembershipForTask('task-1', USER);
      expect(m).toBeNull();
    });
  });

  describe('getMembershipForTeam', () => {
    it('resolves team -> workspace -> membership', async () => {
      mockTeamFindById.mockReturnValue(chain({ workspace: WS }));
      mockMemberFindOne.mockReturnValue(chain({ role: 'ADMIN' }));
      const m = await auth.getMembershipForTeam('team-1', USER);
      expect(m?.role).toBe('ADMIN');
    });
  });

  describe('getUserWorkspaceIds / getUserProjectIds', () => {
    it('combines member workspaces and owned workspaces', async () => {
      mockMemberFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ workspace: 'ws-a' }]),
        }),
      });
      mockWorkspaceFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'ws-b' }]),
        }),
      });

      const ids = await auth.getUserWorkspaceIds(USER);
      expect(ids.sort()).toEqual(['ws-a', 'ws-b']);
    });

    it('returns project IDs scoped to accessible workspaces', async () => {
      mockMemberFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ workspace: 'ws-a' }]),
        }),
      });
      mockWorkspaceFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });
      mockProjectFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: 'p1' }, { _id: 'p2' }]),
        }),
      });

      const ids = await auth.getUserProjectIds(USER);
      expect(ids).toEqual(['p1', 'p2']);
    });
  });
});
