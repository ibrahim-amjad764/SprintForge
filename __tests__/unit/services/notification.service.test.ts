// __tests__/unit/services/notification.service.test.ts
//
// Phase 4C: paginated notification queries — verifies index-backed
// sort, skip/limit args, total count, and hasMore math.
//
// NOTE: @swc/jest does not hoist jest.mock — dynamic imports in
// beforeAll after mock registration.

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.mock('@/models/Notification', () => ({
  __esModule: true,
  default: {
    find: (...args: unknown[]) => mockFind(...args),
    countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

let getUserNotificationsPaginated: (
  user: string,
  pagination: { page: number; limit: number; skip: number },
) => Promise<{
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}>;

beforeAll(async () => {
  const service = await import('@/services/notification.service');
  getUserNotificationsPaginated = service.getUserNotificationsPaginated;
});

function chain(result: unknown[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe('getUserNotificationsPaginated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries with newest-first sort, skip and limit', async () => {
    const items = [{ _id: 'n3' }, { _id: 'n2' }];
    const q = chain(items);
    mockFind.mockReturnValue(q);
    mockCountDocuments.mockResolvedValue(25);

    const result = await getUserNotificationsPaginated('user-1', {
      page: 2,
      limit: 2,
      skip: 2,
    });

    expect(mockFind).toHaveBeenCalledWith({ user: 'user-1' });
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(q.skip).toHaveBeenCalledWith(2);
    expect(q.limit).toHaveBeenCalledWith(2);
    expect(mockCountDocuments).toHaveBeenCalledWith({ user: 'user-1' });
    expect(result.items).toEqual(items);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(2);
    expect(result.hasMore).toBe(true); // 2 + 2 < 25
  });

  it('reports hasMore=false on the last page', async () => {
    mockFind.mockReturnValue(chain([{ _id: 'n1' }]));
    mockCountDocuments.mockResolvedValue(21);

    const result = await getUserNotificationsPaginated('user-1', {
      page: 2,
      limit: 20,
      skip: 20,
    });

    expect(result.hasMore).toBe(false); // 20 + 1 = 21, not < 21
  });

  it('handles empty results', async () => {
    mockFind.mockReturnValue(chain([]));
    mockCountDocuments.mockResolvedValue(0);

    const result = await getUserNotificationsPaginated('user-1', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});
