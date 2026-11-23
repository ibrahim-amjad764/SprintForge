// __tests__/unit/lib/paddle.test.ts
//
// P7.3 — Paddle provider foundation: environment validation, price
// resolution, and webhook unmarshal wrapper. No real Paddle API calls.

const mockUnmarshal = jest.fn();

jest.mock('@paddle/paddle-node-sdk', () => ({
  Environment: { sandbox: 'sandbox', production: 'production' },
  Paddle: jest.fn().mockImplementation(() => ({
    webhooks: { unmarshal: mockUnmarshal },
  })),
}));

import {
  getPaddleEnvStatus,
  getPaddleClient,
  isPaddleConfigured,
  resetPaddleClientForTests,
} from '@/lib/paddle';
import {
  getPaddlePriceId,
  findPlanByPaddlePriceId,
  unmarshalPaddleEvent,
} from '@/lib/billing/providers/paddle';
import {
  getProviderPriceId,
  findPlanByProviderPriceId,
  getStripePriceId,
  findPlanByPriceId,
} from '@/lib/plans';

const PADDLE_ENV_KEYS = [
  'PADDLE_ENV',
  'PADDLE_API_KEY',
  'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
  'PADDLE_PRICE_PRO_MONTHLY',
  'PADDLE_PRICE_PRO_YEARLY',
  'PADDLE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_TEAM_MONTHLY',
  'STRIPE_PRICE_TEAM_YEARLY',
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of PADDLE_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockUnmarshal.mockReset();
  resetPaddleClientForTests();
});

