// __tests__/unit/services/billing-lifecycle.test.ts
//
// Phase 6 verification pass: webhook reliability (claim release on
// failure, duplicate suppression, stale-event guard), event ordering,
// subscription lifecycle transitions, entitlement behavior, and
// workspace/user billing isolation.

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
    // Default: guarded update matches (document exists, event is newer).
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

import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import BillingEvent from '@/models/BillingEvent';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import stripe from '@/lib/stripe';
import {
  handleStripeEvent,
  getEffectivePlan,
  assertPlanLimit,
  createPortalSession,
  createCheckoutSession,
} from '@/services/billing.service';

const mockSubFindOne = Subscription.findOne as jest.Mock;
const mockSubUpdate = Subscription.updateOne as jest.Mock;
const mockEventCreate = BillingEvent.create as jest.Mock;
const mockEventDelete = BillingEvent.deleteOne as jest.Mock;
const mockWsFindById = Workspace.findById as jest.Mock;
const mockUserFindById = User.findById as jest.Mock;
const mockSubRetrieve = stripe.subscriptions.retrieve as jest.Mock;
const mockResUpdateOne = CheckoutReservation.updateOne as jest.Mock;
const mockResUpdateMany = CheckoutReservation.updateMany as jest.Mock;

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

function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_x',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
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
    ...overrides,
  };
}

function stripeEvent(
  id: string,
  type: string,
  object: Record<string, unknown>,
  created = 1700000000,
) {
  return { id, type, created, data: { object } };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_PRICE_PRO_MONTHLY = PRICE_PRO;
  process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly_test';
  process.env.STRIPE_PRICE_TEAM_MONTHLY = 'price_team_monthly_test';
  process.env.STRIPE_PRICE_TEAM_YEARLY = 'price_team_yearly_test';
  mockUserFindById.mockReturnValue(leanChain(null));
});

/* ================================================================== */
/* Webhook reliability                                                 */
/* ================================================================== */

describe('webhook reliability', () => {
  it('releases the idempotency claim when processing fails so Stripe can retry', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockSubUpdate.mockRejectedValueOnce(new Error('DB timeout'));

    const event = stripeEvent('evt_fail', 'customer.subscription.updated', stripeSubscription());
    await expect(handleStripeEvent(event as never)).rejects.toThrow('DB timeout');
    expect(mockEventDelete).toHaveBeenCalledWith({ stripeEventId: 'evt_fail' });
  });

  it('keeps the claim after successful processing — duplicates stay no-ops', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));

    const event = stripeEvent('evt_ok', 'customer.subscription.updated', stripeSubscription());
    expect(await handleStripeEvent(event as never)).toBe('processed');
    expect(mockEventDelete).not.toHaveBeenCalled();
  });

  it('concurrent duplicate deliveries: unique index suppresses the second', async () => {
    mockEventCreate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 11000 });
    mockSubFindOne.mockReturnValue(leanChain(null));

    const event = stripeEvent('evt_race', 'customer.subscription.updated', stripeSubscription());
    expect(await handleStripeEvent(event as never)).toBe('processed');
    expect(await handleStripeEvent(event as never)).toBe('duplicate');
  });

  it('out-of-order events cannot overwrite newer subscription state', async () => {
    /*
      Atomic stale-event guard: the lastStripeEventAt comparison lives
      inside the updateOne filter. Simulate the stored doc being newer
      → matchedCount 0 → 'stale', no write applied.
    */
    mockEventCreate.mockResolvedValue({});
    mockSubUpdate.mockResolvedValueOnce({
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
    });

    const stale = stripeEvent(
      'evt_stale',
      'customer.subscription.updated',
      stripeSubscription({ status: 'canceled' }),
      1700000000, // ~Nov 2023 — older than stored June 2026
    );
    const result = await handleStripeEvent(stale as never);
    expect(result).toBe('processed'); // event itself processed (ack), sync skipped as stale
    expect(mockSubUpdate).toHaveBeenCalledTimes(1);
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_x',
        $or: expect.arrayContaining([
          { lastStripeEventAt: { $lt: new Date(1700000000 * 1000) } },
        ]),
      }),
      expect.anything(),
      { upsert: true },
    );
  });

  it('concurrent webhook deliveries cannot regress state (guarded filter)', async () => {
    /*
      Two deliveries of the same subscription event race: both issue
      the guarded update, but MongoDB serializes them — the second
      sees lastStripeEventAt equal to its own event time. $lt (strict)
      makes the equal-timestamp write a no-op, so state cannot flip
      back and forth between deliveries.
    */
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));

    const evt = stripeEvent('evt_conc', 'customer.subscription.updated', stripeSubscription());
    // First delivery wins the write; second sees equal timestamp → stale.
    mockSubUpdate
      .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1, upsertedCount: 0 })
      .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0, upsertedCount: 0 });

    expect(await handleStripeEvent(evt as never)).toBe('processed');
    // Simulate a second DISTINCT event id for the same state change.
    mockEventCreate.mockResolvedValue({});
    const evt2 = stripeEvent('evt_conc2', 'customer.subscription.updated', stripeSubscription());
    expect(await handleStripeEvent(evt2 as never)).toBe('processed');
    expect(mockSubUpdate).toHaveBeenCalledTimes(2);
    // Both updates carried the atomic $or staleness guard.
    for (const call of mockSubUpdate.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { lastStripeEventAt: { $lt: new Date(1700000000 * 1000) } },
          ]),
        }),
      );
    }
  });
});

