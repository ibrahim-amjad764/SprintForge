// __tests__/unit/lib/paddle-checkout.test.ts
//
// P7.8 — Paddle.js overlay lifecycle: eventCallback registration via
// Paddle.Initialize, pending-checkout resolution, failure modes, and
// repeated-attempt safety. Paddle.js itself is mocked at window.Paddle.

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  openPaddleCheckout,
  __resetPaddleCheckoutForTests,
} from '@/lib/paddle-checkout';

const tick = () => new Promise((r) => setTimeout(r, 0));

let paddleEventCallback: ((event: { name?: string }) => void) | null = null;
let initializeCalls = 0;
let openImpl: (opts: Record<string, unknown>) => void;

const PARAMS = {
  priceId: 'pri_test',
  customerId: 'ctm_1',
  customData: { userId: 'u1' },
  successUrl: 'http://localhost:3000/pricing?checkout=success',
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetPaddleCheckoutForTests();
  paddleEventCallback = null;
  initializeCalls = 0;
  openImpl = () => {};
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'test_token';

  (globalThis as Record<string, unknown>).window = {
    Paddle: {
      Initialize: jest.fn(
        (opts: { eventCallback?: (e: { name?: string }) => void }) => {
          initializeCalls += 1;
          paddleEventCallback = opts.eventCallback ?? null;
        },
      ),
      Checkout: {
        open: jest.fn((opts: Record<string, unknown>) => openImpl(opts)),
      },
    },
  };
});

describe('openPaddleCheckout', () => {
  it('returns unavailable without a client token', async () => {
    delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const res = await openPaddleCheckout(PARAMS);
    expect(res).toBe('unavailable');
  });

  it('registers eventCallback via Paddle.Initialize exactly once', async () => {
    openImpl = () => paddleEventCallback?.({ name: 'checkout.closed' });
    const res = await openPaddleCheckout(PARAMS);
    expect(res).toBe('closed');
    expect(initializeCalls).toBe(1);

    // Second checkout reuses the same Initialize — no duplicate
    // callback registration.
    const res2 = await openPaddleCheckout(PARAMS);
    expect(res2).toBe('closed');
    expect(initializeCalls).toBe(1);
  });

  it('resolves completed on checkout.completed', async () => {
    const promise = openPaddleCheckout(PARAMS);
    await tick();
    paddleEventCallback?.({ name: 'checkout.completed' });
    await expect(promise).resolves.toBe('completed');
  });

  it('resolves closed on checkout.closed', async () => {
    const promise = openPaddleCheckout(PARAMS);
    await tick();
    paddleEventCallback?.({ name: 'checkout.closed' });
    await expect(promise).resolves.toBe('closed');
  });

  it('returns unavailable when Paddle.js fails to load', async () => {
    // window.Paddle absent → loadPaddleJs tries document.createElement;
    // document is undefined in node env → rejects → 'unavailable'.
    (globalThis as Record<string, unknown>).window = {};
    const res = await openPaddleCheckout(PARAMS);
    expect(res).toBe('unavailable');
  });

  it('returns unavailable when Paddle.Initialize throws', async () => {
    (globalThis.window.Paddle.Initialize as jest.Mock).mockImplementation(() => {
      throw new Error('init failed');
    });
    const res = await openPaddleCheckout(PARAMS);
    expect(res).toBe('unavailable');
  });

  it('returns unavailable when Checkout.open throws synchronously', async () => {
    openImpl = () => {
      throw new Error('open failed');
    };
    const res = await openPaddleCheckout(PARAMS);
    expect(res).toBe('unavailable');
    // Promise settled — a late event cannot hang or re-resolve.
    paddleEventCallback?.({ name: 'checkout.closed' });
  });

  it('settles a previous pending checkout as closed on repeat attempt', async () => {
    const first = openPaddleCheckout(PARAMS);
    await tick();
    const second = openPaddleCheckout(PARAMS);
    await expect(first).resolves.toBe('closed');
    paddleEventCallback?.({ name: 'checkout.completed' });
    await expect(second).resolves.toBe('completed');
  });

  it('ignores events arriving after the promise settled', async () => {
    const promise = openPaddleCheckout(PARAMS);
    await tick();
    paddleEventCallback?.({ name: 'checkout.closed' });
    await expect(promise).resolves.toBe('closed');
    // Late completed event — no active checkout → ignored, no throw.
    expect(() =>
      paddleEventCallback?.({ name: 'checkout.completed' }),
    ).not.toThrow();
  });

  it('passes server checkout config to Paddle.Checkout.open', async () => {
    const promise = openPaddleCheckout(PARAMS);
    await tick();
    const openMock = globalThis.window.Paddle.Checkout.open as jest.Mock;
    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ priceId: 'pri_test', quantity: 1 }],
        customer: { id: 'ctm_1' },
        customData: { userId: 'u1' },
        settings: { successUrl: PARAMS.successUrl },
      }),
    );
    // eventCallback must not be passed to Checkout.open.
    expect(openMock.mock.calls[0][0]).not.toHaveProperty('eventCallback');
    paddleEventCallback?.({ name: 'checkout.closed' });
    await promise;
  });
});
