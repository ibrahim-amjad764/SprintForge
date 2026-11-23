// __tests__/unit/services/project.service.test.ts
//
// Phase 4B regression: project progress stats must use a SINGLE
// Task.aggregate call (no N+1 countDocuments) and preserve the
// exact response shape ({...project, progress, status}).
//
// NOTE: @swc/jest does not hoist jest.mock — modules are loaded via
// dynamic import() in beforeAll, after the mocks below have run.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';

jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/models/Task', () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

type ProjectService = typeof import('@/services/project.service');

let getProjectsWithProgress: ProjectService['getProjectsWithProgress'];
let getProjectsPaginated: ProjectService['getProjectsPaginated'];
let getProjectWithProgress: ProjectService['getProjectWithProgress'];
let unarchiveProject: ProjectService['unarchiveProject'];
let mockProjectFind: jest.Mock;
let mockProjectFindById: jest.Mock;
let mockProjectUpdate: jest.Mock;
let mockProjectCount: jest.Mock;
let mockTaskAggregate: jest.Mock;
let mockTaskCount: jest.Mock;

beforeAll(async () => {
  const service = await import('@/services/project.service');
  getProjectsWithProgress = service.getProjectsWithProgress;
  getProjectsPaginated = service.getProjectsPaginated;
  getProjectWithProgress = service.getProjectWithProgress;
  unarchiveProject = service.unarchiveProject;

  const projectModule = await import('@/models/Project');
  const taskModule = await import('@/models/Task');
  const projectMock = projectModule.default as unknown as {
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
  };
  const taskMock = taskModule.default as unknown as {
    aggregate: jest.Mock;
    countDocuments: jest.Mock;
  };
  mockProjectFind = projectMock.find;
  mockProjectFindById = projectMock.findById;
  mockProjectUpdate = projectMock.findByIdAndUpdate;
  mockProjectCount = projectMock.countDocuments;
  mockTaskAggregate = taskMock.aggregate;
  mockTaskCount = taskMock.countDocuments;
});

function leanResult(docs: unknown[]) {
  return { lean: jest.fn(async () => docs) };
}

function projectDoc(id: string, name = 'Project') {
  return {
    _id: new mongoose.Types.ObjectId(id),
    name,
    workspace: new mongoose.Types.ObjectId(),
    status: 'ACTIVE',
    progress: 0,
  };
}

