// __tests__/unit/services/admin.service.test.ts
//
// Service-level guard tests for admin mutations — the route tests
// mock this layer, so the safety logic is verified here against
// mocked Mongoose models.

import mongoose from 'mongoose';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import Task from '@/models/Task';
import AuditLog from '@/models/AuditLog';
import { setUserRole, getUsersPaginated, getAdminStats } from '@/services/admin.service';

jest.mock('@/models/User');
jest.mock('@/models/Workspace');
jest.mock('@/models/WorkspaceMember');
jest.mock('@/models/Task');
jest.mock('@/models/AuditLog');

const mockUser = User as unknown as {
  findById: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  countDocuments: jest.Mock;
  find: jest.Mock;
};
const mockWorkspace = Workspace as unknown as {
  find: jest.Mock;
  countDocuments: jest.Mock;
};
const mockMember = WorkspaceMember as unknown as {
  aggregate: jest.Mock;
  countDocuments: jest.Mock;
};
const mockTask = Task as unknown as { countDocuments: jest.Mock };
const mockAudit = AuditLog as unknown as { countDocuments: jest.Mock };

const USER_ID = new mongoose.Types.ObjectId().toString();
const ADMIN_ID = new mongoose.Types.ObjectId().toString();

function chainable(result: unknown) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'sort', 'skip', 'limit', 'populate', 'lean']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('setUserRole guards', () => {
  it('rejects roles outside USER/ADMIN', async () => {
    const res = await setUserRole(USER_ID, 'SUPERUSER', ADMIN_ID);
    expect(res.status).toBe('invalid_role');
    expect(mockUser.findById).not.toHaveBeenCalled();
  });

  it('rejects malformed ObjectIds as not_found', async () => {
    const res = await setUserRole('not-an-id', 'ADMIN', ADMIN_ID);
    expect(res.status).toBe('not_found');
  });

  it('returns not_found for missing user', async () => {
    mockUser.findById.mockReturnValue(chainable(null));
    const res = await setUserRole(USER_ID, 'ADMIN', ADMIN_ID);
    expect(res.status).toBe('not_found');
  });

  it('returns unchanged without writing when role is identical', async () => {
    mockUser.findById.mockReturnValue(
      chainable({ _id: USER_ID, role: 'ADMIN', name: 'A', email: 'a@x.com' })
    );
    const res = await setUserRole(USER_ID, 'ADMIN', ADMIN_ID);
    expect(res.status).toBe('unchanged');
    expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('blocks self-demotion', async () => {
    mockUser.findById.mockReturnValue(
      chainable({ _id: ADMIN_ID, role: 'ADMIN', name: 'A', email: 'a@x.com' })
    );
    const res = await setUserRole(ADMIN_ID, 'USER', ADMIN_ID);
    expect(res.status).toBe('self_demotion');
    expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows self-promotion path is unreachable but other-admin demotion of self blocked only for non-ADMIN', async () => {
    // actor demoting a DIFFERENT admin is fine
    mockUser.findById.mockReturnValue(
      chainable({ _id: USER_ID, role: 'ADMIN', name: 'B', email: 'b@x.com' })
    );
    mockUser.countDocuments.mockResolvedValue(2);
    mockUser.findByIdAndUpdate.mockReturnValue(chainable({ _id: USER_ID, role: 'USER' }));
    const res = await setUserRole(USER_ID, 'USER', ADMIN_ID);
    expect(res.status).toBe('ok');
  });

  it('blocks demotion of the last admin', async () => {
    mockUser.findById.mockReturnValue(
      chainable({ _id: USER_ID, role: 'ADMIN', name: 'B', email: 'b@x.com' })
    );
    mockUser.countDocuments.mockResolvedValue(1);
    const res = await setUserRole(USER_ID, 'USER', ADMIN_ID);
    expect(res.status).toBe('last_admin');
    expect(mockUser.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows demotion when multiple admins exist', async () => {
    mockUser.findById.mockReturnValue(
      chainable({ _id: USER_ID, role: 'ADMIN', name: 'B', email: 'b@x.com' })
    );
    mockUser.countDocuments.mockResolvedValue(3);
    mockUser.findByIdAndUpdate.mockReturnValue(chainable({ _id: USER_ID, role: 'USER' }));
    const res = await setUserRole(USER_ID, 'USER', ADMIN_ID);
    expect(res.status).toBe('ok');
  });

  it('does not count admins when promoting USER→ADMIN', async () => {
    mockUser.findById.mockReturnValue(
      chainable({ _id: USER_ID, role: 'USER', name: 'B', email: 'b@x.com' })
    );
    mockUser.findByIdAndUpdate.mockReturnValue(chainable({ _id: USER_ID, role: 'ADMIN' }));
    const res = await setUserRole(USER_ID, 'ADMIN', ADMIN_ID);
    expect(res.status).toBe('ok');
    expect(mockUser.countDocuments).not.toHaveBeenCalled();
  });
});

describe('getUsersPaginated', () => {
  it('escapes regex metacharacters in search input', async () => {
    const findChain = chainable([]);
    mockUser.find.mockReturnValue(findChain);
    mockUser.countDocuments.mockResolvedValue(0);

    await getUsersPaginated({ q: 'a.b*c', page: 1, limit: 20, skip: 0 });

    const filter = mockUser.find.mock.calls[0][0] as { $or: { name: RegExp }[] };
    expect(filter.$or[0].name.source).toBe('a\\.b\\*c');
  });

  it('ignores invalid role filter values', async () => {
    const findChain = chainable([]);
    mockUser.find.mockReturnValue(findChain);
    mockUser.countDocuments.mockResolvedValue(0);

    await getUsersPaginated({ role: 'SUPERUSER', page: 1, limit: 20, skip: 0 });

    const filter = mockUser.find.mock.calls[0][0] as Record<string, unknown>;
    expect(filter.role).toBeUndefined();
  });

  it('excludes password and tokenVersion from the projection', async () => {
    const findChain = chainable([]);
    mockUser.find.mockReturnValue(findChain);
    mockUser.countDocuments.mockResolvedValue(0);

    await getUsersPaginated({ page: 1, limit: 20, skip: 0 });

    expect(findChain.select).toHaveBeenCalledWith(
      expect.not.stringContaining('password')
    );
    expect(findChain.select).toHaveBeenCalledWith(
      expect.not.stringContaining('tokenVersion')
    );
  });
});

describe('getAdminStats', () => {
  it('returns aggregate counts', async () => {
    mockUser.countDocuments.mockResolvedValue(10);
    mockWorkspace.countDocuments.mockResolvedValue(4);
    mockMember.countDocuments.mockResolvedValue(30);
    mockTask.countDocuments.mockResolvedValue(100);
    mockAudit.countDocuments.mockResolvedValue(7);

    const stats = await getAdminStats();

    // 8 countDocuments calls in Promise.all — User twice (total + admin
    // + 30d = three User calls actually). Just assert shape.
    expect(stats.totalUsers).toBe(10);
    expect(stats.totalWorkspaces).toBe(4);
    expect(stats.totalMembers).toBe(30);
    expect(stats.totalTasks).toBe(100);
    expect(stats.totalAuditLogs).toBe(7);
  });
});
