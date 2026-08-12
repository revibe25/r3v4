import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// @ts-nocheck
import { useState } from 'react';
import { ACID, DJ_BLACK, DJ_SURFACE, DJ_BORDER, DJ_DIM, DJ_DIMMER, } from './types';
import { Knob } from './knob';
import { TransBtn } from './transbtn';
import { VUMeter } from './vumeter';
import { ModeSwitcher } from './modeswitcher';
import { WaveformDisplay } from './waveformdisplay';
export function DJControls({ filterVal: filterProp, pitchSemitones: pitchProp, crossfade: crossfadeProp, onFilterChange, onPitchChange, onCrossfadeChange, onPlay, onPause, onStop, onCue, onPrev, onNext, onLoop, onShuffle, isPlaying = false, }) {
    const [mode, setMode] = useState('normal');
    const [collapsed, setCollapsed] = useState(false);
    // Internal state (used when props are not provided)
    const [filterInt, setFilterInt] = useState(0.5);
    const [pitchInt, setPitchInt] = useState(0);
    const [crossfadeInt, setCrossfadeInt] = useState(0);
    const [gain, setGain] = useState(0.8);
    const [tempo, setTempo] = useState(120);
    const [swing, setSwing] = useState(0);
    const [eq, setEq] = useState({ low: 0, mid: 0, high: 0 });
    const [quantize, setQuantize] = useState(true);
    const [sync, setSync] = useState(true);
    const [hotCue, setHotCue] = useState(null);
    const [playing, setPlaying] = useState(true);
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [shuffleEnabled, setShuffleEnabled] = useState(false);
    const filter = filterProp ?? filterInt;
    const pitch = pitchProp ?? pitchInt;
    const crossfade = crossfadeProp ?? crossfadeInt;
    const isActivePlay = isPlaying ?? playing;
    const handleFilter = onFilterChange ?? setFilterInt;
    const handlePitch = onPitchChange ?? ((v) => setPitchInt(Math.round(v)));
    const handleCrossfade = onCrossfadeChange ?? setCrossfadeInt;
    const handlePlay = onPlay ?? (() => setPlaying(true));
    const handlePause = onPause ?? (() => setPlaying(false));
    const handleStop = onStop ?? (() => setPlaying(false));
    const cfPct = (crossfade + 1) / 2;
    const knobSize = mode === 'compact' ? 52 : mode === 'professional' ? 88 : 68;
    const cols = mode === 'compact' ? 4 : 6;
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&display=swap');
        @keyframes dj-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .dj-body { transition: max-height 0.3s ease, opacity 0.2s ease, padding 0.25s ease; }
      ` }), _jsxs("div", { style: {
                    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
                    background: DJ_BLACK,
                    border: `1px solid ${DJ_BORDER}`,
                    borderRadius: 0,
                    backdropFilter: 'none',
                    boxShadow: 'none',
                    overflow: 'hidden',
                }, children: [_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: collapsed ? 'none' : `1px solid ${DJ_BORDER}`,
                            background: DJ_SURFACE,
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("div", { style: {
                                            width: 28, height: 28, borderRadius: 0, flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: ACID,
                                        }, children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: DJ_BLACK, strokeWidth: "2.5", children: _jsx("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }) }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--white)' }, children: "DJ CONTROLLER" }), _jsx("div", { style: { fontSize: 8, color: DJ_DIM, letterSpacing: 2 }, children: "PRO MIX ENGINE v3.5" })] })] }), !collapsed && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'transparent', border: `1px solid ${ACID}` }, children: [_jsx("div", { style: { width: 4, height: 4, background: ACID, animation: 'dj-pulse 1.2s infinite' } }), _jsx("span", { style: { fontSize: 8, fontWeight: 700, color: ACID, textTransform: 'uppercase', letterSpacing: 2 }, children: "LIVE" })] }), _jsxs("div", { style: { fontSize: 11, fontWeight: 700, color: ACID, letterSpacing: 2 }, children: [Math.round(tempo), " BPM"] })] })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [!collapsed && _jsx(ModeSwitcher, { mode: mode, onChange: setMode }), _jsx("button", { onClick: () => setCollapsed(!collapsed), style: {
                                            width: 26, height: 26, borderRadius: 0, border: `1px solid ${DJ_BORDER}`,
                                            background: 'transparent', color: DJ_DIM,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                        }, children: _jsx("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "square", style: { transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }, children: _jsx("path", { d: "M18 15l-6-6-6 6" }) }) })] })] }), _jsxs("div", { className: "dj-body", style: {
                            maxHeight: collapsed ? 0 : 2000,
                            opacity: collapsed ? 0 : 1,
                            overflow: 'hidden',
                            padding: collapsed ? '0 12px' : '12px 12px',
                            display: 'flex', flexDirection: 'column', gap: mode === 'compact' ? 8 : 12,
                            background: DJ_BLACK,
                        }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: `repeat(${mode === 'compact' ? 5 : 8}, 1fr)`, gap: mode === 'compact' ? 4 : 6 }, children: [mode !== 'compact' && (_jsx(TransBtn, { icon: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("polygon", { points: "19 20 9 12 19 4 19 20" }), _jsx("line", { x1: "5", y1: "19", x2: "5", y2: "5" })] }), label: "Prev", onClick: () => onPrev?.(), compact: false })), _jsx(TransBtn, { icon: isActivePlay
                                            ? _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: [_jsx("rect", { x: "6", y: "4", width: "4", height: "16" }), _jsx("rect", { x: "14", y: "4", width: "4", height: "16" })] })
                                            : _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("polygon", { points: "5 3 19 12 5 21 5 3" }) }), label: isActivePlay ? 'Pause' : 'Play', onClick: isActivePlay ? handlePause : handlePlay, active: isActivePlay, color: ACID, compact: mode === 'compact' }), _jsx(TransBtn, { icon: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }) }), label: "Stop", onClick: handleStop, danger: true, compact: mode === 'compact' }), _jsx(TransBtn, { icon: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("circle", { cx: "12", cy: "12", r: "4", fill: "currentColor" })] }), label: "Cue", onClick: () => onCue?.(), color: ACID, compact: mode === 'compact' }), mode !== 'compact' && (_jsx(TransBtn, { icon: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("polygon", { points: "5 4 15 12 5 20 5 4" }), _jsx("line", { x1: "19", y1: "5", x2: "19", y2: "19" })] }), label: "Next", onClick: () => onNext?.(), compact: false })), _jsx(TransBtn, { icon: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("polyline", { points: "17 1 21 5 17 9" }), _jsx("path", { d: "M3 11V9a4 4 0 014-4h14" }), _jsx("polyline", { points: "7 23 3 19 7 15" }), _jsx("path", { d: "M21 13v2a4 4 0 01-4 4H3" })] }), label: "Loop", onClick: () => { setLoopEnabled(v => !v); onLoop?.(); }, active: loopEnabled, color: ACID, compact: mode === 'compact' }), _jsx(TransBtn, { icon: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("polyline", { points: "16 3 21 3 21 8" }), _jsx("line", { x1: "4", y1: "20", x2: "21", y2: "3" }), _jsx("polyline", { points: "21 16 21 21 16 21" }), _jsx("line", { x1: "15", y1: "15", x2: "21", y2: "21" })] }), label: "Shuffle", onClick: () => { setShuffleEnabled(v => !v); onShuffle?.(); }, active: shuffleEnabled, color: ACID, compact: mode === 'compact' }), _jsx(TransBtn, { icon: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "2" }), _jsx("path", { d: "M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" })] }), label: sync ? 'SYNC ON' : 'Sync', onClick: () => setSync(!sync), active: sync, color: ACID, compact: mode === 'compact' })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }, children: [_jsx(Knob, { value: filter, min: 0, max: 1, label: "Filter", onChange: handleFilter, formatValue: v => `${Math.round(v * 100)}%`, defaultValue: 0.5, color: ACID, size: knobSize }), _jsx(Knob, { value: pitch, min: -12, max: 12, label: "Pitch", onChange: v => handlePitch(Math.round(v)), formatValue: v => `${v > 0 ? '+' : ''}${Math.round(v)}st`, defaultValue: 0, step: 1, color: ACID, size: knobSize }), _jsx(Knob, { value: gain, min: 0, max: 1.5, label: "Gain", onChange: setGain, formatValue: v => `${Math.round(v * 100)}%`, defaultValue: 0.8, color: ACID, size: knobSize }), _jsx(Knob, { value: tempo, min: 60, max: 200, label: "Tempo", onChange: setTempo, formatValue: v => `${Math.round(v)}`, defaultValue: 120, step: 1, color: ACID, size: knobSize }), (mode === 'normal' || mode === 'professional') && (_jsx(Knob, { value: swing, min: 0, max: 1, label: "Swing", onChange: setSwing, formatValue: v => `${Math.round(v * 100)}%`, defaultValue: 0, color: ACID, size: knobSize })), (mode === 'normal' || mode === 'professional') && (_jsx(Knob, { value: 0, min: -1, max: 1, label: "Jog", onChange: () => { }, formatValue: () => 'JOG', defaultValue: 0, color: ACID, size: knobSize }))] }), mode !== 'compact' && (_jsxs("div", { style: {
                                    padding: mode === 'professional' ? '12px 12px' : '10px 10px',
                                    borderRadius: 0,
                                    background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}`,
                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsx("span", { style: { fontSize: 8, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }, children: "3-BAND EQ" }), _jsx("button", { onClick: () => setEq({ low: 0, mid: 0, high: 0 }), style: {
                                                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                                                    background: 'transparent', border: `1px solid ${DJ_BORDER}`,
                                                    color: DJ_DIM, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                                                    textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'inherit',
                                                }, children: "\u21BA RESET" })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }, children: [
                                            { key: 'low', label: 'LOW' },
                                            { key: 'mid', label: 'MID' },
                                            { key: 'high', label: 'HIGH' },
                                        ].map(({ key, label }) => (_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 }, children: [_jsx("span", { style: { fontSize: 8, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 1 }, children: label }), _jsxs("span", { style: { fontSize: 8, fontWeight: 700, color: ACID }, children: [(eq[key] > 0 ? '+' : ''), (eq[key] * 12).toFixed(1), " dB"] })] }), _jsx("input", { type: "range", min: -1, max: 1, step: 0.01, value: eq[key], onChange: e => setEq({ ...eq, [key]: +e.target.value }), style: { width: '100%', accentColor: ACID, height: 2 } })] }, key))) })] })), mode !== 'compact' && (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }, children: [_jsx(VUMeter, { value: filter, color: ACID, label: "Filter" }), _jsx(VUMeter, { value: Math.abs(pitch) / 12, color: ACID, label: "Pitch" }), _jsx(VUMeter, { value: Math.abs(tempo - 120) / 80, color: ACID, label: "Tempo" }), _jsx(VUMeter, { value: gain / 1.5, color: ACID, label: "Gain" })] })), _jsxs("div", { style: {
                                    padding: mode === 'compact' ? '8px 10px' : '10px 12px',
                                    borderRadius: 0,
                                    background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}`,
                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 8, fontWeight: 700, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2 }, children: "CROSSFADER" }), _jsx("span", { style: { fontSize: 8, fontWeight: 700, color: crossfade < -0.05 ? ACID : crossfade > 0.05 ? ACID : DJ_DIM, letterSpacing: 1 }, children: crossfade < -0.05 ? '◀ DECK A' : crossfade > 0.05 ? 'DECK B ▶' : '◆ CENTER' })] }), _jsxs("div", { style: { position: 'relative', height: 4, background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}`, marginBottom: 8 }, children: [_jsx("div", { style: {
                                                    position: 'absolute', top: 0, bottom: 0,
                                                    left: cfPct < 0.5 ? `${cfPct * 100}%` : '50%',
                                                    right: cfPct > 0.5 ? `${(1 - cfPct) * 100}%` : '50%',
                                                    background: ACID,
                                                } }), _jsx("div", { style: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: DJ_BORDER, transform: 'translateX(-50%)' } }), _jsx("div", { style: {
                                                    position: 'absolute',
                                                    left: `calc(${cfPct * 100}% - 4px)`,
                                                    top: -4, width: 8, height: 12,
                                                    background: ACID,
                                                    pointerEvents: 'none',
                                                } })] }), _jsx("input", { type: "range", min: -1, max: 1, step: 0.01, value: crossfade, onChange: e => handleCrossfade(+e.target.value), style: { width: '100%', accentColor: ACID, height: 2, opacity: 0, position: 'absolute', left: 0, cursor: 'pointer' } }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginTop: 2 }, children: [_jsx("span", { style: { fontSize: 7, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2 }, children: "A" }), _jsx("span", { style: { fontSize: 7, color: DJ_DIMMER, textTransform: 'uppercase', letterSpacing: 2 }, children: "CENTER" }), _jsx("span", { style: { fontSize: 7, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2 }, children: "B" })] })] }), mode !== 'compact' && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 8, fontWeight: 700, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }, children: "HOT CUES" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }, children: Array.from({ length: 8 }).map((_, i) => {
                                            const isActive = hotCue === i;
                                            return (_jsx("button", { onClick: () => setHotCue(i), style: {
                                                    aspectRatio: '1', borderRadius: 0,
                                                    border: `1px solid ${isActive ? ACID : DJ_BORDER}`,
                                                    background: isActive ? ACID : DJ_SURFACE,
                                                    color: isActive ? DJ_BLACK : DJ_DIM,
                                                    fontSize: 9, fontWeight: 700,
                                                    cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                                                }, children: i + 1 }, i));
                                        }) })] })), mode === 'professional' && (_jsxs("div", { style: { padding: '10px 12px', background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}` }, children: [_jsx("div", { style: { fontSize: 8, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }, children: "WAVEFORM PREVIEW" }), _jsx(WaveformDisplay, { active: isActivePlay })] })), _jsxs("div", { style: {
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    paddingTop: 10, borderTop: `1px solid ${DJ_BORDER}`,
                                }, children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: _jsxs("button", { onClick: () => setQuantize(!quantize), style: {
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '4px 10px', cursor: 'pointer',
                                                background: quantize ? ACID : 'transparent',
                                                border: `1px solid ${quantize ? ACID : DJ_BORDER}`,
                                                color: quantize ? DJ_BLACK : DJ_DIM,
                                                fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'inherit',
                                            }, children: [_jsx("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }) }), "QNT"] }) }), _jsx("span", { style: { fontSize: 7, color: DJ_DIMMER, textTransform: 'uppercase', letterSpacing: 2 }, children: "PIONEER DJ \u00B7 24-BIT / 96KHZ" })] })] })] })] }));
}
