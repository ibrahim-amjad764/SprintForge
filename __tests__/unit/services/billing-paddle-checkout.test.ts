// __tests__/unit/services/billing-paddle-checkout.test.ts
//
// P7.5 — Paddle checkout initiation: provider dispatch, reservation
// lifecycle, Paddle customer management, and checkout↔webhook
// correlation. Paddle SDK + DB mocked at external boundaries.

jest.mock('@/lib/stripe', () => ({
  __esModule: true,
  default: {
    checkout: { sessions: { create: jest.fn(), expire: jest.fn() } },
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

const mockPaddleCustomerCreate = jest.fn();
const mockPaddlePortalCreate = jest.fn();

jest.mock('@/lib/paddle', () => ({
  getPaddleClient: jest.fn(() => ({
    customers: { create: mockPaddleCustomerCreate },
    subscriptions: { get: jest.fn() },
    customerPortalSessions: { create: mockPaddlePortalCreate },
  })),
  isPaddleConfigured: jest.fn(() => true),
}));

const mockRetrieveSubscription = jest.fn();
const mockRetrieveCustomer = jest.fn();

jest.mock('@/lib/billing/providers/paddle', () => {
  const actual = jest.requireActual('@/lib/billing/providers/paddle');
  return {
    ...actual,
    retrievePaddleSubscription: (...args: unknown[]) =>
      mockRetrieveSubscription(...args),
    retrievePaddleCustomer: (...args: unknown[]) =>
      mockRetrieveCustomer(...args),
  };
});

jest.mock('@/models/Subscription', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
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
    findById: jest.fn(),
    updateOne: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({})),
  },
}));

jest.mock('@/models/BillingEvent', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    deleteOne: jest.fn(async () => ({})),
    updateOne: jest.fn(async () => ({})),
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

import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import {
  createCheckoutSession,
  createPortalSession,
  handlePaddleEvent,
} from '@/services/billing.service';
import { isPaddleConfigured } from '@/lib/paddle';
import type { NormalizedEvent } from '@/lib/billing/providers/types';

const mockSubFindOne = Subscription.findOne as jest.Mock;
const mockResCreate = CheckoutReservation.create as jest.Mock;
const mockResFindOne = CheckoutReservation.findOne as jest.Mock;
const mockResFindById = CheckoutReservation.findById as jest.Mock;
const mockResUpdateOne = CheckoutReservation.updateOne as jest.Mock;
const mockWsFindById = Workspace.findById as jest.Mock;
const mockWsUpdateOne = Workspace.updateOne as jest.Mock;
const mockUserFindById = User.findById as jest.Mock;
const mockUserUpdateOne = User.updateOne as jest.Mock;

const USER_ID = '64b000000000000000000001';
const WS_ID = '64b0000000000000000000aa';
const OCCURRED = new Date('2026-11-20T10:00:00.000Z');

function leanChain(value: unknown) {
  return {
    lean: jest.fn(async () => value),
    sort: jest.fn(() => ({
      lean: jest.fn(async () => value),
      select: jest.fn(() => leanChain(value)),
    })),
    select: jest.fn(() => leanChain(value)),
  };
}

function selectLean(value: unknown) {
  return leanChain(value);
}

function reservationDoc(overrides: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    _id: 'res_1',
    user: USER_ID,
    workspace: null,
    plan: 'PRO',
    interval: 'month',
    status: 'pending',
    provider: 'paddle',
    paddlePriceId: 'pri_pro_monthly_test',
    expiresAt: new Date(Date.now() + 3600_000),
    createdAt: new Date(),
    ...overrides,
  };
  doc.toObject = jest.fn(() => ({ ...doc }));
  return doc;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PADDLE_PRICE_PRO_MONTHLY = 'pri_pro_monthly_test';
  process.env.PADDLE_PRICE_PRO_YEARLY = 'pri_pro_yearly_test';
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly_test';
  process.env.PADDLE_API_KEY = 'pdl_test';

  // No existing subscription by default.
  mockSubFindOne.mockReturnValue(selectLean(null));
  // New reservation created successfully by default.
  mockResCreate.mockImplementation(async (doc: Record<string, unknown>) =>
    reservationDoc(doc),
  );
  mockResFindOne.mockReturnValue(leanChain(null));
  mockResFindById.mockReturnValue(leanChain(null));
  // User has no paddle customer yet.
  mockUserFindById.mockReturnValue(selectLean({ paddleCustomerId: null }));
  mockPaddleCustomerCreate.mockResolvedValue({ id: 'ctm_new_1' });
  mockRetrieveSubscription.mockResolvedValue(null);
  mockRetrieveCustomer.mockResolvedValue(null);
});

