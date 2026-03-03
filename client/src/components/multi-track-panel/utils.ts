// utils.ts - Utility functions

import type { TimeFormat, AdvancedTrack, AudioClip } from './types';

/**
 * Format time in seconds to various display formats
 */
export function formatTime(seconds: number, format: TimeFormat = 'bars', tempo: number = 120): string {
  switch (format) {
    case 'bars': {
      const beatsPerSecond = tempo / 60;
      const totalBeats = seconds * beatsPerSecond;
      const bars = Math.floor(totalBeats / 4) + 1;
      const beats = Math.floor(totalBeats % 4) + 1;
      const ticks = Math.floor((totalBeats % 1) * 480);
      return `${bars}:${beats}:${ticks.toString().padStart(3, '0')}`;
    }
    
    case 'seconds': {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    
    case 'samples': {
      const samples = Math.floor(seconds * 48000);
      return samples.toLocaleString();
    }
    
    case 'smpte': {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const frames = Math.floor((seconds % 1) * 30);
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    }
    
    default:
      return '0:0:000';
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert linear gain to decibels
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}

/**
 * Convert decibels to linear gain
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Get track by ID
 */
export function findTrackById(tracks: AdvancedTrack[], id: string): AdvancedTrack | undefined {
  return tracks.find(track => track.id === id);
}

/**
 * Get clip by ID across all tracks
 */
export function findClipById(tracks: AdvancedTrack[], clipId: string): { track: AdvancedTrack; clip: AudioClip } | null {
  for (const track of tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) {
      return { track, clip };
    }
  }
  return null;
}

/**
 * Calculate peak meter value with decay
 */
export function calculatePeakWithDecay(currentPeak: number, newValue: number, decayRate: number = 0.95): number {
  return Math.max(newValue, currentPeak * decayRate);
}

/**
 * Serialize project to JSON
 */
export function serializeProject(project: any): string {
  return JSON.stringify(project, (key, value) => {
    // Skip AudioBuffer objects as they can't be serialized
    if (key === 'audioBuffer') {
      return undefined;
    }
    return value;
  }, 2);
}

/**
 * Download data as file
 */
export function downloadFile(data: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}