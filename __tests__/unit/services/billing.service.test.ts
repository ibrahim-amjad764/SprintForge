// __tests__/unit/services/billing.service.test.ts
//
// Service-level billing coverage: plan/price resolution, checkout
// guards (invalid plan, interval, workspace ownership, duplicate
// subscription), subscription sync (plan resolution from price ID,
// stale-event guard), webhook idempotency, and plan limits.

jest.mock('@/lib/stripe', () => ({
  __esModule: true,
  default: {
    checkout: {
      sessions: {
        create: jest.fn(),
        expire: jest.fn(async () => ({})),
      },
    },
    billingPortal: { sessions: { create: jest.fn() } },
    customers: { create: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
  },
}));

jest.mock('@/lib/db', () => ({
  connectDB: jest.fn(async () => {}),
}));

jest.mock('@/lib/billing-indexes', () => ({
  ensureBillingIndexes: jest.fn(async () => {}),
}));

jest.mock('@/models/Subscription', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    // Default: guarded update matches an existing/newer document.
    updateOne: jest.fn(async () => ({
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
    })),
  },
}));

jest.mock('@/models/CheckoutReservation', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({})),
  },
}));

jest.mock('@/models/BillingEvent', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    deleteOne: jest.fn(async () => ({})),
  },
}));

jest.mock('@/models/Workspace', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(async () => ({})),
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(async () => ({})),
  },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import stripe from '@/lib/stripe';
import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import BillingEvent from '@/models/BillingEvent';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import {
  createCheckoutSession,
  createPortalSession,
  syncSubscriptionFromStripe,
  handleStripeEvent,
  getEffectivePlan,
  assertPlanLimit,
} from '@/services/billing.service';
import { getStripePriceId } from '@/lib/plans';

const mockSubFindOne = Subscription.findOne as jest.Mock;
const mockSubUpdate = Subscription.updateOne as jest.Mock;
const mockResCreate = CheckoutReservation.create as jest.Mock;
const mockResFindOne = CheckoutReservation.findOne as jest.Mock;
const mockResUpdateOne = CheckoutReservation.updateOne as jest.Mock;
const mockResUpdateMany = CheckoutReservation.updateMany as jest.Mock;
const mockSessionExpire = stripe.checkout.sessions.expire as jest.Mock;
const mockEventCreate = BillingEvent.create as jest.Mock;
const mockEventDelete = BillingEvent.deleteOne as jest.Mock;
const mockWsFindById = Workspace.findById as jest.Mock;
const mockUserFindById = User.findById as jest.Mock;
const mockCustomerCreate = stripe.customers.create as jest.Mock;
const mockCheckoutCreate = stripe.checkout.sessions.create as jest.Mock;
const mockPortalCreate = stripe.billingPortal.sessions.create as jest.Mock;
const mockSubRetrieve = stripe.subscriptions.retrieve as jest.Mock;

const PRICE_PRO = 'price_pro_monthly_test';

function leanChain(value: unknown) {
  return {
    select: jest.fn(() => ({ lean: jest.fn(async () => value) })),
    sort: jest.fn(() => ({
      select: jest.fn(() => ({ lean: jest.fn(async () => value) })),
      lean: jest.fn(async () => value),
    })),
    lean: jest.fn(async () => value),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_PRICE_PRO_MONTHLY = PRICE_PRO;
  process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly_test';
  process.env.STRIPE_PRICE_TEAM_MONTHLY = 'price_team_monthly_test';
  process.env.STRIPE_PRICE_TEAM_YEARLY = 'price_team_yearly_test';
  mockWsFindById.mockReturnValue(leanChain({ owner: 'user-1' }));
  // Default: user has no persisted Stripe customer yet.
  mockUserFindById.mockReturnValue(leanChain(null));
  mockCustomerCreate.mockResolvedValue({ id: 'cus_new_1' });
  // Default: reservation lock is free — create succeeds.
  mockResCreate.mockImplementation(async (doc: Record<string, unknown>) => ({
    _id: 'res_1',
    ...doc,
    toObject() {
      return { _id: 'res_1', ...doc };
    },
  }));
  mockResFindOne.mockReturnValue(leanChain(null));
});