describe('createCheckoutSession — provider=paddle', () => {
  const base = {
    userId: USER_ID,
    userEmail: 'user@test.com',
    plan: 'PRO',
    interval: 'month',
    provider: 'paddle' as const,
  };

  it('returns Paddle checkout config with server-resolved price + reservation', async () => {
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(true);
    if (!result.ok || !('paddleCheckout' in result.data)) throw new Error('bad');

    const cfg = result.data.paddleCheckout;
    expect(cfg.provider).toBe('paddle');
    expect(cfg.priceId).toBe('pri_pro_monthly_test');
    expect(cfg.customerId).toBe('ctm_new_1');
    expect(cfg.customData.userId).toBe(USER_ID);
    expect(cfg.customData.plan).toBe('PRO');
    expect(cfg.customData.interval).toBe('month');
    expect(cfg.customData.checkoutReservationId).toBeTruthy();

    // Reservation created as provider=paddle with the server price.
    expect(mockResCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'paddle',
        paddlePriceId: 'pri_pro_monthly_test',
        status: 'pending',
      }),
    );
  });

  it('yearly interval resolves the yearly Paddle price', async () => {
    const result = await createCheckoutSession({ ...base, interval: 'year' });
    expect(result.ok).toBe(true);
    if (!result.ok || !('paddleCheckout' in result.data)) throw new Error('bad');
    expect(result.data.paddleCheckout.priceId).toBe('pri_pro_yearly_test');
    expect(mockResCreate).toHaveBeenCalledWith(
      expect.objectContaining({ paddlePriceId: 'pri_pro_yearly_test' }),
    );
  });

  it('TEAM has no Paddle price → rejected, no reservation', async () => {
    const result = await createCheckoutSession({ ...base, plan: 'TEAM' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('bad');
    expect(result.status).toBe(400);
    expect(mockResCreate).not.toHaveBeenCalled();
  });

  it('missing Paddle config → 503 before any reservation', async () => {
    const { isPaddleConfigured } = jest.requireMock('@/lib/paddle');
    isPaddleConfigured.mockReturnValueOnce(false);
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('bad');
    expect(result.status).toBe(503);
    expect(mockResCreate).not.toHaveBeenCalled();
  });

  it('rejects checkout for a workspace the user does not own', async () => {
    mockWsFindById.mockReturnValue(
      selectLean({ owner: '64b0000000000000000000ff' }),
    );
    const result = await createCheckoutSession({
      ...base,
      workspaceId: WS_ID,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('bad');
    expect(result.status).toBe(403);
    expect(mockResCreate).not.toHaveBeenCalled();
  });

  it('rejects when an entitled subscription already exists in scope', async () => {
    mockSubFindOne.mockReturnValue(
      selectLean({ status: 'active', createdAt: new Date() }),
    );
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('bad');
    expect(result.status).toBe(409);
    expect(mockResCreate).not.toHaveBeenCalled();
  });

  it('reuses an existing paddleCustomerId — no duplicate customer', async () => {
    mockUserFindById.mockReturnValue(
      selectLean({ paddleCustomerId: 'ctm_existing' }),
    );
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(true);
    if (!result.ok || !('paddleCheckout' in result.data)) throw new Error('bad');
    expect(result.data.paddleCheckout.customerId).toBe('ctm_existing');
    expect(mockPaddleCustomerCreate).not.toHaveBeenCalled();
  });

  it('creates a Paddle customer with server-side customData attribution', async () => {
    await createCheckoutSession(base);
    expect(mockPaddleCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@test.com',
        customData: expect.objectContaining({ userId: USER_ID }),
      }),
    );
    // Persisted conditionally — concurrent creates cannot overwrite.
    expect(mockUserUpdateOne).toHaveBeenCalledWith(
      { _id: USER_ID, paddleCustomerId: { $exists: false } },
      { $set: { paddleCustomerId: 'ctm_new_1' } },
    );
  });

  it('workspace checkout creates a workspace-scoped Paddle customer', async () => {
    mockWsFindById
      .mockReturnValueOnce(selectLean({ owner: USER_ID })) // ownership check
      .mockReturnValue(selectLean({ paddleCustomerId: null })); // customer lookup
    const result = await createCheckoutSession({
      ...base,
      workspaceId: WS_ID,
    });
    expect(result.ok).toBe(true);
    expect(mockPaddleCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customData: expect.objectContaining({
          userId: USER_ID,
          workspaceId: WS_ID,
        }),
      }),
    );
    expect(mockWsUpdateOne).toHaveBeenCalledWith(
      { _id: WS_ID, paddleCustomerId: { $exists: false } },
      { $set: { paddleCustomerId: 'ctm_new_1' } },
    );
  });

  it('reuses a pending paddle reservation for the same plan (retry-safe)', async () => {
    // First create hits E11000 → pending paddle reservation found.
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        reservationDoc({ _id: 'res_existing', provider: 'paddle' }),
      ),
    );
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(true);
    if (!result.ok || !('paddleCheckout' in result.data)) throw new Error('bad');
    expect(result.data.paddleCheckout.reservationId).toBe('res_existing');
    expect(result.data.paddleCheckout.priceId).toBe('pri_pro_monthly_test');
  });

  it('409 when a paddle transaction is already linked (payment in flight)', async () => {
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        reservationDoc({
          provider: 'paddle',
          paddleTransactionId: 'txn_inflight',
        }),
      ),
    );
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('bad');
    expect(result.status).toBe(409);
  });

  it('409 when a Stripe reservation holds the scope lock', async () => {
    mockResCreate.mockRejectedValueOnce({ code: 11000 });
    mockResFindOne.mockReturnValue(
      leanChain(
        reservationDoc({ provider: 'stripe', stripeCheckoutSessionId: 'cs_1' }),
      ),
    );
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('bad');
    expect(result.status).toBe(409);
  });

  it('different plan on pending paddle reservation → released, fresh lock', async () => {
    mockResCreate
      .mockRejectedValueOnce({ code: 11000 })
      .mockImplementationOnce(async (doc: Record<string, unknown>) =>
        reservationDoc({ ...doc, _id: 'res_new' }),
      );
    mockResFindOne.mockReturnValue(
      leanChain(reservationDoc({ plan: 'TEAM', interval: 'year' })),
    );
    const result = await createCheckoutSession(base);
    expect(result.ok).toBe(true);
    // Old lock released.
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_1' },
      { $set: { status: 'released' } },
    );
  });

  it('customer creation failure releases the reservation', async () => {
    mockPaddleCustomerCreate.mockRejectedValue(new Error('paddle api down'));
    await expect(createCheckoutSession(base)).rejects.toThrow('paddle api down');
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_1', status: 'pending' },
      { $set: { status: 'released' } },
    );
  });
});

