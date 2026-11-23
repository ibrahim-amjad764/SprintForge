#!/usr/bin/env node
/*
SprintForge — Provider-field backfill for Paddle integration (P7.4).

PURPOSE
  P7.4 added provider-neutral fields to BillingEvent,
  Subscription, and CheckoutReservation. Documents written before
  this change lack them. This script backfills the provider fields
  on EXISTING rows so the provider-scoped indexes and future
  provider-aware queries see a consistent dataset.

  IMPORTANT: the app is already correct WITHOUT this backfill —
  schema defaults do not update existing rows, and every read path
  treats a missing `provider` as 'stripe'. This migration is
  hygiene + index-readiness preparation, not a correctness fix.

USAGE (run from repo root; NEVER against production without approval)
  Dry run (default — READ ONLY, prints plan):
    node --env-file=.env.local scripts/billing-migrate-paddle.mjs

  Apply backfill:
    node --env-file=.env.local scripts/billing-migrate-paddle.mjs --apply

WHAT IT DOES (per collection)
  billingevents:
    provider='stripe', providerEventId=stripeEventId,
    eventType=type, occurredAt=processedAt,
    processingStatus='processed' — only on rows missing provider.
  subscriptions:
    provider='stripe' — only on rows missing provider.
    providerSubscriptionId=stripeSubscriptionId is intentionally
    NOT backfilled: Stripe rows keep their legacy identity fields;
    the provider-scoped unique index's partial filter excludes them.
  checkoutreservations:
    provider='stripe' — only on rows missing provider.

ROLLBACK
  - All writes are additive field sets on existing documents.
    Reverting = unset the fields (or simply redeploy prior code —
    old code ignores unknown fields).
  - No indexes are dropped. The new partial unique indexes
    (provider_1_providerEventId_1, provider_1_providerSubscriptionId_1)
    self-exclude rows lacking the new fields, so they are safe to
    keep regardless of backfill state.

SAFETY
  - Default is dry-run: zero writes.
  - --apply performs batched updateOne writes with {provider:{$exists:false}}
    filters — idempotent and safe to re-run.
  - Never logs secrets or PII beyond document IDs.
*/

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — run with --env-file=.env.local');
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const report = { billingevents: 0, subscriptions: 0, checkoutreservations: 0 };

// ---- billingevents -------------------------------------------------
{
  const coll = db.collection('billingevents');
  const filter = { provider: { $exists: false } };
  const count = await coll.countDocuments(filter);
  report.billingevents = count;
  console.log(`billingevents: ${count} rows missing provider fields`);
  if (APPLY && count > 0) {
    const cursor = coll.find(filter, {
      projection: { stripeEventId: 1, type: 1, processedAt: 1 },
    });
    let n = 0;
    for await (const doc of cursor) {
      await coll.updateOne(
        { _id: doc._id },
        {
          $set: {
            provider: 'stripe',
            providerEventId: doc.stripeEventId,
            eventType: doc.type,
            occurredAt: doc.processedAt ?? new Date(),
            processingStatus: 'processed',
          },
        },
      );
      n++;
      if (n % 500 === 0) console.log(`  …${n}/${count}`);
    }
    console.log(`  applied ${n} updates`);
  }
}

// ---- subscriptions -------------------------------------------------
{
  const coll = db.collection('subscriptions');
  const filter = { provider: { $exists: false } };
  const count = await coll.countDocuments(filter);
  report.subscriptions = count;
  console.log(`subscriptions: ${count} rows missing provider field`);
  if (APPLY && count > 0) {
    const res = await coll.updateMany(filter, { $set: { provider: 'stripe' } });
    console.log(`  applied ${res.modifiedCount} updates`);
  }
}

// ---- checkoutreservations -------------------------------------------
{
  const coll = db.collection('checkoutreservations');
  const filter = { provider: { $exists: false } };
  const count = await coll.countDocuments(filter);
  report.checkoutreservations = count;
  console.log(`checkoutreservations: ${count} rows missing provider field`);
  if (APPLY && count > 0) {
    const res = await coll.updateMany(filter, { $set: { provider: 'stripe' } });
    console.log(`  applied ${res.modifiedCount} updates`);
  }
}

console.log(
  APPLY
    ? 'Done (apply mode).'
    : 'Dry run complete — re-run with --apply to write (requires approval).',
);
console.log('Rows scanned:', JSON.stringify(report));

await mongoose.disconnect();
