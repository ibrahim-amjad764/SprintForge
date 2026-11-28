// services/billing.service.ts
//
// Stripe subscription management — server-side authority layer.
//
// Rules enforced here:
// - Plan + interval come from the request but are validated against
//   the central catalog (lib/plans.ts); Stripe Price IDs are resolved
//   from env — client-supplied price IDs are never accepted.
// - Customer identity comes from the authenticated user, never the
//   request body.
// - Webhook writes go through syncSubscriptionFromStripe() which
//   resolves plan from the actual Stripe price ID and guards against
//   stale events via lastStripeEventAt.
// - BillingEvent ledger makes every webhook idempotent.

import stripe from '@/lib/stripe';
import Subscription from '@/models/Subscription';
import CheckoutReservation from '@/models/CheckoutReservation';
import BillingEvent from '@/models/BillingEvent';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import { connectDB } from '@/lib/db';
import { ensureBillingIndexes } from '@/lib/billing-indexes';
import logger from '@/lib/logger';
import {
  PLANS,
  PURCHASABLE_PLANS,
  isPlanId,
  isBillingInterval,
  getStripePriceId,
  findPlanByPriceId,
  limitsForPlan,
  statusGrantsPlan,
  type PlanId,
} from '@/lib/plans';
import type Stripe from 'stripe';
import {
  normalizePaddleSubscription,
  retrievePaddleSubscription,
  retrievePaddleCustomer,
  paddleTransactionSubscriptionId,
  getPaddlePriceId,
} from '@/lib/billing/providers/paddle';
import { getPaddleClient, isPaddleConfigured } from '@/lib/paddle';
import type {
  NormalizedEvent,
  NormalizedSubscription,
} from '@/lib/billing/providers/types';
import type {
  Subscription as PaddleSubscriptionEntity,
  Transaction as PaddleTransactionEntity,
} from '@paddle/paddle-node-sdk';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/*
  Checkout reservation timing.
  - RESERVATION_TTL_MS: bounds how long a crashed/in-flight checkout
    can hold the scope lock. Aligned to Stripe's ~24h Checkout
    Session lifetime — a reservation is never released while its
    session may still be payable.
  - CHECKOUT_INFLIGHT_MS: a pending reservation with no session ID
    younger than this is assumed in-flight → concurrent callers get
    409 instead of a duplicate session. Older → crashed creation,
    recovered via the deterministic Stripe idempotency key.
  - STRIPE_REREAD_DELAY_MS: bounded retry delay for read-after-write
    inconsistency when retrieving a subscription that 404s.
*/
const RESERVATION_TTL_MS = 23 * 60 * 60 * 1000;
const CHECKOUT_INFLIGHT_MS = 60 * 1000;
const STRIPE_REREAD_DELAY_MS = 1000;
/*
  Safety tail for reservations that never recorded a Stripe session
  ID (crash between session creation and persistence). A session
  created at the last moment before a crash can stay payable for up
  to ~24h after reservation creation, so these locks are only swept
  RESERVATION_TTL_MS + this margin — never while a session may be
  payable.
*/
const SESSION_TAIL_MS = 60 * 60 * 1000;

export type BillingResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string };

/*
  Thrown by service-layer writes (e.g. workspace creation) when a
  plan limit blocks the operation inside a transaction. Carries the
  HTTP status + stable machine-readable code so routes can map it
  to a proper 4xx instead of a generic 500.
*/
export class PlanLimitError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

/* ------------------------------------------------------------------ */
/* Plan resolution                                                     */
/* ------------------------------------------------------------------ */

/*
  Resolve the effective plan for a scope.
  Priority: workspace subscription > user-level subscription > FREE.
  Only entitled statuses (active/trialing/past_due) grant the plan.
*/
export async function getEffectivePlan(
  userId: string,
  workspaceId?: string | null,
): Promise<PlanId> {
  await connectDB();

  /*
    Scope precedence: a workspace subscription is more specific than
    a user-level one, so it is resolved FIRST — a workspace on TEAM
    is not downgraded by the owner's personal PRO, and vice versa a
    workspace without its own subscription inherits the owner's
    personal plan.
  */
  /*
    'active' additionally requires the current period to be unexpired —
    a missed customer.subscription.deleted webhook must not grant Pro
    forever. trialing/past_due are exempt: trials end via status change,
    and past_due keeps access during Stripe's dunning retries even
    though the period boundary has passed.
  */
  const now = new Date();
  const entitled = {
    $or: [
      { status: { $in: ['trialing', 'past_due'] } },
      {
        /*
          'active' requires a known, unexpired currentPeriodEnd — a
          subscription synced from a payload missing period data must
          not silently grant indefinite Pro. Legacy rows without a
          period end lose entitlement until the next webhook syncs
          them (fail closed, not open).
        */
        status: 'active',
        currentPeriodEnd: { $gt: now },
      },
    ],
  };

  if (workspaceId) {
    const wsSub = (await Subscription.findOne({
      user: userId,
      workspace: workspaceId,
      ...entitled,
    })
      .select('plan')
      .lean()) as { plan?: string } | null;
    if (wsSub && isPlanId(wsSub.plan)) return wsSub.plan;
  }

  const userSub = (await Subscription.findOne({
    user: userId,
    workspace: null,
    ...entitled,
  })
    .select('plan')
    .lean()) as { plan?: string } | null;

  return userSub && isPlanId(userSub.plan) ? userSub.plan : 'FREE';
}

/* ------------------------------------------------------------------ */
/* Stripe customer lifecycle                                           */
/* ------------------------------------------------------------------ */

/*
  Find-or-create the Stripe customer for a billing scope and persist
  the ID on the scope document (Workspace for workspace billing,
  User for personal billing). Email is used ONLY as a creation hint —
  identity is the persisted stripeCustomerId, never email matching.

  Concurrency: the Stripe idempotency key is derived from the scope,
  so simultaneous checkout requests cannot create duplicate customers.
  A conditional update ({ stripeCustomerId: { $exists: false } })
  prevents a lost-update race on our side.
*/
async function ensureBillingCustomer(input: {
  userId: string;
  userEmail: string;
  workspaceId: string | null;
}): Promise<string> {
  if (input.workspaceId) {
    const ws = await Workspace.findById(input.workspaceId)
      .select('stripeCustomerId owner')
      .lean();
    if (ws?.stripeCustomerId) return ws.stripeCustomerId;

    const customer = await stripe.customers.create(
      {
        email: input.userEmail,
        name: `Workspace ${input.workspaceId}`,
        metadata: { workspaceId: input.workspaceId, userId: input.userId },
      },
      { idempotencyKey: `customer:workspace:${input.workspaceId}` },
    );

    await Workspace.updateOne(
      { _id: input.workspaceId, stripeCustomerId: { $exists: false } },
      { $set: { stripeCustomerId: customer.id } },
    );
    // Re-read in case a concurrent request already stored an ID.
    const fresh = await Workspace.findById(input.workspaceId)
      .select('stripeCustomerId')
      .lean();
    return fresh?.stripeCustomerId ?? customer.id;
  }

  const user = await User.findById(input.userId)
    .select('stripeCustomerId')
    .lean();
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create(
    {
      email: input.userEmail,
      metadata: { userId: input.userId },
    },
    { idempotencyKey: `customer:user:${input.userId}` },
  );

  await User.updateOne(
    { _id: input.userId, stripeCustomerId: { $exists: false } },
    { $set: { stripeCustomerId: customer.id } },
  );
  const fresh = await User.findById(input.userId)
    .select('stripeCustomerId')
    .lean();
  return fresh?.stripeCustomerId ?? customer.id;
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/*
  Only same-origin absolute paths are allowed as post-checkout
  return targets — anything else falls back to /dashboard so a
  crafted returnTo cannot redirect users to external origins.
*/
function safeReturnPath(returnTo: string | null | undefined): string {
  if (
    typeof returnTo === 'string' &&
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//')
  ) {
    return returnTo;
  }
  return '/dashboard';
}

/* ------------------------------------------------------------------ */
/* Checkout reservations                                               */
/* ------------------------------------------------------------------ */

/*
  A CheckoutReservation is an atomic per-scope lock that guarantees
  at most one payable Stripe Checkout Session exists per billing
  scope at a time. It is NOT a subscription and never grants
  entitlements — verified webhook state alone activates plans.

  Acquisition is a unique-index insert (status:'pending' per
  {user,workspace}); the loser of a concurrent race gets E11000 and
  resumes the winner's logical checkout instead of creating a
  second Stripe session.
*/

type ReservationScope = { user: string; workspace: string | null };

interface PendingReservation {
  _id: unknown;
  plan?: string;
  interval?: string;
  provider?: 'stripe' | 'paddle';
  paddleTransactionId?: string;
  stripeCheckoutSessionId?: string;
  checkoutUrl?: string;
  sessionExpiresAt?: Date | string | null;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number }).code === 11000;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function expireStaleReservations(scope: ReservationScope): Promise<void> {
  const now = Date.now();
  const scopeFilter = {
    user: scope.user,
    workspace: scope.workspace,
    status: 'pending' as const,
  };
  /*
    Reservations WITH a recorded Stripe session expire at their
    expiresAt, which the persist path sets to the session's own
    expiry — the lock dies exactly when the session does.

    Reservations WITHOUT a session ID (crash before persistence)
    get an extra SESSION_TAIL_MS: Stripe may hold a payable session
    for up to ~24h after reservation creation, so releasing at the
    23h TTL could overlap a still-payable session.
  */
  await CheckoutReservation.updateMany(
    {
      ...scopeFilter,
      stripeCheckoutSessionId: { $exists: true, $ne: null },
      expiresAt: { $lt: new Date(now) },
    },
    { $set: { status: 'expired' } },
  );
  await CheckoutReservation.updateMany(
    {
      ...scopeFilter,
      $or: [
        { stripeCheckoutSessionId: { $exists: false } },
        { stripeCheckoutSessionId: null },
      ],
      expiresAt: { $lt: new Date(now - SESSION_TAIL_MS) },
    },
    { $set: { status: 'expired' } },
  );
}

