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

// ── Crossfade duration thresholds (exported for tests + whitepaper) ───────────
export const CROSSFADE_DURATION_MS = {
  EXCELLENT: 4000,   // score >= 0.85 — tight match, short blend
  GOOD:      8000,   // score >= 0.70
  AVERAGE:   12000,  // score >= 0.50 — longer blend to mask differences
  POOR:      20000,  // score <  0.50 — maximum blend time
} as const;

// ── Default enterprise weight profile ────────────────────────────────────────
export const DEFAULT_WEIGHTS: TransitionWeights = {
  harmonicWeight: 0.35,  // Key compatibility is the strongest perceptual factor
  energyWeight:   0.25,  // Energy continuity is the most-noticed DJ error
  spectralWeight: 0.20,  // Frequency clash prevention
  phaseWeight:    0.10,  // Phase cancellation risk
  tempoWeight:    0.10,  // BPM alignment
};

// ── Weight profile presets for different contexts ─────────────────────────────
export const WEIGHT_PROFILES: Record<string, TransitionWeights> = {
  default:    DEFAULT_WEIGHTS,
  harmonic:   { harmonicWeight: 0.60, energyWeight: 0.15, spectralWeight: 0.10, phaseWeight: 0.10, tempoWeight: 0.05 },
  energetic:  { harmonicWeight: 0.20, energyWeight: 0.50, spectralWeight: 0.15, phaseWeight: 0.05, tempoWeight: 0.10 },
  broadcast:  { harmonicWeight: 0.30, energyWeight: 0.20, spectralWeight: 0.30, phaseWeight: 0.10, tempoWeight: 0.10 },
};

// ── Camelot wheel: maps each key to its compatible neighbors ──────────────────
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

// ── Input validation — prevents NaN propagation through the scoring chain ─────
/**
 * Validates and clamps a TrackSignal to safe scoring ranges.
 * Returns a new object — never mutates the input.
 */
export function validateSignal(s: TrackSignal): TrackSignal {
  return {
    bpm:             Math.max(0, isFinite(s.bpm)             ? s.bpm             : 0),
    key:             typeof s.key === 'string'                ? s.key             : '',
    energy:          Math.min(1, Math.max(0, isFinite(s.energy)          ? s.energy          : 0)),
    spectralCentroid:Math.max(0, isFinite(s.spectralCentroid) ? s.spectralCentroid : 0),
    rmsLoudness:     Math.min(1, Math.max(0, isFinite(s.rmsLoudness)     ? s.rmsLoudness     : 0)),
    phaseOffset:     s.phaseOffset !== undefined && isFinite(s.phaseOffset)
                       ? s.phaseOffset
                       : undefined,
  };
}

// ── Weight normalization — auto-corrects without throwing ─────────────────────
/**
 * Normalizes weights so they sum to exactly 1.0.
 * Safe to call before scoring. Returns a new object.
 */
export function normalizeWeights(w: TransitionWeights): TransitionWeights {
  const sum = w.harmonicWeight + w.energyWeight + w.spectralWeight +
              w.phaseWeight    + w.tempoWeight;
  if (sum === 0) return { ...DEFAULT_WEIGHTS };
  const s = 1 / sum;
  return {
    harmonicWeight: w.harmonicWeight * s,
    energyWeight:   w.energyWeight   * s,
    spectralWeight: w.spectralWeight * s,
    phaseWeight:    w.phaseWeight    * s,
    tempoWeight:    w.tempoWeight    * s,
  };
}

// ── Dimension scoring functions (pure, 0.0–1.0 output) ───────────────────────

function scoreHarmonic(a: TrackSignal, b: TrackSignal): number {
  if (!a.key || !b.key) return 0.3;
  if (a.key === b.key) return 1.0;
  const compatible = CAMELOT_COMPATIBLE[a.key] ?? [];
  if (compatible.includes(b.key)) return 0.75;
  const aNum = parseInt(a.key);
  const bNum = parseInt(b.key);
  if (!isNaN(aNum) && !isNaN(bNum) && Math.abs(aNum - bNum) <= 2) return 0.4;
  return 0.1;
}

