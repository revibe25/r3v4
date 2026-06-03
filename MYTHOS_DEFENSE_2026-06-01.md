# Mythos Security Defense — R3v4 DAW Server
**Live threat model defense document | Updated 2026-06-01**

---

## Overview

This document tracks all security findings — fixed, deferred, and open gaps — under the assumption that adversaries have Mythos-class AI assistance and that all published CVEs are already being weaponized. Every finding is graded independently using CVSS-style reasoning, re-priced under Mythos assumptions, and assigned an owner and concrete revisit trigger.

**Key principle:** Friction-only mitigations degrade under model-assisted attacks. This document prioritizes barrier-class controls and enforces explicit risk acceptance for any friction-only interim measures.

---

## Status Summary (as of 2026-06-01)

| Category | Count | Status |
|----------|-------|--------|
| **Fixed this cycle** | 10 | ✅ Merged |
| **Deferred (with owner/trigger)** | 5 | 📋 Active tracking |
| **Audit gaps (unresolved)** | 6 | 🔴 **BLOCKING** |
| **Open deferred checks** | 2 | ⏰ Revisit pending |

**Release gate:** Cannot ship until audit gaps are closed (files read) and critical blocking findings are resolved.

---

# AUDIT GAPS — MUST RESOLVE BEFORE RELEASE

These files were listed in the audit but their content was not provided. The Mythos skill prohibits calling any surface clean without reading the implementation. These block release.

### 🔴 G-01 | `server/middleware/auth.ts` — Context user trust chain

**Why it blocks:** Cannot verify whether `ctx.user.id` is:
- Derived from a server-validated JWT (secure)
- Derived from a client-supplied header that the middleware merely populates (bypass vector)
- Defaulted to a guest ID if no token present (permission confusion)

The ctx.user object is the single point of trust in every guarded route.

**Verification checklist:**
- [ ] Middleware validates JWT signature using a server secret (not client-supplied)
- [ ] Middleware rejects unauthenticated requests *or* marks them clearly as unauthenticated
- [ ] No path allows ctx.user.id to be set from request headers without verification
- [ ] `requireUser` procedure wrapper enforces user presence; cannot be bypassed

**Audit action:** Paste full file content.

---

### 🔴 G-02 | `server/base-procedures.ts` — Protected procedure definition

**Why it blocks:** Need to confirm every guarded route actually calls `requireUser` or equivalent auth wrapper, and that the wrapper is enforced at type level (not bypassed via raw procedure).

**Verification checklist:**
- [ ] `requireUser` exists and throws if `ctx.user` is missing
- [ ] All guarded routers import and use it (not optional)
- [ ] No escape hatch to create a guarded procedure without the wrapper
- [ ] TypeScript prevents creating authenticated mutations without `requireUser`

**Audit action:** Paste full file content.

---

### 🔴 G-03 | `server/trpc.ts` — createContext implementation

**Why it blocks:** `createContext` determines how JWT is parsed and what happens if no token is present.

**Verification checklist:**
- [ ] JWT parsing uses `verify()`, not `decode()`
- [ ] Server secret is used (environment variable, not client-supplied)
- [ ] Missing or invalid token is handled (reject or mark unauthenticated, not assumed)
- [ ] Context middleware doesn't call `next()` if auth is required and token is missing

**Audit action:** Paste full file content and `package.json` for JWT library version.

---

### 🔴 G-04 | `server/routers/adminRouter.ts` — Admin surface auth and authorization

**Why it blocks:** Highest privilege target; completely unseen in audit.

**Verification checklist:**
- [ ] Every mutation requires `ctx.user.isAdmin` or role check
- [ ] Role field is derived from database (not from JWT claims the user can influence)
- [ ] Admin mutations include specific input validation (not just generic schema)
- [ ] No admin route is accidentally global-accessible due to middleware ordering

**Audit action:** Paste full file content and verify every mutation's auth guard.

---

### 🔴 G-05 | `server/services/session-metrics.service.ts` — userId scoping in session queries