describe('getStripePriceId / plan catalog', () => {
  it('resolves configured price IDs', () => {
    expect(getStripePriceId('PRO', 'month')).toBe(PRICE_PRO);
    expect(getStripePriceId('FREE', 'month')).toBeNull();
    expect(getStripePriceId('PRO', 'year')).toBe('price_pro_yearly_test');
  });
});

describe('createCheckoutSession', () => {
  const base = {
    userId: 'user-1',
    userEmail: 'u@test.com',
    plan: 'PRO',
    interval: 'month',
  };

  it('rejects non-purchasable plans', async () => {
    const res = await createCheckoutSession({ ...base, plan: 'FREE' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it('rejects invalid intervals', async () => {
    const res = await createCheckoutSession({ ...base, interval: 'weekly' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it('rejects when price is not configured', async () => {
    delete process.env.STRIPE_PRICE_TEAM_MONTHLY;
    const res = await createCheckoutSession({ ...base, plan: 'TEAM' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503);
  });

  it('rejects workspace checkout for non-owners', async () => {
    mockWsFindById.mockReturnValue(leanChain({ owner: 'other-user' }));
    const res = await createCheckoutSession({
      ...base,
      workspaceId: 'ws-1',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('blocks duplicate subscriptions in the same scope', async () => {
    mockSubFindOne.mockReturnValue(leanChain({ stripeSubscriptionId: 'sub_1' }));
    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('blocks a fresh incomplete checkout (payment possibly in flight)', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({
        status: 'incomplete',
        createdAt: new Date(), // just created — Stripe may still complete it
      }),
    );
    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('allows retry after an abandoned incomplete checkout goes stale', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({
        status: 'incomplete',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h old = abandoned
      }),
    );
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_retry', url: 'https://x' });
    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    // The stale record was locally expired before creating a new session.
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'incomplete_expired' }),
      }),
    );
    expect(mockCheckoutCreate).toHaveBeenCalled();
  });

  it('creates a checkout session with server-resolved price, persisted customer, and metadata', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/session',
    });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    // A Stripe customer was created and persisted for the user scope.
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'u@test.com' }),
      expect.objectContaining({ idempotencyKey: 'customer:user:user-1' }),
    );
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: PRICE_PRO, quantity: 1 }],
        customer: 'cus_new_1',
        client_reference_id: 'user-1',
        metadata: expect.objectContaining({
          userId: 'user-1',
          plan: 'PRO',
          checkoutReservationId: 'res_1',
        }),
      }),
      expect.objectContaining({
        idempotencyKey: 'checkout:res_1',
      }),
    );
    // Reservation persisted with the Stripe session details.
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_1', status: 'pending' },
      expect.objectContaining({
        $set: expect.objectContaining({ stripeCheckoutSessionId: 'cs_1' }),
      }),
    );
  });

  it('reuses a persisted Stripe customer instead of creating a new one', async () => {
    mockUserFindById.mockReturnValue(
      leanChain({ stripeCustomerId: 'cus_existing' }),
    );
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_2', url: 'https://x' });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' }),
      expect.anything(),
    );
  });

  it('uses returnTo for success/cancel URLs and rejects external origins', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_rt', url: 'https://x' });

    await createCheckoutSession({ ...base, returnTo: '/workspace/new' });
    expect(mockCheckoutCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining('/workspace/new?checkout=success'),
        cancel_url: expect.stringContaining('/workspace/new?checkout=cancelled'),
      }),
      expect.anything(),
    );

    await createCheckoutSession({ ...base, returnTo: 'https://evil.com' });
    expect(mockCheckoutCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        success_url: expect.stringContaining('/dashboard?checkout=success'),
      }),
      expect.anything(),
    );
  });

  it('uses the workspace customer for workspace-scoped checkout', async () => {
    mockWsFindById.mockReturnValue(
      leanChain({ owner: 'user-1', stripeCustomerId: 'cus_ws_1' }),
    );
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_3', url: 'https://x' });

    const res = await createCheckoutSession({ ...base, workspaceId: 'ws-1' });
    expect(res.ok).toBe(true);
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_ws_1',
        metadata: expect.objectContaining({ workspaceId: 'ws-1' }),
      }),
      expect.anything(),
    );
  });
});

