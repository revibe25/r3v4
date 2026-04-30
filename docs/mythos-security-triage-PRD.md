# Mythos Security Triage — Skill PRD

**Document type:** Skill specification / Product Requirements Document
**Version:** 1.0.0
**Status:** Draft for adoption
**Audience:** Engineering owners, security reviewers, release managers, on-call rotation
**Supersedes:** `mythos-security-triage` SKILL.md (v0)
**Source of record:** *Assessing Claude Mythos Preview's cybersecurity capabilities*, red.anthropic.com, April 7, 2026 (edited April 9, 2026). When this PRD and the source disagree on factual claims about Mythos capability, the source wins. All enhancements in this PRD are process formalizations of the source's published guidance, not new capability claims.

---

## 0. Document Metadata

| Field | Value |
|---|---|
| Skill ID | `mythos-security-triage` |
| Skill version | 1.0.0 |
| Threat-model basis | Mythos-class AI-assisted adversary |
| Triage SLA basis | N-day countdown begins at advisory publication |
| Required upstream artifacts | `SECURITY.md`, `package.json` / lockfile, advisory feed (Dependabot, GHSA, OSV) |
| Required downstream protocol | WIRE-style read-before-write engineering protocol (or equivalent) for code changes |
| Hand-off boundary | This skill produces **two artifacts only**: a per-finding note and a `SECURITY.md` diff. It does not apply code changes. |
| Owner | Repository security owner (named, not a team) |
| Review cadence | Quarterly; immediately after any post-incident retrospective |

---

## 1. Executive Summary

### 1.1 Problem

Conventional vulnerability triage was calibrated against an attacker model in which (a) chained-but-individually-improbable exploit paths were costly, (b) obscurity offered meaningful slowdown, (c) N-day exploit weaponization took weeks, and (d) the `pnpm audit` queue was a reasonable approximation of real risk. The Mythos writeup invalidates all four assumptions for any adversary who can drive a Mythos-class model:

- Chained probable steps grind through in parallel.
- Obscurity-class mitigations degrade sharply.
- N-day exploitation moves from weeks to overnight; cost figures of roughly $1,000, $2,000, and under $20,000 are documented in the writeup.
- Anthropic engineers with no formal security training have produced working exploits overnight; the published findings are explicitly framed as "a lower bound."

A triage process tuned to the old assumptions ships findings that should block, defers findings that should be fixed, and silently closes alerts that should be escalated.

### 1.2 Solution

A five-lesson triage discipline, applied per finding, with:

1. A formal lifecycle (state machine) every finding traverses.
2. Quantitative SLAs distinguishing N-day from non-public findings.
3. A Mythos-class **re-price** step that re-evaluates every "an attacker would need to..." claim.
4. Strict discipline around what counts as deferral (owner + trigger + interim control, all three) versus unmanaged risk.
5. A batch protocol that scales triage without collapsing calibration.

### 1.3 Success criteria (measurable)

The skill is functioning correctly when **all** of the following hold over a rolling 90-day window:

| Metric | Target | Source of truth |
|---|---|---|
| Severity-grading agreement with expert re-review, exact match | ≥ 89% | Periodic third-party or peer audit, sample n ≥ 30 |
| Severity-grading agreement, within one level | ≥ 98% | Same |
| ≥ 2-level disagreement rate | ≤ 2% | Same |
| N-day High/Critical findings remediated within 30 days of advisory | ≥ 95% | CI / SECURITY.md diff history |
| N-day Medium findings remediated or properly deferred within 90 days | ≥ 95% | Same |
| Deferred findings with all three required fields (owner, trigger date, barrier-class interim) | 100% | `SECURITY.md` lint |
| Findings closed without a Pass-1/Pass-2 reasoning comment | 0 | Repo audit |
| Runtime findings deferred with friction-only interim, Medium or above | 0 | `SECURITY.md` lint |

The 89% / 98% / 2% targets are taken directly from the calibration bar set by Mythos's own performance against expert re-reviewers in the source writeup. They are the bar to **emulate**, not to exceed at the cost of slowness — calibration above 98% within-one-level over a small sample is more likely overfitting than skill.

### 1.4 Out of scope (also see §14)

- Writing exploits or PoCs.
- Incident response (post-compromise).
- Cryptographic primitive selection.
- Secret rotation mechanics.
- Performing novel-vulnerability discovery (in scope only to *flag the audit gap*).

---

## 2. Background and Threat Model

### 2.1 Two reframes that precede every triage decision

**Reframe 1: Assume the adversary has a Mythos-class model.**
Per the source: the model identifies and exploits zero-day vulnerabilities in every major operating system and every major web browser when directed to; non-experts can drive it; published cost figures for Mythos-produced exploits include roughly $1,000, $2,000, and under $20,000 for the OpenBSD-scale finding run. Operationally, this means **re-pricing every "an attacker would need to..." claim** in an advisory, in a code review, or in your own intuition.

The re-price targets, in order of typical degradation:
- **Steps individually probable but chained.** Re-price as cheap.
- **Unguessable-by-humans endpoint names, opaque parameter formats, undocumented APIs.** Re-price as cheap.
- **Long tokens with weak rate limits.** Re-price as cheap if the rate limiter does not impose a hard barrier (e.g., per-account lockout with monitored anomaly).
- **Reverse-engineering minified bundles, fuzzing undocumented APIs, correlating two leaked facts into a third.** Re-price as cheap.
- **Hardware-enforced, cryptographically-bound, capability-gated controls.** Re-price as approximately unchanged.

**Reframe 2: A published CVE is a countdown, not a queue item.**
The source establishes that a large fraction of real-world harm comes from N-days — disclosed-and-patched vulnerabilities that remain exploitable on un-patched systems because the patch itself is a roadmap to the bug. Mythos produced working N-day exploits fully autonomously starting from a CVE identifier and a git commit hash. This propagates through Lessons 1, 4, and 5 below as: tighter SLAs, no friction-only deferral for runtime N-day Medium-or-above, and trigger dates rather than trigger events.

### 2.2 Mythos-class re-price: structured form

For each "attacker would need X" claim in an advisory, in your own analysis, or in a defender's argument, score X across the following axes:

| Axis | Cheap (degraded by Mythos) | Expensive (preserved) |
|---|---|---|
| Information-gathering | Reading minified JS, fuzzing, scraping, correlating public sources | Compromising a hardware token, social-engineering a specific privileged human |
| Combinatorial search | Trying many input combinations, exploring URL-space, brute-forcing within a bounded structure | Brute-forcing a 256-bit cryptographic key |
| Code understanding | Reading any open-source dependency, understanding an obfuscated bundle | (None — code understanding is cheap.) |
| Side-channel exploitation | Reading timing differences from logs, inferring internal state from response shapes | Physical access required for exploitation |
| Multi-step orchestration | Chaining 4–10 independently-probable steps | Chaining steps where one requires a non-public secret |

If every X in a defender's argument lands in the **Cheap** column, the argument has been re-priced to zero. The mitigation is friction (Lesson 3), not a barrier.

### 2.3 What the source covers that older threat models often missed

Mythos demonstrated competence at finding bugs across:

- Memory-safety bugs.
- Logic bugs and authentication bypasses (including complete-bypass paths allowing unauthenticated users to grant themselves administrator privileges).
- Cryptographic weaknesses.
- Web-application logic flaws.

Triage that limits its imagination to "memory-safety in C/C++ deps" is outdated by the published findings. Lesson 2 operationalizes this.

---

## 3. Goals, Non-Goals, and Success Metrics