/* ================================================================== */
/* Event ordering                                                      */
/* ================================================================== */

describe('event ordering', () => {
  it('subscription.created before checkout.session.completed still syncs', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));

    expect(
      await handleStripeEvent(
        stripeEvent('evt_sub', 'customer.subscription.created', stripeSubscription({ id: 'sub_ord' })) as never,
      ),
    ).toBe('processed');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_ord' }),
      expect.objectContaining({ $set: expect.objectContaining({ plan: 'PRO' }) }),
      { upsert: true },
    );

    mockEventCreate.mockResolvedValue({});
    // checkout.session.completed now retrieves + syncs the subscription
    // authoritatively — idempotent upsert writes the same state again.
    mockSubRetrieve.mockResolvedValue(stripeSubscription({ id: 'sub_ord' }));
    expect(
      await handleStripeEvent(
        stripeEvent('evt_cs', 'checkout.session.completed', { id: 'cs_1', subscription: 'sub_ord' }, 1700000100) as never,
      ),
    ).toBe('processed');
    expect(mockSubRetrieve).toHaveBeenCalledWith('sub_ord');
    expect(mockSubUpdate).toHaveBeenCalledTimes(2); // sub.created + session sync
    expect(mockSubUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_ord' }),
      expect.objectContaining({ $set: expect.objectContaining({ plan: 'PRO' }) }),
      { upsert: true },
    );
  });

  it('checkout.session.completed activates Pro even if subscription.created never arrives', async () => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockSubRetrieve.mockResolvedValue(stripeSubscription({ id: 'sub_only_cs' }));

    const result = await handleStripeEvent(
      stripeEvent('evt_cs_only', 'checkout.session.completed', { id: 'cs_9', subscription: 'sub_only_cs' }) as never,
    );
    expect(result).toBe('processed');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_only_cs' }),
      expect.objectContaining({ $set: expect.objectContaining({ plan: 'PRO', status: 'active' }) }),
      { upsert: true },
    );
  });

  it('checkout.session.completed first does not block later subscription sync', async () => {
    mockEventCreate.mockResolvedValue({});
    expect(
      await handleStripeEvent(
        stripeEvent('evt_cs_first', 'checkout.session.completed', { id: 'cs_2' }) as never,
      ),
    ).toBe('processed');
    expect(mockSubUpdate).not.toHaveBeenCalled();

    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
    expect(
      await handleStripeEvent(
        stripeEvent('evt_sub_late', 'customer.subscription.created', stripeSubscription({ id: 'sub_late' }), 1700000050) as never,
      ),
    ).toBe('processed');
    expect(mockSubUpdate).toHaveBeenCalled();
  });

  it('duplicate checkout.session.completed deliveries are safe', async () => {
    mockEventCreate.mockResolvedValue({});
    const evt = stripeEvent('evt_cs_dup', 'checkout.session.completed', {});
    expect(await handleStripeEvent(evt as never)).toBe('processed');
    mockEventCreate.mockRejectedValueOnce({ code: 11000 });
    expect(await handleStripeEvent(evt as never)).toBe('duplicate');
  });
});

/* ================================================================== */
/* Subscription lifecycle                                              */
/* ================================================================== */

