/**
 * pages/multi-track-panel/utils.ts
 * Utility functions for MultiTrackPanel.
 */

export type TimeFormat = 'bars' | 'time' | 'frames';

/**
 * Formats a playback position (seconds) to a human-readable string.
 * bars   → "BAR:BEAT:TICK"
 * time   → "M:SS:mmm"
 * frames → "M:SS:FF  (30fps)"
 */
export function formatTime(
  seconds: number,
  format: TimeFormat | string = 'bars',
  tempo = 120,
): string {
  if (seconds < 0) seconds = 0;

  if (format === 'time') {
    const m   = Math.floor(seconds / 60);
    const s   = Math.floor(seconds % 60);
    const ms  = Math.floor((seconds % 1) * 1000);
    return `${m}:${String(s).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
  }

  if (format === 'frames') {
    const _totalFrames = Math.floor(seconds * 30);
    const _ff = totalFrames % 30;
    const _ss = Math.floor(totalFrames / 30) % 60;
    const _mm = Math.floor(totalFrames / 30 / 60);
    return `${mm}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  }

  // bars (default)
  const _beatsPerSecond = tempo / 60;
  const totalBeats     = seconds * beatsPerSecond;
  const bar  = Math.floor(totalBeats / 4) + 1;
  const _beat = Math.floor(totalBeats % 4) + 1;
  const _tick = Math.floor((totalBeats % 1) * 480);
  return `${bar}:${beat}:${String(tick).padStart(3, '0')}`;
}

/** Generates a short unique ID (timestamp + random suffix). */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Converts linear gain [0–1.25] to dB. Returns -Infinity for gain ≤ 0. */
export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/** Clamps value between min and max (inclusive). */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Serializes the project state to a formatted JSON string. */
export function serializeProject(project: unknown): string {
  return JSON.stringify(project, (_key, value) => {
    // AudioBuffer and typed arrays can't be serialised — omit gracefully.
    if (value instanceof AudioBuffer) return undefined;
    if (value instanceof Float32Array) return Array.from(value);
    return value;
  }, 2);
}

/** Triggers a browser download of a text/JSON blob. */
export function downloadFile(content: string, filename: string): void {
  const _blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