### 3.1 Goals

- **G1.** Every finding receives a calibrated severity grade *before* the advisory's grade is read (anti-anchoring).
- **G2.** Every finding receives a Mythos-class re-price step before any decision.
- **G3.** Every "deferred" finding satisfies the owner / trigger / interim-control requirements; otherwise it is "unmanaged" and surfaced as a triage failure.
- **G4.** N-day findings follow tighter SLAs than internally-discovered findings.
- **G5.** Runtime-surface findings are never batched away with dev-build findings.
- **G6.** Friction-class mitigations never satisfy the deferral requirement for runtime Medium-or-above findings.
- **G7.** Every triage decision leaves a reasoning comment, even if the conclusion is "not applicable."

### 3.2 Non-goals

- **NG1.** This skill does not produce exploits, PoCs, or attack instrumentation.
- **NG2.** This skill does not perform novel-vulnerability discovery; it flags the audit-surface gap and stops.
- **NG3.** This skill does not specify cryptographic primitives.
- **NG4.** This skill does not replace incident response.
- **NG5.** This skill does not optimize for Dependabot-queue zero. It optimizes for correctly-classified queue.

### 3.3 Anti-goals (failure modes the design explicitly resists)

- **AG1.** Severity-grading drift toward advisory severities (anchoring).
- **AG2.** "Mitigated by obscurity" treated as resolved.
- **AG3.** Dev-only findings dismissed without checking the four blast-radius questions.
- **AG4.** Deferred findings without revisit triggers, accumulating into an unmanaged backlog.
- **AG5.** N-day urgency normalized down to internal-finding cadence.
- **AG6.** Quiet Dependabot week interpreted as low risk (Lesson 2).

### 3.4 Success metrics — full table

| ID | Metric | Target | Window | Source |
|---|---|---|---|---|
| M1 | Severity exact-match with expert review | ≥ 89% | Quarterly audit, n ≥ 30 | External review |
| M2 | Severity within-one-level | ≥ 98% | Same | Same |
| M3 | Severity ≥2-level disagreement | ≤ 2% | Same | Same |
| M4 | N-day H/C remediated ≤ 30 days | ≥ 95% | Rolling 90 day | Repo + advisory dates |
| M5 | N-day Medium remediated or properly deferred ≤ 90 days | ≥ 95% | Same | Same |
| M6 | Deferred findings with full required fields | 100% | Continuous | `SECURITY.md` lint |
| M7 | Findings closed without reasoning comment | 0 | Continuous | Repo audit |
| M8 | Runtime findings deferred friction-only ≥ Medium | 0 | Continuous | `SECURITY.md` lint |
| M9 | Mean triage latency (advisory → first decision) | ≤ 24 h, business days | Rolling 30 day | Tooling |
| M10 | Calibration drill completion | 1 per quarter per active triage owner | Quarterly | Drill log |

---

## 4. Glossary

- **Advisory**: A public security advisory document (CVE, GHSA, OSV ID) with severity rating, affected versions, and (typically) a fixed-version reference.
- **Anchoring**: The cognitive failure of grading severity *after* reading the advisory's grade and unconsciously matching it.
- **Barrier**: A mitigation whose security value comes from a hard property (cryptographic, hardware-enforced, capability-bound, or sandbox-isolated) that does not degrade under massive parallel attempts.
- **Blast radius**: The set of systems, users, or credentials that a successful exploit of a given finding can reach.
- **Calibration**: Agreement between this triage process and an external expert re-review, measured as exact-match rate and within-one-level rate over a sample of findings.
- **Defer**: To delay remediation past the next merge with an explicit owner, trigger, and interim control. Anything else is **unmanaged**, not deferred.
- **Friction**: A mitigation whose security value comes primarily from the cost of repeated attempts. Degrades sharply under model-assisted adversaries.
- **N-day**: A vulnerability that has been publicly disclosed and patched. The N-day clock starts at advisory publication; the patch itself is the attacker's roadmap.
- **Mythos-class re-price**: The structured re-evaluation of "attacker would need X" claims under the assumption that the attacker has a Mythos-class model.
- **Re-price** (verb): To re-evaluate the cost of an attacker action under the Mythos-class assumption. See §2.2.
- **Surface**: The execution context where the vulnerable code runs. One of: `runtime`, `dev-build-supply-chain`, `dev-build-credential-pivot`, `dev-build-attacker-input`, `dev-build-isolated`.
- **Trigger**: The concrete date or event that revives a deferred finding for re-decision. For N-day findings, must be a date (§6.5).
- **Unmanaged**: A finding without a written owner, trigger, and interim control. Looks like "deferred" in conversation but fails the deferral discipline; surfaces as a triage failure.

---

## 5. Triage Lifecycle (State Machine)

Every finding passes through these states. Skipping a state is a process violation.

```
                  ┌──────────────────┐
                  │   1. INTAKE      │  Finding observed (Dependabot,
                  │                  │  CVE, audit, bug bounty, etc.)
                  └────────┬─────────┘
                           │  Dedup + classify (Lesson 2 trigger,
                           │  surface assigned)
                           ▼
                  ┌──────────────────┐
                  │ 2. PRE-GRADE     │  Grade severity yourself,
                  │                  │  blind to advisory grade.
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ 3. RE-PRICE      │  Apply Mythos-class re-price
                  │                  │  (§2.2). Reclassify any
                  │                  │  friction-class mitigations.
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ 4. COMPARE       │  Compare to advisory grade.
                  │                  │  Exact / ±1 / >1 logic per L1.
                  └────────┬─────────┘
                           │
              >1 delta?────┴────exact or ±1
                  │                 │
                  ▼                 │
       ┌──────────────────┐         │
       │ 4a. STOP-REVIEW  │         │
       │ Resolve before   │         │
       │ proceeding.      │         │
       └────────┬─────────┘         │
                │                   │
                └─────────┬─────────┘
                          ▼
                 ┌──────────────────┐
                 │ 5. DECIDE        │  Block merge / block release /
                 │                  │  fix now / defer.
                 │                  │  Use decision table (§7).
                 └────────┬─────────┘
                          │
                          ▼
            ┌─────────────┴─────────────┐
       Fix now / block             Defer
            │                           │
            ▼                           ▼
   ┌─────────────────┐         ┌─────────────────┐
   │ 6a. HAND OFF    │         │ 6b. RECORD      │
   │ to WIRE / eng   │         │ SECURITY.md     │
   │ protocol.       │         │ entry with full │
   │                 │         │ required fields.│
   └────────┬────────┘         └────────┬────────┘
            │                           │
            ▼                           ▼
   ┌─────────────────┐         ┌─────────────────┐
   │ 7a. VERIFY      │         │ 7b. SCHEDULE    │
   │ fix lands and   │         │ trigger date    │
   │ regression test │         │ in calendar /   │
   │ added.          │         │ on-call rota.   │
   └────────┬────────┘         └────────┬────────┘
            │                           │
            ▼                           ▼
       ┌─────────────────────────────────────┐
       │           8. CLOSE                  │
       │ Reasoning comment recorded on the   │
       │ originating alert/PR/ticket — even  │
       │ if conclusion is "not applicable."  │
       └─────────────────────────────────────┘
```

**State invariants:**
- No state may be skipped.
- INTAKE → PRE-GRADE never reads the advisory grade. Anchoring is a process violation.
- DECIDE may not record "defer" without all three deferral fields (§6.5).
- CLOSE without a reasoning comment is a process violation regardless of conclusion.

---

