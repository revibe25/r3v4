// DJ Tempo and Pitch Control
import * as Tone from 'tone';
import { TempoControlState, DJ_CONSTRAINTS } from '@shared/dj.types';

export class TempoControl {
  private playbackRate: number = 1;
  private state: TempoControlState;
  private masterBpm: number;
  private listener: Set<(state: TempoControlState) => void> = new Set();

  constructor(masterBpm: number = 120) {
    this.masterBpm = masterBpm;

    this.state = {
      bpm: masterBpm,
      pitchShift: 0,
      tempoRatio: 1,
      syncToMaster: true,
      beatAligned: true,
    };
  }

  /**
   * Set tempo in BPM
   */
  setBpm(bpm: number): void {
    const clampedBpm = Math.max(
      DJ_CONSTRAINTS.MIN_BPM,
      Math.min(DJ_CONSTRAINTS.MAX_BPM, bpm)
    );

    this.state.bpm = clampedBpm;
    this.updateTempoRatio();
    this.notifyListeners();
  }

  /**
   * Set relative tempo (±50%)
   */
  setTempoRatio(ratio: number): void {
    const clampedRatio = Math.max(0.5, Math.min(2, ratio));
    this.state.tempoRatio = clampedRatio;

    // Recalculate BPM based on ratio
    if (this.state.syncToMaster) {
      this.state.bpm = this.masterBpm * clampedRatio;
    }

    this.updatePlaybackRate();
    this.notifyListeners();
  }

  /**
   * Set pitch shift in semitones (-50 to +50)
   * Independent of tempo
   */
  setPitchShift(semitones: number): void {
    const clampedShift = Math.max(
      DJ_CONSTRAINTS.MIN_PITCH_SHIFT,
      Math.min(DJ_CONSTRAINTS.MAX_PITCH_SHIFT, semitones)
    );

    this.state.pitchShift = clampedShift;
    this.updatePlaybackRate();
    this.notifyListeners();
  }

  /**
   * Adjust tempo by relative percentage
   */
  adjustTempo(percentage: number): void {
    const newRatio = this.state.tempoRatio * (1 + percentage / 100);
    this.setTempoRatio(newRatio);
  }

  /**
   * Adjust pitch by relative percentage
   */
  adjustPitch(percentage: number): void {
    const currentCents = this.state.pitchShift * 100; // Convert to cents
    const newShift = (currentCents + percentage) / 100;
    this.setPitchShift(newShift);
  }

  /**
   * Quick pitch shift by semitones
   */
  quickShift(semitones: number): void {
    this.setPitchShift(this.state.pitchShift + semitones);
  }

  /**
   * Sync to master BPM
   */
  syncToMaster(masterBpm?: number): void {
    if (masterBpm !== undefined) {
      this.masterBpm = masterBpm;
    }

    this.state.syncToMaster = true;
    this.state.bpm = this.masterBpm;
    this.state.tempoRatio = 1;
    this.updateTempoRatio();
    this.notifyListeners();
  }

  /**
   * Enable/disable beat-aligned tempo changes
   */
  setBeatAligned(enabled: boolean): void {
    this.state.beatAligned = enabled;
    this.notifyListeners();
  }

  /**
   * Update playback rate based on tempo and pitch
   */
  private updatePlaybackRate(): void {
    // Tempo ratio * pitch shift factor
    const pitchRatio = Math.pow(2, this.state.pitchShift / 12); // semitones to frequency ratio
    this.playbackRate = this.state.tempoRatio * pitchRatio;
  }

  /**
   * Recalculate tempo ratio from BPM
   */
  private updateTempoRatio(): void {
    if (this.state.syncToMaster) {
      this.state.tempoRatio = this.state.bpm / this.masterBpm;
    }
  }

  /**
   * Get playback rate for audio node
   */
  getPlaybackRate(): number {
    return this.playbackRate;
  }

  /**
   * Get current state
   */
  getState(): TempoControlState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: TempoControlState) => void): () => void {
    this.listener.add(callback);
    return () => this.listener.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listener.forEach((callback) => callback({ ...this.state }));
  }

  /**
   * Reset to master tempo and no pitch shift
   */
  reset(): void {
    this.state.pitchShift = 0;
    this.state.tempoRatio = 1;
    this.state.bpm = this.masterBpm;
    this.state.syncToMaster = true;
    this.updatePlaybackRate();
    this.notifyListeners();
  }

  /**
   * Calculate time to reach target BPM (for acceleration)
   */
  calculateAccelTime(targetBpm: number, accelerationMs: number): number {
    // Linear acceleration from current to target
    return accelerationMs;
  }

  /**
   * Accelerate/decelerate to target tempo
   */
  accelerateToTempo(targetBpm: number, durationMs: number): void {
    const startBpm = this.state.bpm;
    const steps = 30; // 30 frames for smooth acceleration
    const stepDuration = durationMs / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const newBpm = startBpm + (targetBpm - startBpm) * progress;
      this.setBpm(newBpm);

      if (currentStep >= steps) {
        clearInterval(interval);
        this.setBpm(targetBpm); // Ensure exact final value
      }
    }, stepDuration);
  }
}

/**
 * Pitch shift constants
 */
export const PITCH_SHIFTS = {
  down2Oct: -24,
  down1Oct: -12,
  down7Semitones: -7,
  down5Semitones: -5,
  down3Semitones: -3,
  downHalfStep: -1,
  neutral: 0,
  upHalfStep: 1,
  up3Semitones: 3,
  up5Semitones: 5,
  up7Semitones: 7,
  up1Oct: 12,
  up2Oct: 24,
} as const;

/**
 * Tempo range presets
 */
export const TEMPO_RANGES = {
  slow: { min: 40, max: 90, label: 'Slow' },
  medium: { min: 90, max: 150, label: 'Medium' },
  fast: { min: 150, max: 180, label: 'Fast' },
  veryFast: { min: 180, max: 240, label: 'Very Fast' },
} as const;