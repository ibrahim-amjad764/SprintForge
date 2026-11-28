// __tests__/unit/services/billing-paddle.test.ts
//
// P7.4 — Paddle webhook processing, subscription normalization,
// provider-aware idempotency, stale-event protection, and
// authoritative-state rules. Paddle SDK and DB are mocked at the
// same boundaries as the Stripe lifecycle suite.

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
  default: { findById: jest.fn(), updateOne: jest.fn(async () => ({})) },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: { findById: jest.fn(), updateOne: jest.fn(async () => ({})) },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import BillingEvent from '@/models/BillingEvent';
import logger from '@/lib/logger';
import {
  getEffectivePlan,
  handlePaddleEvent,
  syncSubscriptionFromPaddle,
} from '@/services/billing.service';
import { normalizePaddleSubscription } from '@/lib/billing/providers/paddle';
import type { NormalizedEvent } from '@/lib/billing/providers/types';

const mockSubUpdate = Subscription.updateOne as jest.Mock;
const mockSubFindOne = Subscription.findOne as jest.Mock;
const mockEventCreate = BillingEvent.create as jest.Mock;
const mockEventDelete = BillingEvent.deleteOne as jest.Mock;
const mockEventUpdate = BillingEvent.updateOne as jest.Mock;
const mockResFindOne = CheckoutReservation.findOne as jest.Mock;
const mockResFindById = CheckoutReservation.findById as jest.Mock;
const mockResUpdateOne = CheckoutReservation.updateOne as jest.Mock;

const USER_ID = '64b000000000000000000001';
const WS_ID = '64b0000000000000000000aa';
const OCCURRED = new Date('2026-11-20T10:00:00.000Z');

function paddleSubscriptionEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_paddle_123',
    status: 'active',
    customerId: 'ctm_123',
    currencyCode: 'USD',
    createdAt: '2026-11-20T09:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    startedAt: '2026-11-20T09:00:00.000Z',
    nextBilledAt: '2026-12-20T09:00:00.000Z',
    canceledAt: null,
    pausedAt: null,
    currentBillingPeriod: {
      startsAt: '2026-11-20T09:00:00.000Z',
      endsAt: '2026-12-20T09:00:00.000Z',
    },
    billingCycle: { interval: 'month', frequency: 1 },
    scheduledChange: null,
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
    customData: { userId: USER_ID },
    ...overrides,
  };
}

function normalizedEvent(
  eventType: string,
  data: unknown,
  overrides: Partial<NormalizedEvent> = {},
): NormalizedEvent {
  return {
    provider: 'paddle',
    providerEventId: `evt-${Math.random().toString(36).slice(2)}`,
    eventType,
    occurredAt: OCCURRED,
    data,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PADDLE_PRICE_PRO_MONTHLY = 'pri_pro_monthly_test';
  process.env.PADDLE_PRICE_PRO_YEARLY = 'pri_pro_yearly_test';
  mockSubUpdate.mockResolvedValue({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  });
  mockEventCreate.mockResolvedValue({});
  mockRetrieveSubscription.mockResolvedValue(null);
  mockRetrieveCustomer.mockResolvedValue(null);
  // Default: no reservation, no customer customData — owner falls to
  // subscription customData (advisory path).
  mockResFindOne.mockReturnValue({ lean: jest.fn(async () => null) });
  mockResFindById.mockReturnValue({ lean: jest.fn(async () => null) });
});

/*
  Simulates the reservation ownership query: the service filters on
  {_id, provider:'paddle', status:{$in:['pending','completed']}} —
  honor that filter so tests exercise real accept/reject behavior.
*/
function reservationLookup(doc: Record<string, unknown> | null) {
  mockResFindOne.mockImplementation((filter: Record<string, unknown>) => ({
    lean: jest.fn(async () => {
      if (!doc) return null;
      if (filter._id !== doc._id) return null;
      if (filter.provider !== undefined && doc.provider !== filter.provider)
        return null;
      const allowed = (filter.status as { $in?: string[] })?.$in ?? [];
      if (!allowed.includes(String(doc.status))) return null;
      return doc;
    }),
  }));
}

