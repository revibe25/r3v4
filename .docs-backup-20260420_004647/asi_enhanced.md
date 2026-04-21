# patch.md — R3 v4 TypeScript Error Resolution
# Wire.txt Protocol | PRD v4.0 §18.6 Hygiene Upgrade Path
# Prepared: 2026-04-09 | TSC entering: 15 errors | TSC exit target: 0 errors
# LLPTE contract: intact throughout | Hygiene score: unregressed

---

## FILES READ

```
packages/llpte-ai/src/AutoLevelEngine.ts             (full, 301 lines)
packages/llpte-execution/src/AutoLevelExecutor.ts    (full, 236 lines)
packages/llpte-signal/src/analyzers/TrackAnalyzer.ts (full, 133 lines)
packages/llpte-signal/src/types/signal.types.ts      (full, 20 lines)
server/services/audio-analysis.ts                    (full, 71 lines)
tsconfig.json (root)                                 (51 lines)
packages/llpte-ai/tsconfig.json                      (19 lines)
packages/llpte-execution/tsconfig.json               (19 lines)
packages/llpte-signal/tsconfig.json                  (34 lines)
packages/llpte-core/tsconfig.json                    (31 lines)
client/tsconfig.json                                 (44 lines)
server/tsconfig.json                                 (35 lines)
```

**NOT YET READ — required before Step 5:**
```
client/src/pages/DAW.tsx lines 1820–1875
```

---

## FINDINGS

**15 errors. 5 distinct bugs. Every root cause confirmed.**

Zero errors is the PRD-mandated baseline (§18.6, CLAUDE.md Hygiene Baseline).
Execution order below is dependency-ordered — do not reorder.

| Bug | File | Errors | Type | Clears after step |
|-----|------|--------|------|-------------------|
| BUG 4 | llpte-signal (shared not built) | 3 | TS6305 | Step 2 |
| BUG 5 | server/audio-analysis.ts | 1 | TS2307 | Step 2 |
| BUG 3 | llpte-execution/tsconfig.json | 2 | TS6059, TS6307 | Step 3 |
| BUG 1 | AutoLevelEngine.ts:155 | 6 | TS1005 (+ cascade) | Step 4 |
| BUG 2 | client/DAW.tsx:1840–1870 | 3 | TS17014, TS1381, TS1005 | Step 5 |
| **Total** | | **15** | | |

Running error tally is tracked explicitly at each step gate below.

---

### BUG 4 — llpte-signal — TS6305 ×3 (shared package not built)

**Root cause:** `llpte-signal/tsconfig.json` correctly references `../../shared`
via project references. TS6305 fires because `shared/dist/` does not yet exist.
TypeScript composite mode requires referenced packages to have built `.d.ts` output
before consumers compile. No source change required — build order only.

**PRD §8.5:** llpte-signal is node 2 of the LLPTE pipeline
(`inputRouter → spectralAnalyzer → ...`). Until shared builds, the spectral analysis
layer — FFT/RMS/LUFS — is entirely dark. The `AutoLevelSuggestion`, `EQSuggestion`,
and `CompressionSuggestion` types in `shared/auto-level.types` flow through every
downstream LLPTE layer. BUG 4 is the prerequisite for BUG 3 and BUG 5.

---

### BUG 5 — server/audio-analysis.ts — TS2307 ×1 (@llpte/llpte-signal not found)

**Root cause:** `import { analyzeAudio } from '@llpte/llpte-signal'` cannot resolve
because llpte-signal has never been compiled. Downstream consequence of BUG 4.
Once shared builds and llpte-signal compiles, the pnpm workspace symlink at
`server/node_modules/@llpte/llpte-signal` resolves.

**CLAUDE.md exemption boundary:** The `let AudioContext: any` on line 18 carries a
legitimate `eslint-disable` (node-web-audio-api ships no `.d.ts`). That exemption is
not in scope here. The TS2307 on the `@llpte/llpte-signal` import line is a separate,
unexempted error.

**If TS2307 persists after Step 2** — workspace symlink is stale. Deterministic fix:
```bash
cd ~/R3v4
pnpm install --frozen-lockfile
pnpm --filter server exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0 — if not zero, stop and investigate before Step 3
```