## 6. The Five Lessons — Specifications

The five lessons are the core of the skill. Every finding passes through all five before any code changes are applied.

### 6.1 Lesson 1 — Calibrated severity grading

**Source claim being operationalized:** Expert contractors re-reviewed 198 manually-sampled vulnerability reports and agreed with Mythos's severity assessment exactly in 89% of cases, and within one level in 98%. The ≥2-level disagreement rate was therefore ~2%. This is the calibration bar to emulate.

#### 6.1.1 Workflow per finding

1. **Pre-grade blind.** Before opening the advisory, grade the finding yourself across the standard CVSS-style axes:
   - Attack Vector (Network / Adjacent / Local / Physical)
   - Attack Complexity (Low / High) — *re-evaluated under §2.2 re-price*
   - Privileges Required (None / Low / High)
   - User Interaction (None / Required)
   - Scope (Unchanged / Changed)
   - Confidentiality / Integrity / Availability impact (None / Low / High)
2. **Compute pre-grade severity** (Critical / High / Medium / Low / None).
3. **Open the advisory and compare.**
   - **Exact match** → proceed to Lesson 2.
   - **Within one level** (e.g., your High vs advisory Critical) → proceed; record the delta and one-line reason.
   - **More than one level apart** → **STOP.** Either your threat model is wrong or the advisory is generic and your context changes it. Resolve the disagreement explicitly before acting. This is the ~2% of cases that warrant deeper review.
4. **Uncertainty rule:** when genuinely between two levels, **round up.** This aligns with Mythos's own conservative disclosure process.
5. **Anti-anchor rule:** never round *toward* the advisory. The advisory does not know your codebase.

#### 6.1.2 Required output

Two fields, both mandatory:

```
Severity (ours):     <Critical / High / Medium / Low / None>
                     <one-line reasoning, including any Mythos-class
                      re-price that changed the grade vs. naive>
Severity (advisory): <level>  Delta: <same | +1 noted | -1 noted | >1 STOP>
```

#### 6.1.3 Edge cases

- **Advisory unrated or "Unknown."** Pre-grade as if it were unrated; no comparison step. Note this; treat per your pre-grade.
- **Advisory grades "None" / "Informational."** Still pre-grade. The Mythos re-price may move the bar.
- **Advisory grade based on a different deployment shape.** Document the shape difference; your grade authoritative.
- **Multiple advisories for the same underlying issue with conflicting grades.** Use the highest of the pre-grade and the highest advisory grade.

#### 6.1.4 Calibration maintenance

A triage owner's calibration is checked by sampling (§10):

- **Per quarter:** sample at least 30 closed findings; have an independent reviewer re-grade blind.
- **Drift indicators:** exact-match rate falling below 85%, or within-one-level falling below 95%, triggers a calibration drill (§10).

### 6.2 Lesson 2 — Your Dependabot queue is a floor, not a ceiling

**Source claim:** the writeup explicitly frames its published findings as "a lower bound on the vulnerabilities and exploits that will be identified over the next few months." The audit surface is broad: memory safety, logic bugs, auth bypasses, cryptographic weaknesses, web-application logic flaws, including complete authentication bypasses.

#### 6.2.1 Workflow per finding

For each component implicated in a finding, ask:

1. **What class of bug is typical for this component?** (See §6.2.2 catalog.)
2. **Have we ever audited that surface ourselves?**
3. **If "no": add a `SECURITY.md` follow-up item naming the audit gap.** Do not treat audit-gap discovery as exploit-discovery; this skill explicitly does not produce exploits.

#### 6.2.2 Audit-surface catalog (apply per component)

This catalog is the question set. It is not exhaustive — it is the minimum set Mythos has demonstrated competence at.

| Class | Component types | Symptoms / shapes |
|---|---|---|
| Memory safety | Native deps, WASM-integrated code, image/audio/video parsers | Buffer overruns, UAF, integer overflow, OOB read/write |
| Path traversal | Static file servers, archive extractors, upload handlers, template loaders | `..` sequences, absolute paths in user-controlled fields, symlink following |
| Prototype pollution | Option-merging, deep-merge utilities, JSON schema mergers | `__proto__`, `constructor`, `prototype` keys in user input |
| Untrusted deserialization | YAML loaders, pickle equivalents, custom binary protocols | `!!python/object`, JSON revivers, BSON oid coercion, msgpack ext types |
| Auth — complete bypass | Login flows, session creation, "remember me" tokens | Missing checks on privileged routes, role-elevation in profile-update endpoints |
| Auth — 2FA bypass | Recovery flows, backup codes, "trust this device" | Recovery flow that doesn't enforce 2FA, oracle in the OTP submission |
| Auth — session binding | Session cookies, JWT consumption | Algorithm-confusion (`alg: none`, RS→HS swap), kid path traversal, missing audience check |
| Password reset oracles | Reset-token issuance, reset-token consumption | Timing differences for valid/invalid usernames, token leakage in HTTP referrer |
| OAuth / OIDC | Authorization endpoints, redirect URI validation | Open redirect, missing PKCE, state/nonce collisions, IDP-initiated SSO without binding |
| SQL injection | Raw SQL templates, ORM escape hatches, dynamic ORDER BY | String concatenation; `.raw()`, `.unsafe()`, `sql.identifier()` misuse |
| Row-level authorization | List endpoints, search endpoints, GraphQL resolvers | Query returns rows the user shouldn't see; missing tenant filter |
| Crypto — nonce reuse | AES-GCM, ChaCha20-Poly1305 | Hardcoded nonces, predictable counters, reuse across re-deploys |
| Crypto — RNG | Token generators, password generators, session ID generators | `Math.random()`, time-seeded RNGs, low-entropy device sources |
| Crypto — cert validation | TLS clients, custom signature verification | `rejectUnauthorized: false`, missing hostname check, manual trust store |
| Crypto — padding oracles | CBC mode, PKCS#7 / PKCS#1v1.5 | Distinguishable error responses on invalid padding |
| ReDoS | Any user-supplied or user-influencing regex | Catastrophic backtracking patterns |
| SSRF | URL-fetching from user input, webhook handlers, image proxies | Missing scheme allowlist, missing IP allowlist, DNS rebinding |
| Open redirect | Login-return URLs, OAuth callback, "next" parameters | Substring checks, scheme-relative URLs, embedded credentials |
| HTTP request smuggling | Reverse proxy + backend servers with mismatched parsers | Conflicting `Content-Length` / `Transfer-Encoding` |
| CSRF | State-changing endpoints | Missing or short tokens, GET-based mutation, predictable tokens |
| CORS misconfig | API endpoints with `Access-Control-Allow-*` headers | Reflected origin + credentials, null origin |
| CRLF injection | Logs, response headers, redirect headers | Unescaped `\r\n` in user input reaching headers |
| TOCTOU | File operations, permission checks | Re-checking permission, racing fs operations |

#### 6.2.3 Required output

If any component touches a class your team has never audited, append the following to `SECURITY.md`:

```markdown
### Audit-surface gap: <component>@<version>
- **Class(es):** <named classes from §6.2.2 catalog>
- **Discovery context:** <CVE that surfaced this component for review>
- **Last audited:** never | <YYYY-MM-DD>
- **Owner:** <@handle>
- **Plan:** <"Schedule audit by <date>" | "Replace with <alternative>" | "Accept and monitor advisory feed">
```

This is the *naming* of the gap, not the *closing* of it. Naming is non-optional. Closing is out of scope for this skill.

### 6.3 Lesson 3 — Friction is not security; barriers are

