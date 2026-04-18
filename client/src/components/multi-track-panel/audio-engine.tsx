// @ts-nocheck
// REPLACEMENT for multi-track-panel/audio-engine.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Uses the singleton AudioContext instead of creating its own.
// ─────────────────────────────────────────────────────────────────────────────
import { getAudioContext } from '@/audio/core/audio-context';

export class AudioEngine {
  context: AudioContext | null = null;
  private trackNodes: Map<string, { gain: GainNode; analyser: AnalyserNode }> = new Map();

cleanup(): void {
  // Disconnect and close any AudioContext / nodes you opened
  try {
    this.audioContext?.close();
  } catch (_) { /* already closed */ }
}
  async initialize(): Promise<AudioContext> {
    // Use singleton — NOT getAudioContext()
    this.context = await getAudioContext();
    return this.context;
  }

  createAnalyserNode(trackId: string): AnalyserNode | null {
    if (!this.context) return null;
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    return analyser;
  }

  createGainNode(initialValue = 1): GainNode | null {
    if (!this.context) return null;
    const gain = this.context.createGain();
    gain.gain.value = initialValue;
    return gain;
  }

  // ── Track management ────────────────────────────────────────────
  setupTrack(trackId: string) {
    if (!this.context) return null;
    if (this.trackNodes.has(trackId)) return this.trackNodes.get(trackId)!;
    const gain = this.context.createGain();
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    gain.connect(analyser);
    analyser.connect(this.context.destination);
    const nodes = { gain, analyser };
    this.trackNodes.set(trackId, nodes);
    return nodes;
  }

  getTrackNodes(trackId: string) {
    return this.trackNodes.get(trackId) ?? null;
  }

  // ── NOTE: No close() here. The singleton manages its own lifecycle.
  // ── Call destroyAudioContext() only on full app teardown.
}

// Export as singleton — one engine instance for the whole app
export const audioEngine = new AudioEngine();
export default AudioEngine;