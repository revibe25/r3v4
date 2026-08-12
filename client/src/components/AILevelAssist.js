import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────
// client/src/components/mixer/AILevelAssist.tsx
//
// The main UI component for AI Auto-Leveling in the mixer.
//
// Renders:
//   - "AI Level Assist" toggle button
//   - Per-track ghost knobs (shows AI-suggested gain position)
//   - Confidence badges (percentage per track)
//   - Accept / Reject buttons per suggestion
//   - Clipping indicators
//   - Live inference timing badge
// ─────────────────────────────────────────────────────────────
// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber)
// Reason: AI warning state — directly adjacent to LLPTE pipeline output
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useMemo } from 'react';
// ── Utility ────────────────────────────────────────────────────
/** Convert linear gain (0–4) to knob angle in degrees (−135° to +135°) */
function gainToAngle(linearGain) {
    // Knob range: 0 to 2.0 linear (0 to +6dB)
    // Mapped to −135° (silence) to +135° (unity/boost)
    const normalized = Math.min(1, linearGain / 2);
    return -135 + normalized * 270;
}
/** Format gain in dB for display */
function gainTodB(linearGain) {
    if (linearGain <= 0)
        return '-∞';
    const db = 20 * Math.log10(linearGain);
    return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
}
export const GhostKnob = memo(function GhostKnob({ currentGain, suggestedGain, confidence, isClipping, userOverride, size = 48, }) {
    const currentAngle = gainToAngle(currentGain);
    const suggestedAngle = suggestedGain !== null ? gainToAngle(suggestedGain) : null;
    const center = size / 2;
    const radius = (size / 2) - 4;
    const indicatorLength = radius * 0.55;
    // Indicator line for current position
    const currentRad = ((currentAngle - 90) * Math.PI) / 180;
    const currentX = center + Math.sin(currentRad) * indicatorLength;
    const currentY = center - Math.cos(currentRad) * indicatorLength;
    // Ghost indicator for AI suggestion
    let ghostX = 0, ghostY = 0;
    if (suggestedAngle !== null) {
        const ghostRad = ((suggestedAngle - 90) * Math.PI) / 180;
        ghostX = center + Math.sin(ghostRad) * indicatorLength;
        ghostY = center - Math.cos(ghostRad) * indicatorLength;
    }
    // Color theme
    const knobColor = isClipping ? '#ef4444' : userOverride ? 'var(--status-warn)' : 'var(--panel-deep)';
    const ghostOpacity = confidence !== null ? 0.3 + confidence * 0.5 : 0;
    const ghostColor = confidence !== null && confidence > 0.8 ? 'var(--accent-violet)' : 'var(--accent-indigo)';
    return (_jsx("div", { className: "relative flex items-center justify-center", style: { width: size, height: size }, title: suggestedGain !== null ? `AI suggests: ${gainTodB(suggestedGain)} (${Math.round((confidence ?? 0) * 100)}% confidence)` : undefined, children: _jsxs("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { overflow: 'visible' }, children: [_jsx("circle", { cx: center, cy: center, r: radius, fill: knobColor, stroke: isClipping ? '#ef4444' : 'var(--text-dim)', strokeWidth: 1.5 }), suggestedAngle !== null && (_jsx("circle", { cx: center, cy: center, r: radius - 2, fill: "none", stroke: ghostColor, strokeWidth: 2, strokeDasharray: "2 3", opacity: ghostOpacity })), suggestedAngle !== null && (_jsx("line", { x1: center, y1: center, x2: ghostX, y2: ghostY, stroke: ghostColor, strokeWidth: 2, strokeLinecap: "round", opacity: ghostOpacity + 0.2, style: {
                        filter: confidence && confidence > 0.8 ? `drop-shadow(0 0 3px ${ghostColor})` : undefined,
                    } })), _jsx("line", { x1: center, y1: center, x2: currentX, y2: currentY, stroke: "var(--text-primary)", strokeWidth: 2.5, strokeLinecap: "round" }), _jsx("circle", { cx: center, cy: center, r: 2, fill: "var(--slate-400)" }), isClipping && (_jsx("circle", { cx: center, cy: center, r: radius + 2, fill: "none", stroke: "#ef4444", strokeWidth: 2, opacity: 0.8, style: { animation: 'pulse 0.5s ease-in-out infinite' } }))] }) }));
});
export const ConfidenceBadge = memo(function ConfidenceBadge({ confidence }) {
    const percent = Math.round(confidence * 100);
    const color = confidence >= 0.85 ? 'text-violet-400 border-violet-500/40 bg-violet-500/10' :
        confidence >= 0.65 ? 'text-blue-400 border-blue-500/40 bg-blue-500/10' :
            'text-slate-400 border-slate-500/40 bg-slate-500/10';
    return (_jsxs("span", { className: `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${color}`, title: `AI confidence: ${percent}%`, children: [percent, "%"] }));
});
export const TrackAICard = memo(function TrackAICard({ state, onAccept, onReject }) {
    const hasSuggestion = state.suggestedGain !== null && !state.userOverride;
    return (_jsxs("div", { className: `
        flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-300
        ${state.isClipping
            ? 'border-red-500/60 bg-red-500/5'
            : hasSuggestion
                ? 'border-violet-500/40 bg-violet-500/5'
                : 'border-white/5 bg-transparent'}
      `, children: [_jsx("span", { className: "text-[9px] font-mono text-slate-500 uppercase tracking-widest truncate w-full text-center", children: state.trackId }), _jsx(GhostKnob, { currentGain: state.currentGain, suggestedGain: state.suggestedGain, confidence: state.confidence, isClipping: state.isClipping, userOverride: state.userOverride, size: 44 }), state.confidence !== null && !state.userOverride && (_jsx(ConfidenceBadge, { confidence: state.confidence })), state.userOverride && (_jsx("span", { className: "text-[9px] text-amber-400/70 font-mono", children: "MANUAL" })), hasSuggestion && (_jsxs("div", { className: "flex gap-1 mt-0.5", children: [_jsx("button", { onClick: () => onAccept(state.trackId), className: "px-2 py-0.5 text-[10px] font-medium rounded bg-violet-600/80 hover:bg-violet-600 text-foreground transition-colors", title: "Accept AI suggestion", children: "\u2713" }), _jsx("button", { onClick: () => onReject(state.trackId), className: "px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 hover:bg-white/10 text-slate-400 transition-colors", title: "Reject AI suggestion", children: "\u2715" })] })), state.eqSuggestions.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1 justify-center", children: state.eqSuggestions.slice(0, 2).map((eq, i) => (_jsx(EQPill, { suggestion: eq }, i))) }))] }));
});
const EQPill = memo(function EQPill({ suggestion }) {
    const label = suggestion.band === 'low'
        ? `LP ${suggestion.frequency.toFixed(0)}Hz`
        : suggestion.band === 'low-mid'
            ? `Cut ${suggestion.frequency.toFixed(0)}Hz`
            : suggestion.band === 'high-mid'
                ? `Cut ${suggestion.frequency.toFixed(0)}Hz`
                : `HS ${suggestion.frequency.toFixed(0)}Hz`;
    return (_jsx("span", { className: "px-1.5 py-0.5 text-[9px] font-mono rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400", title: suggestion.reason, children: label }));
});
export const LLPTEStatusBar = memo(function LLPTEStatusBar({ nodeState, enabled }) {
    const nodes = [
        { key: 'inputRouter', label: 'IN' },
        { key: 'spectralAnalyzer', label: 'SPEC' },
        { key: 'aiMixEngine', label: 'AI' },
        { key: 'transitionGraph', label: 'TRANS' },
        { key: 'outputBus', label: 'OUT' },
    ];
    return (_jsxs("div", { className: "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/40 border border-white/5", children: [nodes.map((node, i) => {
                const status = nodeState[node.key];
                return (_jsxs(React.Fragment, { children: [_jsxs("div", { className: `
                flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all duration-100
                ${!enabled ? 'text-slate-700' :
                                status === 'active' ? 'text-violet-300 bg-violet-500/20' :
                                    status === 'error' ? 'text-red-400 bg-red-500/20' :
                                        'text-slate-600'}
              `, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${!enabled ? 'bg-slate-800' :
                                        status === 'active' ? 'bg-violet-400 shadow-[0_0_4px_var(--accent-violet)]' :
                                            status === 'error' ? 'bg-red-400' :
                                                'bg-slate-700'}` }), node.label] }), i < nodes.length - 1 && (_jsx("span", { className: `text-[10px] ${enabled ? 'text-slate-600' : 'text-slate-800'}`, children: "\u2192" }))] }, node.key));
            }), _jsxs("div", { className: "ml-2 pl-2 border-l border-white/10 flex items-center gap-1.5", children: [_jsxs("span", { className: `text-[9px] font-mono ${nodeState.lastInferenceMs > 12 ? 'text-amber-400' : 'text-slate-500'}`, children: [nodeState.lastInferenceMs.toFixed(1), "ms"] }), _jsxs("span", { className: "text-[9px] font-mono text-slate-700", children: [nodeState.analysisFrameRate, "fps"] })] })] }));
});
export const AILevelAssist = memo(function AILevelAssist({ enabled, onToggle, trackStates, onAccept, onReject, nodeState, trackOrder, compact = false, }) {
    const orderedTracks = useMemo(() => {
        const ids = trackOrder ?? Array.from(trackStates.keys());
        return ids.map(id => trackStates.get(id)).filter(Boolean);
    }, [trackStates, trackOrder]);
    const activeSuggestions = orderedTracks.filter(t => t.suggestedGain !== null && !t.userOverride).length;
    const clippingCount = orderedTracks.filter(t => t.isClipping).length;
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("button", { onClick: onToggle, className: `
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
            ${enabled
                            ? 'bg-violet-600 text-foreground shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'}
          `, children: [_jsx("span", { className: `text-sm ${enabled ? 'text-violet-200' : 'text-slate-500'}`, children: "\u26A1" }), "AI Level Assist", enabled && activeSuggestions > 0 && (_jsx("span", { className: "ml-1 px-1.5 py-0.5 rounded-full bg-violet-400/30 text-violet-200 text-[10px]", children: activeSuggestions }))] }), clippingCount > 0 && (_jsxs("div", { className: "flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/30", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" }), _jsxs("span", { className: "text-[10px] font-mono text-red-400", children: [clippingCount, " CLIP", clippingCount > 1 ? 'S' : ''] })] }))] }), enabled && orderedTracks.length > 0 && (_jsx("div", { className: "grid gap-1.5", style: { gridTemplateColumns: `repeat(${Math.min(orderedTracks.length, 8)}, minmax(0, 1fr))` }, children: orderedTracks.map(trackState => (_jsx(TrackAICard, { state: trackState, onAccept: onAccept, onReject: onReject }, trackState.trackId))) })), enabled && (_jsx(LLPTEStatusBar, { nodeState: nodeState, enabled: enabled }))] }));
});
