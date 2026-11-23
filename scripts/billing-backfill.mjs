#!/usr/bin/env node
/*
SprintForge — Subscription `entitled` backfill & reconciliation.

PURPOSE
  P6.1 introduced `Subscription.entitled` (denormalized flag backing
  the partial unique index that prevents two entitled subscriptions
  per billing scope) and P6.3 introduced CheckoutReservation. Documents
  synced before P6.1 lack `entitled`, so they are invisible to the
  uniqueness index until reconciled.

USAGE (run from repo root; NEVER against production without approval)
  Dry run (default — READ ONLY, prints plan):
    node --env-file=.env.local scripts/billing-backfill.mjs

  Apply entitlement backfill + duplicate audit + index ensure:
    node --env-file=.env.local scripts/billing-backfill.mjs --apply

  Additionally reconcile every non-terminal subscription against the
  Stripe API (requires STRIPE_SECRET_KEY in env; uses live data —
  test mode only unless explicitly approved):
    node --env-file=.env.local scripts/billing-backfill.mjs --apply --stripe-reconcile

WHAT IT DOES
  1. Loads all Subscription documents.
  2. Computes the correct `entitled` value per document:
       entitled = statusGrantsPlan(status)
                  && (status !== 'active' || currentPeriodEnd != null)
     (mirrors services/billing.service.ts sync logic)
  3. Audits for duplicate entitled subscriptions per {user, workspace}
     scope — these MUST be resolved before the unique index can build.
  4. With --stripe-reconcile: retrieves each non-terminal subscription
     from Stripe and reports drift (local vs remote status/period/plan).
     With --apply it persists the Stripe-authoritative state.
  5. With --apply: writes corrected `entitled` flags and ensures the
     partial unique index exists.

ROLLBACK
  - The `entitled` field is additive: removing it (or leaving stale
    values) does not affect reads — getEffectivePlan queries status +
    currentPeriodEnd directly.
  - Drop the index: db.subscriptions.dropIndex('workspace_1_user_1_entitled')
  - CheckoutReservation is a new collection; dropping it only removes
    in-flight checkout locks (pending sessions expire naturally).

SAFETY
  - Default is dry-run: zero writes.
  - --apply refuses to create the unique index while duplicate
    entitled scopes exist.
  - Never logs secrets, Stripe keys, or customer PII beyond IDs.
*/

import mongoose from 'mongoose';
import Stripe from 'stripe';

const APPLY = process.argv.includes('--apply');
const STRIPE_RECONCILE = process.argv.includes('--stripe-reconcile');

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

function statusGrantsPlan(status) {
  return ENTITLED_STATUSES.has(status);
}

function computeEntitled(doc) {
  return (
    statusGrantsPlan(doc.status) &&
    (doc.status !== 'active' || doc.currentPeriodEnd != null)
  );
}

function scopeKey(doc) {
  return `${doc.user}:${doc.workspace ?? 'null'}`;
}

const TERMINAL = new Set([
  'canceled',
  'incomplete_expired',
  'unpaid',
  'paused',
]);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const coll = db.collection('subscriptions');

  const docs = await coll.find({}).toArray();
  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (read-only)'}`);
  console.log(`Subscriptions found: ${docs.length}`);

  // --- 1. entitled drift -------------------------------------------
  const drift = docs.filter((d) => (d.entitled ?? false) !== computeEntitled(d));
  console.log(`entitled drift: ${drift.length} document(s) need update`);
  for (const d of drift.slice(0, 20)) {
    console.log(
      `  ${d._id} sub=${d.stripeSubscriptionId} status=${d.status} ` +
        `entitled ${d.entitled ?? 'unset'} -> ${computeEntitled(d)}`,
    );
  }

  // --- 2. duplicate entitled scopes ---------------------------------
  const entitledDocs = docs.filter((d) => computeEntitled(d));
  const byScope = new Map();
  for (const d of entitledDocs) {
    const k = scopeKey(d);
    byScope.set(k, [...(byScope.get(k) ?? []), d]);
  }
  const dupes = [...byScope.entries()].filter(([, v]) => v.length > 1);
  console.log(`duplicate entitled scopes: ${dupes.length}`);
  for (const [scope, list] of dupes) {
    console.log(
      `  scope ${scope}: ${list.map((d) => d.stripeSubscriptionId).join(', ')}`,
    );
  }

  // --- 3. Stripe reconciliation -------------------------------------
  if (STRIPE_RECONCILE) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes('your_')) {
      console.error('STRIPE_SECRET_KEY missing/placeholder — cannot reconcile.');
      process.exit(1);
    }
    const stripe = new Stripe(key);
    const nonTerminal = docs.filter((d) => !TERMINAL.has(d.status));
    console.log(`Reconciling ${nonTerminal.length} non-terminal subscription(s) against Stripe...`);
    for (const d of nonTerminal) {
      try {
        const remote = await stripe.subscriptions.retrieve(d.stripeSubscriptionId);
        const remoteEntitled =
          statusGrantsPlan(remote.status) &&
          (remote.status !== 'active' ||
            (remote.current_period_end ?? remote.items?.data?.[0]?.current_period_end) != null);
        const driftNote =
          remote.status !== d.status || remoteEntitled !== computeEntitled(d)
            ? 'DRIFT'
            : 'ok';
        console.log(
          `  ${d.stripeSubscriptionId}: local=${d.status} remote=${remote.status} -> ${driftNote}`,
        );
        if (APPLY && driftNote === 'DRIFT') {
          await coll.updateOne(
            { _id: d._id },
            {
              $set: {
                status: remote.status,
                entitled: remoteEntitled,
                currentPeriodEnd:
                  remote.current_period_end != null
                    ? new Date(remote.current_period_end * 1000)
                    : d.currentPeriodEnd,
                lastStripeEventAt: new Date(),
              },
            },
          );
        }
      } catch (err) {
        const code = err?.code ?? err?.statusCode;
        console.log(
          `  ${d.stripeSubscriptionId}: retrieve failed (${code ?? err.message}) — skipped`,
        );
      }
    }
  }

  // --- 4. apply ------------------------------------------------------
  if (APPLY) {
    if (dupes.length > 0) {
      console.error(
        'REFUSING to proceed: duplicate entitled scopes exist. ' +
          'Resolve them manually (cancel duplicates in Stripe) and re-run.',
      );
      process.exit(2);
    }

    let updated = 0;
    for (const d of drift) {
      const res = await coll.updateOne(
        { _id: d._id },
        { $set: { entitled: computeEntitled(d) } },
      );
      updated += res.modifiedCount;
    }
    console.log(`entitled backfill: ${updated} document(s) updated`);

    try {
      await coll.createIndex(
        { workspace: 1, user: 1 },
        {
          unique: true,
          partialFilterExpression: { entitled: true },
          name: 'workspace_1_user_1_entitled',
        },
      );
      console.log('partial unique index ensured: workspace_1_user_1_entitled');
    } catch (err) {
      if (err?.code === 85 || err?.codeName === 'IndexOptionsConflict') {
        console.log('index already exists with same spec — ok');
      } else {
        throw err;
      }
    }
  } else {
    console.log('Dry run complete — re-run with --apply to write.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('backfill failed:', err.message);
  process.exit(1);
});
