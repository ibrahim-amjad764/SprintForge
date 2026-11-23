# SprintForge — Design System Specification (Direction A: Refined Crypto, elevated)

_Status: PROPOSAL — awaiting approval. No code changes._

## 1. Design tokens (extends existing `app/globals.css` — no parallel system)

All values expressed in existing CSS variables / Tailwind v4 `@theme` tokens. New tokens are additive.

### Color — dark theme (`.dark`)

| Token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.14 0.012 280)` | app canvas (existing, kept) |
| `--card` / `--popover` | `oklch(0.185 0.014 280)` | raised surfaces |
| `--muted` | `oklch(0.22 0.015 280)` | inset surfaces, skeletons |
| `--border` | `oklch(0.30 0.02 280 / 0.6)` | hairlines |
| `--primary` | `oklch(0.68 0.17 262)` | indigo (existing, kept) |
| `--primary-foreground` | `oklch(0.14 0.02 280)` | text on primary |
| `--accent` | `oklch(0.72 0.15 250)` | secondary indigo for glows |
| `--success` | `oklch(0.72 0.16 155)` | restrained green |
| `--warning` | `oklch(0.78 0.14 85)` | amber |
| `--destructive` | `oklch(0.62 0.21 25)` | red |

### Atmospheric layer (NEW — decorative, `aria-hidden`, `pointer-events-none`)

- `--glow-primary`: radial gradient `oklch(0.68 0.17 262 / 0.14)` — top-left ambient
- `--glow-accent`: radial gradient `oklch(0.72 0.15 250 / 0.10)` — bottom-right ambient
- `--glow-success`: radial gradient `oklch(0.72 0.16 155 / 0.05)` — subtle life accent
- Implementation: fixed pseudo-element stack behind content (`body::before` exists; extend to a layered `::before`/`::after` or dedicated `.ambient-glow` div). Dark theme only; light theme uses an extremely faint equivalent (`/0.04` opacity) so both themes feel related.
- **Mesh gradient accents** on hero/empty-state surfaces only: conic/radial blend of primary+accent at ≤12% opacity, masked with `mask-image` radial falloff. Never behind body text blocks.

### Elevation / depth

- `--shadow-card`: `0 1px 2px rgb(0 0 0 / .3), 0 8px 24px -12px rgb(0 0 0 / .5)` (dark); light: `0 1px 2px rgb(15 23 42 / .06), 0 8px 24px -12px rgb(15 23 42 / .12)`
- `--shadow-popover`: deeper variant for dropdowns/modals
- `--shadow-glow`: `0 0 24px -6px oklch(0.68 0.17 262 / .35)` — hover/focus emphasis on primary CTAs only
- Glass: `backdrop-blur-md bg-card/70` reserved for sticky navbar, popovers, command palette — **not** on content cards (keeps data dense & crisp).

### Radius & spacing

- Radius scale exists (`--radius` 0.625rem + derived). Keep; cards `rounded-xl`, controls `rounded-lg`, chips `rounded-full`.
- **8px spacing rhythm**: all new/edited layouts use Tailwind's 8px-base scale (`gap-2/4/6/8`, `p-4/6/8`). Audit pass removes one-off `p-3.5`/`gap-5` inconsistencies where touched.

## 2. Typography

- **Body/UI: Inter** via `next/font/google` (`--font-inter`), weights 400/500/600/700. Replaces current system/Geist fallback.
- **Data/mono: JetBrains Mono** (`--font-mono`) for metrics, IDs, timestamps, CSV-ish tables, code.
- Scale (Tailwind): `text-xs` (11px labels, uppercase tracking-wide for section headers) → `text-sm` (13px dense UI) → `text-base` (15px body) → `text-lg/xl` (page titles) → `text-2xl/3xl` (hero metrics only).
- Headings: `font-semibold tracking-tight`; page titles `text-xl font-semibold`; stat numbers `font-mono tabular-nums`.
- Line-height: 1.5 body, 1.2 headings. `font-feature-settings: "cv11","ss01"` for Inter polish.

## 3. Motion system

**Dependency decision: NO framer-motion.** `tw-animate-css` already ships `animate-in/fade-in/zoom-in/slide-in` utilities; combined with CSS keyframes + `IntersectionObserver`-free CSS-only entrances this covers the needed premium feel at zero bundle cost. Revisit only if drag/spring physics is later required.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | hover color/shadow, button press |
| `--dur-base` | 200ms | dropdowns, tooltips, card hover lift |
| `--dur-slow` | 320ms | page/section entrances, modal open |
| easing | `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutQuint-ish) | all entrances |
| stagger | 40–60ms per item, max 8 items | lists/cards entrance |

Rules:
- Animate **transform + opacity only** (GPU-composited). Never width/height/top/left.
- Entrances: `fade-in + translate-y-1 (4px) + optional zoom-95` on cards/sections; stagger via `animation-delay` inline style or `--i` custom property.
- Hover: `translateY(-1px)` + shadow upgrade on interactive cards; `scale(0.98)` on press.
- `prefers-reduced-motion: reduce` → all animations/transition durations → 0.01ms (global rule already partially present; extend to new utilities).
- Page transitions: route-level fade via `loading.tsx` skeletons + content fade-in; no heavy route animations.

## 4. Component language upgrades