**Source claim, verbatim:** mitigations whose security value comes primarily from friction rather than hard barriers may become considerably weaker against model-assisted adversaries, because models grind through tedious steps quickly. Techniques that impose hard barriers (like KASLR or W^X) remain an important hardening technique.

#### 6.3.1 The per-mitigation test

For every mitigation cited in defense of a finding, ask: **if the attacker runs this attempt a million times in parallel with model assistance, does the mitigation still hold?**

If yes → barrier. If no → friction. Friction is not "weaker security"; it is, for the purposes of deferral discipline, **not security against this threat model.**

#### 6.3.2 Classification table (extended from source)

| Mitigation | Class | Conditions |
|---|---|---|
| Cryptographic verification of inputs (HMAC, signed JWT verified server-side) | Barrier | Key not in attacker's possession; algorithm not confusable |
| Capability / permission model | Barrier | Capability tokens unforgeable; revocation works |
| Typed schema validation at trust boundary | Barrier | Schema rejects, does not coerce; error responses don't leak |
| Process isolation / sandboxing | Barrier | Sandbox policy enforced by kernel/hardware, not by the application |
| W^X / memory-safety guarantees | Barrier | Enforced by hardware or compiler, not by convention |
| Signed artifacts | Barrier | Signature verified at every load; key rotation works |
| KASLR-class randomization | Barrier | Hardware-enforced; entropy ≥ practical |
| SameSite cookies | Barrier | Browser-enforced; correct mode (`Lax` / `Strict`) for the use case |
| HMAC-bound requests | Barrier | Per-session key; replay window short |
| CSRF tokens — cryptographically random, per-session, server-validated | Barrier | All three properties present |
| Rate limiting with per-account lockout + monitoring | Mixed (barrier-leaning) | Lockout actually triggered; monitoring actually reviewed |
| Rate limiting per IP | Friction | Trivially bypassed via residential proxies |
| WAF rules matching attack signatures | Friction | Bypassable by polymorphic input |
| Obscurity ("undocumented endpoint") | Friction | Discoverable by inspection |
| Long-but-guessable tokens without defense-in-depth | Friction | Online guessing space large but not infinite; lacks rate-limit barrier |
| Multi-step chain where each step individually probable | Friction | Steps parallelize |
| "Attacker would need to know X" where X is discoverable | Friction | Re-priced cheap |
| Minification as defense | Friction | Decompilation / source-map recovery cheap |
| Hand-rolled encoding instead of canonical escaping | Friction | Edge cases discoverable; non-canonical implies bypass |
| Short or predictable CSRF tokens | Friction | Brute-forceable |
| Client-side input validation | Friction (alone) | Bypassable by direct API call |
| Email confirmation as "second factor" | Friction | Email not a real second factor |
| Captcha as security boundary | Friction | Solver economics shifted by model assistance |
| "Defense in depth" without naming each layer | Unverifiable | Each layer must be classified independently |

#### 6.3.3 Decision implication

If the only mitigation present is friction, the finding is **not resolved** even if someone has written "mitigated" next to it. It is at best **deferred with friction as an interim control** — and friction-only deferral for a runtime finding **requires explicit written risk acceptance** (§6.5.4). Friction-only interim is **never acceptable** for runtime N-day findings rated Medium or above.

### 6.4 Lesson 4 — Surface matters; dev-only ≠ safe, but blast radius differs

**Source illustration:** a CVE in `esbuild` reachable only through `drizzle-kit`, never in the shipped bundle, is real risk — but the attacker target is the CI environment or developer machines, not internet users. The blast radius differs from a runtime finding.

#### 6.4.1 The four blast-radius questions, in order

For every dev/build-only finding, answer these in sequence. Stop at the first "yes."

1. **Does the dev-only tool ever process attacker-influenced input?**
   Examples: markdown from a PR comment, a dependency's `README` rendered during install, a JSON schema pulled from a public registry, a webhook payload during CI, a `.proto` file fetched from an untrusted source.
   **If yes → treat closer to runtime.** Use the runtime decision rows in §7.

2. **Is there a supply-chain path from the dev-only component into shipped artifacts?**
   Examples: a build plugin that modifies output, a `postinstall` script that runs in your install context, a code-generation step whose output ships, a bundler transform.
   **If yes → treat as runtime.** Compromise of the build compromises the product.

3. **Does the dev-only tool have access to credentials that overlap with production?**
   Examples: dev DB credentials that work against staging *or* prod, API keys with prod scope present in `.env.development`, CI secrets used for both build and deploy, a developer machine with cached production CLI credentials.
   **If yes → treat as runtime.** Compromise of the dev tool gives a credential pivot into prod.

4. **Otherwise:** document, pin the version, plan the upgrade. Do not silently dismiss.

#### 6.4.2 Surface classification — the five canonical labels

| Surface label | Definition | Triage row to use |
|---|---|---|
| `runtime` | Code path reachable in production | §7 runtime rows |
| `dev-build-supply-chain` | Dev/build-only, but answers "yes" to Q2 | §7 runtime rows |
| `dev-build-credential-pivot` | Dev/build-only, but answers "yes" to Q3 | §7 runtime rows |
| `dev-build-attacker-input` | Dev/build-only, but answers "yes" to Q1 | "Fix or pin + interim + SECURITY.md entry" |
| `dev-build-isolated` | Dev/build-only, all four questions answered "no" | "Document + pin + quarterly review" |

Any finding labeled `dev-build-isolated` requires a one-line justification of *why* each of the four questions was "no." A label without this justification is a process violation.

#### 6.4.3 The `test-only` label

Findings reachable only in test code (test fixtures, mocked dependencies, dev servers) are treated as `dev-build-isolated` if and only if the test infrastructure does not have credential overlap with production. Otherwise they escalate.

### 6.5 Lesson 5 — Defer is valid, but N-day rewrites the terms

**Source claim:** every deferred finding needs three fields — owner, trigger, interim control — or it is not deferred, it is unmanaged. For published CVEs (N-days), the terms tighten because the patch is the attacker's roadmap.

#### 6.5.1 Required fields for any deferred finding

1. **Owner** — a named person, not a team, not a label, not a Slack channel.
2. **Revisit trigger** — a date or a concrete event:
   - "before first external beta user" — *concrete event, valid*
   - "before opening registration to the public" — *concrete event, valid*
   - "when vite 6 stable ships" — *concrete event, valid*
   - "post-MVP" — *insufficient; rejected*
   - "next sprint" — *insufficient; rejected unless the sprint has a hard end date*
   - "soon" — *rejected*
   - "Q3" — *insufficient; specify the date*
3. **Interim control** — one of:
   - A **barrier-class** mitigation, named (§6.3.2).
   - **Friction-only**, with explicit written acceptance of risk and the reasoning. Not acceptable for runtime N-day Medium-or-above (§6.5.3).
   - **None**, with explicit written acceptance and reasoning. Same restriction.

#### 6.5.2 Trigger validation — a concrete test

A trigger passes validation if and only if a third party, reading only the trigger field, can answer the question "is the trigger condition met right now?" with `yes`, `no`, or `query the calendar`. If the answer requires opinion, judgment, or context the third party does not have, the trigger fails.

| Candidate trigger | Validation result |
|---|---|
| `2026-06-30` | Pass — "query the calendar" |
| `When the migration to vite 6 lands on main` | Pass — verifiable from git log |
| `When the Acme Corp pilot starts` | Pass — verifiable from contract |
| `Post-MVP` | Fail — MVP is not a defined term in this repo |
| `When we have time` | Fail — opinion |
| `Before our first external beta user` | Pass *only if* "external beta user" is unambiguously defined; otherwise fail |
| `When the upstream patch is more mature` | Fail — opinion |

