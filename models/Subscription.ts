// models/Subscription.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
Subscription — synchronized copy of Stripe subscription state.

Stripe is the billing authority; this document is the app's
read-optimized projection. All writes flow through webhook
handlers in services/billing.service.ts — never trust client
input for plan/status/period fields.

Ownership model:
- `workspace` set  → workspace-level subscription (billing scoped
                     to that workspace; members inherit entitlements)
- `workspace` null → user-level subscription (personal plan)
*/

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface ISubscription {
  user: mongoose.Types.ObjectId;
  workspace?: mongoose.Types.ObjectId | null;
  plan: string;
  interval?: 'month' | 'year';
  status: SubscriptionStatus | string;
  // Denormalized entitlement flag (statusGrantsPlan(status)).
  // Backs the partial unique index preventing two entitled
  // subscriptions per billing scope.
  entitled?: boolean;
  // Billing provider. Absent on legacy documents ⇒ 'stripe'.
  // Never rely on the schema default to backfill existing rows —
  // queries must treat a missing provider as 'stripe'.
  provider?: 'stripe' | 'paddle';
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  paddleTransactionId?: string;
  /*
    Billing amount snapshots — populated exclusively from
    provider-verified webhook data. `priceCents`/`priceCurrency` is
    the recurring subscription unit price (Paddle
    items[0].price.unitPrice); lastTransaction* records the most
    recent successful charge totals (tax/discount inclusive —
    distinct from the recurring price). Null on legacy docs and
    providers that don't supply amounts; never client-supplied.
  */
  priceCents?: number | null;
  priceCurrency?: string | null;
  lastTransactionTotalCents?: number | null;
  lastTransactionCurrency?: string | null;
  lastTransactionTaxCents?: number | null;
  lastTransactionDiscountCents?: number | null;
  lastTransactionAt?: Date | null;
  // Legacy Stripe fields — required relaxed for Paddle documents.
  // stripeSubscriptionId remains populated for Paddle rows too
  // (it holds the provider-native subscription ID) because the
  // pre-existing unique index cannot admit multiple missing values.
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date;
  // Stale-event guard: webhooks older than this are ignored.
  lastStripeEventAt?: Date;
  // Provider-neutral stale-event guard used by Paddle sync.
  lastProviderEventAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    plan: {
      type: String,
      required: true,
      default: 'FREE',
    },
    interval: {
      type: String,
      enum: ['month', 'year'],
    },
    status: {
      type: String,
      required: true,
      default: 'active',
    },
    entitled: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ['stripe', 'paddle'],
    },
    providerCustomerId: String,
    providerSubscriptionId: String,
    paddleTransactionId: String,
    priceCents: { type: Number, default: null },
    priceCurrency: { type: String, default: null },
    lastTransactionTotalCents: { type: Number, default: null },
    lastTransactionCurrency: { type: String, default: null },
    lastTransactionTaxCents: { type: Number, default: null },
    lastTransactionDiscountCents: { type: Number, default: null },
    lastTransactionAt: { type: Date, default: null },
    stripeCustomerId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
      unique: true,
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: Date,
    lastStripeEventAt: Date,
    lastProviderEventAt: Date,
  },
  { timestamps: true }
);

// One active subscription per user+workspace scope. Enforced at
// the service layer (Stripe allows multiple subs; the app does
// not) — index supports the lookup, uniqueness is app-managed.
SubscriptionSchema.index({ user: 1, workspace: 1 });
// At most ONE entitled subscription per billing scope. Partial index
// only covers docs with entitled:true, so canceled/expired
// subscriptions never block a new purchase. Requires the `entitled`
// field to be maintained by syncSubscriptionFromStripe.
// Key order differs from the lookup index above on purpose: MongoDB
// rejects a second index on the identical {user,workspace} pattern,
// and uniqueness is key-order independent, so {workspace,user}
// enforces the same constraint without colliding.
SubscriptionSchema.index(
  { workspace: 1, user: 1 },
  { unique: true, partialFilterExpression: { entitled: true } },
);
SubscriptionSchema.index({ stripeCustomerId: 1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
/*
  Provider-scoped subscription uniqueness for Paddle rows. Partial
  filter excludes legacy Stripe docs (no providerSubscriptionId) so
  the index builds safely without a migration.
*/
SubscriptionSchema.index(
  { provider: 1, providerSubscriptionId: 1 },
  {
    unique: true,
    name: 'provider_1_providerSubscriptionId_1',
    partialFilterExpression: { providerSubscriptionId: { $exists: true } },
  },
);

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export default Subscription;
