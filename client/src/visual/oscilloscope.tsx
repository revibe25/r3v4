/**
 * client/src/visual/oscilloscope.tsx
 *
 * Real-time waveform oscilloscope rendered on an HTML5 Canvas.
 *
 * §SES.3 BLOCK fixes:
 *   1. devicePixelRatio scaling: canvas.width/height are set to CSS-pixel
 *      dimensions × DPR so the waveform renders crisp on HiDPI/Retina displays.
 *   2. ctx.setTransform(1,0,0,1,0,0) resets the accumulated transform matrix
 *      BEFORE ctx.scale(dpr, dpr) on every render.  Without the reset, each
 *      re-render (when `data` changes but canvas width/height are stable and
 *      therefore not reassigned) stacks the scale: 2× → 4× → 8× … causing the
 *      waveform to shrink progressively until it becomes invisible.
 *   3. Empty-data guard: `if (data.length === 0) return;` prevents a flat
 *      zero-line from being drawn when there is no signal, which would
 *      misrepresent the "no audio" state to the user.
 */

import React, { useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OscilloscopeProps {
  /**
   * Waveform sample data.  Values should be in the range [-1, 1];
   * out-of-range values are clamped at render time.
   */
  data: Float32Array | number[];

  /** Canvas display width in CSS pixels (default 400). */
  width?: number;

  /** Canvas display height in CSS pixels (default 120). */
  height?: number;

  /** Waveform stroke colour (default lime-400). */
  color?: string;

  /** Canvas background fill colour (default near-black). */
  background?: string;

  /** Stroke line width in logical pixels (default 1.5). */
  lineWidth?: number;

  /** Optional ARIA label for accessibility. */
  ariaLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Oscilloscope({
  data,
  width = 400,
  height = 120,
  color = "var(--green-400)",
  background = "#0a0a0a",
  lineWidth = 1.5,
  ariaLabel = "Waveform oscilloscope",
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // §SES.3 BLOCK fix 3: empty-data guard
    // Avoids drawing a misleading flat zero-line when no audio data is available.
    if (data.length === 0) return;

    // §SES.3 BLOCK fix 1: devicePixelRatio scaling
    // Sets the canvas backing store to the physical pixel resolution so the
    // waveform is sharp on HiDPI (Retina) screens.
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;

    // §SES.3 BLOCK fix 2: reset accumulated transform
    // Each render that does NOT resize the canvas element (e.g. data changes
    // while size stays constant) skips the width/height assignment above, so
    // the transform is NOT implicitly reset.  setTransform(identity) ensures
    // we always start from a clean matrix before scaling.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // ── Clear canvas ─────────────────────────────────────────────────────────
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    // ── Draw centre reference line ────────────────────────────────────────────
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // ── Draw waveform ─────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth   = lineWidth;
    ctx.lineJoin    = "round";
    ctx.lineCap     = "round";

    const sliceWidth = width / (data.length - 1 || 1);

    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      // Clamp to [-1, 1] then map to canvas y-coordinate space
      const clamped = Math.max(-1, Math.min(1, sample));
      const y       = ((1 - clamped) / 2) * height;
      const x       = i * sliceWidth;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }, [data, width, height, color, background, lineWidth]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={ariaLabel}
      role="img"
      style={{ display: "block", width, height }}
    />
  );
}

export default Oscilloscope;
