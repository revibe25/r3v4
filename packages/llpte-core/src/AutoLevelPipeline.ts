import type { AutoLevelEvent, AutoLevelSessionStats } from '@shared/auto-level.types';

// PipelineNodeState - includes all LLPTE nodes + metrics
export interface PipelineNodeState {
  // LLPTE node statuses
  inputRouter?: 'idle' | 'analyzing' | 'processing' | 'complete';
  spectralAnalyzer?: 'idle' | 'analyzing' | 'processing' | 'complete';
  lufsCalculator?: 'idle' | 'analyzing' | 'processing' | 'complete';
  clippingDetector?: 'idle' | 'analyzing' | 'processing' | 'complete';
  aiMixEngine?: 'idle' | 'analyzing' | 'processing' | 'complete';
  transitionGraph?: 'idle' | 'analyzing' | 'processing' | 'complete';
  outputBus?: 'idle' | 'analyzing' | 'processing' | 'complete';
  
  // Metrics
  lastInferenceMs: number;
  analysisFrameRate: number;
  
  // Optional metadata
  trackId?: string;
  state?: 'idle' | 'analyzing' | 'processing' | 'complete';
  suggestion?: { gain: number; reason: string };
}

// TrackAnalyzer from llpte-signal
export type TrackAnalyzer = any;

export interface TrackAnalyzerConfig {
  analysisHz?: number;
}

export class AutoLevelPipeline {
  private tracks: Map<string, any> = new Map();
  private eventListeners: Set<(event: AutoLevelEvent) => void> = new Set();
  private stateListeners: Set<(state: PipelineNodeState) => void> = new Set();
  
  public running: boolean = false;
  public stats: AutoLevelSessionStats;

  constructor(masterAnalyzer: AnalyserNode, sampleRate: number, config: TrackAnalyzerConfig = {}) {
    this.stats = {
      sessionStartedAt: Date.now(),
      totalAIAdjustments: 0,
      totalManualAdjustments: 0,
      clippingEventsPreventedCount: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      estimatedMinutesSaved: 0,
    };
  }

  registerTrack(analyzer: TrackAnalyzer, gainNode: GainNode, audioContext: AudioContext, eqNodes: BiquadFilterNode[] = []): void {
    const trackId = `track-${this.tracks.size}`;
    this.tracks.set(trackId, analyzer);
    this.stats.totalAIAdjustments++;
  }

  subscribe(listener: (event: AutoLevelEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribeNodeState(listener: (state: PipelineNodeState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  start(): void { this.running = true; }
  stop(): void { this.running = false; }
  acceptSuggestion(trackId: string): void { this.stats.acceptedSuggestions++; }
  rejectSuggestion(trackId: string): void { this.stats.rejectedSuggestions++; }
  notifyUserFaderMove(trackId: string, gainLinear: number): void { this.stats.totalManualAdjustments++; }
  dispose(): void { this.running = false; this.tracks.clear(); this.eventListeners.clear(); this.stateListeners.clear(); }
  destroy(): void { this.dispose(); }
}

export type { AutoLevelEvent, AutoLevelSessionStats };