describe('subscription lifecycle', () => {
  beforeEach(() => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
  });

  it('new subscription → plan persisted', async () => {
    await handleStripeEvent(
      stripeEvent('evt_new', 'customer.subscription.created', stripeSubscription()) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ plan: 'PRO', status: 'active' }),
      }),
      { upsert: true },
    );
  });

  it('renewal (invoice.paid + subscription.updated) refreshes state', async () => {
    const renewed = stripeSubscription({
      items: {
        data: [
          {
            price: { id: PRICE_PRO },
            current_period_start: 1702592000,
            current_period_end: 1705184000,
          },
        ],
      },
    });
    await handleStripeEvent(
      stripeEvent('evt_ren', 'customer.subscription.updated', renewed) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          plan: 'PRO',
          currentPeriodEnd: new Date(1705184000 * 1000),
        }),
      }),
      { upsert: true },
    );
  });

  it('upgrade PRO→TEAM re-resolves plan from new price', async () => {
    const upgraded = stripeSubscription({
      items: {
        data: [
          {
            price: { id: 'price_team_monthly_test' },
            current_period_start: 1700000000,
            current_period_end: 1702592000,
          },
        ],
      },
    });
    await handleStripeEvent(
      stripeEvent('evt_up', 'customer.subscription.updated', upgraded) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ plan: 'TEAM', interval: 'month' }),
      }),
      { upsert: true },
    );
  });

  it('downgrade TEAM→PRO re-resolves plan from new price', async () => {
    await handleStripeEvent(
      stripeEvent('evt_down', 'customer.subscription.updated', stripeSubscription()) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ plan: 'PRO' }),
      }),
      { upsert: true },
    );
  });

  it('end-of-period cancellation keeps status active + cancelAtPeriodEnd', async () => {
    await handleStripeEvent(
      stripeEvent(
        'evt_eop',
        'customer.subscription.updated',
        stripeSubscription({ cancel_at_period_end: true }),
      ) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'active', cancelAtPeriodEnd: true }),
      }),
      { upsert: true },
    );
  });

  it('immediate cancellation syncs canceled status', async () => {
    await handleStripeEvent(
      stripeEvent(
        'evt_del',
        'customer.subscription.deleted',
        stripeSubscription({ status: 'canceled', canceled_at: 1700001000 }),
      ) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'canceled' }),
      }),
      { upsert: true },
    );
  });

  it('failed payment → past_due; recovery via invoice.paid → active', async () => {
    /*
      Invoice events no longer write status directly — they retrieve
      the authoritative subscription from Stripe and sync it. Mock the
      Stripe boundary: payment_failed sees past_due, invoice.paid sees
      active again.
    */
    mockSubRetrieve
      .mockResolvedValueOnce(stripeSubscription({ status: 'past_due' }))
      .mockResolvedValueOnce(stripeSubscription({ status: 'active' }));

    await handleStripeEvent(
      stripeEvent('evt_fpay', 'invoice.payment_failed', {
        parent: { subscription_details: { subscription: 'sub_x' } },
      }) as never,
    );
    expect(mockSubRetrieve).toHaveBeenCalledWith('sub_x');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'past_due' }) }),
      { upsert: true },
    );

    await handleStripeEvent(
      stripeEvent('evt_paid', 'invoice.paid', {
        parent: { subscription_details: { subscription: 'sub_x' } },
      }) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'active' }) }),
      { upsert: true },
    );
  });

  it('delayed invoice.paid after cancellation cannot resurrect Pro', async () => {
    /*
      D1 regression: Stripe's authoritative state is 'canceled' (the
      subscription.deleted webhook already landed). A late
      invoice.paid must sync canceled — never write active/past_due.
    */
    mockSubRetrieve.mockResolvedValue(
      stripeSubscription({ status: 'canceled', canceled_at: 1700001000 }),
    );
    await handleStripeEvent(
      stripeEvent('evt_late_paid', 'invoice.paid', {
        parent: { subscription_details: { subscription: 'sub_x' } },
      }) as never,
    );
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'canceled', entitled: false }),
      }),
      { upsert: true },
    );
    for (const call of mockSubUpdate.mock.calls) {
      const set = (call[1] as { $set?: Record<string, unknown> }).$set ?? {};
      expect(set.status).not.toBe('active');
      expect(set.status).not.toBe('past_due');
    }
  });

  it('delayed invoice.payment_failed after cancellation cannot resurrect Pro', async () => {
    mockSubRetrieve.mockResolvedValue(
      stripeSubscription({ status: 'canceled', canceled_at: 1700001000 }),
    );
    await handleStripeEvent(
      stripeEvent('evt_late_fail', 'invoice.payment_failed', {
        // Legacy top-level subscription reference.
        subscription: 'sub_x',
      }) as never,
    );
    expect(mockSubRetrieve).toHaveBeenCalledWith('sub_x');
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSubscriptionId: 'sub_x' }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'canceled', entitled: false }),
      }),
      { upsert: true },
    );
  });
});

