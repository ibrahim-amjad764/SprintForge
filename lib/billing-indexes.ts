// lib/billing-indexes.ts
//
// Mandatory billing index readiness.
//
// Relying on Mongoose autoIndex is NOT sufficient for billing
// correctness: autoIndex can be disabled in production, builds are
// asynchronous, and a missing unique index fails OPEN (duplicate
// checkout sessions / duplicate entitled subscriptions become
// possible with no error). This module explicitly verifies — and
// creates when absent — every index the billing layer depends on,
// and fails closed when an index exists with the WRONG definition.
//
// Verified once per process (cached). Callers should invoke
// ensureBillingIndexes() before accepting checkout/webhook writes;
// a rejection must abort the operation (fail closed), never proceed
// unlocked.

import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import BillingEvent from '@/models/BillingEvent';
import type { Model } from 'mongoose';

interface RequiredIndex {
  model: Model<unknown>;
  collection: string;
  name: string;
  key: Record<string, 1>;
  unique: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

/*
  Index names match the Mongoose-generated defaults so explicitly
  created indexes are identical to what autoIndex would produce —
  no duplicate/conflicting definitions, and unrelated indexes are
  never touched.
*/
const REQUIRED_INDEXES: RequiredIndex[] = [
  {
    // One entitled subscription per billing scope (P6.1/R3).
    model: Subscription as unknown as Model<unknown>,
    collection: 'subscriptions',
    name: 'workspace_1_user_1_entitled',
    key: { workspace: 1, user: 1 },
    unique: true,
    partialFilterExpression: { entitled: true },
  },
  {
    // Webhook upsert key — globally unique Stripe subscription ID.
    model: Subscription as unknown as Model<unknown>,
    collection: 'subscriptions',
    name: 'stripeSubscriptionId_1',
    key: { stripeSubscriptionId: 1 },
    unique: true,
  },
  {
    // Provider-scoped subscription uniqueness (Paddle, P7.4).
    // Partial: legacy Stripe docs lack providerSubscriptionId.
    model: Subscription as unknown as Model<unknown>,
    collection: 'subscriptions',
    name: 'provider_1_providerSubscriptionId_1',
    key: { provider: 1, providerSubscriptionId: 1 },
    unique: true,
    partialFilterExpression: { providerSubscriptionId: { $exists: true } },
  },
  {
    // Provider-scoped webhook idempotency (Paddle, P7.4).
    // Partial: legacy rows lack providerEventId.
    model: BillingEvent as unknown as Model<unknown>,
    collection: 'billingevents',
    name: 'provider_1_providerEventId_1',
    key: { provider: 1, providerEventId: 1 },
    unique: true,
    partialFilterExpression: { providerEventId: { $exists: true } },
  },
  {
    // One pending checkout reservation per billing scope (P6.3).
    model: CheckoutReservation as unknown as Model<unknown>,
    collection: 'checkoutreservations',
    name: 'user_1_workspace_1',
    key: { user: 1, workspace: 1 },
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
  {
    // Webhook lookup by Stripe Checkout Session ID.
    model: CheckoutReservation as unknown as Model<unknown>,
    collection: 'checkoutreservations',
    name: 'stripeCheckoutSessionId_1',
    key: { stripeCheckoutSessionId: 1 },
    unique: false,
  },
  {
    // Lazy expiry sweeps.
    model: CheckoutReservation as unknown as Model<unknown>,
    collection: 'checkoutreservations',
    name: 'status_1_expiresAt_1',
    key: { status: 1, expiresAt: 1 },
    unique: false,
  },
  {
    // Paddle webhook lookup by transaction ID (txn_…).
    model: CheckoutReservation as unknown as Model<unknown>,
    collection: 'checkoutreservations',
    name: 'paddleTransactionId_1',
    key: { paddleTransactionId: 1 },
    unique: false,
  },
];

function sameKey(a: Record<string, unknown>, b: Record<string, 1>): boolean {
  const aEntries = Object.entries(a ?? {});
  const bEntries = Object.entries(b);
  return (
    aEntries.length === bEntries.length &&
    bEntries.every(([k, v]) => (a as Record<string, unknown>)[k] === v)
  );
}

function samePartial(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

let readinessPromise: Promise<void> | null = null;

/*
  Verify (creating when absent) all required billing indexes.
  - Missing index        → created explicitly (works with
                           autoIndex disabled).
  - Index with same name but different spec → throws (fail closed);
                           a wrong unique/partial definition is
                           worse than none — it looks protected
                           while silently allowing duplicates.
  - Unrelated indexes    → untouched.
  Cached per process; failures are NOT cached so the next request
  retries verification.
*/
export async function ensureBillingIndexes(): Promise<void> {
  if (readinessPromise) return readinessPromise;

  readinessPromise = (async () => {
    // One index listing per collection, shared across its specs.
    const indexCache = new Map<string, Promise<unknown[]>>();
    const listIndexes = (collection: string, model: Model<unknown>) => {
      let p = indexCache.get(collection);
      if (!p) {
        p = model.collection.indexes() as Promise<unknown[]>;
        indexCache.set(collection, p);
      }
      return p;
    };

    for (const spec of REQUIRED_INDEXES) {
      const existing = (await listIndexes(spec.collection, spec.model)) as {
        name?: string;
        key?: Record<string, unknown>;
        unique?: boolean;
        partialFilterExpression?: Record<string, unknown>;
      }[];
      const found = existing.find((idx) => idx.name === spec.name);

      if (found) {
        const keyOk = sameKey(found.key as Record<string, unknown>, spec.key);
        const uniqueOk = spec.unique ? found.unique === true : true;
        const partialOk = samePartial(
          found.partialFilterExpression as Record<string, unknown> | undefined,
          spec.partialFilterExpression,
        );
        if (!keyOk || !uniqueOk || !partialOk) {
          throw new Error(
            `Billing index '${spec.name}' on '${spec.collection}' has an ` +
              `incorrect definition (expected key=${JSON.stringify(spec.key)} ` +
              `unique=${spec.unique} partial=${JSON.stringify(spec.partialFilterExpression ?? null)}, ` +
              `found key=${JSON.stringify(found.key)} unique=${found.unique === true} ` +
              `partial=${JSON.stringify(found.partialFilterExpression ?? null)}). ` +
              `Drop and recreate it before serving billing traffic.`,
          );
        }
        continue;
      }

      await spec.model.collection.createIndex(spec.key, {
        name: spec.name,
        unique: spec.unique,
        ...(spec.partialFilterExpression
          ? { partialFilterExpression: spec.partialFilterExpression }
          : {}),
      });
    }
  })();

  try {
    await readinessPromise;
  } catch (error) {
    readinessPromise = null; // allow retry on next request
    throw error;
  }
}

/* Test hook — resets the per-process cache between tests. */
export function __resetBillingIndexCache(): void {
  readinessPromise = null;
}
