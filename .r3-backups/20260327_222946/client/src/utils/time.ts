/**
 * client/src/utils/time.ts
 *
 * Timeline time ↔ pixel conversion utilities.
 *
 * §SES.15 fixes:
 *   • pixelsToTime / timeToPixels: throw RangeError when zoom ≤ 0 or non-finite
 *     (was silent Infinity / 0 — callers had no signal the zoom was invalid).
 *   • snapToGrid: return `time` unchanged when gridSize ≤ 0
 *     (was Math.round(t / 0) * 0 === NaN — silent corruption of timeline state).
 *
 * All three functions are exported for consumption by the timeline component.
 */

/**
 * Convert a pixel offset to a time value given the current zoom level.
 *
 * `zoom` is pixels-per-second (or pixels-per-beat, depending on context).
 *
 * @throws {RangeError} If zoom is not a finite positive number.
 *
 * @example
 *   pixelsToTime(240, 60)  // → 4  (4 seconds at 60 px/s)
 *   pixelsToTime(100, 0)   // throws RangeError — zoom must be positive
 */
export function pixelsToTime(pixels: number, zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError(
      `pixelsToTime: zoom must be a finite positive number, got ${zoom}`,
    );
  }
  return pixels / zoom;
}

/**
 * Convert a time value to a pixel offset given the current zoom level.
 *
 * @throws {RangeError} If zoom is not a finite positive number.
 *
 * @example
 *   timeToPixels(4, 60)  // → 240  (240 px at 60 px/s)
 *   timeToPixels(4, 0)   // throws RangeError
 */
export function timeToPixels(time: number, zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError(
      `timeToPixels: zoom must be a finite positive number, got ${zoom}`,
    );
  }
  return time * zoom;
}

/**
 * Snap a time value to the nearest grid boundary.
 *
 * Returns `time` unchanged (not NaN) when gridSize ≤ 0.
 * This is a safe no-op — callers that pass a zero grid size want no snapping.
 *
 * @example
 *   snapToGrid(1.7, 0.5)  // → 1.5
 *   snapToGrid(1.7, 0)    // → 1.7  (no-op — §SES.15 WARN fix)
 */
export function snapToGrid(time: number, gridSize: number): number {
  if (gridSize <= 0) return time;
  return Math.round(time / gridSize) * gridSize;
}