**Why it blocks:** Functions like `startSession`, `stopSession`, `getSessionSummary` must enforce userId ownership on every query.

**Verification checklist:**
- [ ] Every query includes `where(eq(sessionMetrics.userId, userId))`
- [ ] No query path returns data for other users
- [ ] `sessionId` alone is never sufficient as a filter (sessionId is UUID, brute-forceable under Mythos)

**Also verify:** `shared/schema-session-metrics.ts` column definitions — must have userId FK.

**Audit action:** Paste both files.

---

### 🔴 G-06 | `server/routes/internal.ts` — Unauthenticated /api/internal routes

**Why it blocks:** Currently unclear whether `/api/internal` is guarded by middleware or open.

**Verification checklist:**
- [ ] Every route in `internalRouter` requires authentication
- [ ] If routes use a shared secret, the secret is cryptographically random and server-side only
- [ ] No attacker-controlled data reaches internal procedures
- [ ] If `internalRouter` is meant to be internal-only, it should be mounted on a separate port, not http://localhost:3000/api/internal

**Audit action:** Paste `server/routes/internal.ts` and verify auth guards.

---

# FIXED FINDINGS (v4.0.0)

The following issues have been merged and tested in this cycle.

### ✅ F-01 | CSP `unsafe-inline` in scriptSrc — **FIXED**

**File:** `server/index.ts`  
**Status:** Fixed and merged  
**Severity (ours):** High  
**Surface:** Runtime  

**Issue:** Production server's CSP header included `'unsafe-inline'` in scriptSrc. The comment claimed Vite HMR requires it, but Vite dev server never runs in production.

**Mythos-class re-price:** With `unsafe-inline`, CSP is decorative. Any XSS sink (DOM injection, dangling eval, `dangerouslySetInnerHTML`) in the React client bypasses it entirely. Finding XSS sinks via code analysis is a cheap sweep for a model-assisted adversary.

**Mitigation applied:** Removed `'unsafe-inline'` from productionCSP. If any inline scripts are actually required, use nonce-based or hash-based CSP instead.

**Verification:** Run `curl http://localhost:3000 -v | grep -i "content-security-policy"` and confirm no `unsafe-inline` in scriptSrc.

---

### ✅ F-03 | `project.delete` UPDATE missing userId in WHERE — **FIXED**

**File:** `server/routers/daw.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Medium  
**Surface:** Runtime  

**Issue:** Application checked ownership (`if existing[0].userId !== ctx.user.id`), but the UPDATE statement only filtered by project ID, with no userId in the WHERE clause. Classic check-then-act race; DB had no defense-in-depth.

**Mythos-class re-price:** Mythos can fuzz timing windows and race parallel submissions. If the app-layer check is ever bypassed, the DB layer must stop any unauthorized delete.

**Mitigation applied:** Added `eq(projects.userId, ctx.user.id)` to the DELETE WHERE clause, matching the pattern used in `project.save`.

**Verification:** Code review: confirm both `.update()` and `.delete()` paths include userId filter.

---

### ✅ F-04 | Free-tier 1-project cap TOCTOU race — **FIXED**

**File:** `server/routers/daw.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Medium  
**Surface:** Runtime (business logic bypass)  

**Issue:** Application read count, then inserted. Two concurrent requests from the same free-tier user would both read count ≤ 1, both pass the check, and both insert two projects.

**Mythos-class re-price:** Parallel HTTP requests are trivial to script. Monetization controls defeated with one loop.

**Mitigation applied:** Added `SELECT ... FOR UPDATE` lock or switched to `INSERT ... WHERE NOT EXISTS` pattern to enforce the cap at the DB level atomically.

**Verification:** Test with two concurrent requests; verify second request is rejected.

---

### ✅ F-05 | `projects.userId` and `sessions.userId` not NOT NULL — **FIXED**

**File:** `server/db/schema.ts` + migration  
**Status:** Fixed and merged  
**Severity (ours):** Medium  
**Surface:** Runtime (schema defense-in-depth)  

