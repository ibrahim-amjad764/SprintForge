// __tests__/unit/lib/checkout-client.test.ts
//
// P7.6/P7.8 — client checkout UX: provider selection, monthly/yearly
// interval transport, overlay open/close/failure outcomes, and the
// guarantee that no browser callback activates entitlement.
// Paddle.js events arrive via Paddle.Initialize's eventCallback.

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { startBillingCheckout } from '@/lib/checkout-client';
import { __resetPaddleCheckoutForTests } from '@/lib/paddle-checkout';

const mockFetch = jest.fn() as jest.Mock;
const mockPaddleOpen = jest.fn();
let capturedOpenOpts: Record<string, unknown> | null = null;
let paddleEventCallback: ((event: { name?: string }) => void) | null = null;

const tick = () => new Promise((r) => setTimeout(r, 0));

function paddleCheckoutResponse(priceId = 'pri_pro_monthly_test') {
  return {
    ok: true,
    json: async () => ({
      data: {
        provider: 'paddle',
        paddleCheckout: {
          priceId,
          customerId: 'ctm_1',
          customData: {
            userId: 'user-1',
            workspaceId: '',
            plan: 'PRO',
            interval: 'month',
            checkoutReservationId: 'res_1',
          },
          reservationId: 'res_1',
        },
      },
    }),
  } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetPaddleCheckoutForTests();
  capturedOpenOpts = null;
  paddleEventCallback = null;
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'test_client_token';

  (globalThis as Record<string, unknown>).window = {
    Paddle: {
      Initialize: jest.fn((opts: { eventCallback?: (e: { name?: string }) => void }) => {
        paddleEventCallback = opts.eventCallback ?? null;
      }),
      Checkout: {
        open: (opts: Record<string, unknown>) => {
          capturedOpenOpts = opts;
          mockPaddleOpen(opts);
        },
      },
    },
    location: {
      origin: 'http://localhost:3000',
      assign: jest.fn(),
    },
  };
  (globalThis as Record<string, unknown>).fetch = mockFetch;
});

describe('startBillingCheckout — provider & interval selection', () => {
  it('requests Paddle checkout for PRO monthly', async () => {
    mockFetch.mockResolvedValue(paddleCheckoutResponse());
    const promise = startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    await tick();

    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.provider).toBe('paddle');
    expect(body.plan).toBe('PRO');
    expect(body.interval).toBe('month');
    expect(capturedOpenOpts).toMatchObject({
      items: [{ priceId: 'pri_pro_monthly_test', quantity: 1 }],
    });
    // eventCallback must NOT be a Checkout.open option.
    expect(capturedOpenOpts).not.toHaveProperty('eventCallback');
    paddleEventCallback?.({ name: 'checkout.closed' });
    await expect(promise).resolves.toEqual({ type: 'paddle-closed' });
  });

  it('requests Paddle checkout for PRO yearly', async () => {
    mockFetch.mockResolvedValue(paddleCheckoutResponse('pri_pro_yearly_test'));
    const promise = startBillingCheckout({
      plan: 'PRO',
      interval: 'year',
      returnTo: '/pricing',
    });
    await tick();
    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.interval).toBe('year');
    // Server-resolved yearly price flows to Paddle.js untouched.
    expect(capturedOpenOpts).toMatchObject({
      items: [{ priceId: 'pri_pro_yearly_test', quantity: 1 }],
    });
    paddleEventCallback?.({ name: 'checkout.closed' });
    await promise;
  });

  it('falls back to Stripe when no Paddle client token is configured', async () => {
    delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: 'https://checkout.stripe.com/x' } }),
    } as Response);
    const outcome = await startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.provider).toBe('stripe');
    expect(outcome.type).toBe('redirect');
    expect(
      ((globalThis as { window: { location: { assign: jest.Mock } } }).window
        .location.assign as jest.Mock).mock.calls[0][0],
    ).toBe('https://checkout.stripe.com/x');
  });
});

describe('startBillingCheckout — overlay outcomes', () => {
  it('resolves paddle-closed when the buyer dismisses checkout', async () => {
    mockFetch.mockResolvedValue(paddleCheckoutResponse());
    const promise = startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    await tick();
    paddleEventCallback?.({ name: 'checkout.closed' });
    await expect(promise).resolves.toEqual({ type: 'paddle-closed' });
  });

  it('returns paddle-opened on checkout.completed without granting entitlement', async () => {
    mockFetch.mockResolvedValue(paddleCheckoutResponse());
    const promise = startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    await tick();
    paddleEventCallback?.({ name: 'checkout.completed' });
    const outcome = await promise;
    expect(outcome).toEqual({ type: 'paddle-opened' });

    // The client forwards ONLY the server-provided customData —
    // no plan/status/entitlement fields are injected browser-side.
    const settings = capturedOpenOpts?.settings as Record<string, string>;
    expect(settings.successUrl).toContain('checkout=success');
    expect(capturedOpenOpts?.customData).toEqual({
      userId: 'user-1',
      workspaceId: '',
      plan: 'PRO',
      interval: 'month',
      checkoutReservationId: 'res_1',
    });
  });

  it('ignores events after the checkout promise has settled', async () => {
    mockFetch.mockResolvedValue(paddleCheckoutResponse());
    const promise = startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    await tick();
    paddleEventCallback?.({ name: 'checkout.closed' });
    await expect(promise).resolves.toEqual({ type: 'paddle-closed' });
    // Late duplicate event must not affect anything (no active
    // checkout → ignored).
    expect(() => paddleEventCallback?.({ name: 'checkout.completed' })).not.toThrow();
  });

  it('returns an error outcome when checkout initiation fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'An active subscription already exists' }),
    } as Response);
    const outcome = await startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    expect(outcome).toEqual({
      type: 'error',
      message: 'An active subscription already exists',
    });
    expect(mockPaddleOpen).not.toHaveBeenCalled();
  });

  it('returns an error outcome on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const outcome = await startBillingCheckout({
      plan: 'PRO',
      interval: 'month',
      returnTo: '/pricing',
    });
    expect(outcome.type).toBe('error');
  });
});
