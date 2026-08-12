import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────
// client/src/components/mixer/MixerWithAI.tsx
//
// Integration example — shows how to wire the AI Auto-Leveling
// system into your existing mixer component.
//
// Drop-in pattern:
//   1. Build TrackAudioRef array from your existing audio nodes
//   2. Call useAutoLeveling() with the audio context + refs
//   3. Render <AILevelAssist> in your mixer header/sidebar
//   4. Pass notifyFaderMove() to each fader's onChange handler
//   5. Render <TimeSavingsPanel> in your session footer
// ─────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { useAutoLeveling } from '../hooks/useAutoLeveling';
import { AILevelAssist } from './AILevelAssist';
import { TimeSavingsPanel } from './TimeSavingsPanel';
// ── Mixer Component ────────────────────────────────────────────
export function MixerWithAI({ audioContext, masterAnalyser, tracks }) {
    // ── 1. Build TrackAudioRef array from your existing nodes ──
    const trackRefs = tracks.map(track => ({
        trackId: track.id,
        analyserNode: track.analyserNode,
        gainNode: track.gainNode,
        eqNodes: track.eqNodes,
    }));
    // ── 2. Connect auto-leveling hook ──────────────────────────
    const { enabled, toggle, trackStates, accept, reject, notifyFaderMove, nodeState, sessionStats, latestRecommendation, } = useAutoLeveling(audioContext, masterAnalyser, trackRefs, {
        autoStart: true,
        analysisHz: 30,
    });
    // Track order for the ghost knob grid (matches your visual track order)
    const trackOrder = tracks.map(t => t.id);
    // ── 3. Fader change handler — notify AI of manual moves ────
    const handleFaderChange = useCallback((trackId, newGainLinear) => {
        // Update your existing gain node (your existing code)
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            track.gainNode.gain.setTargetAtTime(newGainLinear, audioContext.currentTime, 0.01);
        }
        // Notify LLPTE — marks override, logs manual adjustment
        notifyFaderMove(trackId, newGainLinear);
    }, [tracks, audioContext, notifyFaderMove]);
    return (_jsxs("div", { className: "flex flex-col h-full bg-[var(--panel-deep)] text-foreground", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-white/5", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-sm font-semibold text-slate-300", children: "Mixer" }), _jsxs("span", { className: "text-[10px] font-mono text-slate-600", children: [tracks.length, " tracks"] })] }), _jsx(AILevelAssist, { enabled: enabled, onToggle: toggle, trackStates: trackStates, onAccept: accept, onReject: reject, nodeState: nodeState, trackOrder: trackOrder })] }), _jsx("div", { className: "flex flex-1 overflow-x-auto", children: tracks.map(track => (_jsx(TrackStrip, { track: track, onGainChange: handleFaderChange }, track.id))) }), _jsx("div", { className: "px-4 py-3 border-t border-white/5", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(TimeSavingsPanel, { stats: sessionStats, expanded: false }), latestRecommendation && process.env.NODE_ENV === 'development' && (_jsxs("div", { className: "text-[9px] font-mono text-slate-700", children: ["frame #", latestRecommendation.frameId, " |", ' ', latestRecommendation.processingTimeMs.toFixed(1), "ms |", ' ', Math.round(latestRecommendation.overallConfidence * 100), "% conf"] }))] }) })] }));
}
function TrackStrip({ track, onGainChange }) {
    const [gain, setGain] = useState(1.0);
    const handleInput = (e) => {
        const newGain = parseFloat(e.target.value);
        setGain(newGain);
        onGainChange(track.id, newGain);
    };
    return (_jsxs("div", { className: "flex flex-col items-center gap-2 p-3 border-r border-white/5 min-w-[72px]", style: { borderTop: `2px solid ${track.color}` }, children: [_jsx("span", { className: "text-[9px] font-mono text-slate-400 uppercase tracking-widest", children: track.name }), _jsx("input", { type: "range", min: 0, max: 2, step: 0.01, value: gain, onChange: handleInput, className: "h-24 w-2 cursor-pointer", style: { writingMode: 'vertical-lr', direction: 'rtl' } }), _jsx("span", { className: "text-[9px] font-mono text-slate-500", children: gain.toFixed(2) })] }));
}
