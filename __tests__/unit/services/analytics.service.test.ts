// __tests__/unit/services/analytics.service.test.ts
//
// Phase 9: analytics metrics must be computed from real task data,
// scoped to the user's project ids, with readable workload names
// and ISO-week velocity buckets.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/models/Task', () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock('@/lib/authorization', () => ({
  getUserProjectIds: jest.fn(async () => ['p1', 'p2']),
}));

type AnalyticsService = typeof import('@/services/analytics.service');

let getAnalytics: AnalyticsService['getAnalytics'];
let mockCount: jest.Mock;
let mockAggregate: jest.Mock;

beforeAll(async () => {
  const service = await import('@/services/analytics.service');
  getAnalytics = service.getAnalytics;

  const taskModule = await import('@/models/Task');
  mockCount = taskModule.default.countDocuments as jest.Mock;
  mockAggregate = taskModule.default.aggregate as jest.Mock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getAnalytics', () => {
  it('scopes all queries to the user project ids', async () => {
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue([]);

    await getAnalytics('user-1');

    const scope = { project: { $in: ['p1', 'p2'] } };
    expect(mockCount).toHaveBeenCalledWith(scope);
    expect(mockCount).toHaveBeenCalledWith({ ...scope, status: 'COMPLETED' });
    expect(mockAggregate).toHaveBeenCalledTimes(2);
    const workloadPipeline = mockAggregate.mock.calls[0][0];
    expect(workloadPipeline[0]).toEqual({ $match: scope });
    const velocityPipeline = mockAggregate.mock.calls[1][0];
    expect(velocityPipeline[0].$match).toMatchObject(scope);
    expect(velocityPipeline[0].$match.status).toBe('COMPLETED');
  });

  it('computes completion rate from real counts', async () => {
    mockCount
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(4); // completed
    mockAggregate.mockResolvedValue([]);

    const res = await getAnalytics('user-1');
    expect(res.totalTasks).toBe(10);
    expect(res.completedTasks).toBe(4);
    expect(res.completionRate).toBe(40);
  });

  it('returns 0% completion rate when there are no tasks', async () => {
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue([]);

    const res = await getAnalytics('user-1');
    expect(res.completionRate).toBe(0);
  });

  it('passes through workload rows with resolved names and velocity buckets', async () => {
    mockCount.mockResolvedValue(5);
    mockAggregate
      .mockResolvedValueOnce([
        { userId: 'u1', name: 'Alice', tasks: 3, completed: 1 },
        { userId: null, name: 'Unassigned', tasks: 2, completed: 0 },
      ])
      .mockResolvedValueOnce([{ _id: '2026-W42', completed: 2 }]);

    const res = await getAnalytics('user-1');
    expect(res.workload[0]).toMatchObject({ name: 'Alice', tasks: 3, completed: 1 });
    expect(res.workload[1].name).toBe('Unassigned');
    expect(res.velocity[0]).toEqual({ _id: '2026-W42', completed: 2 });
  });
});
