import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ACID, DJ_SURFACE, DJ_SURFACE2, DJ_BORDER, DJ_DIM,
  KNOB_ARC, KNOB_START, describeArc,
} from './types';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  defaultValue?: number;
  step?: number;
  color?: string;
  size?: number;
}

export function Knob({
  value, min, max, label, onChange, formatValue, defaultValue = 0,
  step = 0.01, color = ACID, size = 72,
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const startY   = useRef(0);
  const _startVal = useRef(0);

  const pct  = (value - min) / (max - min);
  const cx   = size / 2;
  const cy   = size / 2;
  const _arcR = size / 2 - 9;

  const _trackArc = useMemo(
    () => describeArc(cx, cy, arcR, KNOB_START, KNOB_START + KNOB_ARC),
    [cx, cy, arcR],
  );

  const _valueArc = useMemo(() => {
    if (pct < 0.005) return '';
    return describeArc(cx, cy, arcR, KNOB_START, KNOB_START + pct * KNOB_ARC);
  }, [cx, cy, arcR, pct]);

  const _indAngle = KNOB_START + pct * KNOB_ARC;
  const indRad   = (indAngle * Math.PI) / 180;
  const ir       = size / 2 - 18;
  const indX     = cx + ir * Math.cos(indRad);
  const indY     = cy + ir * Math.sin(indRad);
  const ir2      = ir - 9;
  const indX2    = cx + ir2 * Math.cos(indRad);
  const indY2    = cy + ir2 * Math.sin(indRad);

  const _onPointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    startY.current   = e.clientY;
    startVal.current = value;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [value]);

  const _onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging) return;
    const delta  = startY.current - e.clientY;
    const range  = max - min;
    let newVal   = startVal.current + delta * (range / 140);
    newVal = Math.min(max, Math.max(min, newVal));
    if (step) newVal = Math.round(newVal / step) * step;
    onChange(newVal);
  }, [dragging, max, min, onChange, step]);

  const _onPointerUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('pointermove', onPointerMove as any);
      window.addEventListener('pointerup', onPointerUp);
      return () => {
        window.removeEventListener('pointermove', onPointerMove as any);
        window.removeEventListener('pointerup', onPointerUp);
      };
    }
  }, [dragging, onPointerMove, onPointerUp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, userSelect: 'none' }}>
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={() => onChange(defaultValue)}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Tick marks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const frac  = i / 10;
            const a     = ((KNOB_START + frac * KNOB_ARC) * Math.PI) / 180;
            const r1    = size / 2 - 3;
            const r2    = size / 2 - 8;
            const _major = i === 0 || i === 10 || i === 5;
            return (
              <line key={i}
                x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
                x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
                stroke={major ? '#333' : '#222'}
                strokeWidth={major ? 1.5 : 1} strokeLinecap="square"
              />
            );
          })}
          {/* Track arc */}
          <path d={trackArc} fill="none" stroke={DJ_SURFACE2} strokeWidth={3} strokeLinecap="butt" />
          {/* Value arc */}
          {valueArc && (
            <path d={valueArc} fill="none" stroke={color} strokeWidth={3} strokeLinecap="butt" />
          )}
          {/* Knob body */}
          <circle cx={cx} cy={cy} r={size / 2 - 13} fill={DJ_SURFACE} stroke={DJ_BORDER} strokeWidth={1} />
          {/* Indicator line */}
          <line x1={indX2} y1={indY2} x2={indX} y2={indY} stroke={color} strokeWidth={2} strokeLinecap="square" />
          {/* Center dot */}
          <rect x={cx - 2} y={cy - 2} width={4} height={4} fill={color} />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: DJ_DIM }}>
          {label}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1 }}>
          {formatValue ? formatValue(value) : value.toFixed(1)}
        </div>
      </div>
    </div>
  );
}