#### 6.5.3 Additional N-day requirements

For any finding where the advisory is public and includes a patched-version reference:

- **Trigger must be a date**, not an event. Events without calendar dates fail — the exploit-development clock does not wait for your MVP.
- **Trigger date ≤ 30 days from advisory publication** for High/Critical, **≤ 90 days** for Medium, absent a documented exception.
- **Friction-only interim is not acceptable** for runtime N-day findings rated Medium or above. Either a barrier-class interim exists, or the finding is not deferred — it is **blocking**.

These map directly to the source's defender recommendations: treat CVE-fix dependency bumps as urgent rather than routine; enable auto-update where practical; tighten the patching enforcement window.

#### 6.5.4 Risk-acceptance form (required when interim is friction-only or none)

A finding may be deferred with friction-only or no interim only with a written acceptance:

```markdown
### Risk acceptance — <CVE / GHSA>
- **Accepted by:** <named person, signing authority documented>
- **Date:** <YYYY-MM-DD>
- **Reasoning:** <why this risk is accepted; reference business or technical constraint>
- **Mythos-class re-price applied:** <yes — and this re-price still permits acceptance because…>
- **Compensating monitoring:** <named alert, dashboard, or audit>
- **Re-evaluation:** <date — required, not optional>
```

A finding with friction-only interim and no risk-acceptance form is **unmanaged**, not deferred. This is a process violation that surfaces at the next `SECURITY.md` lint.

#### 6.5.5 Owner accountability

- An owner must be reachable on the trigger date. If the owner has left the organization or rotated off, the finding's status reverts to **PRE-GRADE** (state 2 in §5) and a new owner is assigned. This is not optional; ownerless findings are unmanaged.
- An owner who misses three triggers in a rolling 12-month window triggers a calibration drill (§10).

---

## 7. Decision Tables and SLA Matrix

### 7.1 Primary decision table (extended from source)

| Surface | Severity (ours) | Status | Action | SLA |
|---|---|---|---|---|
| Runtime | Critical / High | N-day (public CVE) | **Block release. Fix now.** | ≤ 30 days from advisory; documented exception process required for any extension |
| Runtime | Critical / High | Not public | **Block release. Fix now.** | Best-effort; ≤ 14 days target |
| Runtime | Critical / High | Any, only friction-class fix exists | **Block release. Do not ship.** Escalate to architect. | Immediate; do not defer |
| Runtime | Medium | PR still open | **Block merge.** Fix in same change. | Same merge |
| Runtime | Medium | Already merged to main | **Fix now** as a dedicated change. | ≤ 14 days |
| Runtime | Medium | N-day, non-trivial fix | **Defer only with barrier-class interim** and a date ≤ 90 days from advisory. | ≤ 90 days |
| Runtime | Medium | Not public, non-trivial fix | **Defer with barrier-class interim only.** | Per §6.5; recommended ≤ 90 days |
| Runtime | Low | Clean fix | **Fix now.** (Cheap.) | Next merge |
| Runtime | Low | Non-trivial fix | **Defer**, owner + trigger + interim required (§6.5). | Per trigger |
| `dev-build-supply-chain` | Any | Any | **Treat as runtime.** Use runtime rows. | Per runtime |
| `dev-build-credential-pivot` | Any | Any | **Treat as runtime.** Use runtime rows. | Per runtime |
| `dev-build-attacker-input` | Any | Any | **Fix or pin** + interim control + `SECURITY.md` entry. | Critical/High ≤ 30 days; Medium ≤ 90 days |
| `dev-build-isolated` | Any | Any | **Document** in `SECURITY.md`, pin version, review quarterly. | Quarterly review |
| `test-only` (no prod overlap) | Any | Any | Treat as `dev-build-isolated`. | Quarterly review |
| Any | Any | Deferred | Owner + trigger + interim control in `SECURITY.md`, **or it's unmanaged.** | Per trigger; lint daily |

### 7.2 SLA exception process

An SLA extension is permissible if and only if:

1. **Documented in writing**, in the per-finding note and in `SECURITY.md`.
2. **Signed by an authorized approver** (security owner or architect; the original owner cannot self-approve).
3. **Includes a Mythos-class re-price** showing why the exposure window is tolerable.
4. **Specifies a barrier-class interim control** for the extension period.
5. **Has a hard new deadline**, not "indefinite."

An SLA extension is not "we'll get to it." It is a written, signed, time-bound exception with a barrier-class interim. Anything weaker is unmanaged drift.

### 7.3 Escalation triggers

The triage owner escalates to architect / CTO / security lead when:

- A runtime Critical/High finding has no barrier-class fix.
- A runtime N-day finding misses its 30-day SLA.
- The Mythos-class re-price flips a finding from Low/Medium to High/Critical and the team disputes the re-price.
- More than 5 deferred findings share the same owner (single-point-of-failure indicator).
- Calibration drift (§10) detected.

---

## 8. Artifacts and Templates

This skill produces exactly two artifacts: a **per-finding note** and (where relevant) a **`SECURITY.md` diff**. All other outputs are out of scope; code changes hand off to the engineering protocol (§12).

### 8.1 Per-finding note (canonical format)

```markdown
## Finding: <CVE / GHSA / advisory ID> — <component>@<version>

- **Advisory status:**       <public | under embargo | internal finding>
- **Advisory published:**    <YYYY-MM-DD | N/A>
- **Surface:**               <runtime | dev-build-supply-chain | dev-build-credential-pivot | dev-build-attacker-input | dev-build-isolated | test-only>
- **Input path:**            <attacker-controlled source> → <named function/module> → <vulnerable sink>

### Severity
- **Severity (ours):**       <Critical | High | Medium | Low | None>
- **Pre-grade reasoning:**   <one line; CVSS-style axes referenced>
- **Severity (advisory):**   <level>
- **Delta:**                 <same | +1 noted | -1 noted | >1 STOP — resolved by …>

### Mythos-class re-price
- **Claims re-priced:**      <list "attacker would need X" claims that no longer hold>
- **Net effect:**            <severity unchanged | severity raised from <X> to <Y>>

### Mitigation
- **Class:**                 <barrier | friction | none>
- **Named control(s):**      <…>

### Decision
- **Action:**                <block merge | block release | fix now | defer>
- **Reasoning:**             <one paragraph>

### If deferred
- **Owner:**                 <@handle — named person>
- **Trigger:**               <ISO date for N-day; date or concrete event otherwise>
- **Interim control class:** <barrier | friction-with-acceptance | none-with-acceptance>
- **Interim control name:**  <…>
- **Risk acceptance form:**  <link to §6.5.4 form, if applicable>
```

### 8.2 `SECURITY.md` deferral entry (canonical format)

```markdown
### <CVE or GHSA ID> — <component>@<version>

- **Status:** Deferred
- **Advisory status:**       <public | under embargo | internal finding>
- **Advisory published:**    <YYYY-MM-DD | N/A>
- **Surface:**               <one of the five surface labels>
- **Our severity:**          <Critical/High/Medium/Low> — <one-line reasoning>
- **Advisory severity:**     <level> — <delta noted>
- **Mythos-class re-price:** <what "attacker would need X" claims no longer hold>
- **Why deferred:**          <concrete reason; "time" alone is not a reason>
- **Interim control:**       <barrier-class control named | friction-only with risk acceptance link | none with risk acceptance link>
- **Revisit trigger:**       <ISO date — required for N-day; date or concrete event otherwise>
- **Owner:**                 <@handle>
- **Upgrade path:**          <e.g., "vite 5 → 6 migration, blocked on X">
- **Last reviewed:**         <YYYY-MM-DD>
```