describe('createCheckoutSession — stripe regression', () => {
  it('default provider is stripe — unchanged behavior', async () => {
    const stripe = (await import('@/lib/stripe')).default;
    (stripe.customers.create as jest.Mock).mockResolvedValue({ id: 'cus_1' });
    (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/x',
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    });
    // ensureBillingCustomer re-reads the user after persisting.
    mockUserFindById
      .mockReturnValueOnce(selectLean({ stripeCustomerId: null }))
      .mockReturnValue(selectLean({ stripeCustomerId: 'cus_1' }));
    const result = await createCheckoutSession({
      userId: USER_ID,
      userEmail: 'user@test.com',
      plan: 'PRO',
      interval: 'month',
    });
    expect(result.ok).toBe(true);
    if (!result.ok || 'paddleCheckout' in result.data) throw new Error('bad');
    expect(result.data.url).toBe('https://checkout.stripe.com/x');
    // Stripe reservation carries provider:'stripe'.
    expect(mockResCreate).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'stripe' }),
    );
  });
});

describe('checkout ↔ webhook correlation', () => {
  function paddleSubEntity() {
    return {
      id: 'sub_paddle_123',
      status: 'active',
      customerId: 'ctm_new_1',
      currentBillingPeriod: {
        startsAt: '2026-11-20T09:00:00.000Z',
        endsAt: '2026-12-20T09:00:00.000Z',
      },
      scheduledChange: null,
      canceledAt: null,
      items: [
        {
          status: 'active',
          quantity: 1,
          recurring: true,
          price: { id: 'pri_pro_monthly_test' },
          product: { id: 'pro_test' },
          trialDates: null,
        },
      ],
      customData: {},
    };
  }

  it('transaction.completed stamps paddleTransactionId and completes reservation', async () => {
    mockRetrieveSubscription.mockResolvedValue(paddleSubEntity());
    // Reservation lookup by checkoutReservationId returns owner —
    // must be a live paddle reservation to be trusted.
    mockResFindOne.mockReturnValue(
      leanChain({
        user: USER_ID,
        workspace: null,
        provider: 'paddle',
        status: 'pending',
      }),
    );

    const event: NormalizedEvent = {
      provider: 'paddle',
      providerEventId: 'evt-txn-1',
      eventType: 'transaction.completed',
      occurredAt: OCCURRED,
      data: {
        id: 'txn_1',
        subscriptionId: 'sub_paddle_123',
        customData: { checkoutReservationId: 'res_1' },
      },
    };

    const BillingEvent = (await import('@/models/BillingEvent')).default;
    (BillingEvent.create as jest.Mock).mockResolvedValue({});

    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');

    // Reservation stamped with the transaction ID — paddle-scoped.
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_1', provider: 'paddle', status: 'pending' },
      { $set: { paddleTransactionId: 'txn_1' } },
    );
    // …and completed once the entitled subscription synced.
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_1', provider: 'paddle', status: 'pending' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });
});

describe('createPortalSession — paddle provider', () => {
  it('creates a Paddle portal session scoped to the subscription', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({
        provider: 'paddle',
        providerCustomerId: 'ctm_abc',
        providerSubscriptionId: 'sub_paddle_1',
        stripeCustomerId: 'ctm_abc', // legacy slot also populated
      }),
    );
    mockPaddlePortalCreate.mockResolvedValue({
      urls: { general: { overview: 'https://portal.paddle.com/x' } },
    });

    const res = await createPortalSession({ userId: USER_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.url).toBe('https://portal.paddle.com/x');
    expect(res.data.provider).toBe('paddle');
    // ctm_ ID goes to Paddle — never to Stripe.
    expect(mockPaddlePortalCreate).toHaveBeenCalledWith('ctm_abc', [
      'sub_paddle_1',
    ]);
  });

  it('falls back to the scope paddleCustomerId when sub lacks one', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({ provider: 'paddle', providerSubscriptionId: 'sub_p1' }),
    );
    mockUserFindById.mockReturnValue(selectLean({ paddleCustomerId: 'ctm_fb' }));
    mockPaddlePortalCreate.mockResolvedValue({
      urls: { general: { overview: 'https://portal.paddle.com/y' } },
    });

    const res = await createPortalSession({ userId: USER_ID });
    expect(res.ok).toBe(true);
    expect(mockPaddlePortalCreate).toHaveBeenCalledWith('ctm_fb', ['sub_p1']);
  });

  it('returns 404 when no Paddle customer exists', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({ provider: 'paddle', providerSubscriptionId: 'sub_p1' }),
    );
    mockUserFindById.mockReturnValue(selectLean({ paddleCustomerId: null }));
    const res = await createPortalSession({ userId: USER_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
    expect(mockPaddlePortalCreate).not.toHaveBeenCalled();
  });

  it('returns 503 when Paddle is not configured', async () => {
    (isPaddleConfigured as jest.Mock).mockReturnValueOnce(false);
    mockSubFindOne.mockReturnValue(
      leanChain({ provider: 'paddle', providerCustomerId: 'ctm_abc' }),
    );
    const res = await createPortalSession({ userId: USER_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(503);
  });

  it('returns 502 when Paddle returns no portal URL', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({ provider: 'paddle', providerCustomerId: 'ctm_abc' }),
    );
    mockPaddlePortalCreate.mockResolvedValue({ urls: { general: {} } });
    const res = await createPortalSession({ userId: USER_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(502);
  });

  it('legacy subscription without provider uses the Stripe portal', async () => {
    mockSubFindOne.mockReturnValue(
      leanChain({ stripeCustomerId: 'cus_legacy' }),
    );
    const stripe = (await import('@/lib/stripe')).default;
    (stripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
      url: 'https://billing.stripe.com/legacy',
    });
    const res = await createPortalSession({ userId: USER_ID });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.provider).toBe('stripe');
    expect(res.data.url).toBe('https://billing.stripe.com/legacy');
    expect(mockPaddlePortalCreate).not.toHaveBeenCalled();
  });
});

