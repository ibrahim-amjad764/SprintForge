// __tests__/unit/app/admin-page.test.ts
//
// Tests for app/dashboard/admin/page.tsx — the server-side
// access gate in front of the admin dashboard.

const mockCookiesGet = jest.fn();
const mockRedirect = jest.fn((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockValidateSessionToken = jest.fn();
const mockCheckAdmin = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: mockCookiesGet })),
}));

jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

jest.mock('@/lib/session', () => ({
  validateSessionToken: (token: string) => mockValidateSessionToken(token),
}));

jest.mock('@/lib/admin', () => ({
  checkAdmin: (userId: string) => mockCheckAdmin(userId),
}));

jest.mock('@/components/admin/AdminDashboard', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

import AdminPage from '@/app/dashboard/admin/page';
import AdminDashboard from '@/components/admin/AdminDashboard';
import React from 'react';

function hasElementType(node: unknown, type: unknown): boolean {
  if (!React.isValidElement(node)) return false;
  if (node.type === type) return true;
  const children = (node.props as { children?: unknown })?.children;
  const list = Array.isArray(children) ? children : [children];
  return list.some((c) => hasElementType(c, type));
}

const validSession = { userId: 'user-1', role: 'USER', tokenVersion: 0 };

describe('AdminPage (/dashboard/admin) server gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookiesGet.mockReturnValue(undefined);
    mockValidateSessionToken.mockResolvedValue(null);
    mockCheckAdmin.mockResolvedValue(false);
  });

  it('redirects anonymous users (no cookie) to /login', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockValidateSessionToken).not.toHaveBeenCalled();
    expect(mockCheckAdmin).not.toHaveBeenCalled();
  });

  it('redirects revoked/invalid sessions to /login', async () => {
    mockCookiesGet.mockReturnValue({ value: 'stale-token' });
    mockValidateSessionToken.mockResolvedValue(null);
    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockCheckAdmin).not.toHaveBeenCalled();
  });

  it('redirects authenticated non-admin users to /unauthorized', async () => {
    mockCookiesGet.mockReturnValue({ value: 'valid-token' });
    mockValidateSessionToken.mockResolvedValue(validSession);
    mockCheckAdmin.mockResolvedValue(false);
    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
    expect(mockCheckAdmin).toHaveBeenCalledWith('user-1');
  });

  it('denies access when the DB role check fails even if JWT claims ADMIN', async () => {
    // A forged/stale JWT role claim must not bypass the DB check.
    mockCookiesGet.mockReturnValue({ value: 'forged-token' });
    mockValidateSessionToken.mockResolvedValue({
      userId: 'user-2',
      role: 'ADMIN',
      tokenVersion: 0,
    });
    mockCheckAdmin.mockResolvedValue(false);
    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/unauthorized');
  });

  it('renders AdminDashboard for verified ADMIN users', async () => {
    mockCookiesGet.mockReturnValue({ value: 'admin-token' });
    mockValidateSessionToken.mockResolvedValue({
      userId: 'admin-1',
      role: 'ADMIN',
      tokenVersion: 0,
    });
    mockCheckAdmin.mockResolvedValue(true);

    const result = await AdminPage();
    expect(mockCheckAdmin).toHaveBeenCalledWith('admin-1');
    expect(hasElementType(result, AdminDashboard)).toBe(true);
  });
});
