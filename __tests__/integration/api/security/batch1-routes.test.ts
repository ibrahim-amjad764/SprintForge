import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { errorResponse } from '@/utils/response';
import type { AuthResult } from '@/lib/auth';

// IMPORTANT: @swc/jest does not hoist jest.mock calls. All mocked modules and
// the route handlers under test are loaded via dynamic import() in beforeAll,
// after these mock registrations have run.
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  getAuthUser: jest.fn(),
  verifyToken: jest.fn(),
  createToken: jest.fn(),
}));

// Routes authenticate via requireSession (DB-backed tokenVersion check).
jest.mock('@/lib/session', () => ({
  requireSession: jest.fn(),
  validateSessionToken: jest.fn(),
  assertTokenVersion: jest.fn(),
  bumpTokenVersion: jest.fn(),
  extractTokenVersion: jest.fn(),
}));

jest.mock('@/lib/admin', () => ({
  requireAdmin: jest.fn(),
  checkAdmin: jest.fn(),
}));

// Batch 3 added task->workspace membership checks to the attachments
// route; this suite tests upload validation, so membership is granted.
jest.mock('@/lib/authorization', () => ({
  getMembershipForTask: jest.fn(async () => ({
    workspaceId: 'ws-1',
    role: 'EDITOR',
  })),
  getWorkspaceMembership: jest.fn(async () => ({
    workspaceId: 'ws-1',
    role: 'EDITOR',
  })),
  canWriteWorkspace: jest.fn(() => true),
  canCommentWorkspace: jest.fn(() => true),
  isWorkspaceMember: jest.fn(async () => true),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/services/admin.service', () => ({
  getUsersPaginated: jest.fn(async () => ({
    users: [{ _id: 'u1', email: 'admin@test.com' }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })),
  getWorkspacesPaginated: jest.fn(async () => ({
    workspaces: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  })),
  getAdminStats: jest.fn(async () => ({})),
  setUserRole: jest.fn(),
}));

jest.mock('@/services/audit.service', () => ({
  getLogsPaginated: jest.fn(async () => ({
    logs: [{ _id: 'log1' }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })),
  createAudit: jest.fn(async () => ({})),
}));

jest.mock('@/services/email.service', () => ({
  sendEmail: jest.fn(async () => {}),
}));

jest.mock('@/services/attachment.service', () => ({
  createAttachment: jest.fn(async (data: unknown) => ({ _id: 'att1', ...(data as object) })),
  getAttachments: jest.fn(async () => []),
}));

jest.mock('@/lib/cloudinary', () => ({
  __esModule: true,
  default: {
    uploader: {
      upload_stream: jest.fn((_opts: unknown, cb: (e: unknown, r: unknown) => void) => ({
        end: () => cb(null, { secure_url: 'https://res.cloudinary.com/x/f.png', public_id: 'pid' }),
      })),
    },
  },
}));

// NOTE: '@/lib/file-validation' is intentionally NOT mocked — route tests
// exercise the real size/MIME/signature validation.

let adminUsersGET: typeof import('@/app/api/admin/users/route').GET;
let adminLogsGET: typeof import('@/app/api/admin/logs/route').GET;
let emailTestPOST: typeof import('@/app/api/email/test/route').POST;
let testDbGET: typeof import('@/app/api/test-db/route').GET;
let resetPasswordPOST: typeof import('@/app/api/auth/reset-password/route').POST;
let attachmentsPOST: typeof import('@/app/api/attachments/route').POST;

let mockRequireAdmin: jest.MockedFunction<(request: NextRequest) => Promise<AuthResult>>;
let mockRequireAuth: jest.MockedFunction<(request: NextRequest) => Promise<AuthResult>>;
let mockGetUsersPaginated: jest.MockedFunction<(args: unknown) => Promise<unknown>>;
let mockSendEmail: jest.MockedFunction<(args: { to: string; subject: string; html: string }) => Promise<unknown>>;

beforeAll(async () => {
  const adminModule = await import('@/lib/admin');
  mockRequireAdmin = jest.mocked(adminModule.requireAdmin) as typeof mockRequireAdmin;

  const sessionModule = await import('@/lib/session');
  mockRequireAuth = jest.mocked(sessionModule.requireSession) as typeof mockRequireAuth;

  const adminService = await import('@/services/admin.service');
  mockGetUsersPaginated = jest.mocked(adminService.getUsersPaginated) as typeof mockGetUsersPaginated;

  const emailService = await import('@/services/email.service');
  mockSendEmail = jest.mocked(emailService.sendEmail) as typeof mockSendEmail;

  adminUsersGET = (await import('@/app/api/admin/users/route')).GET;
  adminLogsGET = (await import('@/app/api/admin/logs/route')).GET;
  emailTestPOST = (await import('@/app/api/email/test/route')).POST;
  testDbGET = (await import('@/app/api/test-db/route')).GET;
  resetPasswordPOST = (await import('@/app/api/auth/reset-password/route')).POST;
  attachmentsPOST = (await import('@/app/api/attachments/route')).POST;
});

const fakeRequest = {} as NextRequest;

// Admin GET routes read request.nextUrl.searchParams — provide it.
function adminGetRequest(query = ''): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(query) },
  } as unknown as NextRequest;
}

