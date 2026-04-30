// DJ Crossfader implementation with latency optimization
import * as Tone from 'tone';
import { CrossfaderConfig, CrossfaderState } from '@shared/dj.types';

export class Crossfader {
  private channelAGain: Tone.Gain;
  private channelBGain: Tone.Gain;
  private output: Tone.Gain;
  private state: CrossfaderState;
  private lastUpdateTime: number = 0;
  private measureLatency: boolean = false;

  constructor() {
    this.channelAGain = new Tone.Gain({ gain: 1 });
    this.channelBGain = new Tone.Gain({ gain: 0 });
    this.output = new Tone.Gain({ gain: 1 }).toDestination();

    this.channelAGain.connect(this.output);
    this.channelBGain.connect(this.output);

    this.state = {
      curve: 'smooth',
      range: 0, // Center position (-1 = full A, +1 = full B)
      sensitivity: 0.8,
      leftVolume: 1,
      rightVolume: 0,
      latency: 0,
    };
  }

  /**
   * Set crossfader position (-1 to +1)
   * Measures latency for monitoring
   */
  setPosition(position: number): void {
    const startTime = performance.now();

    // Clamp to range
    const normalizedPos = Math.max(-1, Math.min(1, position));
    this.state.range = normalizedPos;

    // Calculate volumes based on curve
    const { left, right } = this.calculateVolumes(normalizedPos);
    this.state.leftVolume = left;
    this.state.rightVolume = right;

    // Apply with immediate update (critical for <5ms latency)
    // Using setValueAtTime instead of rampTo for minimal latency
    const now = Tone.now();
    this.channelAGain.gain.setValueAtTime(left, now);
    this.channelBGain.gain.setValueAtTime(right, now);

    // Measure latency
    if (this.measureLatency) {
      const latency = performance.now() - startTime;
      this.state.latency = latency;
    }
  }

  /**
   * Calculate left/right volumes based on crossfader curve
   */
  private calculateVolumes(
    position: number
  ): { left: number; right: number } {
    // Position: -1 (full A) to +1 (full B)
    // Convert to 0-1 range for mixing
    const normalized = (position + 1) / 2; // 0 = A, 1 = B

    let left: number, right: number;

    switch (this.state.curve) {
      case 'linear':
        // Simple linear crossfade
        left = 1 - normalized;
        right = normalized;
        break;

      case 'easein':
        // Ease-in curve (slower at start, faster at end)
        const easeInValue = normalized * normalized;
        left = 1 - easeInValue;
        right = easeInValue;
        break;

      case 'easeout':
        // Ease-out curve (faster at start, slower at end)
        const easeOutValue = 1 - (1 - normalized) * (1 - normalized);
        left = 1 - easeOutValue;
        right = easeOutValue;
        break;

      case 'smooth':
      default:
        // Smooth cubic curve (traditional DJ crossfader)
        // More responsive in the middle, smoother at extremes
        const cubic = normalized * normalized * (3 - 2 * normalized);
        left = 1 - cubic;
        right = cubic;
        break;
    }

    return {
      left: Math.max(0, Math.min(1, left)),
      right: Math.max(0, Math.min(1, right)),
    };
  }

  /**
   * Set crossfader configuration
   */
  setConfig(config: Partial<CrossfaderConfig>): void {
    this.state = { ...this.state, ...config };
  }

  /**
   * Get current state
   */
  getState(): CrossfaderState {
    return { ...this.state };
  }

  /**
   * Connect channel A input
   */
  connectChannelA(source: Tone.ToneAudioNode | AudioNode): this {
    source.connect(this.channelAGain.input ?? (this.channelAGain as unknown as AudioNode));
    return this;
  }

  /**
   * Connect channel B input
   */
  connectChannelB(source: Tone.ToneAudioNode | AudioNode): this {
    source.connect(this.channelBGain.input ?? (this.channelBGain as unknown as AudioNode));
    return this;
  }

  /**
   * Soft-crossfade to one channel (animate over duration)
   */
  soften(toChannel: 'A' | 'B', duration: number = 0.5): void {
    const targetPosition = toChannel === 'A' ? -1 : 1;
    const now = Tone.now();

    // Use exponential ramp for smooth fade
    this.channelAGain.gain.exponentialRampToValueAtTime(
      toChannel === 'A' ? 1 : 0.01,
      now + duration
    );
    this.channelBGain.gain.exponentialRampToValueAtTime(
      toChannel === 'B' ? 1 : 0.01,
      now + duration
    );

    // Update state after animation
    setTimeout(() => this.setPosition(targetPosition), duration * 1000);
  }

  /**
   * Hard-cut to one channel (instant)
   */
  cut(toChannel: 'A' | 'B'): void {
    const position = toChannel === 'A' ? -1 : 1;
    this.setPosition(position);
  }

  /**
   * Get current latency measurement
   */
  getLatency(): number {
    return this.state.latency;
  }

  /**
   * Enable/disable latency monitoring
   */
  setMeasureLatency(enabled: boolean): void {
    this.measureLatency = enabled;
  }

  /**
   * Reset to center position
   */
  reset(): void {
    this.setPosition(0);
  }

  /**
   * Disconnect and cleanup
   */
  dispose(): void {
    this.channelAGain.disconnect();
    this.channelBGain.disconnect();
    this.output.disconnect();
  }
}

/**
 * Crossfader curve presets
 */
export const CROSSFADER_CURVES = {
  linear: 'Linear - Balanced fade',
  easein: 'Ease-in - Slow start, fast end',
  easeout: 'Ease-out - Fast start, slow end',
  smooth: 'Smooth - Traditional DJ curve',
} as const;