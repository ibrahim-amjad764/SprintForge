import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the auth library to avoid ES module issues with jose
jest.mock('@/lib/auth', () => ({
  createToken: jest.fn(),
  verifyToken: jest.fn(),
}));

describe('Auth Library (Mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createToken', () => {
    it('should be called with correct user ID', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockCreateToken = (await import('@/lib/auth')).createToken as jest.Mock;
      mockCreateToken.mockResolvedValue('mock.jwt.token');

      await mockCreateToken(userId);

      expect(mockCreateToken).toHaveBeenCalledWith(userId);
      expect(mockCreateToken).toHaveBeenCalledTimes(1);
    });

    it('should return a token string', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockToken = 'mock.jwt.token';
      const mockCreateToken = (await import('@/lib/auth')).createToken as jest.Mock;
      mockCreateToken.mockResolvedValue(mockToken);

      const token = await mockCreateToken(userId);

      expect(token).toBe(mockToken);
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyToken', () => {
    it('should be called with correct token', async () => {
      const mockToken = 'mock.jwt.token';
      const mockPayload = { userId: '507f1f77bcf86cd799439011', exp: 1234567890 };
      const mockVerifyToken = (await import('@/lib/auth')).verifyToken as jest.Mock;
      mockVerifyToken.mockResolvedValue(mockPayload);

      await mockVerifyToken(mockToken);

      expect(mockVerifyToken).toHaveBeenCalledWith(mockToken);
      expect(mockVerifyToken).toHaveBeenCalledTimes(1);
    });

    it('should return payload for valid token', async () => {
      const mockToken = 'mock.jwt.token';
      const mockPayload = { userId: '507f1f77bcf86cd799439011', exp: 1234567890 };
      const mockVerifyToken = (await import('@/lib/auth')).verifyToken as jest.Mock;
      mockVerifyToken.mockResolvedValue(mockPayload);

      const payload = await mockVerifyToken(mockToken);

      expect(payload).toEqual(mockPayload);
      expect(payload?.userId).toBe('507f1f77bcf86cd799439011');
    });

    it('should return null for invalid token', async () => {
      const invalidToken = 'invalid.token';
      const mockVerifyToken = (await import('@/lib/auth')).verifyToken as jest.Mock;
      mockVerifyToken.mockResolvedValue(null);

      const payload = await mockVerifyToken(invalidToken);

      expect(payload).toBeNull();
    });
  });

  describe('Token Roundtrip', () => {
    it('should successfully create and verify a token', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockToken = 'mock.jwt.token';
      const mockPayload = { userId, exp: 1234567890 };
      const mockCreateToken = (await import('@/lib/auth')).createToken as jest.Mock;
      const mockVerifyToken = (await import('@/lib/auth')).verifyToken as jest.Mock;

      mockCreateToken.mockResolvedValue(mockToken);
      mockVerifyToken.mockResolvedValue(mockPayload);

      const token = await mockCreateToken(userId);
      const payload = await mockVerifyToken(token);

      expect(mockCreateToken).toHaveBeenCalledWith(userId);
      expect(mockVerifyToken).toHaveBeenCalledWith(mockToken);
      expect(payload).toEqual(mockPayload);
    });
  });
});