afterAll(() => {
  for (const key of PADDLE_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('getPaddleEnvStatus', () => {
  it('reports all Paddle vars missing when unset', () => {
    const status = getPaddleEnvStatus();
    expect(status.configured).toBe(false);
    expect(status.missing).toContain('PADDLE_API_KEY');
    expect(status.missing).toContain('PADDLE_WEBHOOK_SECRET');
  });

  it('configured when API key + valid env present (webhook secret optional)', () => {
    process.env.PADDLE_API_KEY = 'pdl_sdbx_test';
    process.env.PADDLE_ENV = 'sandbox';
    const status = getPaddleEnvStatus();
    expect(status.configured).toBe(true);
    expect(status.missing).not.toContain('PADDLE_API_KEY');
  });

  it('flags non-pri_ price IDs as invalid', () => {
    process.env.PADDLE_API_KEY = 'pdl_sdbx_test';
    process.env.PADDLE_PRICE_PRO_MONTHLY = 'price_stripe_style';
    const status = getPaddleEnvStatus();
    expect(status.invalid).toContain('PADDLE_PRICE_PRO_MONTHLY');
    expect(status.configured).toBe(true); // price invalidity does not disable provider
  });

  it('flags invalid PADDLE_ENV values', () => {
    process.env.PADDLE_API_KEY = 'pdl_sdbx_test';
    process.env.PADDLE_ENV = 'staging';
    expect(getPaddleEnvStatus().invalid).toContain('PADDLE_ENV');
    expect(isPaddleConfigured()).toBe(false);
  });
});

describe('getPaddleClient', () => {
  it('throws a clear error when PADDLE_API_KEY is missing', () => {
    expect(() => getPaddleClient()).toThrow(/PADDLE_API_KEY/);
  });

  it('constructs the client once and caches it', () => {
    process.env.PADDLE_API_KEY = 'pdl_sdbx_test';
    process.env.PADDLE_ENV = 'sandbox';
    const a = getPaddleClient();
    const b = getPaddleClient();
    expect(a).toBe(b);
  });
});

describe('provider-aware price resolution', () => {
  beforeEach(() => {
    process.env.PADDLE_PRICE_PRO_MONTHLY = 'pri_monthly_test';
    process.env.PADDLE_PRICE_PRO_YEARLY = 'pri_yearly_test';
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly_test';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly_test';
  });

  it('resolves Paddle PRO prices', () => {
    expect(getPaddlePriceId('PRO', 'month')).toBe('pri_monthly_test');
    expect(getPaddlePriceId('PRO', 'year')).toBe('pri_yearly_test');
  });

  it('rejects non-pri_ Paddle price IDs', () => {
    process.env.PADDLE_PRICE_PRO_MONTHLY = 'price_wrong_prefix';
    expect(getPaddlePriceId('PRO', 'month')).toBeNull();
  });

  it('TEAM has no Paddle prices configured', () => {
    expect(getPaddlePriceId('TEAM', 'month')).toBeNull();
    expect(getPaddlePriceId('FREE', 'month')).toBeNull();
  });

  it('generic resolver dispatches per provider', () => {
    expect(getProviderPriceId('paddle', 'PRO', 'month')).toBe('pri_monthly_test');
    expect(getProviderPriceId('stripe', 'PRO', 'month')).toBe('price_monthly_test');
    // Cross-provider confusion is impossible: a pri_ ID never resolves as Stripe
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'pri_monthly_test';
    expect(getProviderPriceId('stripe', 'PRO', 'month')).toBeNull();
  });

  it('reverse lookup maps Paddle price IDs to plan+interval', () => {
    expect(findPlanByPaddlePriceId('pri_yearly_test')).toEqual({
      plan: 'PRO',
      interval: 'year',
    });
    expect(findPlanByProviderPriceId('paddle', 'pri_monthly_test')).toEqual({
      plan: 'PRO',
      interval: 'month',
    });
    expect(findPlanByPaddlePriceId('pri_unknown')).toBeNull();
  });

  it('Stripe resolution is unchanged', () => {
    expect(getStripePriceId('PRO', 'year')).toBe('price_yearly_test');
    expect(findPlanByPriceId('price_monthly_test')).toEqual({
      plan: 'PRO',
      interval: 'month',
    });
    expect(findPlanByPriceId('pri_monthly_test')).toBeNull();
  });
});

describe('unmarshalPaddleEvent', () => {
  const RAW_BODY = JSON.stringify({ event_id: 'evt_test', event_type: 'subscription.updated' });

  beforeEach(() => {
    process.env.PADDLE_API_KEY = 'pdl_sdbx_test';
    process.env.PADDLE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('returns null when webhook secret is not configured (fail closed)', async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const result = await unmarshalPaddleEvent(RAW_BODY, 'ts=1;h1=abc');
    expect(result).toBeNull();
    expect(mockUnmarshal).not.toHaveBeenCalled();
  });

  it('returns null when signature header is missing', async () => {
    const result = await unmarshalPaddleEvent(RAW_BODY, null);
    expect(result).toBeNull();
    expect(mockUnmarshal).not.toHaveBeenCalled();
  });

  it('normalizes a verified event into the provider-neutral envelope', async () => {
    mockUnmarshal.mockResolvedValue({
      eventId: 'uuid-123',
      eventType: 'subscription.canceled',
      occurredAt: '2026-11-20T10:00:00.000Z',
      data: { id: 'sub_123' },
    });
    const result = await unmarshalPaddleEvent(RAW_BODY, 'ts=1;h1=abc');
    expect(mockUnmarshal).toHaveBeenCalledWith(RAW_BODY, 'whsec_test', 'ts=1;h1=abc');
    expect(result).toEqual({
      provider: 'paddle',
      providerEventId: 'uuid-123',
      eventType: 'subscription.canceled',
      occurredAt: new Date('2026-11-20T10:00:00.000Z'),
      data: { id: 'sub_123' },
    });
  });

  it('propagates signature verification failures', async () => {
    mockUnmarshal.mockRejectedValue(new Error('[Paddle] Webhook signature verification failed'));
    await expect(unmarshalPaddleEvent(RAW_BODY, 'ts=1;h1=bad')).rejects.toThrow(
      /signature verification failed/,
    );
  });
});
