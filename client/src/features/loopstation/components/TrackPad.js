import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─── TrackPad v2 — Professional Channel Strip ─────────────────────────────────
import { motion, useAnimation } from 'framer-motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getLoopEngine } from '../engine/loopEngine';
import { RGBRing } from './RGBRing';
import { VUMeter } from './VUMeter';
import { WaveformCanvas } from './WaveformCanvas';
import { FXKnob } from './FXKnob';
// ── Constants ──────────────────────────────────────────────────────────────────
const HARMONY = ['off', 'subtle', 'choir', 'ambient', 'counter', 'octave', 'fifth', 'unison'];
const PLAYBACK = [
    { key: 'normal', label: '▶', color: 'var(--looper-acid)' },
    { key: 'reverse', label: '◀', color: 'var(--looper-pink)' },
    { key: 'half', label: '½', color: 'var(--looper-purple)' },
    { key: 'double', label: '2x', color: 'var(--looper-purple)' },
    { key: 'stutter', label: 'STU', color: 'var(--orange-400)' },
    { key: 'pingpong', label: '⇄', color: 'var(--looper-cyan)' },
];
const SCOL = {
    idle: 'var(--t-b2x)',
    recording: 'var(--looper-red)',
    overdubbing: 'var(--looper-orange)',
    playing: 'var(--looper-acid)',
    stopped: 'var(--t-b3x)',
    waiting_record: 'var(--looper-red)',
    waiting_play: 'var(--looper-acid)',
};
const SLBL = {
    idle: '○',
    recording: 'REC',
    overdubbing: 'OD',
    playing: '▶',
    stopped: '■',
    waiting_record: '⟳REC',
    waiting_play: '⟳PLY',
};
const TRACK_NAMES = ['TRACK 1', 'TRACK 2', 'TRACK 3', 'TRACK 4', 'TRACK 5'];
// ── Utilities ──────────────────────────────────────────────────────────────────
function useQPulse(ready) {
    const [p, setP] = useState(false);
    const id = useRef(-1);
    useEffect(() => {
        if (!ready)
            return;
        const e = getLoopEngine();
        if (!e.initialized)
            return;
        id.current = e.scheduleRepeat(() => { setP(true); setTimeout(() => setP(false), 80); }, '1m');
        return () => { e.clearSchedule(id.current); id.current = -1; };
    }, [ready]);
    return p;
}
// ── Micro LED Button ───────────────────────────────────────────────────────────
const LB = ({ label, active, ac = 'var(--looper-acid)', disabled, onClick, onMD, onMU, onML, title, w = 24, h = 18, fontSize = 7 }) => (_jsxs("button", { onClick: onClick, onMouseDown: onMD, onMouseUp: onMU, onMouseLeave: onML, disabled: disabled, title: title, style: {
        width: w, height: h, fontSize, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.08em',
        background: active ? `${ac}16` : 'var(--t-b0)',
        border: `1px solid ${active ? ac : 'var(--panel)'}`,
        borderBottom: `2px solid ${active ? ac + '66' : '#0a0a0a'}`,
        color: active ? ac : disabled ? 'var(--dj-surface2)' : 'var(--panel-mid)',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .07s', userSelect: 'none',
        boxShadow: active ? `0 0 8px ${ac}44, inset 0 0 4px ${ac}11` : 'none',
        position: 'relative', overflow: 'hidden',
    }, children: [active && (_jsx("div", { style: {
                position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg, transparent, ${ac}88, transparent)`,
            } })), label] }));
// ── Vertical Fader ─────────────────────────────────────────────────────────────
const Fader = ({ value, onChange, color, h = 80, label }) => {
    const dragging = useRef(false);
    const sy = useRef(0);
    const sv = useRef(value);
    const tref = useRef(null);
    const md = (e) => {
        e.preventDefault();
        dragging.current = true;
        sy.current = e.clientY;
        sv.current = value;
        const mv = (ev) => {
            if (!dragging.current || !tref.current)
                return;
            const ht = tref.current.getBoundingClientRect().height;
            onChange(Math.min(1, Math.max(0, sv.current - (ev.clientY - sy.current) / ht)));
        };
        const up = () => {
            dragging.current = false;
            window.removeEventListener('mousemove', mv);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', mv);
        window.addEventListener('mouseup', up);
    };
    // Double-click to reset to unity (0.8)
    const dblClick = () => onChange(0.8);
    const capY = `${(1 - value) * (h - 8)}px`;
    const unityY = `${(1 - 0.8) * (h - 8)}px`;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }, children: [_jsxs("div", { ref: tref, style: {
                    width: 10, height: h,
                    background: 'linear-gradient(180deg, #0d0d0d 0%, var(--t-b0x) 100%)',
                    border: '1px solid var(--t-b2)',
                    borderRadius: 1,
                    position: 'relative', cursor: 'ns-resize',
                }, onMouseDown: md, onDoubleClick: dblClick, children: [_jsx("div", { style: {
                            position: 'absolute', bottom: 0, left: 1, right: 1,
                            height: `${value * 100}%`,
                            background: `linear-gradient(180deg, ${color}55, ${color}1a)`,
                            borderTop: `1px solid ${color}66`,
                            transition: 'none',
                        } }), _jsx("div", { style: {
                            position: 'absolute', left: -3, right: -3,
                            top: unityY, height: 1,
                            background: 'var(--dj-dimmer)',
                        } }), _jsx("div", { style: {
                            position: 'absolute', top: capY, left: -3, right: -3, height: 10,
                            background: 'linear-gradient(180deg, var(--panel-mid) 0%, var(--t-b3) 50%, #2a2a2a 100%)',
                            border: `1px solid ${value > 0.01 ? color + '88' : 'var(--t-b4)'}`,
                            borderRadius: 1,
                            boxShadow: value > 0.01 ? `0 0 6px ${color}44` : '0 1px 3px rgba(0,0,0,0.8)',
                            cursor: 'ns-resize',
                        } })] }), _jsx("span", { style: { fontSize: 5, color: 'var(--t-b3x)', fontFamily: 'IBM Plex Mono,monospace' }, children: Math.round(value * 100) }), label && _jsx("span", { style: { fontSize: 5, color: 'var(--t-b3)', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.15em' }, children: label })] }));
};
// ── EQ Mini Display ────────────────────────────────────────────────────────────
const EQMini = ({ low, mid, high, color }) => {
    const vals = [low, mid, high];
    const labels = ['L', 'M', 'H'];
    return (_jsx("div", { style: { display: 'flex', gap: 2, alignItems: 'flex-end', height: 18 }, children: vals.map((v, i) => {
            const norm = (v + 20) / 40; // -20 to +20 → 0 to 1
            const _barH = Math.max(2, Math.round(norm * 16));
            const _midH = 8;
            const isBoost = norm > 0.5;
            return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }, children: [_jsxs("div", { style: {
                            width: 6, height: 16, background: 'var(--t-b0)',
                            border: '1px solid var(--t-b2)', position: 'relative', overflow: 'hidden',
                        }, children: [_jsx("div", { style: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--t-b3)' } }), _jsx("div", { style: {
                                    position: 'absolute',
                                    [isBoost ? 'bottom' : 'top']: '50%',
                                    left: 0, right: 0,
                                    height: Math.abs(norm - 0.5) * 32,
                                    background: Math.abs(norm - 0.5) > 0.1 ? `${color}88` : 'var(--t-b3)',
                                } })] }), _jsx("span", { style: { fontSize: 4, color: 'var(--t-b3)', fontFamily: 'IBM Plex Mono,monospace' }, children: labels[i] })] }, labels[i]));
        }) }));
};
// ── Loop Progress Ring ─────────────────────────────────────────────────────────
const LoopRing = ({ progress, color, isActive, size = 24 }) => {
    const r = (size - 3) / 2;
    const circ = 2 * Math.PI * r;
    const dash = progress * circ;
    return (_jsxs("svg", { width: size, height: size, style: { transform: 'rotate(-90deg)', flexShrink: 0 }, children: [_jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: "var(--t-b2)", strokeWidth: 2 }), _jsx("circle", { cx: size / 2, cy: size / 2, r: r, fill: "none", stroke: isActive ? color : 'var(--dj-border)', strokeWidth: isActive ? 2.5 : 1.5, strokeDasharray: `${dash} ${circ - dash}`, strokeLinecap: "round", style: { filter: isActive ? `drop-shadow(0 0 3px ${color}88)` : 'none', transition: 'stroke-dasharray 0.1s' } })] }));
};
// ── Send Strip ─────────────────────────────────────────────────────────────────
const SendStrip = ({ label, value, color, onChange }) => {
    const w = 48;
    const dragging = useRef(false);
    const sx = useRef(0), sv2 = useRef(value);
    const md = (e) => {
        e.preventDefault();
        dragging.current = true;
        sx.current = e.clientX;
        sv2.current = value;
        const mv = (ev) => {
            if (!dragging.current)
                return;
            onChange(Math.min(1, Math.max(0, sv2.current + (ev.clientX - sx.current) / 120)));
        };
        const up = () => { dragging.current = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', mv);
        window.addEventListener('mouseup', up);
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 6, color: 'var(--t-b3x)', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em' }, children: label }), _jsx("span", { style: { fontSize: 6, color: value > 0.05 ? color : 'var(--dj-border)', fontFamily: 'IBM Plex Mono,monospace' }, children: Math.round(value * 100) })] }), _jsxs("div", { style: {
                    width: '100%', height: 8, background: 'var(--t-b0)',
                    border: '1px solid var(--t-b2)', position: 'relative', cursor: 'ew-resize',
                }, onMouseDown: md, children: [_jsx("div", { style: {
                            position: 'absolute', left: 0, top: 0, bottom: 0, width: `${value * 100}%`,
                            background: `linear-gradient(90deg, ${color}44, ${color}88)`,
                            borderRight: value > 0.02 ? `1px solid ${color}` : 'none',
                        } }), _jsx("div", { style: {
                            position: 'absolute', right: 3, top: 0, bottom: 0,
                            display: 'flex', alignItems: 'center',
                        } })] })] }));
};
// ═══════════════════════════════════════════════════════════════════════════════
// TRACKPAD MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TrackPadInner = ({ track, bpm, isReady, beat, onPress, onStop, onClear, onVolumeChange, onPanChange, onEQChange, onMuteToggle, onSoloToggle, onCueToggle, onHarmonyChange, onReverbSend, onDelaySend, onChorusSend, onPitchChange, onFineChange, onChorusChange, onGateChange, onCompChange, onSatChange, onTrimChange, }) => {
    const ctrl = useAnimation();
    const pulse = useQPulse(isReady);
    const [expanded, setExpanded] = useState(false);
    const [tab, setTab] = useState('eq');
    const [playMode, setPlayMode] = useState('normal');
    const [ch, setCH] = useState(false);
    const [loopProgress, setLoopProgress] = useState(0);
    const [overdubBlend, setOD] = useState(0.7);
    const ct = useRef(null);
    const lpRef = useRef(0);
    const _lastBar = useRef(0);
    const isActive = track.state === 'playing' || track.state === 'overdubbing';
    const isRec = track.state === 'recording';
    const isWaiting = track.state === 'recording' || track.state === 'playing';
    const col = SCOL[track.state] ?? 'var(--t-b2x)';
    const wc = track.state === 'overdubbing' ? 'var(--looper-orange)' : track.color;
    // Animate loop progress
    useEffect(() => {
        if (!isActive || !track.loopLength) {
            setLoopProgress(0);
            return;
        }
        const tick = () => {
            const pos = beat.bar % (Number(track.loopLength) || 4);
            const beatInLoop = pos * 4 + beat.beat;
            const totalBeats = (Number(track.loopLength) || 4) * 4;
            setLoopProgress(beatInLoop / totalBeats);
            lpRef.current = requestAnimationFrame(tick);
        };
        lpRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(lpRef.current);
    }, [isActive, beat, track.loopLength]);
    // Trigger pad animation
    useEffect(() => {
        if (isActive) {
            void ctrl.start({
                scale: [1, beat.beat === 0 && pulse ? 1.015 : 1.006, 1],
                transition: { duration: (60 / bpm) * 0.25, ease: [0.22, 1, 0.36, 1] },
            });
        }
        else if (isRec && pulse) {
            void ctrl.start({ scale: [1, 1.01, 1], transition: { duration: 0.08 } });
        }
        else if (isWaiting) {
            void ctrl.start({
                scale: [1, 1.008, 1],
                transition: { duration: 0.25, repeat: Infinity, ease: 'easeInOut' },
            });
        }
        else {
            ctrl.stop();
            ctrl.set({ scale: 1 });
        }
    }, [isActive, isRec, isWaiting, beat.beat, pulse, bpm, ctrl]);
    const hCH = useCallback(() => { ct.current = setTimeout(() => setCH(true), 600); }, []);
    const hCU = useCallback(() => {
        if (ct.current)
            clearTimeout(ct.current);
        if (ch) {
            onClear(track.id);
            setCH(false);
        }
        else
            setCH(false);
    }, [ch, onClear, track.id]);
    const trackBgGrad = isActive
        ? `radial-gradient(ellipse at 50% 80%, ${col}0d 0%, var(--void) 100%)`
        : 'var(--t-b0xx)';
    return (_jsxs("div", { style: {
            display: 'flex', flexDirection: 'column',
            background: trackBgGrad,
            borderRight: '1px solid var(--t-b1)',
            boxShadow: isActive
                ? `inset 0 0 40px ${col}08, inset -1px 0 0 ${col}1a`
                : 'none',
            transition: 'box-shadow 0.3s, background 0.3s',
            minWidth: 0,
        }, children: [_jsxs("div", { style: {
                    padding: '4px 6px 3px',
                    background: 'linear-gradient(180deg, var(--dj-surface) 0%, var(--t-b0x) 100%)',
                    borderBottom: `2px solid ${col}`,
                    display: 'flex', alignItems: 'center', gap: 4,
                    position: 'relative', overflow: 'hidden',
                }, children: [_jsx("div", { style: {
                            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                            background: `linear-gradient(90deg, transparent 0%, ${col}66 40%, ${col}33 70%, transparent 100%)`,
                        } }), _jsx("div", { style: {
                            width: 20, height: 20, flexShrink: 0,
                            background: isActive ? col : 'transparent',
                            border: `1px solid ${col}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: isActive ? `0 0 12px ${col}77, 0 0 24px ${col}33` : 'none',
                            transition: 'all 0.15s',
                        }, children: _jsx("span", { style: {
                                fontSize: 10, fontWeight: 900, fontFamily: 'Syne, sans-serif',
                                color: isActive ? 'var(--panel)' : col, lineHeight: 1,
                            }, children: track.index + 1 }) }), _jsx(LoopRing, { progress: loopProgress, color: col, isActive: isActive, size: 22 }), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 3 }, children: [track.overdubLayers > 0 && (_jsxs("span", { style: {
                                            fontSize: 6, color: 'var(--looper-orange)', background: 'rgba(255,107,0,0.12)',
                                            border: '1px solid rgba(255,107,0,0.25)', padding: '0 3px',
                                            fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.05em', flexShrink: 0,
                                        }, children: ["\u00D7", track.overdubLayers + 1] })), track.isMuted && _jsx("div", { style: { width: 4, height: 4, background: 'var(--looper-orange)', boxShadow: '0 0 4px var(--looper-orange)', flexShrink: 0 } }), track.isSoloed && _jsx("div", { style: { width: 4, height: 4, background: 'var(--looper-acid)', boxShadow: '0 0 4px var(--looper-acid)', flexShrink: 0 } }), track.cued && _jsx("div", { style: { width: 4, height: 4, background: 'var(--looper-cyan)', boxShadow: '0 0 4px var(--looper-cyan)', flexShrink: 0 } })] }), _jsxs("span", { style: {
                                    fontSize: 6, color: col, fontFamily: 'IBM Plex Mono,monospace',
                                    letterSpacing: '.08em', lineHeight: 1,
                                }, children: [SLBL[track.state], track.loopLength ? ` · ${track.loopLength}` : ''] })] }), _jsx(EQMini, { low: track.eq.low, mid: track.eq.mid, high: track.eq.high, color: track.color })] }), _jsxs(motion.button, { animate: ctrl, whileTap: { scale: 0.975, transition: { duration: 0.04 } }, onClick: () => onPress(track.id), style: {
                    position: 'relative', height: 88,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${col}1a`,
                    cursor: 'pointer', overflow: 'hidden',
                    display: 'block', width: '100%',
                }, "aria-label": `Track ${track.index + 1}: ${track.state}`, children: [_jsx(RGBRing, { state: track.state, bpm: bpm, color: track.color }), isActive ? (_jsx(WaveformCanvas, { trackIndex: track.index, isActive: isActive, color: wc, mode: "mirror", persistence: 0.22, width: 200, height: 84, className: "" })) : (_jsxs("div", { style: {
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            height: '100%', gap: 5, position: 'relative', zIndex: 1,
                        }, children: [_jsx("div", { style: {
                                    fontSize: isRec ? 12 : 22, color: col,
                                    fontFamily: isRec ? 'IBM Plex Mono,monospace' : 'Syne,sans-serif',
                                    fontWeight: 900, lineHeight: 1,
                                    textShadow: isRec ? `0 0 12px ${col}` : 'none',
                                }, children: SLBL[track.state] }), _jsx("span", { style: { fontSize: 7, color: 'var(--t-b3)', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em' }, children: track.hasContent ? 'PLAY / OVERDUB' : 'TAP TO RECORD' }), _jsxs("span", { style: {
                                    fontSize: 5, color: 'var(--t-b2)',
                                    fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.3em',
                                    marginTop: 2,
                                }, children: ["KEY ", track.index + 1] })] })), isRec && pulse && (_jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            border: '2px solid var(--looper-red)',
                            opacity: 0.7, pointerEvents: 'none',
                        } })), isWaiting && (_jsx("div", { style: {
                            position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                            fontSize: 6, color: col, fontFamily: 'IBM Plex Mono,monospace',
                            letterSpacing: '.2em', background: 'rgba(0,0,0,0.8)', padding: '1px 4px',
                        }, children: "WAITING\u2026" }))] }), _jsxs("div", { style: { padding: '3px 5px', borderBottom: '1px solid var(--t-b1)', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 2 }, children: [_jsx(LB, { label: "\u25A0", active: false, disabled: track.state === 'empty', onClick: () => onStop(track.id), title: "Stop" }), _jsx(LB, { label: "M", active: track.isMuted, ac: "var(--looper-orange)", onClick: () => onMuteToggle(track.id), title: "Mute" }), _jsx(LB, { label: "S", active: track.isSoloed, ac: "var(--looper-acid)", onClick: () => onSoloToggle(track.id), title: "Solo" }), _jsx(LB, { label: "Q", active: track.cued, ac: "var(--looper-cyan)", onClick: () => onCueToggle(track.id), title: "Cue / Headphones" }), _jsx(LB, { label: ch ? '!CLR' : 'CLR', active: ch, ac: "var(--looper-red)", onMD: hCH, onMU: hCU, onML: () => { if (ct.current)
                            clearTimeout(ct.current); setCH(false); }, title: "Hold to clear" })] }), _jsxs("div", { style: { padding: '6px 5px 4px', borderBottom: '1px solid var(--t-b1)', display: 'flex', gap: 4, alignItems: 'flex-end', justifyContent: 'center', background: 'var(--t-b0xx)' }, children: [_jsx(Fader, { value: track.volume, onChange: v => onVolumeChange(track.id, v), color: track.color, h: 84 }), _jsx(VUMeter, { trackIndex: track.index, isActive: isActive, showScale: true, height: 84, showGr: isActive })] }), _jsxs("div", { style: { padding: '5px 6px', borderBottom: '1px solid var(--t-b1)', display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx(SendStrip, { label: "REV", value: track.reverbSend, color: "var(--looper-orange)", onChange: v => onReverbSend(track.id, v) }), _jsx(SendStrip, { label: "DLY", value: track.delaySend, color: "var(--looper-cyan)", onChange: v => onDelaySend(track.id, v) }), _jsx(SendStrip, { label: "CHO", value: track.chorusSend ?? 0, color: "var(--accent-violet)", onChange: v => onChorusSend(track.id, v) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, children: [_jsx("span", { style: { fontSize: 6, color: 'var(--t-b3x)', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em', flexShrink: 0 }, children: "PAN" }), _jsxs("div", { style: { flex: 1, position: 'relative', height: 8, background: 'var(--t-b0)', border: '1px solid var(--t-b2)', cursor: 'ew-resize' }, onMouseDown: e => {
                                    e.preventDefault();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const sv = track.pan;
                                    const sx = e.clientX;
                                    const mv = (ev) => {
                                        const newPan = Math.min(1, Math.max(-1, sv + (ev.clientX - sx) / (rect.width / 2)));
                                        onPanChange(track.id, newPan);
                                    };
                                    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
                                    window.addEventListener('mousemove', mv);
                                    window.addEventListener('mouseup', up);
                                }, onDoubleClick: () => onPanChange(track.id, 0), children: [_jsx("div", { style: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--t-b3)' } }), _jsx("div", { style: {
                                            position: 'absolute',
                                            left: track.pan >= 0 ? '50%' : `${(track.pan + 1) * 50}%`,
                                            width: `${Math.abs(track.pan) * 50}%`,
                                            top: 0, bottom: 0,
                                            background: `${track.color}77`,
                                        } }), _jsx("div", { style: {
                                            position: 'absolute', top: 0, bottom: 0,
                                            left: `${(track.pan + 1) * 50}%`,
                                            width: 2, background: track.color,
                                            transform: 'translateX(-50%)',
                                            boxShadow: `0 0 4px ${track.color}`,
                                        } })] }), _jsx("span", { style: { fontSize: 6, color: Math.abs(track.pan) > 0.05 ? track.color : 'var(--dj-border)', fontFamily: 'IBM Plex Mono,monospace', flexShrink: 0, width: 18, textAlign: 'right' }, children: track.pan === 0 ? 'C' : `${track.pan > 0 ? 'R' : 'L'}${Math.round(Math.abs(track.pan) * 100)}` })] })] }), _jsx("button", { onClick: () => setExpanded(v => !v), style: {
                    padding: '3px 6px', width: '100%', height: 16, fontSize: 6,
                    letterSpacing: '.2em', fontFamily: 'IBM Plex Mono,monospace',
                    background: expanded ? 'rgba(57,255,20,0.03)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--t-b1)',
                    color: expanded ? 'var(--looper-acid)' : 'var(--t-b3)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }, children: expanded ? '▲ LESS' : '▼ MORE' }), expanded && (_jsxs("div", { style: { borderBottom: '1px solid var(--t-b1)' }, children: [_jsx("div", { style: { display: 'flex', borderBottom: '1px solid var(--t-b1)' }, children: ['eq', 'fx', 'mod', 'dyn'].map(t => (_jsx("button", { onClick: () => setTab(t), style: {
                                flex: 1, height: 16, fontSize: 6, fontFamily: 'IBM Plex Mono,monospace',
                                letterSpacing: '.12em', textTransform: 'uppercase',
                                background: tab === t ? 'rgba(57,255,20,0.05)' : 'transparent',
                                border: 'none', borderBottom: `1px solid ${tab === t ? 'var(--looper-acid)' : 'transparent'}`,
                                color: tab === t ? 'var(--looper-acid)' : 'var(--dj-border)', cursor: 'pointer',
                            }, children: t }, t))) }), tab === 'eq' && (_jsx("div", { style: { padding: '8px 6px' }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "HF", value: (track.eq.high + 20) / 40, color: "var(--looper-cyan)", size: "xs", bipolar: true, onChange: v => onEQChange(track.id, 'high', v * 40 - 20) }), _jsx(FXKnob, { label: "MF", value: (track.eq.mid + 20) / 40, color: "var(--looper-cyan)", size: "xs", bipolar: true, onChange: v => onEQChange(track.id, 'mid', v * 40 - 20) }), _jsx(FXKnob, { label: "LF", value: (track.eq.low + 20) / 40, color: "var(--looper-cyan)", size: "xs", bipolar: true, onChange: v => onEQChange(track.id, 'low', v * 40 - 20) })] }) })), tab === 'fx' && (_jsxs("div", { style: { padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "PTCH", value: 0.5, color: "var(--looper-purple)", size: "xs", bipolar: true, onChange: v => onPitchChange(track.id, Math.round(v * 24 - 12)) }), _jsx(FXKnob, { label: "FINE", value: 0.5, color: "var(--accent-indigo)", size: "xs", bipolar: true, onChange: v => onFineChange(track.id, Math.round(v * 200 - 100)) }), _jsx(FXKnob, { label: "CHO", value: 0, color: "var(--looper-pink)", size: "xs", onChange: v => onChorusChange(track.id, v) })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 6, color: '#1c1c1c', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em', marginBottom: 3, textAlign: 'center' }, children: "HARMONY" }), _jsx("select", { value: track.harmonyMode, onChange: e => onHarmonyChange(track.id, e.target.value), style: {
                                            width: '100%', fontSize: 7, background: 'var(--void)',
                                            color: track.harmonyMode === 'off' ? 'var(--t-b3)' : 'var(--looper-acid)',
                                            border: `1px solid ${track.harmonyMode === 'off' ? 'var(--t-b2)' : '#39ff1422'}`,
                                            padding: '2px 4px', cursor: 'pointer', outline: 'none',
                                            fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em',
                                        }, children: HARMONY.map(m => (_jsx("option", { value: m, style: { background: 'var(--void)' }, children: m === 'off' ? '— HARMONY OFF' : `♪ ${m.toUpperCase()}` }, m))) })] })] })), tab === 'mod' && (_jsxs("div", { style: { padding: '6px' }, children: [_jsx("div", { style: { fontSize: 6, color: '#1c1c1c', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em', marginBottom: 4, textAlign: 'center' }, children: "PLAYBACK MODE" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }, children: PLAYBACK.map(pm => (_jsx(LB, { label: pm.label, active: playMode === pm.key, ac: pm.color, onClick: () => setPlayMode(pm.key), w: 999, h: 20, fontSize: 8, title: pm.key }, pm.key))) }), _jsxs("div", { style: { marginTop: 6 }, children: [_jsx("div", { style: { fontSize: 6, color: '#1c1c1c', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.2em', marginBottom: 3, textAlign: 'center' }, children: "OVERDUB BLEND" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("input", { type: "range", min: 0, max: 100, value: Math.round(overdubBlend * 100), onChange: e => setOD(Number(e.target.value) / 100), style: { flex: 1, accentColor: track.color, cursor: 'pointer', height: 2 } }), _jsx("span", { style: { fontSize: 6, color: 'var(--dj-dimmer)', fontFamily: 'IBM Plex Mono,monospace', width: 20, textAlign: 'right' }, children: Math.round(overdubBlend * 100) })] })] })] })), tab === 'dyn' && (_jsxs("div", { style: { padding: '8px 6px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "GATE", value: 0, color: "var(--amber-500)", size: "xs", onChange: v => onGateChange(track.id, v) }), _jsx(FXKnob, { label: "COMP", value: 0.35, color: "var(--amber-500)", size: "xs", onChange: v => onCompChange(track.id, v) }), _jsx(FXKnob, { label: "SAT", value: 0, color: "var(--track-orange)", size: "xs", onChange: v => onSatChange(track.id, v) })] }), _jsxs("div", { style: { marginTop: 6, display: 'flex', justifyContent: 'space-around' }, children: [_jsx(FXKnob, { label: "TRIM", value: 0.5, color: "var(--slate-400)", size: "xs", onChange: v => onTrimChange(track.id, v) }), _jsx(FXKnob, { label: "XFAD", value: 0.5, color: "var(--slate-400)", size: "xs", bipolar: true, onChange: v => { console.warn('XFAD stub', v); } })] })] }))] })), _jsxs("div", { style: {
                    padding: '3px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--void)',
                }, children: [_jsx("span", { style: { fontSize: 6, color: 'var(--panel)', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '.1em' }, children: track.loopLength ?? '—' }), _jsx("div", { style: { display: 'flex', gap: 2, alignItems: 'center' }, children: Array.from({ length: 4 }, (_, i) => (_jsx("div", { style: {
                                width: 4, height: 4,
                                background: isActive && i === beat.beat ? col : 'var(--t-b2)',
                                boxShadow: isActive && i === beat.beat ? `0 0 4px ${col}` : 'none',
                                transition: 'all 0.04s',
                            } }, i))) })] })] }));
};
export const TrackPad = React.memo(TrackPadInner);
