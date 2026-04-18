# R3 v4 — Claude Code Constitution
# AI-native browser DAW · pnpm monorepo · ~/Stable/
# PRD Reference: docs/R3v4_PRD_v4.1.pdf (v4.1 — 2026-04-12)

<!-- Rules in .claude/rules/ auto-load — do not @import them here -->

## Identity

R3 v4 is AI-first. LLPTE is the moat — never treat it as an afterthought.

**Routing:** Pricing → Login → Instrument → DAW → Loopstation
**Tiers (Stripe only):** `explorer` · `creator` · `pro_artist`
**State management:** Zustand (NOT Redux — never import @reduxjs/toolkit)
**Client routing:** Wouter (NOT react-router-dom — never import it)
**Payments:** Stripe v20.4.1 ONLY (NOT LemonSqueezy — never reference it)

## Hard Guards — Non-Negotiable

- No `any` — use `unknown` + type guard
- No swallowed exceptions — all async functions handle errors explicitly
- No `console.log` in committed code — use morgan or structured logger
- No write without read first (Wire.txt protocol — see docs/WIRE.txt)
- No patch applied without dry-run confirmation
- No LemonSqueezy tier strings — ever
- No Redux — Zustand only
- No react-router-dom — Wouter only
- Post-login redirect: `/instrument` only, never `/daw`
- No `hydrateFromToken()` inside `ProtectedRoute` render
- No `free` as tier string — use `explorer`
- No `Pro` or `Studio` as tier string — use `creator` or `pro_artist`

## Known Exemptions (do not flag)

- `server/services/audio-analysis.ts` — `let AudioContext: any` has `eslint-disable`
  comment. node-web-audio-api ships no .d.ts. Legitimate exemption.
- `server/lib/storage-s3.ts` + `server/services/stripe-subscription.ts` — Proxy
  pattern uses `Reflect.get()`. Already fixed. Do not reintroduce `as any`.

## Commands

```bash
pnpm tsc --noEmit          # run after every patch — must be zero errors
pnpm test                  # Vitest suite (42+ cases across LLPTE packages)
pnpm dev                   # dev server
pnpm drizzle-kit generate  # generate migration after schema changes
pnpm drizzle-kit migrate   # apply migrations to DB (Railway production)
python3 r3_hygiene.py      # dry-run hygiene audit (10 phases)
python3 r3_hygiene.py --apply  # delete safe artifacts
```

## Stack (Pinned — Do Not Upgrade Without Explicit Decision)

| Package | Version |
|---|---|
| TypeScript | 5.9.3 |
| drizzle-orm | 0.39.3 |
| ws | 8.20.0 |
| Three.js | 0.128.0 (r128) |
| Stripe | 20.4.1 |
| Express | 4.22.1 |
| Zod | 3.25.76 |
| pnpm | 10.33.0 |
| Node | 22.x (Active LTS) |

## appRouter Shape (server/procedures.ts — 11 routers)

```
sessions · sessionMetrics · admin · daw · subscription ·
mixer · dj · aiMix · projects · presets · settings · ping (inline)
```

Do NOT add routers to `server/routers/index.ts` — that file defines and exports
routers but does NOT contain an appRouter. All wiring goes in `server/procedures.ts`.

## Database Schema (server/db/schema.ts)

**Active tables (13):**
users · sessions · sessionMetrics · subscriptions · projects · samples ·
presets · settings · aiDecisionLog · effectPresetsTable · effectChainsTable ·
djCuesTable · waveformEditsTable

**Migration history:**
- 0001–0004: baseline schema
- 0005_overjoyed_gambit.sql: aiDecisionLog table (2026-04-09)
  — Applied to LOCAL DB ✅
  — Railway production: IN PROGRESS (P0 — get real URL from railway.app dashboard)

**Materialized views (pending — migration 0006):**
- `mv_user_session_averages` — required for Time Savings baseline
- `mv_ai_acceptance_rates` — required for confidence calibration

## MVP Queue

1. ✅ AI Auto-Leveling — 6 layers, 20 Vitest tests
2. ✅ Smart Transitions — 9 files, 22 Vitest tests, Camelot scoring
3. ✅ Time Savings Tracking — SessionChip + SessionSummaryPanel wired in DAW.tsx
4. 🔲 Mix Suggestion System ← **CURRENT**

**PRD gates before sell / partnership talks:**
≥65% AI suggestion acceptance · measurable time savings · 50–100 paying beta users

## Current Priority Queue (as of 2026-04-12)

| Priority | Item | Status |
|---|---|---|
| P0 | Apply migration 0005 to Railway production DB | 🔴 BLOCKED — need real DB URL from railway.app |
| P1 | Wire aiDecisionLog writes | ✅ DONE — fully implemented in session-metrics.service.ts + aiMix.router.ts |
| P2 | Fix server/routes/presets.ts — 4 Drizzle `as any` casts | Open — hard guard |
| P2 | Replace console.log in server/index.ts:300-308 | Open — hard guard |
| P3 | Mix Suggestion System backend | Open — MVP item 4 |
| P4 | Migration 0006 — materialized views | Open |
| P4 | Fix vitest.config.ts include pattern | Open |
| P5 | Consolidate 9 phantom dirs | Open |

## Hygiene Baseline (2026-04-12)

- TSC: **0 errors**
- Live `any` violations: **5** (routes/presets.ts × 4, audio-analysis.ts × 1 exempted)
- console.log violations: **5** (server/index.ts:300-308)
- Phantom dirs: **9** (client/client, client/hooks, client/components, client/stores,
  client/src/hook, client/src/context, client/src/contexts, client/src/store [LIVE],
  db/schema)
- r3_hygiene.py: 3 code bugs fixed, 1 flagged

## LLPTE Pipeline Contract (Do Not Break)

```
inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus
```

- Inference latency p50: **≤15ms** (current: 10ms)
- Node tick time: **≤1ms** (current: 0.8ms)
- Active edges: **847** (limit: 2000)
- Confidence gate for auto-apply: **≥0.65**
- Confidence gate for suggestion: **≥0.40**
- Below 0.40: discard silently, log to aiDecisionLog

## aiDecisionLog Write Pattern (confirmed implemented)

`logAIDecision` in `server/services/session-metrics.service.ts`:
- Called from `aiMix.router.ts` — fire-and-forget, never blocks response
- Confidence gates applied: auto_applied / ignored / discarded
- `updateAIDecisionOutcome` called when client reports user action (accept/reject)
- Will produce live data the moment migration 0005 lands on Railway (P0)

## Demo Requirements (Non-Negotiable)

See `docs/DEMO_CHECKLIST.md` for full pre-demo QA.

Critical: demo environment must use `pro_artist` tier (NOT "Pro").
Critical: migration 0005 must be applied to Railway before any demo.
Critical: connector lines must be animated — static = demo failure.

## Wire.txt Protocol

Every engineering task must follow: **Files Read → Findings → Changes → Remaining Ambiguities**

- No write without read first
- No patch without dry-run confirmation
- Triple-check before every write
- Timestamped backup before destructive operations
- TSC must be zero after every change
- See `docs/WIRE.txt` for full protocol

## Auto-Memory

SAVE: build quirks found this session, recurring bugs + their fixes, any
pattern that surfaced more than once.
DO NOT SAVE: one-off workarounds, anything already covered in this file.