A `SECURITY.md` lint is required (§12.2). Any entry missing one of these fields is treated as unmanaged risk.

### 8.3 Risk-acceptance form (required §6.5.4)

```markdown
### Risk acceptance — <CVE / GHSA>

- **Accepted by:**            <named person; signing authority documented>
- **Date:**                   <YYYY-MM-DD>
- **Reasoning:**              <why this risk is accepted; business or technical constraint>
- **Mythos-class re-price:**  <yes — and this re-price still permits acceptance because …>
- **Compensating monitoring:** <named alert, dashboard, or audit; not "we'll watch logs">
- **Re-evaluation date:**     <YYYY-MM-DD — required, not optional>
- **What would invalidate this acceptance:** <event(s) that force re-decision before re-evaluation date>
```

### 8.4 Batch triage report (for queues > ~10 findings)

```markdown
# Batch triage report — <YYYY-MM-DD>

## Inventory
- **Raw alerts:**             <count>
- **Deduped findings:**       <count>
- **By surface:**
    - runtime:                       <count>
    - dev-build-supply-chain:        <count>
    - dev-build-credential-pivot:    <count>
    - dev-build-attacker-input:      <count>
    - dev-build-isolated:            <count>
    - test-only:                     <count>

## Anchors (3 per surface, fully graded)
<for each surface, list the 3 anchor findings with full per-finding notes>

## Sampled findings (graded relative to anchors)
<list>

## Outcomes
- **Block release:**          <count>  <list>
- **Block merge:**            <count>  <list>
- **Fix now:**                <count>  <list>
- **Defer (managed):**        <count>  <list>
- **Document only (dev-build-isolated):** <count>  <list>

## Audit-surface gaps named (Lesson 2)
<list>

## Calibration check
- **Anchors agreed by reviewer:** <count> / 3 per surface
- **Drift indicator triggered:**  <yes | no>
```

### 8.5 Audit-surface gap entry (Lesson 2)

```markdown
### Audit-surface gap: <component>@<version>

- **Class(es):**           <named classes from §6.2.2>
- **Discovery context:**   <CVE/GHSA that surfaced this for review>
- **Last audited:**        <never | YYYY-MM-DD>
- **Owner:**               <@handle>
- **Plan:**                <"Schedule audit by <date>" | "Replace with <alternative> by <date>" | "Accept and monitor advisory feed">
```

---

## 9. Workflows

### 9.1 Single-finding workflow

```
1. INTAKE
   - Capture advisory ID, component, version
   - Dedup against existing tracked findings
   - Assign surface label per §6.4
2. PRE-GRADE  (Lesson 1)
   - Grade severity blind, before opening advisory
3. RE-PRICE   (Lesson 3 + §2.2)
   - Re-evaluate every "attacker would need X" claim
   - Reclassify any friction-class mitigations
4. COMPARE    (Lesson 1)
   - Open advisory, compare grade
   - >1 delta → STOP-REVIEW
5. AUDIT-GAP  (Lesson 2)
   - Have we ever audited this class/component?
   - If no → SECURITY.md entry per §8.5
6. DECIDE     (§7 decision table)
   - Block merge / block release / fix now / defer
7. EXECUTE
   - Hand off code changes to engineering protocol
   - Or record SECURITY.md entry per §8.2
8. VERIFY
   - Fix lands; regression test added; or trigger date scheduled
9. CLOSE
   - Reasoning comment on the originating alert/PR/ticket
   - Even if conclusion is "not applicable"
```

### 9.2 Batch workflow (for queues > ~10 findings)

The Mythos writeup notes that finding volume may eventually force relaxation of manual review processes. The defensive analog: batching is correct, but **runtime-surface findings never get batched away** and **N-day findings never get batched with non-public ones**, because their SLAs differ.

```
1. DEDUP
   - Collapse to one finding per (CVE, vulnerable package version)
   - List all dependency paths in the note
2. GROUP by surface
   - runtime  /  dev-build-supply-chain  /  dev-build-credential-pivot
   /  dev-build-attacker-input  /  dev-build-isolated  /  test-only
3. ANCHOR — within each group, fully grade 3 findings
   - Apply Lessons 1–5 in full
   - These are calibration anchors
4. RELATIVE-GRADE the rest of each group
   - Each finding placed relative to anchors
   - If a finding can't be placed → promote to anchor
5. BATCH OUTPUT
   - dev-build-isolated may be a single SECURITY.md batch entry per component
   - All other surfaces: individual entries
6. STRUCTURAL CHECK
   - If one component produces many findings: bad release vs. structural quality?
   - Different remediations for each
7. CLOSE-OUT
   - Reasoning comment on every alert (including dismissed batch members)
```

### 9.3 N-day fast-path

Triggered immediately on observation of any finding where the advisory is public and includes a patched-version reference.

```
T+0       INTAKE  (this is a countdown, not a queue item)
T+0       Verify advisory authenticity (signed advisory; trusted feed)
T+0–4h    PRE-GRADE blind
T+4–8h    RE-PRICE; verify barrier vs. friction of any cited mitigations
T+8–24h   DECIDE per §7
            - Runtime H/C → block release; fix now; SLA ≤ 30 days
            - Runtime Medium → SLA ≤ 90 days; barrier interim only
T+24h     If not yet remediated: schedule daily check-ins
T+SLA     Verify fix landed; regression test in place
          OR  exception process documented (§7.2)
```

The fast-path does not skip any state in §5. It compresses the timeline.

### 9.4 Escalation

Escalation paths must be defined per repo. The triage owner escalates when any of the conditions in §7.3 fire. An unanswered escalation within one business day is itself an escalation event.

---

## 10. Calibration Program

The 89% / 98% / 2% targets in §1.3 are not aspirational; they are the operating condition under which this skill produces its claimed value.

### 10.1 Calibration drills

- **Frequency:** at least once per quarter per active triage owner, or whenever drift indicators fire.
- **Format:** triage owner is given 30 closed findings (sampled, mixed surface, mixed severity) with the advisory grade redacted. They produce a pre-grade. An independent reviewer (security owner; or external) compares.
- **Pass condition:** exact-match ≥ 89%, within-one-level ≥ 98%, ≥2-level disagreement ≤ 2%.
- **Fail handling:** review the misses one by one; identify whether the failure mode is anchoring, missing re-price, or genuine knowledge gap; targeted retraining; re-drill within 30 days.

### 10.2 Drift indicators

| Indicator | Threshold | Action |
|---|---|---|
| Quarterly drill exact-match rate | < 85% | Calibration drill within 30 days |
| Quarterly drill within-one-level | < 95% | Same |
| Owner missed triggers in rolling 12 mo | ≥ 3 | Calibration drill + ownership review |
| Runtime findings deferred friction-only ≥ Medium | ≥ 1 | Process review; re-train |
| `SECURITY.md` lint failures, rolling 30 days | ≥ 1 | Process review |
| Mean triage latency, rolling 30 days | > 24 business hours | Capacity review |

### 10.3 Cross-team calibration

Where multiple owners exist across repositories, a once-per-half-year cross-calibration drill is run with the same finding set across all owners. Inter-rater reliability target: ≥ 80% exact-match across owners. Below this, the source-of-record threat-model documentation is reviewed for ambiguity.