/*
  Acquire the scope lock or resolve to the in-flight checkout that
  already holds it. Returns either a fresh/recovered reservation to
  create a session under, or a reusable existing session URL.
*/
async function acquireCheckoutReservation(input: {
  userId: string;
  workspaceId: string | null;
  plan: PlanId;
  interval: 'month' | 'year';
  provider?: 'stripe' | 'paddle';
}): Promise<
  BillingResult<{
    reservation: PendingReservation;
    reusedSession?: { url: string; sessionId: string };
  }>
> {
  const scope: ReservationScope = {
    user: input.userId,
    workspace: input.workspaceId,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    await expireStaleReservations(scope);

    try {
      const created = await CheckoutReservation.create({
        user: input.userId,
        workspace: input.workspaceId,
        plan: input.plan,
        interval: input.interval,
        status: 'pending',
        provider: input.provider ?? 'stripe',
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
      });
      return {
        ok: true,
        data: { reservation: created.toObject() as PendingReservation },
      };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Scope lock held — inspect the pending reservation below.
    }

    const pending = (await CheckoutReservation.findOne({
      user: scope.user,
      workspace: scope.workspace,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean()) as PendingReservation | null;

    if (!pending) continue; // expired between sweep and read — retry

    /*
      Cross-provider guard: a pending Paddle reservation must never
      be reused or released by the Stripe path (a Paddle transaction
      may be in flight), and vice versa. Provider-agnostic pending
      lock means one checkout at a time per scope — the foreign
      provider simply gets a 409.
    */
    const pendingProvider = pending.provider ?? 'stripe';
    if (pendingProvider !== (input.provider ?? 'stripe')) {
      return {
        ok: false,
        status: 409,
        error: 'A checkout is already in progress for this billing scope',
      };
    }

    const now = Date.now();
    const sessionExpiresAt = toDate(pending.sessionExpiresAt);
    const sessionLive = !!sessionExpiresAt && sessionExpiresAt.getTime() > now;
    const samePlan =
      pending.plan === input.plan && pending.interval === input.interval;

    if (pending.stripeCheckoutSessionId) {
      if (sessionLive && samePlan && pending.checkoutUrl) {
        // Payable session for the same purchase — reuse it so
        // retries/concurrent requests land on one checkout.
        return {
          ok: true,
          data: {
            reservation: pending,
            reusedSession: {
              url: pending.checkoutUrl,
              sessionId: pending.stripeCheckoutSessionId,
            },
          },
        };
      }
      if (sessionLive) {
        /*
          Payable session for a DIFFERENT plan/interval — expire it at
          Stripe first so it can never be paid, then release the lock.
          If expiry fails the session may still be payable → keep the
          lock and reject rather than risk double billing.
        */
        try {
          await stripe.checkout.sessions.expire(
            pending.stripeCheckoutSessionId,
          );
        } catch {
          return {
            ok: false,
            status: 409,
            error: 'A checkout is already in progress for this billing scope',
          };
        }
        await CheckoutReservation.updateOne(
          { _id: pending._id },
          { $set: { status: 'released' } },
        );
        continue;
      }
      // Stripe session expired — release the lock and retry.
      await CheckoutReservation.updateOne(
        { _id: pending._id },
        { $set: { status: 'expired' } },
      );
      continue;
    }

    // No session ID yet: in-flight creation or a crashed one.
    const createdAt = toDate(pending.createdAt) ?? new Date(now);
    const age = now - createdAt.getTime();
    if (age < CHECKOUT_INFLIGHT_MS) {
      return {
        ok: false,
        status: 409,
        error: 'A checkout is already being created. Please retry shortly.',
      };
    }
    if (!samePlan) {
      // Crashed reservation for a different purchase — safe to release
      // (no session ID means Stripe never confirmed a session; any
      // ambiguous create is deduped by the idempotency key below only
      // within this reservation, so release and start fresh).
      await CheckoutReservation.updateOne(
        { _id: pending._id },
        { $set: { status: 'released' } },
      );
      continue;
    }
    /*
      Crashed mid-create for the same purchase: reuse this reservation.
      The deterministic idempotency key (checkout:{reservationId})
      makes Stripe return the original session if one was created —
      recovery without duplicates.
    */
    return { ok: true, data: { reservation: pending } };
  }

  return {
    ok: false,
    status: 409,
    error: 'Could not start checkout. Please try again.',
  };
}

/*
  Create (or idempotently recover) the Stripe Checkout Session for a
  reservation and persist session details back onto it. The
  idempotency key is derived from the reservation ID, so retries and
  crash recovery resolve to the same logical Stripe operation.
*/
async function ensureStripeCheckoutSession(input: {
  reservation: PendingReservation;
  customerId: string;
  userId: string;
  workspaceId: string | null;
  plan: PlanId;
  interval: 'month' | 'year';
  priceId: string;
  returnPath: string;
}): Promise<BillingResult<{ url: string | null; sessionId: string }>> {
  const { reservation } = input;

  if (reservation.stripeCheckoutSessionId && reservation.checkoutUrl) {
    return {
      ok: true,
      data: { url: reservation.checkoutUrl, sessionId: reservation.stripeCheckoutSessionId },
    };
  }

  const metadata = {
    userId: String(input.userId),
    workspaceId: input.workspaceId ? String(input.workspaceId) : '',
    plan: input.plan,
    interval: input.interval,
    checkoutReservationId: String(reservation._id),
  };

  const sep = input.returnPath.includes('?') ? '&' : '?';

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: input.priceId, quantity: 1 }],
        customer: input.customerId,
        client_reference_id: String(input.userId),
        metadata,
        subscription_data: { metadata },
        success_url: `${APP_URL}${input.returnPath}${sep}checkout=success`,
        cancel_url: `${APP_URL}${input.returnPath}${sep}checkout=cancelled`,
      },
      { idempotencyKey: `checkout:${String(reservation._id)}` },
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === 'number' && statusCode < 500) {
      /*
        Definitive Stripe rejection (4xx) — no session was created,
        so releasing the lock is safe.
      */
      await CheckoutReservation.updateOne(
        { _id: reservation._id },
        { $set: { status: 'released' } },
      );
      return {
        ok: false,
        status: 502,
        error: 'Payment provider rejected the checkout request',
      };
    }
    /*
      Ambiguous failure (timeout/5xx): a session MAY exist at Stripe.
      Keep the reservation — the idempotency key lets a retry recover
      the same session. Never release a lock whose session may be
      payable.
    */
    logger.error({ err: error }, 'Stripe checkout session creation failed');
    return {
      ok: false,
      status: 503,
      error: 'Checkout is temporarily unavailable. Please retry shortly.',
    };
  }

  const sessionExpiresAt =
    typeof session.expires_at === 'number'
      ? new Date(session.expires_at * 1000)
      : null;

  await CheckoutReservation.updateOne(
    { _id: reservation._id, status: 'pending' },
    {
      $set: {
        stripeCheckoutSessionId: session.id,
        checkoutUrl: session.url ?? undefined,
        sessionExpiresAt: sessionExpiresAt ?? undefined,
        /*
          Lock lifetime = the session's own payable life. Never
          shorter (would reopen the double-session gap) and never
          needed longer (checkout.session.expired / subscription
          webhooks release it earlier).
        */
        expiresAt: sessionExpiresAt ?? new Date(Date.now() + RESERVATION_TTL_MS),
      },
    },
  );

  return { ok: true, data: { url: session.url, sessionId: session.id } };
}

