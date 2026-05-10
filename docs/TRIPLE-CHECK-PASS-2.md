# Triple-Check Pass 2 — R3v4 PRD v5.0.0 + SECURITY.md + SKILLS.md

**Date:** 2026-05-09
**Scope:** Second-pass cross-walk against `Mythos-Skills.pdf` (red.anthropic.com 2026-04-07, ed. 04-09), `R3v4_PRD_v5.pdf`, `script-fix.txt` audit transcript, and the lint output captured at run-end.
**Status of pass 1:** 10 findings produced, 0 wired.
**Status of this doc:** Pass 1 + Pass 2 wired into `wire_patches_v5_to_v5_1.py` where mechanically applicable; observations-only items listed at the bottom.

---

## Severity legend

- **CRIT** — silent CI/security bypass, or actively-blocking deploy gate
- **HIGH** — overdue Mythos-class deferral, blocking external beta
- **MEDIUM** — drift between docs, or runbook that won't run as written
- **LOW** — protocol-completeness or hygiene

---

## Pass-1 recap (10 items, fully wired below)

| ID    | Sev    | Where               | Patched in script |
|-------|--------|---------------------|-------------------|
| BUG-1 | CRIT   | PRD §7.2 step 5     | ✅ as `BUG-1a`     |
| BUG-2 | CRIT   | SECURITY.md C-02    | ✅ (best-guess anchor) |
| BUG-3 | CRIT   | SECURITY.md C-01    | ✅ (best-guess anchor) |
| BUG-4 | MED    | PRD §4.2            | ✅                |
| BUG-5 | MED    | SKILLS.md §5        | ✅ (best-guess anchor) |
| BUG-6 | MED    | PRD §3.1            | ✅                |
| BUG-7 | MED    | PRD §3.1 LLPTE pkgs | ❌ DEFERRED — needs `ls -d packages/llpte-*` on Kali; auto-replace would be a guess. WIRE protocol forbids guessing. |
| GAP-1 | HIGH   | SECURITY.md AUDIT GAP × 2 | ✅ (best-guess anchor) |
| GAP-2 | LOW    | SECURITY.md C-05    | ✅ (best-guess anchor) |
| GAP-3 | LOW    | SKILLS.md §10       | ✅ (best-guess anchor) |

---

## Pass-2 new findings

### TC2-1 · CRIT · PRD §7.2 gate-table row has identical BRE bug

**File:** PRD §7.2, table row labelled "Theme token audit"

**Original bug (BUG-1):** caught the broken grep in pipeline step 5. Pass 1 missed that the same broken grep also appears in the §7.2 gate-table row:

```
grep -rn bg-black|text-white|border-green client/src/
```

Same BRE-as-literal failure mode. If pipeline step 5 is fixed but the table row isn't, the §7.2 internal authority (table) still documents the broken syntax.

**Status:** Patched in `wire_patches_v5_to_v5_1.py` as `TC2-1`.

---

### TC2-2 · MEDIUM · PRD §7.6 verify command non-runnable as written

**File:** PRD §7.6 Railway Database — Migration Protocol

```js
const pool=new Pool(...);
```

The `(...)` is three literal periods, not pseudocode. Copy-paste runs and throws. Either it should read `new Pool({connectionString: process.env.DATABASE_URL})` or §7.6 should be explicit that the snippet is illustrative-only — but operational runbooks should default to runnable.

Compounding: §7.6's outer `node -e "..."` already has nested double-quoting; the inline `pool.query("SELECT...")` will close the outer string early on most shells. The whole snippet wants to be `python3` or `node -e $'...'` with proper escaping.

**Status:** `Pool({connectionString:process.env.DATABASE_URL})` patched as `TC2-2`. Outer shell-quoting issue (TC2-2-bonus below) **not** auto-patched — needs reflow rather than substring replace.

---

### TC2-3 · LOW · PRD §7.13 batch-workflow group list incomplete vs source

**File:** PRD §7.13 batch workflow, step 2

**Mythos-Skills.pdf (source) batch workflow step 2:**

> Group the deduped findings by surface (runtime / dev-build-supply-chain / dev-build-credential-pivot / dev-build-isolated / **test-only**).

**PRD §7.13 currently says:**

> • Group by surface: runtime / dev-build-supply-chain / dev-build-credential-pivot / dev-build-isolated.

`test-only` is dropped. When a CVE lands in a test-only dep (vitest, playwright, jsdom), §7.13 has no group for it — triagers either miscategorize as `dev-build-isolated` or invent ad-hoc. Add `test-only` for parity with source.

The §7.13 decision table also has no row for `test-only`; the closest is `Dev-build, isolated` which has different semantics (test-only never runs against attacker-influenced input by definition; isolated dev-build might).