---

## 11. Anti-Patterns

Each entry below names the anti-pattern, the failure mode, and the corrective action. Flag loudly when observed.

### 11.1 "It's a transitive dev dep, ignore it."

**Failure mode:** dismissal without applying §6.4 four blast-radius questions.
**Correction:** apply the four questions; only `dev-build-isolated` qualifies for documentation-only handling, and even that requires a one-line justification per question.

### 11.2 "We'll fix it post-MVP."

**Failure mode:** trigger that doesn't pass §6.5.2 validation.
**Correction:** demand a concrete revisit trigger and named owner; for N-day findings, a date ≤ 30 days for High/Critical, ≤ 90 days for Medium.

### 11.3 "The attacker would need to X first."

**Failure mode:** invoking attacker cost without re-pricing under Mythos-class assumption.
**Correction:** apply §2.2 re-price. If X lands in the **Cheap** column, X is friction, not a barrier.

### 11.4 "The fix is out but we haven't tested it in our env yet."

**Failure mode:** treating "needs validation" as a deferral reason for an N-day.
**Correction:** for an N-day, "haven't tested" is an urgent action item, not a defer. The patch is the attacker's roadmap; every hour of delay raises weaponized-exploit probability.

### 11.5 "Dependabot fires too often, we batch weekly."

**Failure mode:** batching that swallows runtime and N-day findings into a non-urgent rhythm.
**Correction:** batching `dev-build-isolated` is fine. Batching runtime-surface or N-day findings is not. Apply §9.2 grouping rules.

### 11.6 Accepting advisory severity unchanged without independent re-grading.

**Failure mode:** anchoring; advisories are written for generic deployments.
**Correction:** §6.1.1 anti-anchor rule. Always pre-grade.

### 11.7 Silently closing a Dependabot alert.

**Failure mode:** alert closed without reasoning trail; no audit chain.
**Correction:** always leave the Pass-1/Pass-2 reasoning as a comment, even if the conclusion is "not applicable." This is enforceable in CI.

### 11.8 "We're not a big enough target."

**Failure mode:** obscurity-of-target argument.
**Correction:** Mythos-class capability drops attacker cost dramatically (the source cites ~$1k–$2k per N-day exploit produced). Obscurity-of-target is not a control.

### 11.9 "Dependabot didn't flag anything this week."

**Failure mode:** treating queue silence as risk silence.
**Correction:** Lesson 2. The published findings are framed as a lower bound. Schedule audit-surface review on cadence regardless of queue activity.

### 11.10 Grading without the Mythos-class re-price step.

**Failure mode:** old-threat-model severity numbers.
**Correction:** §2.2 is non-optional. State 3 of the lifecycle (§5) cannot be skipped.

### 11.11 "Mitigated by SameSite cookies" (or equivalent named-but-uninspected control).

**Failure mode:** invoking a named barrier-class control without verifying its conditions hold.
**Correction:** §6.3.2 lists the conditions for each barrier classification. Verify the conditions actually hold; the *name* of a control is not the *presence* of the control.

### 11.12 "Defense in depth."

**Failure mode:** multi-layer defense argument where no individual layer is named or classified.
**Correction:** classify each layer. The argument resolves only if at least one layer is barrier-class.

### 11.13 "It's only exploitable if the attacker has X (where X is achievable)."

**Failure mode:** treating any precondition as sufficient defense.
**Correction:** re-price X. If X is achievable, the precondition is friction, not barrier.

### 11.14 "We're using the latest version, so we're safe."

**Failure mode:** "latest" is not the same as "patched"; advisories sometimes fix in branches.
**Correction:** verify against the *patched-version reference in the advisory*, not against `npm latest`.

---

## 12. Operational Integration

### 12.1 Hand-off to engineering protocol

This skill terminates at the **DECIDE** state with two artifacts:

1. The per-finding note (§8.1).
2. Where applicable, a `SECURITY.md` diff (§8.2 / §8.5).

Code changes are out of scope. They are handed off to the engineering protocol — for example, a WIRE-style read-before-write protocol with line-numbered audits, Python-over-sed for multi-line patches, timestamped `.bak` backups, and `pnpm tsc --noEmit` after every change. Triage and remediation are separate phases. Do not collapse them. Do not let "just fix it" skip the per-finding note.

### 12.2 `SECURITY.md` lint

`SECURITY.md` is a structured document. A lint runs on every PR and at least daily on `main`:

```
For every entry under "Deferred" or "Risk acceptance":
    - All required fields present (§8.2 / §8.3)
    - Trigger field passes §6.5.2 validation
    - For N-day entries, trigger is a date
    - Trigger date is in the future, OR an "overdue" flag is raised
    - Owner is a known active handle
    - Re-evaluation date (for risk acceptance) is in the future
For every audit-surface gap entry (§8.5):
    - Plan field non-empty
    - If "Schedule audit by <date>", date is in the future
```

Lint failures block merge. There is no "soft fail" mode for security lint; soft-fail is friction.

### 12.3 CI integration points

| Hook | Action |
|---|---|
| Pre-commit | `SECURITY.md` lint runs locally. |
| PR open | Lint runs in CI; advisory feed cross-checked against `SECURITY.md`; new advisories flagged. |
| Daily on main | Lint + trigger-date sweep; overdue triggers escalate. |
| Weekly | Audit-surface review reminder. |
| Quarterly | Calibration drill scheduled. |

### 12.4 Tooling boundaries

This skill is process discipline, not tooling. Implementations are expected to use Dependabot / Snyk / Socket / OSV scanners as raw inputs; this skill standardizes how their output is processed.

Tooling does not substitute for the workflow:

- Tools fail to apply the Mythos-class re-price.
- Tools cannot validate the four blast-radius questions for *your* repo.
- Tools cannot distinguish friction from barrier.
- Tools cannot enforce trigger validation without text-rule support.

Use tools for *capture* and *enforcement* (lint). Use the workflow for *decisions*.

---

## 13. Validation and Testing

### 13.1 Skill validation — does the skill itself produce the claimed value?

The skill is itself a process under test. Validate quarterly:

- **Calibration drill outcome** (§10.1): pass rate.
- **N-day SLA adherence**: rolling 90-day measurement against §1.3 metrics.
- **Lint clean rate**: 100% target on `SECURITY.md`.
- **Process-violation rate**: closures without reasoning comment, deferrals without all three fields, runtime findings deferred friction-only ≥ Medium. Target: 0.
- **Owner accountability**: missed triggers per owner in rolling 12 months. Target: 0.

### 13.2 Red-team drills

Once per half-year, an independent reviewer constructs a synthetic finding pack:

- 5 findings where the advisory grade is correct.
- 5 findings where the advisory grade is too low for *this* deployment (Mythos re-price flips).
- 5 findings where the advisory grade is too high for *this* deployment.
- 5 findings that are `dev-build-isolated` but plausibly look runtime.
- 5 findings that look `dev-build-isolated` but actually have credential pivot or supply-chain path.
- 5 findings with friction-only mitigations described in barrier-sounding language.
- 5 findings with insufficient triggers presented as adequate.

The triage owner runs the full process. Pass condition: at least 80% correct classification across all categories; no ≥2-level severity miss.

### 13.3 Backtesting

Every six months, randomly select 10 closed findings from the prior 6 months. Re-run the full workflow on each, blind to the original outcome. Compare. Disagreements are calibration data.

### 13.4 Post-incident retrospective hook

