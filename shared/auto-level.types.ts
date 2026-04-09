// ============================================================
// R3 Auto-Leveling Type System
// ITU-R BS.1770-4 compliant, LLPTE-native
// ============================================================

// ── Signal snapshot per track per frame ─────────────────────
export interface TrackSignalSnapshot {
  trackId: string;
  timestamp: number;          // AudioContext.currentTime
  rms: number;                // 0–1 linear
  truePeak: number;           // dBTP
  shortTermLufs: number;      // LUFS (3-second window)
  integratedLufs: number;     // LUFS (full session, gated)
  spectrum: Float32Array;     // 128-bin FFT magnitude (dB)
  clipping: boolean;
  gateOpen: boolean;          // ITU-R gating: true when signal above -70 LUFS
}

export interface MasterBusSnapshot {
  timestamp: number;
  rms: number;
  truePeak: number;
  integratedLufs: number;     // running integrated LUFS for master bus
  trackSnapshots: Map<string, TrackSignalSnapshot>;
}

// ── AI Recommendations ───────────────────────────────────────
export interface GainAdjustment {
  trackId: string;
  currentGainDb: number;
  recommendedGainDb: number;
  deltaDb: number;
  confidence: number;         // 0–1
  reason: string;
  urgency: "immediate" | "gradual" | "suggestion";
}

export type EQBand = "low" | "low-mid" | "high-mid" | "high";

export interface EQSuggestion {
  trackId: string;
  band: EQBand;
  frequency: number;          // Hz
  gain: number;               // dB
  q: number;
  reason: string;
  confidence: number;
}

export interface SpectralMaskingReport {
  trackA: string;
  trackB: string;
  maskingBand: EQBand;
  frequency: number;
  severity: number;           // 0–1
  suggestions: EQSuggestion[];
}

export interface AutoLevelRecommendation {
  sessionId: string;
  frameId: number;
  timestamp: number;
  gainAdjustments: GainAdjustment[];
  eqSuggestions: EQSuggestion[];
  spectralMasking: SpectralMaskingReport[];
  clippingAlerts: string[];   // trackIds currently clipping
  overallConfidence: number;
  processingTimeMs: number;
}

// ── Execution state ──────────────────────────────────────────
export type AutoLevelMode = "off" | "suggest" | "auto";

export interface AutoLevelState {
  mode: AutoLevelMode;
  enabled: boolean;
  lastRecommendation: AutoLevelRecommendation | null;
  overrides: Record<string, number>;        // trackId → user gain
  sessionStats: SessionStats;
  nodeStates: LLPTENodeStateMap;
}

export interface SessionStats {
  sessionId: string;
  startTime: number;
  totalAdjustments: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  clippingEventsPreventedCount: number;
  estimatedTimeSavedSeconds: number;
  manualGainChanges: number;
}

// ── LLPTE pipeline node states ───────────────────────────────
export type LLPTENodeId =
  | "inputRouter"
  | "spectralAnalyzer"
  | "lufsCalculator"
  | "clippingDetector"
  | "aiMixEngine"
  | "transitionGraph"
  | "outputBus";

// FIX-11: Exported so hook can pre-populate idle states without depending
// on AutoLevelPipeline internals.
export const LLPTE_NODE_ORDER: LLPTENodeId[] = [
  "inputRouter",
  "spectralAnalyzer",
  "lufsCalculator",
  "clippingDetector",
  "aiMixEngine",
  "transitionGraph",
  "outputBus",
];

export type NodeStatus = "idle" | "active" | "processing" | "error";

export interface LLPTENodeState {
  id: LLPTENodeId;
  status: NodeStatus;
  lastProcessedAt: number;
  processingTimeMs: number;
  outputSummary?: string;
}

export type LLPTENodeStateMap = Record<LLPTENodeId, LLPTENodeState>;

// ── Events ───────────────────────────────────────────────────
export type AutoLevelEventType =
  | "recommendation"
  | "adjustment_applied"
  | "adjustment_accepted"
  | "adjustment_rejected"
  | "clipping_detected"
  | "clipping_resolved"
  | "mode_changed"
  | "override_set";

export interface AutoLevelEvent {
  type: AutoLevelEventType;
  trackId?: string;
  data: unknown;
  timestamp: number;
}

// ── Constants ────────────────────────────────────────────────
export const AUTO_LEVEL_CONSTANTS = {
  TARGET_LUFS: -14,                // Streaming target
  TARGET_LUFS_LOUD: -9,            // Club/DJ target
  CLIPPING_THRESHOLD_DBTP: -1.0,
  GATE_THRESHOLD_LUFS: -70,
  MAX_GAIN_DELTA_DB: 12,
  MIN_GAIN_DELTA_DB: -18,
  SMOOTHING_TIME_CONSTANT: 0.05,   // seconds (AudioParam)
  FRAME_INTERVAL_MS: 33,           // ~30fps
  INFERENCE_BUDGET_MS: 15,         // max AI processing per frame
  CONFIDENCE_THRESHOLD: 0.65,
} as const;

// ── Primitive aliases ────────────────────────────────────────────────────────
/** Opaque alias — all track identifiers are strings at runtime. */
export type TrackId = string;

// ── Real-time mix snapshot (produced by MixAnalyzer.captureFrame) ────────────
export interface MixSnapshot {
  /** Monotonically increasing frame counter for the analyzer session. */
  frameId:    number;
  /** Wall-clock capture time (performance.now()) in milliseconds. */
  timestamp:  number;
  /** Per-track signal snapshots keyed by TrackId. */
  tracks:     Map<TrackId, TrackSignalSnapshot>;
  /** Master bus RMS (linear 0–1). */
  masterRMS:  number;
  /** Master bus integrated LUFS. */
  masterLUFS: number;
}



// ── Pipeline result + session types (used by executor, pipeline, and UI) ─────

export interface AutoLevelApplyResult {
  frameId:         number;
  appliedAt:       number;
  appliedTrackIds: TrackId[];
  skippedTrackIds: TrackId[];
  executionTimeMs: number;
}

export interface AutoLevelSessionStats {
  sessionStartedAt:              number;
  totalAIAdjustments:            number;
  totalManualAdjustments:        number;
  clippingEventsPreventedCount:  number;
  acceptedSuggestions:           number;
  rejectedSuggestions:           number;
  estimatedMinutesSaved:         number;
}

// ── Per-track UI state for AILevelAssist component ───────────────────────────

export interface TrackAILevelState {
  trackId:       TrackId;
  currentGain:   number;
  suggestedGain: number | null;
  confidence:    number | null;
  isClipping:    boolean;
  userOverride:  boolean;
  eqSuggestions: EQSuggestion[];
}
