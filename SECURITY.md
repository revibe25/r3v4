# Security & Vulnerabilities

## Known Issues (Documented)

### 3 Transitive Dependencies (Dev-Time Only)

| Package | Severity | Source | Status |
|---------|----------|--------|--------|
| js-cookie ≤3.0.5 | HIGH | react-use@17.6.0 | Awaiting react-use update |
| qs ≤6.15.1 | MODERATE | express@4.22.1 → body-parser | Awaiting express update |
| esbuild ≤0.24.2 | MODERATE | drizzle-kit → @esbuild-kit | Awaiting drizzle-kit update |

**Context:** All three are dev-time dependencies (testing, build tools, UI utilities). None execute in production code paths.

**Remediation Path:** Scheduled for next dependency audit when upstream packages release updates.

---

## Resolved Issues ✅

- Vite path traversal (GHSA-4w7w-66w2-5vf9)
- brace-expansion DoS
- pnpm config deprecation warnings


**Status:** ✅ FIXED (2026-05-29)
**Solution:** Removed duplicate schema definition that used sessionId-based rate limit key.
Kept corrected version using usageDate (server-generated daily key).
**Verification:** `pnpm tsc --noEmit` — no TS2451/TS2300 errors on aiTransitionUsage
**Migration:** Schema cleanup only, no data migration needed

## Pending Audit Surfaces

The following surfaces are tracked in MYTHOS-SKILL-v2.md and scheduled for full audit review:

| Surface | Status | Notes |
|---|---|---|
| `server/middleware/auth.ts` | Pending | Auth middleware audit — scheduled |
| `server/base-procedures.ts` | Pending | tRPC base procedures audit — scheduled |
| `server/routes/internal.ts` | Pending | Internal routes audit — scheduled |
| `server/routers/adminRouter.ts` | Pending | Admin router audit — scheduled |
| `ws/collab.ts` | Pending | WebSocket collab audit — scheduled |
| `session-metrics.service.ts` | Pending | Session metrics service audit — scheduled |
| `crypto.timingSafeEqual` | Pending | Timing-safe comparison usage audit — scheduled |
