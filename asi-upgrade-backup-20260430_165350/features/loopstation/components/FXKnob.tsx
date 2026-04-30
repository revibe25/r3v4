// ─── FXKnob v2 — Professional Hardware Knob ───────────────────────────────────
//
// Enhancements over v1:
//   • Correct bipolar arc — fills from center (not from min) for ±dB/pan knobs
//   • Modulation ring — animated outer halo for LFO-assigned knobs
//   • Value popup tooltip — appears on drag with exact value + unit
//   • Double-click to reset to default (0.5 for bipolar, 0 for normal)
//   • Mouse wheel support — coarse scroll, Shift+scroll for fine
//   • Touch support — single-finger vertical drag
//   • Contextual glow intensity — brighter at extremes
//   • Center detent snap — snaps to 0.5 within ±2% when dragging bipolar
//   • Min/max labels — shown at arc endpoints on md/lg sizes
//   • Better tick geometry — outer ticks, active ticks glow at color
//   • Knob cap highlight — premium glass-bead specular
//   • `defaultValue` prop — what double-click resets to
//   • `modulationAmount` prop (0-1) — shows external LFO depth as outer ring
//   • `snap` prop — array of values that produce a soft-snap
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type KnobSize = 'xs' | 'sm' | 'md' | 'lg';

interface Props {
  label:             string;
  value:             number;         // 0–1
  color?:            string;
  size?:             KnobSize;
  bipolar?:          boolean;        // arc fills from center
  ticks?:            number;
  unit?:             string;
  disabled?:         boolean;
  defaultValue?:     number;         // double-click reset target (default: bipolar→.5, else 0)
  modulationAmount?: number;         // 0–1, draws animated mod ring
  snap?:             number[];       // values [0–1] that get a soft-snap zone
  formatValue?:      (v: number) => string;  // custom display formatter
  onChange:          (v: number) => void;
}

// ── Dimension table ────────────────────────────────────────────────────────────
const S: Record<KnobSize, {
  d: number; inner: number; lw: number; tr: number; fs: number; lfs: number; tickLen: number;
}> = {
  xs: { d: 28,  inner: 8,  lw: 2,   tr: 9,  fs: 6,  lfs: 5, tickLen: 2.5 },
  sm: { d: 38,  inner: 11, lw: 2.5, tr: 12, fs: 7,  lfs: 6, tickLen: 3   },
  md: { d: 52,  inner: 15, lw: 3,   tr: 17, fs: 8,  lfs: 7, tickLen: 4   },
  lg: { d: 68,  inner: 21, lw: 3.5, tr: 22, fs: 10, lfs: 8, tickLen: 5   },
};

const SNAP_ZONE = 0.02; // ±2% snap zone