describe('createPortalSession — user isolation', () => {
  const USER_A = '64b0000000000000000000a1';
  const USER_B = '64b0000000000000000000b2';

  function subOwnedBy(owner: string) {
    return {
      provider: 'paddle',
      providerCustomerId: `ctm_${owner.slice(-2)}`,
      providerSubscriptionId: `sub_${owner.slice(-2)}`,
      user: owner,
    };
  }

  it('queries subscriptions scoped to the authenticated user only', async () => {
    mockPaddlePortalCreate.mockResolvedValue({
      urls: { general: { overview: 'https://portal.paddle.com/z' } },
    });
    mockSubFindOne.mockImplementation((filter: { user?: string }) =>
      leanChain(filter.user === USER_A ? subOwnedBy(USER_A) : null),
    );

    const resB = await createPortalSession({ userId: USER_B });
    expect(resB.ok).toBe(false);
    if (!resB.ok) expect(resB.status).toBe(404);
    expect(mockPaddlePortalCreate).not.toHaveBeenCalled();

    const resA = await createPortalSession({ userId: USER_A });
    expect(resA.ok).toBe(true);
    // Portal session is created for USER_A's customer only.
    expect(mockPaddlePortalCreate).toHaveBeenCalledWith('ctm_a1', ['sub_a1']);
    // The subscription lookup was scoped by user — never by a
    // client-supplied customer/subscription ID.
    expect(mockSubFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ user: USER_A, workspace: null }),
    );
  });

  it('workspace scope rejects non-owner before any portal call', async () => {
    mockWsFindById.mockReturnValue(
      selectLean({ owner: 'someone-else' }),
    );
    const res = await createPortalSession({
      userId: USER_B,
      workspaceId: WS_ID,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(mockSubFindOne).not.toHaveBeenCalled();
    expect(mockPaddlePortalCreate).not.toHaveBeenCalled();
  });
});
