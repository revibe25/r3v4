# R3 v4 PRD v4.1 — Triple-Check Report
# + AGI Suite Architecture Resolution
# + Gap Analysis: Autonomous Agent OS PRD ↔ AGI Suite

**Document type:** Audit + architectural inference + gap analysis
**Scope:** R3v4_PRD_v4.1 (uploaded), AGI Suite (`~/Agi-Suite/`), Autonomous Agent OS PRD v1.0
**Method:** Full read of the PRD (869 extracted lines), cross-referenced against memory and past-chat ground truth; expert reasoning where direct verification not possible
**Date:** 2026-04-30

---

## Part 1 — Triple-Check of R3 v4 PRD v4.1

### Methodology

I read the PRD end-to-end. Every internal cross-reference (table↔prose, schema↔API, status flag↔baseline) was checked against the PRD itself and against memory/past-chat ground truth. Findings are tagged by severity:

- **BLOCKER** — contract-level error; fix before external distribution.
- **HIGH** — factual inconsistency that a careful reader (investor, engineer, auditor) will catch and challenge.
- **MEDIUM** — drift between sections that misleads but doesn't break anything.
- **LOW** — cosmetic / version-tracking.

I found **3 BLOCKERS, 6 HIGH, 5 MEDIUM, 4 LOW** — 18 findings total. The PRD is high-quality overall (specific, file-path-grounded, dated). The findings below are the kind of drift density that any document this dense accumulates without an enforcement pass.

### Severity summary

| Severity | Count | Action window |
|---|---|---|
| BLOCKER | 3 | Before next external distribution (investor, hire, partner) |
| HIGH | 6 | Before the next demo or week of work that depends on this contract |
| MEDIUM | 5 | Next document revision |
| LOW | 4 | When convenient |

### Findings

**F1 [BLOCKER] Cover header version mismatch.**
Line 1: `**R3 v4 — PRD v4.0**\tCONFIDENTIAL — NOT FOR DISTRIBUTION`
Document is otherwise titled "Version 4.1" throughout (version table, footer, changelog).
Why blocker: a contract document with mismatched version numbers in its own header is the first thing a sharp reader notices. Investors will photograph this. Fix: change the cover header to `**R3 v4 — PRD v4.1**`.

