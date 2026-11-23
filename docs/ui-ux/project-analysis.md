# SprintForge — UI/UX Project Analysis

_Date: 2026-11-18 · Skill: ui-ux-pro-max (project-level install, `.devin/skills/ui-ux-pro-max`)_

## Product

SprintForge is a full-stack project-management SaaS: workspaces → projects → tasks with list/Kanban/calendar views, teams, time tracking, comments, attachments, notifications, global search, analytics, AI task tools, and Stripe billing. Audience: software teams and indie developers evaluating it as a portfolio piece.

## Stack (preserved — no changes proposed)

Next.js 16.4.6 App Router · React 19 · TypeScript strict · Tailwind CSS v4 (`@theme` tokens, `@custom-variant dark`) · Mongoose/MongoDB · Socket.IO · Recharts · react-big-calendar · shadcn-style CSS-variable design system.

## Existing UI inventory

- **Theming (Phase 8):** complete dark/light system — `ThemeProvider`, `ThemeToggle` (navbar only), anti-flash script, `localStorage('sprintforge-theme')`, `prefers-color-scheme` fallback. Dark palette = near-black surfaces + indigo primary + ambient glow; light = cool neutral variant of same system. Brand gradient `from-blue-400→600` preserved.
- **Shell:** `MainLayout` → `Navbar` (logo, workspace name, `SearchBox`, `ThemeToggle`, `NotificationDropdown`) + `Sidebar` (w-64, mobile overlay) + `Toaster`.
- **Pages:** landing, login/register/forgot-password, pricing, dashboard, tasks (list/detail/new/edit), workspace (projects list/board/calendar/tasks/teams/settings), analytics, profile, admin, unauthorized.
- **Components:** ~150 feature components; shared `ErrorBoundary`, `EmptyState`, `Pagination`, `LoadingSpinner`, `Skeleton`, `SearchBox`/`SearchResults`.
- **Data viz:** Recharts (dashboard `TaskChart`, analytics charts) — theme-aware via `.recharts-*` CSS rules.

## Functional strengths to preserve

Real-time Socket.IO updates, RBAC-gated UI, optimistic patterns, debounced search, paginated lists, CSV export, Stripe checkout/portal, rate-limited AI features, 402-test suite.

## Known UI/UX gaps (audit seeds)

1. **No theme toggle on auth/marketing pages** (`/login`, `/register`, `/pricing`, landing has navbar? — toggle only exists inside `Navbar` used by `MainLayout`; auth pages lack it).
2. **Client `console.*` noise** in ~15 older components (debug logging visible in devtools).
3. **Kanban/calendar mobile density** — columns/cards verified at 320px for overflow only; drag UX on touch unverified.
4. **Empty states** exist but inconsistent coverage (some lists/modals lack them).
5. **Focus indicators / keyboard nav** — partially verified; no systematic audit done.
6. **Landing page** predates the Phase 8 token migration in places; hero/CTAs may not match the dark dashboard language.
7. **Color-only status indicators** in places (priority/status chips rely on hue).
8. **No skeleton coverage audit** — `Skeleton` primitives exist but adoption is partial.
9. **Form validation UX** inconsistent (some react-hook-form+zod, some manual).
10. **`docs/design-reference.png`** (crypto-dashboard reference) informed Phase 8 but was never pixel-matched — residual divergence possible.

## Skill data applied

- Product match: **Analytics Dashboard / Data-Dense Dashboard** → recommended styles: Data-Dense Dashboard, Dark Mode (OLED), Minimalism & Swiss.
- UX priorities (skill rule table): Accessibility > Touch/Interaction > Performance > Style > Layout/Responsive > Typography/Color.
- Typography candidates from skill DB: Inter (body) + Plus Jakarta Sans or Fira pairing for dashboards; current app uses default Tailwind sans — decision deferred to design directions.
