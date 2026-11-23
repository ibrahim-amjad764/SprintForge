// __tests__/integration/api/workspace-create.test.ts
//
// POST /api/workspace coverage: auth gate, plan-limit error mapping
// (PlanLimitError → 403 + stable code, NOT a generic 500), and the
// success path.

import type { NextRequest } from 'next/server';

jest.mock('@/lib/session', () => ({
  validateSessionToken: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/lib/authorization', () => ({
  getWorkspaceMembership: jest.fn(async () => null),
}));

jest.mock('@/services/workspace.service', () => ({
  createWorkspace: jest.fn(),
  getUserWorkspaces: jest.fn(async () => []),
  getUserWorkspacesPaginated: jest.fn(),
}));

jest.mock('@/services/billing.service', () => {
  class PlanLimitError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly code: string,
    ) {
      super(message);
      this.name = 'PlanLimitError';
    }
  }
  return { PlanLimitError };
});

jest.mock('@/services/webhook.service', () => ({
  dispatchWorkspaceCreatedEvent: jest.fn(),
}));
jest.mock('@/services/vcs-provisioning.service', () => ({
  autoProvisionRepository: jest.fn(),
}));
jest.mock('@/services/idp-mapping.service', () => ({
  autoSyncIdpGroups: jest.fn(),
}));
jest.mock('@/services/data-retention.service', () => ({
  scheduleDataRetention: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { validateSessionToken } from '@/lib/session';
import { createWorkspace } from '@/services/workspace.service';
import { PlanLimitError } from '@/services/billing.service';
import { POST } from '@/app/api/workspace/route';

const mockValidate = validateSessionToken as jest.Mock;
const mockCreate = createWorkspace as jest.Mock;

function postRequest(body: unknown, withToken = true): NextRequest {
  return {
    json: async () => body,
    cookies: {
      get: (name: string) =>
        withToken && name === 'token' ? { value: 'tok' } : undefined,
    },
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockValidate.mockResolvedValue({ userId: 'user-1' });
});

describe('POST /api/workspace', () => {
  it('returns 401 when unauthenticated', async () => {
    mockValidate.mockResolvedValue(null);
    const res = await POST(postRequest({ name: 'WS' }, false));
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 403 WORKSPACE_LIMIT_REACHED on plan limit (not 500)', async () => {
    mockCreate.mockRejectedValue(
      new PlanLimitError('Plan limit reached (Free: 1 workspaces).', 403, 'WORKSPACE_LIMIT_REACHED'),
    );
    const res = await POST(postRequest({ name: 'Second WS' }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe('WORKSPACE_LIMIT_REACHED');
    expect(json.message).toContain('Free');
  });

  it('returns 500 for unexpected service errors', async () => {
    mockCreate.mockRejectedValue(new Error('mongo exploded'));
    const res = await POST(postRequest({ name: 'WS' }));
    expect(res.status).toBe(500);
  });

  it('creates a workspace on success', async () => {
    mockCreate.mockResolvedValue({ _id: 'ws-new', name: 'WS' });
    const res = await POST(postRequest({ name: 'WS', slug: 'ws' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data._id).toBe('ws-new');
  });
});
