# R3 v4 UI Audit Report
**Scope:** `client/src/pages/*.tsx` vs. master template `instrument.tsx`  
**Date:** 2025-04-25  
**Protocol:** read-before-touch · triple-checked · zero fabrication  

---

## Master Template Specification (instrument.tsx)

The canonical layout contract extracted from `instrument.tsx`:

| Layer | Class / Element | Requirement |
|---|---|---|
| Shell | `.ag-shell` | `height:100vh; overflow:hidden; flex-col; background:var(--ag-black); scanline grid` |
| Frame | `.ag-frame` | `flex-col; border-left/right 3px solid var(--ag-border); ::before acid left stripe` |
| Header | `<header class="ag-header">` | `border-bottom:3px; overflow:hidden; box-shadow` |
| Header top | `.ag-header-top` | `display:flex; align-items:stretch` — children: wordmark, status, BPM, controls |
| Wordmark | `.ag-wordmark-block` | `padding:14px 24px; border-right; Syne 800; sub-label` |
| Status | `.ag-status-block` | `live/standby cursor + status lines; IBM Plex Mono 9px` |
| BPM | `.ag-bpm-block` | `Syne 800 42px acid color; TAP button` |
| Nav buttons | `.ag-controls-block` | `flex-end; ag-nav-btn anchors ONLY in this block` |
| Ticker | `.ag-ticker-row` | Scrolling marquee of feature labels |
| Content | `.ag-content` | CSS grid: `1fr 490px` (responsive); left/right panes |
| Footer | `.ag-footer` | `border-top:3px; feature list + version tag` |
| CSS tokens | `:root` | `--ag-black, --ag-ink, --ag-panel, --ag-border, --ag-acid (#a3e635), --ag-acid2, --ag-acid-d, --ag-white, --ag-err, --ag-rec, --ag-cyan` |
| Fonts | `@import` | Syne 700/800 (display) · IBM Plex Mono 400/500/600 (data) |
| Accent | Primary | `#a3e635` (lime green) — NOT amber, NOT cyan as primary |
| Nav location | Rule | **Nav buttons live exclusively inside `.ag-controls-block` within `.ag-header`** |

---

## Per-File Findings

### ✅ `pages/instrument.tsx` — MASTER (Reference)
**Status: CANONICAL**  
Full conformance. All other pages are measured against this.

---

### ✅ `pages/collaborative-daw-pro.tsx` (route: `/collab`) — GOOD
**Status: LARGELY CONFORMANT — 1 structural issue**

**Passes:**
- Uses `ag-shell` / `ag-frame` shell ✓
- Has `ag-header` / `ag-header-top` with wordmark, status, BPM, controls blocks ✓
- Nav buttons (`<Link href="/instrument" className="ag-nav-btn">`) are inside `.ag-controls-block` ✓
- Has `ag-ticker-row` ✓
- Has `ag-footer` ✓
- Full `--ag-*` CSS variable set declared ✓
- Lime `#a3e635` as primary accent ✓

**Fails:**
- **[LAYOUT OVERFLOW]** `.ag-shell` uses `height: 100vh`. The global `<PageNav>` from `App.tsx` is NOT suppressed on `/collab` (only `/auth`, `/login`, `/instrument`, `/daw` are in `NAV_HIDDEN_ON`). This means on `/collab`, the 44px nav renders ABOVE the ag-shell which itself consumes 100vh → 44px of the footer clips off the bottom of the viewport.

**Required fix:**
```css
/* In STYLES constant — ag-shell section */
.ag-shell {
  height: calc(100vh - var(--nav-h, 0px)); /* was: 100vh */
  ...
}
```

---

### ❌ `pages/DAW.tsx` (route: `/daw`) — CRITICAL DIVERGENCE
**Status: DOES NOT CONFORM TO MASTER TEMPLATE**

**Fails:**
- **[SHELL]** No `ag-shell` / `ag-frame` — uses bare `<div className="flex flex-col">` with inline style
- **[ACCENT]** Primary accent is **amber `#f59e0b`** everywhere. Master uses lime `#a3e635`. The two coexist in some places but amber dominates.
- **[FONT]** Primary font is `"JetBrains Mono"`. Master specifies IBM Plex Mono for labels, Syne for display.
- **[HEADER]** No `ag-header` / `ag-wordmark-block` / `ag-status-block` / `ag-bpm-block` / `ag-controls-block` structure. Uses a custom `<TransportBar>` component.
- **[NAV BUTTONS]** Nav buttons are not present in any header. The toolbar row below `TransportBar` has `MIDI SEQ`, `AI PANEL`, `PREDICTIONS` view-toggle buttons — these are view controls, not page-nav buttons.
- **[TICKER]** No `ag-ticker-row`.
- **[FOOTER]** No `ag-footer`. Has a status bar instead.
- **[HEIGHT]** Uses `height: '100vh'` — but `NAV_HIDDEN_ON` in `components/page-nav.tsx` includes `/daw`, so PageNav IS suppressed. This specific point is correct.
- **[CSS VARS]** No `--ag-*` variables declared; uses raw hex strings or Tailwind classes throughout.

