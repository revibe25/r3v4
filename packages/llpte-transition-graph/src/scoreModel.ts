/**
 * @llpte/llpte-transition-graph — Weighted Score Model
 *
 * Multi-factor scoring engine. Produces ranked transition candidates
 * across harmonic, energy, spectral, phase, and tempo dimensions.
 *
 * Formula:
 *   Score = Σ(wᵢ × dimensionScore_i)
 *
 * Unlike BPM/key-only systems, LLPTE evaluates all five dimensions
 * simultaneously, producing a deterministic composite score that
 * enables real-time ranked candidate selection.
 *
 * All functions are pure — no side effects, fully testable.
 */

import type {
  TrackSignal,
  TransitionWeights,
  TransitionCandidate,
  ScoreBreakdown,
} from './types';

// ── Default enterprise weight profile ────────────────────────────────────────
export const DEFAULT_WEIGHTS: TransitionWeights = {
  harmonicWeight: 0.35,  // Key compatibility is the strongest perceptual factor
  energyWeight:   0.25,  // Energy continuity is the most-noticed DJ error
  spectralWeight: 0.20,  // Frequency clash prevention
  phaseWeight:    0.10,  // Phase cancellation risk
  tempoWeight:    0.10,  // BPM alignment
};

// Weight profile presets for different contexts
export const WEIGHT_PROFILES: Record<string, TransitionWeights> = {
  default:    DEFAULT_WEIGHTS,
  harmonic:   { harmonicWeight: 0.60, energyWeight: 0.15, spectralWeight: 0.10, phaseWeight: 0.10, tempoWeight: 0.05 },
  energetic:  { harmonicWeight: 0.20, energyWeight: 0.50, spectralWeight: 0.15, phaseWeight: 0.05, tempoWeight: 0.10 },
  broadcast:  { harmonicWeight: 0.30, energyWeight: 0.20, spectralWeight: 0.30, phaseWeight: 0.10, tempoWeight: 0.10 },
};

// ── Camelot wheel: maps each key to its compatible neighbors ─────────────────
const CAMELOT_COMPATIBLE: Readonly<Record<string, readonly string[]>> = {
  '1A':  ['1A','2A','12A','1B'],
  '2A':  ['2A','3A','1A','2B'],
  '3A':  ['3A','4A','2A','3B'],
  '4A':  ['4A','5A','3A','4B'],
  '5A':  ['5A','6A','4A','5B'],
  '6A':  ['6A','7A','5A','6B'],
  '7A':  ['7A','8A','6A','7B'],
  '8A':  ['8A','9A','7A','8B'],
  '9A':  ['9A','10A','8A','9B'],
  '10A': ['10A','11A','9A','10B'],
  '11A': ['11A','12A','10A','11B'],
  '12A': ['12A','1A','11A','12B'],
  '1B':  ['1B','2B','12B','1A'],
  '2B':  ['2B','3B','1B','2A'],
  '3B':  ['3B','4B','2B','3A'],
  '4B':  ['4B','5B','3B','4A'],
  '5B':  ['5B','6B','4B','5A'],
  '6B':  ['6B','7B','5B','6A'],
  '7B':  ['7B','8B','6B','7A'],
  '8B':  ['8B','9B','7B','8A'],
  '9B':  ['9B','10B','8B','9A'],
  '10B': ['10B','11B','9B','10A'],
  '11B': ['11B','12B','10B','11A'],
  '12B': ['12B','1B','11B','12A'],
};

// ── Dimension scoring functions (pure, 0.0–1.0 output) ───────────────────────

function scoreHarmonic(a: TrackSignal, b: TrackSignal): number {
  if (!a.key || !b.key) return 0.3;
  if (a.key === b.key) return 1.0;
  const compatible = CAMELOT_COMPATIBLE[a.key] ?? [];
  if (compatible.includes(b.key)) return 0.75;
  // Partial score for adjacent wheel positions
  const aNum = parseInt(a.key);
  const bNum = parseInt(b.key);
  if (!isNaN(aNum) && !isNaN(bNum) && Math.abs(aNum - bNum) <= 2) return 0.4;
  return 0.1;
}

function scoreEnergy(a: TrackSignal, b: TrackSignal): number {
  const delta = Math.abs(a.energy - b.energy);
  // Penalize large energy discontinuities exponentially
  return Math.max(0, 1.0 - Math.pow(delta, 0.7) * 1.8);
}