**Status:** Group-list patched as `TC2-3`. Decision-table row addition is editorial and listed below as observation TC2-7.

---

## Pass-2 observations (NOT auto-patched — needs human judgment)

### TC2-4 · CRIT (operational) · 511 lint problems block §7.2 CI gate

**File:** captured at end of `script-fix.txt` (2026-05-09 run on Penguin)

```
✖ 511 problems (277 errors, 234 warnings)
ELIFECYCLE  Command failed with exit code 1.
```

Per PRD §7.2 lint gate: `pnpm eslint client/src --max-warnings 0 → Blocks merge to main`. The codebase is currently out of compliance with its own published policy. Either:

1. Fix the lint cluster (the dominant pattern is `import()` type annotations forbidden + `no-explicit-any` on stores — both fixable mechanically), **or**
2. Document an explicit time-boxed lint-debt deferral in SECURITY.md (the doc accepts non-security debt entries with the same owner/trigger fields), **or**
3. Reduce `--max-warnings 0` to a known floor as a temporary measure with a hard re-tighten date.

Doing none of those means `git push` blocks on every PR until cleared. This is a Lesson-5 unmanaged-finding shape — currently neither fixed nor formally deferred.

---

### TC2-5 · MEDIUM (security hygiene) · PRD §7.10 PAT-in-URL leaks via shell history

**File:** PRD §7.10 GitHub Authentication, Option A

```
git remote set-url origin https://USERNAME:PAT@github.com/Berryboy9/...
```

Persists the PAT in:

- `git remote -v` output (anyone with shell access reads it)
- `~/.bash_history` (rotation across years)
- `git config --get remote.origin.url`
- any future `set -x` debug session

Under Mythos Lesson 3, this is friction-class secret hygiene at best; under a model-assisted attacker who has any developer-machine foothold, the PAT leaks in seconds. Option B (`credential.helper store`) has the same problem (plaintext file). The barrier-class option is `gh auth login` (OS keychain) or a hardware-token-backed credential helper.

**Recommendation:** Demote Option A to a "last resort" footnote; promote `gh auth login` to the canonical recipe.

---

### TC2-6 · MEDIUM · SKILLS.md §13 root-causes BUG-2

**File:** SKILLS.md §13 (per script-fix.txt transcript)

```
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://...|' .env
```

This bash incantation is the **direct mechanism** by which the Vite dev-server CVE (C-02) becomes a credential-pivot finding rather than an isolated dev-build one (BUG-2). Fixing C-02 in SECURITY.md without fixing SKILLS.md §13 leaves the next developer to re-introduce the same surface.

**Recommendation:** Replace the `sed -i` recipe with a temporary shell export pattern that doesn't persist:

```sh
DATABASE_URL="postgresql://..." pnpm drizzle-kit migrate
# (set in subshell only — never written to .env on dev machines)
```

Add a hard rule to SKILLS.md: **production DATABASE_URL never lands in `.env` on dev machines.**

---

### TC2-7 · LOW · §7.13 decision table missing `test-only` row

Companion to TC2-3. Decision table currently maps 4 dev-build surfaces; needs a 5th row:

| Surface  | Severity | Status | Action |
|----------|----------|--------|--------|
| Test-only (vitest/playwright/jsdom; never runs against attacker input, never in CI secret scope) | Any | Any | Document in SECURITY.md as batch entry per component, pin, quarterly review. |

Editorial — left for human pen.

---

### TC2-8 · LOW · `tokens/colors.ts` produced by asi-upgrade-fixed.sh violates PRD §4.1

**File:** `script-fix.txt` lines 432-452 — the script's design-system tokens

```ts
export const colors = {
  bg:     { base: '#06070a', elevated: '#0f1117', panel: '#141824', floating: '#1a2030' },
  accent: { neon: '#7c5cff', cyan: '#00e5ff', pink: '#ff4fd8', lime: '#9dff00' },
  timeline: { track: '#151924', active: '#232c42', playhead: '#00f0ff' },
}
```

Cross-walk against PRD §4:

| Script value     | PRD §4 canonical                       | Status |
|------------------|---------------------------------------|--------|
| `#06070a` bg     | §4.1 `#000` / §4.2 T-object `#0a0a0a` | drift  |
| `#7c5cff` accent | §4.1 `--neon-lime #bfff00`            | hard NO — §4.1 "no random greens" / no random anything |
| `#9dff00` lime   | §4.2 T-object `#a3e635`               | drift  |
| `#ff4fd8` pink   | _no canonical_                         | hard NO |
| `#00e5ff` cyan   | _no canonical_                         | hard NO |

If `./asi-upgrade-fixed.sh --apply` lands this file, the next deploy fails §7.4 theme preflight. **Do not run with `APP_PKG=client` until the script's `colors.ts` is reconciled to §4.2.**

