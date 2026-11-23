// __tests__/unit/lib/billing-indexes.test.ts
//
// Billing index readiness: explicit verification/creation of the
// unique indexes billing correctness depends on — independent of
// Mongoose autoIndex (which may be disabled in production).

jest.mock('@/models/Subscription', () => ({
  __esModule: true,
  default: { collection: { indexes: jest.fn(), createIndex: jest.fn() } },
}));

jest.mock('@/models/CheckoutReservation', () => ({
  __esModule: true,
  default: { collection: { indexes: jest.fn(), createIndex: jest.fn() } },
}));

jest.mock('@/models/BillingEvent', () => ({
  __esModule: true,
  default: { collection: { indexes: jest.fn(), createIndex: jest.fn() } },
}));

import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import BillingEvent from '@/models/BillingEvent';
import {
  ensureBillingIndexes,
  __resetBillingIndexCache,
} from '@/lib/billing-indexes';

const subCollection = (Subscription as never as {
  collection: { indexes: jest.Mock; createIndex: jest.Mock };
}).collection;
const resCollection = (CheckoutReservation as never as {
  collection: { indexes: jest.Mock; createIndex: jest.Mock };
}).collection;
const evtCollection = (BillingEvent as never as {
  collection: { indexes: jest.Mock; createIndex: jest.Mock };
}).collection;

const CORRECT_SUB_INDEXES = [
  { name: 'workspace_1_user_1_entitled', key: { workspace: 1, user: 1 }, unique: true, partialFilterExpression: { entitled: true } },
  { name: 'stripeSubscriptionId_1', key: { stripeSubscriptionId: 1 }, unique: true },
  { name: 'provider_1_providerSubscriptionId_1', key: { provider: 1, providerSubscriptionId: 1 }, unique: true, partialFilterExpression: { providerSubscriptionId: { $exists: true } } },
  { name: 'user_1_workspace_1', key: { user: 1, workspace: 1 } }, // unrelated — preserved
  { name: 'user_1', key: { user: 1 } },
  { name: 'workspace_1', key: { workspace: 1 } },
];

const CORRECT_RES_INDEXES = [
  { name: 'user_1_workspace_1', key: { user: 1, workspace: 1 }, unique: true, partialFilterExpression: { status: 'pending' } },
  { name: 'stripeCheckoutSessionId_1', key: { stripeCheckoutSessionId: 1 } },
  { name: 'status_1_expiresAt_1', key: { status: 1, expiresAt: 1 } },
  { name: 'paddleTransactionId_1', key: { paddleTransactionId: 1 } },
];

const CORRECT_EVT_INDEXES = [
  { name: 'provider_1_providerEventId_1', key: { provider: 1, providerEventId: 1 }, unique: true, partialFilterExpression: { providerEventId: { $exists: true } } },
  { name: 'stripeEventId_1', key: { stripeEventId: 1 }, unique: true }, // legacy — untouched
  { name: 'processedAt_1', key: { processedAt: 1 } },
];

beforeEach(() => {
  jest.clearAllMocks();
  __resetBillingIndexCache();
  subCollection.createIndex.mockResolvedValue('ok');
  resCollection.createIndex.mockResolvedValue('ok');
  evtCollection.createIndex.mockResolvedValue('ok');
});