After any security incident (whether or not the root cause traces to a triaged finding), the post-incident retrospective includes:

- Was the implicated component on the audit-surface gap list?
- Was there a deferred finding that touched the implicated path?
- If yes, were the deferral fields valid at the time of incident?
- Did the trigger fail to fire?
- Did the interim control turn out to be friction-class?

Findings from retrospectives feed §10.2 drift indicators.

---

## 14. Out of Scope

The following are explicitly out of scope. Each has a reason and a hand-off target.

| Out of scope | Reason | Hand-off |
|---|---|---|
| Writing exploits or PoCs | Triage skill, not offensive | Out of scope of this organization (per source disclosure norms) |
| Incident response (post-compromise) | Different playbook entirely | Incident response runbook |
| Cryptographic primitive selection | Specialized; primitives are not triage decisions | Crypto reference / consultant |
| Secret rotation mechanics | Operational, not triage | Ops runbook |
| Fuzzing / novel-vulnerability discovery (performing) | Out of scope | (None — flagging gap is in scope; closing gap requires audit budget) |
| Supply-chain ingestion gating (e.g., dependency review at install time) | Adjacent but distinct discipline | Supply-chain policy doc |
| License compliance | Not a security concern | License audit |
| Privacy / DPIA | Not vulnerability triage | Privacy review |

---

## 15. Open Questions and Risks

### 15.1 Open questions

- **OQ1.** What's the correct N-day SLA for `dev-build-supply-chain` Critical? §7 maps it to runtime rules, but the exposure shape differs. Current answer: identical to runtime, defensible because compromise of build = compromise of product.
- **OQ2.** How is the calibration drill sampled when triage volume is low (< 30 findings/quarter)? Current answer: roll the window to 6 months; if still < 30, supplement with synthetic findings from the red-team drill (§13.2).
- **OQ3.** What constitutes adequate "documented exception" for an SLA extension (§7.2)? Current answer: as specified in §7.2; revisit if exception rate exceeds 5% of N-day findings.
- **OQ4.** How does this skill compose with multi-repo monorepo triage where surfaces vary across packages? Current answer: surface labels are per-finding-per-package, not per-repo.

### 15.2 Risks to the skill itself

- **R1.** Calibration drift from infrequent drills. Mitigation: §10.1 cadence is non-optional.
- **R2.** Owner attrition leaves orphaned deferrals. Mitigation: §6.5.5 reverts orphaned findings to PRE-GRADE state.
- **R3.** Lint becomes noisy and is disabled. Mitigation: §12.2 hard-fail; no soft-fail mode.
- **R4.** "Audit-surface gap" entries accumulate without resolution, becoming wallpaper. Mitigation: quarterly review (§12.3) and named owner per entry.
- **R5.** The Mythos-class re-price is applied perfunctorily. Mitigation: §13.2 red-team drill specifically targets this category.
- **R6.** Source writeup updates after April 9, 2026; skill drifts from source. Mitigation: §0 metadata pins source-of-record date; review on every source revision.

---

## 16. Appendices

### Appendix A — Quick Reference Card

```
INTAKE      → dedup, surface label
PRE-GRADE   → blind, no advisory
RE-PRICE    → §2.2 — every "attacker would need X"
COMPARE     → exact / ±1 / >1 STOP
AUDIT-GAP   → §6.2 catalog; SECURITY.md if never audited
DECIDE      → §7 table
EXECUTE     → hand off to engineering protocol
VERIFY      → fix lands or trigger scheduled
CLOSE       → reasoning comment, always

DEFER REQUIRES:  owner + trigger + interim
N-DAY DEFER:     trigger MUST be a date; ≤30 H/C, ≤90 M
FRICTION-ONLY:   never for runtime N-day ≥ Medium
ROUND UP when uncertain; never round toward advisory
```

### Appendix B — Severity grading rubric (CVSS-style, condensed)

| Axis | Level | Description |
|---|---|---|
| Attack Vector | Network / Adjacent / Local / Physical | Where the attack originates |
| Attack Complexity | Low / High | After Mythos re-price, "High" is rare |
| Privileges Required | None / Low / High | What the attacker must already hold |
| User Interaction | None / Required | Interaction required at exploit time |
| Scope | Unchanged / Changed | Whether the exploit reaches a different security authority |
| Confidentiality impact | None / Low / High | What can be read |
| Integrity impact | None / Low / High | What can be modified |
| Availability impact | None / Low / High | What can be denied |

Mapping to severity (rough): Critical = network + low complexity + no privileges + no interaction + high CIA. Medium = at least one significant friction (e.g., privileges required) and partial CIA. Round up when between bands.

### Appendix C — Audit-surface catalog (full table reproduced from §6.2.2)

(See §6.2.2.)

### Appendix D — Trigger taxonomy (validated examples)

| Trigger candidate | Validates? | Rule |
|---|---|---|
| `2026-06-30` | Pass | Date — calendar verifiable |
| `When the migration to vite 6 lands on main` | Pass | Concrete event — git log verifiable |
| `When the Acme Corp pilot starts` | Pass | Concrete event — contract verifiable |
| `When [named feature] ships to ≥10% of users` | Pass | Concrete event — telemetry verifiable |
| `Before opening registration to the public` | Pass | Concrete event — product launch verifiable |
| `Before our first external beta user` | Pass *if* "external beta user" is defined | Conditional |
| `End of Q3` | Fail | Date imprecise; specify a calendar date |
| `Post-MVP` | Fail | "MVP" not a defined event |
| `When we have time` | Fail | Opinion |
| `When the fix is more mature` | Fail | Opinion |
| `Soon` | Fail | Not a trigger |
| `Next sprint` | Fail unless sprint has a calendar end date | Conditional |

### Appendix E — Mythos-class re-price worksheet

Use one row per "attacker would need X" claim:

```
Claim:                <verbatim from advisory or defender argument>
What X requires:      <information-gathering | combinatorial search | code understanding | side-channel | multi-step orchestration | other>
Cost under Mythos:    <Cheap | Expensive>
Source-supported:     <yes — see §2.2 axis | yes — see §2.2 axes | unknown>
Re-priced verdict:    <claim holds | claim degraded to friction | claim eliminated>
```

If every claim re-prices to Cheap, the "attacker would need X" argument has been re-priced to zero.

### Appendix F — `SECURITY.md` skeleton

```markdown
# SECURITY.md

## Reporting
<contact, PGP, scope>

## Active deferred findings
<entries per §8.2>

## Active risk acceptances
<entries per §8.3>

## Audit-surface gaps
<entries per §8.5>

## Resolved (recent 90 days)
<archive of closed entries with closure date>

## Process pointers
- Triage skill: mythos-security-triage v<version>
- Engineering protocol: <link>
- Calibration log: <link>
```

---

## 17. Source and Provenance

All Mythos-derived factual claims in this PRD trace to:

> *Assessing Claude Mythos Preview's cybersecurity capabilities*, red.anthropic.com, April 7, 2026 (edited April 9, 2026).

Process formalizations (state machine in §5; SLA tables in §7; calibration program in §10; red-team drill design in §13.2; trigger validation rules in §6.5.2; audit-surface catalog expansion in §6.2.2; risk-acceptance form in §6.5.4 and §8.3; lint specification in §12.2) are this PRD's contribution. They do not introduce new factual claims about Mythos capability; they operationalize the source's published guidance.

When this PRD and the source disagree on factual claims about Mythos, the source wins. When this PRD and the source disagree on process, this PRD is the operating reference for the team that adopts it.

---

*End of PRD.*