/* ------------------------------------------------------------------ */
/* Paddle checkout (P7.5)                                              */
/* ------------------------------------------------------------------ */

/*
  Paddle checkout has NO server-created session — Paddle.js opens a
  client-side overlay and Paddle creates a transaction
  (txn_…) + subscription, confirmed by webhooks. The reservation is
  therefore a pure scope lock + correlation token:

  - pending, no paddleTransactionId → checkout not yet completed;
    safe to reuse (re-opening the overlay is idempotent) or release
    when the plan changed (no payable artifact exists to expire).
  - pending WITH paddleTransactionId → a transaction exists and its
    webhook may still be in flight → 409 until sync completes the
    reservation.
  - expiresAt = createdAt + 23h covers abandoned overlays; there is
    no Stripe-style payable-session tail because nothing server-side
    can be paid.
*/
async function acquirePaddleCheckoutReservation(input: {
  userId: string;
  workspaceId: string | null;
  plan: PlanId;
  interval: 'month' | 'year';
  priceId: string;
}): Promise<BillingResult<{ reservation: PendingReservation }>> {
  const scope: ReservationScope = {
    user: input.userId,
    workspace: input.workspaceId,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    await expireStaleReservations(scope);

    try {
      const created = await CheckoutReservation.create({
        user: input.userId,
        workspace: input.workspaceId,
        plan: input.plan,
        interval: input.interval,
        status: 'pending',
        provider: 'paddle',
        paddlePriceId: input.priceId,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
      });
      return {
        ok: true,
        data: { reservation: created.toObject() as PendingReservation },
      };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }

    const pending = (await CheckoutReservation.findOne({
      user: scope.user,
      workspace: scope.workspace,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean()) as PendingReservation | null;

    if (!pending) continue;

    if ((pending.provider ?? 'stripe') !== 'paddle') {
      // Stripe lock held — its session may be payable.
      return {
        ok: false,
        status: 409,
        error: 'A checkout is already in progress for this billing scope',
      };
    }

    if (pending.paddleTransactionId) {
      // Transaction created; webhook sync pending — do not open a
      // second checkout while payment state is unresolved.
      return {
        ok: false,
        status: 409,
        error: 'A checkout payment is already being processed',
      };
    }

    const samePlan =
      pending.plan === input.plan && pending.interval === input.interval;
    if (samePlan) {
      /*
        Reuse the reservation — Paddle.js checkout is client-side and
        idempotent by nature (each open creates at most one
        transaction flow; customData ties it back to this lock).
      */
      return { ok: true, data: { reservation: pending } };
    }

    // Different plan/interval and no transaction — nothing payable
    // exists, so releasing the lock is safe.
    await CheckoutReservation.updateOne(
      { _id: pending._id },
      { $set: { status: 'released' } },
    );
  }

  return {
    ok: false,
    status: 409,
    error: 'Could not start checkout. Please try again.',
  };
}

/*
  Find-or-create the Paddle customer for a billing scope. Mirrors
  ensureBillingCustomer: the persisted paddleCustomerId is the
  identity, email is only a creation hint, and customData carries
  server-generated {userId, workspaceId} attribution that the
  webhook owner-resolution trusts (written via the API, never by
  the browser).

  Paddle has no idempotency keys — concurrent first-time creates can
  orphan a Paddle-side customer, but the conditional update +
  re-read ensures OUR side always converges on one stored ID.
*/
async function ensurePaddleBillingCustomer(input: {
  userId: string;
  userEmail: string;
  workspaceId: string | null;
}): Promise<string> {
  const customData: Record<string, string> = { userId: input.userId };
  if (input.workspaceId) customData.workspaceId = input.workspaceId;

  if (input.workspaceId) {
    const ws = await Workspace.findById(input.workspaceId)
      .select('paddleCustomerId owner')
      .lean();
    if (ws?.paddleCustomerId) return ws.paddleCustomerId;

    const customer = await getPaddleClient().customers.create({
      email: input.userEmail,
      name: `Workspace ${input.workspaceId}`,
      customData,
    });

    await Workspace.updateOne(
      { _id: input.workspaceId, paddleCustomerId: { $exists: false } },
      { $set: { paddleCustomerId: customer.id } },
    );
    const fresh = await Workspace.findById(input.workspaceId)
      .select('paddleCustomerId')
      .lean();
    return fresh?.paddleCustomerId ?? customer.id;
  }

  const user = await User.findById(input.userId)
    .select('paddleCustomerId')
    .lean();
  if (user?.paddleCustomerId) return user.paddleCustomerId;

  const customer = await getPaddleClient().customers.create({
    email: input.userEmail,
    customData,
  });

  await User.updateOne(
    { _id: input.userId, paddleCustomerId: { $exists: false } },
    { $set: { paddleCustomerId: customer.id } },
  );
  const fresh = await User.findById(input.userId)
    .select('paddleCustomerId')
    .lean();
  return fresh?.paddleCustomerId ?? customer.id;
}

export interface PaddleCheckoutConfig {
  provider: 'paddle';
  priceId: string;
  customerId: string;
  // Correlation payload for Paddle.js customData. Server-generated;
  // the webhook prefers the reservation row over these values, so
  // browser tampering cannot redirect entitlement.
  customData: Record<string, string>;
  reservationId: string;
}

export type CheckoutSessionData =
  | { url: string | null; sessionId: string }
  | { paddleCheckout: PaddleCheckoutConfig };

export async function createCheckoutSession(input: {
  userId: string;
  userEmail: string;
  plan: string;
  interval: string;
  workspaceId?: string | null;
  returnTo?: string | null;
  // Billing provider — defaults to 'stripe' for backward
  // compatibility. 'paddle' uses client-side Paddle.js checkout.
  provider?: 'stripe' | 'paddle';
}): Promise<BillingResult<CheckoutSessionData>> {
  const { userId, userEmail, plan, interval, workspaceId } = input;
  const provider = input.provider ?? 'stripe';

  if (!isPlanId(plan) || !PURCHASABLE_PLANS.includes(plan)) {
    return { ok: false, status: 400, error: 'Invalid plan' };
  }
  if (!isBillingInterval(interval)) {
    return { ok: false, status: 400, error: 'Invalid billing interval' };
  }
  if (provider !== 'stripe' && provider !== 'paddle') {
    return { ok: false, status: 400, error: 'Invalid payment provider' };
  }

  const priceId =
    provider === 'paddle'
      ? getPaddlePriceId(plan as PlanId, interval as 'month' | 'year')
      : getStripePriceId(plan as PlanId, interval as 'month' | 'year');
  if (!priceId) {
    /*
      Covers both "plan has no price for this provider" (e.g. TEAM
      has no Paddle prices) and "price env not configured".
    */
    return {
      ok: false,
      status:
        provider === 'stripe' || !isPaddleConfigured() ? 503 : 400,
      error: 'Plan is not available for purchase',
    };
  }
  if (provider === 'paddle' && !isPaddleConfigured()) {
    return {
      ok: false,
      status: 503,
      error: 'Paddle checkout is not configured',
    };
  }

  await connectDB();

  /*
    Fail closed: billing writes are only safe while the required
    unique indexes exist. Verified once per process; a missing or
    incorrect index aborts the checkout rather than risking
    duplicate payable sessions or duplicate entitlements.
  */
  try {
    await ensureBillingIndexes();
  } catch (error) {
    logger.error({ err: error }, 'Billing index readiness check failed');
    return {
      ok: false,
      status: 503,
      error: 'Billing is temporarily unavailable. Please try again later.',
    };
  }

  // Workspace-scoped checkout requires ownership (not just membership)
  // so billing control stays with the workspace owner.
  if (workspaceId) {
    const ws = await Workspace.findById(workspaceId).select('owner').lean();
    if (!ws || String(ws.owner) !== String(userId)) {
      return { ok: false, status: 403, error: 'Only the workspace owner can manage billing' };
    }
  }

  // Prevent conflicting subscriptions: an entitled subscription in
  // the same scope already covers this purchase — direct the user to
  // the portal instead of double-billing.
  const existing = await Subscription.findOne({
    user: userId,
    workspace: workspaceId ?? null,
    status: { $in: ['active', 'trialing', 'past_due', 'incomplete'] },
  })
    .sort({ createdAt: -1 })
    .lean();

  /*
    Abandoned-checkout recovery: Stripe expires incomplete
    subscriptions after ~24h, but our projection can retain
    status:'incomplete' until the webhook lands. An incomplete
    record older than one hour is treated as abandoned — mark it
    incomplete_expired locally and allow a fresh checkout instead of
    trapping the user behind a 409.
  */
  const INCOMPLETE_STALE_MS = 60 * 60 * 1000;
  if (
    existing?.status === 'incomplete' &&
    existing.createdAt &&
    Date.now() - new Date(existing.createdAt).getTime() > INCOMPLETE_STALE_MS
  ) {
    await Subscription.updateOne(
      { _id: (existing as { _id?: unknown })._id },
      { $set: { status: 'incomplete_expired' } },
    );
  } else if (existing) {
    return { ok: false, status: 409, error: 'An active subscription already exists for this scope' };
  }

  /*
    Paddle branch (P7.5): client-side Paddle.js checkout. The
    reservation is a pure scope lock + correlation token — no
    server-created session exists. Returns the checkout config the
    client needs to open Paddle.Checkout; entitlement still comes
    exclusively from verified webhooks.
  */
  if (provider === 'paddle') {
    const acquiredPaddle = await acquirePaddleCheckoutReservation({
      userId,
      workspaceId: workspaceId ?? null,
      plan: plan as PlanId,
      interval: interval as 'month' | 'year',
      priceId,
    });
    if (!acquiredPaddle.ok) return acquiredPaddle;
    const paddleReservation = acquiredPaddle.data.reservation;

    const releasePaddleReservation = () =>
      CheckoutReservation.updateOne(
        { _id: paddleReservation._id, status: 'pending' },
        { $set: { status: 'released' } },
      );

    let paddleCustomerId: string;
    try {
      paddleCustomerId = await ensurePaddleBillingCustomer({
        userId,
        userEmail,
        workspaceId: workspaceId ?? null,
      });
    } catch (error) {
      // Customer creation happens before any transaction can exist —
      // safe to release the lock.
      await releasePaddleReservation();
      throw error;
    }

    const customData: Record<string, string> = {
      userId: String(userId),
      workspaceId: workspaceId ? String(workspaceId) : '',
      plan: plan as string,
      interval: interval as string,
      checkoutReservationId: String(paddleReservation._id),
    };

    // Refresh correlation fields on reused reservations too — the
    // price ID is always the freshly resolved server-side value.
    await CheckoutReservation.updateOne(
      { _id: paddleReservation._id, status: 'pending' },
      { $set: { provider: 'paddle', paddlePriceId: priceId } },
    );

    return {
      ok: true,
      data: {
        paddleCheckout: {
          provider: 'paddle',
          priceId,
          customerId: paddleCustomerId,
          customData,
          reservationId: String(paddleReservation._id),
        },
      },
    };
  }

  /*
    Atomic scope lock: at most one pending CheckoutReservation per
    {user, workspace}. Concurrent requests and retries resolve to the
    same logical checkout — reuse of a live session URL or a 409 —
    instead of minting duplicate payable Stripe sessions.
  */
  const acquired = await acquireCheckoutReservation({
    userId,
    workspaceId: workspaceId ?? null,
    plan: plan as PlanId,
    interval: interval as 'month' | 'year',
    provider: 'stripe',
  });
  if (!acquired.ok) return acquired;
  if (acquired.data.reusedSession) {
    return { ok: true, data: acquired.data.reusedSession };
  }
  const reservation = acquired.data.reservation;

  const releaseReservation = () =>
    CheckoutReservation.updateOne(
      { _id: reservation._id, status: 'pending' },
      { $set: { status: 'released' } },
    );

  // Resolve (or create) the persisted Stripe customer for this scope.
  // Failure here happens BEFORE any Stripe session exists, so the
  // lock can be safely released.
  let customerId: string;
  try {
    customerId = await ensureBillingCustomer({
      userId,
      userEmail,
      workspaceId: workspaceId ?? null,
    });
  } catch (error) {
    await releaseReservation();
    throw error;
  }

  const returnPath = safeReturnPath(input.returnTo);

  return ensureStripeCheckoutSession({
    reservation,
    customerId,
    userId,
    workspaceId: workspaceId ?? null,
    plan: plan as PlanId,
    interval: interval as 'month' | 'year',
    priceId,
    returnPath,
  });
}

/* ------------------------------------------------------------------ */
/* Customer portal                                                     */
/* ------------------------------------------------------------------ */

export async function createPortalSession(input: {
  userId: string;
  workspaceId?: string | null;
}): Promise<BillingResult<{ url: string; provider: 'stripe' | 'paddle' }>> {
  await connectDB();

  // Portal access follows the same ownership rule as checkout.
  if (input.workspaceId) {
    const ws = await Workspace.findById(input.workspaceId).select('owner').lean();
    if (!ws || String(ws.owner) !== String(input.userId)) {
      return { ok: false, status: 403, error: 'Only the workspace owner can manage billing' };
    }
  }

  /*
    Latest subscription regardless of provider. Missing `provider`
    on legacy documents means 'stripe'. Paddle rows also populate
    the legacy stripeSubscriptionId slot, so provider MUST be
    checked before choosing a portal — never send a ctm_… ID to
    Stripe or a cus_… ID to Paddle.
  */
  const sub = await Subscription.findOne({
    user: input.userId,
    workspace: input.workspaceId ?? null,
  })
    .sort({ createdAt: -1 })
    .select(
      'provider providerCustomerId providerSubscriptionId stripeCustomerId',
    )
    .lean();

  const provider = sub?.provider ?? 'stripe';

  if (provider === 'paddle') {
    if (!isPaddleConfigured()) {
      return {
        ok: false,
        status: 503,
        error: 'Paddle billing portal is not configured',
      };
    }

    // Subscription's own customer first; fall back to the scope's
    // persisted Paddle customer (covers abandoned checkouts).
    let paddleCustomerId = sub?.providerCustomerId ?? null;
    if (!paddleCustomerId) {
      if (input.workspaceId) {
        const ws = await Workspace.findById(input.workspaceId)
          .select('paddleCustomerId')
          .lean();
        paddleCustomerId = ws?.paddleCustomerId ?? null;
      } else {
        const user = await User.findById(input.userId)
          .select('paddleCustomerId')
          .lean();
        paddleCustomerId = user?.paddleCustomerId ?? null;
      }
    }

    if (!paddleCustomerId) {
      return { ok: false, status: 404, error: 'No billing account found' };
    }

    /*
      Paddle Customer Portal session — self-service management
      (payment method, subscription cancellation, invoices) hosted
      by Paddle. subscriptionIds scopes the session to this
      subscription's management URLs when available.
    */
    const session = await getPaddleClient().customerPortalSessions.create(
      paddleCustomerId,
      sub?.providerSubscriptionId ? [sub.providerSubscriptionId] : undefined,
    );
    const url = session.urls?.general?.overview;
    if (!url) {
      return {
        ok: false,
        status: 502,
        error: 'Billing portal is unavailable',
      };
    }
    return { ok: true, data: { url, provider: 'paddle' } };
  }

  // Stripe path — unchanged semantics; the subscription query above
  // already selected the latest doc, but portal customer resolution
  // must use the STRIPE customer field only.
  const stripeSub = sub?.stripeCustomerId ? sub : null;

  let customerId = stripeSub?.stripeCustomerId ?? null;

  if (!customerId) {
    if (input.workspaceId) {
      const ws = await Workspace.findById(input.workspaceId)
        .select('stripeCustomerId')
        .lean();
      customerId = ws?.stripeCustomerId ?? null;
    } else {
      const user = await User.findById(input.userId)
        .select('stripeCustomerId')
        .lean();
      customerId = user?.stripeCustomerId ?? null;
    }
  }

  if (!customerId) {
    return { ok: false, status: 404, error: 'No billing account found' };
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/dashboard`,
  });

  return { ok: true, data: { url: portal.url, provider: 'stripe' } };
}

/* ------------------------------------------------------------------ */
/* Subscription sync (webhook write path)                              */
/* ------------------------------------------------------------------ */

function unixToDate(seconds: number | null | undefined): Date | undefined {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : undefined;
}

/*
  Upsert the app's subscription projection from a Stripe subscription
  object. Plan is resolved from the subscription's actual price ID —
  metadata is advisory only. Stale events (older than the stored
  lastStripeEventAt) are ignored so out-of-order deliveries cannot
  roll state backwards.
*/
export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  eventCreatedAt: Date,
): Promise<'synced' | 'stale' | 'unmapped'> {
  await connectDB();

  const priceId =
    subscription.items?.data?.[0]?.price?.id ??
    (subscription as unknown as { plan?: { id?: string } }).plan?.id;
  const mapped = priceId ? findPlanByPriceId(priceId) : null;

  const metadata = (subscription.metadata ?? {}) as Record<string, string>;
  const userId = metadata.userId;
  const workspaceId = metadata.workspaceId || null;

  if (!userId || !mapped) {
    if (userId && !mapped) {
      /*
        CRITICAL operational alert: a subscription tied to a real
        user carries a Stripe price ID that is not in the plan
        catalog — typically env/config drift after a paid checkout.
        The customer may have been CHARGED without entitlement.
        No PRO is granted and nothing is silently closed; recovery:
        fix the STRIPE_PRICE_* env mapping, then resend the Stripe
        event (dashboard → event → resend) or run the billing
        backfill script with --stripe-reconcile. The pending
        CheckoutReservation completes automatically once a sync
        maps the price.
      */
      logger.error(
        {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId:
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id,
          priceId: priceId ?? null,
          userId,
          workspaceId: workspaceId || null,
        },
        'CRITICAL: paid subscription price not mapped to plan catalog — manual reconciliation required',
      );
    } else {
      // Missing user link or unmapped foreign subscription — log
      // and skip rather than write a bogus FREE/unknown-plan doc.
      logger.warn(
        { stripeSubscriptionId: subscription.id, priceId: priceId ?? null },
        'Webhook subscription skipped: unmapped price or missing userId',
      );
    }
    return 'unmapped';
  }

  /*
    Period fields moved between Stripe API versions: current releases
    expose current_period_* on the subscription; older payloads carry
    them on the first subscription item. Read both — never guess.
  */
  const subAny = subscription as unknown as Record<string, unknown>;
  const item = subscription.items?.data?.[0];
  const periodStart = unixToDate(
    (subAny.current_period_start as number | undefined) ??
      item?.current_period_start,
  );
  const periodEnd = unixToDate(
    (subAny.current_period_end as number | undefined) ??
      item?.current_period_end,
  );

  if (subscription.status === 'active' && !periodEnd) {
    // An active subscription with no period end would grant
    // indefinite entitlement under the expiry guard — surface it.
    logger.warn(
      { stripeSubscriptionId: subscription.id },
      'Active subscription synced without currentPeriodEnd',
    );
  }

  const update = {
    user: userId,
    workspace: workspaceId,
    plan: mapped.plan,
    interval: mapped.interval,
    status: subscription.status,
    /*
      Denormalized entitlement flag — backs the partial unique index
      that prevents two entitled subscriptions per billing scope.
      Mirrors getEffectivePlan: 'active' only counts when a period end
      was actually persisted (missing period data fails closed).
    */
    entitled:
      statusGrantsPlan(subscription.status) &&
      (subscription.status !== 'active' || periodEnd != null),
    stripeCustomerId:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEnd: unixToDate(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    canceledAt: unixToDate(subscription.canceled_at),
    lastStripeEventAt: eventCreatedAt,
  };

  /*
    Atomic stale-event protection: the lastStripeEventAt comparison
    lives INSIDE the update filter, so two concurrent webhook
    deliveries cannot interleave a read-check-write and let an older
    event overwrite newer state. matchedCount===0 with an existing
    document means the stored event is newer → 'stale'.
  */
  const guardedFilter = {
    stripeSubscriptionId: subscription.id,
    $or: [
      { lastStripeEventAt: { $lt: eventCreatedAt } },
      { lastStripeEventAt: { $exists: false } },
    ],
  };

  let lastConflict: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await Subscription.updateOne(
        guardedFilter,
        { $set: update },
        { upsert: true },
      );

      if (result.upsertedCount > 0 || result.matchedCount > 0) {
        /*
          Reconcile checkout reservations: a synced ENTITLED
          subscription means any pending checkout for this scope
          produced it — complete the lock. Reservations themselves
          never grant entitlements; only this verified subscription
          state does. Prefer the precise reservation ID from
          subscription metadata; fall back to the billing scope.
        */
        if (statusGrantsPlan(subscription.status)) {
          const resId = metadata.checkoutReservationId;
          if (resId) {
            await CheckoutReservation.updateOne(
              { _id: resId, status: 'pending' },
              { $set: { status: 'completed' } },
            );
          } else {
            await CheckoutReservation.updateMany(
              {
                user: userId,
                workspace: workspaceId,
                status: 'pending',
              },
              { $set: { status: 'completed' } },
            );
          }
        }
        return 'synced';
      }
      // Document exists but its stored event is newer/equal.
      return 'stale';
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 11000) throw error;
      lastConflict = error;

      /*
        Duplicate key on upsert — a concurrent delivery inserted the
        document first, or the partial entitled-scope index rejected a
        second entitled subscription. Re-read: if the row now exists
        for this Stripe subscription, retry the guarded update
        (non-upsert). Otherwise the conflict is the scope-level
        uniqueness index — propagate so Stripe retries after ordering
        settles (e.g. the older subscription's deleted event lands).
      */
      const existing = await Subscription.findOne({
        stripeSubscriptionId: subscription.id,
      })
        .select('_id')
        .lean();
      if (!existing) throw error;
      // Row exists — fall through and retry the guarded update once.
    }
  }

  // Repeated duplicate-key conflicts (e.g. the scope-level entitled
  // index) — propagate so the route returns 500 and Stripe retries
  // once event ordering settles.
  throw lastConflict;
}

/* ------------------------------------------------------------------ */
/* Webhook dispatcher                                                  */
/* ------------------------------------------------------------------ */

/*
  Process a signature-verified Stripe event. Idempotent via the
  BillingEvent ledger: duplicate deliveries return early.
  Never throws for handled event types — Stripe retries on non-2xx,
  so handled-but-failed writes are logged and still acked only when
  the failure is permanent; transient DB errors propagate to a 500.
*/
export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<'processed' | 'duplicate'> {
  await connectDB();

  /*
    Webhook writes depend on the same unique indexes (idempotent
    upsert key, entitled-scope uniqueness). Failure throws BEFORE the
    BillingEvent claim → route 500 → Stripe retries once indexes are
    ready. Fail closed, never write unlocked.
  */
  await ensureBillingIndexes();

  try {
    await BillingEvent.create({
      stripeEventId: event.id,
      type: event.type,
    });
  } catch (error: unknown) {
    // Duplicate key → already processed.
    if ((error as { code?: number }).code === 11000) {
      return 'duplicate';
    }
    throw error;
  }

  const eventTime = new Date(event.created * 1000);

  /*
    Reliability contract:
    - The BillingEvent row is claimed BEFORE processing so concurrent
      duplicate deliveries are suppressed by the unique index.
    - If processing throws (transient DB/Stripe error), the claim is
      RELEASED (row deleted) and the error propagates → route returns
      500 → Stripe retries → the retry re-claims and reprocesses.
    - If processing succeeds the row remains → later duplicates are
      permanent no-ops.
    - Worst case: process succeeds but the 200 response is lost →
      Stripe redelivers → duplicate key → 'duplicate' no-op. Safe,
      because subscription writes are themselves idempotent upserts
      guarded by lastStripeEventAt.
  */
  try {
    switch (event.type) {
    case 'checkout.session.completed': {
      /*
        Authoritative activation path: fetch the subscription object
        from Stripe and sync it. This covers the case where the
        customer.subscription.created event is delayed or lost —
        entitlement must not depend on a single webhook delivery.
        syncSubscriptionFromStripe is an idempotent upsert guarded by
        lastStripeEventAt, so re-processing is safe.
      */
      const session = event.data.object as Stripe.Checkout.Session;
      const subRef = session.subscription;
      const subscriptionId =
        typeof subRef === 'string' ? subRef : subRef?.id;

      if (!subscriptionId) {
        logger.warn({ eventId: event.id }, 'Checkout completed without subscription');
        break;
      }

      const subscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      const result = await syncSubscriptionFromStripe(subscription, eventTime);

      /*
        Reconcile the checkout reservation — but ONLY when the
        subscription actually synced (or was already newer/'stale').
        An 'unmapped' result means a paid checkout whose price is not
        in the plan catalog: the customer may have been charged with
        no entitlement. The reservation must NOT be closed as
        completed — it stays pending until its session expiry, and
        recovery is: fix the price mapping, then resend the Stripe
        event (or run billing-backfill --stripe-reconcile). The next
        successful sync completes the reservation automatically.
      */
      if (result !== 'unmapped') {
        const reservationId = (
          session.metadata as Record<string, string> | undefined
        )?.checkoutReservationId;
        await CheckoutReservation.updateOne(
          { stripeCheckoutSessionId: session.id, status: 'pending' },
          { $set: { status: 'completed' } },
        );
        if (reservationId) {
          await CheckoutReservation.updateOne(
            { _id: reservationId, status: 'pending' },
            { $set: { status: 'completed' } },
          );
        }
      }

      logger.info(
        { eventId: event.id, subscriptionId, result },
        'Checkout session completed — subscription synced',
      );
      break;
    }

    case 'checkout.session.expired': {
      /*
        Stripe expired an unpaid Checkout Session — release the scope
        lock so the user can start a fresh checkout. The session can
        no longer be paid, so releasing is safe.
      */
      const session = event.data.object as Stripe.Checkout.Session;
      await CheckoutReservation.updateOne(
        { stripeCheckoutSessionId: session.id, status: 'pending' },
        { $set: { status: 'expired' } },
      );
      logger.info(
        { eventId: event.id, sessionId: session.id },
        'Checkout session expired — reservation released',
      );
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const result = await syncSubscriptionFromStripe(
        event.data.object as Stripe.Subscription,
        eventTime,
      );
      logger.info(
        { eventId: event.id, type: event.type, result },
        'Subscription sync',
      );
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      /*
        Subscription reference moved across API versions:
        invoice.parent.subscription_details.subscription (current)
        vs invoice.subscription (legacy). Accept both.
      */
      const parentRef = invoice.parent?.subscription_details?.subscription;
      const legacyRef = (
        invoice as unknown as { subscription?: string | { id: string } }
      ).subscription;
      const subRef = parentRef ?? legacyRef;
      const subscriptionId =
        typeof subRef === 'string' ? subRef : subRef?.id;

      if (!subscriptionId) {
        logger.warn({ eventId: event.id }, 'Invoice event without subscription ref');
        break;
      }

      /*
        Never write invoice-derived status directly — a delayed
        invoice.paid/payment_failed must not resurrect a canceled
        subscription. Instead retrieve the authoritative subscription
        from Stripe and run it through the same guarded sync used by
        subscription.* events (staleness + idempotency preserved).
      */
      function isResourceMissing(error: unknown): boolean {
        const e = error as { code?: string; statusCode?: number };
        return e.code === 'resource_missing' || e.statusCode === 404;
      }

      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      let subscription: Stripe.Subscription | null = null;
      try {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } catch (retrieveError) {
        if (!isResourceMissing(retrieveError)) {
          throw retrieveError; // transient — release claim, Stripe retries
        }
        /*
          Read-after-write guard: a subscription created moments ago
          can briefly 404 while Stripe propagates. Retry ONCE after a
          bounded delay before treating it as permanently deleted —
          a temporary inconsistency must never cancel a live sub.
        */
        await sleep(STRIPE_REREAD_DELAY_MS);
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (retryError) {
          if (!isResourceMissing(retryError)) throw retryError;
        }
      }

      if (!subscription) {
        /*
          Subscription is gone from Stripe. Reflect that locally —
          but through the SAME atomic stale-event guard as every
          other write, so a delayed invoice event cannot regress
          newer subscription state (or move lastStripeEventAt
          backwards and reopen the window for older events).
        */
        const cancelResult = await Subscription.updateOne(
          {
            stripeSubscriptionId: subscriptionId,
            $or: [
              { lastStripeEventAt: { $lt: eventTime } },
              { lastStripeEventAt: { $exists: false } },
            ],
          },
          {
            $set: {
              status: 'canceled',
              entitled: false,
              lastStripeEventAt: eventTime,
            },
          },
        );
        logger.info(
          {
            eventId: event.id,
            subscriptionId,
            applied: cancelResult.matchedCount > 0,
          },
          'Invoice event: subscription missing in Stripe — cancel applied or stale',
        );
        break;
      }

      const result = await syncSubscriptionFromStripe(subscription, eventTime);
      logger.info(
        { eventId: event.id, type: event.type, subscriptionId, result },
        'Invoice billing event — subscription synced',
      );
      break;
    }

    default:
      logger.info({ eventId: event.id, type: event.type }, 'Unhandled Stripe event');
    }
  } catch (error) {
    // Release the idempotency claim so Stripe's retry can reprocess.
    try {
      await BillingEvent.deleteOne({ stripeEventId: event.id });
    } catch (cleanupError) {
      logger.error(
        { err: cleanupError, eventId: event.id },
        'Failed to release BillingEvent claim',
      );
    }
    throw error;
  }

  return 'processed';
}

/* ------------------------------------------------------------------ */
/* Paddle subscription synchronization (P7.4)                          */
/* ------------------------------------------------------------------ */

/*
  Resolve the billing-scope owner for a Paddle subscription.
  Precedence — most authoritative first:
  1. checkoutReservationId → the server-side reservation row owns
     user/workspace (created by our checkout route, not the browser).
  2. Paddle customer customData — written via the Paddle API
     server-side (P7.5), trusted attribution.
  3. Subscription customData — set through Paddle.js checkout;
     browser-influenceable, used only as a last resort with a
     warning. Entitlement itself still derives from the verified
     Paddle subscription + price catalog, never from customData.
*/
async function resolvePaddleSubscriptionOwner(
  normalized: NormalizedSubscription,
): Promise<{
  userId: string | null;
  workspaceId: string | null;
  checkoutReservationId: string | null;
}> {
  const customData = normalized.customData ?? {};
  const rawResId =
    typeof customData.checkoutReservationId === 'string'
      ? customData.checkoutReservationId
      : null;

  /*
    Reservation attribution is only trusted when the row is a live
    Paddle reservation: provider must be 'paddle' (a Stripe
    reservation can never anchor Paddle ownership) and status must be
    'pending' or 'completed' — 'released'/'expired' locks are dead
    and must not attribute a subscription. 'completed' is allowed so
    legitimate webhook retries (subscription.updated after the
    initial sync) still resolve the same owner.
  */
  let checkoutReservationId: string | null = null;
  let reservationOwner: { userId: string; workspaceId: string | null } | null =
    null;
  if (rawResId) {
    const reservation = await CheckoutReservation.findOne({
      _id: rawResId,
      provider: 'paddle',
      status: { $in: ['pending', 'completed'] },
    }).lean();
    if (reservation) {
      checkoutReservationId = rawResId;
      reservationOwner = {
        userId: String(reservation.user),
        workspaceId: reservation.workspace
          ? String(reservation.workspace)
          : null,
      };
    } else {
      logger.warn(
        {
          providerSubscriptionId: normalized.providerSubscriptionId,
          checkoutReservationId: rawResId,
        },
        'Paddle subscription referenced an invalid checkout reservation — attribution via reservation ignored',
      );
    }
  }

  if (reservationOwner) {
    return { ...reservationOwner, checkoutReservationId };
  }

  if (normalized.providerCustomerId) {
    const customer = await retrievePaddleCustomer(
      normalized.providerCustomerId,
    );
    const cd = customer?.customData;
    if (cd && typeof cd.userId === 'string') {
      return {
        userId: cd.userId,
        workspaceId: typeof cd.workspaceId === 'string' ? cd.workspaceId : null,
        checkoutReservationId,
      };
    }
  }

  if (typeof customData.userId === 'string') {
    logger.warn(
      {
        providerSubscriptionId: normalized.providerSubscriptionId,
        checkoutReservationId,
      },
      'Paddle subscription owner resolved from checkout customData — attribution unverified',
    );
    return {
      userId: customData.userId,
      workspaceId:
        typeof customData.workspaceId === 'string'
          ? customData.workspaceId
          : null,
      checkoutReservationId,
    };
  }

  return { userId: null, workspaceId: null, checkoutReservationId };
}

/*
  Upsert the app's subscription projection from a normalized Paddle
  subscription. Mirrors syncSubscriptionFromStripe:
  - plan/interval come from the price→catalog mapping (normalized
    upstream), never from client metadata;
  - the stale-event guard lives inside the update filter so
    out-of-order deliveries cannot regress state;
  - duplicate-key conflicts are retried once after confirming the
    document exists.
*/
/*
  Successful-charge snapshot extracted from a Paddle transaction's
  authoritative details.totals — amounts actually billed (tax and
  discount inclusive), distinct from the recurring subscription
  price. Only populated for transaction.completed / transaction.paid.
*/
export interface PaddleTransactionSnapshot {
  totalCents: number;
  currency: string | null;
  taxCents: number | null;
  discountCents: number | null;
}

function paddleMoneyToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number.parseInt(value, 10);
  return Number.isSafeInteger(n) ? n : null;
}

function extractPaddleTransactionSnapshot(
  transaction: PaddleTransactionEntity,
): PaddleTransactionSnapshot | null {
  const totals = transaction.details?.totals;
  if (!totals) return null;
  const totalCents = paddleMoneyToCents(totals.total);
  if (totalCents === null) return null;
  return {
    totalCents,
    currency: typeof totals.currencyCode === 'string' ? totals.currencyCode : null,
    taxCents: paddleMoneyToCents(totals.tax),
    discountCents: paddleMoneyToCents(totals.discount),
  };
}

export async function syncSubscriptionFromPaddle(
  normalized: NormalizedSubscription,
  options?: {
    paddleTransactionId?: string | null;
    transactionSnapshot?: PaddleTransactionSnapshot | null;
  },
): Promise<'synced' | 'stale' | 'unmapped'> {
  await connectDB();

  const owner = await resolvePaddleSubscriptionOwner(normalized);
  const { userId, workspaceId, checkoutReservationId } = owner;

  if (!normalized.plan || !userId) {
    if (userId && !normalized.plan) {
      /*
        CRITICAL operational alert — same contract as the Stripe
        path: a subscription tied to a real user carries a Paddle
        price ID outside the plan catalog (env/config drift after a
        paid checkout). Customer may have been CHARGED without
        entitlement. No PRO granted; recovery: fix
        PADDLE_PRICE_* mapping, then resend the Paddle notification
        or run billing-backfill reconciliation.
      */
      logger.error(
        {
          provider: 'paddle',
          providerSubscriptionId: normalized.providerSubscriptionId,
          providerCustomerId: normalized.providerCustomerId,
          userId,
          workspaceId: workspaceId || null,
        },
        'CRITICAL: paid Paddle subscription price not mapped to plan catalog — manual reconciliation required',
      );
    } else {
      logger.warn(
        {
          providerSubscriptionId: normalized.providerSubscriptionId,
          hasPlan: Boolean(normalized.plan),
          hasOwner: Boolean(userId),
        },
        'Paddle subscription skipped: unmapped price or missing owner link',
      );
    }
    return 'unmapped';
  }

  if (normalized.status === 'active' && !normalized.currentPeriodEnd) {
    // Same fail-closed rule as Stripe: active without a period end
    // would grant indefinite entitlement — surface it.
    logger.warn(
      { providerSubscriptionId: normalized.providerSubscriptionId },
      'Active Paddle subscription synced without currentPeriodEnd',
    );
  }

  const update = {
    user: userId,
    workspace: workspaceId,
    plan: normalized.plan,
    interval: normalized.interval ?? undefined,
    status: normalized.status,
    entitled:
      statusGrantsPlan(normalized.status) &&
      (normalized.status !== 'active' || normalized.currentPeriodEnd != null),
    provider: 'paddle' as const,
    providerCustomerId: normalized.providerCustomerId ?? undefined,
    providerSubscriptionId: normalized.providerSubscriptionId,
    /*
      Legacy unique slot: the pre-existing stripeSubscriptionId_1
      unique index cannot admit multiple missing values, so Paddle
      rows carry the provider-native subscription ID here as well.
      stripeCustomerId is not unique — populated for lookup
      continuity but semantically provider-neutral via
      providerCustomerId.
    */
    stripeSubscriptionId: normalized.providerSubscriptionId,
    stripeCustomerId: normalized.providerCustomerId ?? undefined,
    paddleTransactionId: options?.paddleTransactionId ?? undefined,
    /*
      Amount snapshots — recurring price comes from the verified
      subscription entity on every sync; transaction totals only
      update on successful-charge events. Undefined fields are
      dropped by Mongoose $set, so events lacking amounts never
      erase previously persisted values.
    */
    priceCents: normalized.priceCents ?? undefined,
    priceCurrency: normalized.priceCurrency ?? undefined,
    lastTransactionTotalCents:
      options?.transactionSnapshot?.totalCents ?? undefined,
    lastTransactionCurrency:
      options?.transactionSnapshot?.currency ?? undefined,
    lastTransactionTaxCents:
      options?.transactionSnapshot?.taxCents ?? undefined,
    lastTransactionDiscountCents:
      options?.transactionSnapshot?.discountCents ?? undefined,
    lastTransactionAt: options?.transactionSnapshot
      ? normalized.occurredAt
      : undefined,
    currentPeriodStart: normalized.currentPeriodStart ?? undefined,
    currentPeriodEnd: normalized.currentPeriodEnd ?? undefined,
    trialEnd: normalized.trialEnd ?? undefined,
    cancelAtPeriodEnd: normalized.cancelAtPeriodEnd,
    canceledAt: normalized.canceledAt ?? undefined,
    lastProviderEventAt: normalized.occurredAt,
  };

  let lastConflict: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await Subscription.updateOne(
        {
          provider: 'paddle',
          providerSubscriptionId: normalized.providerSubscriptionId,
          $or: [
            { lastProviderEventAt: { $lt: normalized.occurredAt } },
            { lastProviderEventAt: { $exists: false } },
          ],
        },
        { $set: update },
        { upsert: true },
      );

      if (result.upsertedCount > 0 || result.matchedCount > 0) {
        /*
          Reconcile the checkout reservation — only verified
          entitled subscription state completes a lock; reservations
          never grant entitlements themselves.
        */
        if (statusGrantsPlan(normalized.status)) {
          const txnId = options?.paddleTransactionId ?? null;
          const stamp = txnId ? { paddleTransactionId: txnId } : {};
          if (checkoutReservationId) {
            await CheckoutReservation.updateOne(
              {
                _id: checkoutReservationId,
                provider: 'paddle',
                status: 'pending',
              },
              { $set: { status: 'completed', ...stamp } },
            );
          } else if (txnId) {
            await CheckoutReservation.updateOne(
              { paddleTransactionId: txnId, status: 'pending' },
              { $set: { status: 'completed' } },
            );
          } else {
            await CheckoutReservation.updateMany(
              {
                user: userId,
                workspace: workspaceId,
                provider: 'paddle',
                status: 'pending',
              },
              { $set: { status: 'completed' } },
            );
          }
        }
        return 'synced';
      }
      return 'stale';
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 11000) throw error;
      lastConflict = error;

      const existing = await Subscription.findOne({
        provider: 'paddle',
        providerSubscriptionId: normalized.providerSubscriptionId,
      })
        .select('_id')
        .lean();
      if (!existing) throw error;
      // Row exists — retry the guarded update once.
    }
  }

  throw lastConflict;
}

/* ------------------------------------------------------------------ */
/* Paddle webhook dispatcher (P7.4)                                    */
/* ------------------------------------------------------------------ */

function asPaddleSubscription(data: unknown): PaddleSubscriptionEntity {
  return data as PaddleSubscriptionEntity;
}

function asPaddleTransaction(data: unknown): PaddleTransactionEntity {
  return data as PaddleTransactionEntity;
}

/*
  Process a signature-verified, normalized Paddle event.
  Idempotent via the BillingEvent ledger ({provider, providerEventId}
  compound key + legacy stripeEventId slot). Claim is released on
  transient failure so Paddle's notification retry reprocesses.
*/
export async function handlePaddleEvent(
  event: NormalizedEvent,
): Promise<'processed' | 'duplicate'> {
  await connectDB();

  // Same fail-closed contract as Stripe: required indexes must be
  // verified before any webhook write. Throws before the claim →
  // route 500 → Paddle retries once indexes are ready.
  await ensureBillingIndexes();

  try {
    await BillingEvent.create({
      // Legacy fields stay populated during the transition — see
      // models/BillingEvent.ts. Paddle event IDs are UUIDs and can
      // never collide with Stripe evt_… IDs.
      stripeEventId: event.providerEventId,
      type: event.eventType,
      provider: 'paddle',
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      processingStatus: 'processing',
    });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      return 'duplicate';
    }
    throw error;
  }

  try {
    if (event.eventType.startsWith('subscription.')) {
      /*
        subscription.* events carry the full subscription entity in
        the signature-verified payload — the same trust level as the
        Stripe subscription.* path. Normalize → guarded sync.
      */
      const subscription = asPaddleSubscription(event.data);
      const normalized = normalizePaddleSubscription(
        subscription,
        event.occurredAt,
      );
      const result = await syncSubscriptionFromPaddle(normalized);
      logger.info(
        {
          eventId: event.providerEventId,
          type: event.eventType,
          subscriptionId: normalized.providerSubscriptionId,
          result,
        },
        'Paddle subscription sync',
      );
    } else if (
      event.eventType === 'transaction.completed' ||
      event.eventType === 'transaction.paid' ||
      event.eventType === 'transaction.payment_failed'
    ) {
      /*
        Transaction events reference a subscription — retrieve the
        AUTHORITATIVE subscription state from the Paddle API before
        syncing (same D1 rule as Stripe invoice events: never write
        status from payment events directly). Covers delayed or
        missed subscription.* deliveries.
      */
      const transaction = asPaddleTransaction(event.data);
      const subscriptionId = paddleTransactionSubscriptionId(transaction);

      if (!subscriptionId) {
        logger.warn(
          { eventId: event.providerEventId, type: event.eventType },
          'Paddle transaction event without subscription reference',
        );
      } else {
        const subscription =
          await retrievePaddleSubscription(subscriptionId);
        if (!subscription) {
          logger.warn(
            {
              eventId: event.providerEventId,
              subscriptionId,
            },
            'Paddle transaction references missing subscription',
          );
        } else {
          /*
            Correlate the transaction back to its checkout
            reservation. Paddle.js customData lands on the
            TRANSACTION — it is not guaranteed to propagate onto the
            subscription entity, so stamp the reservation directly
            and carry the reservation ID into normalization for
            owner resolution.
          */
          const txnCustomData = (transaction.customData ?? null) as Record<
            string,
            unknown
          > | null;
          const reservationId =
            typeof txnCustomData?.checkoutReservationId === 'string'
              ? txnCustomData.checkoutReservationId
              : null;
          if (reservationId) {
            // Only a live Paddle reservation may be stamped — a
            // Stripe or dead reservation can never anchor Paddle
            // transaction correlation.
            await CheckoutReservation.updateOne(
              {
                _id: reservationId,
                provider: 'paddle',
                status: 'pending',
              },
              { $set: { paddleTransactionId: transaction.id } },
            );
          }

          const normalized = normalizePaddleSubscription(
            subscription,
            event.occurredAt,
          );
          if (
            reservationId &&
            normalized.customData?.checkoutReservationId !== reservationId
          ) {
            normalized.customData = {
              ...(normalized.customData ?? {}),
              checkoutReservationId: reservationId,
            };
          }
          /*
            Charge totals are only meaningful for successful
            payments — payment_failed transactions carry no money
            movement and must not overwrite the last-payment
            snapshot.
          */
          const transactionSnapshot =
            event.eventType === 'transaction.payment_failed'
              ? null
              : extractPaddleTransactionSnapshot(transaction);
          const result = await syncSubscriptionFromPaddle(normalized, {
            paddleTransactionId: transaction.id,
            transactionSnapshot,
          });
          logger.info(
            {
              eventId: event.providerEventId,
              type: event.eventType,
              subscriptionId,
              transactionId: transaction.id,
              result,
            },
            'Paddle transaction event — subscription synced',
          );
        }
      }
    } else {
      logger.info(
        { eventId: event.providerEventId, type: event.eventType },
        'Unhandled Paddle event',
      );
    }

    await BillingEvent.updateOne(
      { provider: 'paddle', providerEventId: event.providerEventId },
      { $set: { processingStatus: 'processed', processedAt: new Date() } },
    );
  } catch (error) {
    // Release the idempotency claim so Paddle's retry can reprocess.
    try {
      await BillingEvent.deleteOne({
        provider: 'paddle',
        providerEventId: event.providerEventId,
      });
    } catch (cleanupError) {
      logger.error(
        { err: cleanupError, eventId: event.providerEventId },
        'Failed to release Paddle BillingEvent claim',
      );
    }
    throw error;
  }

  return 'processed';
}

/* ------------------------------------------------------------------ */
/* Plan-limit enforcement                                              */
/* ------------------------------------------------------------------ */

export async function assertPlanLimit(input: {
  userId: string;
  workspaceId?: string | null;
  resource: 'projects' | 'members' | 'workspaces';
  currentCount: number;
}): Promise<BillingResult<null>> {
  const plan = await getEffectivePlan(input.userId, input.workspaceId);
  const limits = limitsForPlan(plan);
  const limit =
    input.resource === 'projects'
      ? limits.maxProjectsPerWorkspace
      : input.resource === 'members'
        ? limits.maxMembersPerWorkspace
        : limits.maxOwnedWorkspaces;

  // null limit = unlimited for this resource on this plan.
  if (limit !== null && input.currentCount >= limit) {
    const code =
      input.resource === 'projects'
        ? 'PROJECT_LIMIT_REACHED'
        : input.resource === 'members'
          ? 'MEMBER_LIMIT_REACHED'
          : 'WORKSPACE_LIMIT_REACHED';
    return {
      ok: false,
      status: 403,
      code,
      error: `Plan limit reached (${PLANS[plan].name}: ${limit} ${input.resource}). Upgrade to continue.`,
    };
  }
  return { ok: true, data: null };
}
