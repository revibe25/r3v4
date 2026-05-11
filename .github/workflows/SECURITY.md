 # SECURITY.md — R3 v4 Deferred Findings Register
---
**2026-05-10 — ASI/manual migration journal fix**

## ASI Security Policy Attestation

- Enforced at CI by `agents/verifier.js` (see Mythos-SKILL-v2.md v2.1).
- All deferred, audit-gap, and block findings fail PRs or pushes until policy is satisfied.
- SARIF export is available for automated dashboards.

- Detected drizzle.__drizzle_migrations as empty, but schema up-to-date.
- Seeded journal table with local _journal.json entries (7 migrations, tags and times match).
- No destructive or speculative SQL run. All steps logged and confirmed.
- Verified by: ./master_sync_drizzle_journal.sh (see committed script for audit trail).
- Next migration must be handled via manual DBA/CI-admin review.

--- 

## Fixed in this audit cycle (2026-04-22)

| ID | Finding | File | Status |
|----|---------|------|--------|
| F-01 | CSP `unsafe-inline` in scriptSrc | `server/index.ts` | ✅ Fixed |
| F-03 | `project.delete` UPDATE missing userId in WHERE | `server/routers/daw.ts` | ✅ Fixed |
| F-04 | Free-tier 1-project cap TOCTOU race | `server/routers/daw.ts` | ✅ Fixed (SELECT FOR UPDATE) |
| F-05 | `projects.userId` + `sessions.userId` nullable | `server/db/schema.ts` + migration | ✅ Fixed |
| F-06 | `/health` leaks version/memory/room stats | `server/index.ts` | ✅ Fixed |
| F-07 | Duplicate `trpcAuth` on `/api/trpc` | `server/index.ts` | ✅ Fixed |
| F-08 | FORBIDDEN vs NOT_FOUND leaks project existence (save path) | `server/routers/daw.ts` | ✅ Fixed (normalized to NOT_FOUND) |
| F-11 | Unhandled ZodError in `project.load` | `server/routers/daw.ts` | ✅ Fixed |
| C-04 | `systemPrompt` unbounded in adminRouter | `server/routers/adminRouter.ts` | ✅ Fixed (.max(8000)) |
| C-06 | Dead `JWT_SECRET` constant in trpc.ts | `server/trpc.ts` | ✅ Fixed |

---

## Deferred findings

---

### C-03 — Authenticated AI transition limit bypassable via client-controlled X-Session-Id

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** 2026-04-22
- **Surface:** Runtime
- **Our severity:** Medium — `checkAiTransitionLimit` keys on `(userId, sessionId)` where `sessionId` comes from the `X-Session-Id` request header. An authenticated explorer-tier user can send a new UUID in this header on every request, resetting their per-session counter each time and achieving unlimited AI transitions.
- **Advisory severity:** N/A — no external advisory
- **Mythos-class re-price:** Rotating an HTTP header on each request is a one-line script. This is friction, not a barrier. The in-memory guest counter has the same property but the guest path is intentionally soft (no userId to key on). The authenticated path has no such excuse.
- **Why deferred:** Fix requires a design decision: either (a) bind sessionId server-side on session creation and reject client-supplied values for rate-limiting purposes, or (b) scope the limit to userId + rolling time window (e.g., per-day) rather than per-session. Both options require schema changes to `aiTransitionUsage`.
- **Interim control:** Friction only (current). Explicitly accepted as interim because the limit is a soft tier gate, not a security boundary — abuse affects business model, not data integrity.
- **Revisit trigger:** 2026-05-22 (before opening paid tiers to external beta)
- **Owner:** @3R
- **Upgrade path:** Scope `aiTransitionUsage` to `(userId, date)` with a daily count column, or add a server-generated `sessionToken` issued at session start that the client returns opaquely.

---

### C-01 — GHSA-67mh-4wv8-2f99 · esbuild ≤0.24.2 (transitive via @esbuild-kit)

- **Status:** Deferred
- **Advisory status:** Public (N-day)
- **Advisory published:** Check https://github.com/advisories/GHSA-67mh-4wv8-2f99
- **Surface:** Dev-build-isolated — esbuild dev server is never exposed in production. The transitive path is `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild`.
- **Our severity:** Low — requires a running esbuild dev server to exploit; production is unaffected.
- **Advisory severity:** Moderate — delta: ±0 (we agree; dev-isolated reduces blast radius).
- **Mythos-class re-price:** No attacker-influenced input reaches the esbuild process during normal dev use.
- **Why deferred:** Root `esbuild` is already at `^0.25.12` (patched). The vulnerable path is the transitive `@esbuild-kit` dependency. Fix requires either a `pnpm overrides` pin or waiting for `drizzle-kit` to update its dependency.
- **Interim control:** Add `"esbuild": ">=0.25.0"` to `pnpm.overrides` in root `package.json` to force the patched version across all transitive paths.
- **Revisit trigger:** 2026-05-15 (N-day — ≤30 days from advisory for Moderate dev-build)
- **Owner:** @3R
- **Upgrade path:** `pnpm.overrides → "esbuild": ">=0.25.0"` — single-line change in package.json.

**ACTION REQUIRED NOW (low-effort):** Add to `pnpm.overrides`:
```json
"esbuild": ">=0.25.0"
```

---

### C-02 — GHSA-4w7w-66w2-5vf9 · Vite ≤6.4.1 path traversal in `.map` handling

