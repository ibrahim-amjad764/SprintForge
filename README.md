# SprintForge

A full-stack project management application built with Next.js 16, React 19, TypeScript, and MongoDB. SprintForge provides workspaces, projects, tasks (list / Kanban / calendar views), teams, time tracking, real-time collaboration via Socket.IO, AI-assisted task tools, workspace analytics, and Stripe subscription billing — with dark/light theming and a comprehensive automated test suite.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Authentication & Authorization](#authentication--authorization)
- [API Reference](#api-reference)
- [Search](#search)
- [Analytics & CSV Export](#analytics--csv-export)
- [Billing](#billing)
- [Realtime](#realtime)
- [Theming](#theming)
- [Error Handling & Logging](#error-handling--logging)
- [Rate Limiting & Security](#rate-limiting--security)
- [Configuration](#configuration)
- [Installation & Development](#installation--development)
- [Testing](#testing)
- [Build & Deployment](#build--deployment)
- [Known Limitations & Technical Debt](#known-limitations--technical-debt)
- [Agent Notes](#agent-notes)

## Features

- **Workspaces** — create/manage workspaces with slug validation, members, roles, and settings
- **Projects** — workspace-scoped projects with status (PLANNING/ACTIVE/COMPLETED/ARCHIVED) and computed progress
- **Tasks** — CRUD with priority, status, assignee, due date; list, Kanban board, and calendar views
- **Teams & comments** — workspace teams and per-task comments
- **Time tracking** — start/stop timers and time entries per task
- **File uploads** — Cloudinary-backed uploads with MIME/size validation
- **Notifications** — in-app notifications with unread counts
- **Search** — debounced global search across tasks, projects, and users
- **Analytics** — completion metrics, per-user workload, weekly velocity, CSV export
- **AI features** — OpenAI-powered task breakdown, summaries, and description generation (rate-limited)
- **Billing** — Stripe checkout, customer portal, webhook-synced subscriptions, plan limits (FREE/PRO/TEAM)
- **Realtime** — Socket.IO rooms for workspaces/projects; live task, comment, and notification events
- **Theming** — dark/light mode with persistence and no-flash boot
- **Admin** — admin stats, user management, workspace overview, log access

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.4.6 (App Router, Turbopack) |
| UI | React 19.2.4, Tailwind CSS v4, shadcn-style tokens, Base UI, Recharts, react-big-calendar |
| Language | TypeScript 5 (`strict: true`) |
| Database | MongoDB + Mongoose 9.11 |
| Auth | JWT (`jose`) in HttpOnly cookie + DB-backed `tokenVersion` |
| Realtime | Socket.IO 4.8 (dedicated HTTP server via `instrumentation.ts`) |
| Payments | Stripe (`stripe` SDK, checkout + portal + webhooks) |
| AI | OpenAI SDK |
| Email | Resend (transactional, retry w/ backoff) |
| Files | Cloudinary |
| Logging | Pino (structured, secret-redacting) |
| Errors | Sentry (`@sentry/nextjs`, optional via DSN) |
| Testing | Jest + @testing-library, mongodb-memory-server, Playwright |

## Architecture

```
Browser ──HTTPS──> Next.js App Router (pages + API routes)
                     │  middleware.ts: JWT verify, protected-path guard, x-request-id
                     ▼
              lib/session.ts / lib/auth.ts  (cookie JWT + tokenVersion + CSRF origin check)
                     ▼
              services/*.service.ts        (business logic, authorization via lib/authorization.ts)
                     ▼
              models/*.ts (Mongoose)  ──>  MongoDB

Socket.IO server: separate http.Server on SOCKET_PORT (default 3001),
started by instrumentation.ts register() in the Node runtime only.
```

Key conventions:

- **Response envelope** — `utils/response.ts`: `{ success: true, data, message? }` / `{ success: false, message }`. 500s go through `apiError()` in `utils/error-handler.ts`, which logs the real error via Pino and returns a generic client message (no internal leakage).
- **Auth** — `requireSession(request)` / `requireAdmin(request)` return `{ user }` or `{ response }`. Never trust client-supplied user IDs or roles.
- **Workspace RBAC** — `WorkspaceMember` roles `OWNER > ADMIN > EDITOR > COMMENTER > VIEWER`; `lib/authorization.ts` provides `canWriteWorkspace`/`canCommentWorkspace`/`getWorkspaceMembership` (falls back to `Workspace.owner` → OWNER).
- **Page guards** — `lib/page-guards.ts` for SSR pages (`requirePageUserId`, `requireWorkspaceAccess`, `requireProjectInWorkspace`, `requireTaskAccess`).
- **Pagination** — `lib/pagination.ts` offset pagination (`page`, `limit`; default 20, max 100) returning `{ items, total, page, limit, hasMore }`.

## Project Structure

```
app/                  Next.js App Router
  (auth)/             login, register, forgot-password pages
  analytics/          analytics dashboard page
  dashboard/          dashboard + admin pages
  pricing/            pricing page
  profile/            profile page
  tasks/              task list/detail/new/edit pages
  workspace/          workspace, project (list/board/calendar), team, settings pages
  api/                ~50 route handlers (see API Reference)
components/           feature-organized React components (task, project, workspace,
                      analytics, billing, search, theme, ui, ...)
context/              AuthContext, WorkspaceContext
hooks/                custom hooks (useSocket, useNotifications, ...)
lib/                  infra: db, auth, session, authorization, page-guards,
                      rate-limit, logger, api (client fetch), plans, stripe,
                      socket(-client), upload, file-validation, pagination
models/               Mongoose schemas (User, Workspace, WorkspaceMember,
                      Project, Task, Team, Comment, Attachment, File,
                      Notification, Activity, TimeEntry, Organization,
                      Permission, Subscription, BillingEvent, AuditLog)
services/             business logic per domain
server/               Socket.IO bootstrap, socket handlers, graceful shutdown
utils/                response helpers, error handler, validators, constants
__tests__/            unit/, integration/api/, e2e/ (Playwright), bench/
docs/                 design reference
```

## Authentication & Authorization

- **Registration/login** — `POST /api/auth/register`, `POST /api/auth/login`. Passwords hashed with bcryptjs; JWT signed with `JWT_SECRET`, 7-day expiry, stored in an HttpOnly `SameSite=Lax` cookie named `token`.
- **Session validation** — every protected API call goes through `requireSession()`, which verifies the JWT *and* the user's DB-backed `tokenVersion` (logout/password change invalidates all sessions).
- **CSRF** — cookie-authenticated mutation requests are rejected when the `Origin`/`Referer` doesn't match `NEXT_PUBLIC_APP_URL`.
- **Middleware** — `middleware.ts` verifies the JWT on `/dashboard`, `/workspace`, `/tasks`, `/profile`, `/analytics`, `/settings` and enforces `/dashboard/admin` for `role=ADMIN`; generates a per-request `x-request-id`.
- **Password reset** — intentionally disabled: `POST /api/auth/reset-password` returns `501` (the flow was never implemented; kept disabled to avoid account enumeration).
- **Roles** — global `User.role` (`USER`/`ADMIN`) plus per-workspace `WorkspaceMember.role`. Client roles are never trusted; services re-check membership server-side.

## API Reference

All endpoints return the standard envelope. Auth = session cookie required; Admin = `role=ADMIN`; WS = workspace membership required.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | Rate-limited per IP+email; creates user + session cookie |
| POST | `/api/auth/login` | Rate-limited per IP+email; sets session cookie |
| POST | `/api/auth/logout` | Clears cookie, bumps `tokenVersion` |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/auth/reset-password` | Always `501` (disabled) |

### Core resources
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/workspace` | List/create workspaces |
| GET/PUT/DELETE | `/api/workspace/[id]` | Workspace detail/update/delete |
| POST | `/api/workspace/validate-slug` | Slug availability check |
| GET/POST | `/api/workspaces/[id]/members` | List/invite members |
| PATCH/DELETE | `/api/workspaces/[id]/members/[memberId]` | Update role / remove member |
| GET/PUT/DELETE | `/api/workspaces/[id]` | Workspace-scoped operations |
| GET/POST | `/api/projects?workspace=` | List (paginated w/ `page`/`limit`) / create |
| PUT/DELETE | `/api/projects/[id]` | Update / delete |
| GET/POST | `/api/tasks?project=` or `?workspace=` | List / create. **Without `page`/`limit` returns the full array** (Kanban/Calendar requirement); with them → paginated envelope |
| PUT/DELETE | `/api/tasks/[id]` | Update (emits `task:updated`) / delete (`task:deleted`) |
| GET/POST | `/api/teams?workspace=` | List / create teams |
| PUT/DELETE | `/api/teams/[id]` | Update / delete |
| GET/POST | `/api/comments?task=` | List / create task comments |
| GET/POST | `/api/time?task=` | Time entries / start timer |
| PUT | `/api/time/[id]` | Stop/update timer |
| GET | `/api/activities` | Activity feed |
| GET | `/api/users` | Workspace member directory |

### Files & attachments
| Method | Path | Notes |
|---|---|---|
| POST | `/api/upload` | Generic Cloudinary upload (5MB, jpg/jpeg/png/gif/webp) |
| POST | `/api/files/upload` | Validated file upload + `File` record |
| DELETE | `/api/files/upload/[id]` | Delete file record + Cloudinary asset |
| POST | `/api/attachments` | Task attachment (Cloudinary + `Attachment` record) |
| DELETE | `/api/attachments/[id]` | Remove attachment |

### Notifications, search, analytics
| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/api/notifications` | List / mark-read notifications |
| GET | `/api/notifications/unread-count` | Badge count |
| PUT | `/api/notifications/[id]` | Mark single read |
| PATCH | `/api/notifications/read-all` | Mark all read |
| GET | `/api/search?q=` | Global search, 60 req/min/user |
| GET | `/api/analytics/overview` | Dashboard analytics payload |
| GET | `/api/analytics/export` | CSV export (formula-injection safe) |

### AI (20 req/hour/user)
`POST /api/ai/task-breakdown`, `POST /api/ai/summary`, `POST /api/ai/generate-description`

### Billing
| Method | Path | Notes |
|---|---|---|
| GET | `/api/billing/plans?workspaceId=` | Plan catalog + provider price availability |
| POST | `/api/billing/checkout` | `{ plan, interval, workspaceId?, provider? }` → Stripe URL or Paddle checkout config |
| POST | `/api/billing/portal` | Provider-aware customer portal session (Stripe or Paddle) |
| GET | `/api/billing/subscription` | Current subscription state + provider |
| POST | `/api/billing/webhook` | Stripe webhook — signature-verified, idempotent via `BillingEvent` |
| POST | `/api/billing/webhook/paddle` | Paddle webhook — SDK `unmarshal` signature verification, idempotent |

### Admin & ops
`GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/[id]`, `GET /api/admin/workspaces`, `GET /api/admin/logs` — all admin-only, 120 req/min.
`GET /api/health` (liveness), `GET /api/ready` (readiness — mongoose `readyState`), `GET /api/test-db` (admin DB connectivity check), `POST /api/email/test`.

## Search

`GET /api/search?q=<query>` (session required, 60/min/user, min 2 chars, 200-char cap) returns:

```json
{ "success": true, "data": { "tasks": [...], "projects": [...], "users": [...] } }
```

- Tasks match `title` **or** `description`; projects match `name` **or** `description`; users match name/email — scoped to the user's workspaces.
- Results are sorted by `updatedAt`, include server-generated ~160-char snippets, and are regex-escaped (substring semantics, case-insensitive).
- UI: `components/search/SearchBox.tsx` debounces 300ms, closes on Escape/outside-click, combobox ARIA semantics; `SearchResults.tsx` renders linked results with per-section counts and empty states.

## Analytics & CSV Export

`GET /api/analytics/overview` → `services/analytics.service.ts` aggregates real MongoDB data:

```ts
{ totalTasks, completedTasks, completionRate,   // 0–100 integer
  workload: [{ userId, name, tasks, completed }],  // $lookup user names
  velocity: [{ _id: "2026-W42", completed }] }      // ISO week labels
```

- Rendered at `/analytics` (`app/analytics/page.tsx` → `components/analytics/`) with Recharts `ResponsiveContainer` charts that follow the active theme via `.recharts-*` CSS rules.
- `GET /api/analytics/export` returns CSV with RFC-4180 quoting **and** spreadsheet formula-injection guarding (cells starting `= + - @` are prefixed with `'`). Columns include task title, project, status, priority, assignee, due date, completion.

## Billing

- Plan catalog lives **only** in `lib/plans.ts`: `FREE` (3 projects / 3 members / 1 owned workspace), `PRO`, `TEAM` — limits enforced server-side on creation paths; existing resources are never revoked.
- Two payment providers share one provider-neutral subscription projection: **Stripe** (hosted checkout + portal) and **Paddle** (Paddle.js overlay checkout + Customer Portal, primary for new PRO). Price IDs resolve server-side from env (`STRIPE_PRICE_*`, `PADDLE_PRICE_*`); clients never send price IDs. Plans without configured prices can't be checked out.
- `POST /api/billing/checkout` accepts `provider` (default `'stripe'`). Stripe returns a Checkout URL; Paddle returns a checkout config the client feeds to `Paddle.Checkout.open()` (`lib/paddle-checkout.ts`). Both create an atomic `CheckoutReservation` scope lock — one pending checkout per `{user, workspace}` regardless of provider.
- `POST /api/billing/portal` opens the provider-appropriate customer portal (owner-only for workspace scope).
- `POST /api/billing/webhook` verifies `stripe-signature`; `POST /api/billing/webhook/paddle` verifies `Paddle-Signature` via the official SDK (`paddle.webhooks.unmarshal`, ±5s replay tolerance) **before** any payload field is read. Events are idempotent (`BillingEvent` compound `{provider, providerEventId}` unique index) with stale-event guards; Paddle transaction events always retrieve authoritative subscription state before syncing.
- Effective plan resolution: `getEffectivePlan()` in `services/billing.service.ts`; missing `Subscription` → FREE. Entitled statuses: `active` (unexpired period), `trialing`, `past_due`.
- Ops runbook (webhook coverage, unmapped-price recovery, migrations, index readiness): `docs/billing-operations.md`.

## Realtime

- Socket.IO server runs **inside the Next.js process** on `SOCKET_PORT` (default 3001), bootstrapped by `instrumentation.ts` → `server/bootstrap.ts` (Node runtime only). `NEXT_PUBLIC_SOCKET_URL` must point at it.
- Client connects via `lib/socket-client.ts` / `hooks/useSocket.ts` with the session cookie.
- Rooms: `workspace:<id>`, `project:<id>` (`join-workspace`, `join-project`, leave events).
- Server emits: `task:updated`, `task:deleted`, `comment:created`, `comment:deleted`, `notification:new`.
- **Single-instance only** — rooms and the rate limiter are in-memory; see Known Limitations.

## Theming

- `components/theme/ThemeProvider.tsx` — React context; persists to `localStorage('sprintforge-theme')`, falls back to `prefers-color-scheme`, applies `.dark` + `color-scheme` on `<html>`.
- `components/theme/ThemeToggle.tsx` — accessible toggle (aria-pressed/label, mount-gated to avoid hydration mismatch).
- Anti-flash inline script in `app/layout.tsx` `<head>` applies the saved theme before paint.
- `app/globals.css` — Tailwind v4 `@theme` tokens for light (`:root`) and dark (`.dark`) palettes, ambient glow, `.recharts-*` chart rules, `--success`/`--warning` tokens. All UI uses semantic tokens (`bg-card`, `text-foreground`, `border-border`, ...); colored utilities carry `dark:` variants. Brand gradient `from-blue-400 to-blue-600` is preserved.

## Error Handling & Logging

- **API** — every route catch block funnels to `apiError(error, fallbackMessage)` (`utils/error-handler.ts`): logs `{ err }` via Pino and returns `500 { success:false, message }` with a safe generic message. Validation/business errors use `errorResponse(message, status)` for 4xx.
- **Client** — `lib/api.ts` `apiRequest()` throws `Error` with `status` attached; 4xx are expected outcomes (not logged as errors), 5xx and network failures log once.
- **Logging** — `lib/logger.ts` Pino instance; `LOG_LEVEL` env (default `debug` dev / `info` prod); redacts secrets. Never log passwords, tokens, cookies, auth headers, or email bodies.
- **UI** — `ErrorBoundary`, `EmptyState`, `LoadingSpinner`, `Skeleton` components; `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
- **Sentry** — optional; enabled when `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` is set (`instrumentation-client.ts`, `sentry.*.config.ts`, `withSentryConfig` in `next.config.ts`).

## Rate Limiting & Security

In-memory per-key fixed-window limiter (`lib/rate-limit.ts`):

| Scope | Limit |
|---|---|
| Login | 30/15min per IP **and** 10/15min per email |
| Register | 20/15min per IP **and** 5/15min per email |
| AI endpoints | 20/hour per user |
| Search | 60/min per user |
| Admin GETs | 120/min per admin |
| Default (e.g. tasks) | 100/min per key |

Security controls:

- bcryptjs password hashing; JWT + `tokenVersion` session invalidation
- HttpOnly `SameSite=Lax` cookie; Secure flag in production; CSRF Origin checks on mutations
- IDOR protection: every task/comment/time/attachment route resolves workspace membership server-side before touching data
- Upload validation: 5MB cap, MIME allowlist (jpg/jpeg/png/gif/webp), Cloudinary-side `allowedFormats`
- Security headers in `next.config.ts`: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, plus a **report-only CSP** (enforcement deferred pending violation review — see comments in `next.config.ts`)
- Stripe webhook signature verification; CSV formula-injection escaping; regex escaping in search
- Per-request `x-request-id` correlation (client-supplied values are overwritten)

## Configuration

See `.env.example` for the full annotated list. Summary:

**Required**
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — long random string (`openssl rand -base64 48`)
- `NEXT_PUBLIC_APP_URL` — public origin (CORS/CSRF, email links, Stripe redirects)
- `NEXT_PUBLIC_SOCKET_URL` + `SOCKET_PORT` — realtime endpoint (default `http://localhost:3001` / `3001`)

**Optional (features degrade gracefully when unset)**
- `OPENAI_API_KEY` — AI endpoints
- `RESEND_API_KEY` + `EMAIL_FROM` (+ `EMAIL_MAX_RETRIES`) — transactional email
- `CLOUDINARY_*` — file uploads
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{PRO,TEAM}_{MONTHLY,YEARLY}` — Stripe billing
- `PADDLE_ENV`, `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_PRO_{MONTHLY,YEARLY}`, `PADDLE_WEBHOOK_SECRET` — Paddle billing (see `.env.example` + `docs/billing-operations.md`)
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG/PROJECT/AUTH_TOKEN` — error tracking/source maps
- `GITHUB_TOKEN`, `GITLAB_TOKEN` — VCS auto-provisioning hooks
- `LOG_LEVEL`, `SHUTDOWN_TIMEOUT_MS` — logging/shutdown tuning
- `AUTH_SECRET` — reserved/unused

## Installation & Development

**Prerequisites:** Node.js 20+, npm, MongoDB (local or Atlas).

```bash
git clone <repo> && cd sprintforge
npm install
cp .env.example .env.local   # fill in MONGODB_URI, JWT_SECRET, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SOCKET_URL
npm run dev                  # http://localhost:3000 (Socket.IO on :3001)
```

First run: register an account → create a workspace → create a project → add tasks.

**Scripts:** `npm run dev` · `npm run build` · `npm start` · `npm run lint` · `npm test` · `npm run test:e2e`

## Testing

- **Unit + integration (Jest, node env):** `npx jest` — 51 suites / 561 tests covering auth/session, authorization/RBAC, CSRF, rate limiting, pagination, search, analytics, billing lifecycle (Stripe + Paddle providers, webhook idempotency, reservations, portal), error handler, theme resolution, file validation, page guards, middleware request IDs, and API route contracts (mongodb-memory-server for DB-backed suites).
- **E2E (Playwright):** `npm run test:e2e` — boots `npm run dev` via `webServer` config; specs in `__tests__/e2e/`.
- **Bench:** `__tests__/bench/` perf sanity tests.

## Build & Deployment

```bash
npm run build   # Next.js production build (Turbopack); also type-checks
npm start       # serves .next + starts Socket.IO via instrumentation + graceful shutdown
```

- Health probes for orchestrators: `GET /api/health`, `GET /api/ready`.
- Graceful shutdown drains via `server/lifecycle.ts` (`SHUTDOWN_TIMEOUT_MS`, default 10s).
- **Deployment caveat:** Socket.IO and the in-memory rate limiter require a **single instance** (or sticky sessions + Redis adapter). Vercel/serverless is unsuitable without that rework; a VPS/containers running `npm start` is the supported topology. No Dockerfile/CI pipeline is included yet.
- Set all production env vars in the host; use MongoDB Atlas with auth + backups; enable Stripe live keys + webhook endpoint pointing at `/api/billing/webhook`, and (for Paddle) `PADDLE_ENV=production` + a Paddle notification destination pointing at `/api/billing/webhook/paddle`.

## Known Limitations & Technical Debt

- **Single-instance only** — in-memory rate limiter and Socket.IO rooms; horizontal scaling needs Redis/shared store + sticky sessions.
- **Unpaginated task lists** — `GET /api/tasks` without `page`/`limit` returns full arrays for Kanban/Calendar/TasksClient (`.maxTimeMS(30s)` guard). Opt-in pagination exists; incremental loading deferred.
- **Regex search** — substring matching; fine at current scale, migrate to `$text`/Atlas Search if volume grows.
- **CSP is report-only** — not enforced; nonce-based `script-src` is future hardening.
- **Password reset disabled** (`501`) — needs a real token flow.
- **Lint debt** — ~80 pre-existing `no-explicit-any` errors and assorted warnings in older components/services; `strict` TS is on and `tsc` is clean, but `any` remains in places.
- **Client `console.*` usage** — several older components still log to the console (debug noise, not errors).
- **npm audit (accepted risk)** — `@sentry/nextjs` pulls `picomatch@4.0.7` (GHSA-fc5q-39xc-vjpf, ReDoS via repeated extglobs) through `@rollup/plugin-commonjs`. **Build-time only** — the vulnerable code runs during `next build` source-map processing, never in the shipped runtime, and requires attacker-controlled glob input to trigger. The only `npm audit fix` path downgrades `@sentry/nextjs` to 8.x (semver-major, breaking) — deliberately not applied. Remediation: upgrade to a patched `@sentry/nextjs` 11.x+/12.x in a maintenance window. ~52 additional high findings are dev-tooling only (jest/eslint/shadcn CLI) and never ship.
- **Unused/dead code removed in Phase 11** — `services/auth.service.ts` (empty), `services/plan.service.ts`, `services/calendar.service.ts` were unreferenced and deleted.
- **No Dockerfile, CI pipeline, or automated DB migrations** — schema changes are implicit via Mongoose.

## Agent Notes

See `AGENTS.md` for verification commands, auth/RBAC invariants, health-probe rules, and scaling constraints maintained for coding agents.

## License

MIT License © 2026

---

## Author

- GitHub: [Ibrahim Amjad](https://github.com/ibrahim-amjad764)
