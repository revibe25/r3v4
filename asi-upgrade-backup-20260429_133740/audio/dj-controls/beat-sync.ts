// DJ Beat Sync and Grid Detection
import { BeatSyncConfig, BeatGrid, BeatGridMarker, DJ_CONSTRAINTS } from '@shared/dj.types';

export class BeatSync {
  private masterBpm: number;
  private config: BeatSyncConfig;
  private beatGrid: BeatGrid | null = null;
  private listener: Set<(grid: BeatGrid | null) => void> = new Set();

  constructor(masterBpm: number = 120) {
    this.masterBpm = masterBpm;

    this.config = {
      enabled: true,
      masterBpm: masterBpm,
      beatDivision: 1,
      snapThreshold: 50, // milliseconds
      autoSync: true,
    };
  }

  /**
   * Set beat sync configuration
   */
  setConfig(config: Partial<BeatSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate beat grid from BPM and duration
   */
  generateBeatGrid(durationSeconds: number, offset: number = 0): BeatGrid {
    const beatDuration = (60 / this.masterBpm) * 1000; // milliseconds
    const markers: BeatGridMarker[] = [];

    let position = offset / 1000; // Convert offset to seconds
    let beatNumber = 0;

    while (position < durationSeconds) {
      markers.push({
        position,
        beatNumber,
        isMajorBeat: beatNumber % 4 === 0, // Major beat every 4 beats (bar)
      });

      position += beatDuration / 1000; // Convert back to seconds
      beatNumber++;
    }

    this.beatGrid = {
      bpm: this.masterBpm,
      downbeatOffset: offset,
      markers,
    };

    this.notifyListeners();
    return this.beatGrid;
  }

  /**
   * Detect beat grid from audio (simplified - would use onset detection in production)
   */
  async detectBeatGrid(audioBuffer: AudioBuffer): Promise<BeatGrid> {
    // Placeholder for actual beat detection
    // In production, use algorithms like:
    // - Onset detection (find transients)
    // - Spectral flux (energy changes)
    // - Autocorrelation (periodic patterns)

    // For now, generate grid based on estimated BPM
    const estimatedBpm = this.masterBpm; // Would be detected from audio
    return this.generateBeatGrid(audioBuffer.duration);
  }

  /**
   * Snap time position to nearest beat
   */
  snapToBeat(timeSeconds: number): number {
    if (!this.beatGrid) {
      return timeSeconds;
    }

    const markers = this.beatGrid.markers;
    let closestMarker = markers[0];
    let minDistance = Math.abs(timeSeconds - closestMarker.position);

    for (const marker of markers) {
      const distance = Math.abs(timeSeconds - marker.position);
      if (distance < minDistance) {
        minDistance = distance;
        closestMarker = marker;
      }
    }

    // Only snap if within threshold
    if (minDistance < this.config.snapThreshold / 1000) {
      return closestMarker.position;
    }

    return timeSeconds;
  }

  /**
   * Snap time position to specific beat division
   */
  snapToBeatDivision(timeSeconds: number, division: number = this.config.beatDivision): number {
    const beatDuration = (60 / this.masterBpm) * division; // seconds
    const snappedTime = Math.round(timeSeconds / beatDuration) * beatDuration;

    return snappedTime;
  }

  /**
   * Calculate time to next beat
   */
  timeToNextBeat(timeSeconds: number): number {
    const beatDuration = 60 / this.masterBpm;
    const beatPosition = timeSeconds % beatDuration;
    return beatDuration - beatPosition;
  }

  /**
   * Calculate time to next major beat (bar)
   */
  timeToNextMajorBeat(timeSeconds: number): number {
    const beatDuration = 60 / this.masterBpm;
    const barDuration = beatDuration * 4;
    const barPosition = timeSeconds % barDuration;
    return barDuration - barPosition;
  }

  /**
   * Get beat number at position
   */
  getBeatNumber(timeSeconds: number): number {
    const beatDuration = 60 / this.masterBpm;
    return Math.floor(timeSeconds / beatDuration);
  }

  /**
   * Get bar number at position
   */
  getBarNumber(timeSeconds: number): number {
    const beatDuration = 60 / this.masterBpm;
    const beatNumber = Math.floor(timeSeconds / beatDuration);
    return Math.floor(beatNumber / 4);
  }

  /**
   * Calculate loop length in beats
   */
  calculateLoopLength(startTime: number, endTime: number): number {
    const beatDuration = 60 / this.masterBpm;
    return (endTime - startTime) / beatDuration;
  }

  /**
   * Align time to nearest beat boundary
   */
  alignToGrid(timeSeconds: number): number {
    if (!this.config.enabled) {
      return timeSeconds;
    }

    return this.snapToBeatDivision(timeSeconds, this.config.beatDivision);
  }

  /**
   * Get beat markers within time range
   */
  getMarkersInRange(startTime: number, endTime: number): BeatGridMarker[] {
    if (!this.beatGrid) {
      return [];
    }

    return this.beatGrid.markers.filter(
      (marker) => marker.position >= startTime && marker.position <= endTime
    );
  }

  /**
   * Get current beat grid
   */
  getBeatGrid(): BeatGrid | null {
    return this.beatGrid ? { ...this.beatGrid } : null;
  }

  /**
   * Update master BPM
   */
  setMasterBpm(bpm: number): void {
    this.masterBpm = bpm;
    this.config.masterBpm = bpm;

    if (this.beatGrid) {
      this.generateBeatGrid(
        this.beatGrid.markers[this.beatGrid.markers.length - 1].position
      );
    }
  }

  /**
   * Subscribe to beat grid changes
   */
  subscribe(callback: (grid: BeatGrid | null) => void): () => void {
    this.listener.add(callback);
    return () => this.listener.delete(callback);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    this.listener.forEach((callback) => callback(this.beatGrid ? { ...this.beatGrid } : null));
  }

  /**
   * Get sync config
   */
  getConfig(): BeatSyncConfig {
    return { ...this.config };
  }

  /**
   * Calculate quantized position
   */
  quantize(timeSeconds: number, grid: 'bar' | 'beat' | 'eighth' | 'sixteenth' = 'beat'): number {
    const beatDuration = 60 / this.masterBpm;

    let divisor: number;
    switch (grid) {
      case 'bar':
        divisor = beatDuration * 4;
        break;
      case 'beat':
        divisor = beatDuration;
        break;
      case 'eighth':
        divisor = beatDuration / 2;
        break;
      case 'sixteenth':
        divisor = beatDuration / 4;
        break;
      default:
        divisor = beatDuration;
    }

    return Math.round(timeSeconds / divisor) * divisor;
  }
}

/**
 * Beat grid visualization helpers
 */
export const BEAT_GRID_HELPERS = {
  getBeatLabel(beatNumber: number): string {
    const beatInBar = beatNumber % 4;
    return `${Math.floor(beatNumber / 4) + 1}.${beatInBar + 1}`;
  },

  getGridColor(isMajor: boolean): string {
    return isMajor ? '#3B82F6' : '#6B7280'; // Blue for major, gray for minor
  },

  getGridSize(isMajor: boolean): number {
    return isMajor ? 8 : 4; // Larger markers for major beats
  },
} as const;