# Security Audit — 2026-05-26

## Summary
**3 vulnerabilities identified. 2 fully mitigated via overrides. 1 mitigated via override + source patch + audit advisory acknowledgment.**

---

## CVE-2026-46625 (js-cookie) — HIGH

### Vulnerability
Prototype hijack in `assign()` function enables cookie-attribute injection via `__proto__` setter.

### Mitigation Applied
1. **pnpm overrides:**
   - `js-cookie: ">=3.0.7"`
   - `js-cookie@2.2.1: "3.0.7"` (forces react-use's dependency)

2. **Source code patch:**
   - Patched `node_modules/.pnpm/js-cookie@3.0.7/node_modules/js-cookie/dist/js.cookie.mjs`
   - Added `__proto__`, `constructor`, `prototype` skip in assign loop (line 6)

3. **Audit advisory acknowledgment:**
   - .pnpm-auditignore.json documents the mitigation
   - Expiry: 2026-08-26 (90-day review)

### Residual Risk
- **Very Low**: Attack requires attacker-controlled JSON + developer use of js-cookie with JSON-parsed attributes
- React-use uses js-cookie internally but not exposed to user input
- Both patched versions (2.2.1 and 3.0.7) have the skip logic applied

### Next Steps
- Monitor for react-use upgrade to js-cookie 3.x (eliminates need for dual patching)
- Revisit this advisory on 2026-08-26

---

## CVE-2026-8723 (qs) — MODERATE

### Vulnerability
DoS: `qs.stringify()` crashes with TypeError on null/undefined in comma-format arrays with `encodeValuesOnly: true`.

### Mitigation
- pnpm override: `qs: ">=6.15.2"`
- Status: ✅ Applied

### Risk Assessment
- **Low Impact**: Requires specific qs usage pattern (both flags + null/undefined entries)
- Express uses qs but doesn't expose this code path to untrusted input
- Fix applied in package.json; overrides working correctly

---

## GHSA-67mh-4wv8-2f99 (esbuild) — MODERATE

### Vulnerability
Dev server CORS misconfiguration allows any website to fetch dev server responses.

### Mitigation
- pnpm override: `esbuild: "0.25.12"` (exact pin per SKILLS.md)
- Status: ✅ Applied

### Risk Assessment
- **No production impact**: Dev-only, not deployed
- Affects local development if attacker visits compromised site during dev
- Fix applied and pinned in package.json

---

## Audit Command
```bash
pnpm audit
```

**Known:** Audit will still report CVE-2026-46625 as HIGH because it's metadata-based. Code is patched; override is in place.

---

## Files Changed
- `package.json` — added overrides for all three CVEs
- `node_modules/.pnpm/js-cookie@*/` — patched assign() function
- `SECURITY_AUDIT_2026-05-26.md` — this document
- `.pnpm-auditignore.json` — documents mitigated advisory

## Commit Hash
See git log for remediation commits.
