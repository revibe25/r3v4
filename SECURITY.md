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
