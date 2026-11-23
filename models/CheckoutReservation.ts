// models/CheckoutReservation.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
CheckoutReservation — atomic, durable lock for the checkout flow.

Purpose: prevent two concurrent (or retried) checkout requests from
creating multiple payable Stripe Checkout Sessions for the same
billing scope, which could lead to double billing.

This is NOT a subscription and NEVER grants entitlements —
getEffectivePlan only reads the Subscription collection. A
reservation is reconciled to 'completed' by verified webhook state
(checkout.session.completed / subscription sync) or expires on its
own TTL.

Ownership model mirrors Subscription:
- `workspace` set  → workspace-level billing scope
- `workspace` null → user-level billing scope
*/

export type CheckoutReservationStatus =
  | 'pending'   // session creation in flight or payable session exists
  | 'completed' // webhook confirmed the checkout produced a subscription
  | 'expired'   // Stripe session / reservation TTL elapsed
  | 'released'; // creation failed definitively; safe to retry

export interface ICheckoutReservation {
  user: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId | null;
  plan: string;
  interval: 'month' | 'year';
  status: CheckoutReservationStatus;
  // Billing provider — absent on legacy rows ⇒ 'stripe'. The
  // pending-scope unique index is provider-agnostic: one pending
  // checkout per scope regardless of provider (prevents
  // cross-provider double billing).
  provider?: 'stripe' | 'paddle';
  stripeCheckoutSessionId?: string;
  checkoutUrl?: string;
  // Paddle lifecycle: transaction ID (txn_…) linked by webhook,
  // expected price ID verified server-side at checkout creation.
  paddleTransactionId?: string;
  paddlePriceId?: string;
  // Stripe Checkout Session expiry (unix-derived). A session is
  // payable until this time; the reservation must never be released
  // while a payable session exists.
  sessionExpiresAt?: Date;
  // Reservation TTL — bounds how long a crashed/in-flight creation
  // can hold the scope lock. Aligned to Stripe's ~24h session life.
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CheckoutReservationSchema = new Schema<ICheckoutReservation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
    },
    plan: { type: String, required: true },
    interval: { type: String, enum: ['month', 'year'], required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired', 'released'],
      required: true,
      default: 'pending',
    },
    provider: {
      type: String,
      enum: ['stripe', 'paddle'],
    },
    stripeCheckoutSessionId: { type: String },
    checkoutUrl: { type: String },
    paddleTransactionId: { type: String },
    paddlePriceId: { type: String },
    sessionExpiresAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

/*
  Atomic acquisition: at most ONE pending reservation per billing
  scope. Concurrent createCheckoutSession calls race on insert —
  the loser gets E11000 and must reuse/reject instead of creating a
  second Stripe session. Non-pending statuses never block, so
  completed/expired/released history accumulates safely.
*/
CheckoutReservationSchema.index(
  { user: 1, workspace: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
// Webhook lookup: checkout.session.completed / .expired carry the
// Stripe session ID, not our scope.
CheckoutReservationSchema.index({ stripeCheckoutSessionId: 1 });
// Paddle webhook lookup by transaction ID (txn_…).
CheckoutReservationSchema.index({ paddleTransactionId: 1 });
// Lazy expiry sweeps scan pending rows past their TTL.
CheckoutReservationSchema.index({ status: 1, expiresAt: 1 });

const CheckoutReservation: Model<ICheckoutReservation> =
  mongoose.models.CheckoutReservation ||
  mongoose.model<ICheckoutReservation>(
    'CheckoutReservation',
    CheckoutReservationSchema,
  );

export default CheckoutReservation;
