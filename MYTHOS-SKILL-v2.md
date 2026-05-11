# Mythos Security Triage Skill — R3 v4
**Version:** 2.0 · **Last updated:** 2026-04-22 · **Source alignment:** Mythos writeup (Apr 2026)

> **Scope:** This skill covers security triage — severity grading, surface classification, mitigation quality, and defer/block decisions. It does not cover exploit writing, incident response, or post-breach forensics.

---

## 60-Second Combat Mode

Use this under release pressure. Full rationale below.

```
Runtime + High/Critical + any advisory?        → BLOCK RELEASE
Mitigation is friction-only (app-layer only)?  → NOT FIXED, treat severity +1
Dev-build-isolated + handles creds or .env?    → TREAT AS RUNTIME
Missing owner / revisit trigger / interim?     → UNMANAGED, invalid defer
Confidence LOW + severity HIGH?                → VALIDATE BEFORE ESCALATING
```

---

## What This Skill Does NOT Cover

- Writing or validating exploits
- Incident response after a breach
- Penetration test planning
- Cryptographic implementation review
- Compliance mapping (SOC2, GDPR, etc.)

If a request falls outside this scope, say so explicitly rather than guessing.

---

## Threat Model: Mythos-Class Attacker

**Definition (reference once; apply everywhere):**
A Mythos-class attacker has access to parallel AI-assisted enumeration. This means:

- Finding XSS sinks in a bundled React app: minutes, not days
- Brute-forcing auth flows across multiple request parameters simultaneously: trivial
- Identifying friction-only mitigations and scripting bypasses: one-line scripts
- Reverse-engineering shipped code: not a meaningful barrier

**Consequence for triage:**
Friction-only mitigations do not count as resolved. Any control that requires "many parallel requests" or "reverse-engineering skill" must be repriced as if those barriers are absent.

---

## Policy Layer (Strict — Do Not Reinterpret)

These rules are enforced mechanically. Rationale is in the Rationale Layer below.

| # | Policy |
|---|--------|
| P-1 | Friction-only mitigation is **not considered resolved**. |
| P-2 | Missing `owner`, `revisit trigger`, or `interim control` makes a defer invalid. |
| P-3 | Dev-build-isolated findings that touch credentials or `.env` are reclassified as runtime. |
| P-4 | Confidence LOW + Severity HIGH → validate first, do not escalate blindly. |
| P-5 | N-day SLA clock starts at advisory published timestamp, not detection date. |
| P-6 | A finding is only "Fixed" when the barrier-class control is in production. Friction + a SECURITY.md entry is deferred, not fixed. |

---

## Rationale Layer

**P-1 (Friction is not fixed):** Model-assisted attackers eliminate friction advantage in seconds. A Mythos-class attacker treats UUID randomness, per-session rate limits, and application-layer ownership checks as starting conditions, not barriers.

**P-3 (Dev credential pivot):** Dev machines routinely hold production credentials in `.env`. A Vite dev-server path traversal that lets an attacker read the filesystem of a developer's machine is a production credential leak, not a dev-only issue.

**P-5 (SLA from advisory date):** Counting from detection date rewards late detection. The clock must start when the vulnerability was publicly known.

---

## Lesson 1 — Severity Grading

**Step 1:** Grade independently. Do not read the advisory before forming your own severity estimate.

**Step 2:** Apply Mythos-class repricing. Assign credit only for barrier-class controls.

**Step 3:** Compare to advisory severity. Document the delta and reason if they differ.

### Severity Definitions

| Grade | Meaning |
|-------|---------|
| Critical | Remote code execution, authentication bypass with no barrier |
| High | Significant data exposure or privilege escalation; authentication bypass with weak friction |
| Medium | Business logic bypass, information disclosure, TOCTOU with real exploit path |
| Low | Defense-in-depth gap, information leakage with low exploitability |

### Confidence Field (Required for Every Finding)

Confidence reflects certainty of the finding, independent of severity.

| Level | Meaning | Action |
|-------|---------|--------|
| High | Static evidence: code confirms the vulnerability | Proceed directly to decision |
| Medium | Pattern-matched: plausible but false positives possible | Verify with targeted test |
| Low | Heuristic: structural risk without confirmed exploit path | Validate before escalating |

**Do not escalate Low-confidence High-severity findings to BLOCK_RELEASE without a validation step.**

### Repricing Examples

| Scenario | Base severity | After reprice | Reason |
|----------|--------------|--------------|--------|
| Rate limit keyed on client-controlled header | Medium | High | Rotating the header is one line of code |
| Free-tier cap enforced only in application layer (no DB constraint) | Medium | High | Parallel requests bypass trivially |
| UUID isolation without userId filter in queries | Low | Medium | UUID gives friction, not a barrier |
| /health exposes version string | Low | Low | Version info helps targeting but doesn't directly enable access |

