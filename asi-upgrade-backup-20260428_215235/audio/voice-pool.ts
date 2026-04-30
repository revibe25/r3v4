/**
 * voice-pool.ts — polyphonic voice manager with LRU eviction
 *
 * Maintains up to MAX_VOICES concurrent AudioBufferSourceNodes.
 * When the cap is reached the oldest voice is faded out and released
 * (50 ms fade to prevent clicks on steal).
 *
 * Note: drum-pads.tsx already has an equivalent internal implementation
 * (playPadWithFx).  This class is intended for wiring into instrument-engine
 * once that file is read and confirmed.
 *
 * Usage in instrument-engine.ts:
 *   import { VoicePool } from '@/audio/voice-pool';
 *   const pool = new VoicePool(audioCtx, masterGainNode);
 *   pool.trigger(buffer, padIndex, velocity);  // velocity 0–1
 *   pool.stopAll();                            // on transport stop
 */

const MAX_VOICES  = 32;
const FADE_TIME_S = 0.05;

interface Voice {
  source:    AudioBufferSourceNode;
  gain:      GainNode;
  padIndex:  number;
  startTime: number;
}

export class VoicePool {
  private readonly voices: Voice[] = [];
  private readonly ctx:    AudioContext;
  private readonly dest:   AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx  = ctx;
    this.dest = destination;
  }

  trigger(buffer: AudioBuffer, padIndex: number, velocity: number): void {
    // LRU voice steal when at cap
    if (this.voices.length >= MAX_VOICES) {
      const evicted = this.voices.shift();
      if (evicted) this.release(evicted);
    }

    const gain   = this.ctx.createGain();
    // 8ms attack ramp eliminates click artefact on note-on.
    // An instant step change (setValueAtTime) creates a discontinuity in the
    // waveform that the ear hears as a click, especially at low frequencies.
    // 8ms is inaudible as an attack but eliminates the discontinuity entirely.
    const clamped = Math.min(1, Math.max(0, velocity));
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(clamped, this.ctx.currentTime + 0.008);
    gain.connect(this.dest);

    const source  = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    const voice: Voice = { source, gain, padIndex, startTime: this.ctx.currentTime };

    source.onended = () => {
      gain.disconnect();
      const i = this.voices.indexOf(voice);
      if (i !== -1) this.voices.splice(i, 1);
    };

    source.start(this.ctx.currentTime);
    this.voices.push(voice);
  }

  stopAll(): void {
    // Copy before iterating — onended mutates the array
    [...this.voices].forEach(v => this.release(v));
  }

  get activeCount(): number { return this.voices.length; }

  private release(voice: Voice): void {
    try {
      voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, FADE_TIME_S / 3);
      voice.source.stop(this.ctx.currentTime + FADE_TIME_S);
    } catch { /* source already stopped — safe to ignore */ }
  }
}
