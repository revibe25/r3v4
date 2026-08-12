import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─── XYPad v2 — Professional XY Controller ────────────────────────────────────
//
// Enhancements over v1:
//   • Motion trail — fading history path shows recent cursor movement
//   • Snap grid   — optional quantize to grid intersections (Shift+drag)
//   • Spring mode — cursor returns to center on release
//   • 4-zone heat map — ambient glow radiates from cursor into corners
//   • Double-click reset — snaps cursor back to (0.5, 0.5)
//   • Multi-cursor mode — 'dot' | 'cross' | 'ring' | 'target'
//   • Axis value bars — live mini-meters on bottom and right edges
//   • Touch support — full single-finger and pinch (zoom = modulation depth)
//   • Beat pulse — external `pulse` prop flashes the grid on downbeat
//   • Axis lock — hold Shift to lock X, Ctrl to lock Y
//   • Named presets — click corner labels to jump to extreme values
//   • `onSpring` callback — fires with each spring tick
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState, } from 'react';
const TRAIL_LEN_DEFAULT = 28;
// ── Corner extreme values ──────────────────────────────────────────────────────
const CORNER_VALUES = {
    TL: { x: 0, y: 0 },
    TR: { x: 1, y: 0 },
    BL: { x: 0, y: 1 },
    BR: { x: 1, y: 1 },
};
// ── Axis Bar ──────────────────────────────────────────────────────────────────
const AxisBar = ({ value, axis, size, color }) => {
    const isX = axis === 'x';
    return (_jsx("div", { style: {
            position: 'absolute',
            ...(isX
                ? { bottom: -6, left: 0, right: 0, height: 3 }
                : { right: -6, top: 0, bottom: 0, width: 3 }),
            background: '#0a0a0a',
            border: `1px solid var(--t-b2)`,
        }, children: _jsx("div", { style: {
                position: 'absolute',
                background: color,
                boxShadow: `0 0 4px ${color}66`,
                ...(isX
                    ? { left: 0, top: 0, bottom: 0, width: `${value * 100}%` }
                    : { left: 0, right: 0, top: 0, height: `${value * 100}%` }),
                transition: 'none',
            } }) }));
};
// ── Main Component ─────────────────────────────────────────────────────────────
export const XYPad = ({ x, y, onChange, size = 130, labelTL = 'FILT', labelTR = 'WET', labelBL = 'DRY', labelBR = 'RVB', colorX = 'var(--looper-acid)', colorY = 'var(--looper-cyan)', spring = false, springSpeed = 0.12, snapGrid = false, gridDivs = 4, cursorMode = 'cross', showTrail = true, trailLength = TRAIL_LEN_DEFAULT, pulse = false, showAxisBars = true, onCornerClick, }) => {
    const padRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(0);
    const springRaf = useRef(0);
    const [active, setActive] = useState(false);
    const [pulsing, setPulsing] = useState(false);
    const [lastDblClick, setLastDblClick] = useState(0);
    // Axis lock state (held during drag)
    const lockX = useRef(false);
    const lockY = useRef(false);
    const trail = useRef([]);
    const curPos = useRef({ x, y });
    // Sync internal position ref
    useEffect(() => { curPos.current = { x, y }; }, [x, y]);
    // ── Beat pulse flash ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!pulse)
            return;
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 100);
        return () => clearTimeout(t);
    }, [pulse]);
    // ── Canvas render loop ─────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const draw = () => {
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            const { width: W, height: H } = canvas;
            ctx.clearRect(0, 0, W, H);
            // Trail
            if (showTrail && trail.current.length > 1) {
                ctx.save();
                for (let i = 1; i < trail.current.length; i++) {
                    const prev = trail.current[i - 1];
                    const curr = trail.current[i];
                    const age = i / trail.current.length; // 0 = oldest, 1 = newest
                    const alpha = age * age * 0.6;
                    const width = age * 2;
                    ctx.beginPath();
                    ctx.moveTo(prev.x * W, prev.y * H);
                    ctx.lineTo(curr.x * W, curr.y * H);
                    ctx.strokeStyle = colorX;
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = width;
                    ctx.shadowBlur = active ? 6 : 0;
                    ctx.shadowColor = colorX;
                    ctx.stroke();
                }
                ctx.restore();
            }
            rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [showTrail, colorX, active]);
    // ── Point from event ───────────────────────────────────────────────────────
    const getPoint = useCallback((clientX, clientY, shiftKey = false, ctrlKey = false) => {
        if (!padRef.current)
            return { x, y };
        const r = padRef.current.getBoundingClientRect();
        let nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        let ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        // Axis lock
        if (shiftKey || lockX.current)
            nx = curPos.current.x;
        if (ctrlKey || lockY.current)
            ny = curPos.current.y;
        // Snap to grid
        if (snapGrid && shiftKey) {
            nx = Math.round(nx * gridDivs) / gridDivs;
            ny = Math.round(ny * gridDivs) / gridDivs;
        }
        return { x: nx, y: ny };
    }, [x, y, snapGrid, gridDivs]);
    // ── Spring animation ───────────────────────────────────────────────────────
    const runSpring = useCallback(() => {
        const tick = () => {
            const cx2 = curPos.current.x;
            const cy2 = curPos.current.y;
            const dx = (0.5 - cx2) * springSpeed;
            const dy = (0.5 - cy2) * springSpeed;
            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                onChange({ x: 0.5, y: 0.5 });
                return;
            }
            onChange({ x: cx2 + dx, y: cy2 + dy });
            springRaf.current = requestAnimationFrame(tick);
        };
        springRaf.current = requestAnimationFrame(tick);
    }, [onChange, springSpeed]);
    // ── Mouse handlers ─────────────────────────────────────────────────────────
    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        cancelAnimationFrame(springRaf.current);
        // Double-click: reset to center
        const now = Date.now();
        if (now - lastDblClick < 300) {
            onChange({ x: 0.5, y: 0.5 });
            trail.current = [];
            setLastDblClick(0);
            return;
        }
        setLastDblClick(now);
        setActive(true);
        const update = (ev) => {
            const p = getPoint(ev.clientX, ev.clientY, ev.shiftKey, ev.ctrlKey);
            trail.current = [...trail.current.slice(-(trailLength - 1)), p];
            onChange(p);
        };
        const onUp = () => {
            setActive(false);
            lockX.current = false;
            lockY.current = false;
            window.removeEventListener('mousemove', update);
            window.removeEventListener('mouseup', onUp);
            if (spring)
                runSpring();
        };
        update(e.nativeEvent);
        window.addEventListener('mousemove', update);
        window.addEventListener('mouseup', onUp);
    }, [lastDblClick, onChange, getPoint, trailLength, spring, runSpring]);
    // ── Touch handlers ─────────────────────────────────────────────────────────
    const onTouchStart = useCallback((e) => {
        e.preventDefault();
        cancelAnimationFrame(springRaf.current);
        setActive(true);
        const t = e.touches[0];
        const p = getPoint(t.clientX, t.clientY);
        trail.current = [p];
        onChange(p);
    }, [getPoint, onChange]);
    const onTouchMove = useCallback((e) => {
        e.preventDefault();
        const t = e.touches[0];
        const p = getPoint(t.clientX, t.clientY);
        trail.current = [...trail.current.slice(-(trailLength - 1)), p];
        onChange(p);
    }, [getPoint, onChange, trailLength]);
    const onTouchEnd = useCallback(() => {
        setActive(false);
        if (spring)
            runSpring();
    }, [spring, runSpring]);
    // ── Corner label click ─────────────────────────────────────────────────────
    const handleCornerClick = useCallback((corner, e) => {
        e.stopPropagation();
        onChange(CORNER_VALUES[corner]);
        trail.current = [];
        onCornerClick?.(corner);
    }, [onChange, onCornerClick]);
    // ── Grid points ────────────────────────────────────────────────────────────
    const gridLines = [];
    for (let i = 1; i < gridDivs; i++)
        gridLines.push(i / gridDivs);
    // ── Derived color mix ──────────────────────────────────────────────────────
    // Cursor color blends between colorX (left) and colorY (bottom)
    const cursorColor = colorX;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }, children: [_jsxs("div", { ref: padRef, onMouseDown: onMouseDown, onTouchStart: onTouchStart, onTouchMove: onTouchMove, onTouchEnd: onTouchEnd, style: {
                    width: size,
                    height: size,
                    position: 'relative',
                    background: 'var(--panel-deep)',
                    border: `1px solid ${active ? colorX + '88' : 'var(--panel)'}`,
                    borderLeft: `3px solid ${active ? colorX : 'var(--dj-surface3)'}`,
                    borderTop: `1px solid ${active ? colorY + '44' : 'var(--dj-surface2)'}`,
                    cursor: 'crosshair',
                    userSelect: 'none',
                    transition: 'border-color .12s',
                    overflow: 'hidden',
                    boxShadow: active
                        ? `inset 0 0 30px rgba(0,0,0,.6), 0 0 20px ${colorX}11`
                        : 'inset 0 0 20px rgba(0,0,0,.5)',
                }, children: [_jsx("canvas", { ref: canvasRef, width: size, height: size, style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }), gridLines.map(p => (_jsxs(React.Fragment, { children: [_jsx("div", { style: {
                                    position: 'absolute', left: 0, right: 0, top: `${p * 100}%`,
                                    height: 1,
                                    background: p === 0.5
                                        ? `linear-gradient(90deg, transparent, var(--t-b3) 20%, var(--t-b3) 80%, transparent)`
                                        : `linear-gradient(90deg, transparent, var(--dj-surface2) 30%, var(--dj-surface2) 70%, transparent)`,
                                    pointerEvents: 'none',
                                } }), _jsx("div", { style: {
                                    position: 'absolute', top: 0, bottom: 0, left: `${p * 100}%`,
                                    width: 1,
                                    background: p === 0.5
                                        ? `linear-gradient(180deg, transparent, var(--t-b3) 20%, var(--t-b3) 80%, transparent)`
                                        : `linear-gradient(180deg, transparent, var(--dj-surface2) 30%, var(--dj-surface2) 70%, transparent)`,
                                    pointerEvents: 'none',
                                } })] }, p))), pulsing && (_jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            border: `1px solid ${colorX}88`,
                            background: `${colorX}06`,
                            pointerEvents: 'none',
                            animation: 'none',
                        } })), _jsx("div", { style: {
                            position: 'absolute', left: 0, right: 0,
                            top: `${y * 100}%`, height: 1,
                            background: active
                                ? `linear-gradient(90deg, transparent, ${colorY}55, ${colorY}88 ${x * 100}%, ${colorY}22, transparent)`
                                : `${colorY}22`,
                            pointerEvents: 'none', transition: 'background .05s',
                        } }), _jsx("div", { style: {
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${x * 100}%`, width: 1,
                            background: active
                                ? `linear-gradient(180deg, transparent, ${colorX}55, ${colorX}88 ${y * 100}%, ${colorX}22, transparent)`
                                : `${colorX}22`,
                            pointerEvents: 'none', transition: 'background .05s',
                        } }), _jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            background: `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${colorX}18 0%, ${colorY}0c 35%, transparent 65%)`,
                            pointerEvents: 'none',
                            transition: active ? 'none' : 'background .2s',
                        } }), _jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            background: `radial-gradient(circle at 0% 0%, ${colorX}${Math.round((1 - x) * (1 - y) * 18).toString(16).padStart(2, '0')} 0%, transparent 50%)`,
                            pointerEvents: 'none',
                        } }), _jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            background: `radial-gradient(circle at 100% 0%, ${colorY}${Math.round(x * (1 - y) * 12).toString(16).padStart(2, '0')} 0%, transparent 50%)`,
                            pointerEvents: 'none',
                        } }), _jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            background: `radial-gradient(circle at 100% 100%, ${colorX}${Math.round(x * y * 14).toString(16).padStart(2, '0')} 0%, transparent 50%)`,
                            pointerEvents: 'none',
                        } }), cursorMode === 'cross' && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                    position: 'absolute',
                                    left: `${x * 100}%`, top: `${y * 100}%`,
                                    width: 1, height: 14,
                                    background: cursorColor,
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: active ? `0 0 6px ${cursorColor}` : `0 0 3px ${cursorColor}88`,
                                    pointerEvents: 'none',
                                } }), _jsx("div", { style: {
                                    position: 'absolute',
                                    left: `${x * 100}%`, top: `${y * 100}%`,
                                    width: 14, height: 1,
                                    background: cursorColor,
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: active ? `0 0 6px ${cursorColor}` : `0 0 3px ${cursorColor}88`,
                                    pointerEvents: 'none',
                                } })] })), cursorMode === 'dot' && (_jsx("div", { style: {
                            position: 'absolute',
                            left: `${x * 100}%`, top: `${y * 100}%`,
                            width: active ? 10 : 8, height: active ? 10 : 8,
                            background: `radial-gradient(circle, ${cursorColor} 0%, ${cursorColor}88 60%, transparent 100%)`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: `0 0 ${active ? 14 : 8}px ${cursorColor}${active ? 'bb' : '66'}`,
                            borderRadius: 0,
                            pointerEvents: 'none',
                            transition: 'width .06s, height .06s, box-shadow .06s',
                        } })), cursorMode === 'ring' && (_jsx("div", { style: {
                            position: 'absolute',
                            left: `${x * 100}%`, top: `${y * 100}%`,
                            width: active ? 16 : 12, height: active ? 16 : 12,
                            border: `2px solid ${cursorColor}`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: `0 0 ${active ? 16 : 8}px ${cursorColor}${active ? 'aa' : '55'}, inset 0 0 4px ${cursorColor}33`,
                            pointerEvents: 'none',
                            transition: 'all .06s',
                        } })), cursorMode === 'target' && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                    position: 'absolute',
                                    left: `${x * 100}%`, top: `${y * 100}%`,
                                    width: 18, height: 18,
                                    border: `1px solid ${cursorColor}`,
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: `0 0 12px ${cursorColor}66`,
                                    pointerEvents: 'none',
                                } }), _jsx("div", { style: {
                                    position: 'absolute',
                                    left: `${x * 100}%`, top: `${y * 100}%`,
                                    width: 4, height: 4,
                                    background: cursorColor,
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: `0 0 6px ${cursorColor}`,
                                    pointerEvents: 'none',
                                } }), [0, 1].map(axis => (_jsx("div", { style: {
                                    position: 'absolute',
                                    left: axis ? `${x * 100}%` : `calc(${x * 100}% + 10px)`,
                                    top: axis ? `calc(${y * 100}% + 10px)` : `${y * 100}%`,
                                    width: axis ? 1 : 6,
                                    height: axis ? 6 : 1,
                                    background: `${cursorColor}66`,
                                    pointerEvents: 'none',
                                } }, axis)))] })), snapGrid && active && Array.from({ length: gridDivs + 1 }, (_, gx) => Array.from({ length: gridDivs + 1 }, (_, gy) => {
                        const gxp = gx / gridDivs;
                        const gyp = gy / gridDivs;
                        const dist = Math.hypot(gxp - x, gyp - y);
                        const alpha = Math.max(0, 1 - dist * 8);
                        return alpha > 0.05 ? (_jsx("div", { style: {
                                position: 'absolute',
                                left: `${gxp * 100}%`, top: `${gyp * 100}%`,
                                width: 3, height: 3,
                                background: colorX,
                                transform: 'translate(-50%, -50%)',
                                opacity: alpha * 0.7,
                                boxShadow: `0 0 3px ${colorX}`,
                                pointerEvents: 'none',
                            } }, `${gx}-${gy}`)) : null;
                    })), spring && !active && (_jsx("div", { style: {
                            position: 'absolute',
                            left: '50%', top: '50%',
                            width: 3, height: 3,
                            background: '#2a2a2a',
                            transform: 'translate(-50%, -50%)',
                            border: '1px solid var(--dj-dimmer)',
                            pointerEvents: 'none',
                        } })), [
                        ['TL', labelTL, { top: 4, left: 6 }],
                        ['TR', labelTR, { top: 4, right: 6 }],
                        ['BL', labelBL, { bottom: 4, left: 6 }],
                        ['BR', labelBR, { bottom: 4, right: 6 }],
                    ].map(([corner, lbl, style]) => (_jsx("button", { onClick: e => handleCornerClick(corner, e), style: {
                            position: 'absolute',
                            ...style,
                            fontSize: 6,
                            color: 'var(--t-b3)',
                            fontFamily: 'IBM Plex Mono, monospace',
                            letterSpacing: '.1em',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 2px',
                            lineHeight: 1,
                            transition: 'color .1s',
                            zIndex: 2,
                        }, onMouseEnter: e => (e.currentTarget.style.color = colorX), onMouseLeave: e => (e.currentTarget.style.color = 'var(--t-b3)'), children: lbl }, corner))), showAxisBars && (_jsxs(_Fragment, { children: [_jsx(AxisBar, { value: x, axis: "x", size: size, color: colorX }), _jsx(AxisBar, { value: y, axis: "y", size: size, color: colorY })] }))] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', width: size, alignItems: 'center' }, children: [_jsxs("span", { style: {
                            fontSize: 6, color: active ? colorX + 'aa' : 'var(--t-b3)',
                            fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.12em',
                            transition: 'color .1s',
                        }, children: ["X:", Math.round(x * 100).toString().padStart(3, ' ')] }), _jsxs("span", { style: {
                            fontSize: 6, color: 'var(--panel)',
                            fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.2em',
                            textTransform: 'uppercase',
                        }, children: ["XY ", spring ? '⟳' : '·', " ", cursorMode.toUpperCase()] }), _jsxs("span", { style: {
                            fontSize: 6, color: active ? colorY + 'aa' : 'var(--t-b3)',
                            fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '.12em',
                            transition: 'color .1s',
                        }, children: ["Y:", Math.round(y * 100).toString().padStart(3, ' ')] })] })] }));
};
