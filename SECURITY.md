# R3 v4 - Security Policy & Accepted Risks

Last reviewed: 2026-04-20

## Reporting

Private disclosure only. Contact repo owner directly. Do not open public issues
for unfixed vulnerabilities.

## Fixed in current HEAD

- **2026-04-22 session fixes (CORS, vite dev-server, JWT JTI)**
  - `index.ts` CORS origin now fails closed at startup if `ALLOWED_ORIGINS` is
    unset in production; dev falls back to `http://localhost:5173`.
  - `client/vite.config.ts` dev server `cors` changed from `true` to `false`;
    closes same-machine browser-to-dev-server request vector for
    GHSA-4w7w-66w2-5vf9 while localhost bind remains in place.
  - `server/routes/auth.ts` `signToken()` now injects `jti: randomUUID()` into
    every issued token (Phase 1). Phase 2 (blacklist + revocation check) tracked
    below under Scheduled.

- **CVE-2026-39356** - Drizzle ORM SQL injection via improperly escaped
  identifiers in `sql.identifier()` and `.as()` APIs.
  **Patched:** drizzle-orm >= 0.45.2. **Current:** 0.45.2 (commit b9f3f3a).
- **CVE-2026-33671** - picomatch ReDoS via extglob quantifiers (catastrophic
  backtracking on crafted patterns).
  **Patched:** picomatch >= 2.3.2 / 3.0.2 / 4.0.4.
  **Current:** 2.3.2 via pnpm.overrides (commit b9f3f3a).

## Accepted risks (dev-only, not shipped to production)

These are advisories in devDependency paths. None run in the Railway production
container.

### GHSA-67mh-4wv8-2f99 - esbuild dev-server CORS (via drizzle-kit -> @esbuild-kit)

- Path: drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild@0.18.20
- Why accepted: drizzle-kit is devDeps. @esbuild-kit is upstream-abandoned
  (author moved to tsx). drizzle-team has a fix tagged "fixed-in-beta" but not
  released on stable as of this review.
- Second path: `.>vite>esbuild` — same CVE via vite's bundled esbuild.
  `cors: false` on vite dev server (applied 2026-04-22) partially mitigates
  the browser-origin vector for this path.
- **Revisit trigger:** 2026-07-22 (90-day N-day SLA from triage date 2026-04-22).
  Resolved when vite 6 upgrade lands (ships esbuild >=0.25.0) AND drizzle-kit
  drops @esbuild-kit chain.
  Watch: github.com/drizzle-team/drizzle-orm/issues/5481
- **Owner:** @r3v

### CVE-2025-22871 - esbuild Go HTTP smuggling (via drizzle-kit direct esbuild)

- Path: drizzle-kit -> esbuild@0.25.12 (Go runtime CVE from esbuild's bundled Go)
- Why accepted: devDeps only, not in production runtime
- Reassessment trigger: drizzle-kit ships an esbuild with newer Go toolchain

## Scheduled (post-MVP)

### GHSA-4w7w-66w2-5vf9 - vite path traversal in optimized deps .map handling

- **Status:** Deferred
- **Advisory status:** Public
- **Advisory published:** 2025-04 (verify exact date; N-day clock running)
- **Surface:** Dev-build-credential-pivot — path traversal on vite dev server
  can reach `~/Stable/.env` which contains `JWT_SECRET`, `ANTHROPIC_API_KEY`,
  `STRIPE_SECRET_KEY`, `STORAGE_SECRET_ACCESS_KEY`, `DATABASE_URL`.
  Reclassified from advisory "moderate" to **High** under Mythos-class threat
  model (credential sweep from a single path traversal request).
- **Our severity:** High — delta +1 from advisory moderate; credential-pivot
  context not present in generic advisory.
- **Mythos-class re-price:** "Advisory targets LAN-exposed servers" — same-machine
  browser attack via `cors: true` was also a valid vector (now closed).
  "Attacker needs dev server access" — achievable from malicious webpage visited
  while dev server is running.
- **Interim controls (barrier-class, both now in place):**
  1. `host: 'localhost'` — blocks all external network access (was already set).
  2. `cors: false` — closes same-machine browser-origin request vector (applied 2026-04-22).
- **Why deferred:** vite 5→6 is a major version bump requiring migration testing
  against the full LLPTE pipeline and React plugin API changes.
- **Revisit trigger:** 2026-05-22 (30-day N-day SLA from triage date 2026-04-22)
- **Owner:** @r3v
- **Upgrade path:** vite.dev/guide/migration.html; verify @vitejs/plugin-react
  compat and manualChunks behaviour before merge.

### JWT JTI Phase 2 — token revocation blacklist

- **Status:** Deferred
- **Surface:** Runtime auth
- **Our severity:** Medium — Phase 1 (jti injection) applied 2026-04-22.
  Without Phase 2 a compromised token remains valid for up to 7 days (JWT_EXPIRES
  default). Revocation requires JWT_SECRET rotation which logs out all users.
- **Interim control (barrier):** jti claim now present in all issued tokens;
  field is ready to check against a blacklist once Phase 2 lands.
- **Why deferred:** Requires new DB migration and requireUser middleware update.
- **Revisit trigger:** Before first external beta user.
- **Owner:** @r3v
- **Work:** Add `jwt_blacklist(jti TEXT PK, expires_at TIMESTAMPTZ)` migration;
  check requireUser against table on each authenticated request; add /logout
  endpoint that inserts jti into blacklist.

### Audit gaps — surfaces never formally reviewed

The following surfaces have no prior audit record. Dependabot silence does not
imply safety. Each requires a dedicated review session before public registration.

| Surface | Risk class | Notes |
|---|---|---|
| `node-web-audio-api ^1.0.8` | Memory safety | Native C++ audio processing; attacker-controlled audio buffer input is unaudited |
| `multer` upload destinations | Path traversal | `LOOP_STORAGE_BASE` controls dest path; verify resolution and sanitisation |
| tRPC route row-level auth | IDOR | Verify every Drizzle query filters by `userId`; missing `where` = full data leak |
| WebSocket auth (`ws ^8.20.0`) | Auth bypass | Verify JWT re-validated on WS upgrade; unauthenticated upgrade = auth bypass |
| `ANTHROPIC_API_KEY` git history | Secret exposure | Run `git log -p \| grep -i anthropic` to confirm no committed secret from prior incident |

- **Owner:** @r3v
- **Revisit trigger:** Before opening public registration.

## Notes

- tRPC client/server/react-query triad pinned to exact 11.12.0 across all
  workspaces to satisfy tRPC's strict peer match contract.
- Dependabot rescans on push. HIGH alerts #25, #26 (drizzle-orm) and #7, #19
  (picomatch) should close on the next rescan following commit b9f3f3a.
