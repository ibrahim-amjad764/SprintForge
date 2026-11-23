// lib/plans.ts
//
// Central plan catalog — the ONLY place plan IDs, Stripe price
// mappings, and enforcement limits are defined. Client code never
// supplies price IDs or limits; routes resolve them here from env.
//
// Stripe remains the billing authority; MongoDB stores the synced
// subscription state. Plans without configured Stripe prices simply
// cannot be purchased (checkout rejects them).

export type BillingInterval = 'month' | 'year';
export type PlanId = 'FREE' | 'PRO' | 'TEAM';

export interface PlanLimits {
  // Per-workspace caps enforced server-side on creation paths.
  maxProjectsPerWorkspace: number;
  maxMembersPerWorkspace: number;
  // Per-user cap on owned workspaces. null = unlimited.
  maxOwnedWorkspaces: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  limits: PlanLimits;
  // Env var names holding the Stripe Price IDs (never hardcode IDs).
  priceEnv: Record<BillingInterval, string>;
  // Env var names holding the Paddle Price IDs (pri_…). Empty string
  // means the plan is not purchasable via Paddle.
  paddlePriceEnv: Record<BillingInterval, string>;
  // Display-only pricing in cents for the marketing UI. Stripe
  // remains the billing authority — these never affect checkout.
  displayPriceCents: Record<BillingInterval, number | null>;
}

// Migration/default policy: existing users/workspaces with no
// Subscription document resolve to FREE. Enforcement only blocks
// NEW creations — nothing existing is revoked or migrated.
export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    description: 'For individuals getting started',
    limits: {
      maxProjectsPerWorkspace: 3,
      maxMembersPerWorkspace: 3,
      maxOwnedWorkspaces: 1,
    },
    priceEnv: { month: '', year: '' },
    paddlePriceEnv: { month: '', year: '' },
    displayPriceCents: { month: 0, year: 0 },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    description: 'For growing teams',
    limits: {
      maxProjectsPerWorkspace: 25,
      maxMembersPerWorkspace: 25,
      maxOwnedWorkspaces: null,
    },
    priceEnv: {
      month: 'STRIPE_PRICE_PRO_MONTHLY',
      year: 'STRIPE_PRICE_PRO_YEARLY',
    },
    paddlePriceEnv: {
      month: 'PADDLE_PRICE_PRO_MONTHLY',
      year: 'PADDLE_PRICE_PRO_YEARLY',
    },
    displayPriceCents: { month: 1900, year: 19000 },
  },
  TEAM: {
    id: 'TEAM',
    name: 'Team',
    description: 'For larger organizations',
    limits: {
      maxProjectsPerWorkspace: 200,
      maxMembersPerWorkspace: 200,
      maxOwnedWorkspaces: 10,
    },
    priceEnv: {
      month: 'STRIPE_PRICE_TEAM_MONTHLY',
      year: 'STRIPE_PRICE_TEAM_YEARLY',
    },
    // Paddle catalog currently covers PRO only — TEAM has no Paddle
    // prices, so Paddle checkout for TEAM correctly resolves null.
    paddlePriceEnv: { month: '', year: '' },
    displayPriceCents: { month: null, year: null },
  },
};

export const PURCHASABLE_PLANS: PlanId[] = ['PRO', 'TEAM'];

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLANS;
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year';
}

/*
  Resolve the Stripe Price ID for a plan+interval from env.
  Returns null when the price is not configured — checkout must
  reject rather than guess.
*/
export function getStripePriceId(
  plan: PlanId,
  interval: BillingInterval,
): string | null {
  return getProviderPriceId('stripe', plan, interval);
}

/*
  Resolve the provider-native Price ID for a plan+interval from env.
  Stripe IDs must start with 'price_', Paddle IDs with 'pri_'.
  Returns null when the price is not configured — checkout must
  reject rather than guess.
*/
export function getProviderPriceId(
  provider: 'stripe' | 'paddle',
  plan: PlanId,
  interval: BillingInterval,
): string | null {
  const envName =
    provider === 'stripe'
      ? PLANS[plan].priceEnv[interval]
      : PLANS[plan].paddlePriceEnv[interval];
  if (!envName) return null;
  const priceId = process.env[envName];
  const prefix = provider === 'stripe' ? 'price_' : 'pri_';
  return priceId && priceId.startsWith(prefix) ? priceId : null;
}

/*
  Reverse lookup: which plan+interval does a provider price ID map to?
  Used by webhooks to persist the purchased plan without trusting
  client metadata.
*/
export function findPlanByPriceId(
  priceId: string,
): { plan: PlanId; interval: BillingInterval } | null {
  return findPlanByProviderPriceId('stripe', priceId);
}

export function findPlanByProviderPriceId(
  provider: 'stripe' | 'paddle',
  priceId: string,
): { plan: PlanId; interval: BillingInterval } | null {
  for (const planId of PURCHASABLE_PLANS) {
    for (const interval of ['month', 'year'] as const) {
      if (getProviderPriceId(provider, planId, interval) === priceId) {
        return { plan: planId, interval };
      }
    }
  }
  return null;
}

/*
  Subscription statuses that grant paid-plan entitlements.
  past_due keeps access during Stripe's dunning retries;
  unpaid/canceled/incomplete do not.
*/
const ENTITLED_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
]);

export function statusGrantsPlan(status: string): boolean {
  return ENTITLED_STATUSES.has(status);
}

export function limitsForPlan(plan: PlanId): PlanLimits {
  return PLANS[plan].limits;
}