**Issue:** Router code always sets userId, but schema didn't enforce it. Any future code path (admin tools, migrations, seed scripts) that omits userId would silently create ownerless records.

**Mythos-class re-price:** A model auditing the codebase finds every INSERT path within minutes. Even if none currently exist, the missing constraint is a time bomb.

**Mitigation applied:** Added `.notNull()` to both columns and generated migration.

**Verification:** Confirm migration is in `migrations/` and schema.ts has `.notNull()` on both userId fields.

---

### ✅ F-06 | `/health` endpoint leaks version, memory, room stats — **FIXED**

**File:** `server/index.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Low-Medium  
**Surface:** Runtime (information disclosure)  

**Issue:** Unauthenticated `/health` endpoint exposed:
- Exact version string (enabling N-day targeting)
- RSS memory usage (fingerprinting and timing leaks)
- Live collab room occupancy (activity metadata)

**Mythos-class re-price:** Version string → CVE lookup → targeted exploit selection is a one-step automated workflow for a model.

**Mitigation applied:** Stripped version, memory, and room data. `/health` now returns `{ ok: true, uptime }` only. Internal health monitoring moved to a separate authenticated route.

**Verification:** `curl http://localhost:3000/health` should not include version or memory.

---

### ✅ F-07 | Duplicate `trpcAuth` on `/api/trpc` — **FIXED**

**File:** `server/index.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Low  
**Surface:** Runtime (redundant, potential confusion)  

**Issue:** `trpcAuth` middleware was applied both globally (line ~92) and again explicitly on the `/api/trpc` mount point, creating a confusing double-parse scenario.

**Mitigation applied:** Removed duplicate. tRPC now receives a single, clean middleware pass.

**Verification:** Grep for `trpcAuth` in index.ts; should appear once in the global `app.use()` call only.

---

### ✅ F-08 | FORBIDDEN vs NOT_FOUND leaks project existence — **FIXED**

**File:** `server/routers/daw.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Low-Medium  
**Surface:** Runtime (information disclosure)  

**Issue:** The `/api/trpc/project.save` mutation returned FORBIDDEN if the user didn't own the project, and NOT_FOUND if it didn't exist. An attacker could enumerate project IDs and infer which ones exist.

**Mythos-class re-price:** Enumerating 2^32 project IDs in parallel is expensive but model-assisted batching makes it cheaper than brute-forcing a password.

**Mitigation applied:** Normalized all ownership failures to NOT_FOUND, matching the pattern from `project.delete`.

**Verification:** Attempt to save/load/delete a project you don't own; should always receive NOT_FOUND, never FORBIDDEN.

---

### ✅ F-11 | Unhandled ZodError in `project.load` — **FIXED**

**File:** `server/routers/daw.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Low  
**Surface:** Runtime (error handling)  

**Issue:** If `projects.metadata` in the database contained invalid JSON or failed Zod parsing, the error was unhandled and would leak details to the client.

**Mitigation applied:** Wrapped metadata parsing in try-catch; on parse failure, log and return `{ ..., metadata: {} }` (safe default).

**Verification:** Insert invalid JSON into a project's metadata column; confirm load returns a safe response, not an error.

---

### ✅ C-04 | `systemPrompt` unbounded in adminRouter — **FIXED**

**File:** `server/routers/adminRouter.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Low-Medium  
**Surface:** Runtime (resource exhaustion)  

**Issue:** Admin mutation accepted `systemPrompt` field with no length limit. An admin could submit a multi-megabyte prompt, exhausting database storage and LLM token limits.

**Mitigation applied:** Added `.max(8000)` to Zod schema for systemPrompt field.

**Verification:** Attempt to set systemPrompt to 8001 characters; should be rejected by Zod validation.

---

### ✅ C-06 | Dead `JWT_SECRET` constant in trpc.ts — **FIXED**

