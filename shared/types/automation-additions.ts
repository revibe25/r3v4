/**
 * shared/types/automation-additions.ts
 *
 * Fixes TS errors in client/src/audio/automation/automation-lane.ts:
 *
 *   error TS2339: Property 'time' does not exist on type 'AutomationPoint'
 *     → AutomationPoint.time was missing; the type had a differently-named
 *       position field (likely `position` or `t`).
 *
 *   error TS2367: comparison of "linear"|"bezier" and "exponential" has no overlap
 *     → The CurveType union was missing "exponential".
 *
 * INSTALLATION:
 *   Option A (preferred): Merge these additions into shared/audio.types.ts
 *              alongside the existing AutomationPoint definition.
 *   Option B:  Add this file to shared/ and re-export from shared/index.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REPLACE the existing AutomationPoint / CurveType in shared/audio.types.ts
 * with the versions below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Curve types ───────────────────────────────────────────────────────────────

/**
 * Interpolation curve between two automation points.
 *
 * §SES.17 fix: "exponential" was missing from the union, causing a TS2367
 * comparison error in automation-lane.ts where the handler checked
 * point.curve === "exponential" against "linear" | "bezier".
 */
export type CurveType = "linear" | "bezier" | "exponential" | "step";

// ── AutomationPoint ───────────────────────────────────────────────────────────

/**
 * A single control point on an automation lane.
 *
 * §SES.17 fix: added the `time` property.
 * automation-lane.ts referenced point.time but AutomationPoint only had
 * a positional field under a different name (e.g. `position` or `t`),
 * causing TS2339 "Property 'time' does not exist" errors on lines 17, 17, 32.
 */
export interface AutomationPoint {
  /** Stable unique ID for this control point. */
  id: string;

  /**
   * Position of the point on the timeline in seconds.
   *
   * §SES.17 BLOCK fix: `time` is now the canonical field name.
   * Update any existing code that used `position` or `t` to use `time`.
   */
  time: number;

  /**
   * Normalised value at this point in the range [0, 1].
   * The lane maps this to the actual parameter range.
   */
  value: number;

  /**
   * Interpolation curve applied from this point to the next.
   * Defaults to "linear" when not specified.
   */
  curve: CurveType;

  /**
   * Control handle offset for bezier curves (in [time, value] units).
   * Ignored for non-bezier curves.
   */
  handleIn?:  [number, number];
  handleOut?: [number, number];
}

// ── AutomationLane ────────────────────────────────────────────────────────────

/** One automation lane tracking a single parameter on a track. */
export interface AutomationLane {
  /** Unique lane ID. */
  id:          string;
  /** ID of the track this lane belongs to. */
  trackId:     string;
  /** Dotted-path parameter name, e.g. "volume", "pan", "eq.lowGain". */
  parameter:   string;
  /** Human-readable parameter label. */
  label:       string;
  /** Minimum parameter value. */
  min:         number;
  /** Maximum parameter value. */
  max:         number;
  /** Default value (used when no automation point covers a time position). */
  defaultValue: number;
  /** Control points, must be sorted by `time` ascending. */
  points:      AutomationPoint[];
}