**Note:** DAW.tsx is intentionally a different product surface (the main studio), but the brief requires conformance with the master template color scheme, visual style, and overall theme. The structural divergence is too deep for a patch — this page needs a header wrapper applying the ag-shell identity.

---

### ❌ `pages/vst.tsx` (route: `/vst`) — CRITICAL DIVERGENCE  
**Status: BARE WRAPPER — NO TEMPLATE COMPLIANCE**

**Fails:**
- **[SHELL]** No structure at all — single `<div>` with inline background/font
- **[HEIGHT OVERFLOW]** Uses `height: '100vh'`. PageNav IS rendered on `/vst` (not in `NAV_HIDDEN_ON`) → 44px overflow/clip
- **[HEADER]** No header, no nav buttons, no wordmark
- **[TICKER]** None
- **[FOOTER]** None
- **[ACCENT]** Inherits from VSTBrowser component — no page-level accent applied
- **[HARDCODED HEX]** `background: '#060606'` should be `var(--ag-black)`

**Note:** VSTBrowser is now embedded inside instrument.tsx (`/instrument` route). The `/vst` route still exists in `pages/` and `App.tsx` does NOT register it (VSTPage is commented out: `// VSTPage removed — VSTBrowser is now embedded in InstrumentPage`). This means `/vst` is a dead route — no `<Route path="/vst">` in App.tsx — yet `components/page-nav.tsx` still lists it in PAGES. The page should either be removed or the route wired up.

---

### ❌ `pages/visuals.tsx` (route: `/visuals`) — BUG: DOUBLE NAV
**Status: DOUBLE NAVIGATION BAR BUG**

**Fails:**
- **[DOUBLE NAV BUG]** `visuals.tsx` renders `<PageNav />` internally (line 261). `App.tsx` also renders `<PageNav />` globally. On `/visuals`, `NAV_HIDDEN_ON` does NOT suppress the global nav → two nav bars render stacked. This is a runtime layout bug.
- **[SHELL]** No `ag-shell` / `ag-frame`
- **[HEIGHT]** Uses `min-h-screen` — correct for a scrollable page, but in combination with the Canvas filling `flex-1`, the double nav eats 88px (2×44px) of vertical space
- **[TICKER / FOOTER]** None — acceptable for a full-screen visual mode, but breaks visual consistency

**Required fix:** Remove the `<PageNav />` import and JSX from `visuals.tsx`. The global nav from App.tsx handles it.

```tsx
// REMOVE from visuals.tsx:
import { PageNav } from '@/components/page-nav';
// ...
<PageNav />  // line 261 — DELETE THIS LINE
```

---

### ⚠️ `pages/AdminPage.tsx` (route: `/admin`) — MODERATE DIVERGENCE
**Status: CUSTOM SHELL — INTENTIONAL BUT MISALIGNED**

**Fails:**
- **[HEIGHT OVERFLOW]** `height: '100vh'`. PageNav IS rendered on `/admin` → 44px overflow. Should be `height: 'calc(100vh - var(--nav-h))'` or `height: 'calc(100vh - 44px)'`
- **[SHELL]** No `ag-shell` / `ag-frame` — uses custom token object `T` with its own colors
- **[ACCENT]** Primary accent is **amber `#f59e0b`** (its `T.amber`). Master uses lime `#a3e635`.
- **[FONT]** Uses `T.font = '"JetBrains Mono"...'`. Master uses IBM Plex Mono as primary.
- **[NO TICKER / FOOTER]** None

**Note:** Admin monitor has a reasonable justification for a different visual treatment, but the amber-first color scheme and JetBrains Mono conflict with the app-wide design system. The height overflow is a definite bug.

---

### ⚠️ `pages/admin/AgentSuitePage.tsx` (route: `/admin/agents`) — MODERATE
**Status: CUSTOM SHELL — HEIGHT BUG**

**Fails:**
- **[HEIGHT OVERFLOW]** Three `height: "100vh"` usages (AdminForbidden, AdminLoading, main div). PageNav renders on this route → 44px overflow on all three states.
- **[SHELL]** Custom zinc-950 palette (`T.z900`, `T.z800`, etc.) — not ag-* system
- **[FONT]** JetBrains Mono + Inter — not IBM Plex Mono / Syne
- **[ACCENT]** Uses `T.acid = '#a3e635'` — CORRECT lime accent ✓

**Required fix (minimal — just the height):**
```tsx
// Replace all three height: "100vh" in AdminForbidden, AdminLoading, and main div:
height: "calc(100vh - var(--nav-h))",
```

---

### ⚠️ `pages/AuthPage.tsx` (route: `/auth`) — MINOR
**Status: ACCEPTABLE FOR AUTH CONTEXT**

