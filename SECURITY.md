
## 2026-05-05 — Dependabot Alert Batch
- **Count:** 13 vulnerabilities (4 high, 9 moderate)
- **Source:** GitHub Dependabot post-push scan
- **Status:** Pending triage per mythos-security-triage skill
- **Owner:** @r3
- **Trigger:** 2026-05-12 (7 days to complete triage)
- **Action:** Run full 5-lesson workflow, produce per-finding notes

---

### D-01 — CVE-2026-39356 · drizzle-orm@0.39.3 SQL injection

- **Status:** Deferred
- **Advisory status:** Public (N-day)
- **Advisory published:** 2026 (https://github.com/advisories/CVE-2026-39356)
- **Surface:** Runtime — production dependency via @r3vibe/server
- **Our severity:** High — SQL injection via improperly escaped sql`` template strings
- **Advisory severity:** High — delta: same
- **Mythos-class re-price:** Model-assisted SQL injection from a CVE ID is automated. However, the vulnerable pattern requires unescaped user input inside sql`` — absent here.
- **Why deferred:** drizzle-orm 0.45.x upgrade produces 147 breaking type errors across 8 server files. Migration requires a scoped read-before-write pass on each file.
- **Interim control:** BARRIER-CLASS. Audit confirmed: only sql`` usage in runtime code is storage.ts:241 which wraps user input in sql.param() (proper Postgres parameterization). All other sql`` usages are static schema defaults. ORM builder enforces parameterization on all other queries. CVE's vulnerable pattern is not present.
- **Revisit trigger:** 2026-06-01 (High N-day SLA ≤30 days from pin date)
- **Owner:** @3R
- **Upgrade path:** drizzle-orm 0.39.3 → 0.45.2. Affected files needing migration: server/index.ts (10 errors), server/routers/daw.ts (38), server/routers/sessionMetrics.router.ts (19), server/middleware/feature-gate.ts (4), server/routes/mock-billing.ts (6), server/services/mock-billing.ts (11), server/services/session-metrics.service.ts (30), server/services/stripe-subscription.ts (29). Read each file before patching. Pin currently held at 0.39.3 via pnpm.overrides.

---

### D-04 — CVE-2026-33671 · picomatch (ReDoS via extglob)
### D-10 — CVE-2026-33672 · picomatch (method injection, POSIX char classes)

- **Status:** Deferred (batch entry — both findings, same component)
- **Advisory status:** Public (N-day)
- **Surface:** Dev-build-isolated — picomatch is a transitive dep of chokidar → vite. Never called with user-supplied input in production. No supply-chain path to shipped artifacts. No prod credential access.
- **Our severity:** Low (advisory: High) — delta: −2. Disagreement resolved: advisory grades for generic deployments where picomatch processes user input. In R3 v4 it processes only developer-written glob patterns in the build pipeline.
- **Interim control:** pnpm.overrides pins esbuild >=0.25.0 which pulls compatible picomatch transitively. Quarterly review scheduled.
- **Revisit trigger:** 2026-08-01 (quarterly)
- **Owner:** @3R

---

### D-08 — CVE-2026-39365 · vite path traversal in .map handling (NEW — distinct from C-02)

- **Status:** Deferred
- **Advisory status:** Public (N-day)
- **Surface:** Dev-build-credential-pivot — Vite dev server does not run in production, but dev machines hold .env with production DB URL, Anthropic API key, Stripe keys. Path traversal on dev server can pivot to prod credentials.
- **Our severity:** Medium — delta: same as advisory
- **Mythos-class re-price:** Social engineering a developer to load a page while dev server runs (malicious PR preview link, fake npm README) is cheap. Dev→prod credential pivot path is real.
- **Interim control:** Friction-only (do not load untrusted pages with dev server running). Acceptable interim for dev-build only — explicitly accepted.
- **Revisit trigger:** 2026-08-03 (≤90 days from advisory, Medium N-day)
- **Owner:** @3R
- **Upgrade path:** Vite 5 → 6 migration (already planned for C-02 upgrade cycle). Resolves both C-02 and D-08 in one migration.

---

### D-09 — CVE-2026-33750 · brace-expansion (zero-step sequence process hang)

- **Status:** Deferred (batch entry)
- **Advisory status:** Public (N-day)
- **Surface:** Dev-build-isolated — transitive glob utility, build pipeline only, no user input
- **Our severity:** Low (advisory: Medium) — delta: −1. Generic advisory assumes user-supplied brace patterns; R3 v4 uses only developer-written globs.
- **Interim control:** Dev-build-isolated. Document and pin. Quarterly review.
- **Revisit trigger:** 2026-08-01 (quarterly)
- **Owner:** @3R

---

### D-05 — CVE-2026-41305 · postcss XSS via unescaped </style>

- **Status:** Deferred
- **Advisory status:** Public (N-day)
- **Surface:** Dev-build — postcss processes CSS at build time. Verify whether any dynamic/user-supplied CSS strings pass through postcss at build time. If yes: supply-chain path to shipped bundle exists.
- **Our severity:** Medium pending surface verification
- **Interim control:** No dynamic CSS sources identified in build pipeline. Static stylesheets only — friction-class isolation. Acceptable interim.
- **Revisit trigger:** 2026-08-03 (≤90 days, Medium)
- **Owner:** @3R
- **Action:** Confirm no user-supplied CSS strings reach postcss at build. Close if confirmed static-only.

---

### F-WS-01 — ws/collab.ts · JWT_SECRET optional: WebSocket auth fails open

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** 2026-05-06
- **Surface:** Runtime — WebSocket endpoint at /ws
- **Our severity:** Medium — if JWT_SECRET is unset in production, all WebSocket connections are unauthenticated. The comment calls this 'graceful degradation' but in production it is a complete auth bypass on the collab surface.
- **Mythos-class re-price:** Discovering that JWT_SECRET is unset via error response timing or by attempting an unauthed WS connection is trivial. Once known, the room is open to any client.
- **Why deferred:** Requires deployment config verification (JWT_SECRET is set in prod). Code fix is a one-line guard. Low engineering cost but needs env confirmation.
- **Interim control:** Verify JWT_SECRET is set in all production and staging environments. Add to deployment checklist.
- **Revisit trigger:** 2026-05-22 (before external beta)
- **Owner:** @3R
- **Fix:** In verifyToken(), if !secret: ws.close(4401, 'Server misconfiguration') rather than returning {}. Add startup assertion: if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required').

---

### F-WS-02 — ws/collab.ts · Client-supplied userId overrides JWT identity

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** 2026-05-06
- **Surface:** Runtime — WebSocket join handler
- **Our severity:** Medium — in the join handler, msg.userId takes precedence over tokenUserId from JWT verification. A client with a valid JWT for userId A can join as userId B by sending { type:'join', userId:'B' }. Allows impersonation in collaborative rooms.
- **Mythos-class re-price:** WS frame manipulation is trivial. Any browser devtools session can craft the join message. Room data is ephemeral (not persisted) which limits impact, but impersonation is real.
- **Why deferred:** Room state is non-persistent and action broadcasts are allow-listed. Business impact is limited to in-session confusion, not data exfiltration. Fix is one line.
- **Interim control:** Friction-only. The ALLOWED_ACTION_TYPES allow-list limits what an impersonator can broadcast. Acceptable interim for pre-external-beta only.
- **Revisit trigger:** 2026-05-22 (before external beta)
- **Owner:** @3R
- **Fix:** In join handler: const userId = tokenUserId ?? (msg.userId as string)?.slice(0, 32). When JWT_SECRET is set and tokenUserId exists, do not accept msg.userId override.

---

### AUDIT GAP CLOSED — ws/collab.ts getRoomStats()

- getRoomStats() returns { roomCount, totalUsers, rooms: [{id, users}] } — aggregate only.
- No per-user identifiers (userId, name, color) are included.
- Finding: clean. Gap closed 2026-05-06.

---

### AUDIT GAP CLOSED — session-metrics.service.ts userId scoping

- startSession: userId stored at INSERT. ✅
- stopSession: userId checked at application layer (existing.userId !== userId). ✅
  DB-layer WHERE clause added as defense-in-depth (this patch cycle).
- getSessionSummary: userId checked at application layer. ✅
  DB-layer WHERE clause added as defense-in-depth (this patch cycle).
- Finding: application-layer scoping was correct. DB-layer defense-in-depth added.
  Gap closed 2026-05-06.

---

### AUDIT GAP CLOSED — effectChainsTable / waveformEditsTable exposure

- **CRITICAL** finding promoted from audit gap to fixed:
- effectChainsTable: user_id column added (migration 0008), requireUser added to all routes,
  WHERE userId added to all 5 chain routes in presets.ts.
- effectPresetsTable: same — user_id column added, all 5 preset routes secured.
- waveformEditsTable: user_id column added (migration 0008). No router currently exposes
  this table — audit confirmed no exposure. Column added preventatively.
- Gap closed 2026-05-06.

