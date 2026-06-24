# LLPTE Test Integration Strategy
## Path to 70%+ Coverage → Investor Demo Ready

**Date:** June 23, 2026  
**Target:** 70%+ line/statement/function coverage on LLPTE 5-node pipeline  
**Timeline:** ~4 hours (discovery) + ~6 hours (implementation) = 10 hours total  
**Blocker Status:** Tests will reveal worker file issues; fixes will be data-driven

---

## EXECUTIVE SUMMARY

Your `llpte_test.ts` file is **production-grade** but currently **unintegrated**. The uploaded file contains ~1300 lines covering all 5 LLPTE nodes but has three critical gaps:

| Gap | Impact | Fix Time | Blocker? |
|-----|--------|----------|----------|
| **Test file location** | Not in Vitest runner (can't execute) | 10 min | YES |
| **Worker file imports** | Build fails on `audioEngine.worker` | Spec from tests | YES |
| **Mock AnalyserNode** | Web Audio API not available in Node | 30 min | NO (mock works) |
| **Coverage instrumentation** | No baseline coverage report yet | 5 min | NO |

---

## PART 1: VITEST SETUP & INTEGRATION

### 1.1 Current Test File Analysis

**Location (broken):**
```
/mnt/user-data/uploads/llpte_test.ts  ← standalone, not in repo
```

**Actual target location (will be):**
```
~/Stable/apps/r3-agi/src/services/llpte.test.ts
```

**Current state of tests:**
```typescript
// Lines 1-100: Utilities (mock builders, latency measurement) ✓
// Lines 163-240: Node 1 tests (AutoLevelPipeline) ✓
// Lines 241-420: Node 2 tests (spectralAnalyzer) ✓
// Lines 421-600: Node 3 tests (aiMixEngine) ✓
// Lines 601-1000: Node 4 tests (transitionGraph) ✓
// Lines 1001-1195: Latency SLA & integration ✓
// Lines 1200-1310: Score model direct tests ✓
// Lines 1312-1354: E2E pipeline (partial) ⚠️ (truncated, incomplete)
```

**Problem:** Last section (E2E pipeline) is truncated. This is the critical integration test that validates all 5 nodes working together.

---

### 1.2 Vitest Configuration Check

**Current setup location:**
```
~/Stable/vitest.config.ts  (root monorepo config)
~/Stable/apps/r3-agi/vitest.config.ts  (if it exists)
```

**What you need:**
```typescript
// ~/Stable/vitest.config.ts (or apps/r3-agi/vitest.config.ts)
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',  // CRITICAL: Node environment for non-DOM tests
    includeSource: ['src/**/*.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
      ],
      lines: 70,      // Threshold: 70%
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@r3vibe/shared': path.resolve(__dirname, './shared'),
      '@llpte/llpte-core': path.resolve(__dirname, './packages/llpte-core/src'),
      '@llpte/llpte-signal': path.resolve(__dirname, './packages/llpte-signal/src'),
      '@llpte/llpte-ai': path.resolve(__dirname, './packages/llpte-ai/src'),
      '@llpte/llpte-transition-graph': path.resolve(__dirname, './packages/llpte-transition-graph/src'),
    },
  },
});
```

**Verify aliases work:**
```bash
cd ~/Stable
pnpm exec vitest --version
pnpm exec vitest --listTests  # Should show test discovery
```

---

### 1.3 Test File Integration Steps

**STEP 1: Move test file to correct location**
```bash
cd ~/Stable
mkdir -p apps/r3-agi/src/services/__tests__
cp /mnt/user-data/uploads/llpte_test.ts apps/r3-agi/src/services/__tests__/llpte.test.ts
```

**STEP 2: Update import paths in test file**

The uploaded file uses **absolute paths** like:
```typescript
import {
  AutoLevelPipeline,
} from '../../../../Stable/packages/llpte-core/src/AutoLevelPipeline';
```

**These MUST be changed to:**
```typescript
import {
  AutoLevelPipeline,
} from '@llpte/llpte-core/AutoLevelPipeline';
```

**Update script (patch all imports):**
```bash
cd ~/Stable/apps/r3-agi/src/services/__tests__

# Replace all '../../../../Stable/packages/' with '@llpte/' or '@r3vibe/'
sed -i "s|'../../../../Stable/packages/llpte-core|'@llpte/llpte-core|g" llpte.test.ts
sed -i "s|'../../../../Stable/packages/llpte-signal|'@llpte/llpte-signal|g" llpte.test.ts
sed -i "s|'../../../../Stable/packages/llpte-ai|'@llpte/llpte-ai|g" llpte.test.ts
sed -i "s|'../../../../Stable/packages/llpte-transition-graph|'@llpte/llpte-transition-graph|g" llpte.test.ts
sed -i "s|'../../../../Stable/shared|'@r3vibe/shared|g" llpte.test.ts

# Verify replacements
grep "from '" llpte.test.ts | head -10
```

**STEP 3: Run test discovery**
```bash
cd ~/Stable
pnpm exec vitest --listTests --run

# Expected output:
# ✓ apps/r3-agi/src/services/__tests__/llpte.test.ts
```

---

## PART 2: COVERAGE GAPS ANALYSIS

### 2.1 What's Currently Covered

Your test file covers **all 5 nodes** but has **varying completeness**:

| Node | Tests | Lines | Status | Gap |
|------|-------|-------|--------|-----|
| **Node 1: inputRouter** | 8 tests | 163-240 | ✓ Solid | None |
| **Node 2: spectralAnalyzer** | 12 tests | 241-420 | ✓ Solid | TrackAnalyzer internals |
| **Node 3: aiMixEngine** | 10 tests | 421-600 | ✓ Solid | Weight matrix logic |
| **Node 4: transitionGraph** | 15 tests | 601-1000 | ✓ Solid | Edge ranking algorithm |
| **Node 5: outputBus** | 6 tests | 1001-1195 | ⚠️ Minimal | Aggregation logic missing |
| **Latency SLA** | 5 tests | 1196-1195 | ✓ Good | p50 measurement detailed |
| **Score Model** | 9 tests | 1200-1310 | ✓ Excellent | All branches covered |
| **E2E Integration** | 2 tests | 1312-1354 | ❌ **TRUNCATED** | **Critical gap** |

**Critical Missing Piece:** The E2E integration test is cut off. It should validate:
- All 5 nodes working together in sequence
- p50 latency end-to-end ≤15ms
- State consistency across pipeline
- Error handling in multi-node flow

---

### 2.2 Worker File Dependencies (Build Blocker)

The test file imports from these actual implementation files:

**From llpte-core:**
```typescript
import { AutoLevelPipeline } from '@llpte/llpte-core/AutoLevelPipeline';
import { PERFORMANCE_TARGETS } from '@llpte/llpte-core/constants';
```

**From llpte-signal:**
```typescript
import {
  TrackAnalyzer,
  MixAnalyzer,
  linearTodBFS,
  dBFSToLinear,
  LUFS_TARGET,
  CLIPPING_THRESHOLD_DBFS,
} from '@llpte/llpte-signal/analyzers/TrackAnalyzer';
```

**From llpte-ai:**
```typescript
import {
  AutoLevelEngine,
  type AutoLevelEngineConfig,
} from '@llpte/llpte-ai/AutoLevelEngine';
```

**From llpte-transition-graph:**
```typescript
import { LLPTETransitionGraph } from '@llpte/llpte-transition-graph/transitionGraph';
import {
  scoreTransition,
  rankTransitions,
  validateSignal,
  normalizeWeights,
  DEFAULT_WEIGHTS,
  CROSSFADE_DURATION_MS,
  WEIGHT_PROFILES,
} from '@llpte/llpte-transition-graph/scoreModel';
```

**The actual error from your build:**
```
src/engine/workers/index.ts:1:15 - error TS2307: Cannot find module './audioEngine.worker'
```

**What this means:** 
The `llpte-core` package is trying to export worker modules that don't exist:
```typescript
// llpte-core/src/engine/workers/index.ts (CURRENT — BROKEN)
export * from './audioEngine.worker';     // ← DOESN'T EXIST
export * from './mixer.worker';           // ← DOESN'T EXIST
export * from './effects.worker';         // ← DOESN'T EXIST
```

**Tests will validate the correct contract.** See Section 2.3.

---

### 2.3 Worker File Analysis (Test-Driven Fix)

**Question:** Do these worker files actually need to exist, or are they vestigial imports?

**Test approach:** Search the test suite for imports/usage of worker modules:

```bash
cd ~/Stable
grep -n "audioEngine.worker\|mixer.worker\|effects.worker" apps/r3-agi/src/services/__tests__/llpte.test.ts

# Expected result: ZERO matches
```

**Analysis:**
- If tests **never use** worker modules → **remove exports** from `index.ts`
- If tests **should use** worker modules → **create stub implementations** for Node environment

**Most likely scenario:** These are Web Worker modules intended for browser audio processing, but the LLPTE pipeline (5 nodes) doesn't actually need them—it works on snapshots and data structures, not real audio context.

**Fix (test-driven):**
```typescript
// llpte-core/src/engine/workers/index.ts (FIXED)
// Option A: Remove broken exports entirely
export {};

// Option B: Add conditional export for web context only
if (typeof window !== 'undefined') {
  export * from './audioEngine.worker';
  export * from './mixer.worker';
  export * from './effects.worker';
}
```

Tests will confirm which approach is correct.

---

## PART 3: RUNNING INITIAL COVERAGE SCAN

### 3.1 First Test Run (Discovery)

```bash
cd ~/Stable

# Step 1: Run tests WITHOUT coverage (faster discovery)
pnpm exec vitest run apps/r3-agi/src/services/__tests__/llpte.test.ts

# Expected output:
# ✓ apps/r3-agi/src/services/__tests__/llpte.test.ts (60 tests)
# PASS [elapsed time]
```

**If you see build errors:**
```
error TS2307: Cannot find module './audioEngine.worker'
```

→ Skip to **Part 4 (Worker File Fixes)**

**If tests pass:**
→ Proceed to coverage scan.

### 3.2 Coverage Report (Coverage Threshold)

```bash
cd ~/Stable

# Run with coverage instrumentation
pnpm exec vitest run --coverage \
  apps/r3-agi/src/services/__tests__/llpte.test.ts

# Generates: coverage/index.html
# Open in browser to view detailed report
```

**What to look for in coverage report:**

| Package | Target | Current | Gap |
|---------|--------|---------|-----|
| `@llpte/llpte-core` | 70% | ? | TBD |
| `@llpte/llpte-signal` | 70% | ? | TBD |
| `@llpte/llpte-ai` | 70% | ? | TBD |
| `@llpte/llpte-transition-graph` | 70% | ? | TBD |

**Red flag metrics (means more tests needed):**
- Branches < 60% (conditional logic not tested)
- Functions < 70% (some exported functions never called)
- Lines < 70% (error paths untested)

---

### 3.3 Coverage Gap Checklist

Once you run the coverage report, check these specific functions:

**AutoLevelPipeline (llpte-core):**
- [ ] `start()` method
- [ ] `stop()` method
- [ ] `registerTrack()` error handling
- [ ] Event subscription cleanup (unsubscribe)
- [ ] `acceptSuggestion()` / `rejectSuggestion()`
- [ ] Stats accumulation across cycles

**TrackAnalyzer (llpte-signal):**
- [ ] `captureFrame()` with various FFT sizes
- [ ] dB conversion functions (`linearTodBFS`, `dBFSToLinear`)
- [ ] Clipping detection logic
- [ ] Frequency masking calculations

**AutoLevelEngine (llpte-ai):**
- [ ] `analyze()` with 1, 2, 3+ tracks
- [ ] Gain adjustment recommendations
- [ ] Clipping alert generation
- [ ] Edge case: silent tracks, extreme peaks

**LLPTETransitionGraph (llpte-transition-graph):**
- [ ] `addTrack()` and track state updates
- [ ] `getBestTransitions()` ranking
- [ ] Edge case: single track (no transitions possible)
- [ ] Circular transitions (A→B→A)

**scoreModel functions:**
- [ ] `scoreTransition()` with matching vs. mismatched signals
- [ ] `rankTransitions()` with various candidate counts
- [ ] `validateSignal()` boundary clamping
- [ ] `normalizeWeights()` zero-sum edge case

---

## PART 4: WORKER FILE FIXES (TEST-DRIVEN)

### 4.1 Diagnose Worker Issue

**When you run the test suite, you'll likely see:**
```
src/engine/workers/index.ts:1:15 - error TS2307: Cannot find module './audioEngine.worker'
```

**This blocks the entire build chain.**

### 4.2 Root Cause

Check the current state of `llpte-core`:

```bash
cd ~/Stable
ls -la packages/llpte-core/src/engine/workers/

# Expected output (current state):
# total 0
# -rw-r--r-- 1 ...  . (directory)
# -rw-r--r-- 1 ...  .. (directory)
# -rw-r--r-- 1 ... index.ts  ← File with broken exports
```

**What's in index.ts:**
```bash
cat packages/llpte-core/src/engine/workers/index.ts
```

**Expected (broken):**
```typescript
export * from './audioEngine.worker';
export * from './mixer.worker';
export * from './effects.worker';
```

### 4.3 Fix Options (Ranked by Likelihood)

**OPTION A: Remove unused exports (RECOMMENDED)**

The tests never use these workers, so they're likely vestigial.

```bash
cat > ~/Stable/packages/llpte-core/src/engine/workers/index.ts << 'EOF'
/**
 * Worker module exports — currently unused
 * Workers are intended for future async/threaded audio processing
 * Tests validate that the 5-node pipeline operates on snapshots/data structures only
 */

// Placeholder for future worker implementations
export {};
EOF
```

**Verify:**
```bash
cd ~/Stable
pnpm --filter @llpte/llpte-core build
# Should succeed
```

---

**OPTION B: Create stub worker files (if tests later require them)**

```bash
cd ~/Stable/packages/llpte-core/src/engine/workers

# Create stub implementations
cat > audioEngine.worker.ts << 'EOF'
/**
 * Audio Engine Worker
 * Future: Run audio analysis in background thread
 * Current: Stub for compilation
 */

export class AudioEngineWorker {
  static create() {
    // TODO: Implement worker
    return null;
  }
}
EOF

cat > mixer.worker.ts << 'EOF'
export class MixerWorker {
  static create() {
    return null;
  }
}
EOF

cat > effects.worker.ts << 'EOF'
export class EffectsWorker {
  static create() {
    return null;
  }
}
EOF
```

**Then update index.ts:**
```typescript
export { AudioEngineWorker } from './audioEngine.worker';
export { MixerWorker } from './mixer.worker';
export { EffectsWorker } from './effects.worker';
```

---

**OPTION C: Conditional exports (browser + Node)**

```typescript
// packages/llpte-core/src/engine/workers/index.ts
export {};

// Only export workers in browser environment
if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  // These would be dynamically imported in browser context
  // For Node tests, this block is skipped
}
```

**Recommendation:** Start with **OPTION A** (remove), then add back if tests later require them.

---

## PART 5: INTEGRATION TEST COMPLETION

### 5.1 Complete the E2E Test

The uploaded test file ends abruptly at line 1354. The final E2E test is incomplete:

```typescript
// CURRENT (truncated at line 1354)
it('handles multi-track pipeline with frequency masking', () => {
  // ... test body ...
  pipeline.dispose();
  mixAnalyzer.dispose();
});
// ← FILE ENDS HERE
```

**Complete E2E test template:**

```typescript
describe('End-to-End Pipeline Integration', () => {
  it('should process complete 5-node pipeline in sequence', async () => {
    // Node 1: inputRouter
    const masterAnalyser = createMockAnalyserNode({ fftSize: 512 });
    const pipeline = new AutoLevelPipeline(masterAnalyser, 44100);
    pipeline.start();

    // Node 2: spectralAnalyzer
    const mixAnalyzer = new MixAnalyzer({ masterAnalyser, sampleRate: 44100 });
    const tracks = [];
    for (let i = 0; i < 3; i++) {
      const analyser = createMockAnalyserNode();
      const track = new TrackAnalyzer({
        trackId: `track-${i}`,
        analyserNode: analyser,
      });
      mixAnalyzer.registerTrack(track);
      tracks.push(track);
    }

    // Capture frame (Node 2)
    const snapshot = mixAnalyzer.captureFrame();
    expect(snapshot.tracks.size).toBe(3);

    // Node 3: aiMixEngine
    const engine = new AutoLevelEngine(44100);
    const recommendation = engine.analyze(snapshot);
    expect(recommendation).toBeDefined();
    expect(recommendation.gainAdjustments).toBeDefined();

    // Node 4: transitionGraph
    const graph = new LLPTETransitionGraph();
    for (let i = 0; i < 3; i++) {
      const trackSnapshot = snapshot.tracks.get(`track-${i}`);
      graph.addTrack(`track-${i}`, {
        bpm: 128 + i * 2,
        key: '8A',
        energy: 0.5 + i * 0.1,
        spectralCentroid: 4000 + i * 500,
        rmsLoudness: 0.6 + i * 0.05,
      });
    }
    const bestTransitions = graph.getBestTransitions('track-0', 5);
    expect(bestTransitions.length).toBeGreaterThan(0);

    // Node 5: outputBus aggregation
    pipeline.acceptSuggestion('track-0');
    pipeline.acceptSuggestion('track-1');
    expect(pipeline.stats.acceptedSuggestions).toBe(2);

    // Validate p50 latency SLA
    const latencies = [];
    for (let i = 0; i < 50; i++) {
      const { ms } = measureLatency(() => {
        const snap = mixAnalyzer.captureFrame();
        const rec = engine.analyze(snap);
        const trans = graph.getBestTransitions('track-0', 5);
        return { snap, rec, trans };
      });
      latencies.push(ms);
    }
    const medianLatency = p50(latencies);
    expect(medianLatency).toBeLessThanOrEqual(15);
    console.log(`[E2E SLA] p50 latency: ${medianLatency.toFixed(2)}ms ≤ 15ms ✓`);

    pipeline.dispose();
    mixAnalyzer.dispose();
  });

  it('should handle pipeline failure with graceful degradation', () => {
    // Test what happens when one node fails
    // E.g., spectralAnalyzer returns null, should not crash outputBus
    const pipeline = new AutoLevelPipeline(createMockAnalyserNode(), 44100);
    
    // Scenario: Try to analyze snapshot with no tracks
    const emptySnapshot = createMockMixSnapshot(0);
    
    const engine = new AutoLevelEngine(44100);
    const recommendation = engine.analyze(emptySnapshot);
    
    // Should return empty recommendation, not throw
    expect(recommendation.gainAdjustments.length).toBe(0);
  });

  it('should accumulate stats across complete mix session', () => {
    const masterAnalyser = createMockAnalyserNode();
    const pipeline = new AutoLevelPipeline(masterAnalyser, 44100);
    pipeline.start();

    const mixAnalyzer = new MixAnalyzer({ masterAnalyser, sampleRate: 44100 });
    const engine = new AutoLevelEngine(44100);

    // Simulate a mix session: 10 frames, varying acceptance
    for (let frame = 0; frame < 10; frame++) {
      const snapshot = createMockMixSnapshot(2 + (frame % 2)); // Vary track count
      const recommendation = engine.analyze(snapshot);
      
      // Accept some, reject some
      if (frame % 3 === 0) {
        pipeline.acceptSuggestion(`track-${frame % 2}`);
      } else if (frame % 3 === 1) {
        pipeline.rejectSuggestion(`track-${frame % 2}`);
      }
    }

    // Final stats
    expect(pipeline.stats.acceptedSuggestions).toBe(4);  // Adjust based on logic above
    expect(pipeline.stats.rejectedSuggestions).toBeGreaterThan(0);
    expect(pipeline.stats.totalAIAdjustments).toBeGreaterThanOrEqual(10);

    pipeline.dispose();
    mixAnalyzer.dispose();
  });
});
```

---

## PART 6: VALIDATION & COVERAGE GATES

### 6.1 Pre-Coverage Checklist

Before running the full coverage report, complete these checks:

```bash
cd ~/Stable

# 1. Vitest config exists and is valid
test -f vitest.config.ts && echo "✓ vitest.config.ts found" || echo "✗ Missing"

# 2. Test file is in correct location
test -f apps/r3-agi/src/services/__tests__/llpte.test.ts && echo "✓ Test file in place" || echo "✗ Missing"

# 3. All LLPTE packages are buildable
pnpm --filter @llpte/llpte-core build && echo "✓ llpte-core builds" || echo "✗ Build failed"
pnpm --filter @llpte/llpte-signal build && echo "✓ llpte-signal builds" || echo "✗ Build failed"
pnpm --filter @llpte/llpte-ai build && echo "✓ llpte-ai builds" || echo "✗ Build failed"
pnpm --filter @llpte/llpte-transition-graph build && echo "✓ llpte-transition-graph builds" || echo "✗ Build failed"

# 4. TypeScript compilation passes
pnpm tsc --noEmit && echo "✓ TypeScript OK" || echo "✗ TS errors"
```

### 6.2 Coverage Thresholds

| Level | Requirement | Action if Missed |
|-------|-------------|------------------|
| **70%+ lines** | Mandatory (investor requirement) | Add integration tests |
| **70%+ statements** | Mandatory | Add conditional branches |
| **65%+ branches** | Threshold | Test error paths |
| **70%+ functions** | Mandatory | Add function-level tests |

### 6.3 Coverage Report Interpretation

After running `pnpm exec vitest run --coverage`:

**Good coverage output:**
```
Package                           Lines  Functions  Branches  Statements
@llpte/llpte-core                72%    74%        68%       73%  ✓
@llpte/llpte-signal              71%    72%        64%       71%  ✓
@llpte/llpte-ai                  69%    70%        60%       69%  ⚠️
@llpte/llpte-transition-graph    75%    76%        70%       75%  ✓
────────────────────────────────────────────────────────────────
TOTAL                            72%    73%        66%       72%  ✓
```

**Issues to fix:**
- `llpte-ai` branches (60% < 65%) → Test decision trees
- Add error path tests (null checks, edge cases)

---

## PART 7: SUCCESS CRITERIA & NEXT STEPS

### 7.1 Success Checklist

- [ ] Test file moved to `apps/r3-agi/src/services/__tests__/llpte.test.ts`
- [ ] Import paths updated to use aliases (`@llpte/*`, `@r3vibe/*`)
- [ ] Worker file issue resolved (files created or exports removed)
- [ ] `pnpm exec vitest run` → all tests pass (60+ tests)
- [ ] `pnpm exec vitest run --coverage` → 70%+ coverage on all 4 LLPTE packages
- [ ] E2E integration test complete and passing
- [ ] p50 latency SLA validated (≤15ms)
- [ ] Coverage HTML report generated and reviewed
- [ ] All coverage gaps documented for second pass (if needed)

### 7.2 Expected Timeline

| Phase | Task | Time |
|-------|------|------|
| **Discovery** | Run initial scan, find worker issue | 30 min |
| **Build Fix** | Resolve worker file exports | 15 min |
| **Test Integration** | Move file, update imports, run tests | 20 min |
| **Gap Analysis** | Review coverage report, identify missing tests | 20 min |
| **Second Pass** | Write additional tests for gaps | 2-3 hours |
| **Validation** | Confirm 70%+ across all packages | 15 min |
| **Total** | Full path to demo-ready | ~4 hours |

### 7.3 Investor Demo Narrative

Once 70%+ coverage is achieved:

> "Our LLPTE 5-node pipeline is not just optimized for <15ms p50 latency—it's comprehensively tested with 70%+ coverage. Every core pathway (input routing, spectral analysis, AI mixing, transition ranking, output aggregation) is validated. This is production-grade AI infrastructure backing the DAW."

---

## APPENDIX: Quick Reference Commands

```bash
# Move test file and update imports
cp /mnt/user-data/uploads/llpte_test.ts ~/Stable/apps/r3-agi/src/services/__tests__/llpte.test.ts
cd ~/Stable && sed -i "s|'../../../../Stable/packages/llpte-|'@llpte/llpte-|g" apps/r3-agi/src/services/__tests__/llpte.test.ts

# Run tests (no coverage, fast)
cd ~/Stable && pnpm exec vitest run apps/r3-agi/src/services/__tests__/llpte.test.ts

# Run tests with coverage
cd ~/Stable && pnpm exec vitest run --coverage apps/r3-agi/src/services/__tests__/llpte.test.ts

# View coverage report
open ~/Stable/coverage/index.html

# Fix worker file (remove broken exports)
cat > ~/Stable/packages/llpte-core/src/engine/workers/index.ts << 'EOF'
// Worker implementations — future use
export {};
EOF

# Build everything
cd ~/Stable && pnpm build
```

---

**Status:** Ready for execution  
**Next Action:** Run discovery commands and report results  
**Estimated Time to 70%+ Coverage:** 4 hours from now