function scoreEnergy(a: TrackSignal, b: TrackSignal): number {
  const delta = Math.abs(a.energy - b.energy);
  return Math.max(0, 1.0 - Math.pow(delta, 0.7) * 1.8);
}

function scoreSpectral(a: TrackSignal, b: TrackSignal): number {
  if (a.spectralCentroid <= 0 || b.spectralCentroid <= 0) return 0.5;
  const max   = Math.max(a.spectralCentroid, b.spectralCentroid);
  const delta = Math.abs(a.spectralCentroid - b.spectralCentroid) / max;
  return Math.max(0, 1.0 - delta * 1.5);
}

function scorePhase(a: TrackSignal, b: TrackSignal): number {
  if (a.phaseOffset === undefined || b.phaseOffset === undefined) return 0.5;
  const TWO_PI     = 2 * Math.PI;
  const delta      = Math.abs(a.phaseOffset - b.phaseOffset) % TWO_PI;
  const normalized = Math.min(delta, TWO_PI - delta) / Math.PI;
  return Math.max(0, 1.0 - normalized);
}

function scoreTempo(a: TrackSignal, b: TrackSignal): number {
  if (a.bpm <= 0 || b.bpm <= 0) return 0.3;
  const ratio         = Math.min(a.bpm, b.bpm) / Math.max(a.bpm, b.bpm);
  const doubleForward = Math.min(a.bpm * 2, b.bpm) / Math.max(a.bpm * 2, b.bpm);
  const doubleBackward= Math.min(a.bpm, b.bpm * 2) / Math.max(a.bpm, b.bpm * 2);
  const halfTimeBonus = Math.max(doubleForward, doubleBackward) * 0.75;
  return Math.max(ratio, halfTimeBonus);
}

// ── Crossfade parameter selection from composite score ────────────────────────
function selectCrossfadeDuration(score: number): number {
  if (score >= 0.85) return CROSSFADE_DURATION_MS.EXCELLENT;
  if (score >= 0.70) return CROSSFADE_DURATION_MS.GOOD;
  if (score >= 0.50) return CROSSFADE_DURATION_MS.AVERAGE;
  return CROSSFADE_DURATION_MS.POOR;
}

function selectCurve(
  breakdown: ScoreBreakdown,
): TransitionCandidate['suggestedCurve'] {
  if (breakdown.energy   > 0.8)                            return 'equal-power';
  if (breakdown.harmonic > 0.8 && breakdown.energy > 0.6)  return 's-curve';
  if (breakdown.spectral < 0.4)                            return 'logarithmic';
  return 'linear';
}

// ── Core scoring function — exported for direct use ───────────────────────────
/**
 * Scores a single A→B transition across all five weighted dimensions.
 * Inputs are validated and weights are auto-normalized before scoring.
 *
 * @param from    - Analyzed signal of the outgoing track
 * @param to      - Analyzed signal of the incoming track
 * @param fromId  - Stable identifier for the outgoing track
 * @param toId    - Stable identifier for the incoming track
 * @param weights - Optional weight profile (defaults to DEFAULT_WEIGHTS)
 * @returns       TransitionCandidate with score, breakdown, and suggestions
 */
export function scoreTransition(
  from:    TrackSignal,
  to:      TrackSignal,
  fromId:  string,
  toId:    string,
  weights: TransitionWeights = DEFAULT_WEIGHTS,
): TransitionCandidate {
  const a = validateSignal(from);
  const b = validateSignal(to);
  const w = normalizeWeights(weights);

  const breakdown: ScoreBreakdown = {
    harmonic: scoreHarmonic(a, b),
    energy:   scoreEnergy(a, b),
    spectral: scoreSpectral(a, b),
    phase:    scorePhase(a, b),
    tempo:    scoreTempo(a, b),
  };

  const total =
    breakdown.harmonic * w.harmonicWeight +
    breakdown.energy   * w.energyWeight   +
    breakdown.spectral * w.spectralWeight +
    breakdown.phase    * w.phaseWeight    +
    breakdown.tempo    * w.tempoWeight;

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
/**
 * Scores all candidate tracks against a source track and returns them
 * sorted by descending score. Self-transitions are automatically excluded.
 */
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
