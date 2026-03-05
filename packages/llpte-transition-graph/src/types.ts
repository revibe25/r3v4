/**
 * @llpte/llpte-transition-graph — Core Types
 *
 * Primitives for the LLPTE multi-factor predictive scoring system.
 * All scoring is pure/functional — given identical inputs, outputs
 * are deterministic and serializable.
 */

/** Analyzed signal characteristics of a loaded track. */
export interface TrackSignal {
  /** Beats per minute */
  bpm: number;
  /** Camelot wheel notation e.g. "8A", "12B" */
  key: string;
  /** Normalized energy level 0.0–1.0 */
  energy: number;
  /** Spectral centroid in Hz */
  spectralCentroid: number;
  /** Root mean square loudness 0.0–1.0 */
  rmsLoudness: number;
  /** Phase offset in radians (optional, defaults to 0.5 score if absent) */
  phaseOffset?: number;
}

/** Configurable weight profile applied to scoring formula. */
export interface TransitionWeights {
  /** Harmonic compatibility via Camelot wheel (dominant perceptual factor) */
  harmonicWeight: number;
  /** Energy continuity — prevents jarring energy drops or spikes */
  energyWeight: number;
  /** Spectral density shift penalty — prevents frequency masking clashes */
  spectralWeight: number;
  /** Phase coherence — minimizes phase cancellation risk */
  phaseWeight: number;
  /** Tempo drift penalty — BPM alignment cost */
  tempoWeight: number;
}

/** Per-dimension score breakdown for auditability. */
export interface ScoreBreakdown {
  harmonic: number;
  energy:   number;
  spectral: number;
  phase:    number;
  tempo:    number;
}

/** A scored transition candidate from one track to another. */
export interface TransitionCandidate {
  fromTrackId: string;
  toTrackId:   string;
  /** Composite weighted score 0.0–1.0 (higher = better transition) */
  score:       number;
  /** Full breakdown for debugging, whitepaper evidence, and UI display */
  breakdown:   ScoreBreakdown;
  /** Recommended crossfade duration in milliseconds based on score */
  suggestedCrossfadeDurationMs: number;
  /** Recommended crossfade curve type based on score profile */
  suggestedCurve: 'equal-power' | 's-curve' | 'linear' | 'logarithmic';
  /** Mirror of score — reserved for future ML confidence adjustment */
  confidence: number;
}

/** Full graph: map of trackId → ranked transition candidates */
export type TransitionGraph = Map<string, TransitionCandidate[]>;