---

### BUG 3 — llpte-execution/tsconfig.json — TS6059 ×1 + TS6307 ×1

**Root cause:** `"composite": true` + `"rootDir": "./src"` conflict. TypeScript
composite mode requires every input file to live inside `rootDir`.
`AutoLevelExecutor.ts` imports `../../../shared/auto-level.types` — outside `src/`.
Violation. Correct pattern: `outDir` only, no `rootDir`, project reference to
`../../shared` — same as the working llpte-signal tsconfig.

**PRD §8.5 / CLAUDE.md LLPTE contract:** llpte-execution is `outputBus` — node 5
of 5. A compile error here silences the entire output stage.

**Anchor verification:**
```bash
grep -n "rootDir" packages/llpte-execution/tsconfig.json
# Expected: 15:    "rootDir": "./src"  — exactly once
```

**Dependency:** shared/dist must exist before this fix. Execute after Step 2.

---

### BUG 1 — AutoLevelEngine.ts:155 — TS1005 ×2 + cascade ×4 (const in object literal)

**Root cause:** A `const` declaration was pasted inside the `eq: EQSuggestion`
object literal during a mid-edit. TypeScript cannot parse the object remainder.

```typescript
// AutoLevelEngine.ts lines 147–156 — BROKEN
const eq: EQSuggestion = {
  trackId:    targetTrackId,
  band:       worstBand.eqBand,
  frequency:  centerHz,
  gain:       -3.5,
  q:          1.2,
  reason:     `Cut ${centerHz.toFixed(0)} Hz on ${targetTrackId} to reduce masking`,
  confidence: 0.65,
  const SUGGESTION_THRESHOLD = 0.40;   // ← LINE 155: ILLEGAL
};
```

**Fix:** Remove from object. Hoist to module scope after the import block.

**PRD §8.5 / CLAUDE.md:** `SUGGESTION_THRESHOLD = 0.40` is the numeric expression
of the `confidence gate for suggestion ≥ 0.40` contract. At module scope it is named,
inspectable, and protected from regression. Inside a suggestion object it is invisible
to the confidence check logic.

**Cascade path:** llpte-ai (2 errors) → llpte-core (2) → client (2) = 6 errors
from one line. Fix llpte-ai and all 6 clear.

**Anchor verification:**
```bash
grep -n "const SUGGESTION_THRESHOLD" packages/llpte-ai/src/AutoLevelEngine.ts
# Expected: 155:        const SUGGESTION_THRESHOLD = 0.40;  — exactly once
```

---

### BUG 2 — client/src/pages/DAW.tsx:1840–1870 — TS17014 + TS1381 + TS1005

**Root cause:** JSX fragment `<>` opened at line 1840, never closed. Stray `}` at
line 1868 breaks expression context. Line 1870 expects `</` that isn't there.
Origin: SessionChip / SessionSummaryPanel wiring last session (CLAUDE.md: lines 1782
and 1750).

**PRD §15 MVP Definition — Investor Checklist:** Both components are non-negotiable for demo. This bug
prevents the client from compiling — demo fails entirely. SessionChip and the Time Savings panel are
listed as investor-checklist items ("✅ Wired") — a compile error here regresses a verified gate.

**⛔ BLOCKED:**
```bash
cat -n ~/R3v4/client/src/pages/DAW.tsx | sed -n '1820,1875p'
```
Paste output. Fix is written from it.

---

## CHANGES — Execution Plan

One fix → one TSC gate → error count confirmed → next fix.
Never advance on a non-zero count.

---

### Step 1 — Read DAW.tsx (read-only, no TSC gate)

```bash
cat -n ~/R3v4/client/src/pages/DAW.tsx | sed -n '1820,1875p'
```

Paste the output. Step 5 is written from it.

**Errors remaining: 16 (unchanged — read only)**

---

### Step 2 — Fix BUG 4 + BUG 5: Build shared, verify server

```bash
cd ~/R3v4
pnpm --filter shared exec tsc --build
ls ~/R3v4/shared/dist/   # must exist — do not continue if empty or missing
```

