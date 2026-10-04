# PHASE 3 EXECUTION PLAN
## R3 v4 AudioGraph Measurement Engine Corrective Patch

**Status:** ✅ READY FOR EXECUTION  
**Estimated Time:** 30–45 minutes  
**Risk Level:** MINIMAL (single method, single consumer, full test coverage)  
**Date:** 2026-10-03  
**Prepared for:** Earnest (handle V4)

---

## PRE-FLIGHT CHECKLIST

Before you start, verify these conditions:

- [ ] Git repository clean (no uncommitted changes)
- [ ] Branch: `db/migration-baseline` (or your current dev branch)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm/pnpm available (`npm --version` or `pnpm --version`)
- [ ] `/home/cloud/Projects/r3v4/` directory accessible
- [ ] `PHASE_3_MEASUREMENT_PATCH.ts` file exists
- [ ] Read access to `client/src/audio/core/audio-graph.ts`
- [ ] Text editor open (VS Code, nano, vim, etc.)

**If any are missing:** Stop here and set up before proceeding.

---

## PHASE 3 PATCH OVERVIEW

**What:** Apply 7 corrective patches to the AudioGraph measurement engine  
**Where:** `client/src/audio/core/audio-graph.ts`  
**Why:** Fix 7 critical defects in loudness, correlation, stereo width, and gain reduction measurement  
**Standards:** ITU-R BS.1770-5, EBU R128, Web Audio API  

### The 7 Patches (Summary)

| # | Issue | Fix | Standards |
|---|-------|-----|-----------|
| 1 | Stereo LUFS −3 dB offset | `/ N` not `/2N` | ITU-R BS.1770-5 §3.2 |
| 2 | LUFS timing documentation | Document animation-frame approach | Phase 2 Choice B |
| 3 | Broken correlation | Pearson energy-normalized | Web Audio API |
| 4 | Undefined stereo width | `1 - \|correlation\|` | Phase 2 Choice C |
| 5 | False true-peak claim | Documented approximation | AnalyserNode spec |
| 6 | Fabricated gain reduction | Use `limiter.reduction` API | Web Audio API |
| 7 | Dead code | Remove `correlationHold` variable | Code quality |

---

## STEP-BY-STEP EXECUTION

### Step 1: Create Backup (2 minutes)

```bash
cd /home/cloud/Projects/r3v4
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp client/src/audio/core/audio-graph.ts backups/audio-graph.ts.pre-phase3-${TIMESTAMP}.bak
echo "✅ Backup created"
```

- [ ] Backup file created

### Step 2: Open the Patch File (1 minute)

```bash
# Review the complete patch
less PHASE_3_MEASUREMENT_PATCH.ts
```

- [ ] Patch file reviewed
- [ ] Understood all 7 patches

### Step 3: Locate Target Method (2 minutes)

```bash
# Find computeMeter() method
grep -n "computeMeter()" client/src/audio/core/audio-graph.ts
```

- [ ] Located method (around line 360–380)

### Step 4: Apply Patch 1 — Stereo Energy Weighting (5 minutes)

**Location:** ~line 444–450 in `computeMeter()`  
**Find:**
```typescript
const rmsK = Math.sqrt((sumSqKL + sumSqKR) / (2 * this.kLeftBuffer.length));
```

**Replace with:**
```typescript
// ✅ PATCH 1: Stereo energy weighting (fix −3 dB offset)
// ITU-R BS.1770-5 §3.2: Σ(L² + R²) / N (not /2N)
const rmsK = Math.sqrt((sumSqKL + sumSqKR) / this.kLeftBuffer.length);
```

- [ ] Patch 1 applied

### Step 5: Apply Patch 2 — LUFS Timing Documentation (1 minute)

**Location:** Lines ~98–146  
**Action:** Add documentation comment (no code change)

```typescript
// ✅ PATCH 2: LUFS block timing (Phase 2 Choice B)
// Animation-frame approach kept; real bug was stereo weighting above
```

- [ ] Patch 2 applied (documentation only)

### Step 6: Apply Patch 3 — Correlation Normalization (5 minutes)

**Location:** ~line 189–206  
**Find:**
```typescript
const correlation = dotProduct / (peakL * peakR);
```

**Replace with:**
```typescript
// ✅ PATCH 3: Phase correlation (Pearson energy-normalized)
let dotProduct = 0;
for (let i = 0; i < this.leftBuffer.length; i++) {
  dotProduct += this.leftBuffer[i] * this.rightBuffer[i];
}
const sumL2 = sumSqL;
const sumR2 = sumSqR;
const denominator = Math.sqrt(sumL2 * sumR2);
const correlation =
  denominator > 1e-10
    ? Math.min(1, Math.max(-1, dotProduct / denominator))
    : 0;
```

- [ ] Patch 3 applied

### Step 7: Apply Patch 4 — Stereo Width Metric (2 minutes)

