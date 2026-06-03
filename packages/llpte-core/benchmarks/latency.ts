/**
 * @llpte/llpte-core — Latency & Performance Benchmark Harness
 *
 * Measures the three critical performance dimensions of LLPTE:
 *   1. Transition scoring latency   (single pair, µs range)
 *   2. Graph ranking latency        (N-track library, ms range)
 *   3. End-to-end execution latency (score → crossfade params, ms)
 *
 * Run:  npx tsx packages/llpte-core/benchmarks/latency.ts
 *
 * Results feed directly into:
 *   docs/LLPTE/BENCHMARKS.md
 *   docs/LLPTE/LLPTE_WHITEPAPER.md  (Section 5 — Performance Metrics)
 */

import {
  scoreTransition,
  rankTransitions,
  DEFAULT_WEIGHTS,
  WEIGHT_PROFILES,
} from '@llpte/llpte-transition-graph';
import type { TrackSignal, TransitionWeights } from '@llpte/llpte-transition-graph';

// ── Utilities ─────────────────────────────────────────────────────────────────

function now(): number {
  return performance.now();
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function p99(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.99)];
}

function fmt(n: number, unit = 'ms'): string {
  return `${n.toFixed(4)} ${unit}`;
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function row(label: string, value: string): void {
  console.log(`  ${label.padEnd(30)} ${value}`);
}

// ── Signal factory — generates realistic track signals ────────────────────────

const KEYS = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
];

function makeSignal(seed: number): TrackSignal {
  const r = (min: number, max: number) =>
    min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
  return {
    bpm:             Math.round(r(90, 160)),
    key:             KEYS[Math.floor(r(0, KEYS.length))],
    energy:          parseFloat(r(0.2, 1.0).toFixed(3)),
    spectralCentroid:parseFloat(r(800, 8000).toFixed(1)),
    rmsLoudness:     parseFloat(r(0.3, 0.9).toFixed(3)),
    phaseOffset:     parseFloat(r(0, Math.PI * 2).toFixed(4)),
  };
}

function makeLibrary(size: number): Array<{ id: string; signal: TrackSignal }> {
  return Array.from({ length: size }, (_, i) => ({
    id:     `track-${i}`,
    signal: makeSignal(i * 137 + 42),
  }));
}

// ── Benchmark 1 — Single pair scoring latency ─────────────────────────────────

function benchSingleScoring(iterations = 10_000): void {
  section('BENCHMARK 1 — Single Pair Scoring Latency');

  const a = makeSignal(1);
  const b = makeSignal(2);
  const times: number[] = [];

  // Warm up
  for (let i = 0; i < 100; i++) scoreTransition(a, b, 'a', 'b');

  for (let i = 0; i < iterations; i++) {
    const t0 = now();
    scoreTransition(a, b, 'a', 'b', DEFAULT_WEIGHTS);
    times.push(now() - t0);
  }

  row('Iterations',    `${iterations.toLocaleString()}`);
  row('Mean latency',  fmt(mean(times)));
  row('Median',        fmt(median(times)));
  row('p99',           fmt(p99(times)));
  row('Target',        '< 1ms  ✓ required for real-time use');
  row('Result',        mean(times) < 1 ? '✅ PASS' : '❌ FAIL — exceeds 1ms target');
}

// ── Benchmark 2 — Graph ranking latency (N-track library) ────────────────────

function benchGraphRanking(): void {
  section('BENCHMARK 2 — Graph Ranking Latency (Library Scale)');

  const sizes = [10, 50, 100, 500, 1000];

  for (const size of sizes) {
    const library  = makeLibrary(size);
    const source   = library[0].signal;
    const rest     = library.slice(1);
    const times: number[] = [];

    // Warm up
    for (let i = 0; i < 5; i++) rankTransitions(source, 'track-0', rest);

    for (let i = 0; i < 200; i++) {
      const t0 = now();
      rankTransitions(source, 'track-0', rest, DEFAULT_WEIGHTS);
      times.push(now() - t0);
    }

    const target = size <= 100 ? 10 : 50;
    const pass   = mean(times) < target;
    row(
      `Library size ${size.toString().padStart(5)} tracks`,
      `mean ${fmt(mean(times))}  p99 ${fmt(p99(times))}  ${pass ? '✅' : '❌'}`,
    );
  }

  row('Target', '< 10ms for ≤100 tracks, < 50ms for ≤1000 tracks');
}

// ── Benchmark 3 — Weight profile comparison ───────────────────────────────────

function benchWeightProfiles(iterations = 5_000): void {
  section('BENCHMARK 3 — Weight Profile Scoring Overhead');

  const a = makeSignal(10);
  const b = makeSignal(20);

  for (const [name, weights] of Object.entries(WEIGHT_PROFILES)) {
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = now();
      scoreTransition(a, b, 'a', 'b', weights as TransitionWeights);
      times.push(now() - t0);
    }
    row(`Profile: ${name.padEnd(12)}`, `mean ${fmt(mean(times))}  p99 ${fmt(p99(times))}`);
  }
}

// ── Benchmark 4 — End-to-end: score → crossfade params ───────────────────────

function benchEndToEnd(iterations = 5_000): void {
  section('BENCHMARK 4 — End-to-End: Score → Crossfade Params');

  const library = makeLibrary(20);
  const source  = library[0].signal;
  const rest    = library.slice(1);
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const t0 = now();
    const ranked = rankTransitions(source, 'track-0', rest, DEFAULT_WEIGHTS);
    // Simulate consuming top result (as execution layer would)
    const _best = ranked[0];
    void _best?.suggestedCrossfadeDurationMs;
    void _best?.suggestedCurve;
    times.push(now() - t0);
  }

  row('Library size',    '20 tracks');
  row('Iterations',      `${iterations.toLocaleString()}`);
  row('Mean latency',    fmt(mean(times)));
  row('Median',          fmt(median(times)));
  row('p99',             fmt(p99(times)));
  row('Target',          '< 10ms end-to-end  ✓ required for live performance');
  row('Result',          mean(times) < 10 ? '✅ PASS' : '❌ FAIL — exceeds 10ms target');
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printHeader(): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   LLPTE — Low-Latency Predictive Transition Engine       ║');
  console.log('║   Performance Benchmark Report                           ║');
  console.log(`║   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
}

function printFooter(): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  Benchmark complete. Results are suitable for:');
  console.log('  → docs/LLPTE/BENCHMARKS.md');
  console.log('  → LLPTE_WHITEPAPER.md  §5 Performance Metrics');
  console.log('─'.repeat(60));
}

// ── Entry point ───────────────────────────────────────────────────────────────

printHeader();
benchSingleScoring();
benchGraphRanking();
benchWeightProfiles();
benchEndToEnd();
printFooter();