function scoreSpectral(a: TrackSignal, b: TrackSignal): number {
  if (a.spectralCentroid <= 0 || b.spectralCentroid <= 0) return 0.5;
  const max = Math.max(a.spectralCentroid, b.spectralCentroid);
  const delta = Math.abs(a.spectralCentroid - b.spectralCentroid) / max;
  return Math.max(0, 1.0 - delta * 1.5);
}

function scorePhase(a: TrackSignal, b: TrackSignal): number {
  if (a.phaseOffset === undefined || b.phaseOffset === undefined) return 0.5;
  const TWO_PI = 2 * Math.PI;
  const delta = Math.abs(a.phaseOffset - b.phaseOffset) % TWO_PI;
  const normalized = Math.min(delta, TWO_PI - delta) / Math.PI;  // 0.0–1.0
  return Math.max(0, 1.0 - normalized);
}

function scoreTempo(a: TrackSignal, b: TrackSignal): number {
  if (a.bpm <= 0 || b.bpm <= 0) return 0.3;
  // Direct BPM ratio
  const ratio = Math.min(a.bpm, b.bpm) / Math.max(a.bpm, b.bpm);
  // Reward half-time / double-time relationships (bidirectional)
  // Case 1: b is double-time of a (a=64, b=128)
  const doubleForward = Math.min(a.bpm * 2, b.bpm) / Math.max(a.bpm * 2, b.bpm);
  // Case 2: a is double-time of b (a=128, b=64)
  const doubleBackward = Math.min(a.bpm, b.bpm * 2) / Math.max(a.bpm, b.bpm * 2);
  const halfTimeBonus = Math.max(doubleForward, doubleBackward) * 0.75;
  return Math.max(ratio, halfTimeBonus);
}

// ── Crossfade parameter selection from composite score ────────────────────────
function selectCrossfadeDuration(score: number): number {
  if (score >= 0.85) return 4000;   // Excellent match — short crossfade
  if (score >= 0.70) return 8000;   // Good match
  if (score >= 0.50) return 12000;  // Average — longer blend
  return 20000;                     // Poor match — needs maximum blend time
}

function selectCurve(
  breakdown: ScoreBreakdown
): TransitionCandidate['suggestedCurve'] {
  if (breakdown.energy > 0.8) return 'equal-power';
  if (breakdown.harmonic > 0.8 && breakdown.energy > 0.6) return 's-curve';
  if (breakdown.spectral < 0.4) return 'logarithmic';
  return 'linear';
}

// ── Core scoring function — exported for direct use ──────────────────────────
export function scoreTransition(
  from:    TrackSignal,
  to:      TrackSignal,
  fromId:  string,
  toId:    string,
  weights: TransitionWeights = DEFAULT_WEIGHTS,
): TransitionCandidate {
  const breakdown: ScoreBreakdown = {
    harmonic: scoreHarmonic(from, to),
    energy:   scoreEnergy(from, to),
    spectral: scoreSpectral(from, to),
    phase:    scorePhase(from, to),
    tempo:    scoreTempo(from, to),
  };

  // Validate weights sum to ~1.0 (warn but don't throw)
  const weightSum = weights.harmonicWeight + weights.energyWeight +
    weights.spectralWeight + weights.phaseWeight + weights.tempoWeight;
  if (Math.abs(weightSum - 1.0) > 0.05) {
    console.warn(`[LLPTE] Weight sum is ${weightSum.toFixed(3)}, expected ~1.0. Normalize weights.`);
  }

  const total =
    breakdown.harmonic * weights.harmonicWeight +
    breakdown.energy   * weights.energyWeight   +
    breakdown.spectral * weights.spectralWeight +
    breakdown.phase    * weights.phaseWeight    +
    breakdown.tempo    * weights.tempoWeight;

  const score = parseFloat(Math.min(1, Math.max(0, total)).toFixed(4));

  return {
    fromTrackId:                  fromId,
    toTrackId:                    toId,
    score,
    breakdown,
    suggestedCrossfadeDurationMs: selectCrossfadeDuration(score),
    suggestedCurve:               selectCurve(breakdown),
    confidence:                   score,
  };
}

// ── Batch scorer — produces sorted candidates array ───────────────────────────
export function rankTransitions(
  from:       TrackSignal,
  fromId:     string,
  candidates: Array<{ signal: TrackSignal; id: string }>,
  weights?:   TransitionWeights,
): TransitionCandidate[] {
  return candidates
    .filter(c => c.id !== fromId)
    .map(c => scoreTransition(from, c.signal, fromId, c.id, weights))
    .sort((a, b) => b.score - a.score);
}
