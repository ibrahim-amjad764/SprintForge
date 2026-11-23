# SprintForge — Agent Notes

## Verification commands

- Tests: `npx jest` (Jest + Testing Library; Playwright e2e via `npm run test:e2e`)
- Lint: `npx eslint <files>`
- Build: `npm run build` (Next.js 16 + Turbopack)
- Prod smoke: `npm run build && npm start` (Socket.IO server on `SOCKET_PORT`, default 3001)

## Architecture notes

- Auth: JWT cookie + DB-backed `tokenVersion` check via `requireSession()` / `requireAdmin()`.
  Never trust client-supplied roles. `lib/page-guards.ts` provides SSR-page guards
  (`requireWorkspaceAccess`, `requireProjectInWorkspace`, `requireTaskAccess`, `requirePageUserId`).
- Workspace membership: `WorkspaceMember` roles OWNER/ADMIN/EDITOR/COMMENTER/VIEWER;
  `getWorkspaceMembership()` falls back to `Workspace.owner` (owner access preserved).
- Rate limiting: `lib/rate-limit.ts` in-memory per-key buckets. AI endpoints 20/hr/user,
  search 60/min/user, admin GETs 120/min/admin.
- Logging: Pino via `lib/logger.ts` (redacts secrets). Never log passwords, tokens,
  cookies, auth headers, or email bodies. Per-item service logging is dev-gated.
- Health probes: `/api/health` (liveness), `/api/ready` (passive mongoose readyState —
  must NOT call connectDB()).
- Graceful shutdown: `server/lifecycle.ts` via instrumentation; do not install signal
  handlers in Jest/dev.
- Billing: Stripe + Paddle share a provider-neutral `Subscription` projection;
  webhooks are signature-verified and idempotent via `BillingEvent`
  (`{provider, providerEventId}`). Ops runbook — event coverage,
  unmapped-price recovery, migrations, index readiness — lives in
  `docs/billing-operations.md`. Paddle sandbox E2E (P7.9.2B) is pending
  hosting; do not claim it complete.

## Known scalability ceiling (Phase 5D-3)

`GET /api/tasks?project=` / `?workspace=` without `page`/`limit` returns the FULL task
array — required by KanbanBoard, Calendar, and TasksClient which render complete
datasets. These reads carry `.maxTimeMS(30s)` so pathological queries fail fast.

- Opt-in pagination exists: pass `page`/`limit` → `{items,total,page,limit,hasMore}`
  (`getTasksPaginated`, `getTasksByWorkspacePaginated`). Only TaskFeed uses it today.
- Ceiling: roughly tens of thousands of tasks per project/workspace before payload
  size and populate cost dominate. Beyond that, Kanban/Calendar need incremental
  loading or per-column virtualization — deliberately deferred (no major rewrite).
- Regex search (`/api/search`) scans title/name with `i` flag — fine at current scale;
  consider `$text` index if task volume grows large.

## Scaling constraints (Phase 5D review)

- **Rate limiter is per-process.** `lib/rate-limit.ts` uses an in-memory Map —
  limits reset on restart and are NOT shared across instances. Fine for the
  current single-instance deployment; before horizontal scaling, move to a
  shared store (Redis) or enforce limits at the edge/ingress.
- **Socket.IO is single-instance.** The socket server runs inside the Next
  process on `SOCKET_PORT`; sticky sessions / a dedicated socket tier are
  required before multi-instance deployment.
- **Mongoose connection pool is per-instance** (`maxPoolSize: 10`) — size DB
  connection limits accordingly when scaling out.
- **npm audit (2026-11):** `next@16.2.10` and `mongoose@9.7.x` have critical
  advisories — upgrade both before production exposure at scale (Next ≥ patched
  16.4.x/16.5.x line; mongoose ≥9.11.4). `proxy-addr`/`express`/`@modelcontextprotocol/sdk`
  findings are dev-only (shadcn CLI), not shipped to production.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