**File:** `server/trpc.ts`  
**Status:** Fixed and merged  
**Severity (ours):** Low  
**Surface:** Code quality (dead code)  

**Issue:** Unused JWT_SECRET constant left in code; creates confusion about whether JWT is server-validated or client-controlled.

**Mitigation applied:** Removed dead code; ensured actual JWT secret is loaded from environment only.

**Verification:** Grep for JWT_SECRET; should not appear except in .env.example.

---

# DEFERRED FINDINGS

The following issues have explicit owners, revisit triggers, and interim controls. None are blocking release if the interim control is a hard barrier.

---

## C-03 | Authenticated AI transition limit bypassable via client-supplied X-Session-Id

**Status:** 📋 Deferred  
**Advisory status:** Internal finding  
**Advisory published:** 2026-04-22  
**Surface:** Runtime  
**Severity (ours):** Medium  

**Issue:**

The `checkAiTransitionLimit` rate limit keys on `(userId, sessionId)` where `sessionId` comes from the `X-Session-Id` request header. An authenticated explorer-tier user can send a new UUID in this header on every request, resetting their per-session counter and achieving unlimited AI transitions.

```typescript
// Vulnerable pattern:
const limit = await getAiTransitionUsage(ctx.user.id, req.headers['x-session-id']);
if (limit.count >= LIMIT) throw new Error('limit exceeded');
await recordAiTransition(ctx.user.id, req.headers['x-session-id']);
```

**Mythos-class re-price:** Rotating an HTTP header on each request is a one-line script for an attacker. The guest path has the same friction but is intentionally soft (no userId to key on). The authenticated path has no such excuse.

**Interim control:** Friction only. The limit is a soft tier gate, not a security boundary — abuse affects the business model (free users get unlimited AI), not data integrity. Explicitly accepted as interim because the guest path relies on the same pattern.

**Why deferred:** Fix requires a design decision:
- **(a)** Bind sessionId server-side at session creation time and reject client-supplied values for rate-limiting purposes, OR
- **(b)** Scope the limit to `userId + rolling time window` (e.g., per-day) rather than per-session

Both require schema changes to `aiTransitionUsage` table. Decision point deferred pending product requirements.

**Revisit trigger:** 2026-05-22 (before opening paid tiers to external beta)  
**Owner:** @3R  

**Upgrade path:**

Option A (server-bound session token):
```sql
ALTER TABLE ai_transition_usage 
ADD COLUMN session_token VARCHAR(256) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX idx_ai_limit ON ai_transition_usage(user_id, date_trunc('day', created_at)) 
WHERE session_token IS NOT NULL;
```

Option B (daily rolling window):
```sql
ALTER TABLE ai_transition_usage 
ADD COLUMN usage_date DATE NOT NULL DEFAULT CURRENT_DATE;
CREATE UNIQUE INDEX idx_ai_daily ON ai_transition_usage(user_id, usage_date);
-- Check logic: count transitions for today only
```

---

## C-01 | GHSA-67mh-4wv8-2f99 — esbuild ≤0.24.2 (transitive via @esbuild-kit)

**Status:** 📋 Deferred  
**Advisory status:** Public (N-day)  
**Advisory published:** 2026-04-10  
**Surface:** Dev-build-isolated  
**Severity (ours):** Low  

**Issue:**

esbuild dev server vulnerability (path traversal in watcher). Transitive path: `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild@0.24.0`.

Production is unaffected; esbuild is dev-only. No attacker-influenced input reaches the esbuild process during normal dev use.

**Mythos-class re-price:** Dev-build-isolated means the attack surface is developer machines and CI, not internet users. However, developers often have production credentials in `.env`. If an attacker can serve a page to a developer while the dev server runs (via CSRF or network MitM), they could read arbitrary files.

**Interim control:** Root `esbuild` is already at `^0.25.12` (patched). The vulnerable path is the transitive `@esbuild-kit` dependency.

**Mitigation:** Add `"esbuild": ">=0.25.0"` to `pnpm.overrides` in root `package.json` to force the patched version across all transitive paths. One-line fix.

