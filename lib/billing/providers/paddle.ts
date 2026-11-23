// lib/billing/providers/paddle.ts
//
// Paddle adapter — server-side helpers for the Paddle billing
// provider. P7.3 scope: client access, environment validation,
// price resolution, and webhook signature verification. Checkout
// session creation and subscription synchronization land in P7.4+.
//
// Security invariants:
// - Webhook signatures are verified with paddle.webhooks.unmarshal()
//   on the RAW request body before any field is read. The SDK applies
//   its documented 5-second replay tolerance and constant-time HMAC
//   comparison.
// - Price IDs are resolved server-side from env — clients never
//   supply pri_… identifiers.
// - Paddle customData is advisory correlation only; entitlements are
//   granted exclusively from API-retrieved subscription state.

import {
  getPaddleClient,
  getPaddleEnvStatus,
  isPaddleConfigured,
} from '@/lib/paddle';
import {
  findPlanByProviderPriceId,
  getProviderPriceId,
} from '@/lib/plans';
import type { BillingInterval, PlanId } from '@/lib/plans';
import type {
  NormalizedEvent,
  NormalizedSubscription,
} from './types';
import type {
  Subscription as PaddleSubscriptionEntity,
  Transaction as PaddleTransactionEntity,
} from '@paddle/paddle-node-sdk';

export { getPaddleEnvStatus, isPaddleConfigured };

/*
  Resolve the Paddle Price ID (pri_…) for a plan+interval. Returns
  null when the plan has no Paddle price configured — checkout must
  reject rather than guess.
*/
export function getPaddlePriceId(
  plan: PlanId,
  interval: BillingInterval,
): string | null {
  return getProviderPriceId('paddle', plan, interval);
}

/*
  Reverse lookup: which plan+interval does a Paddle price ID map to?
  Used by webhook synchronization — never trust client-supplied plan
  values.
*/
export function findPlanByPaddlePriceId(
  priceId: string,
): { plan: PlanId; interval: BillingInterval } | null {
  return findPlanByProviderPriceId('paddle', priceId);
}

/*
  Verify a Paddle webhook notification and normalize it into the
  provider-neutral envelope.

  rawBody must be the unparsed request body — Paddle signs
  `${ts}:${rawBody}` and any re-serialization breaks verification.
  signatureHeader is the Paddle-Signature header value.

  Returns null when the webhook secret is not configured (fail
  closed — the route must reject, not process unsigned events).
  Throws when signature verification fails or the payload is invalid.
*/
export async function unmarshalPaddleEvent(
  rawBody: string,
  signatureHeader: string | null,
): Promise<NormalizedEvent | null> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;

  const paddle = getPaddleClient();
  const event = await paddle.webhooks.unmarshal(
    rawBody,
    secret,
    signatureHeader,
  );

  return {
    provider: 'paddle',
    providerEventId: event.eventId,
    eventType: event.eventType,
    occurredAt: new Date(event.occurredAt),
    data: event.data,
  };
}

/* ------------------------------------------------------------------ */
/* Subscription normalization                                          */
/* ------------------------------------------------------------------ */

function isoToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/*
  Normalize a Paddle Subscription entity into the provider-neutral
  shape consumed by subscription synchronization.

  - Plan/interval are resolved from the subscription's ACTUAL price
    ID via the env-backed catalog — client metadata and customData
    are never consulted for plan identity.
  - Paddle statuses map 1:1 onto the app's SubscriptionStatus enum
    (active | trialing | past_due | paused | canceled).
  - cancelAtPeriodEnd derives from scheduledChange.action === 'cancel'
    (Paddle schedules cancellation rather than flagging the sub).
  - Interval falls back to the price billing cycle only when the
    catalog cannot map the price (still returns the cycle for
    diagnostics; plan stays null → sync rejects as unmapped).
*/
export function normalizePaddleSubscription(
  subscription: PaddleSubscriptionEntity,
  occurredAt: Date,
): NormalizedSubscription {
  const item = subscription.items?.[0];
  const priceId = item?.price?.id ?? null;
  const mapped = priceId ? findPlanByPaddlePriceId(priceId) : null;

  let interval: 'month' | 'year' | null = mapped?.interval ?? null;
  if (!interval) {
    const cycle = item?.price?.billingCycle?.interval;
    if (cycle === 'month' || cycle === 'year') interval = cycle;
  }

  const trialEnd = item?.trialDates?.endsAt ?? null;

  return {
    provider: 'paddle',
    providerSubscriptionId: subscription.id,
    providerCustomerId: subscription.customerId ?? null,
    plan: mapped?.plan ?? null,
    interval,
    status: subscription.status,
    currentPeriodStart: isoToDate(subscription.currentBillingPeriod?.startsAt),
    currentPeriodEnd: isoToDate(subscription.currentBillingPeriod?.endsAt),
    trialEnd: isoToDate(trialEnd),
    // Paddle expresses pending cancellation as a scheduled change.
    cancelAtPeriodEnd: subscription.scheduledChange?.action === 'cancel',
    canceledAt: isoToDate(subscription.canceledAt),
    occurredAt,
    rawRef: subscription.id,
    customData: (subscription.customData ?? null) as Record<
      string,
      unknown
    > | null,
  };
}

/* ------------------------------------------------------------------ */
/* Authoritative retrieval                                             */
/* ------------------------------------------------------------------ */

/*
  Retrieve the authoritative subscription state from the Paddle API.
  Webhook payloads are signature-verified, but transaction events
  only carry a subscription reference — the subscription itself is
  always fetched fresh so entitlement never depends on a stale or
  partial event payload.
*/
export async function retrievePaddleSubscription(
  subscriptionId: string,
): Promise<PaddleSubscriptionEntity | null> {
  try {
    return await getPaddleClient().subscriptions.get(subscriptionId);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404) return null;
    throw error;
  }
}

/*
  Retrieve a Paddle customer — its customData is written server-side
  via the API (P7.5 checkout), making it a trusted owner-attribution
  source unlike browser-supplied transaction customData.
*/
export async function retrievePaddleCustomer(
  customerId: string,
): Promise<{ customData: Record<string, unknown> | null } | null> {
  try {
    const customer = await getPaddleClient().customers.get(customerId);
    return {
      customData: (customer.customData ?? null) as Record<
        string,
        unknown
      > | null,
    };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404) return null;
    throw error;
  }
}

/*
  Extract the subscription ID referenced by a Paddle transaction
  entity (transaction.* webhook payloads).
*/
export function paddleTransactionSubscriptionId(
  transaction: PaddleTransactionEntity,
): string | null {
  return transaction.subscriptionId ?? null;
}
