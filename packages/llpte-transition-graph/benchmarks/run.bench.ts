/**
 * @llpte/llpte-transition-graph — Benchmark Suite
 *
 * Measures performance against enterprise targets.
 * Run: npx tsx benchmarks/run.bench.ts
 *
 * Targets:
 *   Transition prediction time:  < 5ms  (avg over 200 runs)
 *   Memory footprint:            < 50MB
 */

// Direct src imports — valid within same package before build
import { rankTransitions, DEFAULT_WEIGHTS, WEIGHT_PROFILES } from '../src/scoreModel';
import type { TrackSignal } from '../src/types';

const TARGETS = {
  transitionPredictionMs: 5,
  memoryMB: 50,
};

const BASE_SIGNAL: TrackSignal = {
  bpm: 128,
  key: '8A',
  energy: 0.75,
  spectralCentroid: 3200,
  rmsLoudness: 0.65,
  phaseOffset: Math.PI / 4,
};

function generateCandidates(n: number): Array<{ id: string; signal: TrackSignal }> {
  return Array.from({ length: n }, (_, i) => ({
    id: `track_${i.toString().padStart(3, '0')}`,
    signal: {
      bpm:             120 + (i % 30) * 0.5,
      key:             ['8A','9A','7A','8B','1A','6B'][i % 6],
      energy:          0.3 + (i % 7) * 0.1,
      spectralCentroid: 2000 + (i % 20) * 150,
      rmsLoudness:     0.4 + (i % 5) * 0.1,
      phaseOffset:     (i * 0.4) % (2 * Math.PI),
    },
  }));
}

function bench(
  label: string,
  fn: () => void,
  iterations = 200,
  targetMs?: number,
): { avg: number; p99: number; min: number; max: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const p99 = times[Math.floor(times.length * 0.99)];
  const result = { avg, p99, min: times[0], max: times[times.length - 1] };

  const target = targetMs ?? TARGETS.transitionPredictionMs;
  const status = avg < target ? '✅ PASS' : '❌ FAIL';
  console.log(`\n  ${label}`);
  console.log(`    avg: ${avg.toFixed(3)}ms   target: <${target}ms   ${status}`);
  console.log(`    p99: ${p99.toFixed(3)}ms   min: ${result.min.toFixed(3)}ms   max: ${result.max.toFixed(3)}ms`);
  return result;
}

function memoryMB(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024;
  }
  return 0;
}

// ── Run Benchmarks ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  LLPTE Benchmark Suite v0.1.0');
console.log('  Transition Graph — Performance Baseline');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const small  = generateCandidates(10);
const medium = generateCandidates(50);
const large  = generateCandidates(200);

bench('rankTransitions (10 candidates)',  () => rankTransitions(BASE_SIGNAL, 'from', small,  DEFAULT_WEIGHTS));
bench('rankTransitions (50 candidates)',  () => rankTransitions(BASE_SIGNAL, 'from', medium, DEFAULT_WEIGHTS));
bench('rankTransitions (200 candidates)', () => rankTransitions(BASE_SIGNAL, 'from', large,  DEFAULT_WEIGHTS), 200, 10);
bench('rankTransitions (harmonic profile)', () => rankTransitions(BASE_SIGNAL, 'from', medium, WEIGHT_PROFILES.harmonic));

const mem = memoryMB();
const memStatus = mem < TARGETS.memoryMB ? '✅ PASS' : '❌ FAIL';
console.log(`\n  Memory:  ${mem.toFixed(1)}MB   target: <${TARGETS.memoryMB}MB   ${memStatus}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Run from packages/llpte-transition-graph/:');
console.log('  npx tsx benchmarks/run.bench.ts');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
