// models/BillingEvent.ts
import mongoose, { Schema, Model } from 'mongoose';

/*
BillingEvent — webhook idempotency ledger.

Stripe and Paddle both deliver events at-least-once. Before
processing any webhook we insert a claim row; unique indexes make
duplicate deliveries a no-op. Documents contain no payload — only
event identifiers, type, and processing timestamps.

Provider-neutral design (P7.2/P7.4):
- `provider` + `providerEventId` are the authoritative dedup key,
  enforced by a compound unique index.
- `stripeEventId`/`type` are LEGACY fields retained for backward
  compatibility. During the transition every webhook — Stripe or
  Paddle — still populates them (stripeEventId carries the
  provider-native event ID) because the pre-existing
  stripeEventId_1 unique index cannot be dropped without a
  migration. A future migration will backfill provider fields on
  historical rows and retire the legacy fields.
*/

export type BillingEventProvider = 'stripe' | 'paddle';
export type BillingEventProcessingStatus =
  | 'processing'
  | 'processed'
  | 'failed';

export interface IBillingEvent {
  // Legacy fields — populated for ALL providers during transition
  // (see header). stripeEventId is globally unique across providers
  // because Stripe evt_… IDs and Paddle UUIDs cannot collide.
  stripeEventId: string;
  type: string;
  processedAt: Date;
  // Provider-neutral fields (P7.4)
  provider?: BillingEventProvider;
  providerEventId?: string;
  eventType?: string;
  occurredAt?: Date;
  processingStatus?: BillingEventProcessingStatus;
}

const BillingEventSchema = new Schema<IBillingEvent>(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    provider: {
      type: String,
      enum: ['stripe', 'paddle'],
    },
    providerEventId: { type: String },
    eventType: { type: String },
    occurredAt: Date,
    processingStatus: {
      type: String,
      enum: ['processing', 'processed', 'failed'],
    },
  },
  { timestamps: false }
);

BillingEventSchema.index({ processedAt: 1 });

/*
  Authoritative provider-scoped dedup key. Partial filter excludes
  legacy rows that predate the provider fields (they have no
  providerEventId) so the index builds safely on existing data —
  no migration required before it can be created.
*/
BillingEventSchema.index(
  { provider: 1, providerEventId: 1 },
  {
    unique: true,
    name: 'provider_1_providerEventId_1',
    partialFilterExpression: { providerEventId: { $exists: true } },
  },
);
BillingEventSchema.index({ processingStatus: 1, processedAt: 1 });

const BillingEvent: Model<IBillingEvent> =
  mongoose.models.BillingEvent ||
  mongoose.model<IBillingEvent>('BillingEvent', BillingEventSchema);

export default BillingEvent;