describe('checkout reservations (concurrency & recovery)', () => {
  const base = {
    userId: 'user-1',
    userEmail: 'u@test.com',
    plan: 'PRO',
    interval: 'month',
  };

  function pendingReservation(overrides: Record<string, unknown> = {}) {
    return {
      _id: 'res_pending',
      plan: 'PRO',
      interval: 'month',
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      ...overrides,
    };
  }

  it('concurrent request reuses the live payable session URL', async () => {
    // First request already holds the lock with a persisted session.
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        pendingReservation({
          stripeCheckoutSessionId: 'cs_existing',
          checkoutUrl: 'https://checkout.stripe.com/cs_existing',
          sessionExpiresAt: new Date(Date.now() + 3600_000),
        }),
      ),
    );
    mockSubFindOne.mockReturnValue(leanChain(null));

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.url).toBe('https://checkout.stripe.com/cs_existing');
      expect(res.data.sessionId).toBe('cs_existing');
    }
    // No second Stripe session was created.
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('concurrent in-flight creation (no session ID yet) returns 409', async () => {
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(leanChain(pendingReservation()));
    mockSubFindOne.mockReturnValue(leanChain(null));

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('recovers a crashed reservation via the deterministic idempotency key', async () => {
    // Pending reservation, no session ID, older than the inflight window.
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        pendingReservation({
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
        }),
      ),
    );
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({
      id: 'cs_recovered',
      url: 'https://checkout.stripe.com/cs_recovered',
      expires_at: Math.floor(Date.now() / 1000) + 86000,
    });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    // Same reservation → same idempotency key → Stripe returns the
    // original session if the crashed attempt actually succeeded.
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'checkout:res_pending' }),
    );
  });

  it('expires a stale pending reservation and acquires a fresh lock', async () => {
    // Pending reservation whose Stripe session already expired.
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        pendingReservation({
          stripeCheckoutSessionId: 'cs_old',
          checkoutUrl: 'https://old',
          sessionExpiresAt: new Date(Date.now() - 1000),
        }),
      ),
    );
    // Second acquire attempt succeeds.
    mockResCreate.mockImplementationOnce(async (doc: Record<string, unknown>) => ({
      _id: 'res_new',
      ...doc,
      toObject() {
        return { _id: 'res_new', ...doc };
      },
    }));
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_new', url: 'https://new' });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_pending' },
      { $set: { status: 'expired' } },
    );
  });

  it('expires a payable session before switching plan/interval', async () => {
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        pendingReservation({
          interval: 'year', // different from requested 'month'
          stripeCheckoutSessionId: 'cs_yearly',
          checkoutUrl: 'https://yearly',
          sessionExpiresAt: new Date(Date.now() + 3600_000),
        }),
      ),
    );
    mockResCreate.mockImplementationOnce(async (doc: Record<string, unknown>) => ({
      _id: 'res_new',
      ...doc,
      toObject() {
        return { _id: 'res_new', ...doc };
      },
    }));
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_monthly', url: 'https://monthly' });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    // Old payable session explicitly expired at Stripe first.
    expect(mockSessionExpire).toHaveBeenCalledWith('cs_yearly');
  });

  it('keeps the lock when Stripe session expiry fails (session may be payable)', async () => {
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        pendingReservation({
          interval: 'year',
          stripeCheckoutSessionId: 'cs_yearly',
          sessionExpiresAt: new Date(Date.now() + 3600_000),
        }),
      ),
    );
    mockSessionExpire.mockRejectedValueOnce(new Error('stripe down'));
    mockSubFindOne.mockReturnValue(leanChain(null));

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('releases the lock on definitive Stripe 4xx rejection', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockRejectedValue({ statusCode: 400, message: 'bad price' });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(502);
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_1' },
      { $set: { status: 'released' } },
    );
  });

  it('keeps the lock on ambiguous Stripe failure (session may exist)', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockRejectedValue(new Error('socket hangup'));

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503);
    // Reservation NOT released — retry recovers via idempotency key.
    expect(mockResUpdateOne).not.toHaveBeenCalledWith(
      { _id: 'res_1' },
      { $set: { status: 'released' } },
    );
  });

  it('initial reservation TTL is 23h — inside Stripe session life with margin', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_ttl', url: 'https://x' });

    const before = Date.now();
    await createCheckoutSession(base);
    const doc = mockResCreate.mock.calls[0][0] as { expiresAt: Date };
    const ttlMs = doc.expiresAt.getTime() - before;
    // 23h, not 24h — leaves a 1h margin before Stripe's max session life.
    expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000 - 5000);
    expect(ttlMs).toBeLessThan(23 * 60 * 60 * 1000 + 5000);
  });

  it('delayed recovery: crashed reservation at 23.5h is still recoverable (session tail)', async () => {
    /*
      A reservation whose TTL elapsed 30min ago but is within the
      1h session tail must NOT be swept — a Stripe session created
      just before the crash can still be payable. The acquire path
      reuses it and recovers via the idempotency key.
    */
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        pendingReservation({
          createdAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 30 * 60 * 1000), // TTL passed 30m ago
        }),
      ),
    );
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({
      id: 'cs_late',
      url: 'https://late',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'checkout:res_pending' }),
    );
    // The no-session-ID sweep requires expiresAt older than
    // TTL + 1h tail — a 30min-past reservation is NOT expired, so
    // the sweep cutoff is ~1h ago, not ~now.
    const tailSweep = mockResUpdateMany.mock.calls.find((c) => {
      const filter = c[0] as { $or?: unknown[]; expiresAt?: { $lt?: Date } };
      return Array.isArray(filter?.$or) && !!filter?.expiresAt?.$lt;
    });
    expect(tailSweep).toBeTruthy();
    const cutoff = (tailSweep![0] as { expiresAt: { $lt: Date } }).expiresAt.$lt;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(55 * 60 * 1000);
    expect(Date.now() - cutoff.getTime()).toBeLessThan(65 * 60 * 1000);
  });

  it('reservation beyond TTL + tail is swept and a fresh lock acquired', async () => {
    // expiresAt 25h ago → beyond 23h TTL + 1h tail → swept as expired.
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValueOnce(leanChain(null)); // swept → gone
    mockResCreate.mockImplementationOnce(async (doc: Record<string, unknown>) => ({
      _id: 'res_fresh',
      ...doc,
      toObject() {
        return { _id: 'res_fresh', ...doc };
      },
    }));
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockCheckoutCreate.mockResolvedValue({ id: 'cs_fresh', url: 'https://f' });

    const res = await createCheckoutSession(base);
    expect(res.ok).toBe(true);
    // Sweep used the tail-extended cutoff for session-less reservations.
    const sweepCall = mockResUpdateMany.mock.calls.find((c) => {
      const filter = c[0] as { $or?: unknown[] };
      return Array.isArray(filter?.$or);
    });
    expect(sweepCall).toBeTruthy();
    const cutoff = (sweepCall![0] as { expiresAt: { $lt: Date } }).expiresAt.$lt;
    // Cutoff ≈ now - 1h (tail), NOT now — proves the tail was applied.
    expect(Date.now() - cutoff.getTime()).toBeGreaterThan(55 * 60 * 1000);
    expect(Date.now() - cutoff.getTime()).toBeLessThan(65 * 60 * 1000);
  });
});

