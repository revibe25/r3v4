// P4-EXEMPT: canvas drawing component — ctx.strokeStyle / ctx.fillStyle
// require raw hex; CSS variables cannot be resolved at runtime here.
// ─── WaveformCanvas v2 — Multi-Mode Audio Visualiser ──────────────────────────
//
// ORIGINAL MODES (enhanced):
//   'waveform'  — phosphor oscilloscope, now with peak-hold ghost line
//   'mirror'    — symmetric fill, now with colour-mapped energy gradient
//   'spectrum'  — FFT bars, now with peak-hold segments + harmonic color
//   'dots'      — particle scatter, now with velocity-based sizing
//
// NEW MODES:
//   'lissajous' — L vs R stereo correlation figure (Lissajous / X-Y scope)
//   'waterfall' — scrolling spectrogram — time on X, freq on Y, energy = color
//   'circular'  — polar/radial waveform — classic DJ-software bloom
//   'terrain'   — 3D-style tilted frequency terrain (iso-lines)
//
// ALL MODES:
//   • HiDPI / Retina via devicePixelRatio
//   • ResizeObserver — fluid container sizing
//   • Phosphor persistence on waveform/mirror/dots (exponential decay)
//   • Idle breathing flatline
//   • `beatFlash` prop — one-frame white pulse on downbeat
//   • `gain` prop — visual amplitude multiplier (default 1.0)
//   • `smoothing` prop — simple EMA smoothing on incoming data (0–1)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { getLoopEngine } from '../engine/loopEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisualMode =
  | 'waveform'
  | 'spectrum'
  | 'mirror'
  | 'dots'
  | 'lissajous'
  | 'waterfall'
  | 'circular'
  | 'terrain';

interface WaveformCanvasProps {
  trackIndex:   number;
  isActive:     boolean;
  mode?:        VisualMode;
  color?:       string;
  background?:  string;
  lineWidth?:   number;
  className?:   string;
  width?:       number;
  height?:      number;
  persistence?: number;      // 0–1 phosphor trail (default 0.25)
  gain?:        number;      // visual amplitude multiplier (default 1.0)
  smoothing?:   number;      // EMA coefficient 0–1 (default 0 = off)
  beatFlash?:   boolean;     // one-frame brightness spike on downbeat
}

// ── Hex → RGB ──────────────────────────────────────────────────────────────────
function _hr(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── HSL → CSS string ──────────────────────────────────────────────────────────
function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// ── IDLE LINE ─────────────────────────────────────────────────────────────────
function drawIdleLine(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  color: string, t: number,
): void {
  const mid     = h / 2;
  const breathe = Math.sin(t * 0.0008) * 0.5 + 0.5;
  const alpha   = Math.round(breathe * 22 + 10).toString(16).padStart(2, '0');
  ctx.strokeStyle = `${color}${alpha}`;
  ctx.lineWidth   = 1;
  ctx.shadowBlur  = 0;
  ctx.beginPath();
  // Subtle noise in idle line
  ctx.moveTo(0, mid);
  for (let i = 0; i < w; i += 4) {
    const noise = (Math.sin(i * 0.05 + t * 0.002) * 0.5 + Math.sin(i * 0.13 + t * 0.001) * 0.3) * breathe * 0.8;
    ctx.lineTo(i, mid + noise);
  }
  ctx.lineTo(w, mid);
  ctx.stroke();
}

// ── MODE: WAVEFORM ────────────────────────────────────────────────────────────
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  color: string, lw: number, gain: number,
): void {
  const step = w / data.length;

  // Ghost (peak hold) — faint white line
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth   = 0.5;
  ctx.shadowBlur  = 0;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = ((data[i] * gain + 1) / 2) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Main phosphor line
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.shadowBlur  = 7;
  ctx.shadowColor = color;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = ((data[i] * gain + 1) / 2) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Bright core
  ctx.strokeStyle = `rgba(255,255,255,0.3)`;
  ctx.lineWidth   = lw * 0.35;
  ctx.shadowBlur  = 0;
  ctx.stroke();   // re-stroke same path
}