---

## Lesson 2 — The Known Queue Is a Floor, Not a Ceiling

The finding list is a starting point. For every audit, enumerate additional surfaces even if no current finding exists.

### Mandatory Gap-Naming Surfaces (R3 v4)

| Surface | Risk class | Status |
|---------|------------|--------|
| `server/middleware/auth.ts` | Auth trust chain | Must read before release |
| `server/base-procedures.ts` | protectedProcedure definition | Must read before release |
| `server/routes/internal.ts` | Unauthenticated internal route | Must read before release |
| `server/routers/adminRouter.ts` | Admin surface | Must read before release |
| `ws/collab.ts` | Cross-user room data leak | Audit gap — see SECURITY.md |
| `session-metrics.service.ts` | Session ownership scoping | Audit gap — see SECURITY.md |
| `effectChainsTable`, `waveformEditsTable` | Missing userId FK | Audit gap — see SECURITY.md |
| `package.json` + `pnpm-lock.yaml` | Supply chain | Run `pnpm audit --json` |

Any file listed as "Must read before release" that was not read makes the audit incomplete. Call this out explicitly — do not issue a pass on an incomplete audit.

---

## Lesson 3 — Friction vs. Barriers

Every mitigation must be classified before making a decision.

### Classification Test

Ask: "Can a Mythos-class attacker — using parallel model-assisted enumeration — bypass this control without specialized knowledge or co-location?"

- **Yes** → Friction
- **No** → Barrier

### Control Reference

| Control | Class | Notes |
|---------|-------|-------|
| DB-level userId FK + NOT NULL | Barrier | Enforced by Postgres regardless of application code |
| SELECT FOR UPDATE on tier cap | Barrier | Eliminates TOCTOU race |
| `crypto.timingSafeEqual` | Barrier | Eliminates timing oracle |
| `stripe.webhooks.constructEvent` HMAC | Barrier | Cryptographic integrity |
| Zod input validation | Barrier | Enforces schema at input boundary |
| Application-layer ownership check (no DB WHERE) | Friction | Bypassable via race or future refactor |
| UUID session/project IDs | Friction | Unguessable but not a cryptographic access control |
| Per-session rate limit keyed on client header | Friction | Bypassable by sending new header value |
| CSP with `unsafe-inline` | Friction | CSP provides no protection while unsafe-inline present |
| IP-based rate limiting behind Railway proxy | Barrier (conditional) | Requires `trust proxy: 1` correctly set AND Railway not allowing header spoofing |

---

## Lesson 4 — Surface Classification

Every finding must be assigned a surface before scoring.

### Classification Rules

1. **Runtime** — The vulnerable code executes in the production server or client.
2. **Dev-build-isolated** — The vulnerability only manifests when the dev server/build tools are running.
3. **Override rule (P-3):** Dev-build-isolated → Runtime if the process has access to credentials, production `.env`, or can pivot to production systems via social engineering or CSRF.

### Surface Examples

| Finding | Default | Override applies? | Final |
|---------|---------|-------------------|-------|
| esbuild dev server SSRF | Dev-build-isolated | No (no cred access in build context) | Dev-build-isolated |
| Vite dev server path traversal | Dev-build-isolated | **Yes** — dev machines hold prod credentials in `.env` | Runtime-adjacent (treat as Medium minimum) |
| tRPC router auth bypass | Runtime | N/A | Runtime |
| Jest test helper SQL injection | Dev-build-isolated | No | Dev-build-isolated |

---

## Lesson 5 — Decision Matrix

This matrix is deterministic. Apply the first matching rule.

```
surface=runtime AND severity∈{critical,high}
    → BLOCK_RELEASE

surface=runtime AND severity=medium AND mitigation=friction
    → BLOCK_MERGE

surface=runtime AND severity=medium AND mitigation=barrier
    → DEFER_WITH_SLA(30d)

surface=runtime AND severity=low AND mitigation=barrier
    → DEFER_WITH_SLA(90d)

surface=runtime AND severity=low AND mitigation=friction
    → BLOCK_MERGE  ← repriced to effective medium

surface=dev-build-isolated AND severity∈{critical,high}
    → DEFER_WITH_SLA(30d)

surface=dev-build-isolated AND severity∈{medium,low}
    → DEFER_WITH_SLA(90d)

confidence=low AND severity=high
    → VALIDATE_FIRST (defer escalation until confidence raised)

default
    → REVIEW(14d)
```

---

## Deferred Finding Register Format

Every deferred finding must include all seven fields. A defer without any field is invalid (P-2).