describe('createPortalSession', () => {
  it('returns 404 without a billing account', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    const res = await createPortalSession({ userId: 'user-1' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it('creates a portal session for the stored customer', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({ stripeCustomerId: 'cus_123' }),
    );
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/x' });
    const res = await createPortalSession({ userId: 'user-1' });
    expect(res.ok).toBe(true);
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_123' }),
    );
  });
});

describe('syncSubscriptionFromStripe', () => {
  const stripeSub = {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    trial_end: null,
    canceled_at: null,
    metadata: { userId: 'user-1', workspaceId: '', plan: 'PRO', interval: 'month' },
    items: {
      data: [
        {
          price: { id: PRICE_PRO },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        },
      ],
    },
  };

  it('upserts with plan resolved from the Stripe price ID', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    const result = await syncSubscriptionFromStripe(
      stripeSub as never,
      new Date('2026-01-01'),
    );
    expect(result).toBe('synced');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_1',
        $or: expect.arrayContaining([
          { lastStripeEventAt: { $lt: new Date('2026-01-01') } },
          { lastStripeEventAt: { $exists: false } },
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          plan: 'PRO',
          interval: 'month',
          status: 'active',
          entitled: true,
          stripeCustomerId: 'cus_1',
        }),
      }),
      { upsert: true },
    );
  });

  it('skips unmapped price IDs', async () => {
    const bad = {
      ...stripeSub,
      items: { data: [{ price: { id: 'price_unknown' } }] },
    };
    const result = await syncSubscriptionFromStripe(bad as never, new Date());
    expect(result).toBe('unmapped');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('ignores stale events older than stored state', async () => {
    // Stored doc has a newer lastStripeEventAt → guarded filter matches nothing.
    mockSubUpdate.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
    });
    const result = await syncSubscriptionFromStripe(
      stripeSub as never,
      new Date('2026-01-01'),
    );
    expect(result).toBe('stale');
    // The staleness check is inside the update filter — no separate read.
    expect(mockSubFindOne).not.toHaveBeenCalled();
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_1' }),
      expect.anything(),
      { upsert: true },
    );
  });

  it('reads subscription-level period fields (current Stripe payload)', async () => {
    const modern = {
      ...stripeSub,
      items: {
        data: [{ price: { id: PRICE_PRO } }], // no item-level periods
      },
      current_period_start: 1700000000,
      current_period_end: 1702592000,
    };
    await syncSubscriptionFromStripe(modern as never, new Date('2026-01-01'));
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          currentPeriodStart: new Date(1700000000 * 1000),
          currentPeriodEnd: new Date(1702592000 * 1000),
        }),
      }),
      { upsert: true },
    );
  });

  it('reads legacy item-level period fields when subscription-level is absent', async () => {
    const legacy = {
      ...stripeSub,
      items: {
        data: [
          {
            price: { id: PRICE_PRO },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    };
    await syncSubscriptionFromStripe(legacy as never, new Date('2026-01-01'));
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          currentPeriodEnd: new Date(1702592000 * 1000),
        }),
      }),
      { upsert: true },
    );
  });

  it('syncs without currentPeriodEnd when period data is missing — entitlement fails closed', async () => {
    const noPeriod = {
      ...stripeSub,
      items: { data: [{ price: { id: PRICE_PRO } }] },
    };
    const result = await syncSubscriptionFromStripe(
      noPeriod as never,
      new Date('2026-01-01'),
    );
    expect(result).toBe('synced');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ currentPeriodEnd: undefined }),
      }),
      { upsert: true },
    );
    // getEffectivePlan excludes 'active' without a future period end.
    mockSubFindOne.mockReturnValue(leanChain(null));
    await getEffectivePlan('user-1');
    const query = mockSubFindOne.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(JSON.stringify(query)).toContain('currentPeriodEnd');
  });
});

