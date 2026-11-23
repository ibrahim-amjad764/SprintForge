# SprintForge — Design Directions (awaiting user selection)

Skill data: product match = Data-Dense Dashboard / Analytics Dashboard; recommended styles = Data-Dense Dashboard, Dark Mode (OLED), Minimalism & Swiss; secondary = Accessible & Ethical.

All directions preserve: brand gradient `blue-400→600`, existing token architecture, dark+light parity, sidebar shell.

## Direction A — "Refined Crypto" (evolution of current)

- **Visual:** keep Phase 8 near-black dark + cool light; strengthen ambient purple/blue glow slightly; tighten card density toward the reference image.
- **Color:** current indigo primary `#6366F1`-family, near-black `oklch(0.14)` bg, semantic success/warning tokens.
- **Type:** Inter (body/UI) + JetBrains Mono for data labels/metrics (skill "Dashboard Data" pairing supports mono-for-data).
- **Layout:** unchanged shell; denser metric cards, consistent 8px spacing rhythm.
- **Pros:** lowest risk, builds on approved Phase 8, fastest.
- **Cons:** incremental, not a bold new direction.

## Direction B — "Minimal Swiss Dashboard"

- **Visual:** flat design, no gradients/shadows in app chrome, hairline borders, generous whitespace, typography-led hierarchy.
- **Color:** neutral zinc surfaces, single accent (indigo), status colors only where meaningful.
- **Type:** Plus Jakarta Sans throughout (skill "Friendly SaaS" pairing).
- **Layout:** same routes; airier cards, clearer section headers.
- **Pros:** modern, calm, highly readable, strong light mode.
- **Cons:** abandons the crypto-dashboard/reference aesthetic you approved; larger visual delta.

## Direction C — "OLED Pro" (dark-first, light as variant)

- **Visual:** true-black `#000`/`#0A0A0F` dark surfaces (OLED power saving per skill dark-mode-oled), neon-adjacent but restrained accents, subtle glow only on active/focus states.
- **Color:** deep black bg, elevated `#12121A` cards, indigo primary, green/red status restrained.
- **Type:** Inter + Fira Code for numeric/data columns.
- **Layout:** same shell; data-dense tables prioritized.
- **Pros:** best-in-class dark mode, matches fintech reference closest.
- **Cons:** true-black can feel harsh in light contexts; light theme needs careful separation to remain "same product".

## Recommendation

**Direction A (Refined Crypto)** — it preserves the approved Phase 8 identity and your design reference while fixing the audit gaps (H1–M5). B and C are viable but represent redesigns requiring re-approval of the visual identity.