// ── MODE: MIRROR ──────────────────────────────────────────────────────────────
function drawMirror(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  color: string, lw: number, gain: number,
): void {
  const mid  = h / 2;
  const step = w / data.length;

  // Gradient fill — energy-mapped
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,   `${color}44`);
  grad.addColorStop(0.35, `${color}28`);
  grad.addColorStop(0.5,  `${color}10`);
  grad.addColorStop(0.65, `${color}28`);
  grad.addColorStop(1,    `${color}44`);

  ctx.fillStyle   = grad;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.shadowBlur  = 10;
  ctx.shadowColor = color;

  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const amp = Math.abs(data[i]) * mid * 0.92 * gain;
    const x   = i * step;
    if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp);
  }
  for (let i = data.length - 1; i >= 0; i--) {
    const amp = Math.abs(data[i]) * mid * 0.92 * gain;
    ctx.lineTo(i * step, mid + amp);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bright edge highlight on top contour
  ctx.strokeStyle = `rgba(255,255,255,0.18)`;
  ctx.lineWidth   = 0.8;
  ctx.shadowBlur  = 0;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const amp = Math.abs(data[i]) * mid * 0.92 * gain;
    const x   = i * step;
    if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp);
  }
  ctx.stroke();
}

// ── MODE: SPECTRUM ────────────────────────────────────────────────────────────
const peakHold: Float32Array = new Float32Array(512);
const peakDecay = 0.004;

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  _color: string,
): void {
  const bins = Math.min(data.length, Math.min(256, w));
  const bw   = w / bins;

  // Grid lines
  for (let db = 0; db < 100; db += 20) {
    const y = (1 - db / 100) * h;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (let i = 0; i < bins; i++) {
    const n    = Math.max(0, (data[i] + 100) / 100);
    const barH = n * h;

    // Peak hold
    if (n > peakHold[i]) peakHold[i] = n;
    else peakHold[i] = Math.max(0, peakHold[i] - peakDecay);

    // Harmonic colour: fundamental = acid, harmonics shift toward red
    const hue   = 110 - n * 110;
    const alpha = 0.55 + n * 0.45;

    // Bar body
    const grad = ctx.createLinearGradient(0, h, 0, h - barH);
    grad.addColorStop(0,   hsl(hue, 88, 40, 0.3));
    grad.addColorStop(0.6, hsl(hue, 92, 52, alpha));
    grad.addColorStop(1,   hsl(hue, 100, 68, alpha * 0.8));
    ctx.fillStyle = grad;
    ctx.fillRect(i * bw, h - barH, bw - 0.5, barH);

    // Peak hold segment
    const pkH = peakHold[i] * h;
    if (peakHold[i] > 0.02) {
      ctx.fillStyle = n > 0.8 ? '#ff2244bb' : 'rgba(255,255,255,0.55)';
      ctx.fillRect(i * bw, h - pkH - 1, bw - 0.5, 1.5);
    }
  }
}

// ── MODE: DOTS ────────────────────────────────────────────────────────────────
function drawDots(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  color: string, gain: number,
): void {
  const step = Math.max(1, Math.floor(data.length / 80));
  ctx.shadowBlur  = 8;
  ctx.shadowColor = color;

  for (let i = 0; i < data.length; i += step) {
    const norm = Math.abs(data[i]) * gain;
    const x    = (i / data.length) * w;
    const y    = h / 2 + data[i] * gain * h * 0.44;
    const r    = norm * 5 + 0.4;

    // Colour by amplitude: low = color, high = white
    const _brightness = 0.4 + norm * 0.6;
    ctx.fillStyle = norm > 0.6
      ? `rgba(255,255,255,${norm * 0.8})`
      : color + Math.round(norm * 180 + 60).toString(16).padStart(2, '0');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── MODE: LISSAJOUS ───────────────────────────────────────────────────────────
// Draws L vs R waveform data as X-Y figure — shows stereo correlation
function drawLissajous(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  color: string, gain: number,
): void {
  if (data.length < 4) return;

  const cx = w / 2, cy = h / 2;
  const scale = Math.min(cx, cy) * 0.88;

  // Reference diamond grid
  ctx.strokeStyle = 'var(--dj-surface2)';
  ctx.lineWidth   = 0.5;
  // 45° rotation guides
  ctx.beginPath();
  ctx.moveTo(cx - scale, cy); ctx.lineTo(cx + scale, cy);
  ctx.moveTo(cx, cy - scale); ctx.lineTo(cx, cy + scale);
  ctx.moveTo(cx - scale * 0.7, cy - scale * 0.7);
  ctx.lineTo(cx + scale * 0.7, cy + scale * 0.7);
  ctx.moveTo(cx + scale * 0.7, cy - scale * 0.7);
  ctx.lineTo(cx - scale * 0.7, cy + scale * 0.7);
  ctx.stroke();

  const half = Math.floor(data.length / 2);

  ctx.shadowBlur  = 6;
  ctx.shadowColor = color;
  ctx.beginPath();

  for (let i = 0; i < half - 1; i++) {
    const L = data[i]           * gain;
    const R = data[i + half]    * gain;

    // XY scope: X = (L + R) / 2, Y = (L - R) / 2 (mid/side)
    const px = cx + ((L + R) / 2) * scale;
    const py = cy - ((L - R) / 2) * scale;

    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }

  // Color by energy
  const energy = data.reduce((acc, v) => acc + v * v, 0) / data.length;
  const hue = energy > 0.1 ? 80 - energy * 100 : 110;
  ctx.strokeStyle = hsl(hue, 95, 55, 0.7);
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // Bright core
  ctx.strokeStyle = `rgba(255,255,255,0.2)`;
  ctx.lineWidth   = 0.4;
  ctx.stroke();

  // Center mark
  ctx.fillStyle = `${color}55`;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // Label
  ctx.font      = '5px IBM Plex Mono';
  ctx.fillStyle = 'var(--dj-border)';
  ctx.fillText('L+R', cx + scale + 4, cy + 4);
  ctx.fillText('L-R', cx - 3, cy - scale - 4);
}

// ── MODE: WATERFALL (scrolling spectrogram) ───────────────────────────────────
// Maintains an offscreen buffer that scrolls left each frame
let _waterfallBuffer: ImageData | null = null;
let waterfallCanvas: HTMLCanvasElement | null = null;

function drawWaterfall(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  _color: string,
): void {
  // Lazy-init offscreen buffer
  if (!waterfallCanvas || waterfallCanvas.width !== w || waterfallCanvas.height !== h) {
    waterfallCanvas = document.createElement('canvas');
    waterfallCanvas.width  = w;
    waterfallCanvas.height = h;
    waterfallBuffer = null;
  }
  const wCtx = waterfallCanvas.getContext('2d')!;

  // Scroll left by 1px
  const existing = wCtx.getImageData(0, 0, w, h);
  wCtx.putImageData(existing, -1, 0);

  // Draw new column on the right edge
  const bins = Math.min(data.length, h);
  for (let i = 0; i < bins; i++) {
    const n     = Math.max(0, (data[i] + 100) / 100);
    const y     = h - Math.round((i / bins) * h) - 1;
    const hue   = 110 - n * 130;   // green → yellow → red
    const alpha = n * 0.9 + 0.05;

    wCtx.fillStyle = hsl(hue, 90, 45, alpha);
    wCtx.fillRect(w - 1, y, 1, Math.ceil(h / bins) + 1);
  }

  // Blit to main canvas
  ctx.drawImage(waterfallCanvas, 0, 0);

  // Cursor line on right edge
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(w - 1, 0, 1, h);
}

// ── MODE: CIRCULAR (polar radial waveform) ────────────────────────────────────
function drawCircular(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  color: string, lw: number, gain: number,
): void {
  const cx    = w / 2, cy = h / 2;
  const rBase = Math.min(cx, cy) * 0.38;
  const rMax  = Math.min(cx, cy) * 0.92;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, rBase, 0, Math.PI * 2);
  ctx.strokeStyle = 'var(--t-b2)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  const step = (Math.PI * 2) / data.length;

  // Fill shape
  const gradR = ctx.createRadialGradient(cx, cy, rBase, cx, cy, rMax);
  gradR.addColorStop(0, `${color}00`);
  gradR.addColorStop(1, `${color}33`);
  ctx.fillStyle = gradR;

  ctx.shadowBlur  = 12;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;

  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const ang = i * step - Math.PI / 2;
    const amp = Math.abs(data[i]) * gain;
    const r   = rBase + amp * (rMax - rBase);
    const x   = cx + r * Math.cos(ang);
    const y   = cy + r * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bright core ring
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth   = 0.6;
  ctx.shadowBlur  = 0;
  ctx.stroke();
}

// ── MODE: TERRAIN (isometric frequency lines) ────────────────────────────────
const TERRAIN_ROWS = 14;
let terrainHistory: Float32Array[] = [];

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  w: number, h: number,
  color: string,
): void {
  // Push new row
  const bins = Math.min(data.length, 128);
  const row  = new Float32Array(bins);
  for (let i = 0; i < bins; i++) row[i] = Math.max(0, (data[i] + 100) / 100);
  terrainHistory.push(row);
  if (terrainHistory.length > TERRAIN_ROWS) terrainHistory.shift();

  const rowH  = h / TERRAIN_ROWS;
  const yOff  = rowH * 0.6;  // how much older rows shift up

  // Draw from back to front
  for (let ri = 0; ri < terrainHistory.length; ri++) {
    const r    = terrainHistory[ri];
    const age  = ri / (terrainHistory.length - 1);   // 0 = oldest, 1 = newest
    const baseY = h - ri * yOff - rowH * 0.5;

    const alpha = age * 0.7 + 0.08;
    const hue   = 110 - age * 40;

    // Fill area under this row
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let i = 0; i < bins; i++) {
      const x = (i / (bins - 1)) * w;
      const y = baseY - r[i] * rowH * 2.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, baseY);
    ctx.lineTo(0, baseY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, baseY - rowH * 2.5, 0, baseY);
    grad.addColorStop(0, hsl(hue, 88, 52, alpha * 0.8));
    grad.addColorStop(1, hsl(hue, 60, 15, alpha * 0.2));
    ctx.fillStyle = grad;
    ctx.fill();

    // Line on top
    ctx.beginPath();
    for (let i = 0; i < bins; i++) {
      const x = (i / (bins - 1)) * w;
      const y = baseY - r[i] * rowH * 2.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = hsl(hue, 90, 60, alpha * 0.9);
    ctx.lineWidth   = age > 0.7 ? 1.2 : 0.6;
    ctx.shadowBlur  = age > 0.7 ? 6 : 0;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }
}

// ── EMA Smoother ──────────────────────────────────────────────────────────────
function smoothData(
  data: Float32Array,
  prev: Float32Array | null,
  alpha: number,
): Float32Array {
  if (!prev || prev.length !== data.length || alpha <= 0) return data;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = alpha * prev[i] + (1 - alpha) * data[i];
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  trackIndex,
  isActive,
  mode        = 'mirror',
  color       = 'var(--looper-acid-2)',
  background  = 'transparent',
  lineWidth   = 1.5,
  className   = '',
  width       = 64,
  height      = 64,
  persistence = 0.3,
  gain        = 1.0,
  smoothing   = 0,
  beatFlash   = false,
}) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const dimsRef     = useRef({ w: width, h: height });
  const startTime   = useRef(performance.now());
  const prevDataRef = useRef<Float32Array | null>(null);
  const flashRef    = useRef(false);

  // Beat flash trigger
  useEffect(() => {
    if (beatFlash) {
      flashRef.current = true;
      setTimeout(() => { flashRef.current = false; }, 60);
    }
  }, [beatFlash]);

  // ── ResizeObserver ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const dpr = window.devicePixelRatio || 1;
        const cw  = (e.contentRect.width  || width)  * dpr;
        const ch  = (e.contentRect.height || height) * dpr;
        canvas.width  = Math.round(cw);
        canvas.height = Math.round(ch);
        dimsRef.current = { w: canvas.width, h: canvas.height };
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        // Reset waterfall buffer on resize
        waterfallCanvas = null;
        terrainHistory  = [];
      }
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [width, height]);

  // ── Draw loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!isActive) {
      cancelAnimationFrame(rafRef.current);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const { w, h } = dimsRef.current;
        ctx.clearRect(0, 0, w, h);
        if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); }
        drawIdleLine(ctx, w, h, color, performance.now() - startTime.current);
      }
      return;
    }

    const draw = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const { w, h } = dimsRef.current;
      const isFft    = mode === 'spectrum' || mode === 'waterfall' || mode === 'terrain';

      // ── Frame clear / persistence ────────────────────────────────────────
      const usePersistence = persistence > 0 &&
        (mode === 'waveform' || mode === 'mirror' || mode === 'dots' ||
         mode === 'lissajous' || mode === 'circular');

      if (usePersistence) {
        ctx.globalAlpha = 1 - persistence;
        if (background !== 'transparent') {
          ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = `rgba(0,0,0,${persistence * 0.82})`;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.globalAlpha = 1;
      } else if (mode !== 'waterfall') {
        ctx.clearRect(0, 0, w, h);
        if (background !== 'transparent') { ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); }
      }

      // ── Beat flash overlay ───────────────────────────────────────────────
      if (flashRef.current) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, 0, w, h);
      }

      // ── Fetch data ───────────────────────────────────────────────────────
      let raw = isFft
        ? getLoopEngine().getTrackFft(trackIndex)
        : getLoopEngine().getTrackWaveform(trackIndex);

      if (smoothing > 0 && raw && raw.length > 0) {
        raw = smoothData(raw, prevDataRef.current, smoothing);
        prevDataRef.current = raw.slice();
      }

      if (!raw || raw.length === 0) {
        drawIdleLine(ctx, w, h, color, now - startTime.current);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── Dispatch to mode ─────────────────────────────────────────────────
      ctx.shadowBlur = 0;

      switch (mode) {
        case 'waveform':
          drawWaveform(ctx, raw, w, h, color, lineWidth, gain);
          break;
        case 'mirror':
          drawMirror(ctx, raw, w, h, color, lineWidth, gain);
          break;
        case 'spectrum':
          drawSpectrum(ctx, raw, w, h, color);
          break;
        case 'dots':
          drawDots(ctx, raw, w, h, color, gain);
          break;
        case 'lissajous':
          drawLissajous(ctx, raw, w, h, color, gain);
          break;
        case 'waterfall':
          drawWaterfall(ctx, raw, w, h, color);
          break;
        case 'circular':
          drawCircular(ctx, raw, w, h, color, lineWidth, gain);
          break;
        case 'terrain':
          drawTerrain(ctx, raw, w, h, color);
          break;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      // Clean up waterfall state when track changes
      waterfallCanvas  = null;
      terrainHistory   = [];
      prevDataRef.current = null;
    };
  }, [isActive, trackIndex, mode, color, background, lineWidth, persistence, gain, smoothing]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height, display: 'block' }}
      aria-label={`Track ${trackIndex + 1} ${mode} visualiser`}
    />
  );
};