describe('handleStripeEvent', () => {
  it('is idempotent — duplicate event IDs are no-ops', async () => {
    mockEventCreate.mockRejectedValue({ code: 11000 });
    const result = await handleStripeEvent({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      created: 1700000000,
      data: { object: {} },
    } as never);
    expect(result).toBe('duplicate');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('processes subscription.deleted through sync', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
    const event = {
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      created: 1700000000,
      data: {
        object: {
          id: 'sub_9',
          status: 'canceled',
          customer: 'cus_1',
          cancel_at_period_end: false,
          metadata: { userId: 'user-1', workspaceId: '' },
          items: { data: [{ price: { id: PRICE_PRO } }] },
        },
      },
    };
    const result = await handleStripeEvent(event as never);
    expect(result).toBe('processed');
    expect(mockSubUpdate).toHaveBeenCalled();
  });

  it('invoice.payment_failed retrieves the authoritative subscription and syncs it', async () => {
    mockEventCreate.mockResolvedValue({});
    // Stripe says the subscription is past_due — the sync writes it.
    mockSubRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'past_due',
      customer: 'cus_1',
      cancel_at_period_end: false,
      metadata: { userId: 'user-1', workspaceId: '' },
      items: {
        data: [
          {
            price: { id: PRICE_PRO },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });
    const event = {
      id: 'evt_3',
      type: 'invoice.payment_failed',
      created: 1700000000,
      data: {
        object: {
          parent: { subscription_details: { subscription: 'sub_1' } },
        },
      },
    };
    const result = await handleStripeEvent(event as never);
    expect(result).toBe('processed');
    expect(mockSubRetrieve).toHaveBeenCalledWith('sub_1');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_1' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'past_due', entitled: true }),
      }),
      { upsert: true },
    );
  });

  it('late invoice.paid cannot resurrect a canceled subscription', async () => {
    mockEventCreate.mockResolvedValue({});
    // Authoritative Stripe state is canceled — the stale invoice.paid
    // event must not flip it back to active.
    mockSubRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'canceled',
      customer: 'cus_1',
      cancel_at_period_end: false,
      canceled_at: 1700001000,
      metadata: { userId: 'user-1', workspaceId: '' },
      items: {
        data: [
          {
            price: { id: PRICE_PRO },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });
    const event = {
      id: 'evt_late_paid',
      type: 'invoice.paid',
      created: 1700000000,
      data: {
        object: {
          parent: { subscription_details: { subscription: 'sub_1' } },
        },
      },
    };
    await handleStripeEvent(event as never);
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_1' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'canceled', entitled: false }),
      }),
      { upsert: true },
    );
    // Never an unconditional status write.
    for (const call of mockSubUpdate.mock.calls) {
      const set = (call[1] as { $set?: Record<string, unknown> }).$set ?? {};
      expect(set.status).not.toBe('active');
    }
  });

  it('late invoice.payment_failed cannot resurrect a canceled subscription', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'canceled',
      customer: 'cus_1',
      cancel_at_period_end: false,
      canceled_at: 1700001000,
      metadata: { userId: 'user-1', workspaceId: '' },
      items: {
        data: [{ price: { id: PRICE_PRO } }],
      },
    });
    const event = {
      id: 'evt_late_fail',
      type: 'invoice.payment_failed',
      created: 1700000000,
      data: {
        object: {
          // Legacy invoice shape — subscription ref at top level.
          subscription: 'sub_1',
        },
      },
    };
    await handleStripeEvent(event as never);
    expect(mockSubRetrieve).toHaveBeenCalledWith('sub_1');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_1' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'canceled', entitled: false }),
      }),
      { upsert: true },
    );
  });

  it('invoice event for a subscription missing in Stripe marks it canceled (guarded)', async () => {
    jest.setTimeout(10000);
    mockEventCreate.mockResolvedValue({});
    // Both the initial retrieve and the bounded read-after-write
    // retry return resource_missing → permanently deleted.
    mockSubRetrieve.mockRejectedValue({ code: 'resource_missing', statusCode: 404 });
    const event = {
      id: 'evt_404',
      type: 'invoice.paid',
      created: 1700000000,
      data: {
        object: {
          parent: { subscription_details: { subscription: 'sub_gone' } },
        },
      },
    };
    const result = await handleStripeEvent(event as never);
    expect(result).toBe('processed');
    // Retrieve attempted twice (initial + one bounded retry).
    expect(mockSubRetrieve).toHaveBeenCalledTimes(2);
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_gone',
        $or: expect.arrayContaining([
          { lastStripeEventAt: { $lt: new Date(1700000000 * 1000) } },
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'canceled', entitled: false }),
      }),
    );
  });

  it('invoice 404 recovers when Stripe read-after-write succeeds on retry', async () => {
    jest.setTimeout(10000);
    mockEventCreate.mockResolvedValue({});
    // First retrieve 404s (propagation lag), retry finds the sub.
    mockSubRetrieve
      .mockRejectedValueOnce({ code: 'resource_missing', statusCode: 404 })
      .mockResolvedValueOnce({
        id: 'sub_1',
        status: 'active',
        customer: 'cus_1',
        cancel_at_period_end: false,
        metadata: { userId: 'user-1', workspaceId: '' },
        items: {
          data: [
            {
              price: { id: PRICE_PRO },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      });
    const event = {
      id: 'evt_raww',
      type: 'invoice.paid',
      created: 1700000000,
      data: {
        object: {
          parent: { subscription_details: { subscription: 'sub_1' } },
        },
      },
    };
    const result = await handleStripeEvent(event as never);
    expect(result).toBe('processed');
    expect(mockSubRetrieve).toHaveBeenCalledTimes(2);
    // Subscription synced as active — NOT canceled.
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_1' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'active' }),
      }),
      { upsert: true },
    );
  });

  it('transient Stripe retrieve failure releases the claim for retry', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubRetrieve.mockRejectedValue(new Error('stripe timeout'));
    const event = {
      id: 'evt_retry',
      type: 'invoice.paid',
      created: 1700000000,
      data: {
        object: {
          parent: { subscription_details: { subscription: 'sub_1' } },
        },
      },
    };
    await expect(handleStripeEvent(event as never)).rejects.toThrow('stripe timeout');
    expect(mockEventDelete).toHaveBeenCalledWith({ stripeEventId: 'evt_retry' });
  });
});

