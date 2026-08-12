import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLoopStation505 } from './hooks/useLoopStation505';
import { FXKnob } from './components/FXKnob';
import { TrackPad } from './components/TrackPad';
import { XYPad } from './components/XYPad';
import { VUMeter } from './components/VUMeter';
import { getLoopEngine } from './engine/loopEngine';
import { getAudioContext } from '@/audio/core/audio-context';
// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
    acid: 'var(--looper-acid-2)', cyan: 'var(--looper-cyan)', orange: 'var(--looper-orange)', red: 'var(--looper-red)',
    purple: 'var(--looper-purple)', yellow: 'var(--looper-yellow)', pink: 'var(--looper-pink)', blue: 'var(--looper-blue)',
    teal: 'var(--looper-teal)', lime: 'var(--looper-lime)',
    bg0: '#030303', bg1: 'var(--void)', bg2: 'var(--t-b0x)', bg3: '#0a0a0a',
    b1: 'var(--t-b1)', b2: 'var(--t-b2)', b3: 'var(--t-b3)', b4: 'var(--t-b4)',
    t1: 'var(--daw-fg)', t2: 'var(--dj-muted)', t3: '#555', t4: 'var(--dj-dimmer)', t5: 'var(--t-b2x)',
};
// ── Panel ─────────────────────────────────────────────────────────────────────
const Panel = ({ title, accent = T.b3, children, noPad, style, badge }) => (_jsxs("div", { style: {
        background: T.bg1, border: `1px solid ${T.b1}`,
        borderTop: `2px solid ${accent}`, display: 'flex', flexDirection: 'column', ...style,
    }, children: [_jsxs("div", { style: {
                padding: '3px 8px', borderBottom: `1px solid ${T.b1}`,
                background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg1} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }, children: [_jsx("span", { style: {
                        fontFamily: 'IBM Plex Mono,monospace', fontSize: 7, letterSpacing: '.3em',
                        textTransform: 'uppercase',
                        color: accent === T.b3 ? T.t5 : accent + 'cc',
                    }, children: title }), badge && (_jsx("span", { style: {
                        fontSize: 6, fontFamily: 'IBM Plex Mono,monospace',
                        color: accent + '88', background: accent + '0f',
                        border: `1px solid ${accent}22`, padding: '0 4px',
                    }, children: badge }))] }), _jsx("div", { style: { padding: noPad ? 0 : 8, flex: 1 }, children: children })] }));
// ── LED ───────────────────────────────────────────────────────────────────────
const LED = ({ on, color = T.acid, size = 7, label, pulse, ring }) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }, children: [_jsxs("div", { style: { position: 'relative', width: size, height: size }, children: [ring && on && (_jsx("div", { style: {
                        position: 'absolute', inset: -2, border: `1px solid ${color}33`,
                        borderRadius: 0, animation: 'ledring 1.2s ease-out infinite',
                    } })), _jsx("div", { style: {
                        width: size, height: size,
                        background: on
                            ? `radial-gradient(circle at 35% 35%, ${color}ff, ${color}cc)`
                            : T.bg3,
                        border: `1px solid ${on ? color + '88' : T.b3}`,
                        boxShadow: on
                            ? `0 0 ${size * 1.5}px ${color}aa, 0 0 ${size * 3}px ${color}44, inset 0 1px 0 rgba(255,255,255,0.15)`
                            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                        transition: 'all .07s',
                        animation: on && pulse ? 'lspulse .65s ease-in-out infinite' : 'none',
                    } })] }), label && (_jsx("span", { style: {
                fontSize: 5, color: on ? color : T.t5,
                fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em', whiteSpace: 'nowrap',
            }, children: label }))] }));
// ── Hardware Button ───────────────────────────────────────────────────────────
const HWBtn = ({ label, sub, active, ac = T.acid, disabled, onClick, w = 48, h = 34, onMD, onMU, onML, title }) => (_jsxs("button", { onClick: onClick, onMouseDown: onMD, onMouseUp: onMU, onMouseLeave: onML, disabled: disabled, title: title, style: {
        width: w, height: h,
        background: active
            ? `linear-gradient(180deg, ${ac}14 0%, ${ac}08 100%)`
            : `linear-gradient(180deg, ${T.bg3} 0%, ${T.bg2} 100%)`,
        border: `1px solid ${active ? ac + '88' : T.b2}`,
        borderLeft: `3px solid ${active ? ac : T.b1}`,
        borderBottom: `3px solid ${active ? ac + '55' : 'var(--t-b0)'}`,
        color: active ? ac : disabled ? T.b3 : T.t3,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        fontFamily: 'IBM Plex Mono,monospace',
        transition: 'all .07s',
        boxShadow: active ? `0 0 12px ${ac}22, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        userSelect: 'none', position: 'relative', flexShrink: 0,
    }, children: [active && (_jsx("div", { style: {
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg, transparent, ${ac}88, transparent)`,
            } })), active && _jsx("div", { style: { position: 'absolute', top: 3, left: 5, width: 4, height: 4, background: ac, boxShadow: `0 0 5px ${ac}` } }), _jsx("span", { style: { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', marginLeft: active ? 5 : 0 }, children: label }), sub && _jsx("span", { style: { fontSize: 6, letterSpacing: '.12em', color: active ? ac + '99' : T.t5 }, children: sub })] }));
// ── 7-Seg Display ─────────────────────────────────────────────────────────────
const SegDisplay = ({ value, label, color = T.acid, size = 'lg', sub }) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }, children: [_jsx("div", { style: {
                background: T.bg0, border: `1px solid ${T.b2}`,
                padding: size === 'lg' ? '5px 14px' : size === 'md' ? '3px 9px' : '2px 6px',
                fontFamily: 'IBM Plex Mono,monospace',
                fontSize: size === 'lg' ? 36 : size === 'md' ? 20 : 13,
                fontWeight: 900, color,
                letterSpacing: '-.02em', lineHeight: 1,
                textShadow: `0 0 24px ${color}55, 0 0 48px ${color}22`,
                fontVariantNumeric: 'tabular-nums',
                minWidth: size === 'lg' ? 88 : size === 'md' ? 56 : 36,
                textAlign: 'center',
                boxShadow: `inset 0 2px 8px rgba(0,0,0,0.8)`,
            }, children: value }), _jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.3em', textTransform: 'uppercase' }, children: label }), sub && _jsx("span", { style: { fontSize: 6, color: color + '66', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.15em' }, children: sub })] })] }));