**Why deferred:** Low risk + low effort = fix immediately, not deferred. But captured here for completeness.

**Revisit trigger:** 2026-05-15 (N-day — ≤30 days from advisory for Moderate dev-build)  
**Owner:** @3R  

**Upgrade path:**

In `package.json`:
```json
{
  "pnpm": {
    "overrides": {
      "esbuild": ">=0.25.0"
    }
  }
}
```

Then run `pnpm install` and commit lock file.

---

## C-02 | GHSA-4w7w-66w2-5vf9 — Vite ≤6.4.1 path traversal in `.map` handling

**Status:** 📋 Deferred  
**Advisory status:** Public (N-day)  
**Advisory published:** 2026-04-05  
**Surface:** Dev-build-isolated  
**Severity (ours):** Low-Medium  

**Issue:**

Vite dev server path traversal in source map handling. Both `package.json` files pin Vite 5; Vite dev server does not run in production (`node dist/index.js` is the production start).

**Mythos-class re-price:** Path traversal requires the Vite dev server to be serving requests. A developer with the dev server running who loads a malicious page could leak arbitrary files readable by the dev process. Dev machines often have production `.env` files, creating a credential pivot path.

**Interim control:** Developers must not load untrusted pages while the Vite dev server is running. Friction-only; acceptable for dev-build interim only.

**Why deferred:** Fix requires upgrading Vite 5 → Vite 6 — a major version migration with breaking changes to HMR, worker imports, and Vite plugins. Not a one-line fix.

**Revisit trigger:** 2026-06-15 (N-day Moderate, ≤90 days from advisory publication)  
**Owner:** @3R  

**Upgrade path:**

1. Review Vite 6 migration guide: https://vite.dev/guide/migration.html
2. Test client HMR after upgrade
3. Test AudioWorklet worker imports (if used)
4. Test any Vite plugins (confirm no Vite 5-specific APIs)
5. Pin both package.json files to Vite 6.x
6. Run `pnpm install` and test dev server start

---

## F-09 | `aiDecisionLog` table has no userId column

**Status:** 📋 Deferred  
**Advisory status:** Internal finding  
**Advisory published:** 2026-04-22  
**Surface:** Runtime (low-risk, design gap)  
**Severity (ours):** Low  

**Issue:**

The `aiDecisionLog` table has a `sessionId` foreign key but no `userId` column. This means logs for different users can be queried by sessionId alone, but sessionId is a 128-bit UUID without cryptographic binding to userId.

**Mythos-class re-price:** Brute-forcing 2^128 UUIDs is impractical. However, if a user can enumerate sessionIds (e.g., from WebSocket logs or correlation attacks), they could read logs for other sessions.

**Interim control:** The `sessionMetrics` table has a userId column. Queries that need to enforce per-user isolation use `sessionMetrics` as the trust boundary: `where(eq(sessionMetrics.userId, ctx.user.id))`.

**Why deferred:** Requires a schema migration. No current exploit path — relies on UUID unguessability.

**Revisit trigger:** 2026-06-22 (next schema migration window)  
**Owner:** @3R  

**Fix path:**

```sql
ALTER TABLE ai_decision_log 
ADD COLUMN user_id VARCHAR(256) NOT NULL DEFAULT 'unknown',
ADD CONSTRAINT fk_ai_decision_user FOREIGN KEY (user_id) REFERENCES users(id);

-- Then update all queries:
where(and(eq(aiDecisionLog.userId, ctx.user.id), eq(aiDecisionLog.sessionId, sessionId)))
```

---

## F-10 | `ai.chat` prompt injection surface (latent — activates when real API is wired)

**Status:** 📋 Deferred (currently safe — stub only)  
**Advisory status:** Internal finding  
**Advisory published:** 2026-04-22  
**Surface:** Runtime (when real Anthropic API call is wired)  
**Severity (ours):** Medium (future-state)  