TSC gate — llpte-signal:
```bash
pnpm --filter llpte-signal exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS6305 ×3 gone)
```

TSC gate — server:
```bash
pnpm --filter server exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS2307 ×1 gone)
```

If server TS2307 persists:
```bash
pnpm install --frozen-lockfile
pnpm --filter server exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  — if not, stop here before Step 3
```

**Errors remaining after Step 2: 11** *(15 − 3 − 1 = 11)*

---

### Step 3 — Fix BUG 3: llpte-execution/tsconfig.json

Backup:
```bash
cp ~/R3v4/packages/llpte-execution/tsconfig.json \
   ~/R3v4/packages/llpte-execution/tsconfig.json.bak-$(date +%Y%m%d_%H%M%S)
```

Anchor check:
```bash
grep -n "rootDir" ~/R3v4/packages/llpte-execution/tsconfig.json
# Expected: exactly one line
```

Patch script (`patch_llpte_execution_tsconfig.py`):
```python
import json, sys, shutil, subprocess
from pathlib import Path
from datetime import datetime

FILE = Path("packages/llpte-execution/tsconfig.json")
src  = FILE.read_text()
cfg  = json.loads(src)

assert cfg["compilerOptions"].get("rootDir") == "./src", \
    f"rootDir not './src' — got: {cfg['compilerOptions'].get('rootDir')!r}"
assert "references" not in cfg, \
    "references already present — check for prior partial fix before proceeding"

del cfg["compilerOptions"]["rootDir"]
cfg["references"] = [{"path": "../../shared"}]

out = json.dumps(cfg, indent=2) + "\n"

if "--apply" not in sys.argv:
    print("DRY RUN:\n", out)
    sys.exit(0)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2(FILE, FILE.with_suffix(f".json.bak-{ts}"))
FILE.write_text(out)
print(f"Written: {FILE}")

tsc = subprocess.run(
    ["pnpm", "--filter", "llpte-execution", "exec", "tsc", "--noEmit", "--pretty", "false"],
    capture_output=True, text=True
)
print(tsc.stdout, tsc.stderr)

if tsc.returncode != 0:
    print("TSC FAILED — restoring backup")
    shutil.copy2(FILE.with_suffix(f".json.bak-{ts}"), FILE)
    sys.exit(1)

sys.exit(0)
```

```bash
python3 patch_llpte_execution_tsconfig.py          # dry-run
python3 patch_llpte_execution_tsconfig.py --apply  # apply if dry-run clean
```

TSC gate:
```bash
pnpm --filter llpte-execution exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS6059 ×1 + TS6307 ×1 gone)
```

**Errors remaining after Step 3: 9** *(11 − 2 = 9)*

---

### Step 4 — Fix BUG 1: AutoLevelEngine.ts:155

Backup:
```bash
cp ~/R3v4/packages/llpte-ai/src/AutoLevelEngine.ts \
   ~/R3v4/packages/llpte-ai/src/AutoLevelEngine.ts.bak-$(date +%Y%m%d_%H%M%S)
```

Anchor check:
```bash
grep -n "const SUGGESTION_THRESHOLD" ~/R3v4/packages/llpte-ai/src/AutoLevelEngine.ts
# Expected: exactly one line at 155
```

**Why indentation-agnostic:** The first patch attempt used a hardcoded multi-line
anchor with 2-space indentation. The actual file uses 8-space indentation. The script
below matches by `line.strip()` — whitespace is irrelevant.