- **Cards:** hairline border + `shadow-card`; hover lifts 1px with border brightening (`border-primary/30`); stat cards get mono numerals + delta chips.
- **Buttons:** primary = gradient `from-blue-500 to-indigo-600` + `shadow-glow` on hover; secondary = ghost with border; destructive stays semantic.
- **Chips/badges:** always icon-or-text + color (fixes color-only issue); status uses dot + label pattern.
- **Inputs:** `bg-muted/50` resting, `border-primary/50` focus + ring; labels always visible; errors inline with `aria-describedby`.
- **Tables:** sticky header, row hover `bg-muted/40`, mono for numeric columns, density toggle deferred.
- **Kanban:** column headers get count chip + colored dot; cards get priority stripe (left border) + mono due-date.
- **Skeletons:** shimmer via `bg-muted` + `animate-pulse` (existing `Skeleton`), applied consistently to dashboard/tasks/analytics/workspace lists.
- **Empty states:** icon (Lucide, not emoji) + heading + helper + CTA button.
- **Toasts:** keep react-hot-toast, styled via existing CSS vars; add `animate-in` entrance.

## 5. Page-by-page plan

| Page | Changes |
|---|---|
| Landing `/` | Ambient glow + mesh hero accent; Inter headings; staggered section entrances; premium CTA gradient; keep copy/structure |
| `/login` `/register` `/forgot-password` | Split-card layout w/ ambient brand panel (gradient + glow, `hidden md:block`); theme toggle added; mono labels; focus rings |
| `/pricing` | Plan cards elevated, popular-plan glow ring, feature checklist icons, monthly/yearly toggle polish |
| `/dashboard` | Metric cards → mono numerals + delta; activity feed staggered entrance; chart container glass-lite; skeleton coverage complete |
| `/tasks` | Filter bar consolidation; list rows hover lift; kanban column polish (dot+count); calendar toolbar refinement |
| Workspace pages | Hero banner → gradient mesh upgrade; project cards hover; members table density; settings forms consistent field styling |
| `/analytics` | Stat cards + charts get consistent card chrome; chart tooltip glass; CSV button styling; empty states |
| `/profile`, `/dashboard/admin` | Token-consistency sweep, table polish |
| Modals | Backdrop blur, `zoom-in-95` entrance, focus trap verification, ESC handling audit |
| Navbar/Sidebar | Navbar already glass; add scroll-aware border; sidebar active-item glow indicator; mobile drawer animation polish |

## 6. Theme strategy

Single token source (`globals.css`) — dark is default-rich, light is the "same product" variant: same radius/spacing/typography, light surfaces + soft shadows, ambient glow reduced to 4% opacity. `color-scheme` already set per theme. New decorative layers must be token-driven, never hardcoded per-theme in components.

## 7. Accessibility & performance checklist

- [ ] Contrast ≥4.5:1 text, ≥3:1 large text — both themes (audit after token changes)
- [ ] All interactive elements `cursor-pointer`, ≥40px targets, visible `focus-visible` ring (`ring-primary`)
- [ ] `aria-hidden` on all decorative layers; `role="status"`/`aria-live` on toasts & loading
- [ ] Charts: keep existing legends/tooltips; add `aria-label` summaries where feasible
- [ ] `prefers-reduced-motion` disables all new animations
- [ ] Keyboard: tab order through nav/cards/modals; ESC closes overlays; focus returns on close
- [ ] Performance: animations transform/opacity only; `content-visibility` for long lists optional; no new image assets; fonts via `next/font` (self-hosted, no layout shift)
- [ ] CLS < 0.1 — skeletons reserve space

## 8. Phased implementation roadmap

- **P1 — Foundation:** fonts (next/font Inter+JetBrains Mono), ambient glow layers, new elevation/glow tokens, global reduced-motion rule, button/chip/input/card primitive upgrades.
- **P2 — Shell & auth:** Navbar scroll state, Sidebar active glow, mobile drawer polish, auth pages split layout + theme toggle, landing hero.
- **P3 — Core app:** dashboard cards/feed/charts, tasks list+kanban+calendar polish, workspace pages, modals.
- **P4 — Analytics/billing/profile/admin:** chart chrome, pricing cards, tables, settings.
- **P5 — Audit:** a11y pass, responsive screenshots (320/375/768/1024/1440 × 2 themes), console-error sweep, `console.*` cleanup (M2), emoji-icon replacement (L1), jest+tsc+build regression.

## 9. Risk assessment

| Risk | Mitigation |
|---|---|
| Token changes regress dark/light parity | All changes additive tokens; per-page visual verification in both themes; Phase 8 computed-style audit script reusable |
| Font swap causes layout shift | `next/font` with `display:swap` + fallback metrics; verify CLS |
| Animation jank on low-end | transform/opacity only, `will-change` sparingly, reduced-motion gate |
| Breaking Kanban DnD / calendar | No structural changes to those components' logic — visual classes only; existing tests cover |
| `console.*` removal hides needed debugging | Gate behind `NODE_ENV==='development'` or remove entirely (server uses Pino anyway) |
| Bundle size | Zero new runtime deps; fonts are the only addition (self-hosted woff2 subsets) |

## 10. Out of scope (deferred)

Framer Motion/spring physics, page-transition router animations, density toggles, chart library change, custom cursor/magnetic effects, Lottie/3D elements.
