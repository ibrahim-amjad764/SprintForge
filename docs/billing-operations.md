# Billing Operations Runbook

SprintForge billing supports two providers behind a provider-neutral
projection in MongoDB (`subscriptions` collection). Stripe and Paddle
webhooks are signature-verified, idempotent, and synchronize the same
`Subscription` document shape. Client code never grants entitlements —
all plan state flows from verified provider webhooks.

## Providers

| | Stripe | Paddle |
|---|---|---|
| Checkout | Server-created Checkout Session → redirect | Paddle.js overlay (`Paddle.Checkout.open`) |
| Webhook | `POST /api/billing/webhook` | `POST /api/billing/webhook/paddle` |
| Signature | `stripe-signature` + `STRIPE_WEBHOOK_SECRET` | `Paddle-Signature` + `PADDLE_WEBHOOK_SECRET` (SDK `unmarshal`, ±5s replay tolerance) |
| New subscriptions | Supported (default provider) | **Primary for new PRO** |
| Portal | Stripe Billing Portal | Paddle Customer Portal (`customerPortalSessions`) |

Paddle is the primary provider for NEW Pro purchases when
`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` is configured; Stripe remains fully
supported for existing customers and as the fallback when Paddle is
unconfigured. There is intentionally **no automatic provider fallback**
after a failed attempt — a pending reservation may already exist.

