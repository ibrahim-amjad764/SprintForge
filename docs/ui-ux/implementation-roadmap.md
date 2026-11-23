# SprintForge — Implementation Roadmap & Component Inventory

_Status: PROPOSAL — awaiting approval._

## Reusable component inventory (existing → upgraded, not duplicated)

| Component | Action |
|---|---|
| `ThemeProvider`/`ThemeToggle` | Extend: mount toggle on auth/marketing pages via lightweight wrapper |
| `LoadingSpinner`/`Skeleton` | Adopt consistently; add `SkeletonCard`/`SkeletonChart` variants if missing |
| `EmptyState` | Add optional `icon` (Lucide) + `action` props; replace emoji usage |
| `ErrorBoundary` | Keep; verify theme tokens |
| `Pagination` (`components/shared`) | Polish hover/focus states |
| Buttons/inputs/chips | No shared primitive exists — introduce `components/ui/` tokens via classes only (no new abstraction unless reused ≥3×) |
| `SearchBox`/`SearchResults` | Minor: stagger result entrance, glass popover already themed |
| Charts (Recharts) | Container card chrome + tooltip glass; keep `.recharts-*` CSS approach |
| `MainLayout`/`Navbar`/`Sidebar` | Scroll-aware navbar border, sidebar active glow, drawer animation |
| `AgileKanban` | Replace emoji column icons with Lucide; priority stripe on cards |

## Phased file-level plan

### P1 — Foundation (tokens, fonts, motion primitives)
- `app/globals.css` — ambient glow layers, elevation/glow tokens, mono font var, reduced-motion global rule, shimmer keyframes if needed
- `app/layout.tsx` — `next/font/google` Inter + JetBrains Mono, font CSS vars
- `tailwind.config.js` / `@theme` — expose new tokens if needed
- `components/ui/*` — button/chip/input style upgrades (class-level, existing files)

### P2 — Shell + public pages
- `components/layout/Navbar.tsx` — scroll border, ensure toggle present
- `components/layout/Sidebar.tsx` — active-item glow
- `components/layout/MainLayout.tsx` — mobile drawer polish
- `app/(auth)/*/page.tsx` + `components/auth/*Form.tsx` — split layout, ambient panel, theme toggle mount
- `app/page.tsx` + `components/landing/*` — hero mesh, staggered sections, CTA polish
- `app/pricing/page.tsx` + `components/{landing,billing}/Pricing.tsx` — plan card elevation

### P3 — Core app
- `components/dashboard/*` (MetricCards, StatsCard, TaskChart, TaskFeed, ActivityStream, Dashboard)
- `components/task/*` (TasksClient, TasksList, TaskList, TaskCard, KanbanBoard, AgileKanban, TaskForm, TaskEditForm)
- `components/calendar/*` (Calendar, LazyCalendarClient, ProjectCalendar)
- `components/project/*`, `components/workspace/*`, `components/modals/*`

### P4 — Analytics/billing/profile/admin
- `components/analytics/*`, `app/analytics/page.tsx`
- `components/billing/*`, billing pages
- `app/profile`, `app/dashboard/admin`, `components/admin/*`

### P5 — Audit & cleanup
- `console.*` removal/dev-gating (~15 files)
- Emoji→Lucide icon replacements
- `AuthContext` `window.location` → `useRouter` (2 spots)
- Full verification suite + screenshots to `docs/ui-ux/screenshots/`

## Dependencies

- **Add:** `next/font` usage only (no package — built into Next). Google Fonts fetched at build time; alternatively self-host woff2 if offline builds required.
- **Do NOT add:** framer-motion (CSS/tw-animate-css sufficient), icon lib (lucide-react already installed).

## Testing checklist (per phase gate)

- [ ] `npx tsc --noEmit` clean
- [ ] `npx jest` 402+ pass
- [ ] `npm run build` pass
- [ ] ESLint on touched files — no new errors
- [ ] Playwright screenshots: key pages × {320,768,1024,1440} × {dark,light} → `docs/ui-ux/screenshots/`
- [ ] Manual: theme toggle on auth pages, keyboard tab through nav/modal, reduced-motion emulation, console error sweep
