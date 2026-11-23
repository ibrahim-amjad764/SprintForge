# SprintForge — Page-by-Page Layout Plan (Direction A)

_Status: PROPOSAL — awaiting approval._

## Public / auth

**Landing `/`** — sticky glass navbar (logo, links, theme toggle, Login CTA); hero with mesh-gradient accent + staggered headline/CTA entrance; feature grid (3-up → 1-col mobile); social proof strip; pricing preview; footer. Dark: ambient glows; Light: same structure, soft shadows.

**`/login` `/register` `/forgot-password`** — centered split layout ≥md: left = brand panel (indigo gradient mesh, product tagline, theme toggle); right = form card (glass-lite, visible labels, mono helper text). <md: single column, compact header with toggle.

**`/pricing`** — navbar; heading; billing-interval toggle; 3 plan cards (FREE/PRO/TEAM) — PRO gets accent ring + glow; feature lists with Lucide checks; FAQ/footer. CTA → Stripe checkout flow preserved.

## App shell (all authenticated pages)

**Navbar** — glass `bg-card/80 backdrop-blur`, scroll-aware bottom border, logo+workspace switcher (truncated), centered SearchBox (desktop), right cluster: ThemeToggle + NotificationDropdown + avatar menu.

**Sidebar** — w-64, token surfaces; nav groups (Overview / Work / Insights / Admin); active item = `bg-primary/10` + left accent bar + glow dot; collapse to overlay drawer <lg with slide animation.

## Core pages

**`/dashboard`** — greeting header; 4 metric cards (mono numerals, delta chips, icon chips); charts row (task status pie/donut + activity); task feed list w/ staggered rows; quick actions rail.

**`/tasks`** — filter bar (status/priority/assignee/project chips + search); view switcher (List/Kanban/Calendar); list = dense rows w/ hover lift; Kanban = columns w/ count chips + priority stripes; Calendar = month grid w/ event chips.

**Workspace `[id]`** — hero banner (gradient mesh upgrade of existing dark banner); tabs/projects grid; project detail = header + progress + view switcher (List/Board/Calendar) + task table.

**`/analytics`** — stat row (total/completed/rate); workload bar chart; velocity line/area chart; both in consistent cards w/ glass tooltips; CSV export button top-right.

**`/profile` `/settings`** — form sections with consistent field styling, avatar upload, danger zone.

**`/dashboard/admin`** — stat cards + users/workspaces tables, admin-only guard preserved.

## States (every data page)

- Loading: `Skeleton` layouts matching final geometry (no spinner-only screens)
- Empty: Lucide icon + message + CTA
- Error: `ErrorBoundary` fallback + inline retry where applicable
- Toast: themed, `animate-in` entrance