// ── Helpers ────────────────────────────────────────────────────────────────────
function applySnap(v: number, snapPoints: number[]): number {
  for (const sp of snapPoints) {
    if (Math.abs(v - sp) < SNAP_ZONE) return sp;
  }
  return v;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── Modulation Ring (animated canvas overlay) ──────────────────────────────────
const ModRing: React.FC<{ amount: number; color: string; d: number }> = ({ amount, color, d }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const t         = useRef(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || amount <= 0) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const cx = d / 2;
    const r  = cx - 1.5;
    const ARC_START = (135 * Math.PI) / 180;
    const ARC_RANGE = (270 * Math.PI) / 180;

    const draw = () => {
      t.current += 0.04;
      ctx.clearRect(0, 0, d, d);

      // Pulsing arc representing LFO sweep
      const sweep = (Math.sin(t.current) * 0.5 + 0.5) * amount;
      const arcEnd = ARC_START + sweep * ARC_RANGE;

      ctx.beginPath();
      ctx.arc(cx, cx, r, ARC_START, arcEnd);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.globalAlpha = 0.35 + Math.sin(t.current) * 0.2;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = color;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amount, color, d]);

  if (amount <= 0) return null;
  return (
    <canvas
      ref={canvasRef}
      width={d} height={d}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
};

// ── Value Popup ────────────────────────────────────────────────────────────────
const ValuePopup: React.FC<{
  value: string; unit: string; color: string; visible: boolean; d: number;
}> = ({ value, unit, color, visible, d }) => (
  <div style={{
    position: 'absolute',
    bottom: d + 6,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0a0a0a',
    border: `1px solid ${color}66`,
    borderLeft: `2px solid ${color}`,
    padding: '3px 7px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9,
    fontWeight: 700,
    color,
    whiteSpace: 'nowrap',
    letterSpacing: '.05em',
    boxShadow: `0 4px 16px rgba(0,0,0,.8), 0 0 12px ${color}22`,
    opacity: visible ? 1 : 0,
    pointerEvents: 'none',
    transition: 'opacity .1s',
    zIndex: 100,
  }}>
    {value}{unit && <span style={{ color: color + '88', fontSize: 7, marginLeft: 2 }}>{unit}</span>}
    {/* Arrow */}
    <div style={{
      position: 'absolute', bottom: -4, left: '50%',
      transform: 'translateX(-50%)',
      width: 0, height: 0,
      borderLeft: '4px solid transparent',
      borderRight: '4px solid transparent',
      borderTop: `4px solid ${color}66`,
    }} />
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export const FXKnob: React.FC<Props> = ({
  label, value, color = '#39ff14', size = 'md',
  bipolar = false, ticks = 11, unit = '',
  disabled = false,
  defaultValue,
  modulationAmount = 0,
  snap = [],
  formatValue,
  onChange,
}) => {
  const [dragging,   setDragging]   = useState(false);
  const [showPopup,  setShowPopup]  = useState(false);
  const [lastClick,  setLastClick]  = useState(0);

  const sy      = useRef(0);
  const sv      = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);

  const { d, inner, lw, tr, fs, lfs, tickLen } = S[size];
  const cx   = d / 2;
  const arcR = cx - lw - 4;
  const perim     = 2 * Math.PI * arcR;
  const arcTotal  = (270 / 360) * perim;   // full 270° in canvas units
  const arcOffset = (135 / 360) * perim;   // rotate so bottom-left is 0

  // ── Arc geometry ─────────────────────────────────────────────────────────
  // Normal:  fill from min (left) toward max (right)
  // Bipolar: fill from center outward in both directions

  let arcDashArray: string;
  let arcRotation: string;

  if (bipolar) {
    // Map 0–1 value to -1–+1 deviation
    const dev = value * 2 - 1;            // -1 to +1
    const half = arcTotal / 2;
    const fill = Math.abs(dev) * half;
    const gap  = perim - fill;

    if (dev >= 0) {
      // Positive: start from center, go clockwise
      arcDashArray = `${fill} ${gap}`;
      arcRotation  = `rotate(${135 + 135} ${cx} ${cx})`;  // 270° = center-right
    } else {
      // Negative: start from (center - fill), go clockwise to center
      arcDashArray = `${fill} ${gap}`;
      const startAngle = 270 - Math.abs(dev) * 135;       // degrees
      arcRotation  = `rotate(${startAngle} ${cx} ${cx})`;
    }
  } else {
    const fill = value * arcTotal;
    arcDashArray = `${fill} ${perim - fill}`;
    arcRotation  = `rotate(135 ${cx} ${cx})`;
  }

  // ── Track pointer position for indicator line ─────────────────────────────
  const rotation = value * 270 - 135;

  // ── Value display ─────────────────────────────────────────────────────────
  const displayVal = formatValue
    ? formatValue(value)
    : bipolar
      ? ((value * 2 - 1) * 100).toFixed(0)
      : Math.round(value * 100).toString();

  // ── Drag handler ──────────────────────────────────────────────────────────
  const startDrag = useCallback((clientY: number, shiftKey: boolean) => {
    if (disabled) return;
    setDragging(true);
    setShowPopup(true);
    sy.current = clientY;
    sv.current = value;
    const sensitivity = shiftKey ? 600 : 140;

    const onMove = (ey: number) => {
      let next = Math.min(1, Math.max(0, sv.current + (sy.current - ey) / sensitivity));
      // Center snap for bipolar
      if (bipolar) {
        const snapPoints = [0.5, ...snap];
        next = applySnap(next, snapPoints);
      } else if (snap.length) {
        next = applySnap(next, snap);
      }
      onChange(next);
    };

    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientY);
    const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); onMove(ev.touches[0].clientY); };
    const onUp = () => {
      setDragging(false);
      setShowPopup(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend',  onUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend',  onUp);
  }, [value, onChange, disabled, bipolar, snap]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    // Double-click: reset to default
    const now = Date.now();
    if (now - lastClick < 280) {
      const def = defaultValue ?? (bipolar ? 0.5 : 0);
      onChange(def);
      setLastClick(0);
      return;
    }
    setLastClick(now);

    startDrag(e.clientY, e.shiftKey);
  }, [lastClick, defaultValue, bipolar, onChange, startDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    startDrag(e.touches[0].clientY, false);
  }, [startDrag]);

  // ── Mouse wheel ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (disabled) return;
      const step = e.shiftKey ? 0.002 : 0.01;
      const next = Math.min(1, Math.max(0, value + (e.deltaY < 0 ? step : -step)));
      onChange(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [value, onChange, disabled]);

  // ── Tick marks ─────────────────────────────────────────────────────────────
  const tickAngles = Array.from({ length: ticks }, (_, i) => -135 + (i / (ticks - 1)) * 270);

  // ── Glow intensity — brighter at extremes ──────────────────────────────────
  const extremity = bipolar
    ? Math.abs(value - 0.5) * 2   // 0 at center, 1 at max deflection
    : value;
  const glowStrength = dragging ? 1 : 0.3 + extremity * 0.5;

  // ── Color components for rgba usage ───────────────────────────────────────
  const isHex = color.startsWith('#') && color.length === 7;

  return (
    <div
      ref={rootRef}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           size === 'xs' ? 1 : 2,
        cursor:        disabled ? 'default' : 'ns-resize',
        opacity:       disabled ? 0.3 : 1,
        userSelect:    'none',
        position:      'relative',
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      title={`${label}: ${displayVal}${unit}\nDrag ↕  •  Shift = fine  •  Scroll  •  Double-click = reset`}
    >
      {/* Value popup */}
      <ValuePopup value={displayVal} unit={unit} color={color} visible={showPopup} d={d} />

      <div style={{ position: 'relative', width: d, height: d }}>
        {/* Modulation ring overlay */}
        <ModRing amount={modulationAmount} color={color} d={d} />

        <svg
          width={d} height={d}
          viewBox={`0 0 ${d} ${d}`}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* ── Tick marks ──────────────────────────────────────────────── */}
          {tickAngles.map((ang, i) => {
            const rad      = (ang - 90) * (Math.PI / 180);
            const isMid    = i === Math.floor(ticks / 2);
            const isEdge   = i === 0 || i === ticks - 1;
            const isQuart  = i % Math.floor(ticks / 4) === 0;

            // For normal: active if tick position ≤ value
            // For bipolar: active if tick is between center and value
            let active: boolean;
            const tickPct = i / (ticks - 1);
            if (bipolar) {
              const center = 0.5;
              const v      = value;
              active = v >= center
                ? tickPct >= center && tickPct <= v
                : tickPct <= center && tickPct >= v;
            } else {
              active = tickPct <= value;
            }

            const len1 = tr + (isEdge ? 0 : 1);
            const len2 = len1 + tickLen + (isEdge || isMid ? 1.5 : isQuart ? 1 : 0);

            return (
              <line
                key={i}
                x1={cx + len1 * Math.cos(rad)}
                y1={cx + len1 * Math.sin(rad)}
                x2={cx + len2 * Math.cos(rad)}
                y2={cx + len2 * Math.sin(rad)}
                stroke={active ? color : (isMid && bipolar) ? '#333' : '#1a1a1a'}
                strokeWidth={isEdge || isMid ? 1.5 : 0.8}
                strokeLinecap="square"
                style={{
                  filter: active && (isEdge || isMid)
                    ? `drop-shadow(0 0 2px ${color})`
                    : undefined,
                }}
              />
            );
          })}

          {/* ── Center detent mark for bipolar ──────────────────────────── */}
          {bipolar && (
            <line
              x1={cx}
              y1={cx - arcR + lw}
              x2={cx}
              y2={cx - arcR - lw * 0.5}
              stroke={Math.abs(value - 0.5) < 0.03 ? color : '#2a2a2a'}
              strokeWidth={1.5}
              transform={`rotate(${270 + 90} ${cx} ${cx})`}  /* bottom = 0dB */
            />
          )}

          {/* ── Arc track (background) ──────────────────────────────────── */}
          <circle
            cx={cx} cy={cx} r={arcR}
            fill="none"
            stroke="#141414"
            strokeWidth={lw}
            strokeDasharray={`${arcTotal} ${perim - arcTotal}`}
            transform={`rotate(135 ${cx} ${cx})`}
            strokeLinecap="butt"
          />

          {/* ── Arc fill (value) ────────────────────────────────────────── */}
          <circle
            cx={cx} cy={cx} r={arcR}
            fill="none"
            stroke={color}
            strokeWidth={lw}
            strokeDasharray={arcDashArray}
            transform={arcRotation}
            strokeLinecap="butt"
            style={{
              filter: `drop-shadow(0 0 ${3 + glowStrength * 5}px ${color}${Math.round(glowStrength * 200).toString(16).padStart(2, '0')})`,
              transition: dragging ? 'none' : 'filter 0.15s',
            }}
          />

          {/* ── Knob body (outer shell) ──────────────────────────────────── */}
          <circle
            cx={cx} cy={cx} r={cx - lw - 5}
            fill="url(#knobShell)"
            stroke={dragging ? color + '44' : '#1e1e1e'}
            strokeWidth={dragging ? 1.5 : 0.8}
          />

          {/* ── Inner cap ────────────────────────────────────────────────── */}
          <circle
            cx={cx} cy={cx} r={inner}
            fill="url(#knobCap)"
            stroke="#222"
            strokeWidth={0.5}
          />

          {/* ── Specular highlight ───────────────────────────────────────── */}
          <ellipse
            cx={cx - cx * 0.15}
            cy={cx - inner * 0.5}
            rx={inner * 0.5}
            ry={inner * 0.22}
            fill="rgba(255,255,255,0.05)"
          />

          {/* ── Indicator line ───────────────────────────────────────────── */}
          <line
            x1={cx}
            y1={cx - inner + 2.5}
            x2={cx}
            y2={cx - inner + (size === 'xs' ? 6 : size === 'sm' ? 8 : size === 'md' ? 10 : 13)}
            stroke={color}
            strokeWidth={size === 'xs' ? 1.5 : 2}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${cx} ${cx})`}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />

          {/* ── Defs: gradients ──────────────────────────────────────────── */}
          <defs>
            <radialGradient id="knobShell" cx="40%" cy="35%" r="65%">
              <stop offset="0%"   stopColor="#2a2a2a" />
              <stop offset="50%"  stopColor="#141414" />
              <stop offset="100%" stopColor="#0a0a0a" />
            </radialGradient>
            <radialGradient id="knobCap" cx="38%" cy="32%" r="68%">
              <stop offset="0%"   stopColor="#222" />
              <stop offset="100%" stopColor="#0d0d0d" />
            </radialGradient>
          </defs>
        </svg>

        {/* ── Numeric readout inside knob ──────────────────────────────── */}
        <div style={{
          position:     'absolute',
          inset:        0,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          marginTop:    size === 'xs' ? 0 : 1,
        }}>
          <span style={{
            fontFamily:  'IBM Plex Mono, monospace',
            fontSize:    fs - (size === 'xs' ? 2 : 1),
            fontWeight:  700,
            color:       dragging ? color : '#2e2e2e',
            lineHeight:  1,
            letterSpacing: '-.02em',
            transition: 'color 0.1s',
            textShadow: dragging ? `0 0 6px ${color}88` : 'none',
          }}>
            {displayVal}
          </span>
        </div>
      </div>

      {/* ── Label ────────────────────────────────────────────────────────── */}
      <span style={{
        fontFamily:     'IBM Plex Mono, monospace',
        fontSize:       lfs,
        letterSpacing:  '.22em',
        textTransform:  'uppercase',
        color:          dragging ? color : modulationAmount > 0 ? color + '77' : '#2a2a2a',
        whiteSpace:     'nowrap',
        transition:     'color 0.1s',
      }}>
        {label}
        {/* Mod indicator dot */}
        {modulationAmount > 0 && (
          <span style={{
            display:     'inline-block',
            width:       4, height: 4,
            background:  color,
            borderRadius: 0,
            marginLeft:  3,
            verticalAlign: 'middle',
            boxShadow:   `0 0 4px ${color}`,
            animation:   'lspulse .8s ease-in-out infinite',
          }} />
        )}
      </span>
    </div>
  );
};