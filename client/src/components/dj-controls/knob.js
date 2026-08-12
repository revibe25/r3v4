import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ACID, DJ_SURFACE, DJ_SURFACE2, DJ_BORDER, DJ_DIM, KNOB_ARC, KNOB_START, describeArc, } from './types';
export function Knob({ value, min, max, label, onChange, formatValue, defaultValue = 0, step = 0.01, color = ACID, size = 72, }) {
    const [dragging, setDragging] = useState(false);
    const startY = useRef(0);
    const startVal = useRef(0);
    const pct = (value - min) / (max - min);
    const cx = size / 2;
    const cy = size / 2;
    const arcR = size / 2 - 9;
    const trackArc = useMemo(() => describeArc(cx, cy, arcR, KNOB_START, KNOB_START + KNOB_ARC), [cx, cy, arcR]);
    const valueArc = useMemo(() => {
        if (pct < 0.005)
            return '';
        return describeArc(cx, cy, arcR, KNOB_START, KNOB_START + pct * KNOB_ARC);
    }, [cx, cy, arcR, pct]);
    const indAngle = KNOB_START + pct * KNOB_ARC;
    const indRad = (indAngle * Math.PI) / 180;
    const ir = size / 2 - 18;
    const indX = cx + ir * Math.cos(indRad);
    const indY = cy + ir * Math.sin(indRad);
    const ir2 = ir - 9;
    const indX2 = cx + ir2 * Math.cos(indRad);
    const indY2 = cy + ir2 * Math.sin(indRad);
    const onPointerDown = useCallback((e) => {
        setDragging(true);
        startY.current = e.clientY;
        startVal.current = value;
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
    }, [value]);
    const onPointerMove = useCallback((e) => {
        if (!dragging)
            return;
        const delta = startY.current - e.clientY;
        const range = max - min;
        let newVal = startVal.current + delta * (range / 140);
        newVal = Math.min(max, Math.max(min, newVal));
        if (step)
            newVal = Math.round(newVal / step) * step;
        onChange(newVal);
    }, [dragging, max, min, onChange, step]);
    const onPointerUp = useCallback(() => setDragging(false), []);
    useEffect(() => {
        if (dragging) {
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            return () => {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
            };
        }
    }, [dragging, onPointerMove, onPointerUp]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, userSelect: 'none' }, children: [_jsx("div", { onPointerDown: onPointerDown, onDoubleClick: () => onChange(defaultValue), style: { cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', width: size, height: size }, children: _jsxs("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, children: [Array.from({ length: 11 }).map((_, i) => {
                            const frac = i / 10;
                            const a = ((KNOB_START + frac * KNOB_ARC) * Math.PI) / 180;
                            const r1 = size / 2 - 3;
                            const r2 = size / 2 - 8;
                            const major = i === 0 || i === 10 || i === 5;
                            return (_jsx("line", { x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a), x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a), stroke: major ? 'var(--dj-dimmer)' : 'var(--dj-border)', strokeWidth: major ? 1.5 : 1, strokeLinecap: "square" }, i));
                        }), _jsx("path", { d: trackArc, fill: "none", stroke: DJ_SURFACE2, strokeWidth: 3, strokeLinecap: "butt" }), valueArc && (_jsx("path", { d: valueArc, fill: "none", stroke: color, strokeWidth: 3, strokeLinecap: "butt" })), _jsx("circle", { cx: cx, cy: cy, r: size / 2 - 13, fill: DJ_SURFACE, stroke: DJ_BORDER, strokeWidth: 1 }), _jsx("line", { x1: indX2, y1: indY2, x2: indX, y2: indY, stroke: color, strokeWidth: 2, strokeLinecap: "square" }), _jsx("rect", { x: cx - 2, y: cy - 2, width: 4, height: 4, fill: color })] }) }), _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: DJ_DIM }, children: label }), _jsx("div", { style: { fontSize: 10, fontWeight: 700, color, letterSpacing: 1 }, children: formatValue ? formatValue(value) : value.toFixed(1) })] })] }));
}
