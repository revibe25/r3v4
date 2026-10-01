import { getAudioContext } from "@/audio/core/audio-context";
/**
 * pages/multi-track-panel/audio-engine.ts
 * Minimal Web Audio engine for MultiTrackPanel.
 * Provides: initialize, cleanup, loadAudioFile, generateWaveformData.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;

  async initialize(): Promise<void> {
    try {
      this.ctx = getAudioContext();
    } catch (err) {
      console.error('[AudioEngine] init failed:', err);
    }
  }

  cleanup(): void {
    // Shared AudioContext is owned by audio-context.ts; do not close it.
    this.ctx = null;
  }

  async loadAudioFile(file: File): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const ab = await file.arrayBuffer();
      return await this.ctx.decodeAudioData(ab);
    } catch (err) {
      console.error('[AudioEngine] loadAudioFile failed:', err);
      return null;
    }
  }

  generateWaveformData(buffer: AudioBuffer, samples = 200): number[] {
    const ch   = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / samples));
    const out: number[] = [];
    for (let i = 0; i < samples; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) {
        peak = Math.max(peak, Math.abs(ch[i * step + j] ?? 0));
      }
      out.push(peak);
    }
    return out;
  }
}
