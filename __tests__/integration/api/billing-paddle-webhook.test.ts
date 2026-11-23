// __tests__/integration/api/billing-paddle-webhook.test.ts
//
// P7.4 — POST /api/billing/webhook/paddle route coverage:
// configuration gate, signature gate, idempotent processing,
// and transient-failure retry semantics.

import type { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/lib/paddle', () => ({
  isPaddleConfigured: jest.fn(() => true),
}));

jest.mock('@/lib/billing/providers/paddle', () => ({
  unmarshalPaddleEvent: jest.fn(),
}));

jest.mock('@/services/billing.service', () => ({
  handlePaddleEvent: jest.fn(async () => 'processed'),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { isPaddleConfigured } from '@/lib/paddle';
import { unmarshalPaddleEvent } from '@/lib/billing/providers/paddle';
import { handlePaddleEvent } from '@/services/billing.service';
import { POST } from '@/app/api/billing/webhook/paddle/route';

const mockConfigured = isPaddleConfigured as jest.Mock;
const mockUnmarshal = unmarshalPaddleEvent as jest.Mock;
const mockHandle = handlePaddleEvent as jest.Mock;

const NORMALIZED = {
  provider: 'paddle' as const,
  providerEventId: 'uuid-1',
  eventType: 'subscription.updated',
  occurredAt: new Date('2026-11-20T10:00:00.000Z'),
  data: {},
};

function makeRequest(headers: Record<string, string> = {}, body = '{}') {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as NextRequest;
}

const savedSecret = process.env.PADDLE_WEBHOOK_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PADDLE_WEBHOOK_SECRET = 'whsec_test';
  mockConfigured.mockReturnValue(true);
  mockUnmarshal.mockResolvedValue(NORMALIZED);
  mockHandle.mockResolvedValue('processed');
});

afterAll(() => {
  if (savedSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
  else process.env.PADDLE_WEBHOOK_SECRET = savedSecret;
});

describe('POST /api/billing/webhook/paddle', () => {
  it('500 when PADDLE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const res = await POST(makeRequest({ 'paddle-signature': 'ts=1;h1=x' }));
    expect(res.status).toBe(500);
    expect(mockUnmarshal).not.toHaveBeenCalled();
  });

  it('500 when Paddle API is not configured', async () => {
    mockConfigured.mockReturnValue(false);
    const res = await POST(makeRequest({ 'paddle-signature': 'ts=1;h1=x' }));
    expect(res.status).toBe(500);
  });

  it('400 when paddle-signature header is missing', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect(mockUnmarshal).not.toHaveBeenCalled();
  });

  it('passes raw body + signature header to unmarshal', async () => {
    const raw = '{"event_id":"uuid-1","event_type":"subscription.updated"}';
    await POST(makeRequest({ 'paddle-signature': 'ts=123;h1=abc' }, raw));
    expect(mockUnmarshal).toHaveBeenCalledWith(raw, 'ts=123;h1=abc');
  });

  it('400 when signature verification fails', async () => {
    mockUnmarshal.mockRejectedValue(new Error('signature verification failed'));
    const res = await POST(makeRequest({ 'paddle-signature': 'ts=1;h1=bad' }));
    expect(res.status).toBe(400);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('200 processed on valid event', async () => {
    const res = await POST(makeRequest({ 'paddle-signature': 'ts=1;h1=ok' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('received');
    expect(mockHandle).toHaveBeenCalledWith(NORMALIZED);
  });

  it('200 duplicate on idempotent replay', async () => {
    mockHandle.mockResolvedValue('duplicate');
    const res = await POST(makeRequest({ 'paddle-signature': 'ts=1;h1=ok' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('duplicate');
  });

  it('500 on transient processing failure so Paddle retries', async () => {
    mockHandle.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ 'paddle-signature': 'ts=1;h1=ok' }));
    expect(res.status).toBe(500);
  });
});
