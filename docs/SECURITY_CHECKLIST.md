# Mythos Security Quick Reference
**Developer checklist for code review and release decisions | 2026-06-01**

---

## Before shipping any change

### Pre-commit checklist
- [ ] No authentication checks removed or weakened (grep for `requireUser`, `ctx.user.id`)
- [ ] Every DB query filtering by userId uses `.where(eq(table.userId, ctx.user.id))`
- [ ] No new endpoints without auth guard (check: is the route in a guarded router?)
- [ ] No new user-controlled input reaches LLM prompts unescaped
- [ ] No new secrets in code (check: `git diff` for `SECRET`, `PASSWORD`, `API_KEY`)
- [ ] No new friction-only mitigations for runtime issues (use barriers)
- [ ] Security findings updated if any scope changes

### Pre-merge checklist
- [ ] Runtime Medium/High finding (not N-day)? → Fix in the same PR, don't merge until fixed
- [ ] N-day CVE found? → Escalate immediately, don't batch with silent findings

### Pre-release checklist
- [ ] All 6 audit gaps (G-01 through G-06) resolved and code reviewed
- [ ] All blocking findings either fixed or deferred with owner/trigger in SECURITY.md
- [ ] F-10 (prompt injection) resolved before wiring real API (deadline: 2026-05-15)
- [ ] No outstanding findings without an owner name (not a team, not a label)
- [ ] All N-day findings have revisit trigger with calendar date (not "post-MVP")
- [ ] SECURITY.md updated and committed

---

## Severity decision tree

Use this when grading a new finding (CVE, Dependabot alert, or audit discovery).

**Step 1: Grade independently (before reading advisory)**

| Axis | Assessment |
|------|-----------|
| **Attack Vector** | Network? Adjacent? Local? Physical? |
| **Complexity** | Low = single request; High = requires setup |
| **Privileges Required** | None? User? Admin? |
| **User Interaction** | Victim must click link? No? |
| **C/I/A Impact** | Confidentiality? Integrity? Availability? |

→ Synthesize into CVSS-style grade: **Critical / High / Medium / Low**

**Step 2: Re-price under Mythos assumptions**

Ask: *"Would this be harder if the attacker had model-assisted parallel enumeration, cheap reverse-engineering, and chaining?"*

- ✅ **Stays same or worse** → barrier-class mitigation
- ⚠️ **Gets worse** → friction degraded; need better control
- 🔴 **Much worse** → critical finding, block release

**Step 3: Compare to advisory**

- ✅ Exact match or ±1 level → proceed
- 🔴 More than ±1 apart → stop, resolve disagreement before action

**Step 4: Assign category**

| Your Grade | Is it public (CVE/GHSA)? | Action |
|-----------|------------------------|--------|
| **Critical / High** | Yes | Block release. Fix ≤30 days. |
| **Critical / High** | No | Block release. Fix now. |
| **Medium** | Yes, non-trivial fix | Defer only with barrier-class interim + date ≤90 days. |
| **Medium** | No, non-trivial fix | Defer with barrier-class interim only. |
| **Low** | Anything | Fix if easy; otherwise document. |

---

## Friction vs. Barrier cheat sheet

**BARRIERS** (holds under Mythos):
- Cryptographic verification (signatures, HMACs)
- DB-level constraints (NOT NULL, UNIQUE, FOREIGN KEY, CHECK)
- Type system enforcement (TypeScript)
- Process isolation / sandboxing
- Memory safety (no buffer overflows)
- SameSite cookies + CSRF tokens (cryptographically random, server-validated)

**FRICTION** (degrades under Mythos):
- Obscurity ("undocumented endpoint")
- Long-but-guessable tokens without rate-limit defense
- Multi-step chains where each step is individually probable
- "Attacker would need to know X" where X is discoverable by inspection
- Minification as a defense
- Short or predictable CSRF tokens

**Rule:** If the only mitigation is friction, the finding is not resolved — it's deferred with friction-only interim + explicit risk acceptance.

---

## Deferred finding template (SECURITY.md)

Every deferred finding needs three fields. Missing any → it's unmanaged, not deferred.

```markdown
### FINDING-ID | Name — description

**Status:** Deferred  
**Advisory status:** <public / under embargo / internal finding>  
**Advisory published:** <YYYY-MM-DD or N/A>  
**Surface:** <runtime | dev-build-isolated | dev-build-credential-pivot | ...>  
**Severity (ours):** <Critical/High/Medium/Low> — one-line reasoning  

**Why deferred:** Concrete reason (not "time", not "post-MVP")  
**Interim control:** Barrier-class named OR friction-only with explicit risk acceptance  
**Revisit trigger:** ISO date required for N-day (not an event like "when vite 6 ships")  
**Owner:** @handle  

**Fix path:** Code snippet or step-by-step guide
```

---

## N-day finding rules

When a CVE/GHSA is public and a patch exists, treat as N-day. Tighter SLAs apply.

