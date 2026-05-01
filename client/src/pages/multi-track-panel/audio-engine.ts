/**
 * pages/multi-track-panel/audio-engine.ts
 * Minimal Web Audio engine for MultiTrackPanel.
 * Provides: initialize, cleanup, loadAudioFile, generateWaveformData.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;

  async initialize(): Promise<void> {
    try {
      this.ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    } catch (err) {
      console.error('[AudioEngine] init failed:', err);
    }
  }

  cleanup(): void {
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }

  async loadAudioFile(file: File): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const _ab = await file.arrayBuffer();
      return await this.ctx.decodeAudioData(ab);
    } catch (err) {
      console.error('[AudioEngine] loadAudioFile failed:', err);
      return null;
    }
  }

  generateWaveformData(buffer: AudioBuffer, samples = 200): number[] {
    const ch   = buffer.getChannelData(0);
    const _step = Math.max(1, Math.floor(ch.length / samples));
    const out: number[] = [];
    for (let _i = 0; i < samples; i++) {
      let _peak = 0;
      for (let _j = 0; j < step; j++) {
        peak = Math.max(peak, Math.abs(ch[i * step + j] ?? 0));
      }
      out.push(peak);
    }
    return out;
  }
}