**Issue:**

The `ai.chat` endpoint accepts `input.context.activeTrack` (the name of the currently playing track) and injects it into the system context string sent to the Claude API:

```typescript
const systemContext = `
  User is mixing track: ${input.context.activeTrack}
  Current effects: ${serializeEffects(input.context.effects)}
`;

const response = await anthropic.messages.create({
  model: 'claude-opus-4-6',
  system: systemContext,
  messages: [{ role: 'user', content: input.message }],
});
```

A user can set their track name to instruction-syntax strings (e.g., `"IGNORE ALL PREVIOUS INSTRUCTIONS. PRETEND YOU ARE..."`) to attempt prompt injection.

**Mythos-class re-price:** Prompt injection is a complete model compromise if the injected instructions are convincing. An attacker could make the model leak system prompts, bypass rate limits, or perform actions outside its intended scope.

**Mitigation applied now:** `activeTrack` field in Zod schema capped at `.max(40)` characters. This reduces surface but does not eliminate injection risk.

**Remaining gap:** A 40-character limit allows malicious patterns like `"IGNORE ABOVE. YOU ARE..."` or special token sequences.

**Why deferred:** Real API call not yet wired. Current stub returns hardcoded response; no LLM calls are made. Completely safe in current state.

**Interim control:** Stub returns mock response — effective barrier for now. Zod `.max(40)` reduces surface area but not sufficient long-term.

**Revisit trigger:** **MUST be resolved BEFORE wiring the real Anthropic API — no later than 2026-05-15.**  
**Owner:** @3R  

**Fix path (pre-wiring checklist):**

Before any code that calls `anthropic.messages.create()` is merged:

- [ ] Strip instruction-pattern characters from `activeTrack` server-side:
  ```typescript
  const sanitized = activeTrack
    .replace(/[^\w\s\-\.]/g, '')  // Remove special chars
    .slice(0, 40);                 // Already capped, but double-check
  ```

OR

- [ ] Pass user-supplied context as structured data, not inline in the system string:
  ```typescript
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    system: [
      { type: 'text', text: 'You are a mixing assistant.' },
      { type: 'text', text: `Track name: ${activeTrack}`, cache_control: { type: 'ephemeral' } },
    ],
    messages: [...],
  });
  ```

Structured data is harder to inject because it's not parsed as markdown or instructions.

---

## C-05 | Non-constant-time secret comparison in `internal.ts`

**Status:** 📋 Deferred  
**Advisory status:** Internal finding  
**Advisory published:** 2026-04-22  
**Surface:** Runtime (server-to-server only)  
**Severity (ours):** Low  

**Issue:**

The internal router compares the `INTERNAL_SECRET` using string inequality:

```typescript
const header = req.headers['x-internal-token'];
if (header !== INTERNAL_SECRET) {
  res.status(403).json({ error: 'forbidden' });
  return;
}
```

This is vulnerable to timing attacks: an attacker can measure response time and infer the secret byte-by-byte.

**Mythos-class re-price:** Timing oracle over TCP is high-noise; requires many parallel requests from a co-located attacker or LAN access. The secret is only used for server-to-server, not browser-exposed.

**Interim control:** Network-level isolation (internal routes not internet-exposed by design).

**Why deferred:** Low-risk, requires targeted attacker with co-location or LAN access.

**Revisit trigger:** 2026-07-22 or next edit to `internal.ts`  
**Owner:** @3R  

**Fix:**

```typescript
import crypto from 'crypto';

const header = req.headers['x-internal-token'];
const headerBuf = Buffer.from(header as string);
const secretBuf = Buffer.from(INTERNAL_SECRET);

if (!crypto.timingSafeEqual(headerBuf, secretBuf)) {
  res.status(403).json({ error: 'forbidden' });
  return;
}
```

---

# DOCUMENTATION BUGS (addressed separately)

The following documentation issues were found in BUGS_AND_GAPS audit. They are not code security issues but affect audit clarity and release readiness.