Patch script (`patch_autolevel_syntax.py`):
```python
import sys, shutil, subprocess
from pathlib import Path
from datetime import datetime

FILE = Path("packages/llpte-ai/src/AutoLevelEngine.ts")
lines = FILE.read_text().splitlines(keepends=True)

BAD_STRIPPED  = "const SUGGESTION_THRESHOLD = 0.40;"
IMPORT_PREFIX = "import "
HOIST = (
    "\n// Confidence gate — suggestions below this threshold are not surfaced.\n"
    "// CLAUDE.md LLPTE contract: gate for suggestion ≥ 0.40 (PRD §8.5)\n"
    "const SUGGESTION_THRESHOLD = 0.40;\n"
)

# 1. Find the bad line
bad_idx = next((i for i, ln in enumerate(lines) if ln.strip() == BAD_STRIPPED), None)
assert bad_idx is not None, f"'{BAD_STRIPPED}' not found — re-read file before patching"

# 2. Confirm it is inside the EQSuggestion object (context check)
context = "".join(lines[max(0, bad_idx - 20):bad_idx])
assert "const eq: EQSuggestion = {" in context, \
    "Bad line not inside EQSuggestion object — context mismatch, refusing"

# 3. Confirm exactly one occurrence
count = sum(1 for ln in lines if ln.strip() == BAD_STRIPPED)
assert count == 1, f"Expected 1 occurrence, found {count} — refusing"

# 4. Find last import line for hoist insertion point
last_import = next(
    (i for i in range(len(lines) - 1, -1, -1) if lines[i].strip().startswith(IMPORT_PREFIX)),
    None
)
assert last_import is not None, "No import statements found — unexpected file structure"

# 5. Build patched lines
patched = [ln for i, ln in enumerate(lines) if i != bad_idx]
insert_at = last_import + 1  # valid: bad_idx > last_import, removal hasn't shifted this range
patched.insert(insert_at, HOIST)
result = "".join(patched)

# 6. Post-patch assertions
assert BAD_STRIPPED not in result, "Bad line still present after patch — refusing to write"
assert "const SUGGESTION_THRESHOLD = 0.40;" in result, "Hoisted const not found in output"

if "--apply" not in sys.argv:
    print("DRY RUN — no write")
    print(f"Lines: {len(lines)} → {len(result.splitlines())}")
    print(f"Removed from line {bad_idx + 1}: {lines[bad_idx].rstrip()}")
    print(f"Hoisted after import block at line ~{insert_at + 1}:\n{HOIST}")
    sys.exit(0)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy2(FILE, FILE.with_suffix(f".ts.bak-{ts}"))
FILE.write_text(result)
print(f"Written: {FILE} ({len(result.splitlines())} lines)")

tsc = subprocess.run(
    ["pnpm", "--filter", "llpte-ai", "exec", "tsc", "--noEmit", "--pretty", "false"],
    capture_output=True, text=True
)
print(tsc.stdout, tsc.stderr)

if tsc.returncode != 0:
    print("TSC FAILED — restoring backup")
    shutil.copy2(FILE.with_suffix(f".ts.bak-{ts}"), FILE)
    sys.exit(1)

sys.exit(0)
```

```bash
python3 patch_autolevel_syntax.py          # dry-run
python3 patch_autolevel_syntax.py --apply  # apply if dry-run clean
```

TSC gate:
```bash
pnpm --filter llpte-ai exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS1005 ×2 direct + TS1005 ×2 llpte-core + TS1005 ×2 client cascade gone)
```

Confirm no duplication with `minimumConfidence` config:
```bash
grep -n "minimumConfidence\|SUGGESTION_THRESHOLD" \
    packages/llpte-ai/src/AutoLevelEngine.ts
# Expected: SUGGESTION_THRESHOLD once at module scope — no duplicate
```

**Errors remaining after Step 4: 3** *(9 − 6 = 3 — only DAW.tsx JSX errors remain)*

---

### Step 5 — Fix BUG 2: DAW.tsx JSX fragment (BLOCKED — paste Step 1 output first)

```bash
cat -n ~/R3v4/client/src/pages/DAW.tsx | sed -n '1820,1875p'
```

**Paste output. Fix is written from it.**

Once provided, the patch script will locate the unclosed `<>` at line 1840 by
stripped content match, resolve the stray `}` at line 1868, insert `</>` at the
correct depth determined from the pasted lines, verify the fragment wraps the
SessionChip / SessionSummaryPanel wiring region (CLAUDE.md: lines 1782 and 1750),
dry-run first, apply second, auto-restore on TSC failure.

TSC gate:
```bash
pnpm --filter client exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS17014 ×1 + TS1381 ×1 + TS1005 ×1 gone)
```

