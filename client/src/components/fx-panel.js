import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo, useCallback, useMemo, useState, useEffect } from 'react';
// ═══════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════
const ReverbIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M2 12c0-3 2.5-6 6-6s6 3 6 6-2.5 6-6 6" }), _jsx("path", { d: "M8 12c0-2 1.5-4 4-4s4 2 4 4-1.5 4-4 4", opacity: "0.6" }), _jsx("path", { d: "M14 12c0-1 .8-2 2-2s2 1 2 2-.8 2-2 2", opacity: "0.3" })] }));
const DelayIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("rect", { x: "3", y: "8", width: "4", height: "8", rx: "1" }), _jsx("rect", { x: "10", y: "10", width: "4", height: "6", rx: "1", opacity: "0.6" }), _jsx("rect", { x: "17", y: "12", width: "4", height: "4", rx: "1", opacity: "0.3" })] }));
const FlangerIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M2 12 Q 6 6, 8 12 T 14 12 T 20 12" }), _jsx("path", { d: "M2 12 Q 6 16, 10 12 T 18 12", opacity: "0.4" })] }));
const ReverseIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("polyline", { points: "11 17 6 12 11 7" }), _jsx("path", { d: "M6 12h12" }), _jsx("path", { d: "M18 7v10" })] }));
const VinylIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("circle", { cx: "12", cy: "12", r: "3.5" }), _jsx("circle", { cx: "12", cy: "12", r: "1", fill: "currentColor" })] }));
const ChorusIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M4 12 Q 8 8, 12 12 T 20 12" }), _jsx("path", { d: "M4 12 Q 8 16, 12 12 T 20 12", opacity: "0.5" })] }));
const PhaserIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "8", opacity: "0.3" }), _jsx("circle", { cx: "12", cy: "12", r: "5", opacity: "0.5" }), _jsx("circle", { cx: "12", cy: "12", r: "2" })] }));
const BitcrusherIcon = ({ size = 16 }) => (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("path", { d: "M3 12h3v3h3v-6h3v8h3v-10h3v12h3" }) }));
const DistortionIcon = ({ size = 16 }) => (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M2 12 L 6 8 L 10 16 L 14 4 L 18 18 L 22 12" }) }));
const CompressorIcon = ({ size = 16 }) => (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M3 20 L 8 15 L 12 15 L 21 6" }), _jsx("path", { d: "M3 4 L 21 4", opacity: "0.3" })] }));
const TremoloIcon = ({ size = 16 }) => (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("path", { d: "M2 12 L 5 8 L 8 12 L 11 8 L 14 12 L 17 8 L 20 12 L 23 8" }) }));
// ═══════════════════════════════════════════════════════════════════════════
// FX CONFIG
// ═══════════════════════════════════════════════════════════════════════════
const FX_CONFIG = [
    { key: 'reverb', label: 'Reverb', shortLabel: 'REV', color: 'var(--status-ok)', icon: _jsx(ReverbIcon, {}), category: 'time' },
    { key: 'delay', label: 'Delay', shortLabel: 'DLY', color: 'var(--looper-blue)', icon: _jsx(DelayIcon, {}), category: 'time' },
    { key: 'reverse', label: 'Reverse', shortLabel: 'RVS', color: 'var(--status-warn)', icon: _jsx(ReverseIcon, {}), category: 'time' },
    { key: 'flange', label: 'Flanger', shortLabel: 'FLN', color: 'var(--accent-violet-soft)', icon: _jsx(FlangerIcon, {}), category: 'modulation' },
    { key: 'chorus', label: 'Chorus', shortLabel: 'CHO', color: 'var(--track-cyan)', icon: _jsx(ChorusIcon, {}), category: 'modulation' },
    { key: 'phaser', label: 'Phaser', shortLabel: 'PHS', color: 'var(--accent-purple)', icon: _jsx(PhaserIcon, {}), category: 'modulation' },
    { key: 'tremolo', label: 'Tremolo', shortLabel: 'TRM', color: 'var(--track-pink)', icon: _jsx(TremoloIcon, {}), category: 'modulation' },
    { key: 'compressor', label: 'Compressor', shortLabel: 'CMP', color: 'var(--track-orange)', icon: _jsx(CompressorIcon, {}), category: 'dynamics' },
    { key: 'sidechain', label: 'Sidechain', shortLabel: 'SID', color: 'var(--accent-blue)', icon: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }) }), category: 'dynamics' },
    { key: 'distortion', label: 'Distortion', shortLabel: 'DST', color: '#ef4444', icon: _jsx(DistortionIcon, {}), category: 'tone' },
    { key: 'bitcrusher', label: 'Bitcrusher', shortLabel: 'BIT', color: 'var(--looper-lime)', icon: _jsx(BitcrusherIcon, {}), category: 'tone' },
    { key: 'saturation', label: 'Saturation', shortLabel: 'SAT', color: 'var(--orange-400)', icon: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.916a2 2 0 00-1.272 1.272L12 21l-1.912-5.812a2 2 0 00-1.272-1.272L3 12l5.816-1.916a2 2 0 001.272-1.272z" }) }), category: 'tone' },
    { key: 'vinyl', label: 'Vinyl', shortLabel: 'VNL', color: 'var(--status-error)', icon: _jsx(VinylIcon, {}), category: 'creative' },
    { key: 'autoFilter', label: 'Auto Filter', shortLabel: 'AFL', color: 'var(--accent-purple)', icon: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M22 3H2l8 9.46V19l4 2v-8.54z" }) }), category: 'creative' },
    { key: 'stereoWiden', label: 'Stereo Width', shortLabel: 'STW', color: 'var(--looper-teal)', icon: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" }), _jsx("path", { d: "M12 3c-2.76 3.6-4.5 6.77-4.5 9s1.74 5.4 4.5 9" }), _jsx("path", { d: "M12 3c2.76 3.6 4.5 6.77 4.5 9s-1.74 5.4-4.5 9" })] }), category: 'creative' },
];
const CATEGORY_COLORS = {
    time: 'var(--status-ok)',
    modulation: 'var(--accent-violet-soft)',
    dynamics: 'var(--status-warn)',
    tone: '#ef4444',
    creative: 'var(--track-cyan)',
};
// ═══════════════════════════════════════════════════════════════════════════
// SPECTRUM ANALYZER
// ═══════════════════════════════════════════════════════════════════════════
function SpectrumAnalyzer({ activeCount, height = 48 }) {
    const bars = 32;
    const [heights, setHeights] = useState(Array(bars).fill(0));
    useEffect(() => {
        const interval = setInterval(() => {
            setHeights(Array.from({ length: bars }, () => Math.random() * (activeCount > 0 ? 0.85 : 0.25)));
        }, 60);
        return () => clearInterval(interval);
    }, [activeCount]);
    return (_jsx("div", { className: "flex items-end justify-center gap-0.5 px-1", style: { height }, children: heights.map((h, i) => (_jsx("div", { className: "flex-1 rounded-t", style: {
                height: `${Math.max(h * 100, 3)}%`,
                transition: 'height 0.06s ease-out',
                background: `linear-gradient(180deg, ${i < bars * 0.3 ? 'var(--status-ok)' : i < bars * 0.65 ? 'var(--status-warn)' : '#ef4444'} 0%, ${i < bars * 0.3 ? 'var(--status-ok)' : i < bars * 0.65 ? 'var(--status-warn)' : 'var(--status-error)'} 100%)`,
                boxShadow: h > 0.5 ? `0 0 6px ${i < bars * 0.3 ? 'var(--status-ok)' : i < bars * 0.65 ? 'var(--status-warn)' : '#ef4444'}55` : 'none',
                minHeight: 2,
            } }, i))) }));
}
// ═══════════════════════════════════════════════════════════════════════════
// MODE SWITCHER BUTTON
// ═══════════════════════════════════════════════════════════════════════════
function ModeSwitcher({ mode, onChange }) {
    const modes = [
        { id: 'compact', label: 'Compact', icon: '⬜' },
        { id: 'normal', label: 'Normal', icon: '▣' },
        { id: 'professional', label: 'Pro', icon: '⊞' },
    ];
    return (_jsx("div", { className: "flex rounded-lg overflow-hidden", style: { border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)' }, children: modes.map((m) => (_jsx("button", { onClick: () => onChange(m.id), title: m.label, style: {
                padding: '4px 10px',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                background: mode === m.id ? 'rgba(167,139,250,0.2)' : 'transparent',
                color: mode === m.id ? 'var(--accent-violet-soft)' : 'rgba(255,255,255,0.4)',
                borderRight: m.id !== 'professional' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
            }, children: m.label }, m.id))) }));
}
// ═══════════════════════════════════════════════════════════════════════════
// FX BUTTON VARIANTS
// ═══════════════════════════════════════════════════════════════════════════
const FXButtonCompact = memo(({ config, isActive, onToggle }) => {
    const [pressed, setPressed] = useState(false);
    return (_jsxs("button", { onClick: () => onToggle(config.key), onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false), onPointerLeave: () => setPressed(false), title: config.label, style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '6px 4px',
            borderRadius: 8,
            border: `1px solid ${isActive ? config.color + '88' : 'rgba(255,255,255,0.1)'}`,
            background: isActive
                ? `linear-gradient(135deg, ${config.color}28 0%, ${config.color}12 100%)`
                : 'rgba(0,0,0,0.4)',
            color: isActive ? config.color : 'rgba(255,255,255,0.5)',
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            transform: pressed ? 'scale(0.93)' : 'scale(1)',
            boxShadow: isActive ? `0 0 10px ${config.color}30, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
            transition: 'all 0.15s ease',
            flexDirection: 'column',
            gap: 3,
        }, children: [_jsx("div", { style: { color: isActive ? config.color : 'rgba(255,255,255,0.45)', filter: isActive ? `drop-shadow(0 0 4px ${config.color}88)` : 'none' }, children: config.icon }), _jsx("span", { children: config.shortLabel }), isActive && (_jsx("div", { style: {
                    width: 4, height: 4, borderRadius: '50%',
                    background: config.color,
                    boxShadow: `0 0 6px ${config.color}`,
                } }))] }));
});
const FXButtonNormal = memo(({ config, isActive, onToggle }) => {
    const [pressed, setPressed] = useState(false);
    const [wetDry, setWetDry] = useState(70);
    const [showSlider, setShowSlider] = useState(false);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("button", { onClick: () => onToggle(config.key), onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false), onPointerLeave: () => setPressed(false), onContextMenu: (e) => { e.preventDefault(); if (isActive)
                    setShowSlider(!showSlider); }, style: {
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px 8px 10px',
                    borderRadius: 12,
                    border: `1.5px solid ${isActive ? config.color + '66' : 'rgba(255,255,255,0.1)'}`,
                    background: isActive
                        ? `linear-gradient(135deg, ${config.color}22 0%, ${config.color}10 100%)`
                        : 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.6) 100%)',
                    color: isActive ? config.color : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    transform: pressed ? 'scale(0.95)' : 'scale(1)',
                    boxShadow: isActive ? `0 4px 18px ${config.color}28, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.02)',
                    transition: 'all 0.18s ease',
                    gap: 6,
                    overflow: 'hidden',
                }, children: [_jsx("div", { style: {
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                            background: isActive ? `linear-gradient(90deg, transparent, ${config.color}, transparent)` : 'transparent',
                            boxShadow: isActive ? `0 0 10px ${config.color}88` : 'none',
                            transition: 'all 0.3s ease',
                        } }), _jsx("div", { style: {
                            width: 6, height: 6, borderRadius: '50%',
                            background: isActive ? config.color : 'rgba(255,255,255,0.2)',
                            boxShadow: isActive ? `0 0 8px ${config.color}, 0 0 14px ${config.color}55` : 'none',
                            border: `1px solid ${isActive ? config.color : 'rgba(255,255,255,0.15)'}`,
                            transition: 'all 0.2s ease',
                        } }), _jsx("div", { style: {
                            color: isActive ? config.color : 'rgba(255,255,255,0.4)',
                            filter: isActive ? `drop-shadow(0 0 5px ${config.color}66)` : 'none',
                            transition: 'all 0.2s ease',
                        }, children: config.icon }), _jsx("span", { style: {
                            fontSize: 10,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            color: isActive ? config.color : 'rgba(255,255,255,0.5)',
                        }, children: config.shortLabel }), _jsx("div", { style: {
                            position: 'absolute', top: 4, right: 4,
                            width: 5, height: 5, borderRadius: '50%',
                            background: CATEGORY_COLORS[config.category] + '88',
                        } })] }), showSlider && isActive && (_jsxs("div", { style: {
                    background: 'rgba(0,0,0,0.6)', borderRadius: 8,
                    border: `1px solid ${config.color}33`, padding: '6px 8px',
                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }, children: "Mix" }), _jsxs("span", { style: { fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: config.color }, children: [wetDry, "%"] })] }), _jsx("input", { type: "range", min: 0, max: 100, value: wetDry, onChange: e => setWetDry(+e.target.value), style: { width: '100%', accentColor: config.color, height: 2 } })] }))] }));
});
const FXButtonPro = memo(({ config, isActive, onToggle }) => {
    const [pressed, setPressed] = useState(false);
    const [wetDry, setWetDry] = useState(70);
    const [depth, setDepth] = useState(50);
    return (_jsxs("div", { style: {
            borderRadius: 10,
            border: `1px solid ${isActive ? config.color + '55' : 'rgba(255,255,255,0.1)'}`,
            background: isActive ? `${config.color}12` : 'rgba(0,0,0,0.5)',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            boxShadow: isActive ? `0 0 16px ${config.color}20` : 'none',
        }, children: [_jsxs("button", { onClick: () => onToggle(config.key), onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false), onPointerLeave: () => setPressed(false), style: {
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 9px', background: 'transparent', border: 'none',
                    cursor: 'pointer', transform: pressed ? 'scale(0.97)' : 'scale(1)',
                    transition: 'transform 0.12s ease',
                }, children: [_jsx("div", { style: {
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: isActive ? config.color : 'rgba(255,255,255,0.2)',
                            boxShadow: isActive ? `0 0 8px ${config.color}` : 'none',
                            transition: 'all 0.2s ease',
                        } }), _jsx("div", { style: {
                            color: isActive ? config.color : 'rgba(255,255,255,0.4)',
                            filter: isActive ? `drop-shadow(0 0 4px ${config.color}77)` : 'none',
                            flexShrink: 0,
                        }, children: config.icon }), _jsx("span", { style: {
                            fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left',
                            color: isActive ? config.color : 'rgba(255,255,255,0.5)',
                        }, children: config.label }), _jsx("span", { style: {
                            fontSize: 7, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase',
                            padding: '1px 4px', borderRadius: 4,
                            background: CATEGORY_COLORS[config.category] + '22',
                            color: CATEGORY_COLORS[config.category],
                            border: `1px solid ${CATEGORY_COLORS[config.category]}33`,
                        }, children: config.category.slice(0, 3) })] }), isActive && (_jsxs("div", { style: { padding: '0 9px 8px', display: 'flex', flexDirection: 'column', gap: 5 }, children: [_jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 2 }, children: [_jsx("span", { style: { fontSize: 7, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }, children: "Wet/Dry" }), _jsxs("span", { style: { fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: config.color }, children: [wetDry, "%"] })] }), _jsx("input", { type: "range", min: 0, max: 100, value: wetDry, onChange: e => setWetDry(+e.target.value), style: { width: '100%', accentColor: config.color, height: 2 } })] }), _jsxs("div", { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 2 }, children: [_jsx("span", { style: { fontSize: 7, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }, children: "Depth" }), _jsxs("span", { style: { fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: config.color }, children: [depth, "%"] })] }), _jsx("input", { type: "range", min: 0, max: 100, value: depth, onChange: e => setDepth(+e.target.value), style: { width: '100%', accentColor: config.color, height: 2 } })] })] }))] }));
});
// ═══════════════════════════════════════════════════════════════════════════
// MAIN FX PANEL
// ═══════════════════════════════════════════════════════════════════════════
export const FXPanel = memo(({ fx: fxProp, onToggle: onToggleProp }) => {
    const [fxState, setFxState] = useState({});
    const [mode, setMode] = useState('normal');
    const [collapsed, setCollapsed] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [masterMix, setMasterMix] = useState(100);
    const [showAnalyzer, setShowAnalyzer] = useState(true);
    const fx = fxProp ?? fxState;
    const onToggle = useCallback((key) => {
        if (onToggleProp) {
            onToggleProp(key);
        }
        else {
            setFxState(prev => ({ ...prev, [key]: !prev[key] }));
        }
    }, [onToggleProp]);
    const activeCount = useMemo(() => FX_CONFIG.filter(c => fx[c.key]).length, [fx]);
    const activeFX = useMemo(() => FX_CONFIG.filter(c => fx[c.key]), [fx]);
    const _panelGlow = useMemo(() => {
        const colors = activeFX.map(c => c.color);
        if (!colors.length)
            return 'none';
        return colors.slice(0, 3).map(c => `0 0 40px ${c}14`).join(', ');
    }, [activeFX]);
    const filteredFX = selectedCategory
        ? FX_CONFIG.filter(c => c.category === selectedCategory)
        : FX_CONFIG;
    const gridCols = mode === 'compact' ? 'repeat(auto-fill, minmax(58px, 1fr))' :
        mode === 'normal' ? 'repeat(auto-fill, minmax(88px, 1fr))' :
            '1fr';
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        @keyframes fx-ripple { 0% { opacity:1; transform:scale(0.5); } 100% { opacity:0; transform:scale(1.3); } }
        @keyframes fx-led-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .fx-panel-body { transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.3s ease; }
      ` }), _jsxs("div", { style: {
                    fontFamily: "'JetBrains Mono', monospace",
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    transition: 'box-shadow 0.3s ease',
                    overflow: 'hidden',
                }, children: [_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderBottom: collapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'rgba(0,0,0,0.4)',
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("div", { style: {
                                            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'linear-gradient(135deg, var(--accent-violet-soft) 0%, var(--accent-purple) 100%)',
                                            boxShadow: '0 0 14px #a78bfa44',
                                            flexShrink: 0,
                                        }, children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "white", strokeWidth: "2.5", children: _jsx("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }) }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }, children: "FX Rack" }), _jsx("div", { style: { fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }, children: "Studio-Grade DSP Chain" })] })] }), activeCount > 0 && !collapsed && (_jsxs("div", { style: {
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '4px 10px', borderRadius: 20,
                                    background: 'rgba(16,185,129,0.12)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                }, children: [_jsx("div", { style: {
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: 'var(--status-ok)', boxShadow: '0 0 8px var(--status-ok)',
                                            animation: 'fx-led-pulse 1.5s ease-in-out infinite',
                                        } }), _jsxs("span", { style: { fontSize: 9, fontWeight: 700, color: 'var(--status-ok)', letterSpacing: '0.08em', textTransform: 'uppercase' }, children: [activeCount, "/", FX_CONFIG.length, " Active"] })] })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [!collapsed && _jsx(ModeSwitcher, { mode: mode, onChange: setMode }), _jsx("button", { onClick: () => setCollapsed(!collapsed), title: collapsed ? 'Expand' : 'Collapse', style: {
                                            width: 28, height: 28, borderRadius: 8,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'rgba(51,65,85,0.4)',
                                            border: '1px solid rgba(71,85,105,0.3)',
                                            color: 'rgba(148,163,184,0.7)',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s ease',
                                        }, children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", style: { transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }, children: _jsx("path", { d: "M18 15l-6-6-6 6" }) }) })] })] }), _jsxs("div", { className: "fx-panel-body", style: {
                            maxHeight: collapsed ? 0 : 2000,
                            opacity: collapsed ? 0 : 1,
                            overflow: 'hidden',
                            padding: collapsed ? '0 16px' : '14px 16px',
                        }, children: [showAnalyzer && mode !== 'compact' && (_jsxs("div", { style: {
                                    borderRadius: 8, marginBottom: 14,
                                    background: 'rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '8px 6px 4px',
                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingInline: 4 }, children: [_jsx("span", { style: { fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }, children: "Spectrum" }), _jsx("button", { onClick: () => setShowAnalyzer(false), style: { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 10 }, children: "\u2715" })] }), _jsx(SpectrumAnalyzer, { activeCount: activeCount, height: mode === 'professional' ? 56 : 40 })] })), mode === 'compact' && (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsx("span", { style: { fontSize: 8, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }, children: activeCount > 0 ? `${activeCount} fx active` : 'No FX active' }), _jsx("div", { style: { display: 'flex', gap: 4 }, children: Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
                                            const active = FX_CONFIG.filter(c => c.category === cat && fx[c.key]).length;
                                            return active > 0 ? (_jsx("div", { style: {
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: color, boxShadow: `0 0 6px ${color}`,
                                                } }, cat)) : null;
                                        }) })] })), mode !== 'compact' && (_jsxs("div", { style: { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }, children: [_jsx("button", { onClick: () => setSelectedCategory(null), style: {
                                            padding: '3px 9px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                                            background: !selectedCategory ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${!selectedCategory ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                                            color: !selectedCategory ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                                            transition: 'all 0.15s ease',
                                        }, children: "All" }), Object.entries(CATEGORY_COLORS).map(([cat, color]) => (_jsx("button", { onClick: () => setSelectedCategory(selectedCategory === cat ? null : cat), style: {
                                            padding: '3px 9px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                                            background: selectedCategory === cat ? `${color}22` : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${selectedCategory === cat ? `${color}55` : 'rgba(255,255,255,0.1)'}`,
                                            color: selectedCategory === cat ? color : 'rgba(255,255,255,0.4)',
                                            transition: 'all 0.15s ease',
                                        }, children: cat }, cat)))] })), mode !== 'compact' && (_jsxs("div", { style: {
                                    marginBottom: 14, padding: '10px 12px', borderRadius: 8,
                                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }, children: "Master FX Mix" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsxs("span", { style: { fontSize: 11, fontWeight: 700, color: 'var(--status-ok)' }, children: [masterMix, "%"] }), _jsx("button", { onClick: () => setMasterMix(100), style: { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.5)', fontSize: 8 }, children: "\u21BA" })] })] }), _jsx("input", { type: "range", min: 0, max: 100, value: masterMix, onChange: e => setMasterMix(+e.target.value), style: { width: '100%', accentColor: 'var(--status-ok)', height: 2 } })] })), _jsx("div", { style: { display: 'grid', gridTemplateColumns: gridCols, gap: mode === 'compact' ? 5 : mode === 'professional' ? 6 : 7 }, children: filteredFX.map(config => {
                                    if (mode === 'compact')
                                        return _jsx(FXButtonCompact, { config: config, isActive: !!fx[config.key], onToggle: onToggle }, config.key);
                                    if (mode === 'normal')
                                        return _jsx(FXButtonNormal, { config: config, isActive: !!fx[config.key], onToggle: onToggle }, config.key);
                                    return _jsx(FXButtonPro, { config: config, isActive: !!fx[config.key], onToggle: onToggle }, config.key);
                                }) }), mode !== 'compact' && activeCount > 0 && (_jsxs("div", { style: {
                                    marginTop: 14, padding: '10px 12px', borderRadius: 8,
                                    background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(59,130,246,0.07) 100%)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: _jsx("span", { style: { fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }, children: "Signal Chain" }) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }, children: [_jsx("span", { style: { fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }, children: "IN" }), activeFX.map((c, i) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("span", { style: {
                                                            fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                                                            padding: '2px 7px', borderRadius: 4,
                                                            background: `${c.color}22`, color: c.color,
                                                            border: `1px solid ${c.color}44`,
                                                            boxShadow: `0 0 8px ${c.color}20`,
                                                        }, children: c.shortLabel }), i < activeFX.length - 1 && _jsx("span", { style: { color: 'rgba(255,255,255,0.3)', fontSize: 10 }, children: "\u203A" })] }, c.key))), _jsx("span", { style: { fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'linear-gradient(90deg, var(--status-ok), var(--status-ok))', color: 'white', boxShadow: '0 0 10px #10b98133' }, children: "OUT" })] })] })), _jsxs("div", { style: {
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    marginTop: 12, paddingTop: 10,
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                }, children: [_jsxs("button", { onClick: () => {
                                            const keys = Object.fromEntries(FX_CONFIG.map(c => [c.key, false]));
                                            setFxState(keys);
                                        }, style: {
                                            display: 'flex', alignItems: 'center', gap: 5,
                                            padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        }, children: [_jsxs("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" })] }), "Clear"] }), _jsx("span", { style: { fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "32-bit float \u00B7 zero-latency" })] })] })] })] }));
});
FXPanel.displayName = 'FXPanel';
export default FXPanel;