Auth pages are exempt from ag-shell structure (nav suppressed on `/auth`). However:
- **[ACCENT]** Uses amber `#f59e0b` as primary. `login.tsx` correctly uses lime `#a3e635`. Minor inconsistency between the two auth pages.
- Height uses `calc(100vh - var(--nav-h, 0px))` — correct.

---

### ⚠️ `pages/login.tsx` (route: `/login`) — MINOR
**Status: MOSTLY CORRECT — 1 MINOR ISSUE**

- Uses lime `#a3e635` as primary accent ✓
- Nav suppressed on `/login` ✓
- **[HARDCODED OFFSET]** `minHeight: 'calc(100vh - 37px)'` — hardcoded 37px instead of `var(--nav-h)`. Should be `calc(100vh - var(--nav-h, 0px))`.

---

### ⚠️ `pages/not-found.tsx` — UNSTYLED
**Status: COMPLETELY UN-THEMED**

- Uses shadcn `<Card>` with default `bg-background` — renders in whatever the Tailwind theme default is
- No acid-grid colors, no IBM Plex Mono, no ag-* variables
- No height issues (uses `min-h-screen`)

---

## Duplicate / Orphaned Files

### `pages/page-nav.tsx` — ORPHANED STALE COPY
**Action required: DELETE**

`App.tsx` imports `PageNav` from `./components/page-nav` — the `pages/page-nav.tsx` file is never imported anywhere. It is a stale duplicate with two meaningful divergences from the active `components/page-nav.tsx`:

| Difference | `pages/page-nav.tsx` (orphan) | `components/page-nav.tsx` (active) |
|---|---|---|
| `NAV_HIDDEN_ON` | `['/auth', '/login']` | `['/auth', '/login', '/instrument', '/daw']` |
| PAGES list | includes `/vst` + `Plug` icon | includes `/mixer` + `Sliders` icon |

The `pages/` copy also has a `.bak` file flagged in the tar manifest. Both should be deleted.

```bash
rm client/src/pages/page-nav.tsx
rm client/src/pages/page-nav.tsx.bak  # if exists
```

---

## /vst Route Status

`pages/vst.tsx` exists but `App.tsx` has no `<Route path="/vst">` — the VSTPage import is removed and commented out. The `/vst` link in `components/page-nav.tsx` PAGES array is dead. Options:

1. **Remove the link** from `PAGES` in `components/page-nav.tsx` and delete `pages/vst.tsx`
2. **Re-wire the route** in App.tsx if VST browser as a standalone page is desired

---

## Prioritized Fix List

| Priority | File | Issue | Fix |
|---|---|---|---|
| P0 | `pages/visuals.tsx` | Double PageNav bug — renders two navbars | Remove `<PageNav />` from page body |
| P1 | `pages/vst.tsx` | Dead route + bare wrapper | Remove from PAGES in page-nav, delete file OR wire route |
| P1 | `pages/collaborative-daw-pro.tsx` | `ag-shell` height 100vh overflows past global nav | Change to `calc(100vh - var(--nav-h, 0px))` in STYLES |
| P1 | `pages/AdminPage.tsx` | `height: '100vh'` clips footer below nav | Change to `calc(100vh - var(--nav-h))` |
| P1 | `pages/admin/AgentSuitePage.tsx` | Three `height: "100vh"` instances clip content | Change all three to `calc(100vh - var(--nav-h))` |
| P2 | `pages/DAW.tsx` | Amber accent, JetBrains Mono, no ag-shell | Add ag-header wrapper; align accent to `#a3e635` |
| P2 | `pages/not-found.tsx` | Zero theming — shadcn defaults | Restyle to acid-grid aesthetic |
| P3 | `pages/login.tsx` | Hardcoded `37px` nav offset | Change to `var(--nav-h, 0px)` |
| P3 | `pages/AuthPage.tsx` | Amber accent vs lime in login.tsx | Align to `#a3e635` |
| P4 | `pages/page-nav.tsx` | Orphaned stale file | Delete |

---

## What "Apply" Would Produce

When you say **apply**, I will produce patches in this order:

1. **visuals.tsx** — remove `<PageNav />` (1-line delete + import removal)
2. **collaborative-daw-pro.tsx** — fix `ag-shell` height in STYLES constant
3. **AdminPage.tsx** — fix height, swap amber→lime accent, swap JetBrains Mono→IBM Plex Mono in `T` token
4. **AgentSuitePage.tsx** — fix three height instances
5. **vst.tsx + page-nav PAGES** — remove dead `/vst` entry and file (pending your call: delete vs re-wire)
6. **not-found.tsx** — full restyle to ag-* palette
7. **login.tsx** — fix hardcoded 37px
8. **DAW.tsx** — header wrapper + accent alignment (largest change, will be a separate patch set)

All patches will be dry-run format (showing before/after) until you confirm with **apply**.