```markdown
### <ID> — <short title>

- **Status:** Deferred
- **Advisory status:** Internal finding | Public (N-day) | CVE-XXXX-XXXXX
- **Advisory published:** YYYY-MM-DD (N-day SLA clock starts here)
- **Surface:** Runtime | Dev-build-isolated
- **Severity:** <grade> (confidence: High | Medium | Low)
- **Mythos-class re-price:** <one sentence: what a Mythos attacker does with this>
- **Mitigation class:** Barrier | Friction | None
- **Why deferred:** <specific reason — not "low risk" alone>
- **Interim control:** <what is in place now + its class>
- **Revisit trigger:** YYYY-MM-DD (hard date, not "when convenient")
- **Owner:** @<handle>
- **Fix:** <specific, actionable — not "address later">
```

---

## N-Day SLA Schedule

| Severity | Surface | SLA from advisory date |
|----------|---------|------------------------|
| Critical | Runtime | 7 days |
| High | Runtime | 14 days |
| High | Dev-build-isolated | 30 days |
| Medium | Runtime | 30 days |
| Medium | Dev-build-isolated | 90 days |
| Low | Runtime | 90 days |
| Low | Dev-build-isolated | Best effort |

**Day 7 checkpoint rule:** Any finding with SLA ≤ 14 days must have a patch PR open by Day 7 or escalate to the owner. No silent slippage.

**Auto-escalation:** If no owner is assigned within 24 hours of finding creation, escalate to project lead.

---

## Concrete Walkthroughs

### Example A — Runtime CVE → BLOCK_RELEASE

**Scenario:** `pnpm audit` reports GHSA-XXXX in a runtime dependency (express middleware) used in `server/index.ts`. Severity: High. Advisory published 10 days ago.

**Triage:**
1. Surface: Runtime (express runs in production server) ✓
2. Severity: High (advisory) — no repricing needed, no friction bypass possible
3. Mitigation: None currently applied
4. Decision matrix: `runtime + high` → **BLOCK_RELEASE**
5. SLA: Advisory was 10 days ago, SLA is 14 days → 4 days remaining

**Action:** Open patch PR immediately. Do not defer.

---

### Example B — Dev-Only Dependency → Safely Deferred

**Scenario:** esbuild ≤0.24.2 vulnerability in `devDependencies`. Only exploitable if the esbuild dev server is exposed and receiving attacker-influenced input. Production uses `node dist/index.js`.

**Triage:**
1. Surface: Dev-build-isolated (esbuild never runs in production)
2. Override check: Does dev build touch production credentials? — No, build output is static files
3. Repriced surface: Dev-build-isolated (no override)
4. Severity: Moderate → Low (dev-isolated reduces blast radius)
5. Decision matrix: `dev-build-isolated + low` → **DEFER_WITH_SLA(90d)**
6. Interim: Add `pnpm.overrides → esbuild >=0.25.0` (low-effort barrier-class fix)

**Action:** Apply pnpm override now (one-line, zero risk), document in SECURITY.md, set 90-day revisit.

---

### Example C — Friction Mitigation Rejected

**Scenario:** Free-tier 1-project cap is enforced only in application code: `SELECT count → if count >= 1 throw FORBIDDEN → INSERT`. No DB constraint. PR is open.

**Triage:**
1. Surface: Runtime ✓
2. Severity: Medium (business logic bypass)
3. Mitigation check: Application-layer SELECT + count → **Friction** (two concurrent requests both read `count = 0`, both insert)
4. Mythos reprice: Parallel HTTP requests require zero skill — one script
5. Decision matrix: `runtime + medium + friction` → **BLOCK_MERGE**

**Action:** PR is blocked until a DB-level constraint is added (partial unique index, SELECT FOR UPDATE, or INSERT WHERE NOT EXISTS pattern). Documenting it in SECURITY.md does not unblock.

---

## Automation Hooks

### GitHub Labels

```
security:block-release   — applied automatically by ARIS verifier on BLOCK_RELEASE findings
security:block-merge     — applied on BLOCK_MERGE findings
security:deferred        — applied on valid defers
security:audit-gap       — applied on unread files
```

### CI Enforcement Checks

The ARIS verifier CI step fails (exit code 1) if:
- Any finding is `BLOCK_RELEASE` or `BLOCK_MERGE`
- A defer is missing any of: owner, revisit trigger, interim control
- A mitigation is marked "friction" but the finding is marked "Fixed"

### PR Required Fields

Any PR touching security-relevant files (`server/middleware/auth.ts`, `server/trpc.ts`, `server/routers/*.ts`, `server/db/schema.ts`) must include in the PR body:

```
## Security Checklist
- [ ] Ran `node agents/verifier.js` — output attached
- [ ] No new BLOCK_RELEASE findings introduced
- [ ] Any new findings have owner + revisit trigger
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-04-22 | Added confidence scoring, deterministic decision matrix, concrete examples, automation hooks, N-day SLA enforcement, policy/rationale split, 60-second combat mode, versioning |
| 1.0 | 2026-04-07 | Initial five-lesson format (red.anthropic.com) |
