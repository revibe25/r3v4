# R3 v4 — Live Priority Queue
# Source of truth for what's next. Update after every session.
# Aligned with PRD v4.0 §18.6 (Hygiene Upgrade Path)
# Last updated: 2026-04-09

---

## 🔴 P0 — Production Blockers (Do First)

- [ ] **Apply migration 0005 to Railway**
  ```bash
  cd ~/Stable && pnpm drizzle-kit migrate
  ```
  WHY: aiDecisionLog table doesn't exist in production DB.
  Session summary shows zero acceptance rate. Demo is broken without this.

---

## 🟠 P1 — Demo Critical

- [ ] **Wire aiDecisionLog writes into session-metrics.service.ts**
  Files: `server/services/session-metrics.service.ts`
  WHY: aiDecisionLog table exists (schema done) but nothing writes to it.
  Acceptance rate = 0 until this lands. PRD gate: ≥65% acceptance confirmed.

---

## 🟡 P2 — Hard Guard Violations

- [ ] **Fix server/routes/presets.ts — 4 Drizzle `as any` casts**
  Lines: 10, 11, 16, 17
  Fix: Type the insert/update values with InsertEffectPreset / InsertEffectChain
  WHY: CLAUDE.md hard guard — no `any`.

- [ ] **Replace console.log in server/index.ts:300-308**
  Fix: Replace with `process.stdout.write` or morgan structured logger
  WHY: CLAUDE.md hard guard — no console.log in committed code.

---

## 🟢 P3 — MVP Completion

- [ ] **Mix Suggestion System — backend wiring (MVP item 4)**
  Frontend: `client/src/components/MixSuggestionsPanel.tsx` exists
  Backend: Trigger detection in `server/services/` exists
  Missing: tRPC procedure to surface suggestions to client — likely via `daw` router
  or dedicated `suggestions` router — read server/services/ before deciding
  WHY: Last MVP item before product is demo-ready and fundable.
  Note: demo environment must use `pro_artist` tier — confirm before any investor session.

---

## 🔵 P4 — Schema & Infrastructure

- [ ] **Create migration 0006 — materialized views**
  Views needed:
  - `mv_user_session_averages` — Time Savings baseline calculation
  - `mv_ai_acceptance_rates` — confidence calibration per user
  WHY: Time Savings % calculation has no baseline without these.

- [ ] **Fix vitest root config — add package test include pattern**
  File: `vitest.config.ts`
  Fix: Add `include: ['packages/*/tests/*.test.ts', 'packages/*/src/**/*.test.ts']`
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
  (currently hardcoded, always fires)

---

## ✅ Completed (2026-04-09)

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
- [x] PRD v4 published (docs/R3v4_PRD_v4.docx)
- [x] CLAUDE.md updated to v4
- [x] TSC: zero errors throughout

---

## Valuation Gates

| State | Range | Gap |
|---|---|---|
| Current | $180K–$400K | Baseline |
| Working demo + 50 beta users | $800K–$2.5M | P0 + P1 done |
| ≥65% AI acceptance confirmed | $3–6M seed | P0 + P1 + P3 |
| $120K ARR | $4.8–9.6M | 12 months post-launch |
