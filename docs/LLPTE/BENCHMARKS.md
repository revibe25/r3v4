# LLPTE Performance Benchmarks

**Engine:** Low-Latency Predictive Transition Engine  
**Version:** 0.1.0  
**Date:** 2026-03-05  
**Environment:** Node.js via `tsx`, Linux (Debian), x86_64  
**Harness:** `packages/llpte-core/benchmarks/latency.ts`

---

## Benchmark 1 — Single Pair Scoring Latency

Measures the time to score one A→B transition across all five weighted
dimensions (harmonic, energy, spectral, phase, tempo).

| Metric       | Result       | Target  | Status |
|--------------|-------------|---------|--------|
| Iterations   | 10,000       | —       | —      |
| Mean latency | **0.0050 ms** | < 1 ms  | ✅ PASS |
| Median       | 0.0019 ms    | —       | —      |
| p99          | 0.0308 ms    | —       | —      |

**Interpretation:** A single five-dimensional score completes in ~5 µs mean,
200× faster than the 1 ms real-time budget. The p99 of 0.03 ms confirms
there are no outlier spikes that would cause perceptible latency in a live set.

---

## Benchmark 2 — Graph Ranking Latency (Library Scale)

Measures time to score and rank all tracks in a library against a source track,
returning a sorted candidate list.

| Library Size | Mean      | p99       | Target        | Status |
|-------------|-----------|-----------|---------------|--------|
| 10 tracks   | 0.0532 ms | 0.9105 ms | < 10 ms       | ✅ PASS |
| 50 tracks   | 0.1925 ms | 1.1403 ms | < 10 ms       | ✅ PASS |
| 100 tracks  | 0.2042 ms | 1.0697 ms | < 10 ms       | ✅ PASS |
| 500 tracks  | 0.9286 ms | 7.1105 ms | < 50 ms       | ✅ PASS |
| 1000 tracks | 1.5528 ms | 4.5818 ms | < 50 ms       | ✅ PASS |

**Interpretation:** At 1,000 tracks — a professional library — mean ranking
latency is 1.55 ms. This is well within the inter-beat window of any BPM range
above 40 BPM, confirming the engine can re-rank an entire library mid-track
without any perceptible delay.

---

## Benchmark 3 — Weight Profile Scoring Overhead

Measures scoring latency across all four shipped weight profiles to confirm
that profile switching introduces no meaningful overhead.

| Profile    | Mean      | p99       |
|------------|-----------|-----------|
| default    | 0.0021 ms | 0.0077 ms |
| harmonic   | 0.0013 ms | 0.0029 ms |
| energetic  | 0.0015 ms | 0.0036 ms |
| broadcast  | 0.0015 ms | 0.0037 ms |

**Interpretation:** All profiles score within 2.1 µs mean. Profile switching
is effectively zero-cost at runtime, enabling dynamic weight adjustment between
tracks or sets with no latency penalty.

---

## Benchmark 4 — End-to-End: Score → Crossfade Parameters

Measures the full path from raw library scan through to a concrete crossfade
recommendation (`suggestedCrossfadeDurationMs`, `suggestedCurve`).

| Metric       | Result        | Target   | Status  |
|--------------|--------------|----------|---------|
| Library size | 20 tracks     | —        | —       |
| Iterations   | 5,000         | —        | —       |
| Mean latency | **0.0217 ms** | < 10 ms  | ✅ PASS |
| Median       | 0.0177 ms     | —        | —       |
| p99          | 0.0672 ms     | —        | —       |

**Interpretation:** The complete decision pipeline — score all candidates,
rank them, and return actionable crossfade parameters — completes in 21.7 µs
mean. This is 460× under the 10 ms real-time budget.

---

## Summary

| Benchmark                        | Mean       | p99        | Budget   | Margin   |
|----------------------------------|-----------|-----------|----------|----------|
| Single pair scoring              | 0.0050 ms | 0.0308 ms | 1 ms     | 200×     |
| Graph ranking (1000 tracks)      | 1.5528 ms | 4.5818 ms | 50 ms    | 32×      |
| End-to-end (score → params)      | 0.0217 ms | 0.0672 ms | 10 ms    | 460×     |

All targets pass with significant margin. The engine is demonstrably suitable
for real-time live performance use.

---

## Reproducing These Results
```bash
cd "/home/r3/Stable/R3 v4"
npx tsx packages/llpte-core/benchmarks/latency.ts
```