describe('ensureBillingIndexes', () => {
  it('creates missing indexes explicitly (works with autoIndex disabled)', async () => {
    // Simulate a fresh collection: only _id exists.
    subCollection.indexes.mockResolvedValue([{ name: '_id_', key: { _id: 1 } }]);
    resCollection.indexes.mockResolvedValue([{ name: '_id_', key: { _id: 1 } }]);
    evtCollection.indexes.mockResolvedValue([{ name: '_id_', key: { _id: 1 } }]);

    await ensureBillingIndexes();

    // Subscription: 3 required indexes created.
    expect(subCollection.createIndex).toHaveBeenCalledTimes(3);
    expect(subCollection.createIndex).toHaveBeenCalledWith(
      { workspace: 1, user: 1 },
      expect.objectContaining({
        name: 'workspace_1_user_1_entitled',
        unique: true,
        partialFilterExpression: { entitled: true },
      }),
    );
    expect(subCollection.createIndex).toHaveBeenCalledWith(
      { stripeSubscriptionId: 1 },
      expect.objectContaining({ name: 'stripeSubscriptionId_1', unique: true }),
    );
    expect(subCollection.createIndex).toHaveBeenCalledWith(
      { provider: 1, providerSubscriptionId: 1 },
      expect.objectContaining({
        name: 'provider_1_providerSubscriptionId_1',
        unique: true,
        partialFilterExpression: { providerSubscriptionId: { $exists: true } },
      }),
    );
    // Reservation: 4 required indexes created.
    expect(resCollection.createIndex).toHaveBeenCalledTimes(4);
    expect(resCollection.createIndex).toHaveBeenCalledWith(
      { user: 1, workspace: 1 },
      expect.objectContaining({
        name: 'user_1_workspace_1',
        unique: true,
        partialFilterExpression: { status: 'pending' },
      }),
    );
    // BillingEvent: 1 required index created.
    expect(evtCollection.createIndex).toHaveBeenCalledTimes(1);
    expect(evtCollection.createIndex).toHaveBeenCalledWith(
      { provider: 1, providerEventId: 1 },
      expect.objectContaining({
        name: 'provider_1_providerEventId_1',
        unique: true,
        partialFilterExpression: { providerEventId: { $exists: true } },
      }),
    );
  });

  it('passes when all required indexes already exist correctly', async () => {
    subCollection.indexes.mockResolvedValue(CORRECT_SUB_INDEXES);
    resCollection.indexes.mockResolvedValue(CORRECT_RES_INDEXES);
    evtCollection.indexes.mockResolvedValue(CORRECT_EVT_INDEXES);

    await expect(ensureBillingIndexes()).resolves.toBeUndefined();
    expect(subCollection.createIndex).not.toHaveBeenCalled();
    expect(resCollection.createIndex).not.toHaveBeenCalled();
    expect(evtCollection.createIndex).not.toHaveBeenCalled();
  });

  it('fails closed when a required index has the WRONG definition', async () => {
    // Same name, but NOT unique and wrong partial filter — looks
    // protected while silently allowing duplicates.
    subCollection.indexes.mockResolvedValue([
      {
        name: 'workspace_1_user_1_entitled',
        key: { workspace: 1, user: 1 },
        unique: false,
        partialFilterExpression: { entitled: true },
      },
      { name: 'stripeSubscriptionId_1', key: { stripeSubscriptionId: 1 }, unique: true },
      { name: 'provider_1_providerSubscriptionId_1', key: { provider: 1, providerSubscriptionId: 1 }, unique: true, partialFilterExpression: { providerSubscriptionId: { $exists: true } } },
    ]);
    resCollection.indexes.mockResolvedValue(CORRECT_RES_INDEXES);
    evtCollection.indexes.mockResolvedValue(CORRECT_EVT_INDEXES);

    await expect(ensureBillingIndexes()).rejects.toThrow(/incorrect definition/);
  });

  it('fails closed when the partial filter differs', async () => {
    subCollection.indexes.mockResolvedValue([
      {
        name: 'workspace_1_user_1_entitled',
        key: { workspace: 1, user: 1 },
        unique: true,
        partialFilterExpression: { status: 'active' }, // wrong filter
      },
      { name: 'stripeSubscriptionId_1', key: { stripeSubscriptionId: 1 }, unique: true },
      { name: 'provider_1_providerSubscriptionId_1', key: { provider: 1, providerSubscriptionId: 1 }, unique: true, partialFilterExpression: { providerSubscriptionId: { $exists: true } } },
    ]);
    resCollection.indexes.mockResolvedValue(CORRECT_RES_INDEXES);
    evtCollection.indexes.mockResolvedValue(CORRECT_EVT_INDEXES);

    await expect(ensureBillingIndexes()).rejects.toThrow(/incorrect definition/);
  });

  it('preserves unrelated indexes — never drops or rewrites them', async () => {
    subCollection.indexes.mockResolvedValue(CORRECT_SUB_INDEXES);
    resCollection.indexes.mockResolvedValue(CORRECT_RES_INDEXES);
    evtCollection.indexes.mockResolvedValue(CORRECT_EVT_INDEXES);

    await ensureBillingIndexes();
    // No dropIndex calls exist on the API surface we use; assert only
    // createIndex was never invoked for unrelated names.
    const createdNames = [
      ...subCollection.createIndex.mock.calls,
      ...resCollection.createIndex.mock.calls,
      ...evtCollection.createIndex.mock.calls,
    ].map((c) => (c[1] as { name?: string }).name);
    expect(createdNames).not.toContain('user_1');
    expect(createdNames).not.toContain('workspace_1');
    expect(createdNames).not.toContain('_id_');
    expect(createdNames).not.toContain('stripeEventId_1');
  });

  it('caches readiness per process — second call does not re-list', async () => {
    subCollection.indexes.mockResolvedValue(CORRECT_SUB_INDEXES);
    resCollection.indexes.mockResolvedValue(CORRECT_RES_INDEXES);
    evtCollection.indexes.mockResolvedValue(CORRECT_EVT_INDEXES);

    await ensureBillingIndexes();
    await ensureBillingIndexes();
    expect(subCollection.indexes).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures — next call retries verification', async () => {
    subCollection.indexes.mockRejectedValueOnce(new Error('db down'));
    await expect(ensureBillingIndexes()).rejects.toThrow('db down');

    subCollection.indexes.mockResolvedValue(CORRECT_SUB_INDEXES);
    resCollection.indexes.mockResolvedValue(CORRECT_RES_INDEXES);
    evtCollection.indexes.mockResolvedValue(CORRECT_EVT_INDEXES);
    await expect(ensureBillingIndexes()).resolves.toBeUndefined();
  });
});