**F2 [BLOCKER] §13.1 procedure namespace is wrong.**
PRD §13 lists `aiMix` as the wired router; memory confirms `aiMix.submitSuggestionOutcome` is the real procedure called from `MixSuggestionsPanel.tsx`. But §13.1 "Key Procedure Contracts" documents:
- `ai.startPipeline`
- `ai.submitSuggestionOutcome`
There is no `ai` router in the appRouter shape — only `aiMix`. **The namespace prefix is wrong in two of the three documented procedure contracts.** Fix: rename to `aiMix.startPipeline` and `aiMix.submitSuggestionOutcome` to match the actual wired router. If `ai` is intended as a separate top-level router (it isn't currently), say so explicitly and add it to the §13 router table.

**F3 [BLOCKER] §20 self-contradicts on current valuation.**
§20 valuation gates table: `Current — technical asset only $180K–$400K`.
§20 prose, three paragraphs later: `the current build state ... represents approximately $300–600K of technical value as a pure asset`.
Two conflicting valuations of the same thing in adjacent paragraphs. An investor will flag this and read the rest of the document with reduced trust. Fix: pick one range, propagate, and note the assumption (e.g., "low end = code only, high end = code + LLPTE architecture as defensible IP").

**F4 [HIGH] Test count claim rests on a config the PRD itself flags as broken.**
§0 / §1: "Vitest — 42+ cases across LLPTE layers" (Auto-Leveling 20 + Smart Transitions 22).
§18.6 P5: "Fix vitest root config — add include pattern for `packages/*/tests/*.test.ts` to get accurate test count".
**The 42+ count is from a vitest config that doesn't actually scan all package tests** — the PRD's own §18.6 admits this. The accurate count could be higher or lower; you don't know. Why high: this is an investor-facing metric. The PRD should either fix the config now and report the verified count, or qualify the figure ("≥42 confirmed in this config; full count pending vitest root config fix per §18.6").

**F5 [HIGH] §8.4 names wrong wiring target for Mix Suggestion backend.**
§8.4: "Trigger detection logic in `server/services/`. Backend wiring to **`sessionMetrics.router`** pending."
But the in-flight work (per memory and §13's appRouter table) is wiring `mix-suggestion.service.ts` into **`aiMix.router.ts`**, not `sessionMetrics.router`. Two different routers, two different wiring targets. The PRD names the wrong one. Fix: change §8.4 to `aiMix.router`.

**F6 [HIGH] §7 Zone 4B labels LLPTE node #3 incorrectly.**
§7 Zone 4B: "Five animated nodes: inputRouter → spectralAnalyzer → **llpte-core** → transitionGraph → outputBus".
§22 Glossary + memory: node #3 is `aiMixEngine`. `llpte-core` is a *package* (orchestration / lifecycle, per §8.5), not a pipeline node. The UI graph in Zone 4B is showing the orchestrator package as if it were a pipeline node. Either the UI is mislabeled (engineering bug) or the PRD is mislabeled (doc bug). Memory says `aiMixEngine`, so the PRD is wrong. Fix: §7 Zone 4B node #3 → `aiMixEngine`.

**F7 [HIGH] aiDecisionLog `outcome` enum needs source-of-emission documented.**
§12 schema: `outcome` ∈ `{auto_applied, accepted, rejected, ignored, discarded}` (5 values).
§13 `ai.submitSuggestionOutcome` input: `outcome` ∈ `{accepted, rejected, ignored}` (3 values).
The 3-value subset is what users can submit; the other two (`auto_applied`, `discarded`) are emitted server-side at gate time (≥0.65 auto-applies, <0.40 discards per §8.1). This is logically consistent **but not documented**. A future engineer reading §13 in isolation will assume the column is 3-valued and either reject server emissions or break the schema. Fix: in §13.1, add one line: "`auto_applied` and `discarded` are emitted by `aiMixEngine` at gate time, not user-submitted; see §8.1 confidence gating."

**F8 [HIGH] Migration 0005 status drift across sections.**
- §0 Hygiene Baseline: "aiDecisionLog migration 0005" (no environment qualifier; reads as ✅)
- §0 Build State table: `aiDecisionLog table | ✅ Migration 0005`
- §17 Schema Inventory: `aiDecisionLog | ... | ✅ Migration 0005 (2026-04-09)`
- §18.6: "**Migration applied (Railway)** | PENDING — 0005_overjoyed_gambit.sql"
- §18.6 P0: "Apply migration 0005 to Railway production DB"

The schema is applied **locally** but **not** to Railway production. The PRD presents it as ✅ in three places without environment qualification, and as 🔲 PENDING in two places. A casual reader reading §0 first concludes "shipped"; a careful reader reading §18.6 concludes "not shipped." Both are partially right. Fix: tag every migration status with environment, e.g., `Migration 0005 — local: ✅ | Railway prod: 🔲 (P0)`.

**F9 [HIGH] §15 Demo Requirements row contradicts §0 Build State without resolution.**
§0: `aiDecisionLog table | ✅ Migration 0005`
§15: `aiDecisionLog writes live | 🔲 | Acceptance rate shows 0 = weak demo`

Both true: schema exists, writes don't yet flow from `session-metrics.service.ts` into the table. But the PRD doesn't make the table-vs-writes distinction crisply, leaving an apparent contradiction. Fix: in §0, change the row to `aiDecisionLog | Schema ✅ Mig 0005 / Writes 🔲 (P0)` — match §18.6 P0.

**F10 [MEDIUM] §18.2 cost projection math doesn't reconcile.**
"25K users: ... Estimated cost: $0.0008 per inference at 25K users = ~$600/month."
Independent rough check: §3 implies ~3 sessions/user/week. At 25K users → ~300K sessions/month. If avg ~5 inferences/session (a guess — the PRD doesn't state this), that's 1.5M inferences/month × $0.0008 = ~$1,200/month. If avg 2.5 inferences/session, ~$600/month. **The figure is plausible but the inferences-per-session assumption isn't stated.** Why medium: investor or engineer reproducing the math will get a different answer and assume the PRD is sloppy. Fix: state the assumed `inferences-per-session` number alongside the cost.

**F11 [MEDIUM] §17 Phase quarter-labels don't reconcile with post-launch counts.**
- Phase 2: "Q3 2026 (6 months post-launch)" → implies launch ≈ Q2 2026 / Q1 2026 transition.
- Phase 3: "Q1 2027 (12 months post-launch)" → implies launch ≈ Q1 2026.
- Phase 4: "Q3 2027 (24 months post-launch)" → implies launch ≈ Q3 2025 (already past).

The post-launch month counts and the calendar quarters disagree on when "launch" is. Fix: pick a launch quarter, propagate; or drop the absolute quarters and keep "+6/+12/+24 months."

**F12 [MEDIUM] §11 hard guards don't ban TODO/FIXME or telemetry without consent.**
"No `any`, no swallowed exceptions, no `console.log`" is good. Missing rules typical for a paid SaaS:
- No `TODO`/`FIXME` in shipped code without ticket reference
- No PII in logs (Stripe customer IDs, email)
- No fetch/eval of remote code at runtime
- No third-party telemetry without user opt-in (privacy policy implication)

Why medium: not strictly contract violations today, but their absence widens what counts as "compliant" code over time. Fix: add 2–4 more guards, even if "informational" only.

**F13 [MEDIUM] §14 mentions auth fix but not the threat model.**
§14 documents what was fixed (`trpcAuth` mounted, `hydrateFromToken` race) but not what the threat surface is. A security-aware investor or hire will ask: token TTL? CSRF posture (you use httpOnly cookies — same-site mode?)? Rate-limit on login (only AI request limit is documented)? Brute-force lockout? Password reset oracle? Fix: add a short threat-model paragraph and reference the `mythos-security-triage` skill if it's adopted.

**F14 [MEDIUM] §11 mentions phantom directories but `client/src/store` is flagged "LIVE — has imports".**
That means the phantom is no longer phantom — code depends on it. Calling it a "phantom directory" while documenting that it has live imports is confusing terminology. Fix: rename the category to `directory drift` or `non-canonical directories with live imports`. Phantom = unreferenced. This one is referenced.

**F15 [LOW] Date drift: "Updated 2026-04-12" vs "Verified 2026-04-09" vs migration "(2026-04-09)".**
Internally consistent (verification on -09, doc updated on -12) but worth a one-line note in the footer ("doc last updated 2026-04-12; build state verified 2026-04-09"). Reader doesn't have to reason about which date applies to what.

**F16 [LOW] `LowLatency Processing Transition Engine` capitalization drift.**
Most occurrences: "Low-Latency Processing Transition Engine".
§22 glossary: "Low-Latency Processing Transition Engine".
But §11 and a few prose mentions vary slightly. Pick one casing for the proper noun. Cosmetic but you ship this to investors.

**F17 [LOW] §22 glossary missing some terms used earlier.**
Used but undefined: `Camelot wheel`, `LUFS`, `Wire.txt protocol` — actually defined ✅. Not defined: `RMS`, `FFT`, `dBFS`, `httpOnly cookie`, `Drizzle ORM`, `Wouter`, `r3_hygiene.py` — defined ✅. Missing: `tap-tempo`, `Camelot scoring` (Camelot wheel is, scoring isn't), `Proxy pattern` (used in §18.2), `mv_*` materialized view naming. Cosmetic.

**F18 [LOW] §11 hard-guard section has internal `console.log` count drift.**
Early in §11: "5 violations in `server/index.ts:300-308` — pending fix"
§18.6: "5 remaining in `server/index.ts:300-308`"
Same count, same path; consistent. But that's also exactly 9 lines (300–308). Either it's actually 5 violations on 9 contiguous lines (4 lines without violation, plausible) or the line range and count are independently quoted from somewhere and one of them rounded. Cosmetic — but if you fix any of these, watch that the other reference updates.

### Cross-cutting observation: scope discipline

**The PRD does not mention AGI Suite, RHOS, `r3agent.py`, the api-server (port 3001), `apps/api-server`, `apps/r3-agi`, the `~/Agi-Suite/` repo, Telegram, the AGI Command Center HTML, or any operations/observability surface.** This is *good* scope discipline — the R3 v4 PRD is about R3 v4. AGI Suite is a separate observability layer over R3 v4 and belongs in its own document. Don't add an "AGI Suite" reference to fix the omission; instead, write a separate AGI Suite spec when it's worth doing (see Part 3).

---

## Part 2 — Expert Resolution: Four Open Questions

I cannot definitively answer any of these without inspecting the actual AGI Suite code. What I can do — and what "expert approach" means here — is reason from evidence (PRD content, past-chat content, naming conventions, standard architectural patterns) to defensible inferences with stated confidence and named open-verification commands. Where confidence is below 90%, I name what would close the gap.

### Q1: Does `r3agent.py` touch `~/Agi-Suite/`, or only `~/Stable/` (R3 v4)?

**Evidence:**
- April 11 chat: described as "Telegram-based remote dev agent (`r3agent.py`) being configured in Termux to SSH into a machine called 'Penguin' and dispatch development tasks." Context was R3 v4.
- April 25 chat: I asked you this exact question; the search snippet didn't surface your answer.
- This R3 v4 PRD: zero mentions of `r3agent.py`. Confirms R3 v4's contract doesn't depend on it; r3agent is dev tooling, not product surface.
- Memory: "Telegram-based remote dev agent (r3agent.py) in Termux to SSH into the Penguin machine for mobile task dispatch."

**Expert reframe:** The literal question "does r3agent.py touch AGI Suite?" is the wrong question. **`r3agent.py` SSHs into Penguin, which gives it shell on the user's account. From there it can `cd` to anywhere that account can read** — `~/Stable/`, `~/Agi-Suite/`, `~/.ssh/`, anything. The intended scope (whatever you've coded into the agent's task vocabulary) is irrelevant under threat model. *Realized* scope = whatever the SSH session can reach.

So the real questions are:
1. Is `r3agent.py`'s task vocabulary scoped — does the prompt instruct it to operate within `~/Stable/` only?
2. Is the *SSH session itself* scoped (e.g., `ForceCommand` in `sshd_config`, restricted shell, chroot, dedicated low-privilege user)?

(1) is friction. (2) is barrier — same distinction as the security PRD §6.3.

**Expert inference (high confidence):** Today, in current state, `r3agent.py`'s SSH session is *not* shell-restricted (no past chat mentions setting up `ForceCommand` or a restricted user). It uses your normal Penguin SSH credentials, which means it can read `~/Agi-Suite/` regardless of what its task vocabulary says.

**Open verification — paste back if you want to confirm:**
```bash
grep -E '^(Match|ForceCommand|PermitTTY|AllowUsers)' /etc/ssh/sshd_config 2>/dev/null
echo "---"
ls -la ~/.ssh/authorized_keys
echo "---"
# If r3agent.py uses a dedicated key, find it:
grep -E 'IdentityFile|key' ~/path/to/r3agent.py 2>/dev/null | head -5
```

**Mastery-level recommendation:**

The AGI Suite is sensitive (host-policy engine, possibly running as root — see Q3). The R3 v4 repo is also sensitive (secrets, Stripe keys in `.env`). Right now both are reachable from a Telegram bot token. Telegram bot tokens leak through git history regularly; this is not theoretical.

Fix order, cheapest first:
1. **(15 min) Move r3agent.py to a dedicated SSH key** (not your personal key) and put that key in a separate `authorized_keys` entry with a `command="..."` restriction. Even a wrapping script that only allows `cd ~/Stable && pnpm <subcommand>` is a barrier vs. the current friction-only "the prompt asks it to stay in Stable."
2. **(30 min) Run r3agent.py as a separate Linux user** (`r3v-agent`) whose `$HOME` does not contain `~/Agi-Suite/` or your `~/.ssh/`. Telegram bot compromise → that user's box, not yours.
3. **(1 hour) Egress-restrict that user.** It only needs to talk to api.telegram.org and (if it makes Anthropic API calls) api.anthropic.com. Drop everything else.
4. **Audit the bot token** — is it in git? Is it in `~/.bashrc` echoed to logs? Does `r3agent.py` print it on error?

Independent of the above: this is exactly the unbounded-capability-bridge pattern from the agent OS PRD §3 threat model. Capability-bound the dispatch surface (specific allowed commands) before extending the agent's vocabulary further.

**Working answer for the gap analysis:** I will treat r3agent.py as *capable of* touching AGI Suite, regardless of whether it currently does.

### Q2: Is there an LLM-driven autonomous component in AGI Suite today?

**Evidence:**
- This R3 v4 PRD: only AI is LLPTE — heuristic, not LLM (§18.1 explicit: "No trained model is deployed. ... rules-based thresholds calibrated against 50-session alpha baselines").
- Past chats inspecting AGI Suite files: api-server (Express SSE), React frontend, `tools/rhos/` bash scripts. Nothing references `claude-`, `anthropic`, `openai`, `@anthropic-ai/sdk`, or any LLM client library.
- The "AGI Command Center" (`r3v4_agi_fixed.html`) does have direct Anthropic API calls — but that's a standalone HTML for investor demos, not in the AGI Suite monorepo. Different artifact, different repo.
- The RHOS subsystem makes ALLOW/BLOCK decisions via deterministic bash heuristics (per the policy-engine inspection in past chats).

**Expert inference (high confidence, ~95%):** AGI Suite as the monorepo at `~/Agi-Suite/` does **not** currently have an LLM-driven autonomous component. The closest thing to "agent" behavior is RHOS, which is a deterministic policy engine in bash. The AI in "AGI" is aspirational naming.

**Open verification:**
```bash
cd ~/Agi-Suite
grep -r --include='*.{ts,js,json}' -lE '(anthropic|@anthropic-ai|openai|claude-|gpt-)' . 2>/dev/null
grep -rE 'fetch.*anthropic\.com' . 2>/dev/null | head -5
```

If those are empty, my inference holds.

**Mastery-level recommendation:**

The naming gap is itself a problem. "AGI Suite" today means:
- A read-only admin dashboard (api-server SSE + React)
- A host-policy engine in bash (RHOS) with a known signal-integrity bug

That's a respectable system. It's not AGI. It's not even agentic.

Three options, in order of integrity:
1. **Rename.** Match the name to what it is. Suggestions: `ops-suite`, `rhos-console`, `r3-admin`. Costs you a directory rename and some imports. Removes the integrity gap.
2. **Build the agent layer.** Use the autonomous-agent-os PRD as the roadmap. Wire RHOS as the v0 substrate (it's already event-shaped — see Part 3). This is real work — months. But it makes the name accurate.
3. **Document the aspiration.** Add a `README.md` at `~/Agi-Suite/` that says "today this is an admin/observability surface; the path to autonomous-agent functionality is in `docs/agent-os-PRD.md`." This is the cheapest correct move.

(3) is probably right for now. Don't optimize for option (2) until you have a reason to add an LLM-driven layer. The current system has value as it is.

**One specific call-out:** if you ever pitch the AGI Suite to investors or collaborators *as* an agent system, that's a representation problem. Use the actual capabilities in any external description.

### Q3: Does `install-policy-engine.sh` install RHOS as a systemd service running as root?

**Evidence:**
- File path: `tools/rhos/install-policy-engine.sh`. Naming pattern strongly suggests installer.
- File size: 3245 bytes. Consistent with: a script that writes a systemd unit, sets paths, enables/starts the service. Too large for a simple symlink; too small for an arbitrary shell tool.
- Position: alongside `policy-engine-v1.sh` (the runtime), `enforcement-kernel-v1.sh`, `transaction-kernel-v1.sh`. The "engine + kernel + installer" triad is the standard systemd-service shape.
- Disk-governor reads root-filesystem health (`root-health-check.sh` was named for it, even after deletion). That data typically requires root access (privileged reads on `/var/log/journal`, `/proc`, etc.).
- I have not seen the contents of `install-policy-engine.sh`.

**Expert inference:**
- **~95% confident** it's an installer (name, size, location, layout).
- **~80% confident** it installs as a systemd service (most natural way to install a "policy engine" that needs to run continuously on Linux).
- **~70% confident** it runs as root (disk and root-filesystem health checks usually need it; the alternative is a finely-scoped sudoers rule which is more work to set up than just running as root).

**Open verification (one of these will resolve):**
```bash
# Did it install a systemd unit?
systemctl list-unit-files | grep -iE 'rhos|policy'
ls -la /etc/systemd/system/ | grep -iE 'rhos|policy'

# If yes, what user?
systemctl cat <unit-name> 2>/dev/null | grep -E '^(User|ExecStart|Type|EnvironmentFile)='

# What does the installer actually do?
head -50 ~/Agi-Suite/tools/rhos/install-policy-engine.sh
```

**Mastery-level recommendation:**

**Assume root until proven otherwise.** The cost of preparing for root and finding it's not is harmless. The cost of assuming non-root and finding it is root is shipping a Lesson-3 friction-class failure (the existing `|| true` signal-swallow bug) at root privilege.

Independent of installation status — and this is the most important part — the **known signal-integrity bug** in `policy-engine-v1.sh`:

```bash
DISK_OUTPUT=$("$HOME/.../disk-governor-core-v2.1.sh" || true)
HEALTH_OUTPUT=$("$HOME/.../root-health-check.sh" || true)
```

means **empty output is indistinguishable from healthy output**, and the engine returns `decision=ALLOW`. If the policy engine runs as root and is consulted for `ALLOW/BLOCK` decisions on host operations, this bug means: when health monitoring fails, the system grants permission. That's a fail-open policy on a privileged subsystem. Per the security PRD §6.3 this is friction-class pretending to be barrier-class — it must be fixed before anything else in the agent-OS retrofit.

The fix is structural, not `s/|| true//`:
- `disk-governor-core-v2.1.sh` should emit a structured signal: `{ status: 'OK'|'FAIL'|'DEGRADED', evidence: ... }` on stdout, and a non-zero exit code on `FAIL`. Empty output should be impossible — either the script wrote a status line or it crashed (and the caller can detect that).
- `policy-engine-v1.sh` should check exit code first, then parse the status line. Default decision on "no parseable status" is `BLOCK`, not `ALLOW`.
- Add a regression test that runs the engine with the data sources rigged to fail (e.g., `chmod 000`), and asserts the decision is not `ALLOW`.

This single fix is more valuable than any agent-OS retrofit, because it removes the failure mode that the retrofits would amplify.

**Working answer for the gap analysis:** I will treat RHOS as running with elevated privilege. The blast radius of the signal-integrity bug is therefore "a privileged decision returning ALLOW on signal failure," not "an unprivileged advisory returning ALLOW on signal failure." Different threat profile, same fix.

### Q4: Does AGI Suite write to a database?

**Evidence:**
- This R3 v4 PRD §17 schema inventory: `aiDecisionLog` (and 12 other tables) live in **R3 v4's** PostgreSQL via Drizzle ORM 0.39.3. Schema in `server/db/schema.ts` — that's R3 v4's `server/`.
- This R3 v4 PRD §18.6: `Migration applied (Railway) | PENDING — 0005_overjoyed_gambit.sql`. The Railway DB hosts R3 v4. Migration 0005 creates `ai_decision_log` for R3 v4.
- Past chats on AGI Suite: api-server holds state in **memory** — `let r3Metrics`, `let activeUsers`, `let totalSubscribers`. The bug fixes were SSE broadcast logic, not database persistence.
- RHOS bash scripts: read each other's stdout, emit decisions to stdout. No DB driver mentioned in any past inspection.

**Expert inference (very high confidence, ~98%):** AGI Suite has **zero persistent state of its own**. It is a read-side projection over R3 v4's data:
1. `apps/api-server` polls R3 v4 endpoints for metrics every ~30s.
2. Holds the result in memory.
3. Broadcasts via SSE to `apps/r3-agi`.

If the api-server crashes and restarts, no data is lost — it just re-fetches. RHOS likewise: it computes a decision and forgets it.

**Open verification:**
```bash
cd ~/Agi-Suite
grep -rE '(drizzle|pg|postgres|sqlite|mongo|redis)' --include='package.json' . 2>/dev/null
grep -rE 'CREATE TABLE|INSERT INTO|UPDATE.*SET' --include='*.{sh,ts,js}' . 2>/dev/null | head
```

If those are empty (or only mention RHOS keywords by coincidence), the inference holds.

**Mastery-level recommendation:**

The lack of persistent state in AGI Suite is *good* architecture (separation of concerns, no double source of truth, easy to rebuild). But **RHOS not logging its decisions is the single highest-leverage gap in the system.**

Why: RHOS makes ALLOW/BLOCK decisions on a privileged subsystem (per Q3). When something breaks — and `|| true` swallowing failures means things will silently break — there is no audit trail to retrospectively analyze. You can't answer "what did RHOS decide last Tuesday at 3am?" because RHOS doesn't remember.

Add an append-only RHOS decision log. Minimum viable v0:

```bash
# In policy-engine-v1.sh, append to a JSONL file on every decision
LOG_FILE="${HOME}/Agi-Suite/var/rhos-decisions.jsonl"
mkdir -p "$(dirname "$LOG_FILE")"

# After computing decision and risk:
printf '{"ts":"%s","decision":"%s","risk":%s,"disk_status":"%s","health_status":"%s","engine_version":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
  "$DECISION" \
  "$RISK" \
  "$DISK_STATUS" \
  "$HEALTH_STATUS" \
  "v1" \
  >> "$LOG_FILE"
```

Cost: 30 minutes. Value:
- Audit trail (the agent-OS PRD §5 event log, in v0.1 form)
- Retrospective debugging
- Foundation for the `replay-engine-v1.sh` you already have but can't exercise (nothing to replay over)
- A real-world dataset to test the hash-chained event log on, when you build it

Note this is JSONL on local disk, not a database. That's deliberate: SQLite would also work but the simplest atomic append is `>>`. If you later want WORM-style integrity per the agent OS PRD §5.6, the upgrade path is straightforward (chain hashes per record, store on object-locked storage).

**Working answer for the gap analysis:** AGI Suite has no DB; that's fine. RHOS has no decision log; that's not fine. Adding the latter is v0.1 of the event-log retrofit.

### Summary table for the four questions

| Q | Inference | Confidence | Mastery recommendation |
|---|---|---|---|
| Q1: r3agent.py touches AGI Suite? | *Capable of* touching it (SSH on Penguin = full home-dir access). Whether it currently does is policy-friction. | High | Restrict via `command=`-bound SSH key or dedicated low-priv user; egress-restrict; rotate Telegram bot token if ever in git |
| Q2: LLM-driven autonomous component in AGI Suite? | No. RHOS is the closest thing; it's deterministic bash. | ~95% | Either rename ("ops-suite", "rhos-console") or document the aspiration in a README; don't pitch as agentic |
| Q3: install-policy-engine.sh = systemd as root? | Probably yes. Treat as root regardless of verification result. | ~80% systemd, ~70% root | Fix the signal-integrity bug *first*. Structural: status line + non-zero exit on FAIL; default decision = BLOCK on no parseable status |
| Q4: AGI Suite writes to a DB? | No. Pure read-from-R3v4 + in-memory. | ~98% | Add a JSONL decision log to RHOS — 30-min v0 of the agent-OS event log |

---

## Part 3 — Gap Analysis: Autonomous Agent OS PRD ↔ AGI Suite

This compares the agent OS PRD (v1.0, written earlier in this conversation) against AGI Suite as it actually exists. Per PRD section, this names what AGI Suite has, what's missing, and what to do.

### 3.1 Architecture mapping

The agent OS PRD describes a system that AGI Suite is **embryonically**. The mapping:

| Agent OS PRD concept | AGI Suite analog (today) | State |
|---|---|---|
| Event log (§5) | None — RHOS forgets every decision | Missing entirely |
| Capability system (§6) | None — bash scripts run with whatever the invoker has | Missing entirely |
| Sandboxed execution (§7) | None — RHOS scripts run on host directly | Missing entirely |
| Tool layer (§8) | `tools/` directory; bash scripts; no manifests, no schemas, no version pinning | Primitive; tool-shaped, not tool-spec'd |
| Model router (§9) | N/A — no LLM in AGI Suite | N/A |
| Memory (§10) | None — no event log to project from | Missing entirely |
| Swarm (§11) | N/A — single-process RHOS | N/A |
| Evolution (§12) | None | N/A — and shouldn't be added until much later |
| Verification (§13) | None — bash with `|| true` is approximately the opposite | Missing |
| Observability (§14) | api-server + SSE shows R3 v4 metrics; RHOS decisions are not observed | Partial — wrong subject |
| Deployment (§15) | Single Penguin machine; pm2 for api-server + Vite; possibly systemd for RHOS | Single-node; fine for current stage |

This isn't a bad starting point. **RHOS is structurally event-shaped already** — health/disk signals come in, decisions go out, with named subsystems (causal-engine, enforcement-kernel, repair-planner, replay-engine, transaction-kernel) that map almost 1:1 to the agent OS PRD's components. It's just implemented in bash without any of the discipline.

The work to bring it under the PRD is real but it's *naming and rigor*, not architectural redesign.

### 3.2 Gap detail by PRD section

**§5 Event log.** Missing. RHOS makes decisions and forgets them. No replay possible despite `replay-engine-v1.sh` existing. **Highest leverage to fix.**

**§6 Capability system.** Missing. RHOS scripts called by `bash <path>` from `policy-engine-v1.sh`. If RHOS is root (Q3), the called scripts inherit root. No `CAP_TOOL:disk_read` style gate. **Add only after event log exists** (capability decisions should themselves be events).

**§7 Sandbox.** Missing. RHOS scripts execute on the host. Disk-governor reads `/var/log/...` directly. No isolation. **Lower priority** — the scripts are local, the inputs are local file paths, the threat surface is small until r3agent.py expands the vocabulary.

**§8 Tool layer.** The `tools/` directory is *literally* the tool layer in shape. Missing: manifest, schemas, signed images, version pinning, output classification. **Add a single `tools/manifest.yaml`** as v0: each tool's id, version, input description, output description, required privilege. This is documentation as much as enforcement; it surfaces what RHOS *expects* its tools to do, which then makes the friction-vs-barrier audit (per security PRD §6.3) tractable.

**§9 Model router.** N/A today. If/when an LLM-driven layer is added, the PRD §9 applies in full.

**§10 Memory.** Missing — and depends on §5.

**§13 Verification.** The structural bug in `policy-engine-v1.sh` (`|| true` swallowing failures) is exactly the kind of thing the verification layer is meant to prevent. **Fix the bug first**, then the verification scope makes sense ("we now have a tested invariant: empty signal → BLOCK").

**§14 Observability.** The api-server SSE channel observes R3 v4 metrics. **It does not observe RHOS.** Wiring RHOS decisions into the SSE feed is straightforward once decisions are logged (§5):

```
RHOS decision → JSONL append → file watcher / tail → api-server reads → SSE broadcast → frontend
```

This gives you a real-time RHOS console for ~1–2 hours of work after the JSONL log exists.

### 3.3 Threat-model implications under the agent OS PRD §3

The agent OS PRD assumes a Mythos-class adversary. Apply that lens to AGI Suite as it stands:

| Threat | AGI Suite exposure |
|---|---|
| Capability theft | Telegram bot token = effective shell on Penguin (Q1). High exposure. |
| Tool-output injection | Bash inputs can carry crafted log lines that disk-governor parses. The signal-integrity bug means crafted inputs could affect policy decisions. Low-medium exposure today (only local data sources); high if AGI Suite ever ingests external signals. |
| Sandbox escape | Not applicable — there is no sandbox. RHOS just runs on host. The "sandbox" failure mode here is actually "RHOS runs as root and decides ALLOW because health signals broke." |
| Memory poisoning | N/A — no memory. |
| Supply chain | The `tools/rhos/*.sh` scripts have no signing, no integrity check. A modified script wouldn't be detected. Mode 100644 in git means git history is your only audit. Medium exposure. |
| Self-modification | N/A — no evolution loop. |
| LLM provider compromise | N/A — no LLM. |
| Insider | Single-developer system; "insider" = you. Out of practical threat model except for git-history token leaks. |
| Event log integrity violation | N/A — no event log to violate. |

The biggest live threat is **Q1's unbounded SSH bridge**. The biggest structural threat is **Q3's `|| true` signal-swallow under privilege**. Everything else is theoretical until the agent layer arrives.

---

## Part 4 — Prioritized Retrofit Plan

Ordered by leverage (value/cost). Each item: cost, what it buys, what enables next.

### P0 — Fix the signal-integrity bug in RHOS
**Cost:** 1–2 hours.
**What it buys:** Removes a fail-open failure mode on a possibly-privileged subsystem. This is not a refactor; it's a correctness fix.
**Spec:**
- `disk-governor-core-v2.1.sh` (and `root-health-check` if revived): emit structured status line; non-zero exit on `FAIL`. Empty output is a bug, not a state.
- `policy-engine-v1.sh`: check exit code first; parse status line; default to `BLOCK` on no parseable status; remove `|| true`.
- Regression test: rig data sources to fail; assert decision != `ALLOW`.
- Decision and inputs both written to JSONL log (P1's foundation, free at this step).
**Enables:** Trustworthy P1 onwards.

### P1 — Append-only RHOS decision log (JSONL)
**Cost:** 30 minutes (after P0 since the decision-and-inputs format is now structured).
**What it buys:** The agent OS PRD §5 event log, in v0.1 form. Audit trail. Retrospective debugging. Substrate for everything else.
**Spec:**
- `~/Agi-Suite/var/rhos-decisions.jsonl`, append-only.
- One record per RHOS run: `{ts, decision, risk, disk_status, health_status, engine_version}`.
- Log rotation (logrotate or weekly self-rotate); never delete (gzip + archive).
**Enables:** P2, P3, P4.

### P2 — Wire RHOS decisions into api-server SSE
**Cost:** 1–2 hours.
**What it buys:** Real-time RHOS console in the AGI Suite frontend. The api-server is now observability for what it claims to be (RHOS), not just for upstream R3 v4 metrics.
**Spec:**
- `apps/api-server` adds a `tail -F` watcher on `rhos-decisions.jsonl`.
- New SSE channel: `/rhos/stream`.
- `apps/r3-agi` adds a "Policy decisions" panel.
**Enables:** Catching the next signal-integrity-style bug visually before it cascades.

### P3 — Constrain r3agent.py's SSH session
**Cost:** 15 minutes (key + `command=`) to 2 hours (dedicated user + egress restrict).
**What it buys:** Telegram bot compromise no longer = full Penguin shell. Capability bound, even if coarse.
**Spec:** See Q1 mastery recommendation.
**Enables:** Safe to expand r3agent.py's task vocabulary later.

### P4 — Tool manifest for `tools/`
**Cost:** 2–3 hours.
**What it buys:** Documents what each tool needs and produces; surfaces friction-vs-barrier audit; foundation for capability gating.
**Spec:**
- `tools/manifest.yaml`: per-tool id, version, input schema, output schema, required privilege, exit-code semantics.
- Pre-commit hook: any tool added without a manifest entry fails CI.
- Inventory pass: every existing `tools/*.sh` and `tools/rhos/*.sh` gets a manifest entry, even if minimal.
**Enables:** Capability layer can name what it's gating.

### P5 — Hash-chain the JSONL log
**Cost:** 1 hour.
**What it buys:** Tamper-evidence. Per-record `prev_hash` + per-day Merkle root. Agent OS PRD §5.6 in v0.1 form.
**Spec:**
- Each JSONL record gains `prev_hash` (sha256 of prior record's canonical encoding) and `record_hash` (sha256 of own encoding).
- Daily cron: compute Merkle root of the day's records; sign with a local key; store separately.
- Verification script: walk the chain; report any break.
**Enables:** P6.

### P6 — Capability tokens for RHOS subsystem entry points
**Cost:** Several days. Real engineering work.
**What it buys:** Real §6 capability layer. Requires tokens for `disk-read`, `enforcement-kernel-write`, etc.
**Spec:** Macaroon-shape (per agent OS PRD §6.2), but in bash + a small helper binary or Python; macaroon libraries exist for both.
**Enables:** Safe to add an LLM-driven decision layer later (which will need capabilities).
**Don't do this until P0–P5 are stable.** Capability layer on a system that still fails open on signal loss is theatre.

### What's *not* in the retrofit plan, on purpose

- **Sandbox (§7).** RHOS doesn't run untrusted code; it runs your bash scripts. The threat model doesn't justify gVisor here. Revisit if/when an LLM-driven layer ingests external tool outputs.
- **Multi-agent / swarm (§11).** RHOS is single-process. No reason to add coordination.
- **Evolution loop (§12).** Self-modification on this substrate would amplify the existing `|| true` failure mode. Don't.
- **Tool synthesis (§12.9 / agent-OS v6).** Same reason. Even further away.
- **Multi-provider model routing (§9.3).** No model in the loop today.

### Dependency graph

```
P0 (fix signal bug)
  └── P1 (JSONL decision log)
        ├── P2 (SSE wire)
        ├── P5 (hash chain)
        │     └── P6 (capability tokens)
        └── P4 (tool manifest)
              └── P6 (capability tokens)

P3 (SSH constrain) — independent, do whenever
```

P0 → P1 is the critical path. After P1 you have audit. After P0+P1 the system is materially safer.

### What to do this week

If only one thing: **P0**. It's a correctness fix, not a feature; it eliminates a known fail-open path; it's the prerequisite for trusting any retrofit on top.

If three things: **P0, P1, P3.** Two hours, thirty minutes, fifteen minutes. After this week the Telegram bridge has a barrier, RHOS has audit, and the signal bug is dead. Everything else can wait.

---

## Part 5 — Cross-Reference Matrix

For traceability across this report and prior PRDs in the conversation:

| Topic | This report | Security PRD | Agent OS PRD | R3v4 PRD v4.1 |
|---|---|---|---|---|
| Friction vs barrier (signal-integrity bug) | Q3 / P0 | §6.3 | §3.2 | — |
| Capability bounding (SSH, tools) | Q1 / P3, P6 | §6 | §6 | — |
| Append-only event log | Q4 / P1 | — | §5 | — |
| Tool manifest | P4 | §8 (image SBOM) | §8 | — |
| Hash chain integrity | P5 | §12.2 | §5.6 | — |
| N-day SLA on dependencies | — | §6.5 | applies to all repos | (referenced via `mythos-security-triage` skill) |
| MVP Item 4 wiring (`aiMix.router`) | F5 | — | — | §8.4, §13.1, §15 |
| Migration 0005 status | F8, F9 | — | — | §0, §17, §18.6 |

---

*End of report.*