// ── Beat Dots ─────────────────────────────────────────────────────────────────
const BeatDots = ({ beat, bar, isPlaying, sig = '4/4', }) => {
    const beatCount = sig === '3/4' ? 3 : sig === '5/4' ? 5 : sig === '6/8' ? 6 : sig === '7/8' ? 7 : 4;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }, children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: Array.from({ length: beatCount }, (_, i) => {
                    const active = i === (beat % beatCount) && isPlaying;
                    const isOne = i === 0;
                    return (_jsx("div", { style: {
                            width: isOne ? 11 : 9, height: isOne ? 11 : 9,
                            background: active ? (isOne ? T.acid : T.cyan) : isOne ? T.b3 : T.b1,
                            border: `1px solid ${active ? (isOne ? T.acid : T.cyan) : T.b2}`,
                            boxShadow: active ? `0 0 10px ${isOne ? T.acid : T.cyan}88, 0 0 20px ${isOne ? T.acid : T.cyan}33` : 'none',
                            transition: 'all .04s',
                        } }, i));
                }) }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsxs("span", { style: { fontFamily: 'IBM Plex Mono,monospace', fontSize: 7, color: T.t4, letterSpacing: '.15em' }, children: [String(bar + 1).padStart(3, '0'), ":", beat + 1] }), _jsx("span", { style: { fontFamily: 'IBM Plex Mono,monospace', fontSize: 7, color: T.t5, letterSpacing: '.1em' }, children: sig })] })] }));
};
// ── Spectrum ──────────────────────────────────────────────────────────────────
const Spectrum = ({ isReady, h = 56 }) => {
    const cr = useRef(null);
    const rf = useRef(0);
    const [mode, setMode] = useState('bars');
    const _histRef = useRef([]);
    useEffect(() => {
        if (!isReady)
            return;
        const cv = cr.current;
        if (!cv)
            return;
        const draw = () => {
            const ctx = cv.getContext('2d');
            if (!ctx) {
                rf.current = requestAnimationFrame(draw);
                return;
            }
            const { width: w, height: h2 } = cv;
            if (mode === 'scope') {
                ctx.fillStyle = 'rgba(3,3,3,.6)';
                ctx.fillRect(0, 0, w, h2);
                const wf = getLoopEngine().getMasterFft();
                ctx.beginPath();
                ctx.strokeStyle = T.acid;
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 6;
                ctx.shadowColor = T.acid;
                for (let i = 0; i < wf.length; i++) {
                    const x = (i / wf.length) * w;
                    const y = h2 / 2 + ((wf[i] + 60) / 60) * h2 * 0.4;
                    if (i === 0)
                        ctx.moveTo(x, y);
                    else
                        ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            else {
                ctx.fillStyle = 'rgba(3,3,3,.52)';
                ctx.fillRect(0, 0, w, h2);
                const data = getLoopEngine().getMasterFft();
                const bins = Math.min(data.length, w);
                const bw = w / bins;
                // Grid lines
                ctx.strokeStyle = 'var(--t-b1)';
                ctx.lineWidth = 1;
                for (let db = 0; db < 100; db += 20) {
                    const y = (db / 100) * h2;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(w, y);
                    ctx.stroke();
                }
                if (mode === 'bars') {
                    for (let i = 0; i < bins; i++) {
                        const n = Math.max(0, (data[i] + 100) / 100);
                        const bh = n * h2;
                        const hue = 100 - n * 80;
                        const alpha = 0.55 + n * 0.45;
                        ctx.fillStyle = `hsla(${hue},90%,52%,${alpha})`;
                        ctx.fillRect(i * bw, h2 - bh, bw - 0.5, bh);
                        if (n > 0.65) {
                            ctx.fillStyle = `hsla(${hue},100%,78%,.55)`;
                            ctx.fillRect(i * bw, h2 - bh - 2, bw - 0.5, 2);
                        }
                    }
                }
                else {
                    ctx.beginPath();
                    for (let i = 0; i < bins; i++) {
                        const n = Math.max(0, (data[i] + 100) / 100);
                        if (i === 0)
                            ctx.moveTo(0, h2 - n * h2);
                        else
                            ctx.lineTo(i * bw, h2 - n * h2);
                    }
                    if (mode === 'fill') {
                        ctx.lineTo(w, h2);
                        ctx.lineTo(0, h2);
                        ctx.closePath();
                        const g = ctx.createLinearGradient(0, 0, 0, h2);
                        g.addColorStop(0, 'rgba(57,255,20,.42)');
                        g.addColorStop(1, 'rgba(57,255,20,.02)');
                        ctx.fillStyle = g;
                        ctx.fill();
                    }
                    ctx.strokeStyle = T.acid;
                    ctx.lineWidth = 1.2;
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = T.acid;
                    ctx.stroke();
                }
            }
            rf.current = requestAnimationFrame(draw);
        };
        rf.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rf.current);
    }, [isReady, mode]);
    return (_jsxs("div", { style: { position: 'relative', background: T.bg0, borderBottom: `1px solid ${T.b1}`, flexShrink: 0 }, children: [_jsx("canvas", { ref: cr, width: 800, height: h, style: { width: '100%', height: h, display: 'block' } }), _jsx("div", { style: { position: 'absolute', top: 3, right: 5, display: 'flex', gap: 2 }, children: ['bars', 'fill', 'line', 'scope'].map(m => (_jsx("button", { onClick: () => setMode(m), style: {
                        fontSize: 5, padding: '1px 4px', cursor: 'pointer',
                        background: mode === m ? `${T.acid}10` : 'transparent',
                        border: `1px solid ${mode === m ? T.acid + '55' : T.b2}`,
                        color: mode === m ? T.acid : T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.08em',
                    }, children: m.toUpperCase() }, m))) }), !isReady && (_jsx("div", { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("span", { style: { fontSize: 7, color: T.t5, letterSpacing: '.4em', fontFamily: 'IBM Plex Mono,monospace' }, children: "SPECTRUM \u00B7 STANDBY" }) }))] }));
};
// ── Master Bar ────────────────────────────────────────────────────────────────
const MasterBar = ({ isReady }) => {
    const [lev, setLev] = useState(0), [pk, setPk] = useState(0);
    const rf = useRef(0), sm = useRef(0), p = useRef(0), pa = useRef(0);
    useEffect(() => {
        if (!isReady)
            return;
        const tick = (now) => {
            const v = getLoopEngine().getMasterLevel();
            sm.current = v >= sm.current ? v : Math.max(0, sm.current - 0.015);
            if (sm.current >= p.current) {
                p.current = sm.current;
                pa.current = now;
            }
            else if (now - pa.current > 2400)
                p.current = Math.max(0, p.current - 0.008);
            setLev(sm.current);
            setPk(p.current);
            rf.current = requestAnimationFrame(tick);
        };
        rf.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rf.current);
    }, [isReady]);
    const SEGS = 36;
    const filled = Math.round(lev * SEGS);
    const pkSeg = Math.round(pk * SEGS) - 1;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }, children: [_jsx("div", { style: { display: 'flex', gap: 1, height: 9 }, children: Array.from({ length: SEGS }, (_, i) => {
                    const lit = i < filled, isPk = i === pkSeg;
                    const pct = i / SEGS;
                    const bg = isPk ? 'var(--white)' : !lit ? T.bg3 : pct > 0.91 ? T.red : pct > 0.77 ? T.orange : pct > 0.63 ? T.yellow : T.acid;
                    return _jsx("div", { style: { width: 5, height: '100%', background: bg, boxShadow: lit ? `0 0 4px ${bg}55` : 'none', transition: lit ? 'none' : 'background 80ms' } }, i);
                }) }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em' }, children: "MASTER OUT" }), _jsx("span", { style: { fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.04em', width: 32, textAlign: 'right',
                            color: pk > 0.9 ? T.red : pk > 0.7 ? T.yellow : T.t4 }, children: pk > 0.001 ? `${(20 * Math.log10(pk)).toFixed(1)}dB` : ' —∞ ' })] })] }));
};
// ── Scene Button ──────────────────────────────────────────────────────────────
const SceneBtn = ({ label, hasData, isActive, color = T.acid, onSave, onRecall }) => {
    const [holding, setH] = useState(false);
    const t = useRef(null);
    const down = () => { t.current = setTimeout(() => { setH(true); onSave(); setTimeout(() => setH(false), 280); }, 600); };
    const up = () => { if (t.current)
        clearTimeout(t.current); if (!holding)
        onRecall(); };
    return (_jsxs("button", { onMouseDown: down, onMouseUp: up, onMouseLeave: () => { if (t.current)
            clearTimeout(t.current); setH(false); }, title: `Scene ${label} — tap: recall · hold: save`, style: {
            width: 36, height: 36,
            fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 14,
            background: holding ? `rgba(255,107,0,.12)` : isActive ? `${color}0d` : hasData ? T.bg2 : T.bg1,
            border: `1px solid ${holding ? T.orange : isActive ? color : hasData ? T.b3 : T.b2}`,
            borderLeft: `3px solid ${holding ? T.orange : isActive ? color : hasData ? T.b3 : T.b1}`,
            borderBottom: `3px solid ${holding ? T.orange + '55' : isActive ? color + '55' : 'var(--t-b0)'}`,
            color: holding ? T.orange : isActive ? color : hasData ? T.t3 : T.t5,
            cursor: 'pointer',
            boxShadow: isActive ? `0 0 16px ${color}22` : 'none',
            transition: 'all .08s', userSelect: 'none', position: 'relative',
        }, children: [isActive && _jsx("div", { style: { position: 'absolute', top: 3, left: 4, width: 4, height: 4, background: color, boxShadow: `0 0 5px ${color}` } }), label] }));
};
// ── 32-Step Sequencer ─────────────────────────────────────────────────────────
const TRACK_COLORS = ['var(--looper-acid-2)', 'var(--looper-cyan)', 'var(--looper-orange)', 'var(--looper-purple)', 'var(--looper-yellow)'];
const Sequencer32 = ({ tracks, beat, isPlaying, bpm }) => {
    const STEPS = 32;
    const [steps, setSteps] = useState(() => Array(5).fill(null).map(() => Array(STEPS).fill(false)));
    const [prob, setProb] = useState(() => Array(5).fill(null).map(() => Array(STEPS).fill(1)));
    const [at, setAT] = useState(0);
    const [showProb, setShowProb] = useState(false);
    const [resolution, setResolution] = useState(16);
    const cur = isPlaying ? beat % resolution : -1;
    const toggle = (ti, si) => setSteps(p => { const n = p.map(r => [...r]); n[ti][si] = !n[ti][si]; return n; });
    const clear = (ti) => setSteps(p => { const n = p.map(r => [...r]); n[ti] = Array(STEPS).fill(false); return n; });
    const toggleProb = (ti, si) => setProb(p => {
        const n = p.map(r => [...r]);
        n[ti][si] = n[ti][si] < 1 ? Math.min(1, n[ti][si] + 0.25) : 0.25;
        return n;
    });
    const PATS = {
        '4/4': [0, 8, 16, 24],
        '8TH': [0, 4, 8, 12, 16, 20, 24, 28],
        '16TH': Array.from({ length: 16 }, (_, i) => i * 2),
        'AFRO': [0, 6, 12, 18, 24],
        'TRAP': [0, 3, 8, 12, 16, 19, 24],
        'OFF': [0, 6, 12, 16, 22, 28],
        'RNDM': Array.from({ length: STEPS }, (_, i) => i).filter(() => Math.random() > 0.5),
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontSize: 7, color: T.t4, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em' }, children: "TRK" }), tracks.map((tr, i) => (_jsx("button", { onClick: () => setAT(i), style: {
                            width: 22, height: 22, fontSize: 8, fontFamily: 'Syne,sans-serif', fontWeight: 800,
                            background: at === i ? `${tr.color}18` : T.bg2,
                            border: `1px solid ${at === i ? tr.color : T.b2}`,
                            color: at === i ? tr.color : T.t3, cursor: 'pointer',
                        }, children: i + 1 }, tr.id))), _jsx("div", { style: { width: 1, height: 20, background: T.b2, margin: '0 2px' } }), _jsx("span", { style: { fontSize: 7, color: T.t4, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em' }, children: "STEPS" }), [16, 32].map(r => (_jsx("button", { onClick: () => setResolution(r), style: {
                            padding: '2px 7px', fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                            background: resolution === r ? `${T.acid}0a` : T.bg2,
                            border: `1px solid ${resolution === r ? T.acid : T.b2}`,
                            color: resolution === r ? T.acid : T.t3, cursor: 'pointer',
                        }, children: r }, r))), _jsx("div", { style: { width: 1, height: 20, background: T.b2, margin: '0 2px' } }), Object.entries(PATS).slice(0, 6).map(([name, pat]) => (_jsx("button", { onClick: () => {
                            const extended = resolution === 32 ? [...pat, ...pat.map(p => p + 16)] : pat;
                            setSteps(prev => { const n = prev.map(r => [...r]); n[at] = Array(STEPS).fill(false).map((_, i) => extended.includes(i)); return n; });
                        }, style: {
                            padding: '2px 7px', fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                            background: T.bg2, border: `1px solid ${T.b2}`, color: T.t3, cursor: 'pointer',
                        }, children: name }, name))), _jsx("button", { onClick: () => setShowProb(v => !v), style: {
                            padding: '2px 7px', fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                            background: showProb ? `${T.purple}0a` : T.bg2,
                            border: `1px solid ${showProb ? T.purple : T.b2}`,
                            color: showProb ? T.purple : T.t3, cursor: 'pointer',
                        }, children: "PROB" }), _jsx("button", { onClick: () => clear(at), style: {
                            padding: '2px 7px', fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                            background: T.bg2, border: `1px solid rgba(255,26,26,.2)`, color: 'rgba(255,26,26,.4)', cursor: 'pointer',
                        }, children: "CLR" })] }), _jsxs("div", { style: {
                    background: T.bg0, border: `1px solid ${T.b1}`,
                    padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
                    overflowX: 'auto',
                }, children: [_jsx("div", { style: { display: 'flex', gap: 2, paddingLeft: 50 }, children: Array.from({ length: resolution }, (_, i) => (_jsx("div", { style: {
                                width: 16, textAlign: 'center', fontSize: 5,
                                fontFamily: 'IBM Plex Mono,monospace',
                                color: i % 8 === 0 ? T.t4 : i % 4 === 0 ? T.t5 : T.b3,
                                borderBottom: i % 8 === 0 ? `1px solid ${T.b3}` : 'none',
                            }, children: i + 1 }, i))) }), tracks.map((tr, ti) => (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 2 }, children: [_jsxs("div", { style: { width: 48, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }, children: [_jsx("div", { style: { width: 3, height: 14, background: tr.color, boxShadow: `0 0 5px ${tr.color}55` } }), _jsxs("span", { style: {
                                                    fontSize: 8, color: at === ti ? tr.color : T.t4,
                                                    fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                                                }, children: ["T", tr.index + 1] })] }), Array.from({ length: resolution }, (_, si) => {
                                        const on = steps[ti][si];
                                        const isCur = si === cur;
                                        const isBeat = si % 8 === 0;
                                        const isHalf = si % 4 === 0;
                                        const p2 = prob[ti][si];
                                        return (_jsx("button", { onClick: () => toggle(ti, si), style: {
                                                width: 16, height: 18, flexShrink: 0,
                                                background: on
                                                    ? isCur ? tr.color : `${tr.color}${Math.round(p2 * 85 + 30).toString(16).padStart(2, '0')}`
                                                    : isCur ? T.b3 : T.bg2,
                                                border: `1px solid ${on ? tr.color : isBeat ? T.b3 : isHalf ? T.b2 : T.b1}`,
                                                boxShadow: on && isCur ? `0 0 10px ${tr.color}, 0 0 20px ${tr.color}55` : on ? `0 0 4px ${tr.color}44` : 'none',
                                                cursor: 'pointer', transition: 'background .04s, box-shadow .04s',
                                                position: 'relative', overflow: 'hidden',
                                            }, children: on && p2 < 1 && (_jsx("div", { style: {
                                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                                    height: `${p2 * 100}%`,
                                                    background: 'rgba(0,0,0,0.4)',
                                                    pointerEvents: 'none',
                                                } })) }, si));
                                    })] }), showProb && at === ti && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }, children: [_jsx("div", { style: { width: 48 } }), Array.from({ length: resolution }, (_, si) => {
                                        const p2 = prob[ti][si];
                                        return (_jsx("div", { onClick: () => toggleProb(ti, si), style: {
                                                width: 16, height: 6, cursor: 'pointer',
                                                background: `${T.purple}${Math.round(p2 * 180 + 30).toString(16).padStart(2, '0')}`,
                                                border: `1px solid ${T.purple}44`,
                                                flexShrink: 0,
                                            } }, si));
                                    })] }))] }, tr.id)))] }), _jsxs("div", { style: { display: 'flex', gap: 12, fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.15em' }, children: [_jsxs("span", { children: ["STEP: ", (60 / bpm / (resolution / 16) * 1000).toFixed(0), "ms"] }), _jsxs("span", { children: ["BAR: ", (60 / bpm * 4 * 1000).toFixed(0), "ms"] }), _jsxs("span", { children: ["RES: 1/", resolution === 16 ? 8 : 16, " NOTE"] })] })] }));
};
const CLIP_ROWS = 8;
const ClipLauncher = ({ tracks, isReady, beat }) => {
    const [clips, setClips] = useState(() => Array(CLIP_ROWS).fill(null).map((_, r) => Array(5).fill(null).map((__, c) => (r === 0 && c < 2 ? 'loaded' : 'empty'))));
    const [activeRow, setActiveRow] = useState(null);
    const CLR = {
        empty: T.bg2,
        loaded: T.b4,
        playing: T.acid,
        recording: T.red,
        queued: T.cyan,
    };
    const ICON = {
        empty: '·',
        loaded: '▶',
        playing: '▶',
        recording: '●',
        queued: '⟳',
    };
    const launch = (row, col) => {
        const engine = getLoopEngine();
        setClips(prev => {
            const n = prev.map(r => [...r]);
            if (n[row][col] === 'empty') {
                n[row][col] = 'recording';
            }
            else if (n[row][col] === 'loaded') {
                n[row][col] = 'queued';
                if (engine.initialized)
                    engine.launchClip(col, row);
                setTimeout(() => {
                    setClips(p => { const m = p.map(r => [...r]); m[row][col] = 'playing'; return m; });
                    setActiveRow(row);
                }, 200);
            }
            else if (n[row][col] === 'playing') {
                if (engine.initialized)
                    engine.stopClip(col, row);
                n[row][col] = 'loaded';
                setActiveRow(null);
            }
            else if (n[row][col] === 'queued') {
                if (engine.initialized)
                    engine.stopClip(col, row);
                n[row][col] = 'loaded';
            }
            else if (n[row][col] === 'recording') {
                n[row][col] = 'playing';
                if (engine.initialized)
                    engine.launchClip(col, row);
                setActiveRow(row);
            }
            return n;
        });
    };
    const stopRow = (row) => {
        const engine = getLoopEngine();
        setClips(prev => {
            const n = prev.map(r => [...r]);
            n[row] = n[row].map((s, col) => {
                if (s === 'playing') {
                    if (engine.initialized)
                        engine.stopClip(col, row);
                    return 'loaded';
                }
                return s;
            });
            return n;
        });
        if (activeRow === row)
            setActiveRow(null);
    };
    return (_jsxs("div", { style: { padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: { display: 'flex', gap: 4, marginBottom: 4 }, children: [tracks.map((tr, i) => (_jsx("div", { style: {
                            flex: 1, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${tr.color}0d`, border: `1px solid ${tr.color}33`,
                        }, children: _jsxs("span", { style: { fontSize: 7, color: tr.color, fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700 }, children: ["T", tr.index + 1] }) }, tr.id))), _jsx("div", { style: { width: 36 } })] }), Array.from({ length: CLIP_ROWS }, (_, row) => (_jsxs("div", { style: { display: 'flex', gap: 4, alignItems: 'center' }, children: [tracks.map((tr, col) => {
                        const state = clips[row][col];
                        const isActive = state === 'playing' || state === 'recording';
                        return (_jsxs("button", { onClick: () => isReady && launch(row, col), style: {
                                flex: 1, height: 40,
                                background: isActive
                                    ? `radial-gradient(circle at 50% 50%, ${tr.color}22, ${T.bg2})`
                                    : state === 'loaded' ? T.b3 : T.bg2,
                                border: `1px solid ${isActive ? tr.color : state === 'loaded' ? T.b4 : T.b1}`,
                                borderBottom: `2px solid ${isActive ? tr.color + '88' : 'var(--t-b0)'}`,
                                color: isActive ? tr.color : state === 'loaded' ? T.t3 : T.t5,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: state === 'empty' ? 18 : 11,
                                fontFamily: 'IBM Plex Mono,monospace',
                                boxShadow: isActive ? `0 0 16px ${tr.color}33` : 'none',
                                transition: 'all .1s',
                                position: 'relative', overflow: 'hidden',
                            }, children: [state === 'playing' && (_jsx("div", { style: {
                                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                                        background: `${tr.color}88`,
                                        animation: 'clipbar 2s linear infinite',
                                    } })), ICON[state]] }, col));
                    }), _jsx("button", { onClick: () => stopRow(row), style: {
                            width: 36, height: 40,
                            background: T.bg2, border: `1px solid ${activeRow === row ? T.orange : T.b1}`,
                            color: activeRow === row ? T.orange : T.t5,
                            cursor: 'pointer', fontSize: 9, fontFamily: 'IBM Plex Mono,monospace',
                        }, children: activeRow === row ? '■' : String(row + 1).padStart(2, '0') })] }, row))), _jsxs("div", { style: { display: 'flex', gap: 4, marginTop: 4 }, children: [tracks.map((_, i) => (_jsx("div", { style: { flex: 1, display: 'flex', justifyContent: 'center' }, children: _jsx("span", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em' }, children: "STOP" }) }, i))), _jsx("div", { style: { width: 36 } })] })] }));
};
const LFO_SHAPES = ['sine', 'tri', 'sqr', 'saw', 'rnd'];
const MACRO_TARGETS = ['filter', 'reverb', 'delay', 'drive', 'chorus', 'pan', 'volume', 'xy_x', 'xy_y', 'none'];
const MACRO_COLORS = [T.acid, T.cyan, T.orange, T.purple];
const MacroPanel = () => {
    const [macros, setMacros] = useState(MACRO_COLORS.map((c, i) => ({
        label: `MACRO ${i + 1}`, value: 0.5, target: 'none', color: c,
        lfoOn: false, lfoShape: 'sine', lfoRate: 0.3, lfoDepth: 0.5, lfoSync: true,
    })));
    const [selected, setSelected] = useState(0);
    const upd = (idx, patch) => setMacros(prev => {
        const next = prev.map((m, j) => j === idx ? { ...m, ...patch } : m);
        const m = next[idx];
        const engine = getLoopEngine();
        if (engine.initialized) {
            if ('value' in patch)
                engine.setMacro(idx, m.value);
            if ('target' in patch)
                engine.setMacroTarget(idx, m.target);
            if ('lfoOn' in patch || 'lfoShape' in patch || 'lfoRate' in patch ||
                'lfoDepth' in patch || 'lfoSync' in patch) {
                engine.setLFO(idx, {
                    id: idx, enabled: m.lfoOn, shape: m.lfoShape,
                    rateHz: m.lfoRate * 16, rateSynced: m.lfoSync,
                    depth: m.lfoDepth, target: m.target,
                    trackIndex: null, phase: 0, rateNote: '4n', _lfo: null,
                });
            }
        }
        return next;
    });
    const m = macros[selected];
    return (_jsxs("div", { style: { padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }, children: macros.map((mac, i) => (_jsxs("div", { onClick: () => setSelected(i), style: {
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: 8,
                        background: selected === i ? `${mac.color}08` : T.bg2,
                        border: `1px solid ${selected === i ? mac.color + '55' : T.b2}`,
                        cursor: 'pointer', transition: 'all .1s',
                    }, children: [_jsx(FXKnob, { label: mac.label, value: mac.value, color: mac.color, size: "lg", onChange: v => upd(i, { value: v }) }), mac.lfoOn && (_jsxs("div", { style: { display: 'flex', gap: 2, alignItems: 'center' }, children: [_jsx("div", { style: { width: 4, height: 4, background: mac.color, boxShadow: `0 0 4px ${mac.color}`, animation: 'lspulse .5s infinite' } }), _jsx("span", { style: { fontSize: 5, color: mac.color, fontFamily: 'IBM Plex Mono,monospace' }, children: "LFO" })] })), _jsx("span", { style: { fontSize: 6, color: mac.target !== 'none' ? mac.color + '99' : T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em' }, children: mac.target.toUpperCase() })] }, i))) }), _jsxs("div", { style: { background: T.bg0, border: `1px solid ${T.b1}`, borderTop: `2px solid ${m.color}`, padding: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("span", { style: { fontSize: 7, color: m.color, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.25em' }, children: ["LFO / MODULATOR \u2014 ", m.label] }), _jsx("button", { onClick: () => upd(selected, { lfoOn: !m.lfoOn }), style: {
                                    padding: '2px 10px', fontSize: 7, cursor: 'pointer',
                                    background: m.lfoOn ? `${m.color}12` : T.bg2,
                                    border: `1px solid ${m.lfoOn ? m.color : T.b2}`,
                                    color: m.lfoOn ? m.color : T.t3, fontFamily: 'IBM Plex Mono,monospace',
                                    letterSpacing: '.15em',
                                }, children: m.lfoOn ? '◉ LFO ON' : '○ LFO OFF' })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em', marginBottom: 3 }, children: "SHAPE" }), _jsx("div", { style: { display: 'flex', gap: 2 }, children: LFO_SHAPES.map(s => (_jsx("button", { onClick: () => upd(selected, { lfoShape: s }), style: {
                                                        flex: 1, height: 20, fontSize: 6, cursor: 'pointer',
                                                        background: m.lfoShape === s ? `${m.color}12` : T.bg2,
                                                        border: `1px solid ${m.lfoShape === s ? m.color : T.b2}`,
                                                        color: m.lfoShape === s ? m.color : T.t3, fontFamily: 'IBM Plex Mono,monospace',
                                                    }, children: s[0].toUpperCase() }, s))) })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em', marginBottom: 3 }, children: "TARGET" }), _jsx("select", { value: m.target, onChange: e => upd(selected, { target: e.target.value }), style: {
                                                    width: '100%', fontSize: 7, background: T.bg1,
                                                    color: m.target !== 'none' ? m.color : T.t3,
                                                    border: `1px solid ${m.target !== 'none' ? m.color + '44' : T.b2}`,
                                                    padding: '2px 4px', cursor: 'pointer', outline: 'none',
                                                    fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                                                }, children: MACRO_TARGETS.map(t => (_jsx("option", { value: t, style: { background: T.bg1 }, children: t === 'none' ? '— NONE' : t.toUpperCase() }, t))) })] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx(FXKnob, { label: "RATE", value: m.lfoRate, color: m.color, size: "sm", onChange: v => upd(selected, { lfoRate: v }) }), _jsx(FXKnob, { label: "DEPTH", value: m.lfoDepth, color: m.color, size: "sm", onChange: v => upd(selected, { lfoDepth: v }) })] }), _jsx("button", { onClick: () => upd(selected, { lfoSync: !m.lfoSync }), style: {
                                            height: 22, fontSize: 7, cursor: 'pointer',
                                            background: m.lfoSync ? `${T.cyan}0a` : T.bg2,
                                            border: `1px solid ${m.lfoSync ? T.cyan : T.b2}`,
                                            color: m.lfoSync ? T.cyan : T.t3, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.15em',
                                        }, children: m.lfoSync ? '⇄ BPM SYNC' : '○ FREE RATE' })] })] })] })] }));
};
// ── Beat Repeat Panel ─────────────────────────────────────────────────────────
const BeatRepeat = () => {
    const [enabled, setEnabled] = useState(false);
    const [div, setDiv] = useState('1/8');
    const [chance, setChance] = useState(0.5);
    const [len, setLen] = useState(0.5);
    useEffect(() => {
        const engine = getLoopEngine();
        if (!engine.initialized)
            return;
        engine.setBeatRepeat({
            enabled, trackIndex: 0, division: div,
            chance, length: len, pitch: 0, variation: 'none',
        });
    }, [enabled, div, chance, len]);
    const DIVS = ['1/4', '1/8', '1/16', '1/32'];
    return (_jsx(Panel, { title: "BEAT REPEAT", accent: T.orange, badge: enabled ? 'ACTIVE' : undefined, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("div", { style: { display: 'flex', gap: 2 }, children: DIVS.map(d => (_jsx("button", { onClick: () => setDiv(d), style: {
                            flex: 1, height: 22, fontSize: 6, cursor: 'pointer',
                            background: div === d ? `${T.orange}12` : T.bg2,
                            border: `1px solid ${div === d ? T.orange : T.b2}`,
                            color: div === d ? T.orange : T.t3,
                            fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.08em',
                        }, children: d }, d))) }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "CHANCE", value: chance, color: T.orange, size: "sm", onChange: setChance }), _jsx(FXKnob, { label: "LENGTH", value: len, color: T.orange, size: "sm", onChange: setLen }), _jsx(FXKnob, { label: "PITCH", value: 0.5, color: T.orange, size: "sm", bipolar: true, onChange: v => getLoopEngine().setBeatRepeat({ pitch: v * 24 - 12 }) })] }), _jsx("button", { onClick: () => setEnabled(v => !v), style: {
                        height: 26, fontSize: 8, cursor: 'pointer', letterSpacing: '.15em',
                        fontFamily: 'IBM Plex Mono,monospace',
                        background: enabled ? 'rgba(255,107,0,.12)' : T.bg2,
                        border: `1px solid ${enabled ? T.orange : T.b2}`,
                        borderLeft: `3px solid ${enabled ? T.orange : T.b1}`,
                        color: enabled ? T.orange : T.t3,
                    }, children: enabled ? '◉ REPEAT ACTIVE' : '○ ENGAGE REPEAT' })] }) }));
};
// ── Keyboard Guide ────────────────────────────────────────────────────────────
const Keys = ({ onClose }) => (_jsxs("div", { style: {
        position: 'absolute', right: 0, top: 0, zIndex: 60,
        background: T.bg2, border: `1px solid ${T.b2}`, borderLeft: `3px solid ${T.acid}`,
        padding: '12px 16px', minWidth: 240,
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 9,
        boxShadow: '0 12px 60px rgba(0,0,0,.95)',
    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, children: [_jsx("span", { style: { color: T.acid, fontSize: 7, letterSpacing: '.3em', textTransform: 'uppercase' }, children: "SHORTCUTS" }), _jsx("button", { onClick: onClose, style: { color: T.t4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }, children: "\u2715" })] }), [
            ['SPACE', 'Play / Pause'],
            ['1–5', 'Trigger tracks'],
            ['T', 'Tap tempo'],
            ['M', 'Metronome toggle'],
            ['A–H', 'Recall scenes A–H'],
            ['⌘Z', 'Undo last action'],
            ['⌘SHIFT Z', 'Redo'],
            ['F1–F5', 'View: Perform / Mixer / Seq / Clips / Macro'],
            ['G', 'Granular freeze toggle'],
            ['R', 'Beat repeat toggle'],
            ['SHIFT+C', 'Clear all (confirm)'],
        ].map(([k, v]) => (_jsxs("div", { style: {
                display: 'flex', justifyContent: 'space-between', gap: 16,
                padding: '3px 0', borderBottom: `1px solid ${T.b1}`,
            }, children: [_jsx("span", { style: { color: T.cyan, minWidth: 72, fontWeight: 600 }, children: k }), _jsx("span", { style: { color: T.t3 }, children: v })] }, k)))] }));
export const LoopStation505 = () => {
    const { state, fx, isReady, isError, errorMessage, midiSync, midiInputEnabled, midiInputs, toggleMidiInput, toggleMidiClock, selectMidiInputByIndex, scenes, activeScene, canUndo, init, togglePlayback, stopPlayback, recordNextTrack, pressTrack, stopTrack, clearTrack, clearAll, undo, setTrackPitchFX, setTrackFineTune, setTrackChorusFX, setTrackGateFX, setTrackCompFX, setTrackSatFX, setTrackTrimFX, setTrackVolume, setTrackPan, setTrackEQ, toggleMute, toggleSolo, toggleCue, setHarmonyMode, setReverbSend, setDelaySend, setChorusSend, setMasterVolume, setBpm, tapTempo, toggleMetronome, setFilter, setFilterType, setDelay, setReverb, setCompressor, setXY, saveScene, recallScene, setSwing: setSwingEngine, setTimeSignature, setQuantMode, setPlaybackMode, } = useLoopStation505();
    // ── FX State ──────────────────────────────────────────────────────────────
    const [fv, setFV] = useState(0.5);
    const [dv, setDV] = useState(0.3);
    const [rv, setRV] = useState(0);
    const [drv, setDrv] = useState(0);
    const [cho, setCho] = useState(0);
    const [fla, setFla] = useState(0);
    const [bit, setBit] = useState(0);
    const [sw, setSW] = useState(0.5);
    const [tilt, setTilt] = useState(0.5);
    const [mg, setMG] = useState(0.9);
    const [pha, setPha] = useState(0);
    const [gran, setGran] = useState(0);
    const [granOn, setGranOn] = useState(false);
    const [monoOn, setMono] = useState(false);
    const [limOn, setLim] = useState(true);
    const [cThresh, setCThr] = useState(0.45);
    const [cRatio, setCRat] = useState(0.2);
    const [cAtk, setCAtk] = useState(0.05);
    const [cRel, setCRel] = useState(0.3);
    const [rDecay, setRDec] = useState(0.35);
    const [preDly, setPreDly] = useState(0.1); // reverb pre-delay  (0‥1 → 0‥0.5 s)
    const [granDensity, setGranDensity] = useState(0.5); // granular density  (normalised)
    const [granSpread, setGranSpread] = useState(0.3); // granular spread   (normalised)
    const [eqLF, setEqLF] = useState(0.5); // master EQ low     (bipolar → ±12 dB)
    const [eqHMF, setEqHMF] = useState(0.5); // master EQ mid     (bipolar → ±12 dB)
    const [eqHF, setEqHF] = useState(0.5); // master EQ high    (bipolar → ±12 dB)
    const [dFeed, setDFeed] = useState(0.3);
    const [dTime, setDTime] = useState(0.4);
    const [swing, setSwingLocal] = useState(0);
    // ── UI State ──────────────────────────────────────────────────────────────
    const [view, setView] = useState('perform');
    const [quant, setQuant] = useState('1m');
    const [timeSig, setTimeSig] = useState('4/4');
    const [perf, setPerf] = useState(false);
    const [showK, setShowK] = useState(false);
    const [tapF, setTapF] = useState(false);
    const [caheld, setCAH] = useState(false);
    const [specH, setSpecH] = useState(40);
    const caT = useRef(null);
    const flashTap = useCallback(() => { setTapF(true); setTimeout(() => setTapF(false), 120); tapTempo(); }, [tapTempo]);
    const handleMG = useCallback((v) => { setMG(v); setMasterVolume(v); }, [setMasterVolume]);
    const beat0 = state.beat.beat === 0 && state.isPlaying && isReady;
    // Keyboard shortcuts for views
    useEffect(() => {
        const h = (e) => {
            if (e.target?.tagName === 'INPUT')
                return;
            if (e.key === 'F1')
                setView('perform');
            if (e.key === 'F2')
                setView('mixer');
            if (e.key === 'F3')
                setView('sequence');
            if (e.key === 'F4')
                setView('clips');
            if (e.key === 'F5')
                setView('macro');
            if (e.key === 'g')
                setGranOn(v => !v);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: `
        @keyframes lspulse { 0%,100%{opacity:1}50%{opacity:.2} }
        @keyframes ledring { 0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(2.5)} }
        @keyframes clipbar { 0%{transform:scaleX(0);transform-origin:left} 100%{transform:scaleX(1);transform-origin:left} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:var(--void)}
        ::-webkit-scrollbar-thumb{background:var(--t-b3)}
        ::-webkit-scrollbar-thumb:hover{background:var(--dj-dimmer)}
        .ls-header::-webkit-scrollbar{display:none}

        /* ── Landscape responsive custom properties ───────────────────────
           These vars are read by the inline-style var() references below.
           They scale the header, spectrum, and chrome for short-height
           landscape viewports (phones rotated, compact tablets).
        ─────────────────────────────────────────────────────────────────── */
        :root {
          --ls-hdr-py:     8px;
          --ls-hdr-px:    14px;
          --ls-hdr-gap:   10px;
          --ls-tab-py:     7px;
          --ls-tab-px:    16px;
          --ls-status-py:  4px;
          --ls-bpm-sz:    36px;
          --ls-brand-sz:  24px;
          --ls-spec-disp: block;
        }

        /* Compact mode: landscape + short viewport */
        @media (orientation: landscape) and (max-height: 620px) {
          :root {
            --ls-hdr-py:     4px;
            --ls-hdr-px:     8px;
            --ls-hdr-gap:    6px;
            --ls-tab-py:     4px;
            --ls-tab-px:    10px;
            --ls-status-py:  2px;
            --ls-bpm-sz:    26px;
            --ls-brand-sz:  18px;
            --ls-spec-disp: none;
          }
        }

        /* Fill available horizontal space — landscape always wins */
        @media (orientation: landscape) {
          :root { --ls-spec-disp: block; }
        }
        @media (orientation: landscape) and (max-height: 620px) {
          :root { --ls-spec-disp: none; }
        }
      ` }), _jsxs("div", { style: {
                    width: '100%', height: '100%', minHeight: 0,
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    background: T.bg0,
                    fontFamily: 'IBM Plex Mono,monospace',
                    position: 'relative',
                    userSelect: 'none',
                }, children: [showK && _jsx(Keys, { onClose: () => setShowK(false) }), _jsx("div", { style: {
                            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50,
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
                            opacity: 0.4,
                        } }), _jsx("div", { style: {
                            height: 2, width: '100%', flexShrink: 0,
                            background: beat0
                                ? 'linear-gradient(90deg,transparent 3%,var(--looper-acid-2) 25%,var(--looper-cyan) 50%,var(--looper-acid-2) 75%,transparent 97%)'
                                : 'transparent',
                            transition: 'background .05s',
                            boxShadow: beat0 ? '0 0 20px rgba(57,255,20,.4)' : 'none',
                        } }), _jsxs("div", { className: "ls-header", style: {
                            background: 'linear-gradient(180deg, var(--dj-surface) 0%, var(--t-b0xx) 100%)',
                            borderBottom: `1px solid ${T.b1}`,
                            padding: 'var(--ls-hdr-py, 8px) var(--ls-hdr-px, 14px)',
                            display: 'flex', alignItems: 'center', gap: 'var(--ls-hdr-gap, 10px)',
                            flexShrink: 0, overflowX: 'auto', overflowY: 'visible',
                            scrollbarWidth: 'none',
                            WebkitMaskImage: 'linear-gradient(90deg, black calc(100% - 40px), transparent 100%)',
                            maskImage: 'linear-gradient(90deg, black calc(100% - 40px), transparent 100%)',
                        }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 88, flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 0 }, children: [_jsx("span", { style: { fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'var(--ls-brand-sz, 24px)', color: T.t1, letterSpacing: '-.03em', lineHeight: 1 }, children: "R3" }), _jsx("span", { style: { fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'var(--ls-brand-sz, 24px)', color: T.acid, lineHeight: 1 }, children: "/" }), _jsx("span", { style: { fontFamily: 'Syne,sans-serif', fontWeight: 900, fontSize: 'var(--ls-brand-sz, 24px)', color: T.t1, letterSpacing: '-.03em', lineHeight: 1 }, children: "LOOP" })] }), _jsx("span", { style: { fontSize: 6, color: T.t5, letterSpacing: '.3em', textTransform: 'uppercase', whiteSpace: 'nowrap' }, children: "STUDIO CONSOLE v2" })] }), _jsx("div", { style: { width: 1, height: 'var(--ls-divider-h, 46px)', background: T.b1, flexShrink: 0 } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }, children: [_jsx(HWBtn, { label: state.isPlaying ? '▐▐' : '▶', sub: state.isPlaying ? 'PAUSE' : 'PLAY', active: state.isPlaying, ac: T.acid, onClick: togglePlayback, disabled: !isReady, w: 48, h: 40 }), _jsx(HWBtn, { label: "\u25A0", sub: "STOP", onClick: stopPlayback, disabled: !isReady, w: 38, h: 40 }), _jsx(HWBtn, { label: "\u25CF", sub: "REC", ac: T.red, onClick: recordNextTrack, disabled: !isReady, w: 38, h: 40 })] }), _jsx("div", { style: { width: 1, height: 46, background: T.b1, flexShrink: 0 } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }, children: [_jsx(BeatDots, { beat: state.beat.beat, bar: state.beat.bar, isPlaying: state.isPlaying, sig: timeSig }), _jsx(SegDisplay, { value: String(Math.round(state.bpm)), label: "BPM", color: T.acid }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("div", { style: { display: 'flex', gap: 2 }, children: [[-5, '−5'], [-1, '−'], [1, '+'], [5, '+5']].map(([delta, lbl]) => (_jsx("button", { onClick: () => setBpm(Math.max(40, Math.min(240, state.bpm + Number(delta)))), style: {
                                                        width: delta === -5 || delta === 5 ? 24 : 18, height: 17,
                                                        background: T.bg2, border: `1px solid ${T.b2}`, color: T.t3,
                                                        fontSize: 9, cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace',
                                                    }, children: lbl }, lbl))) }), _jsx("button", { onClick: flashTap, style: {
                                                    height: 19, fontSize: 7, letterSpacing: '.12em', fontFamily: 'IBM Plex Mono,monospace',
                                                    background: tapF ? 'rgba(57,255,20,.1)' : T.bg2,
                                                    border: `1px solid ${tapF ? T.acid : T.b2}`,
                                                    borderLeft: `3px solid ${tapF ? T.acid : T.b1}`,
                                                    color: tapF ? T.acid : T.t3, cursor: 'pointer', transition: 'all .07s', whiteSpace: 'nowrap',
                                                }, children: "TAP TEMPO" })] })] }), _jsx("div", { style: { width: 1, height: 46, background: T.b1, flexShrink: 0 } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }, children: [_jsx("div", { style: { display: 'flex', gap: 2 }, children: ['4/4', '3/4', '5/4', '6/8', '7/8'].map(s => (_jsx("button", { onClick: () => { setTimeSig(s); setTimeSignature(s); }, style: {
                                                padding: '2px 5px', fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.08em',
                                                background: timeSig === s ? 'rgba(57,255,20,.07)' : T.bg2,
                                                border: `1px solid ${timeSig === s ? T.acid : T.b2}`,
                                                color: timeSig === s ? T.acid : T.t3, cursor: 'pointer',
                                            }, children: s }, s))) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("span", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em', whiteSpace: 'nowrap' }, children: "SWING" }), _jsx("input", { type: "range", min: 0, max: 100, value: Math.round(swing * 100), onChange: e => { const v = Number(e.target.value) / 100; setSwingLocal(v); setSwingEngine(v); }, style: { width: 60, accentColor: T.acid, cursor: 'pointer', height: 2 } }), _jsxs("span", { style: { fontSize: 6, color: swing > 0.05 ? T.acid : T.t5, fontFamily: 'IBM Plex Mono,monospace', width: 20 }, children: [Math.round(swing * 100), "%"] })] })] }), _jsx("div", { style: { width: 1, height: 46, background: T.b1, flexShrink: 0 } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }, children: [_jsx("span", { style: { fontSize: 6, color: T.t5, letterSpacing: '.25em', textAlign: 'center', whiteSpace: 'nowrap' }, children: "QUANTIZE" }), _jsx("div", { style: { display: 'flex', gap: 2 }, children: ['instant', '1/4', '1/2', '1m', '2m', 'free'].map(q => (_jsx("button", { onClick: () => { setQuant(q); setQuantMode(q); }, style: {
                                                padding: '3px 6px', fontSize: 6, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.08em',
                                                background: quant === q ? 'rgba(57,255,20,.07)' : T.bg2,
                                                border: `1px solid ${quant === q ? T.acid : T.b2}`,
                                                color: quant === q ? T.acid : T.t3, cursor: 'pointer',
                                            }, children: q }, q))) })] }), _jsx("div", { style: { width: 1, height: 46, background: T.b1, flexShrink: 0 } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', gap: 2 }, children: [_jsx(HWBtn, { label: "METRO", active: fx.metronomeOn, ac: T.cyan, onClick: toggleMetronome, w: 52, h: 28 }), _jsx(HWBtn, { label: "MONO", active: monoOn, ac: T.purple, onClick: () => { const ctx = getAudioContext(); if (!ctx || ctx.state !== 'running')
                                                    return; const next = !monoOn; setMono(next); if (getLoopEngine().initialized)
                                                    getLoopEngine().setMono(next); }, w: 44, h: 28 }), _jsx(HWBtn, { label: "LIMIT", active: limOn, ac: T.orange, onClick: () => { const ctx = getAudioContext(); if (!ctx || ctx.state !== 'running')
                                                    return; const next = !limOn; setLim(next); if (getLoopEngine().initialized)
                                                    getLoopEngine().enableLimiter(next); }, w: 44, h: 28 }), _jsx(HWBtn, { label: "GRAN", active: granOn, ac: T.teal, onClick: () => { const next = !granOn; setGranOn(next); if (getLoopEngine().initialized)
                                                    getLoopEngine().setGranularFreeze(next); }, w: 44, h: 28 })] }), _jsxs("div", { style: { display: 'flex', gap: 2 }, children: [_jsx(HWBtn, { label: "\u21BA UNDO", onClick: undo, disabled: !canUndo, w: 58, h: 26 }), _jsx(HWBtn, { label: caheld ? 'SURE?' : 'CLR ALL', active: caheld, ac: T.red, onMD: () => { caT.current = setTimeout(() => setCAH(true), 600); }, onMU: () => { if (caT.current)
                                                    clearTimeout(caT.current); if (caheld) {
                                                    clearAll();
                                                    setCAH(false);
                                                }
                                                else
                                                    setCAH(false); }, onML: () => { if (caT.current)
                                                    clearTimeout(caT.current); setCAH(false); }, title: "Hold to clear all", w: 62, h: 26 }), _jsx("button", { onClick: () => setShowK(v => !v), style: {
                                                    width: 28, height: 26, background: T.bg2,
                                                    border: `1px solid ${showK ? T.acid : T.b2}`, color: showK ? T.acid : T.t3,
                                                    cursor: 'pointer', fontSize: 13, flexShrink: 0,
                                                }, children: "?" })] })] }), _jsx("div", { style: { flex: 1, minWidth: 10 } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', gap: 9, alignItems: 'center' }, children: [_jsx(LED, { on: isReady, label: "AUDIO", color: T.acid, size: 7, ring: true }), _jsx(LED, { on: state.isPlaying, label: "PLAY", color: T.cyan, size: 7 }), _jsx(LED, { on: state.tracks.some(t => t.state === 'recording'), label: "REC", color: T.red, size: 7, pulse: true }), _jsx(LED, { on: midiSync, label: "MIDI", color: T.cyan, size: 7, pulse: true }), _jsx(LED, { on: state.soloActive, label: "SOLO", color: T.acid, size: 7 }), _jsx(LED, { on: fx.metronomeOn, label: "CLICK", color: T.cyan, size: 7, pulse: fx.metronomeOn }), _jsx(LED, { on: limOn, label: "LIMIT", color: T.orange, size: 7 }), _jsx(LED, { on: granOn, label: "GRAN", color: T.teal, size: 7, pulse: granOn })] }), _jsx(MasterBar, { isReady: isReady })] }), _jsx("div", { style: { width: 1, height: 46, background: T.b1, flexShrink: 0 } }), _jsx("div", { style: { flexShrink: 0 }, children: _jsx(FXKnob, { label: "OUTPUT", value: mg, color: T.t1, size: "md", onChange: handleMG }) })] }), _jsx("style", { children: `@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}` }), _jsx("div", { style: { overflow: "hidden", position: "relative", background: "#080808", padding: "5px 0", flexShrink: 0 }, children: _jsx("div", { style: { display: "flex", width: "max-content", animation: "ag-scroll 28s linear infinite" }, children: ["R3 Native", "Web Audio API", "Offline-First", "MIDI Support", "Polyphony", "Accessible", "MultiTrack DAW", "VST System", "R3 Native", "Web Audio API", "Offline-First", "MIDI Support", "Polyphony", "Accessible", "MultiTrack DAW", "VST System"].map((item, i) => (_jsxs("span", { style: { padding: "0 18px", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "\"IBM Plex Mono\",monospace", color: "#fff", whiteSpace: "nowrap" }, children: [item, _jsx("span", { style: { color: "#a3e635", marginLeft: 8 }, children: "/" })] }, i))) }) }), _jsxs("div", { style: { display: 'var(--ls-spec-disp, block)', flexShrink: 0, position: 'relative' }, children: [_jsx(Spectrum, { isReady: isReady, h: specH }), _jsx("div", { style: {
                                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
                                    cursor: 'ns-resize', background: 'transparent',
                                    borderBottom: `1px solid ${T.b1}`,
                                }, onMouseDown: e => {
                                    e.preventDefault();
                                    const startY = e.clientY;
                                    const startH = specH;
                                    const onMove = (ev) => {
                                        setSpecH(Math.min(120, Math.max(24, startH + (ev.clientY - startY))));
                                    };
                                    const onUp = () => {
                                        window.removeEventListener('mousemove', onMove);
                                        window.removeEventListener('mouseup', onUp);
                                    };
                                    window.addEventListener('mousemove', onMove);
                                    window.addEventListener('mouseup', onUp);
                                } })] }), _jsxs("div", { style: {
                            background: 'linear-gradient(180deg, #0a0a0a 0%, var(--t-b0xx) 100%)',
                            borderBottom: `1px solid ${T.b1}`,
                            display: 'flex', alignItems: 'stretch', flexShrink: 0,
                        }, children: [[
                                ['perform', 'PERFORM', 'F1'],
                                ['mixer', 'MIXER', 'F2'],
                                ['sequence', 'SEQUENCE', 'F3'],
                                ['clips', 'CLIPS', 'F4'],
                                ['macro', 'MACRO', 'F5'],
                            ].map(([v, label, key]) => (_jsxs("button", { onClick: () => setView(v), style: {
                                    padding: 'var(--ls-tab-py, 7px) var(--ls-tab-px, 16px)', fontFamily: 'IBM Plex Mono,monospace', fontSize: 7,
                                    letterSpacing: '.25em', textTransform: 'uppercase',
                                    background: view === v ? 'rgba(57,255,20,.05)' : 'transparent',
                                    borderBottom: `2px solid ${view === v ? T.acid : 'transparent'}`,
                                    border: 'none', color: view === v ? T.acid : T.t4, cursor: 'pointer',
                                    transition: 'all .1s', position: 'relative',
                                }, children: [label, _jsx("span", { style: { fontSize: 5, color: T.t5, marginLeft: 4, opacity: 0.5 }, children: key })] }, v))), _jsx("div", { style: { flex: 1 } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontSize: 7, color: T.t5, letterSpacing: '.15em' }, children: [_jsxs("span", { children: [state.tracks.filter(t => t.hasContent).length, "/5 LOOPS"] }), _jsx("span", { style: { color: state.soloActive ? T.acid : T.t5 }, children: state.soloActive ? '◉ SOLO' : '○ MIX' }), _jsxs("span", { children: ["Q:", quant] }), _jsx("span", { children: timeSig }), swing > 0.03 && _jsxs("span", { style: { color: T.yellow }, children: ["SWING:", Math.round(swing * 100), "%"] })] }), _jsx("button", { onClick: () => setPerf(v => !v), style: {
                                    padding: '0 16px', fontSize: 7, letterSpacing: '.15em', fontFamily: 'IBM Plex Mono,monospace',
                                    background: perf ? 'rgba(57,255,20,.06)' : 'transparent',
                                    border: 'none', borderLeft: `1px solid ${T.b1}`,
                                    color: perf ? T.acid : T.t4, cursor: 'pointer',
                                }, children: perf ? '◉ PERF' : '○ PERF' })] }), isError && (_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 14px', flexShrink: 0,
                            background: 'rgba(255,26,26,.06)', borderBottom: '1px solid rgba(255,26,26,.2)',
                            borderLeft: '4px solid var(--looper-red)', color: T.red, fontSize: 10,
                        }, children: [_jsxs("span", { children: ["\u26A0 ENGINE: ", errorMessage] }), _jsx("button", { onClick: init, style: {
                                    padding: '3px 12px', fontSize: 9, cursor: 'pointer',
                                    background: 'rgba(255,26,26,.1)', border: '1px solid rgba(255,26,26,.3)',
                                    color: T.red, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                                }, children: "RETRY" })] })), _jsxs("div", { style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }, children: [!perf && view !== 'sequence' && view !== 'clips' && view !== 'macro' && (_jsxs("div", { style: {
                                    width: 224, borderRight: `1px solid ${T.b1}`,
                                    display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
                                }, children: [_jsx(Panel, { title: "GLOBAL FX", accent: T.acid, children: _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }, children: [_jsx(FXKnob, { label: "FILTER", value: fv, color: T.acid, size: "md", onChange: v => { setFV(v); setFilter(v * 18000 + 200, v * 8 + 0.5); } }), _jsx(FXKnob, { label: "RESO", value: Math.min(1, Math.max(0, (fx.filterResonance - 0.5) / 8)), color: T.acid, size: "md", onChange: v => setFilter(fv * 18000 + 200, v * 8 + 0.5) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }, children: [_jsx("span", { style: { fontSize: 7, letterSpacing: '.1em', color: T.t5, fontFamily: 'IBM Plex Mono,monospace' }, children: "TYPE" }), _jsx("div", { style: { display: 'flex', gap: 2 }, children: ['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (_jsx("button", { onClick: () => setFilterType(t), style: {
                                                                    background: fx.filterType === t ? T.acid : T.b3,
                                                                    color: fx.filterType === t ? T.bg0 : T.t4,
                                                                    border: `1px solid ${fx.filterType === t ? T.acid : T.b4}`,
                                                                    borderRadius: 3, fontSize: 7, padding: '2px 4px',
                                                                    cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace',
                                                                    letterSpacing: '.08em', transition: 'all 0.15s',
                                                                }, children: t === 'lowpass' ? 'LP' : t === 'highpass' ? 'HP' : t === 'bandpass' ? 'BP' : 'NOTCH' }, t))) })] }), _jsx(FXKnob, { label: "DELAY", value: dv, color: T.cyan, size: "md", onChange: v => { setDV(v); setDelay(v > 0.5 ? '4n' : '8n', v * 0.8); } }), _jsx(FXKnob, { label: "REVERB", value: rv, color: T.orange, size: "md", onChange: v => { setRV(v); setReverb(v * 8 + 0.5, v); } }), _jsx(FXKnob, { label: "DRIVE", value: drv, color: T.red, size: "md", onChange: setDrv }), _jsx(FXKnob, { label: "CHORUS", value: cho, color: T.purple, size: "md", onChange: setCho }), _jsx(FXKnob, { label: "FLANGE", value: fla, color: T.pink, size: "md", onChange: setFla }), _jsx(FXKnob, { label: "PHASER", value: pha, color: T.blue, size: "md", onChange: setPha }), _jsx(FXKnob, { label: "BITCR", value: bit, color: T.orange, size: "md", onChange: setBit }), _jsx(FXKnob, { label: "WIDTH", value: sw, color: T.cyan, size: "md", onChange: setSW }), _jsx(FXKnob, { label: "TILT", value: tilt, color: T.yellow, size: "md", bipolar: true, onChange: setTilt }), _jsx(FXKnob, { label: "GRAN", value: gran, color: T.teal, size: "md", onChange: setGran })] }) }), _jsx(Panel, { title: "DELAY", accent: T.cyan, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "TIME", value: dTime, color: T.cyan, size: "sm", onChange: v => { setDTime(v); setDelay(v > 0.5 ? '4n' : '8n', dFeed * 0.8); } }), _jsx(FXKnob, { label: "FDBK", value: dFeed, color: T.cyan, size: "sm", onChange: v => { setDFeed(v); setDelay(dTime > 0.5 ? '4n' : '8n', v * 0.8); } }), _jsx(FXKnob, { label: "MIX", value: dv, color: T.cyan, size: "sm", onChange: setDV })] }) }), _jsx(Panel, { title: "REVERB", accent: T.orange, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "DECAY", value: rDecay, color: T.orange, size: "sm", onChange: v => { setRDec(v); setReverb(v * 10 + 0.5, rv); } }), _jsx(FXKnob, { label: "PRE-DLY", value: preDly, color: T.orange, size: "sm", onChange: v => { setPreDly(v); if (getLoopEngine().initialized)
                                                        getLoopEngine().setReverbPreDelay(v * 0.5); } }), _jsx(FXKnob, { label: "MIX", value: rv, color: T.orange, size: "sm", onChange: v => { setRV(v); setReverb(rDecay * 10 + 0.5, v); } })] }) }), _jsxs(Panel, { title: "GRANULAR", accent: T.teal, badge: granOn ? 'ACTIVE' : undefined, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-around', marginBottom: 6 }, children: [_jsx(FXKnob, { label: "SIZE", value: gran, color: T.teal, size: "sm", onChange: setGran }), _jsx(FXKnob, { label: "DENSITY", value: granDensity, color: T.teal, size: "sm", onChange: v => { setGranDensity(v); if (getLoopEngine().initialized)
                                                            getLoopEngine().setGranularDensity(v); } }), _jsx(FXKnob, { label: "SPREAD", value: granSpread, color: T.teal, size: "sm", onChange: v => { setGranSpread(v); if (getLoopEngine().initialized)
                                                            getLoopEngine().setGranularSpread(v); } })] }), _jsx("button", { onClick: () => { const next = !granOn; setGranOn(next); if (getLoopEngine().initialized)
                                                    getLoopEngine().setGranularFreeze(next); }, style: {
                                                    width: '100%', height: 20, fontSize: 7, cursor: 'pointer',
                                                    background: granOn ? 'rgba(20,184,166,.1)' : T.bg2,
                                                    border: `1px solid ${granOn ? T.teal : T.b2}`,
                                                    color: granOn ? T.teal : T.t3, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.15em',
                                                }, children: granOn ? '◉ FREEZE ON' : '○ FREEZE' })] }), _jsx(Panel, { title: "COMP", accent: T.yellow, children: _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: 'center' }, children: [_jsx(FXKnob, { label: "THRSH", value: cThresh, color: T.yellow, size: "sm", onChange: v => { setCThr(v); setCompressor(v * -40, -cRatio * 20 + 1); } }), _jsx(FXKnob, { label: "RATIO", value: cRatio, color: T.yellow, size: "sm", onChange: v => { setCRat(v); setCompressor(cThresh * -40, -v * 20 + 1); } }), _jsx(FXKnob, { label: "ATK", value: cAtk, color: T.yellow, size: "sm", onChange: setCAtk }), _jsx(FXKnob, { label: "REL", value: cRel, color: T.yellow, size: "sm", onChange: setCRel })] }) }), _jsx(Panel, { title: "XY MACRO", accent: T.cyan, children: _jsx("div", { style: { display: 'flex', justifyContent: 'center' }, children: _jsx(XYPad, { x: fx.xyX, y: fx.xyY, onChange: setXY, size: 174, labelTL: "FILT", labelTR: "WET", labelBL: "DRY", labelBR: "RVB" }) }) }), _jsx(BeatRepeat, {})] })), _jsx("div", { style: { flex: 1, minWidth: 0, overflowY: 'auto' }, children: !isReady ? (_jsxs("div", { style: {
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        justifyContent: 'center', gap: 24, padding: '80px 20px', minHeight: 360,
                                    }, children: [_jsx("div", { style: { display: 'flex', gap: 8 }, children: Array.from({ length: 5 }, (_, i) => (_jsx("div", { style: {
                                                    width: 88, height: 110,
                                                    background: T.bg2, border: `1px solid ${T.b2}`,
                                                    borderLeft: `3px solid ${T.b2}`,
                                                    opacity: 0.12 + i * 0.1,
                                                    animation: `lspulse 2.2s ${i * 0.18}s ease-in-out infinite`,
                                                } }, i))) }), _jsx("button", { onClick: init, style: {
                                                padding: '16px 48px', fontSize: 12, cursor: 'pointer',
                                                letterSpacing: '.3em', fontFamily: 'Syne,sans-serif', fontWeight: 800,
                                                background: 'rgba(57,255,20,.06)',
                                                border: '1px solid rgba(57,255,20,.3)', borderLeft: '4px solid var(--looper-acid-2)',
                                                color: T.acid, boxShadow: '0 0 40px rgba(57,255,20,.08)',
                                            }, children: "\u25B6 INITIALIZE ENGINE" }), _jsx("span", { style: { fontSize: 8, color: T.t5, letterSpacing: '.25em', fontFamily: 'IBM Plex Mono,monospace' }, children: "REQUIRES USER GESTURE \u00B7 CLICK TO ENABLE AUDIO" })] })) : (_jsxs(_Fragment, { children: [(view === 'perform' || view === 'mixer') && (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', height: '100%', overflowX: 'auto' }, children: state.tracks.map(track => (_jsx(TrackPad, { track: track, bpm: state.bpm, isReady: isReady, beat: state.beat, onPress: pressTrack, onStop: stopTrack, onClear: clearTrack, onVolumeChange: setTrackVolume, onPanChange: setTrackPan, onEQChange: setTrackEQ, onMuteToggle: toggleMute, onSoloToggle: toggleSolo, onCueToggle: toggleCue, onHarmonyChange: setHarmonyMode, onReverbSend: setReverbSend, onDelaySend: setDelaySend, onChorusSend: setChorusSend, onPitchChange: setTrackPitchFX, onFineChange: setTrackFineTune, onChorusChange: setTrackChorusFX, onGateChange: setTrackGateFX, onCompChange: setTrackCompFX, onSatChange: setTrackSatFX, onTrimChange: setTrackTrimFX }, track.id))) })), view === 'sequence' && (_jsx("div", { style: { padding: 14 }, children: _jsx(Sequencer32, { tracks: state.tracks.map(t => ({ id: t.id, color: t.color, index: t.index })), beat: state.beat.beat, isPlaying: state.isPlaying, bpm: state.bpm }) })), view === 'clips' && (_jsx(ClipLauncher, { tracks: state.tracks.map(t => ({ id: t.id, color: t.color, index: t.index })), isReady: isReady, beat: state.beat, bpm: state.bpm })), view === 'macro' && _jsx(MacroPanel, {})] })) }), !perf && (_jsxs("div", { style: {
                                    width: 194, borderLeft: `1px solid ${T.b1}`,
                                    display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
                                }, children: [_jsx(Panel, { title: "SCENE BANK", accent: T.acid, badge: "16 SLOTS", children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }, children: 'ABCDEFGHIJKLMNOP'.split('').map((lbl, i) => (_jsx(SceneBtn, { label: lbl, hasData: !!scenes[i], isActive: activeScene === i, color: i < 4 ? T.acid : i < 8 ? T.cyan : i < 12 ? T.orange : T.purple, onSave: () => saveScene(i), onRecall: () => recallScene(i) }, lbl))) }), _jsx("span", { style: { fontSize: 6, color: T.t5, letterSpacing: '.1em', textAlign: 'center', fontFamily: 'IBM Plex Mono,monospace' }, children: "TAP \u00B7 RECALL / HOLD \u00B7 SAVE" })] }) }), _jsx(Panel, { title: "MASTER EQ", accent: T.cyan, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "SUB", value: 0.5, color: T.cyan, size: "sm", bipolar: true, onChange: () => { } }), _jsx(FXKnob, { label: "LF", value: eqLF, color: T.cyan, size: "sm", bipolar: true, onChange: v => { setEqLF(v); if (getLoopEngine().initialized)
                                                        getLoopEngine().setMultibandBand('low', 0, 1, (v - 0.5) * 24); } }), _jsx(FXKnob, { label: "HMF", value: eqHMF, color: T.cyan, size: "sm", bipolar: true, onChange: v => { setEqHMF(v); if (getLoopEngine().initialized)
                                                        getLoopEngine().setMultibandBand('mid', 0, 1, (v - 0.5) * 24); } }), _jsx(FXKnob, { label: "HF", value: eqHF, color: T.cyan, size: "sm", bipolar: true, onChange: v => { setEqHF(v); if (getLoopEngine().initialized)
                                                        getLoopEngine().setMultibandBand('high', 0, 1, (v - 0.5) * 24); } })] }) }), _jsx(Panel, { title: "OUTPUT", accent: T.t1, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, justifyContent: 'center' }, children: [_jsx(FXKnob, { label: "GAIN", value: mg, color: T.t1, size: "md", onChange: handleMG }), _jsx(FXKnob, { label: "WIDTH", value: sw, color: T.cyan, size: "md", onChange: setSW })] }), _jsx(VUMeter, { trackIndex: 0, isActive: isReady, showScale: true, height: 64, showGr: true, showCorr: true }), _jsxs("div", { style: { display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }, children: [_jsx(HWBtn, { label: "MONO", active: monoOn, ac: T.purple, onClick: () => { const ctx = getAudioContext(); if (!ctx || ctx.state !== 'running')
                                                                return; const next = !monoOn; setMono(next); if (getLoopEngine().initialized)
                                                                getLoopEngine().setMono(next); }, w: 52, h: 22 }), _jsx(HWBtn, { label: "LIMIT", active: limOn, ac: T.orange, onClick: () => { const ctx = getAudioContext(); if (!ctx || ctx.state !== 'running')
                                                                return; const next = !limOn; setLim(next); if (getLoopEngine().initialized)
                                                                getLoopEngine().enableLimiter(next); }, w: 52, h: 22 })] })] }) }), _jsx(Panel, { title: "SEND / RETURN", accent: T.orange, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "REV RTN", value: rv, color: T.orange, size: "sm", onChange: v => { setRV(v); setReverb(rDecay * 10 + 0.5, v); } }), _jsx(FXKnob, { label: "DLY RTN", value: dv, color: T.cyan, size: "sm", onChange: v => { setDV(v); setDelay(dTime > 0.5 ? '4n' : '8n', v * 0.8); } }), _jsx(FXKnob, { label: "GRN RTN", value: gran, color: T.teal, size: "sm", onChange: setGran })] }) }) }), _jsx(Panel, { title: "CLOCK / SYNC", accent: T.cyan, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [
                                                ['INT CLOCK', !midiSync],
                                                ['MIDI IN', midiInputEnabled],
                                                ['LINK', false],
                                                ['MIDI OUT', false],
                                                ['VIDEO', false],
                                            ].map(([lbl, on]) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: 7, color: on ? T.t3 : T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em' }, children: lbl }), _jsx(LED, { on: on, color: T.cyan, size: 6, pulse: on && midiSync })] }, lbl))) }) }), _jsx(Panel, { title: "INPUTS", accent: T.purple, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [
                                                ['MIC 1', true], ['MIC 2', false], ['LINE IN', false],
                                                ['USB', true], ['SPDIF', false], ['LOOP', true],
                                            ].map(([lbl, on]) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontSize: 7, color: on ? T.t3 : T.t5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em' }, children: lbl }), _jsx(LED, { on: on, color: T.purple, size: 6 })] }, lbl))) }) }), _jsx(Panel, { title: "LOOP STATUS", accent: T.orange, style: { flex: 1 }, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 5 }, children: state.tracks.map(t => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("div", { style: {
                                                            width: 3, height: 12,
                                                            background: t.state === 'empty' ? T.b2 : t.color,
                                                            boxShadow: t.state !== 'empty' ? `0 0 6px ${t.color}66` : 'none', flexShrink: 0,
                                                        } }), _jsxs("span", { style: { fontSize: 7, color: T.t4, fontFamily: 'IBM Plex Mono,monospace', width: 14, letterSpacing: '.1em' }, children: ["T", t.index + 1] }), _jsxs("div", { style: { flex: 1, height: 4, background: T.bg0, position: 'relative', overflow: 'hidden' }, children: [t.hasContent && (_jsx("div", { style: {
                                                                    position: 'absolute', inset: 0,
                                                                    background: t.state === 'playing' || t.state === 'overdubbing'
                                                                        ? `linear-gradient(90deg, ${t.color}99, ${t.color}66)` : `${t.color}33`,
                                                                    width: '100%', transition: 'background .2s',
                                                                } })), (t.state === 'playing' || t.state === 'overdubbing') && (_jsx("div", { style: {
                                                                    position: 'absolute', top: 0, bottom: 0,
                                                                    left: `${(state.beat.beat / 4) * 100}%`,
                                                                    width: 2, background: 'var(--white)', opacity: 0.6,
                                                                    transition: 'left 0.04s',
                                                                } }))] }), _jsxs("div", { style: { display: 'flex', gap: 1, alignItems: 'center' }, children: [t.isMuted && _jsx("div", { style: { width: 3, height: 3, background: T.orange } }), t.isSoloed && _jsx("div", { style: { width: 3, height: 3, background: T.acid } })] }), _jsx("span", { style: { fontSize: 6, color: T.t5, fontFamily: 'IBM Plex Mono,monospace', width: 24, textAlign: 'right' }, children: t.loopLength ?? '—' })] }, t.id))) }) })] }))] }), _jsxs("div", { style: {
                            background: 'var(--panel)', borderTop: `1px solid ${T.b1}`,
                            padding: 'var(--ls-status-py, 4px) 14px', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 8, fontSize: 7, color: T.t5,
                            letterSpacing: '.12em', fontFamily: 'IBM Plex Mono,monospace',
                            flexWrap: 'wrap',
                        }, children: [_jsx("span", { style: { color: isReady ? 'rgba(57,255,20,.6)' : T.t5 }, children: isReady ? '● AUDIO ONLINE' : '○ STANDBY' }), _jsxs("span", { children: ["Q:", quant] }), _jsxs("span", { children: [timeSig, " ", swing > 0.03 ? `SW:${Math.round(swing * 100)}%` : ''] }), _jsxs("span", { children: [state.tracks.filter(t => t.hasContent).length, "/5 LOOPS LOADED"] }), _jsxs("span", { children: [Math.round(state.bpm), " BPM"] }), _jsx("span", { children: midiSync ? '⇄ MIDI SYNC' : '○ INT CLK' }), _jsx("button", { onClick: toggleMidiInput, disabled: !isReady, title: midiInputEnabled
                                    ? `MIDI IN active${midiInputs.length ? ': ' + midiInputs[0] : ''}`
                                    : 'Enable MIDI input — C3/D3/E3/F3/G3 → tracks 1–5', style: {
                                    marginLeft: 8,
                                    background: midiInputEnabled ? T.cyan : T.b3,
                                    color: midiInputEnabled ? T.bg0 : T.t3,
                                    border: `1px solid ${midiInputEnabled ? T.cyan : T.b4}`,
                                    borderRadius: 3,
                                    fontSize: 9,
                                    padding: '2px 6px',
                                    cursor: isReady ? 'pointer' : 'not-allowed',
                                    letterSpacing: '0.1em',
                                    fontFamily: 'IBM Plex Mono, monospace',
                                    transition: 'all 0.15s',
                                }, children: "MIDI IN" }), _jsx("button", { onClick: toggleMidiClock, disabled: !isReady, title: midiSync ? 'Disable MIDI clock output' : 'Enable MIDI clock output', style: {
                                    marginLeft: 4,
                                    background: midiSync ? T.teal : T.b3,
                                    color: midiSync ? T.bg0 : T.t3,
                                    border: `1px solid ${midiSync ? T.teal : T.b4}`,
                                    borderRadius: 3,
                                    fontSize: 9,
                                    padding: '2px 6px',
                                    cursor: isReady ? 'pointer' : 'not-allowed',
                                    letterSpacing: '0.1em',
                                    fontFamily: 'IBM Plex Mono, monospace',
                                    transition: 'all 0.15s',
                                }, children: midiSync ? 'CLK OUT ●' : 'CLK OUT ○' }), midiInputs.length > 1 && (_jsx("select", { value: midiInputs[0], onChange: e => selectMidiInputByIndex(midiInputs.indexOf(e.target.value)), disabled: !midiInputEnabled, style: {
                                    marginLeft: 4,
                                    background: T.b3,
                                    color: T.t3,
                                    border: `1px solid ${T.b4}`,
                                    borderRadius: 3,
                                    fontSize: 7,
                                    padding: '2px 4px',
                                    fontFamily: 'IBM Plex Mono,monospace',
                                    letterSpacing: '.08em',
                                    cursor: midiInputEnabled ? 'pointer' : 'not-allowed',
                                }, children: midiInputs.map((name, i) => (_jsx("option", { value: name, children: name }, i))) })), _jsx("span", { children: monoOn ? '⊕ MONO' : '⊞ STEREO' }), _jsx("span", { children: limOn ? '◼ LIM' : '◻ LIM' }), granOn && _jsx("span", { style: { color: T.teal }, children: "\u25C9 GRAN FREEZE" }), _jsx("span", { style: { color: T.t5, opacity: 0.35 }, children: "R3/LOOP v2 \u00B7 RC-505 MkII NATIVE" })] }), _jsx("div", { style: {
                            height: 2, flexShrink: 0,
                            background: 'linear-gradient(90deg,transparent,rgba(57,255,20,.15),rgba(34,211,238,.08),rgba(57,255,20,.15),transparent)',
                        } })] })] }));
};