describe('normalizePaddleSubscription', () => {
  it('maps price ID → plan/interval via the Paddle catalog', () => {
    const n = normalizePaddleSubscription(
      paddleSubscriptionEntity() as never,
      OCCURRED,
    );
    expect(n.provider).toBe('paddle');
    expect(n.providerSubscriptionId).toBe('sub_paddle_123');
    expect(n.providerCustomerId).toBe('ctm_123');
    expect(n.plan).toBe('PRO');
    expect(n.interval).toBe('month');
    expect(n.status).toBe('active');
    expect(n.currentPeriodEnd).toEqual(new Date('2026-12-20T09:00:00.000Z'));
    expect(n.cancelAtPeriodEnd).toBe(false);
    expect(n.occurredAt).toBe(OCCURRED);
  });

  it('maps yearly price to PRO/year', () => {
    const entity = paddleSubscriptionEntity({
      items: [
        {
          status: 'active',
          quantity: 1,
          recurring: true,
          price: { id: 'pri_pro_yearly_test' },
          product: { id: 'pro_test' },
          trialDates: null,
        },
      ],
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    expect(n.plan).toBe('PRO');
    expect(n.interval).toBe('year');
  });

  it('returns null plan for unmapped price IDs', () => {
    const entity = paddleSubscriptionEntity({
      items: [
        {
          status: 'active',
          quantity: 1,
          recurring: true,
          price: {
            id: 'pri_unknown',
            billingCycle: { interval: 'month', frequency: 1 },
          },
          product: { id: 'x' },
          trialDates: null,
        },
      ],
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    expect(n.plan).toBeNull();
    // Interval falls back to the price billing cycle for diagnostics.
    expect(n.interval).toBe('month');
  });

  it('derives cancelAtPeriodEnd from scheduledChange.action', () => {
    const entity = paddleSubscriptionEntity({
      scheduledChange: { action: 'cancel', effectiveAt: '2026-12-20T09:00:00.000Z', resumeAt: null },
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    expect(n.cancelAtPeriodEnd).toBe(true);
  });

  it('reads trial end from item trialDates', () => {
    const entity = paddleSubscriptionEntity({
      status: 'trialing',
      items: [
        {
          status: 'active',
          quantity: 1,
          recurring: true,
          price: { id: 'pri_pro_monthly_test' },
          product: { id: 'pro_test' },
          trialDates: { startsAt: '2026-11-20T09:00:00.000Z', endsAt: '2026-12-04T09:00:00.000Z' },
        },
      ],
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    expect(n.status).toBe('trialing');
    expect(n.trialEnd).toEqual(new Date('2026-12-04T09:00:00.000Z'));
  });
});

describe('syncSubscriptionFromPaddle', () => {
  function normalized(overrides: Record<string, unknown> = {}) {
    return normalizePaddleSubscription(
      paddleSubscriptionEntity(overrides) as never,
      OCCURRED,
    );
  }

  it('upserts an entitled Paddle subscription with provider fields', async () => {
    const result = await syncSubscriptionFromPaddle(normalized());
    expect(result).toBe('synced');

    const [filter, update] = mockSubUpdate.mock.calls[0];
    expect(filter.provider).toBe('paddle');
    expect(filter.providerSubscriptionId).toBe('sub_paddle_123');
    // Atomic stale guard on lastProviderEventAt.
    expect(filter.$or).toEqual([
      { lastProviderEventAt: { $lt: OCCURRED } },
      { lastProviderEventAt: { $exists: false } },
    ]);

    const set = update.$set;
    expect(set.provider).toBe('paddle');
    expect(set.providerSubscriptionId).toBe('sub_paddle_123');
    expect(set.providerCustomerId).toBe('ctm_123');
    // Legacy unique slot carries the provider-native sub ID.
    expect(set.stripeSubscriptionId).toBe('sub_paddle_123');
    expect(set.plan).toBe('PRO');
    expect(set.interval).toBe('month');
    expect(set.status).toBe('active');
    expect(set.entitled).toBe(true);
    expect(set.user).toBe(USER_ID);
    expect(set.lastProviderEventAt).toBe(OCCURRED);
  });

  it('does not grant entitled when active lacks a period end', async () => {
    const entity = paddleSubscriptionEntity({ currentBillingPeriod: null });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    await syncSubscriptionFromPaddle(n);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.entitled).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('canceled status syncs as non-entitled', async () => {
    const entity = paddleSubscriptionEntity({
      status: 'canceled',
      canceledAt: '2026-11-25T00:00:00.000Z',
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    await syncSubscriptionFromPaddle(n);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.status).toBe('canceled');
    expect(set.entitled).toBe(false);
    expect(set.canceledAt).toEqual(new Date('2026-11-25T00:00:00.000Z'));
  });

  it('past_due keeps entitlement during dunning', async () => {
    const entity = paddleSubscriptionEntity({ status: 'past_due' });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    await syncSubscriptionFromPaddle(n);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.status).toBe('past_due');
    expect(set.entitled).toBe(true);
  });

  it('paused does not grant entitlement', async () => {
    const entity = paddleSubscriptionEntity({ status: 'paused' });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    await syncSubscriptionFromPaddle(n);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.entitled).toBe(false);
  });

  it('unmapped price with resolvable owner → CRITICAL alert, no PRO', async () => {
    const entity = paddleSubscriptionEntity({
      items: [
        {
          status: 'active',
          quantity: 1,
          recurring: true,
          price: { id: 'pri_unknown' },
          product: { id: 'x' },
          trialDates: null,
        },
      ],
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('unmapped');
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'paddle' }),
      expect.stringContaining('CRITICAL'),
    );
  });

  it('missing owner link → skipped without entitlement', async () => {
    const entity = paddleSubscriptionEntity({ customData: {} });
    mockRetrieveCustomer.mockResolvedValue({ customData: null });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('unmapped');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('owner resolved from server-side reservation customData', async () => {
    reservationLookup({
      _id: 'res_123',
      user: USER_ID,
      workspace: WS_ID,
      provider: 'paddle',
      status: 'pending',
    });
    const entity = paddleSubscriptionEntity({
      customData: { checkoutReservationId: 'res_123' },
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('synced');
    expect(mockResFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'res_123',
        provider: 'paddle',
        status: { $in: ['pending', 'completed'] },
      }),
    );
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.user).toBe(USER_ID);
    expect(set.workspace).toBe(WS_ID);
    // Entitled sync completes the reservation — provider-scoped.
    expect(mockResUpdateOne).toHaveBeenCalledWith(
      { _id: 'res_123', provider: 'paddle', status: 'pending' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('completed paddle reservation still resolves owner (webhook retry)', async () => {
    reservationLookup({
      _id: 'res_done',
      user: USER_ID,
      workspace: null,
      provider: 'paddle',
      status: 'completed',
    });
    const entity = paddleSubscriptionEntity({
      customData: { checkoutReservationId: 'res_done' },
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('synced');
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.user).toBe(USER_ID);
  });

  it('stripe-provider reservation is rejected for paddle attribution', async () => {
    reservationLookup({
      _id: 'res_stripe',
      user: USER_ID,
      workspace: null,
      provider: 'stripe',
      status: 'pending',
    });
    // No other owner source — subscription must be skipped.
    mockRetrieveCustomer.mockResolvedValue({ customData: null });
    const entity = paddleSubscriptionEntity({
      customData: { checkoutReservationId: 'res_stripe' },
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('unmapped');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('released/expired paddle reservation is rejected', async () => {
    for (const status of ['released', 'expired']) {
      jest.clearAllMocks();
      mockSubUpdate.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
      });
      reservationLookup({
        _id: 'res_dead',
        user: USER_ID,
        workspace: null,
        provider: 'paddle',
        status,
      });
      mockRetrieveCustomer.mockResolvedValue({ customData: null });
      const entity = paddleSubscriptionEntity({
        customData: { checkoutReservationId: 'res_dead' },
      });
      const n = normalizePaddleSubscription(entity as never, OCCURRED);
      const result = await syncSubscriptionFromPaddle(n);
      expect(result).toBe('unmapped');
    }
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('missing reservation falls back to customer customData', async () => {
    reservationLookup(null);
    mockRetrieveCustomer.mockResolvedValue({
      customData: { userId: USER_ID, workspaceId: WS_ID },
    });
    const entity = paddleSubscriptionEntity({
      customData: { checkoutReservationId: 'res_missing' },
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('synced');
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.user).toBe(USER_ID);
  });

  it('owner resolved from Paddle customer customData (server-written)', async () => {
    mockRetrieveCustomer.mockResolvedValue({
      customData: { userId: USER_ID, workspaceId: WS_ID },
    });
    const entity = paddleSubscriptionEntity({ customData: {} });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('synced');
    expect(mockRetrieveCustomer).toHaveBeenCalledWith('ctm_123');
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.user).toBe(USER_ID);
    expect(set.workspace).toBe(WS_ID);
  });

  it('stale event (matchedCount 0) → stale, no throw', async () => {
    mockSubUpdate.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
    });
    const n = normalized();
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('stale');
  });

  it('duplicate-key conflict retries once when row exists', async () => {
    mockSubUpdate
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1, upsertedCount: 0 });
    mockSubFindOne.mockReturnValue({
      select: jest.fn(() => ({ lean: jest.fn(async () => ({ _id: 'x' })) })),
    });
    const n = normalized();
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('synced');
    expect(mockSubUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('handlePaddleEvent', () => {
  it('claims the event with provider fields then marks processed', async () => {
    const event = normalizedEvent(
      'subscription.updated',
      paddleSubscriptionEntity(),
      { providerEventId: 'paddle-evt-1' },
    );
    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');

    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeEventId: 'paddle-evt-1',
        type: 'subscription.updated',
        provider: 'paddle',
        providerEventId: 'paddle-evt-1',
        eventType: 'subscription.updated',
        occurredAt: OCCURRED,
        processingStatus: 'processing',
      }),
    );
    expect(mockEventUpdate).toHaveBeenCalledWith(
      { provider: 'paddle', providerEventId: 'paddle-evt-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ processingStatus: 'processed' }),
      }),
    );
  });

  it('duplicate event_id → duplicate no-op', async () => {
    mockEventCreate.mockRejectedValue({ code: 11000 });
    const event = normalizedEvent('subscription.updated', {}, {
      providerEventId: 'dup-1',
    });
    const result = await handlePaddleEvent(event);
    expect(result).toBe('duplicate');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('subscription.canceled syncs non-entitled state', async () => {
    const event = normalizedEvent(
      'subscription.canceled',
      paddleSubscriptionEntity({ status: 'canceled' }),
    );
    await handlePaddleEvent(event);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.status).toBe('canceled');
    expect(set.entitled).toBe(false);
  });

  it('subscription.past_due keeps entitlement', async () => {
    const event = normalizedEvent(
      'subscription.past_due',
      paddleSubscriptionEntity({ status: 'past_due' }),
    );
    await handlePaddleEvent(event);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.entitled).toBe(true);
  });

  it('subscription.paused / resumed route through the same sync', async () => {
    for (const type of ['subscription.paused', 'subscription.resumed']) {
      mockSubUpdate.mockClear();
      const event = normalizedEvent(
        type,
        paddleSubscriptionEntity({ status: type === 'subscription.paused' ? 'paused' : 'active' }),
      );
      await handlePaddleEvent(event);
      expect(mockSubUpdate).toHaveBeenCalled();
    }
  });

  it('transaction.completed retrieves authoritative subscription and syncs', async () => {
    mockRetrieveSubscription.mockResolvedValue(
      paddleSubscriptionEntity(),
    );
    const txn = {
      id: 'txn_123',
      subscriptionId: 'sub_paddle_123',
      status: 'completed',
      customData: {},
    };
    const event = normalizedEvent('transaction.completed', txn);
    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');
    expect(mockRetrieveSubscription).toHaveBeenCalledWith('sub_paddle_123');
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.provider).toBe('paddle');
    expect(set.paddleTransactionId).toBe('txn_123');
  });

  it('transaction.payment_failed syncs authoritative state (e.g. past_due)', async () => {
    mockRetrieveSubscription.mockResolvedValue(
      paddleSubscriptionEntity({ status: 'past_due' }),
    );
    const txn = { id: 'txn_124', subscriptionId: 'sub_paddle_123', status: 'failed' };
    const event = normalizedEvent('transaction.payment_failed', txn);
    await handlePaddleEvent(event);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.status).toBe('past_due');
    expect(set.entitled).toBe(true);
  });

  it('transaction without subscription ref → warn, still processed', async () => {
    const txn = { id: 'txn_125', subscriptionId: null, status: 'completed' };
    const event = normalizedEvent('transaction.completed', txn);
    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');
    expect(mockRetrieveSubscription).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('missing retrieved subscription → warn, processed without sync', async () => {
    mockRetrieveSubscription.mockResolvedValue(null);
    const txn = { id: 'txn_126', subscriptionId: 'sub_gone', status: 'completed' };
    const event = normalizedEvent('transaction.completed', txn);
    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');
    expect(mockSubUpdate).not.toHaveBeenCalled();
  });

  it('transient processing error releases the claim and rethrows', async () => {
    mockSubUpdate.mockRejectedValue(new Error('db down'));
    const event = normalizedEvent('subscription.updated', paddleSubscriptionEntity(), {
      providerEventId: 'paddle-evt-err',
    });
    await expect(handlePaddleEvent(event)).rejects.toThrow('db down');
    expect(mockEventDelete).toHaveBeenCalledWith({
      provider: 'paddle',
      providerEventId: 'paddle-evt-err',
    });
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });

  it('transaction.paid follows the same authoritative-sync path', async () => {
    mockRetrieveSubscription.mockResolvedValue(paddleSubscriptionEntity());
    const txn = { id: 'txn_paid', subscriptionId: 'sub_paddle_123', status: 'paid' };
    const event = normalizedEvent('transaction.paid', txn);
    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');
    expect(mockRetrieveSubscription).toHaveBeenCalledWith('sub_paddle_123');
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.provider).toBe('paddle');
    expect(set.paddleTransactionId).toBe('txn_paid');
  });

  it('subscription.created syncs through the same normalized path', async () => {
    const event = normalizedEvent(
      'subscription.created',
      paddleSubscriptionEntity(),
      { providerEventId: 'paddle-evt-created' },
    );
    const result = await handlePaddleEvent(event);
    expect(result).toBe('processed');
    expect(mockSubUpdate).toHaveBeenCalled();
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.provider).toBe('paddle');
    expect(set.plan).toBe('PRO');
    expect(set.entitled).toBe(true);
  });

  it('out-of-order protection: stale guard uses occurredAt inside filter', async () => {
    const newer = new Date('2026-11-21T00:00:00.000Z');
    const olderEvent = normalizedEvent('subscription.updated', paddleSubscriptionEntity(), {
      occurredAt: OCCURRED,
    });
    await handlePaddleEvent(olderEvent);
    const filter = mockSubUpdate.mock.calls[0][0];
    expect(filter.$or[0].lastProviderEventAt.$lt).toEqual(OCCURRED);
    expect(newer.getTime()).toBeGreaterThan(OCCURRED.getTime());
  });
});

describe('getEffectivePlan — provider-agnostic entitlement', () => {
  function planLookup(plan: string | null) {
    mockSubFindOne.mockReturnValue({
      select: jest.fn(() => ({
        lean: jest.fn(async () => (plan ? { plan } : null)),
      })),
    });
  }

  it('active paddle subscription resolves PRO', async () => {
    planLookup('PRO');
    const plan = await getEffectivePlan(USER_ID);
    expect(plan).toBe('PRO');
    // The entitlement query is provider-agnostic — it matches on
    // status/period only, so paddle docs behave identically.
    const filter = mockSubFindOne.mock.calls[0][0] as Record<string, unknown>;
    expect(filter).not.toHaveProperty('provider');
    // Entitlement is expressed as status $or-branches (trialing/
    // past_due, or active with unexpired period) — no provider key.
    expect(Array.isArray(filter.$or)).toBe(true);
  });

  it('no entitled subscription resolves FREE', async () => {
    planLookup(null);
    const plan = await getEffectivePlan(USER_ID);
    expect(plan).toBe('FREE');
  });
});

describe('Paddle billing amount snapshots', () => {
  function entityWithPrice(unitPrice: unknown, priceId = 'pri_pro_monthly_test') {
    return paddleSubscriptionEntity({
      items: [
        {
          status: 'active',
          quantity: 1,
          recurring: true,
          price: { id: priceId, unitPrice },
          product: { id: 'pro_test' },
          trialDates: null,
        },
      ],
    });
  }

  it('extracts monthly recurring price from subscription unitPrice', () => {
    const n = normalizePaddleSubscription(
      entityWithPrice({ amount: '1900', currencyCode: 'USD' }) as never,
      OCCURRED,
    );
    expect(n.priceCents).toBe(1900);
    expect(n.priceCurrency).toBe('USD');
  });

  it('extracts yearly recurring price independently of interval', () => {
    const n = normalizePaddleSubscription(
      entityWithPrice(
        { amount: '19000', currencyCode: 'USD' },
        'pri_pro_yearly_test',
      ) as never,
      OCCURRED,
    );
    expect(n.interval).toBe('year');
    expect(n.priceCents).toBe(19000);
    expect(n.priceCurrency).toBe('USD');
  });

  it('leaves price null when unitPrice is missing or malformed', () => {
    for (const bad of [undefined, null, {}, { amount: 'abc', currencyCode: 'USD' }, { amount: '19.5', currencyCode: 'USD' }]) {
      const n = normalizePaddleSubscription(
        entityWithPrice(bad) as never,
        OCCURRED,
      );
      expect(n.priceCents).toBeNull();
      expect(n.priceCurrency).toBeNull();
    }
  });

  it('sync persists recurring price snapshot on the subscription doc', async () => {
    const n = normalizePaddleSubscription(
      entityWithPrice({ amount: '19000', currencyCode: 'USD' }, 'pri_pro_yearly_test') as never,
      OCCURRED,
    );
    await syncSubscriptionFromPaddle(n);
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.priceCents).toBe(19000);
    expect(set.priceCurrency).toBe('USD');
  });

  it('transaction.completed persists last-transaction totals (tax/discount inclusive)', async () => {
    mockRetrieveSubscription.mockResolvedValue(
      entityWithPrice({ amount: '1900', currencyCode: 'USD' }),
    );
    const txn = {
      id: 'txn_amt',
      subscriptionId: 'sub_paddle_123',
      status: 'completed',
      customData: {},
      details: {
        totals: {
          subtotal: '1900',
          discount: '0',
          tax: '152',
          total: '2052',
          currencyCode: 'USD',
        },
      },
    };
    await handlePaddleEvent(normalizedEvent('transaction.completed', txn));
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.lastTransactionTotalCents).toBe(2052);
    expect(set.lastTransactionCurrency).toBe('USD');
    expect(set.lastTransactionTaxCents).toBe(152);
    expect(set.lastTransactionDiscountCents).toBe(0);
    expect(set.lastTransactionAt).toBe(OCCURRED);
    // Recurring price comes from the subscription entity, not totals.
    expect(set.priceCents).toBe(1900);
  });

  it('transaction.payment_failed does NOT overwrite last-payment snapshot', async () => {
    mockRetrieveSubscription.mockResolvedValue(
      entityWithPrice({ amount: '1900', currencyCode: 'USD' }),
    );
    const txn = {
      id: 'txn_fail',
      subscriptionId: 'sub_paddle_123',
      status: 'failed',
      details: { totals: { total: '2052', tax: '152', discount: '0', currencyCode: 'USD' } },
    };
    await handlePaddleEvent(normalizedEvent('transaction.payment_failed', txn));
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.lastTransactionTotalCents).toBeUndefined();
    expect(set.lastTransactionAt).toBeUndefined();
  });

  it('cross-user safety: reservation owner wins over conflicting subscription customData', async () => {
    const OTHER_USER = '64b0000000000000000000ff';
    reservationLookup({
      _id: 'res_owner',
      user: USER_ID,
      workspace: null,
      provider: 'paddle',
      status: 'pending',
    });
    // Subscription customData claims a DIFFERENT user — must be ignored.
    const entity = paddleSubscriptionEntity({
      customData: { checkoutReservationId: 'res_owner', userId: OTHER_USER },
    });
    const n = normalizePaddleSubscription(entity as never, OCCURRED);
    const result = await syncSubscriptionFromPaddle(n);
    expect(result).toBe('synced');
    const set = mockSubUpdate.mock.calls[0][1].$set;
    expect(set.user).toBe(USER_ID);
    expect(set.user).not.toBe(OTHER_USER);
  });
});