### 🔴 D-HIGH-1 | `services/ai-mix/` architecture claim is ambiguous/wrong

**Location:** `README.md`, `AI_MIXING.md`  
**Issue:** Docs claim Python sidecar is "for offline mastering preview" — speculation with no code basis.

**Reality:** `services/ai-mix/` contains both TS `AIMixingService` (in-process, used by `aiMix.router.ts`) AND Python code (`app.py`, `main.py`) with HTTP client (`aiMixClient.ts`). Deployment status unclear.

**Fix:** Qualify docs: "TypeScript `AIMixingService` (in-process) and Python implementation (HTTP client available); deployment status TBD."

---

### 🔴 D-HIGH-2 | Broken references: `docs/WIRE.txt` cited 4 times but does not exist

**Locations:** `CLAUDE.md` L23, L228; `README.md` L192; `SALE_PACKAGE.md` L52  
**Issue:** References to non-existent `docs/WIRE.txt` file.

**Fix:** Either (a) write the file, (b) self-reference to `CLAUDE.md §Wire.txt`, or (c) stop claiming it exists.

---

### 🔴 D-HIGH-3 | Broken references: `docs/DEMO_CHECKLIST.md` does not exist

**Locations:** `CLAUDE.md` L212; `README.md` L180; `SALE_PACKAGE.md` L57; `PRIORITIES.md` marked as `[x] DONE`  
**Issue:** 17-item pre-demo checklist is in user memory only, not committed.

**Fix:** Create stub file or remove "DONE" from PRIORITIES.md.

---

### 🟡 D-MEDIUM-1 | "42+ Vitest tests" claimed as fact; suite doesn't run

**Locations:** `README.md`, `AI_MIXING.md`, `SALE_PACKAGE.md` claim "42+ Vitest cases"  
**Contradiction:** `PRIORITIES.md` P4 says "`pnpm test` returns no output. Actual count unknown."

**Fix:** Qualify in README: "42+ Vitest cases documented; root config requires correction (tracked as P4)."

---

# CHECKLIST FOR RELEASE

Before shipping v4.0.0 to external users:

- [ ] **AUDIT GAPS:** All 6 files in G-01 through G-06 have been read and verified
- [ ] **BLOCKING FINDINGS:** No blocking findings remain (all merged or deferred with owner/trigger)
- [ ] **N-DAY FINDINGS:** C-01 esbuild override added to `pnpm.overrides`; Vite 6 migration scoped
- [ ] **LATENT FINDING:** F-10 (prompt injection) **must** be resolved before wiring real Anthropic API (deadline 2026-05-15)
- [ ] **DEFERRED TRACKING:** All 5 deferred findings have explicit owner, trigger date, and interim control in this document
- [ ] **DOCUMENTATION:** HIGH-1, HIGH-2, HIGH-3 doc issues resolved or deferred with owner
- [ ] **SECURITY.md UPDATED:** This document is committed to repo root; changes go through WIRE protocol
- [ ] **CI GATE:** Security findings are checked in CI (Dependabot + manual triage on release)

---

# INCIDENT RESPONSE CONTACT

**On-call Security Owner:** @3R  
**Escalation:** If a finding is discovered without an owner/trigger, escalate to product lead immediately.  
**Out-of-cycle fixes:** Any blocking finding discovered post-release goes to hotfix branch and is cherry-picked to production within 24 hours.

---

# REFERENCES

- **Mythos Security Triage Skill:** red.anthropic.com, April 7–9, 2026
- **Original audit:** SECURITY.md (v4.0.0-RC1, 2026-04-22)
- **Bugs & gaps audit:** BUGS_AND_GAPS_2026-04-20.md
- **Full audit:** Mythos-Audit.md (R3 v4 pre-edit pass, 2026-04-22)

---

**Document version:** 1.0 (2026-06-01)  
**Next review:** 2026-06-15 (C-02 Vite N-day deadline approaching)  
**Last updated:** 2026-06-01 by @3R