const adminAuth = { user: { userId: 'admin-1' }, response: null } as const;
const userForbidden = {
  user: null,
  response: errorResponse('Forbidden', 403),
} as const;
const unauthenticated = {
  user: null,
  response: errorResponse('Not authenticated', 401),
} as const;

function uploadRequest(file: File | null): NextRequest {
  const fd = new FormData();
  if (file) fd.append('file', file);
  fd.append('task', 'task-1');
  return { formData: async () => fd } as unknown as NextRequest;
}

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];

describe('Batch 1 — protected routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAdmin.mockResolvedValue(unauthenticated);
      const res = await adminUsersGET(adminGetRequest());
      expect(res.status).toBe(401);
      expect(mockGetUsersPaginated).not.toHaveBeenCalled();
    });

    it('returns 403 for non-admin users', async () => {
      mockRequireAdmin.mockResolvedValue(userForbidden);
      const res = await adminUsersGET(adminGetRequest());
      expect(res.status).toBe(403);
      expect(mockGetUsersPaginated).not.toHaveBeenCalled();
    });

    it('returns users for admins', async () => {
      mockRequireAdmin.mockResolvedValue(adminAuth);
      const res = await adminUsersGET(adminGetRequest('page=1&limit=20'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockGetUsersPaginated).toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/logs', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAdmin.mockResolvedValue(unauthenticated);
      const res = await adminLogsGET(adminGetRequest());
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      mockRequireAdmin.mockResolvedValue(userForbidden);
      const res = await adminLogsGET(adminGetRequest());
      expect(res.status).toBe(403);
    });

    it('returns logs for admins', async () => {
      mockRequireAdmin.mockResolvedValue(adminAuth);
      const res = await adminLogsGET(adminGetRequest('page=1'));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/email/test', () => {
    it('rejects unauthenticated requests', async () => {
      mockRequireAdmin.mockResolvedValue(unauthenticated);
      const res = await emailTestPOST(fakeRequest);
      expect(res.status).toBe(401);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('rejects non-admin users', async () => {
      mockRequireAdmin.mockResolvedValue(userForbidden);
      const res = await emailTestPOST(fakeRequest);
      expect(res.status).toBe(403);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('allows admins to send test email', async () => {
      mockRequireAdmin.mockResolvedValue(adminAuth);
      const req = {
        json: async () => ({ email: 'admin@test.com' }),
      } as unknown as NextRequest;
      const res = await emailTestPOST(req);
      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe('GET /api/test-db', () => {
    it('rejects unauthenticated requests', async () => {
      mockRequireAdmin.mockResolvedValue(unauthenticated);
      const res = await testDbGET(fakeRequest);
      expect(res.status).toBe(401);
    });

    it('allows admins', async () => {
      mockRequireAdmin.mockResolvedValue(adminAuth);
      const res = await testDbGET(fakeRequest);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('Database connected');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('returns 501 without touching the database or email service', async () => {
      const res = await resetPasswordPOST();
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/attachments', () => {
    const authOk = { user: { userId: 'user-1' }, response: null } as const;

    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(unauthenticated);
      const file = new File([new Uint8Array(PNG_BYTES)], 'a.png', { type: 'image/png' });
      const res = await attachmentsPOST(uploadRequest(file));
      expect(res.status).toBe(401);
    });

    it('rejects a missing file with 400', async () => {
      mockRequireAuth.mockResolvedValue(authOk);
      const res = await attachmentsPOST(uploadRequest(null));
      expect(res.status).toBe(400);
    });

    it('rejects a disallowed file type with 400', async () => {
      mockRequireAuth.mockResolvedValue(authOk);
      const file = new File(['<svg onload=alert(1)>'], 'x.svg', { type: 'image/svg+xml' });
      const res = await attachmentsPOST(uploadRequest(file));
      expect(res.status).toBe(400);
    });

    it('rejects a file whose content does not match its type', async () => {
      mockRequireAuth.mockResolvedValue(authOk);
      const file = new File(['MZ fake executable'], 'evil.png', { type: 'image/png' });
      const res = await attachmentsPOST(uploadRequest(file));
      expect(res.status).toBe(400);
    });

    it('uploads a valid file for an authenticated user', async () => {
      mockRequireAuth.mockResolvedValue(authOk);
      const file = new File([new Uint8Array(PNG_BYTES)], 'ok.png', { type: 'image/png' });
      const res = await attachmentsPOST(uploadRequest(file));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
