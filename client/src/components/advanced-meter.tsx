// AdvancedMeter.tsx
import React, { useEffect, useRef, useCallback } from 'react';

interface AdvancedMeterProps {
  level: number;
  peak: number;
  width?: number;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
  showPeak?: boolean;
  showDb?: boolean;
}

export const AdvancedMeter: React.FC<AdvancedMeterProps> = ({
  level,
  peak,
  width = 20,
  height = 100,
  orientation = 'vertical',
  showPeak = true,
  showDb = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cache ctx and gradient so they're not recreated every frame
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const gradientRef = useRef<CanvasGradient | null>(null);
  const rafRef = useRef<number | null>(null);

  // Internal peak hold state — also respect the incoming peak prop
  const peakHoldRef = useRef<number>(0);
  const peakHoldTimeRef = useRef<number>(0);

  const isVertical = orientation === 'vertical';

  // Rebuild the gradient whenever canvas dimensions or orientation change.
  // drawLength = the axis along which the meter travels.
  const buildGradient = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const drawLength = isVertical ? height : width;

    const gradient = isVertical
      ? ctx.createLinearGradient(0, drawLength, 0, 0)
      : ctx.createLinearGradient(0, 0, drawLength, 0);

    gradient.addColorStop(0,    'var(--accent-green)'); // Green
    gradient.addColorStop(0.6,  'var(--amber-500)'); // Yellow
    gradient.addColorStop(0.85, 'var(--track-orange)'); // Orange
    gradient.addColorStop(1,    '#ef4444'); // Red

    gradientRef.current = gradient;
  }, [isVertical, width, height]);

  // Initialise (or reinitialise) the canvas whenever dimensions/orientation change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    buildGradient();
  }, [width, height, buildGradient]);

  // Main draw function — called via RAF so it never blocks the main thread.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = ctxRef.current;
    const gradient = gradientRef.current;
    if (!canvas || !ctx || !gradient) return;

    // Draw length = the axis along which the meter fills.
    const drawLength = isVertical ? height : width;
    // Draw thickness = the perpendicular axis.
    const drawThick  = isVertical ? width  : height;

    // ── Peak hold ──────────────────────────────────────────────────────────
    const now = Date.now();
    // Use the higher of the incoming peak prop and the internally tracked hold.
    const effectivePeak = Math.max(peak, peakHoldRef.current);

    if (level > peakHoldRef.current) {
      peakHoldRef.current     = level;
      peakHoldTimeRef.current = now;
    } else if (now - peakHoldTimeRef.current > 2000) {
      peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.01);
    }

    // ── Clear ──────────────────────────────────────────────────────────────
    ctx.fillStyle = 'var(--t-b2x)';
    ctx.fillRect(0, 0, width, height);

    // ── Level bar ─────────────────────────────────────────────────────────
    const levelPx = Math.min(level, 1) * drawLength;
    ctx.fillStyle = gradient;

    if (isVertical) {
      ctx.fillRect(0, drawLength - levelPx, drawThick, levelPx);
    } else {
      // Horizontal: fill from left edge, no rotation needed.
      ctx.fillRect(0, 0, levelPx, drawThick);
    }

    // ── Peak indicator ────────────────────────────────────────────────────
    if (showPeak && effectivePeak > 0) {
      const peakPx = effectivePeak * drawLength;
      ctx.fillStyle = 'var(--white)';

      if (isVertical) {
        ctx.fillRect(0, drawLength - peakPx - 2, drawThick, 2);
      } else {
        ctx.fillRect(peakPx - 2, 0, 2, drawThick);
      }
    }

    // ── Scale marks ───────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth   = 1;

    const marks = [0, -6, -12, -18, -24, -30];
    marks.forEach(db => {
      const position = ((db + 60) / 60) * drawLength;

      ctx.beginPath();
      if (isVertical) {
        ctx.moveTo(0,         drawLength - position);
        ctx.lineTo(drawThick, drawLength - position);
      } else {
        ctx.moveTo(position, 0);
        ctx.lineTo(position, drawThick);
      }
      ctx.stroke();
    });

    // ── Clip indicator ────────────────────────────────────────────────────
    if (level >= 0.99) {
      ctx.fillStyle = '#ef4444';
      if (isVertical) {
        // Top 3px
        ctx.fillRect(0, 0, drawThick, 3);
      } else {
        // Rightmost 3px
        ctx.fillRect(drawLength - 3, 0, 3, drawThick);
      }
    }
  }, [level, peak, width, height, isVertical, showPeak]);

  // Schedule a RAF draw whenever props change — never more than one pending frame.
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      draw();
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [draw]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="rounded"
        style={{ display: 'block' }}
      />
      {showDb && (
        <div className="absolute top-0 right-full mr-1 text-xs text-muted-foreground font-mono">
          {(20 * Math.log10(Math.max(level, 0.001))).toFixed(1)} dB
        </div>
      )}
    </div>
  );
};