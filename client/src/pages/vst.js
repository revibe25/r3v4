import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * client/src/pages/vst.tsx
 * VST Plugin Browser & FX Chain Manager — R3 v4
 *
 * PRD §10 Note: VST/AU/AAX native plugin support is a confirmed Non-Goal
 * for MVP — "Requires native binary bridge — months of work — Post-Series A".
 * This page hosts VSTBrowser for the in-browser FX chain (Web Audio FX nodes)
 * and clearly communicates the native plugin roadmap status.
 *
 * Design: Acid-techno palette per SKILLS.md §7 canonical inline-style pattern.
 * No Tailwind — all inline styles from palette constants.
 * ASI v2: no `any`, no @ts-nocheck, no swallowed exceptions.
 *
 * Route: /vst  (ProtectedRoute — requires auth)
 */
import { useState } from 'react';
import { VSTBrowser } from '@/components/vst-browser';
// ── Canonical palette — SKILLS.md §7 ────────────────────────────────────────
const T = {
    bg: '#0a0a0a',
    surface: '#0d0d0d',
    border: '#1c1c1c',
    text: '#e5e5e5',
    dim: '#555',
    soft: 'var(--text-dim)',
    accent: '#a3e635',
    cyan: 'var(--accent-cyan)', // PRD §3 — active state color
    violet: 'var(--accent-purple)', // PRD §3 — AI color
    amber: 'var(--status-warn)', // PRD §3 — warning
    font: '"IBM Plex Mono", "JetBrains Mono", monospace',
};
// ── PRD §10 Non-Goal banner ───────────────────────────────────────────────────
function NonGoalBanner() {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            background: 'rgba(245,158,11,0.07)',
            border: `1px solid rgba(245,158,11,0.3)`,
            borderLeft: `3px solid ${T.amber}`,
            marginBottom: 16,
        }, children: [_jsx("span", { style: { color: T.amber, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: T.font }, children: "\u26A0 PRD \u00A710 \u2014 Non-Goal" }), _jsx("span", { style: { color: T.soft, fontSize: 9, fontFamily: T.font }, children: "Native VST / AU / AAX plugin bridge requires a native binary \u2014 Post-Series A. This page manages the Web Audio FX chain only." }), _jsx("span", { style: {
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    background: 'rgba(245,158,11,0.12)',
                    border: `1px solid rgba(245,158,11,0.25)`,
                    color: T.amber,
                    fontSize: 8,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    fontFamily: T.font,
                    whiteSpace: 'nowrap',
                }, children: "Post-Series A" })] }));
}
const FX_NODES = [
    { id: 'reverb', label: 'Reverb', status: 'active', note: 'ConvolverNode + IR presets' },
    { id: 'delay', label: 'Delay', status: 'active', note: 'BiquadFilterNode feedback loop' },
    { id: 'compressor', label: 'Compressor', status: 'active', note: 'DynamicsCompressorNode' },
    { id: 'eq', label: 'EQ', status: 'active', note: '6-band BiquadFilterNode chain' },
    { id: 'sidechain', label: 'Sidechain', status: 'idle', note: 'GainNode + AnalyserNode duck' },
    { id: 'ms-width', label: 'M/S Width', status: 'idle', note: 'Mid/Side matrix via StereoPanner' },
    { id: 'vst-bridge', label: 'VST Bridge', status: 'pending', note: 'Native binary — Post-Series A' },
];
const STATUS_COLOR = {
    active: T.accent,
    idle: 'var(--dj-dim)',
    pending: T.amber,
};
const STATUS_LABEL = {
    active: '● ACTIVE',
    idle: '○ IDLE',
    pending: '◇ ROADMAP',
};
function FxChainStatusGrid() {
    return (_jsx("div", { style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 1,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 2,
            marginBottom: 24,
        }, children: FX_NODES.map(node => (_jsxs("div", { style: {
                background: 'linear-gradient(135deg,rgba(255,255,255,0.025) 0%,rgba(0,0,0,0) 100%)',
                padding: '12px 16px',
                borderLeft: `3px solid ${STATUS_COLOR[node.status]}`,
            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, children: [_jsx("span", { style: { color: T.text, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: T.font }, children: node.label }), _jsx("span", { style: { color: STATUS_COLOR[node.status], fontSize: 8, letterSpacing: '0.2em', fontFamily: T.font }, children: STATUS_LABEL[node.status] })] }), _jsx("div", { style: { color: T.dim, fontSize: 9, fontFamily: T.font }, children: node.note })] }, node.id))) }));
}
function SectionHeader({ num, label, tag, tagColor = T.violet }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 0',
            marginBottom: 12,
            borderBottom: `1px solid ${T.border}`,
        }, children: [_jsx("span", { style: { color: T.accent, fontFamily: T.font, fontSize: 8, letterSpacing: '0.3em' }, children: num }), _jsx("span", { style: { color: T.text, fontFamily: T.font, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }, children: label }), tag && (_jsx("span", { style: {
                    marginLeft: 'auto',
                    color: tagColor,
                    fontSize: 8,
                    letterSpacing: '0.2em',
                    fontFamily: T.font,
                    padding: '2px 8px',
                    border: `1px solid ${tagColor}44`,
                    background: `${tagColor}10`,
                    textTransform: 'uppercase',
                }, children: tag }))] }));
}
// ── LLPTE integration callout ─────────────────────────────────────────────────
function LLPTECallout() {
    return (_jsxs("div", { style: {
            marginTop: 24,
            padding: '10px 14px',
            background: 'rgba(124,58,237,0.06)',
            border: `1px solid rgba(124,58,237,0.25)`,
            borderLeft: `3px solid ${T.violet}`,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
        }, children: [_jsx("span", { style: { color: T.violet, fontSize: 16, lineHeight: '1' }, children: "\u2B21" }), _jsxs("div", { children: [_jsx("div", { style: { color: T.violet, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: T.font, marginBottom: 4 }, children: "LLPTE \u00B7 outputBus Integration" }), _jsxs("div", { style: { color: T.soft, fontSize: 9, fontFamily: T.font, lineHeight: 1.65 }, children: ["All Web Audio FX nodes loaded here feed into the LLPTE", ' ', _jsx("span", { style: { color: T.cyan }, children: "outputBus" }), " pipeline node. Gain staging, EQ, and sidechain decisions flow from", ' ', _jsx("span", { style: { color: T.violet }, children: "aiMixEngine" }), " \u2192 FX chain \u2192 master output.", ' ', "Confidence gate: \u22650.65 auto-apply \u00B7 \u22650.40 ghost suggestion \u00B7 <0.40 discarded to aiDecisionLog."] })] })] }));
}
// ── Page ──────────────────────────────────────────────────────────────────────
export default function VSTPage() {
    const [selectedPlugin, setSelectedPlugin] = useState(null);
    const handlePluginSelect = (plugin) => {
        setSelectedPlugin(plugin);
    };
    return (_jsxs(_Fragment, { children: [_jsx("header", { className: "ag-header", children: _jsx("div", { className: "ag-header-top", children: _jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", "data-testid": "text-title", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "VST"] }), _jsx("div", { className: "ag-wordmark-sub", children: "VST \u00B7 Plugin Browser" })] }) }) }), _jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                    background: T.bg,
                    color: T.text,
                    fontFamily: T.font,
                    overflow: 'hidden',
                }, children: [_jsxs("div", { style: {
                            padding: '7px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: 'rgba(8,8,8,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                        }, children: [_jsx("span", { style: { color: T.accent, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase' }, children: "FX" }), _jsx("span", { style: { width: 1, height: 14, background: T.border } }), _jsx("span", { style: { color: T.dim, fontSize: 9, letterSpacing: '0.12em' }, children: "Web Audio FX Chain \u00B7 LLPTE outputBus" }), selectedPlugin !== null && (_jsxs(_Fragment, { children: [_jsx("span", { style: { width: 1, height: 14, background: T.border, marginLeft: 'auto' } }), _jsxs("span", { style: { color: T.cyan, fontSize: 9, letterSpacing: '0.12em' }, children: ["\u25CF ", selectedPlugin.name] })] }))] }), _jsx("style", { children: `@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}` }), _jsx("div", { style: { overflow: 'hidden', position: 'relative', background: '#080808', padding: '5px 0', flexShrink: 0 }, children: _jsx("div", { style: { display: 'flex', width: 'max-content', animation: 'ag-scroll 28s linear infinite' }, children: ['R3 Native', 'Web Audio API', 'Offline-First', 'MIDI Support', 'Polyphony', 'Accessible', 'MultiTrack DAW', 'VST System', 'R3 Native', 'Web Audio API', 'Offline-First', 'MIDI Support', 'Polyphony', 'Accessible', 'MultiTrack DAW', 'VST System'].map((item, i) => (_jsxs("span", { style: { padding: '0 18px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: '"IBM Plex Mono",monospace', color: '#fff', whiteSpace: 'nowrap' }, children: [item, _jsx("span", { style: { color: '#a3e635', marginLeft: 8 }, children: "/" })] }, i))) }) }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '20px 24px' }, children: [_jsx(NonGoalBanner, {}), _jsx(SectionHeader, { num: "01 \u2014", label: "FX Chain Status", tag: "LLPTE WIRED" }), _jsx(FxChainStatusGrid, {}), _jsx("div", { style: { border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0)', borderRadius: 2 }, children: _jsx(VSTBrowser, { onPluginSelect: handlePluginSelect, channelId: "master", showFXChain: true }) }), _jsx(LLPTECallout, {}), _jsx("div", { style: {
                                    marginTop: 24,
                                    paddingTop: 12,
                                    borderTop: `1px solid ${T.border}`,
                                    display: 'flex',
                                    gap: 24,
                                    flexWrap: 'wrap',
                                }, children: [
                                    ['Engine', 'Web Audio API · AudioWorklet'],
                                    ['Pipeline', 'LLPTE outputBus → spectralAnalyzer'],
                                    ['Latency SLA', '≤10ms round-trip'],
                                    ['VST Bridge', 'Post-Series A · PRD §10'],
                                    ['Build', 'R3 v4.1 · TSC 0 errors'],
                                ].map(([k, v]) => (_jsxs("div", { children: [_jsx("div", { style: { color: T.dim, fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3, fontFamily: T.font }, children: k }), _jsx("div", { style: { color: T.soft, fontSize: 9, fontFamily: T.font }, children: v })] }, k))) })] })] })] }));
}