describe('getEffectivePlan', () => {
  it('returns FREE when no subscription exists', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    expect(await getEffectivePlan('user-1')).toBe('FREE');
  });

  it('returns the plan for an entitled subscription', async () => {
    mockSubFindOne.mockReturnValue(leanChain({ plan: 'TEAM' }));
    expect(await getEffectivePlan('user-1', 'ws-1')).toBe('TEAM');
  });

  it('active subscriptions past currentPeriodEnd are excluded from entitlement', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    await getEffectivePlan('user-1');
    const query = mockSubFindOne.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    // The query must gate 'active' on an unexpired period so a missed
    // subscription.deleted webhook cannot grant Pro indefinitely.
    expect(JSON.stringify(query)).toContain('currentPeriodEnd');
    expect(JSON.stringify(query)).toContain('trialing');
    expect(JSON.stringify(query)).toContain('past_due');
  });
});

describe('assertPlanLimit', () => {
  it('allows creation under the limit', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    const res = await assertPlanLimit({
      userId: 'user-1',
      resource: 'projects',
      currentCount: 2,
    });
    expect(res.ok).toBe(true);
  });

  it('blocks at the FREE plan project cap (3)', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    const res = await assertPlanLimit({
      userId: 'user-1',
      resource: 'projects',
      currentCount: 3,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.code).toBe('PROJECT_LIMIT_REACHED');
      expect(res.error).toContain('Free');
    }
  });

  it('PRO plan raises the cap', async () => {
    mockSubFindOne.mockReturnValue(leanChain({ plan: 'PRO' }));
    const res = await assertPlanLimit({
      userId: 'user-1',
      resource: 'projects',
      currentCount: 10,
    });
    expect(res.ok).toBe(true);
  });

  it('FREE user is blocked from a second owned workspace', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    const res = await assertPlanLimit({
      userId: 'user-1',
      resource: 'workspaces',
      currentCount: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.code).toBe('WORKSPACE_LIMIT_REACHED');
    }
  });

  it('PRO user has unlimited owned workspaces', async () => {
    mockSubFindOne.mockReturnValue(leanChain({ plan: 'PRO' }));
    const res = await assertPlanLimit({
      userId: 'user-1',
      resource: 'workspaces',
      currentCount: 50,
    });
    expect(res.ok).toBe(true);
  });
});