describe('project.service progress stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses exactly ONE aggregation for all projects (no N+1)', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    const p2 = projectDoc('bbbbbbbbbbbbbbbbbbbbbbbb');
    const p3 = projectDoc('cccccccccccccccccccccccc');
    mockProjectFind.mockReturnValue(leanResult([p1, p2, p3]));
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 4, completed: 1 },
      { _id: p2._id, total: 2, completed: 2 },
      // p3 has no tasks -> absent from aggregation result
    ]);

    const result = await getProjectsWithProgress('ws-1');

    expect(mockTaskAggregate).toHaveBeenCalledTimes(1);
    expect(mockTaskCount).not.toHaveBeenCalled();
    expect(result).toHaveLength(3);
  });

  it('computes progress and status correctly per project', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    const p2 = projectDoc('bbbbbbbbbbbbbbbbbbbbbbbb');
    const p3 = projectDoc('cccccccccccccccccccccccc');
    mockProjectFind.mockReturnValue(leanResult([p1, p2, p3]));
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 3, completed: 1 }, // 33%
      { _id: p2._id, total: 2, completed: 2 }, // 100%
    ]);

    const [r1, r2, r3] = await getProjectsWithProgress('ws-1');

    expect(r1.progress).toBe(33);
    expect(r1.status).toBe('ACTIVE');
    expect(r2.progress).toBe(100);
    expect(r2.status).toBe('COMPLETED');
    // zero-task project: progress 0, ACTIVE
    expect(r3.progress).toBe(0);
    expect(r3.status).toBe('ACTIVE');
  });

  it('preserves project fields in the response shape', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa', 'Sprint Board');
    mockProjectFind.mockReturnValue(leanResult([p1]));
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 1, completed: 0 },
    ]);

    const [result] = await getProjectsWithProgress('ws-1');

    expect(result.name).toBe('Sprint Board');
    expect(result._id.toString()).toBe(p1._id.toString());
    expect(result.workspace).toBeDefined();
    expect(result.progress).toBe(0);
    expect(result.status).toBe('ACTIVE');
  });

  it('skips the aggregation entirely when workspace has no projects', async () => {
    mockProjectFind.mockReturnValue(leanResult([]));

    const result = await getProjectsWithProgress('ws-empty');

    expect(result).toEqual([]);
    expect(mockTaskAggregate).not.toHaveBeenCalled();
  });

  it('passes project ObjectIds (not strings) to the aggregation $match', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    mockProjectFind.mockReturnValue(leanResult([p1]));
    mockTaskAggregate.mockResolvedValue([]);

    await getProjectsWithProgress('ws-1');

    const pipeline = mockTaskAggregate.mock.calls[0][0] as unknown[];
    const match = pipeline[0] as {
      $match: { project: { $in: mongoose.Types.ObjectId[] } };
    };
    expect(match.$match.project.$in[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(match.$match.project.$in[0].toString()).toBe(p1._id.toString());
  });

  it('getProjectWithProgress returns null for missing project', async () => {
    mockProjectFindById.mockReturnValue({
      lean: jest.fn(async () => null),
    });

    const result = await getProjectWithProgress('dddddddddddddddddddddddd');
    expect(result).toBeNull();
    expect(mockTaskAggregate).not.toHaveBeenCalled();
  });

  it('getProjectWithProgress computes stats via one aggregation', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    mockProjectFindById.mockReturnValue({
      lean: jest.fn(async () => p1),
    });
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 5, completed: 5 },
    ]);

    const result = await getProjectWithProgress(p1._id.toString());

    expect(mockTaskAggregate).toHaveBeenCalledTimes(1);
    expect(mockTaskCount).not.toHaveBeenCalled();
    expect(result?.progress).toBe(100);
    expect(result?.status).toBe('COMPLETED');
  });

  it('unarchiveProject sets COMPLETED status at 100% progress', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    mockProjectFindById.mockReturnValue({
      lean: jest.fn(async () => p1),
    });
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 4, completed: 4 },
    ]);
    mockProjectUpdate.mockResolvedValue({ ...p1, status: 'COMPLETED' });

    await unarchiveProject(p1._id.toString());

    expect(mockTaskAggregate).toHaveBeenCalledTimes(1);
    expect(mockTaskCount).not.toHaveBeenCalled();
    expect(mockProjectUpdate).toHaveBeenCalledWith(
      p1._id.toString(),
      { status: 'COMPLETED' },
      { new: true },
    );
  });

  it('unarchiveProject sets ACTIVE status below 100% progress', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    mockProjectFindById.mockReturnValue({
      lean: jest.fn(async () => p1),
    });
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 4, completed: 3 }, // 75%
    ]);
    mockProjectUpdate.mockResolvedValue({ ...p1, status: 'ACTIVE' });

    await unarchiveProject(p1._id.toString());

    expect(mockProjectUpdate).toHaveBeenCalledWith(
      p1._id.toString(),
      { status: 'ACTIVE' },
      { new: true },
    );
  });
});


describe('getProjectsPaginated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function pagedFind(docs: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.sort = jest.fn(() => chain);
    chain.skip = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.lean = jest.fn(async () => docs);
    return chain;
  }

  it('returns the paginated contract with progress computed per page', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    const p2 = projectDoc('bbbbbbbbbbbbbbbbbbbbbbbb');
    mockProjectFind.mockReturnValue(pagedFind([p1, p2]));
    mockProjectCount.mockResolvedValue(7); // Project.countDocuments
    mockTaskAggregate.mockResolvedValue([
      { _id: p1._id, total: 4, completed: 2 }, // 50%
    ]);

    const result = await getProjectsPaginated('ws-1', {
      page: 2,
      limit: 2,
      skip: 2,
    });

    expect(result.total).toBe(7);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(2);
    expect(result.hasMore).toBe(true); // skip(2)+2 items = 4 < total 7
    expect(result.items).toHaveLength(2);
    expect(result.items[0].progress).toBe(50);
    expect(result.items[0].status).toBe('ACTIVE');
    expect(result.items[1].progress).toBe(0);
    // Aggregation scoped to page items only — still a single $group.
    expect(mockTaskAggregate).toHaveBeenCalledTimes(1);
  });

  it('reports hasMore correctly on a middle page', async () => {
    const p1 = projectDoc('aaaaaaaaaaaaaaaaaaaaaaaa');
    mockProjectFind.mockReturnValue(pagedFind([p1]));
    mockProjectCount.mockResolvedValue(50);
    mockTaskAggregate.mockResolvedValue([]);

    const result = await getProjectsPaginated('ws-1', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.hasMore).toBe(true);
    expect(result.items[0].status).toBe('ACTIVE');
  });

  it('handles an empty page', async () => {
    mockProjectFind.mockReturnValue(pagedFind([]));
    mockProjectCount.mockResolvedValue(0);

    const result = await getProjectsPaginated('ws-1', {
      page: 5,
      limit: 20,
      skip: 80,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
    // No projects on the page -> no aggregation needed.
    expect(mockTaskAggregate).not.toHaveBeenCalled();
  });
});
