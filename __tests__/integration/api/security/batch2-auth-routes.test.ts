import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

// IMPORTANT: @swc/jest does not hoist jest.mock — mocked modules and the
// route handlers are loaded via dynamic import() in beforeAll.
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(),
  getClientIP: jest.fn(() => '1.2.3.4'),
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

let loginPOST: typeof import('@/app/api/auth/login/route').POST;
let registerPOST: typeof import('@/app/api/auth/register/route').POST;
let logoutPOST: typeof import('@/app/api/auth/logout/route').POST;

let mockRateLimit: jest.Mock;
let mockGetClientIP: jest.Mock;
let mockFindOne: jest.Mock;
let mockCreate: jest.Mock;
let mockConnectDB: jest.Mock;

beforeAll(async () => {
  const rateLimitModule = await import('@/lib/rate-limit');
  mockRateLimit = rateLimitModule.rateLimit as jest.Mock;
  mockGetClientIP = rateLimitModule.getClientIP as jest.Mock;

  const dbModule = await import('@/lib/db');
  mockConnectDB = dbModule.connectDB as jest.Mock;

  const userModule = await import('@/models/User');
  mockFindOne = (userModule.default as unknown as { findOne: jest.Mock }).findOne;
  mockCreate = (userModule.default as unknown as { create: jest.Mock }).create;

  loginPOST = (await import('@/app/api/auth/login/route')).POST;
  registerPOST = (await import('@/app/api/auth/register/route')).POST;
  logoutPOST = (await import('@/app/api/auth/logout/route')).POST;
});

const requestWithJson = (body: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest;

describe('Batch 2 — auth rate limiting & cookies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue(true);
    mockGetClientIP.mockReturnValue('1.2.3.4');
  });

  describe('POST /api/auth/login', () => {
    it('rejects malformed bodies before rate limiting', async () => {
      const res = await loginPOST(requestWithJson({}));
      expect(res.status).toBe(400);
      expect(mockRateLimit).not.toHaveBeenCalled();
      expect(mockConnectDB).not.toHaveBeenCalled();
    });

    it('returns 429 when rate limited (IP or email)', async () => {
      mockRateLimit.mockReturnValue(false);
      const res = await loginPOST(
        requestWithJson({ email: 'a@b.com', password: 'secret1' }),
      );
      expect(res.status).toBe(429);
      expect(mockFindOne).not.toHaveBeenCalled();
      expect(mockConnectDB).not.toHaveBeenCalled();
    });

    it('applies both IP and per-email rate limit keys', async () => {
      mockFindOne.mockResolvedValue(null);

      await loginPOST(
        requestWithJson({ email: 'Test@Example.com', password: 'secret1' }),
      );

      const keys = mockRateLimit.mock.calls.map((c) => c[0]);
      expect(keys).toContain('login:ip:1.2.3.4');
      expect(keys).toContain('login:email:test@example.com');
    });

    it('returns 400 for unknown email (same message as bad password)', async () => {
      mockFindOne.mockResolvedValue(null);
      const res = await loginPOST(
        requestWithJson({ email: 'ghost@x.com', password: 'secret1' }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe('Invalid credentials');
    });

    it('returns 400 for wrong password', async () => {
      const hash = await bcrypt.hash('right-password', 4);
      mockFindOne.mockResolvedValue({
        _id: 'u1',
        name: 'Test',
        email: 't@x.com',
        password: hash,
      });

      const res = await loginPOST(
        requestWithJson({ email: 't@x.com', password: 'wrong-password' }),
      );
      expect(res.status).toBe(400);
    });

    it('logs in successfully and sets a hardened cookie', async () => {
      const hash = await bcrypt.hash('secret1', 4);
      mockFindOne.mockResolvedValue({
        _id: 'u1',
        name: 'Test User',
        email: 'test@example.com',
        password: hash,
      });

      const res = await loginPOST(
        requestWithJson({ email: 'TEST@example.com', password: 'secret1' }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('token=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Max-Age=604800');
      expect(setCookie).toContain('SameSite=Lax');
      // NODE_ENV=test → Secure must NOT be set (localhost dev compatibility)
      expect(setCookie).not.toContain('Secure');

      // Email lookup uses the normalized (lowercased) address
      expect(mockFindOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  describe('POST /api/auth/register', () => {
    const validBody = {
      name: 'New User',
      email: 'new@example.com',
      password: 'secret1',
    };

    it('rejects invalid input before rate limiting', async () => {
      const res = await registerPOST(
        requestWithJson({ name: 'X', email: 'bad', password: '1' }),
      );
      expect(res.status).toBe(400);
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it('returns 429 when rate limited', async () => {
      mockRateLimit.mockReturnValue(false);
      const res = await registerPOST(requestWithJson(validBody));
      expect(res.status).toBe(429);
      expect(mockFindOne).not.toHaveBeenCalled();
      expect(mockConnectDB).not.toHaveBeenCalled();
    });

    it('applies IP and per-email rate limit keys', async () => {
      mockFindOne.mockResolvedValue({ _id: 'existing' });
      await registerPOST(requestWithJson(validBody));

      const keys = mockRateLimit.mock.calls.map((c) => c[0]);
      expect(keys).toContain('register:ip:1.2.3.4');
      expect(keys).toContain('register:email:new@example.com');
    });

    it('rejects duplicate email', async () => {
      mockFindOne.mockResolvedValue({ _id: 'existing' });
      const res = await registerPOST(requestWithJson(validBody));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe('Email already registered');
    });

    it('creates a user on success', async () => {
      mockFindOne.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        _id: 'new-id',
        name: 'New User',
        email: 'new@example.com',
      });

      const res = await registerPOST(requestWithJson(validBody));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the cookie with matching hardened attributes', async () => {
      const res = await logoutPOST();
      expect(res.status).toBe(200);

      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('token=;');
      expect(setCookie).toContain('Max-Age=0');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('SameSite=Lax');
    });
  });
});
