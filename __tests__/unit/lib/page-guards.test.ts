// __tests__/unit/lib/page-guards.test.ts
//
// Server-component authorization guards: session validation,
// workspace membership (incl. owner fallback via the mocked
// authorization layer), project↔workspace binding, and task access.

const mockCookiesGet = jest.fn();
const mockRedirect = jest.fn((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockValidateSessionToken = jest.fn();
const mockGetWorkspaceMembership = jest.fn();
const mockGetMembershipForTask = jest.fn();
const mockProjectFindById = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: mockCookiesGet })),
}));

jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

jest.mock('@/lib/session', () => ({
  validateSessionToken: (token: string) => mockValidateSessionToken(token),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/models/Project', () => ({
  __esModule: true,
  default: { findById: (...args: unknown[]) => mockProjectFindById(...args) },
}));

jest.mock('@/lib/authorization', () => ({
  getWorkspaceMembership: (...args: unknown[]) => mockGetWorkspaceMembership(...args),
  getMembershipForTask: (...args: unknown[]) => mockGetMembershipForTask(...args),
}));

import {
  requireWorkspaceAccess,
  requireProjectInWorkspace,
  requireTaskAccess,
  requirePageUserId,
} from '@/lib/page-guards';

const VALID_SESSION = { userId: '507f1f77bcf86cd7994390aa', role: 'USER' };

function chainableLean(result: unknown) {
  return { select: jest.fn(() => ({ lean: jest.fn(async () => result) })) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCookiesGet.mockReturnValue({ value: 'valid-token' });
  mockValidateSessionToken.mockResolvedValue(VALID_SESSION);
});

describe('requireWorkspaceAccess', () => {
  it('redirects to /login when no token cookie', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    await expect(requireWorkspaceAccess('507f1f77bcf86cd799439011')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockGetWorkspaceMembership).not.toHaveBeenCalled();
  });

  it('redirects to /login when session is invalid/expired', async () => {
    mockValidateSessionToken.mockResolvedValue(null);
    await expect(requireWorkspaceAccess('507f1f77bcf86cd799439011')).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('redirects to /unauthorized for authenticated non-member', async () => {
    mockGetWorkspaceMembership.mockResolvedValue(null);
    await expect(requireWorkspaceAccess('507f1f77bcf86cd799439011')).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
  });

  it('redirects malformed workspace IDs without hitting the DB', async () => {
    await expect(requireWorkspaceAccess('not-an-objectid')).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
    expect(mockGetWorkspaceMembership).not.toHaveBeenCalled();
  });

  it('returns membership for a regular member', async () => {
    mockGetWorkspaceMembership.mockResolvedValue({ workspaceId: '507f1f77bcf86cd799439011', role: 'EDITOR' });
    const m = await requireWorkspaceAccess('507f1f77bcf86cd799439011');
    expect(m.role).toBe('EDITOR');
    expect(mockGetWorkspaceMembership).toHaveBeenCalledWith('507f1f77bcf86cd799439011', '507f1f77bcf86cd7994390aa');
  });

  it('preserves owner access (OWNER role passes through)', async () => {
    // getWorkspaceMembership resolves owner-without-member-row to OWNER
    mockGetWorkspaceMembership.mockResolvedValue({ workspaceId: '507f1f77bcf86cd799439011', role: 'OWNER' });
    const m = await requireWorkspaceAccess('507f1f77bcf86cd799439011');
    expect(m.role).toBe('OWNER');
  });
});

describe('requireProjectInWorkspace', () => {
  it('passes when project belongs to the URL workspace', async () => {
    mockProjectFindById.mockReturnValue(chainableLean({ workspace: '507f1f77bcf86cd799439011' }));
    await expect(requireProjectInWorkspace('507f1f77bcf86cd799439021', '507f1f77bcf86cd799439011')).resolves.toBeUndefined();
  });

  it('redirects when project belongs to a different workspace', async () => {
    mockProjectFindById.mockReturnValue(chainableLean({ workspace: '507f1f77bcf86cd799439012' }));
    await expect(requireProjectInWorkspace('507f1f77bcf86cd799439021', '507f1f77bcf86cd799439011')).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
  });

  it('redirects when project does not exist', async () => {
    mockProjectFindById.mockReturnValue(chainableLean(null));
    await expect(requireProjectInWorkspace('507f1f77bcf86cd799439022', '507f1f77bcf86cd799439011')).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
  });
});

describe('requireTaskAccess', () => {
  it('redirects non-members', async () => {
    mockGetMembershipForTask.mockResolvedValue(null);
    await expect(requireTaskAccess('507f1f77bcf86cd799439031')).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
  });

  it('returns membership for task in accessible workspace', async () => {
    mockGetMembershipForTask.mockResolvedValue({ workspaceId: '507f1f77bcf86cd799439011', role: 'VIEWER' });
    const m = await requireTaskAccess('507f1f77bcf86cd799439031');
    expect(m.role).toBe('VIEWER');
    expect(mockGetMembershipForTask).toHaveBeenCalledWith('507f1f77bcf86cd799439031', '507f1f77bcf86cd7994390aa');
  });
});

describe('requirePageUserId', () => {
  it('returns the session userId', async () => {
    await expect(requirePageUserId()).resolves.toBe('507f1f77bcf86cd7994390aa');
  });

  it('redirects when unauthenticated', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    await expect(requirePageUserId()).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});