/* ================================================================== */
/* Entitlements                                                        */
/* ================================================================== */

describe('entitlement behavior', () => {
  it('entitled statuses (active/trialing/past_due) grant the plan', async () => {
    mockSubFindOne.mockReturnValue(leanChain({ plan: 'PRO' }));
    expect(await getEffectivePlan('user-1')).toBe('PRO');
  });

  it('no entitled subscription → FREE (expired/canceled/unpaid)', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    expect(await getEffectivePlan('user-1')).toBe('FREE');
  });

  it('plan limits revert to FREE caps after expiration', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    const res = await assertPlanLimit({
      userId: 'user-1',
      resource: 'projects',
      currentCount: 3,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('Free');
  });
});

/* ================================================================== */
/* Authorization and isolation                                          */
/* ================================================================== */

describe('authorization and isolation', () => {
  it('workspace A and workspace B resolve independently', async () => {
    mockSubFindOne
      .mockReturnValueOnce(leanChain({ plan: 'TEAM' }))
      .mockReturnValue(leanChain(null));
    expect(await getEffectivePlan('user-1', 'ws-A')).toBe('TEAM');

    mockSubFindOne.mockReset();
    mockSubFindOne.mockReturnValue(leanChain(null));
    expect(await getEffectivePlan('user-1', 'ws-B')).toBe('FREE');
  });

  it('workspace subscription takes precedence over user-level plan', async () => {
    mockSubFindOne.mockReturnValueOnce(leanChain({ plan: 'PRO' }));
    expect(await getEffectivePlan('user-1', 'ws-1')).toBe('PRO');
    expect(mockSubFindOne).toHaveBeenCalledTimes(1); // user fallback not queried
  });

  it('user-level plan applies when workspace has no subscription', async () => {
    mockSubFindOne
      .mockReturnValueOnce(leanChain(null))
      .mockReturnValueOnce(leanChain({ plan: 'TEAM' }));
    expect(await getEffectivePlan('user-1', 'ws-1')).toBe('TEAM');
  });

  it('portal rejects non-owner workspace access', async () => {
    mockSubFindOne.mockReturnValue(leanChain(null));
    mockWsFindById.mockReturnValue(leanChain({ owner: 'other-user' }));
    const res = await createPortalSession({ userId: 'user-1', workspaceId: 'ws-1' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it('checkout rejects non-owner workspace billing', async () => {
    mockWsFindById.mockReturnValue(leanChain({ owner: 'other-user' }));
    const res = await createCheckoutSession({
      userId: 'user-1',
      userEmail: 'u@test.com',
      plan: 'PRO',
      interval: 'month',
      workspaceId: 'ws-1',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });
});

/* ================================================================== */
/* Checkout reservation reconciliation                                  */
/* ================================================================== */

describe('checkout reservation lifecycle', () => {
  beforeEach(() => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
  });

  it('checkout.session.completed marks the reservation completed', async () => {
    mockSubRetrieve.mockResolvedValue(stripeSubscription({ id: 'sub_r' }));
    await handleStripeEvent(
      stripeEvent('evt_cs_res', 'checkout.session.completed', {
        id: 'cs_1',
        subscription: 'sub_r',
        metadata: { checkoutReservationId: 'res_9' },
      }) as never,
    );
    // Completed by Stripe session ID and by metadata reservation ID.
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { stripeCheckoutSessionId: 'cs_1', status: 'pending' },
      { $set: { status: 'completed' } },
    );
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_9', status: 'pending' },
      { $set: { status: 'completed' } },
    );
  });

  it('entitled subscription sync completes pending reservations for the scope', async () => {
    await handleStripeEvent(
      stripeEvent('evt_sub_res', 'customer.subscription.created', stripeSubscription({ id: 'sub_sc' })) as never,
    );
    expect(mockResUpdateMany).toHaveBeenCalledWith(
      { user: 'user-1', workspace: null, status: 'pending' },
      { $set: { status: 'completed' } },
    );
  });

  it('non-entitled subscription sync does NOT complete reservations', async () => {
    await handleStripeEvent(
      stripeEvent('evt_sub_cx', 'customer.subscription.deleted', stripeSubscription({ id: 'sub_cx', status: 'canceled' })) as never,
    );
    expect(mockResUpdateMany).not.toHaveBeenCalled();
    expect(mockResUpdateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      { $set: { status: 'completed' } },
    );
  });

  it('checkout.session.expired releases the pending reservation', async () => {
    await handleStripeEvent(
      stripeEvent('evt_cs_exp', 'checkout.session.expired', { id: 'cs_dead' }) as never,
    );
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { stripeCheckoutSessionId: 'cs_dead', status: 'pending' },
      { $set: { status: 'expired' } },
    );
  });

  it('reservation never activates PRO — only Subscription docs grant plans', async () => {
    // A pending reservation alone must not affect getEffectivePlan.
    mockSubFindOne.mockReturnValue(leanChain(null));
    expect(await getEffectivePlan('user-1')).toBe('FREE');
    // And no Subscription write happens for reservation events.
    mockEventCreate.mockResolvedValue({});
    await handleStripeEvent(
      stripeEvent('evt_cs_exp2', 'checkout.session.expired', { id: 'cs_x' }) as never,
    );
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });
});

/* ================================================================== */
/* Unmapped paid-subscription alerting (P6.3.1-C)                      */
/* ================================================================== */

describe('unmapped paid subscription handling', () => {
  const loggerMock = jest.requireMock('@/lib/logger').default as {
    error: jest.Mock;
    warn: jest.Mock;
  };

  beforeEach(() => {
    mockEventCreate.mockResolvedValue({});
    mockSubFindOne.mockReturnValue(leanChain(null));
  });

  it('paid checkout with unmapped price → critical alert, no PRO, reservation NOT closed', async () => {
    mockSubRetrieve.mockResolvedValue(
      stripeSubscription({
        id: 'sub_unmapped',
        items: { data: [{ price: { id: 'price_not_in_catalog' } }] },
      }),
    );
    const result = await handleStripeEvent(
      stripeEvent('evt_unmapped', 'checkout.session.completed', {
        id: 'cs_unmapped',
        subscription: 'sub_unmapped',
        metadata: { checkoutReservationId: 'res_u' },
      }) as never,
    );
    expect(result).toBe('processed'); // acked — no infinite Stripe retry on config error
    // Critical alert fired with reconciliation context (no secrets).
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: 'sub_unmapped',
        priceId: 'price_not_in_catalog',
        userId: 'user-1',
      }),
      expect.stringContaining('CRITICAL'),
    );
    // No subscription write — no PRO granted.
    expect(mockSubUpdate).not.toHaveBeenCalled();
    // Reservation NOT marked completed — stays pending for recovery.
    expect(mockResUpdateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      { $set: { status: 'completed' } },
    );
  });

  it('recovery after price config fix: resend maps plan and completes reservation', async () => {
    // Simulate the corrected env: the previously-unknown price now
    // maps to TEAM monthly.
    process.env.STRIPE_PRICE_TEAM_MONTHLY = 'price_now_mapped';
    try {
      await handleStripeEvent(
        stripeEvent('evt_fixed', 'customer.subscription.updated',
          stripeSubscription({
            id: 'sub_unmapped',
            items: { data: [{ price: { id: 'price_now_mapped' }, current_period_end: 1702592000 }] },
          })) as never,
      );
      expect(mockSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripeSubscriptionId: 'sub_unmapped' }),
        expect.objectContaining({
          $set: expect.objectContaining({ plan: 'TEAM', status: 'active' }),
        }),
        { upsert: true },
      );
      // Pending reservation for the scope auto-completed by the sync.
      expect(mockResUpdateMany).toHaveBeenCalledWith(
        { user: 'user-1', workspace: null, status: 'pending' },
        { $set: { status: 'completed' } },
      );
    } finally {
      process.env.STRIPE_PRICE_TEAM_MONTHLY = 'price_team_monthly_test';
    }
  });

  it('duplicate webhook delivery during recovery is a safe no-op', async () => {
    mockEventCreate.mockRejectedValueOnce({ code: 11000 });
    const result = await handleStripeEvent(
      stripeEvent('evt_fixed', 'customer.subscription.updated',
        stripeSubscription({ id: 'sub_unmapped' })) as never,
    );
    expect(result).toBe('duplicate');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });
});
