// lib/billing/providers/types.ts
//
// Provider-neutral billing types shared by the Stripe and Paddle
// adapters. Entitlement semantics live in lib/plans.ts and are
// provider-agnostic — these types only normalize provider payloads
// into a common shape for subscription synchronization.

export type BillingProviderId = 'stripe' | 'paddle';

/*
  Normalized subscription projection — the shape the sync layer
  consumes regardless of which provider produced it. Provider-specific
  period fields (Stripe current_period_*, Paddle
  current_billing_period.*) are flattened here.
*/
export interface NormalizedSubscription {
  provider: BillingProviderId;
  // Provider-native subscription ID (sub_… for both, but scoped by provider)
  providerSubscriptionId: string;
  // Provider-native customer ID (cus_… / ctm_…)
  providerCustomerId: string | null;
  // Resolved plan + interval from the provider's price catalog —
  // never trusted from client metadata.
  plan: string | null;
  interval: 'month' | 'year' | null;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  // Provider event timestamp used for stale-event protection
  occurredAt: Date;
  // Provider-native reference for logging/alerts (never secrets)
  rawRef: string;
  // Provider customData — advisory correlation ONLY. Never trusted
  // for entitlement decisions without server-side verification.
  customData?: Record<string, unknown> | null;
}

/*
  Normalized webhook event — common envelope after provider-specific
  signature verification. providerEventId is deduplicated per
  provider via the BillingEvent {provider, providerEventId} index.
*/
export interface NormalizedEvent {
  provider: BillingProviderId;
  // Stripe: evt_… / Paddle: event_id (UUID)
  providerEventId: string;
  // Stripe: e.g. 'customer.subscription.updated'
  // Paddle: e.g. 'subscription.updated'
  eventType: string;
  // Stripe: created*1000 / Paddle: occurred_at — stale-event guard
  occurredAt: Date;
  // Provider-native payload — adapter-specific interpretation only
  data: unknown;
}

export const BILLING_PROVIDERS: readonly BillingProviderId[] = [
  'stripe',
  'paddle',
];

export function isBillingProviderId(value: unknown): value is BillingProviderId {
  return value === 'stripe' || value === 'paddle';
}