## Environment variables

Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_KEY`, `STRIPE_PRICE_{PRO,TEAM}_{MONTHLY,YEARLY}`.

Paddle: `PADDLE_ENV` (`sandbox`|`production`), `PADDLE_API_KEY`,
`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_PRO_{MONTHLY,YEARLY}`,
`PADDLE_WEBHOOK_SECRET`. Validate shape (never values) via
`getPaddleEnvStatus()` in `lib/paddle.ts`.

## Webhook event coverage

### Paddle (`handlePaddleEvent`)

| Event | Handling |
|---|---|
| `subscription.*` (created/updated/canceled/past_due/paused/resumed/activated/trialing/imported) | Normalize signed payload → guarded sync |
| `transaction.completed` / `transaction.paid` / `transaction.payment_failed` | Retrieve **authoritative** subscription via API → sync; stamp `paddleTransactionId` on reservation |
| `transaction.*` other (ready/created/updated/billed/past_due/canceled/revised), `adjustment.*`, `payout.*`, `customer.*`, etc. | Logged + marked processed (no-op) |

### Stripe (`handleStripeEvent`)

Unchanged: `checkout.session.completed` (authoritative subscription
retrieve), `checkout.session.expired`, `customer.subscription.*`,
`invoice.*` — all via `syncSubscriptionFromStripe`.

### Idempotency & ordering

- `BillingEvent` claim on `{provider, providerEventId}` (compound
  partial unique) + legacy `stripeEventId` slot during transition.
- Duplicate delivery → `'duplicate'` → 200 no-op.
- Transient failure → claim released → 500 → provider retries.
- Stale guard: `lastProviderEventAt` (Paddle) / `lastStripeEventAt`
  (Stripe) inside the atomic update filter — out-of-order events
  cannot regress state.

## Entitlement semantics

`getEffectivePlan()` grants the plan only for `trialing`, `past_due`
(dunning grace — period-end exempt), or `active` **with an unexpired
`currentPeriodEnd`**. `canceled`, `paused`, `unpaid`, `incomplete`,
`incomplete_expired` → FREE. Paddle `past_due` follows the same grace
rule as Stripe. Paddle `scheduledChange.action === 'cancel'` maps to
`cancelAtPeriodEnd`; `subscription.canceled` arrives at period end.

## Checkout reservations

`CheckoutReservation` is a scope lock + correlation token — it NEVER
grants entitlement. One pending reservation per `{user, workspace}`
**regardless of provider** (partial unique index). Paddle reservations
have no server-side payable artifact; `expiresAt` = created + 23h and
the expiry sweep applies the same 1h tail as session-less Stripe
reservations — this is intentional: a completed Paddle transaction's
webhook may still be in flight, and releasing early could allow a
second payable checkout.

States: `pending` → `completed` (verified entitled sync) | `expired`
(TTL sweep) | `released` (definitive failure / plan change with no
payable artifact).

## Unmapped-price recovery (CRITICAL alert path)

Symptom: log `CRITICAL: paid subscription price not mapped to plan
catalog`. The customer may have been CHARGED without entitlement.

1. Do NOT grant PRO manually — fix the mapping first.
2. Stripe: correct `STRIPE_PRICE_*` env → resend the event in the
   Stripe dashboard (or `billing-backfill.mjs --apply --stripe-reconcile`).
3. Paddle: correct `PADDLE_PRICE_*` env → resend the notification in
   Paddle dashboard (Developer tools → Notifications → event →
   resend). There is no Paddle equivalent of `--stripe-reconcile` yet;
   the resent `subscription.*`/`transaction.*` event re-runs
   authoritative sync and completes the pending reservation.
4. Verify: `GET /api/billing/subscription` shows PRO; reservation
   status `completed`.

## Refunds / adjustments

`adjustment.*` events are acknowledged but not actioned. A Paddle
refund does NOT automatically revoke PRO — ops must cancel the
subscription (Paddle portal or API) so `subscription.canceled`
propagates. Stripe refunds behave the same (no automatic revoke).
Consider this a manual ops step until automated handling is added.

## Database indexes & migration

`ensureBillingIndexes()` verifies/creates 8 required indexes before
checkout/webhook writes and fails closed on wrong definitions:
`workspace_1_user_1_entitled`, `stripeSubscriptionId_1`,
`provider_1_providerSubscriptionId_1`, `provider_1_providerEventId_1`,
`user_1_workspace_1` (pending reservations), `stripeCheckoutSessionId_1`,
`status_1_expiresAt_1`, `paddleTransactionId_1`.

`scripts/billing-migrate-paddle.mjs` backfills `provider` fields on
legacy rows — **dry-run by default**, `--apply` requires explicit
approval. Dev DB dry-run (2026-11) showed 0 rows needing backfill.
`scripts/billing-backfill.mjs` reconciles `entitled` flags +
Stripe-authoritative drift (Stripe-only).

## Customer portal

`POST /api/billing/portal` dispatches on the latest subscription's
`provider` (missing ⇒ stripe). Paddle → `customerPortalSessions.create`
→ `urls.general.overview` (payment method, cancellation, invoices).
Stripe → Billing Portal. Owner-only for workspace scope; 404 without
a billing account; 503 when the provider is unconfigured.

## Sandbox vs production separation

- `PADDLE_ENV=production` must be set explicitly; unset ⇒ sandbox.
- Sandbox uses `pdl_sdbx_…` API keys and `test_…` client tokens.
- Never reuse sandbox `pri_…` IDs in production — price IDs are
  environment-scoped.
- `.env.production` currently holds no Paddle vars.

## Pending (hosting-dependent) validation — P7.9.2B

NOT yet performed — requires public HTTPS endpoint:
- Paddle notification destination + `PADDLE_WEBHOOK_SECRET`
- Real webhook delivery → entitlement activation
- Live Paddle.js overlay checkout in browser
- Portal session against real Paddle customer
- Renewal/cancellation webhook round-trip

## Ops quick reference

| Task | Where |
|---|---|
| Env validation (names only) | `getPaddleEnvStatus()` |
| Index readiness | `ensureBillingIndexes()` (auto, fail-closed) |
| Backfill provider fields | `scripts/billing-migrate-paddle.mjs` (dry-run → `--apply`) |
| Entitlement/backfill reconcile | `scripts/billing-backfill.mjs` (Stripe-aware) |
| Billing UI state | `GET /api/billing/subscription` |