**Recommendation:** Edit `asi-upgrade-fixed.sh` to emit a `colors.ts` that mirrors §4.2 T-object exactly:

```ts
// auto-generated from PRD §4.2 T-object — keep in sync
export const colors = {
  bg:        '#0a0a0a',
  surface:   '#0d0d0d',
  border:    '#1c1c1c',
  border2:   '#2a2a2a',
  text:      '#e5e5e5',
  dim:       '#555',
  accent:    '#a3e635',
  accentDim: 'rgba(163,230,53,0.12)',
  rec:       '#ef4444',
  recDim:    'rgba(239,68,68,0.15)',
} as const
```

---

### TC2-9 · LOW · §7.13 SECURITY.md template `Mitigation class` field missing

**File:** PRD §7.13 SECURITY.md Deferred-Finding Template

The per-finding note format (sibling block) includes:

```
Mitigation class: <barrier / friction / none>
```

The deferred-finding template renders that as:

```
- **Interim control:** <barrier-class control named | friction-only, accepted risk because…>
```

That's adequate (interim control implies its class), but the per-finding note and the template name the same concept differently. Mythos-Skills.pdf has the same dual-naming. Not a bug, but worth aligning on review — pick one term, use it in both places.

---

### TC2-10 · BUG-7 follow-through · §3.2 pipeline boundary mismatch

When you reconcile §3.1 LLPTE package names against `ls -d packages/llpte-*` on Kali, also reconcile §3.2:

```
inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus
```

Per BUG-7, the actual packages are roughly: `llpte-core`, `llpte-adapters`, `llpte-signal`, `llpte-ai`, `llpte-transition-graph`, `llpte-execution`. There's no `inputRouter` package at all, and no `spectralAnalyzer` package — these are pipeline node names that aren't matched 1:1 to the package names. That's fine if the doc says so explicitly, but currently §3.2 reads as if pipeline nodes ↔ packages.

**Recommendation:** When fixing §3.1 per BUG-7, add a half-line to §3.2 clarifying whether pipeline nodes are package boundaries or named runtime stages within `llpte-execution`.

---

## Penguin warning (operational, not a finding)

The lint output and the `./asi-upgrade-fixed.sh` failure both came from `r3v@penguin:~/Stable$`. Per PRD §2 hard rule: **all dev on Kali only; Penguin and Termux are migration/transfer only.** Penguin runs Node 18.x — `pnpm add` from there resolves under 18.x and can produce a lockfile diverging from Kali (Node 22.x), which then fails the §7.2 frozen-lockfile gate.

If the patch script in this package or `./asi-upgrade-fixed.sh` runs on Penguin, **do not commit the resulting lockfile or `colors.ts`**. Cherry-pick scaffold output back to Kali, regenerate the lockfile there, then commit.

---

## What this pass deliberately does **not** cover

- Re-grading the 511 ESLint findings into structured runtime/dev-build buckets — out of scope here, would need access to actual files.
- Auditing the ws/collab.ts and session-metrics.service.ts source for the cross-user data-leakage risks called out in AUDIT GAP. Those are pre-external-beta blockers (per Lesson 5, now overdue) but live in code, not docs — paste those files for a separate audit pass.
- Rewriting `asi-upgrade-fixed.sh` to emit canonical-palette `colors.ts`. Listed as TC2-8 observation; mechanical fix but in a different file than this patch sweep.

---

## Apply order (recommended)

1. **On Kali, in `~/Stable`:** `python3 wire_patches_v5_to_v5_1.py` (dry-run). Confirm 6 PRD patches plan-applies; SECURITY/SKILLS may anchor-fail if file content drifted.
2. For any `anchor-fail` SECURITY/SKILLS patch, open the target, locate the section by the rationale in `--list`, manually adjust the anchor in this script, re-run `--only <ID>`.
3. `python3 wire_patches_v5_to_v5_1.py --apply` to write.
4. `pnpm tsc --noEmit && pnpm vitest run` (per WIRE).
5. `git diff` the three files; commit as: `docs: PRD v5.0.0 → v5.1.0 audit triple-check (10 findings + 3 pass-2)`
6. Manual: `ls -d packages/llpte-* > /tmp/llpte.txt && nvim PRD.md` for BUG-7 + TC2-10.
7. Manual editorial: TC2-7 (decision-table row), TC2-9 (term alignment).
8. Open issue or SECURITY.md entry for TC2-4 (lint debt) so it's managed, not unmanaged.
9. Open issue for TC2-5 (PAT hygiene) and TC2-6 (SKILLS.md `sed -i` recipe).
10. Block `./asi-upgrade-fixed.sh --apply` until TC2-8 (palette violation) is fixed in the script.