**Errors remaining after Step 5: 0**

---

### Step 6 — Final verification

```bash
cd ~/R3v4

# 1. Full repo — must be zero
pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Expected: 0

# 2. Hygiene audit — confirm score unregressed
python3 r3_hygiene.py

# 3. LLPTE confidence gates intact (PRD §8.5 / CLAUDE.md contract)
grep -n "SUGGESTION_THRESHOLD\|0\.40\|0\.65" packages/llpte-ai/src/AutoLevelEngine.ts
# Expected: SUGGESTION_THRESHOLD = 0.40 at module scope; confidence: 0.65 in eq object

# 4. shared/dist confirmed
ls ~/R3v4/shared/dist/*.d.ts | head -5

# 5. rootDir removed from llpte-execution
grep "rootDir" ~/R3v4/packages/llpte-execution/tsconfig.json
# Expected: no output

# 6. Backup cleanup
find ~/R3v4 \( -name "*.ts.bak-*" -o -name "*.json.bak-*" \) | sort
# Confirm list, then remove:
# find ~/R3v4 \( -name "*.ts.bak-*" -o -name "*.json.bak-*" \) -delete
```

---

## REMAINING AMBIGUITIES

True blockers only — items that prevent declaring this patch complete.

| # | Ambiguity | Status | Resolution |
|---|-----------|--------|------------|
| 1 | `client/src/pages/DAW.tsx` lines 1820–1875 not read | **BLOCKS Step 5** | Run Step 1 read command. Paste output. |
| 2 | BUG 5 server TS2307 may not self-heal if workspace symlink is stale | **Resolved inline** | Step 2 includes deterministic fallback: `pnpm install --frozen-lockfile`. No further ambiguity. |

---

## POST-PATCH VERIFICATION CHECKS

Run after Step 6. Not ambiguities — structural integrity confirmation only.

| Check | Command | Expected |
|-------|---------|----------|
| No SUGGESTION_THRESHOLD duplication | `grep -n "minimumConfidence\|SUGGESTION_THRESHOLD" packages/llpte-ai/src/AutoLevelEngine.ts` | One occurrence at module scope |
| TSC warnings are audit noise | `pnpm tsc --noEmit 2>&1 \| grep "warning TS"` | 0 real warnings |
| ai-mix tsconfig deferred correctly | `ls packages/ai-mix/` | No tsconfig.json — deferred to P4 per PRIORITIES.md |
| Hygiene score unregressed | `python3 r3_hygiene.py` | Phase scores same or better than baseline |
| Demo components render | Manual: load DAW, confirm SessionChip top nav + SessionSummaryPanel visible | Both present — PRD §15 |

---

## PRD GATES IMPACTED

| Gate | Requirement | Bug resolved |
|------|-------------|--------------|
| §0 Build State | TSC: 0 errors | All 5 bugs |
| §6 AI Auto-Leveling | Acceptance rate ≥65% — confidence gate must be at module scope | BUG 1 |
| §8.5 LLPTE Contract | Full pipeline compiles — all 5 nodes operational | BUG 3, BUG 4 |
| §18.6 Hygiene | TSC errors: 0 target | All 5 bugs |
| §15 MVP Checklist | Client compiles, SessionChip + SessionSummaryPanel render | BUG 2 |

---

## HARD GUARDS COMPLIANCE

| CLAUDE.md Guard | This patch |
|-----------------|-----------|
| No `any` | No new `any`. SUGGESTION_THRESHOLD hoist is `const number`. |
| No swallowed exceptions | All scripts `assert` pre-conditions + auto-restore on TSC failure |
| No write without read first | Step 1 read gate on DAW.tsx enforced. Scripts read file into `lines` before any mutation. |
| No patch without dry-run | All scripts gate on `--apply` flag |
| TSC zero after every change | Explicit `grep "error TS"` gate with running tally after Steps 2, 3, 4, 5, 6 |
| LLPTE pipeline contract intact | Node order unchanged. Confidence gates (0.40, 0.65) preserved at correct values and correct scope. |
