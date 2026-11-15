// Jest setup file
// Configure test environment

// Mock environment variables for testing
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.STRIPE_SECRET_KEY = 'test-stripe-secret';
process.env.NEXT_PUBLIC_STRIPE_KEY = 'test-stripe-public';
process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.EMAIL_FROM = 'test@example.com';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SOCKET_URL = 'http://localhost:3000';

// Extend Jest matchers
require('@testing-library/jest-dom');

// jose v6 is ESM-only and cannot be transformed by next/jest on Windows.
// Mock the crypto boundary so the real lib/auth code (createToken,
// verifyToken, requireAuth, getAuthUser) can be exercised in tests.
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn(async () => 'mock.jwt.token'),
  })),
  jwtVerify: jest.fn(),
}));