**Location:** ~line 208–213  
**Find:**
```typescript
const stereoWidth = correlation >= 0 
  ? 1 - correlation
  : -correlation;
```

**Replace with:**
```typescript
// ✅ PATCH 4: Stereo width (1 - |correlation|)
const stereoWidth = 1 - Math.abs(correlation);
```

- [ ] Patch 4 applied

### Step 8: Apply Patch 5 — True-Peak Metering (3 minutes)

**Location:** ~line 220–229  
**Find:**
```typescript
const truePeak = Math.max(peakL, peakR) * 1.05;
```

**Replace with:**
```typescript
// ✅ PATCH 5: True-peak (simplified, documented approximation)
const truePeak = Math.max(peakL, peakR);
this.truePeakHold = Math.max(this.truePeakHold * 0.99, truePeak);
// AnalyserNode 2048-sample window = 46ms @ 44.1kHz (sufficient for UI)
```

- [ ] Patch 5 applied

### Step 9: Apply Patch 6 — Gain Reduction API (3 minutes)

**Location:** ~line 231–237  
**Find:**
```typescript
const gainReductionDb = 20 * Math.log10(1 - (peak > 0.01 ? peak / 1.0 : 0));
```

**Replace with:**
```typescript
// ✅ PATCH 6: Gain reduction (use limiter.reduction API)
const gainReductionDb = this.limiter.reduction;
// Hardware-backed, not inferred
```

- [ ] Patch 6 applied

### Step 10: Apply Patch 7 — Remove Dead State (2 minutes)

**Find:**
```bash
grep -n "private correlationHold = 0" client/src/audio/core/audio-graph.ts
```

**Action:** Delete that line entirely

```bash
# Verify removal
grep "correlationHold" client/src/audio/core/audio-graph.ts
# Should return: (no results)
```

- [ ] Patch 7 applied

### Step 11: Save & TypeScript Check (3 minutes)

```bash
# Save file in your editor (Ctrl+S)

# Run TypeScript check
npm run typecheck

# Expected: 0 errors
```

- [ ] TypeScript check passed

### Step 12: Run Test Suite (5 minutes)

```bash
# Run tests
npm run test -- client/src/audio/core

# Expected: 5+ tests pass
```

- [ ] Tests passed

### Step 13: Browser Integration Test (10 minutes)

```bash
# Start dev server
npm run dev

# Open: http://localhost:5173
# Play audio and verify:
```

- [ ] Page loads without errors
- [ ] Audio playback works
- [ ] LUFS readout updates
- [ ] Correlation shows ~1.0 for mono
- [ ] No NaN or Infinity values

### Step 14: Git Commit (2 minutes)

```bash
git add client/src/audio/core/audio-graph.ts
git commit -m "fix: Phase 3 measurement engine corrective patch

Fixes 7 critical defects:
1. Stereo energy weighting (−3 dB offset)
2. LUFS block timing documentation
3. Correlation normalization (Pearson)
4. Stereo width metric (1 - |correlation|)
5. True-peak metering (simplified approximation)
6. Gain reduction (limiter.reduction API)
7. Dead state cleanup

Standards: ITU-R BS.1770-5, EBU R128
Regression risk: MINIMAL
Test coverage: 5+ Vitest cases"
```

- [ ] Commit pushed

---

## SUCCESS CRITERIA

✅ **Phase 3 Complete When:**

1. All 7 patches applied
2. TypeScript compiles: 0 errors
3. Tests pass: 5+ suites
4. Browser test: no console errors, readouts update
5. Git commit: pushed with message
6. Backup file: exists in backups/

---

## VERIFICATION SUMMARY

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Create backup | 2 min | ☐ |
| 2 | Review patch | 1 min | ☐ |
| 3 | Locate method | 2 min | ☐ |
| 4 | Patch 1 | 5 min | ☐ |
| 5 | Patch 2 | 1 min | ☐ |
| 6 | Patch 3 | 5 min | ☐ |
| 7 | Patch 4 | 2 min | ☐ |
| 8 | Patch 5 | 3 min | ☐ |
| 9 | Patch 6 | 3 min | ☐ |
| 10 | Patch 7 | 2 min | ☐ |
| 11 | Save & TS check | 3 min | ☐ |
| 12 | Run tests | 5 min | ☐ |
| 13 | Browser test | 10 min | ☐ |
| 14 | Git commit | 2 min | ☐ |
| **TOTAL** | | **47 min** | |

---

## REFERENCE FILES

In this directory:
- `PHASE3_QUICK_REFERENCE.txt` — copy-paste code snippets
- `PHASE3_CHECKLIST.txt` — printable checklist
- `PHASE3_SUMMARY.md` — before/after metrics
- `PHASE_3_MEASUREMENT_PATCH.ts` — complete patch + test suite

---

**Print this page. Check off each step. You've got this. 🚀**