- **Status:** Deferred
- **Advisory status:** Public (N-day)
- **Advisory published:** Check https://github.com/advisories/GHSA-4w7w-66w2-5vf9
- **Surface:** Dev-build-isolated — Vite is in devDependencies in both `package.json` files. Production start is `node dist/index.js`; Vite dev server does not run in production.
- **Our severity:** Low-Medium — the path traversal requires the Vite dev server to be serving requests; dev machines could be targeted if a malicious page is loaded while the dev server runs.
- **Advisory severity:** Moderate — delta: ±0 (dev-isolated reduces blast radius vs generic advisory).
- **Mythos-class re-price:** Dev machines often have production credentials in `.env`. If an attacker can serve a page to a developer with the dev server running, they can read arbitrary files the dev server can reach. The dev→prod credential pivot path is real but requires social engineering or CSRF.
- **Why deferred:** Fix requires upgrading from Vite 5 to Vite 6 — a major version migration with breaking changes. The client and server both pin Vite 5.
- **Interim control:** Developers should not load untrusted pages while the Vite dev server is running. (Friction — acceptable for dev-build interim only.)
- **Revisit trigger:** 2026-06-15 (N-day Moderate, ≤90 days; Vite 6 migration scoped by then)
- **Owner:** @3R
- **Upgrade path:** Vite 5 → 6 migration. Track upstream changelog for breaking changes. Test client HMR, AudioWorklet worker imports, and any Vite plugins used.

---

### F-09 — `aiDecisionLog` table has no userId column

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** 2026-04-22
- **Surface:** Runtime
- **Our severity:** Low — `sessionId` is UUID (128-bit random); brute-force is impractical. The `sessionMetrics` userId check in `liveSummary` is the effective guard.
- **Why deferred:** Requires a schema migration. No current exploit path — relies on UUID unguessability.
- **Interim control:** UUID sessionId provides friction-class isolation. The `sessionMetrics` userId check provides barrier-class protection for the `liveSummary` query.
- **Revisit trigger:** 2026-06-22 (next schema migration cycle)
- **Owner:** @3R
- **Fix:** Add `userId text NOT NULL REFERENCES users(id)` to `ai_decision_log`. Include `eq(aiDecisionLog.userId, ctx.user.id)` in all queries.

---

### F-10 — `ai.chat` prompt injection surface (latent — activates when real API is wired)

- **Status:** Deferred (currently safe — stub only)
- **Advisory status:** Internal finding
- **Advisory published:** 2026-04-22
- **Surface:** Runtime (when real Anthropic API call is wired into `ai.chat`)
- **Our severity:** Medium (future-state) — `input.context.activeTrack` is user-controlled and injected into the system context string passed to the LLM. A user can set their track name to instruction-syntax strings to attempt prompt injection.
- **Mitigation applied now:** `activeTrack` field in Zod schema capped at `.max(40)` (see `daw.ts`).
- **Remaining gap:** `.max(40)` reduces but does not eliminate injection risk. Full sanitisation is required.
- **Why deferred:** Real API call not yet wired. Current stub is safe.
- **Interim control:** Stub returns no LLM calls — effective barrier for now. Zod `.max(40)` reduces surface.
- **Revisit trigger:** Must be resolved BEFORE wiring the real Anthropic API — no later than 2026-05-15.
- **Owner:** @3R
- **Fix:** Before wiring: strip instruction-pattern characters from `activeTrack` server-side, or pass all user-supplied context as structured data (not inline in the system string). Example sanitiser: `activeTrack.replace(/[^\w\s\-]/g, '').slice(0, 40)`.

---

### AUDIT GAP — `ws/collab.ts`, `session-metrics.service.ts`

- **Status:** Open gap — files not read in this audit cycle
- **Surface:** Runtime
- **Our severity:** Unknown — `getRoomStats()` return value not reviewed for cross-user data leakage; `startSession`/`stopSession`/`getSessionSummary` userId scoping not verified
- **Revisit trigger:** 2026-05-01 (before first external beta user)
- **Owner:** @3R
- **Action:** Paste file content for audit pass. Specifically verify: (a) `getRoomStats()` does not return per-user identifying information to pro_artist callers; (b) `getSessionSummary` enforces userId ownership on every query.

---

### AUDIT GAP — `effectChainsTable`, `waveformEditsTable` — no userId column

- **Status:** Open gap
- **Surface:** Runtime (if any router exposes read/write on these tables)
- **Our severity:** Unknown — no userId FK means any caller who knows a row ID can access it
- **Revisit trigger:** 2026-05-01
- **Owner:** @3R
- **Action:** Audit any router that reads or writes `effect_chains` or `waveform_edits`. If exposed via tRPC, add userId FK and enforce in all queries.

---

### C-05 — Non-constant-time secret comparison in `internal.ts`

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** 2026-04-22
- **Surface:** Runtime (server-to-server only — not browser-exposed)
- **Our severity:** Low — timing oracle over TCP is high-noise; requires many parallel requests from a co-located attacker. The `INTERNAL_SECRET` is a shared secret for server-to-server use only.
- **Why deferred:** Low-risk, requires targeted attacker with co-location or LAN access.
- **Interim control:** Network-level isolation (internal routes not internet-exposed by design).
- **Revisit trigger:** 2026-07-22 or next edit to `internal.ts`
- **Owner:** @3R
- **Fix:** Replace `header !== INTERNAL_SECRET` with:
  ```typescript
  !crypto.timingSafeEqual(
    Buffer.from(header as string),
    Buffer.from(INTERNAL_SECRET)
  )
  ```
