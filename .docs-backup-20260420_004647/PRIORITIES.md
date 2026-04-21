# R3 v4 — Live Priority Queue
# Source of truth for what's next. Update after every session.
# Aligned with PRD v4.1 (2026-04-12)
# Last updated: 2026-04-16

---

## 🔴 P0 — Production Blockers (Do First)

- [ ] **Apply migration 0005 to Railway production DB**
  ```bash
  cd ~/Stable && DATABASE_URL="postgresql://postgres:REALPASSWORD@ballast.proxy.rlwy.net:25291/railway" pnpm drizzle-kit migrate
  ```
  WHY: aiDecisionLog table doesn't exist in Railway production.
  Session summary shows zero acceptance rate. Demo is broken without this.
  NOTE: Applied to local DB ✅. Railway apply requires real password from dashboard.
  GET IT: railway.app → PostgreSQL service → Connect tab → copy DATABASE_URL

---

## 🟡 P2 — Hard Guard Violations

- [ ] **Fix server/routes/presets.ts — 4 Drizzle `as any` casts**
  Lines: 10, 11, 16, 17
  Fix: Type insert/update values with InsertEffectPreset / InsertEffectChain
  WHY: CLAUDE.md hard guard — no `any`.

- [ ] **Replace console.log in server/index.ts:300-308**
  Fix: Replace with morgan structured logger (already installed)
  WHY: CLAUDE.md hard guard — no console.log in committed code.

---

## 🟢 P3 — MVP Completion

- [ ] **Mix Suggestion System — backend wiring (MVP item 4)**
  Frontend: `client/src/components/MixSuggestionsPanel.tsx` exists
  Backend: Trigger detection in `server/services/` exists
  Missing: tRPC procedure to surface suggestions to client
  Action: Read `server/services/` before deciding router (daw or dedicated)
  WHY: Last MVP item before product is demo-ready and fundable.
  Note: demo environment must use `pro_artist` tier.

---

## 🔵 P4 — Schema & Infrastructure

- [ ] **Create migration 0006 — materialized views**
  - `mv_user_session_averages` — Time Savings baseline calculation
  - `mv_ai_acceptance_rates` — confidence calibration per user
  WHY: Time Savings % has no baseline without these.

- [ ] **Fix vitest root config — add package test include pattern**
  File: `vitest.config.ts`
  Fix: `include: ['packages/*/tests/*.test.ts', 'packages/*/src/**/*.test.ts']`
  WHY: `pnpm test` returns no output. Actual test count unknown. PRD cites 42+.

---

## 🔷 P5 — Hygiene (Score: 10/100 → Target 90/100)

- [ ] Consolidate phantom dirs — migrate files then delete:
  - client/client → client/src/
  - client/hooks → client/src/hooks/
  - client/components → client/src/components/
  - client/stores → client/src/stores/
  - Note: client/src/store is LIVE (has active imports — do not delete without migrating)

- [ ] Fix r3_hygiene.py Phase 9 — make PRD item checks conditional on actual codebase

---

## ✅ Completed

### 2026-04-12 (Session 2)
- [x] MultitrackView (/mixer) — double transport bar eliminated via hideTransport={true}
- [x] Acid-techno theme applied to /mixer page (#0a0a0a / #a3e635 / IBM Plex Mono)
- [x] JSX fragment fix — stray closing fragment in conditional transport block
- [x] SKILLS.md created — 22 engineering patterns documented in docs/SKILLS.md
- [x] DEMO_CHECKLIST.md created — full pre-demo QA in docs/DEMO_CHECKLIST.md
- [x] PRD v4.1 published — docs/R3v4_PRD_v4.1.pdf
- [x] P1 confirmed DONE — logAIDecision + updateAIDecisionOutcome fully implemented
      in server/services/session-metrics.service.ts and wired in aiMix.router.ts

### 2026-04-09 (Session 1)
- [x] mixerRouter, djRouter, aiMixRouter wired into procedures.ts
- [x] projectsRouter, presetsRouter, settingsRouter exported + wired
- [x] subscriptionRouter confirmed wired
- [x] SessionChip wired into DAW.tsx top nav (line 1782)
- [x] SessionSummaryPanel wired into DAW.tsx root (line 1750)
- [x] aiDecisionLog schema + migration 0005 generated
- [x] @lemonsqueezy removed from package.json
- [x] package-lock.json removed
- [x] R3 v4/ ghost directory removed
- [x] src/ dead directory removed
- [x] All .bak* and .backup.* files removed (16 files)
- [x] All .r3-ts-fix-* backup dirs removed (10 dirs)
- [x] billing.ts.ls-new renamed to billing.ts
- [x] 15 `any` violations fixed across 8 files
- [x] mixer.router.ts — 6 as any removed (dispatch accepts unknown)
- [x] shared/mixer.types.ts — type guards fixed to use unknown + null guard
- [x] server/storage.ts — redundant as any removed
- [x] index.ts:162 — Express req/res typed properly
- [x] r3_hygiene.py — 3 code bugs fixed (phantom dir exclusion, score formula, router key)
- [x] PRD v4.0 published (docs/R3v4_PRD_v4.docx)
- [x] CLAUDE.md updated to v4
- [x] TSC: zero errors throughout

---

## Valuation Gates

| State | Range | Gap |
|---|---|---|
| Current | $180K–$400K | Baseline |
| Working demo + 50 beta users | $800K–$2.5M | P0 done |
| ≥65% AI acceptance confirmed | $3–6M seed | P0 + P3 |
| $120K ARR | $4.8–9.6M | 12 months post-launch |
