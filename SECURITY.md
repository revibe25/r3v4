# R3 v4 - Security Policy & Accepted Risks

Last reviewed: 2026-04-20

## Reporting

Private disclosure only. Contact repo owner directly. Do not open public issues
for unfixed vulnerabilities.

## Fixed in current HEAD

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
- Reassessment trigger: drizzle-kit stable release drops @esbuild-kit chain.
  Watch: github.com/drizzle-team/drizzle-orm/issues/5481

### CVE-2025-22871 - esbuild Go HTTP smuggling (via drizzle-kit direct esbuild)

- Path: drizzle-kit -> esbuild@0.25.12 (Go runtime CVE from esbuild's bundled Go)
- Why accepted: devDeps only, not in production runtime
- Reassessment trigger: drizzle-kit ships an esbuild with newer Go toolchain

## Scheduled (post-MVP)

### GHSA-4w7w-66w2-5vf9 - vite path traversal in optimized deps .map handling

- Current: vite 5.4.21. No 5.x backport exists (patched in 6.4.2+, 7.3.2+, 8.0.5+).
- Mitigation in place: `client/vite.config.ts` dev server binds to `localhost`
  by default; LAN exposure opt-in via `VITE_HOST_LAN=1`. Advisory specifically
  targets LAN-exposed dev servers.
- Scheduled: vite 5 -> 6 migration, post-MVP.

## Notes

- tRPC client/server/react-query triad pinned to exact 11.12.0 across all
  workspaces to satisfy tRPC's strict peer match contract.
- Dependabot rescans on push. HIGH alerts #25, #26 (drizzle-orm) and #7, #19
  (picomatch) should close on the next rescan following commit b9f3f3a.