| Finding Severity | Is there a barrier-class interim? | Trigger deadline |
|-----------------|----------------------------------|-----------------|
| **Critical / High** | Yes | ≤30 days from advisory publish |
| **Critical / High** | No | Block release; can't defer |
| **Medium** | Yes (barrier-class) | ≤90 days from advisory publish |
| **Medium** | No (friction-only) | Can't defer; block or fix |
| **Low** | Anything | No strict deadline |

**Do not:** Batch N-day findings with silent-but-known ones. SLAs differ.

---

## Auth checklist for code review

Every protected route must pass these:

- [ ] Mutation imports `requireUser` from base-procedures
- [ ] Mutation uses `.input()` + Zod schema (not raw request body)
- [ ] Every query includes `.where(eq(table.userId, ctx.user.id))`
- [ ] No query returns results from other users (test with different auth tokens)
- [ ] Admin mutations also check `ctx.user.isAdmin` (not just userId)
- [ ] Role field is database-derived, not from JWT claims
- [ ] No public error messages that distinguish "not found" from "forbidden" (leak ownership)
- [ ] Rate limits, if any, key on userId not sessionId alone

---

## Database defense-in-depth checklist

| Layer | Example | Status |
|-------|---------|--------|
| **Schema** | `userId` field is NOT NULL + FOREIGN KEY? | ✅ / ⚠️ / ❌ |
| **Query** | Every SELECT/UPDATE/DELETE includes userId filter? | ✅ / ⚠️ / ❌ |
| **Index** | Composite index on `(userId, id)` for fast filtering? | ✅ / ⚠️ / ❌ |
| **Constraint** | UNIQUE constraint scoped per-user if needed? | ✅ / ⚠️ / ❌ |
| **Audit log** | Changes to sensitive tables logged with userId? | ✅ / ⚠️ / ❌ |

---

## LLM input checklist (before wiring any API call)

- [ ] No user-supplied strings interpolated into system prompts (use structured data)
- [ ] Long inputs capped at reasonable length (Zod `.max()`)
- [ ] Special characters escaped or stripped (no `IGNORE ABOVE` injections)
- [ ] Prompt injection tested: can user make model leak system instructions?
- [ ] No sensitive data in system prompts (use separate context layer if needed)
- [ ] Token limits enforced (model can't be DoSed by huge input)

---

## Release blockers (non-negotiable)

Do not ship if ANY of these are true:

1. **Runtime Critical/High with no barrier-class interim** → escalate to architect
2. **Audit gaps unresolved** (files in G-01–G-06 not read and verified)
3. **N-day finding past deadline** (e.g., GHSA published 2026-04-10, trigger was 2026-05-10, today is 2026-05-15)
4. **Friction-only interim for runtime Medium+ N-day** → upgrade interim or block
5. **Deferred finding missing owner name** (not "the team", not "TBD")
6. **Deferred finding trigger is an event, not a date** (for N-day findings)
7. **F-10 prompt injection not resolved before wiring real API** (deadline 2026-05-15)

---

## Audit gap resolution checklist

Must close before release. For each file in G-01–G-06:

- [ ] File pasted into audit (read full source)
- [ ] Auth guards verified (every endpoint has explicit check)
- [ ] userId filters confirmed (no queries returning cross-user data)
- [ ] Error handling reviewed (no information leaks)
- [ ] SECURITY.md findings updated if new gaps found

---

## Deferred findings currently live

Review these weekly:

| ID | Name | Owner | Trigger | Days until revisit |
|---|------|-------|---------|------------------|
| C-03 | AI transition limit via header | @3R | 2026-05-22 | 21 |
| C-01 | esbuild N-day override | @3R | 2026-05-15 | 14 ← *approaching* |
| C-02 | Vite 6 migration | @3R | 2026-06-15 | 44 |
| F-09 | aiDecisionLog no userId | @3R | 2026-06-22 | 51 |
| F-10 | prompt injection latent | @3R | 2026-05-15 | 14 ← *approaching* |
| C-05 | timing-safe comparison | @3R | 2026-07-22 | 81 |

**Action:** If trigger date is within 7 days, move to active work queue.

---

## Questions to ask in PR review

1. **Auth:** Does this code check `ctx.user.id` or `ctx.user.isAdmin`? If not, why not?
2. **Data isolation:** Could a user see another user's data? (Test with different JWT token.)
3. **Invariants:** Does this break any DB constraint or type invariant?
4. **Secrets:** Any hardcoded tokens, keys, or credentials? (Grep for `SECRET`, `PASSWORD`, `PRIVATE`.)
5. **Friction vs. barrier:** If this is a mitigation, would it hold under parallel model-assisted attack?
6. **Escape hatch:** Is there a way to bypass this check via race condition, parameter injection, or type confusion?

---

**Last updated:** 2026-06-01  
**Maintainer:** @3R  
**See also:** MYTHOS_DEFENSE_2026-06-01.md (full reference)
