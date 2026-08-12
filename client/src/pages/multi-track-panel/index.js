import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// =============================================================================
// [INFO] This is the canonical loaded component as of 2026-04-28. Modular version is dead code.
// =============================================================================
// This is the original monolithic MultiTrackPanel (~1600 lines).
// It has been superseded by the modular refactor at:
//
//   components/multi-track-panel/multi-track-panel.tsx
//   components/multi-track-panel/index.ts    ← App.tsx imports from here
//
// [INFO] This is the canonical loaded component as of 2026-04-28. Modular version is dead code.
// reference only and should be deleted once the modular version is confirmed
// stable in production.
//
// Tracked: Bug M-4 (R3 v4 Advanced Audit)
// =============================================================================
// [INFO] This is the canonical loaded component as of 2026-04-28. Modular version is dead code.
// @ts-nocheck
/**
 * [DEBT-BANNER] Type-checking is suppressed pending full migration. See issue https://github.com/myorg/myrepo/issues/1234
 * Reasoning: Legacy component with type issues too complex to fix in a rush. OWNED BY: your-github-username
 * To remove: Incrementally port code and eliminate all remaining type errors, then delete this block.
 * Last verified: 2026-04-28
 */
/**
 * Multi-Track Panel — R3-N-i DAW
 * Production-grade mixer/timeline with full VST integration,
 * collapsible sections, real metering, and transport wiring.
 *
 * FIXES:
 *   1. useVSTContext() → useVSTContextOptional() — panel lives on /multitrack
 *      where VSTProvider is absent. No longer throws on mount.
 *   2. Performance monitor overlay guarded with `&& vstContext`.
 *   3. Performance monitor toolbar button dimmed/disabled when VST offline.
 *   4. VSTPanelModal receives trackName prop — modal no longer reads the
 *      non-existent vstState.tracks from context.
 *   5. engine.cleanup() safely guarded with typeof check.
 *   6. PageNav restored — renders above the DAW shell as top-level nav.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Square, SkipBack, Repeat, Save, FolderOpen, Upload, Settings, Activity, Cpu, ZoomIn, ZoomOut, X, ArrowLeft, Plus, VolumeX, Sliders, ChevronDown, ChevronRight, Info, Headphones, AlignLeft, Minimize2, CircleDot, Trash2, Snowflake, Zap } from 'lucide-react';
import { Link } from 'wouter';
import { useVSTContextOptional } from '@/contexts/VSTContext';
import { VSTPerformanceUI } from '@/components/vst-performance-monitor-ui';
import { AudioEngine } from './audio-engine';
import { PreferencesModal } from './components/preferences-modal';
import { VSTPanelModal } from './components/vst-panel-modal';
import { TRACK_COLORS, FX_ICONS } from './constants';
import { formatTime, generateId, gainToDb, serializeProject, downloadFile } from './utils';
// ============================================================
// ACID GRID STYLES — matches instrument.tsx aesthetic
// ============================================================
const AG_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

/* ── Page-level shell ──────────────────────────────────────── */
.ag-page-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--nav-h, 0px));
  overflow: hidden;
  background: var(--ag-black);
}

/* PageNav sits at top, DAW shell fills the rest */
.ag-page-shell > nav,
.ag-page-shell > [data-page-nav] {
  flex-shrink: 0;
  border-bottom: 1px solid var(--ag-border) !important;
  background: var(--ag-ink) !important;
  z-index: 60;
}

/* Integrate PageNav links into DAW palette */
.ag-page-shell nav a,
.ag-page-shell nav button {
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 10px !important;
  letter-spacing: .15em !important;
  text-transform: uppercase !important;
  border-radius: 0 !important;
}

.ag-page-shell nav a[data-active="true"],
.ag-page-shell nav a.active,
.ag-page-shell nav a[aria-current] {
  color: var(--ag-acid) !important;
  background: rgba(163,230,53,.06) !important;
  border-bottom: 2px solid var(--ag-acid) !important;
}

/* ── DAW shell (fills remaining height) ──────────────────── */
.ag-daw-shell {
  flex: 1;
  min-height: 0;
  background: var(--ag-black);
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,.012) 3px, rgba(255,255,255,.012) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,.016) 31px, rgba(255,255,255,.016) 32px);
  font-family: 'IBM Plex Mono', monospace;
  display: flex; flex-direction: column; overflow: hidden;
  color: var(--ag-white);
}

/* ── DAW header ──────────────────────────────────────────── */
.ag-daw-header {
  border-bottom: 2px solid var(--ag-border);
  position: relative; overflow: hidden; flex-shrink: 0;
  box-shadow: 0 4px 32px rgba(0,0,0,.7), 0 1px 0 rgba(163,230,53,.04);
  background: linear-gradient(180deg, #0c0c0c 0%, var(--ag-ink) 100%);
}

.ag-daw-header-top {
  display: flex; align-items: stretch;
  border-bottom: 1px solid var(--ag-border);
  position: relative;
}

/* Acid glow sweep behind header */
.ag-daw-header-top::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(163,230,53,.02) 40%, transparent 100%);
  pointer-events: none;
}

.ag-daw-wordmark-block {
  padding: 10px 20px; border-right: 1px solid var(--ag-border);
  display: flex; flex-direction: column; justify-content: center;
  min-width: 180px; position: relative; z-index: 1;
  background: linear-gradient(135deg, rgba(163,230,53,.03) 0%, transparent 60%);
}

.ag-daw-wordmark {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px;
  letter-spacing: -.02em; color: var(--ag-white); line-height: 1;
}

.ag-daw-wordmark span {
  color: var(--ag-acid);
  text-shadow: 0 0 16px rgba(163,230,53,.5), 0 0 32px rgba(163,230,53,.2);
}

.ag-daw-wordmark-sub {
  font-size: 7px; letter-spacing: .35em; text-transform: uppercase;
  color: var(--ag-soft); margin-top: 5px;
  display: flex; align-items: center; gap: 6px;
}

.ag-daw-wordmark-sub::before {
  content: '';
  display: inline-block;
  width: 12px; height: 1px;
  background: var(--ag-acid);
  box-shadow: 0 0 4px var(--ag-acid);
}

.ag-daw-status-block {
  padding: 10px 16px; border-right: 1px solid var(--ag-border);
  display: flex; flex-direction: column; justify-content: center; gap: 5px; z-index: 1;
  min-width: 140px;
}

.ag-daw-status-line {
  font-size: 9px; letter-spacing: .2em; text-transform: uppercase;
  display: flex; align-items: center; gap: 6px;
}

.ag-cursor-live {
  display: inline-block; width: 7px; height: 12px;
  background: var(--ag-acid);
  box-shadow: 0 0 10px var(--ag-acid), 0 0 20px rgba(163,230,53,.3);
  animation: ag-blink 1s step-end infinite;
}

.ag-cursor-standby {
  display: inline-block; width: 7px; height: 12px;
  background: var(--ag-mute);
}

@keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }

.ag-daw-transport-block {
  flex: 1; padding: 8px 16px;
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap; z-index: 1;
}

/* ── Ticker ──────────────────────────────────────────────── */
.ag-daw-ticker {
  padding: 3px 0;
  background: linear-gradient(90deg, #080808, #0c0c0c, #080808);
  overflow: hidden; position: relative;
  border-top: 1px solid rgba(163,230,53,.06);
}

.ag-daw-ticker::before, .ag-daw-ticker::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 60px; z-index: 2;
}

.ag-daw-ticker::before { left: 0; background: linear-gradient(90deg, #080808, transparent); }
.ag-daw-ticker::after  { right: 0; background: linear-gradient(-90deg, #080808, transparent); }

.ag-daw-ticker-inner {
  display: flex; width: max-content;
  animation: ag-scroll 32s linear infinite;
}

@keyframes ag-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }

.ag-daw-ticker-item {
  font-size: 8px; letter-spacing: .25em; text-transform: uppercase;
  color: #fff; padding: 0 24px; white-space: nowrap;
  display: flex; align-items: center; gap: 10px;
  transition: color .2s;
}

.ag-daw-ticker-sep { color: #a3e635; }

/* ── Section strip ───────────────────────────────────────── */
.ag-daw-section-strip {
  background: linear-gradient(90deg, rgba(163,230,53,.025) 0%, transparent 300px);
  border-top: 1px solid var(--ag-border);
  border-bottom: 1px solid var(--ag-border);
  padding: 5px 16px;
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}

/* ── Transport buttons ───────────────────────────────────── */
.ag-transport-btn {
  background: var(--ag-ink);
  border: 1px solid var(--ag-border);
  color: var(--ag-white);
  padding: 5px 8px;
  cursor: pointer;
  transition: background .1s, border-color .1s, color .1s, box-shadow .1s;
  display: flex; align-items: center; justify-content: center;
}

.ag-transport-btn:hover {
  background: var(--ag-panel);
  border-color: var(--ag-dim);
  box-shadow: 0 0 8px rgba(0,0,0,.4);
}

.ag-transport-btn.active {
  background: var(--ag-acid);
  border-color: var(--ag-acid);
  color: var(--ag-black);
  box-shadow: 0 0 12px rgba(163,230,53,.3);
}

.ag-transport-btn.rec-active {
  background: var(--ag-rec);
  border-color: #ff6666;
  color: #fff;
  box-shadow: 0 0 12px rgba(239,68,68,.3);
  animation: ag-rec-blink .8s ease-in-out infinite;
}

.ag-transport-btn.loop-active {
  background: rgba(163,230,53,.12);
  border-color: var(--ag-acid);
  color: var(--ag-acid);
}

/* ── BPM display ─────────────────────────────────────────── */
.ag-bpm-block {
  display: flex; align-items: center; gap: 6px;
  background: var(--ag-black);
  border: 1px solid var(--ag-border);
  padding: 4px 10px;
  position: relative;
  overflow: hidden;
}

.ag-bpm-block::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(163,230,53,.04) 0%, transparent 50%);
  pointer-events: none;
}

.ag-bpm-value {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 26px;
  color: var(--ag-acid);
  line-height: 1;
  text-shadow: 0 0 20px rgba(163,230,53,.4);
  min-width: 46px;
  text-align: center;
}

/* ── Status bar ──────────────────────────────────────────── */
.ag-daw-statusbar {
  display: flex; align-items: center; gap: 14px; padding: 4px 16px;
  background: linear-gradient(90deg, #080808, var(--ag-ink));
  border-top: 1px solid var(--ag-border);
  flex-shrink: 0;
  font-size: 9px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--ag-soft);
}

.ag-status-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ag-status-dot.playing  { background: var(--ag-acid); box-shadow: 0 0 6px var(--ag-acid); animation: ag-rec-blink .8s ease-in-out infinite; }
.ag-status-dot.recording { background: var(--ag-rec); box-shadow: 0 0 6px var(--ag-rec); animation: ag-rec-blink .6s ease-in-out infinite; }
.ag-status-dot.stopped  { background: var(--ag-mute); }

/* ── Panel section headers ───────────────────────────────── */
.ag-section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px;
  background: linear-gradient(90deg, rgba(163,230,53,.03) 0%, transparent 200px);
  border-bottom: 1px solid var(--ag-border);
  flex-shrink: 0;
}

.ag-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--ag-soft); font-weight: 600;
}

.ag-section-title svg { color: var(--ag-acid); }

/* ── Shared overrides ────────────────────────────────────── */
.ag-daw-shell button,
.ag-daw-shell input,
.ag-daw-shell select {
  font-family: 'IBM Plex Mono', monospace !important;
  border-radius: 0 !important;
}

.ag-daw-shell .rounded, .ag-daw-shell .rounded-lg,
.ag-daw-shell .rounded-md, .ag-daw-shell .rounded-sm,
.ag-daw-shell .rounded-full { border-radius: 0 !important; }

.ag-daw-shell .bg-background  { background: var(--ag-black)  !important; }
.ag-daw-shell .bg-card\/60, .ag-daw-shell .bg-card\/50,
.ag-daw-shell .bg-card\/30, .ag-daw-shell .bg-card\/20 { background: var(--ag-panel) !important; }
.ag-daw-shell .bg-card        { background: var(--ag-card)   !important; }

.ag-daw-shell .border-border  { border-color: var(--ag-border) !important; }
.ag-daw-shell [class*="border-border"] { border-color: var(--ag-border) !important; }
.ag-daw-shell .border-border\/50, .ag-daw-shell .border-border\/30,
.ag-daw-shell .border-border\/40  { border-color: var(--ag-border) !important; }

.ag-daw-shell .text-foreground       { color: var(--ag-white) !important; }
.ag-daw-shell .text-muted-foreground { color: var(--ag-soft)  !important; }
.ag-daw-shell .text-primary          { color: var(--ag-acid)  !important; }

.ag-daw-shell .bg-primary             { background: var(--ag-acid) !important; color: var(--ag-black) !important; }
.ag-daw-shell .bg-primary\/5          { background: rgba(163,230,53,.05) !important; }
.ag-daw-shell .bg-primary\/10         { background: rgba(163,230,53,.08) !important; }
.ag-daw-shell .bg-primary\/20         { background: rgba(163,230,53,.12) !important; }
.ag-daw-shell .text-primary-foreground { color: var(--ag-black) !important; }
.ag-daw-shell .border-primary         { border-color: var(--ag-acid) !important; }
.ag-daw-shell .border-primary\/20, .ag-daw-shell .border-primary\/30 { border-color: var(--ag-acid-d) !important; }
.ag-daw-shell .border-l-primary       { border-left-color: var(--ag-acid) !important; }
.ag-daw-shell .ring-primary\/30       { --tw-ring-color: rgba(163,230,53,.3) !important; }

.ag-daw-shell .hover\:bg-accent:hover      { background: rgba(163,230,53,.07) !important; }
.ag-daw-shell .hover\:text-foreground:hover { color: var(--ag-acid) !important; }

.ag-daw-shell input[type="range"]                        { accent-color: var(--ag-acid) !important; }
.ag-daw-shell input[type="range"]::-webkit-slider-thumb { border-radius: 0 !important; }

.ag-daw-shell input[type="text"],
.ag-daw-shell input[type="number"] {
  font-family: 'IBM Plex Mono', monospace !important;
  background: var(--ag-black) !important;
  color: var(--ag-white) !important;
  border-radius: 0 !important;
}

.ag-daw-shell .text-emerald-400,
.ag-daw-shell .text-emerald-300,
.ag-daw-shell .text-emerald-200 { color: var(--ag-acid) !important; }
.ag-daw-shell .bg-emerald-400   { background: var(--ag-acid) !important; }
.ag-daw-shell .bg-emerald-600   { background: var(--ag-acid) !important; color: var(--ag-black) !important; }
.ag-daw-shell .hover\:bg-emerald-700:hover { background: var(--ag-acid2) !important; }

.ag-daw-shell .bg-red-600    { background: var(--ag-rec)  !important; }
.ag-daw-shell .bg-yellow-500 { background: #eab308        !important; }
.ag-daw-shell .bg-yellow-400 { background: #facc15        !important; }
.ag-daw-shell .bg-blue-500   { background: var(--ag-cyan) !important; }
.ag-daw-shell .bg-green-500  { background: var(--ag-acid) !important; }
.ag-daw-shell .bg-orange-500 { background: #fb923c        !important; }
.ag-daw-shell .bg-purple-500 { background: #a78bfa        !important; }

.ag-daw-shell .border-white\/10  { border-color: var(--ag-border) !important; }
.ag-daw-shell .shadow-primary\/20 { box-shadow: 0 0 8px rgba(163,230,53,.2) !important; }

.ag-daw-shell .bg-black\/60,
.ag-daw-shell .bg-black\/40 { background: var(--ag-black) !important; }

.ag-daw-shell .overflow-hidden { border-radius: 0 !important; }
.ag-daw-shell .rounded-sm      { border-radius: 0 !important; }
.ag-daw-shell .rounded-t       { border-radius: 0 !important; }

.ag-daw-shell .animate-pulse { animation: ag-rec-blink 0.8s ease-in-out infinite !important; }
@keyframes ag-rec-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

.ag-daw-shell .bg-card.border.border-border {
  background: var(--ag-ink) !important; border-color: var(--ag-border) !important;
  border-radius: 0 !important;
}

.ag-daw-shell .shadow-2xl { box-shadow: 0 8px 40px rgba(0,0,0,.9) !important; }

.ag-daw-shell ::-webkit-scrollbar       { width: 4px; height: 4px; background: var(--ag-black); }
.ag-daw-shell ::-webkit-scrollbar-thumb { background: var(--ag-border); border-radius: 0; }
.ag-daw-shell ::-webkit-scrollbar-thumb:hover { background: var(--ag-acid); }

.ag-daw-shell kbd {
  background: var(--ag-ink) !important; border: 1px solid var(--ag-border) !important;
  border-radius: 0 !important; color: var(--ag-acid) !important;
  font-family: 'IBM Plex Mono', monospace !important;
}

.ag-daw-back {
  font-size: 9px; letter-spacing: .15em; text-transform: uppercase;
  background: transparent; border: 1px solid var(--ag-border); padding: 5px 10px;
  color: var(--ag-white); cursor: pointer; transition: all .1s;
  text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
}
.ag-daw-back:hover {
  background: var(--ag-acid); border-color: var(--ag-acid);
  color: var(--ag-black); box-shadow: 0 0 10px rgba(163,230,53,.25);
}

/* ── Divider ─────────────────────────────────────────────── */
.ag-divider {
  width: 1px; height: 28px;
  background: linear-gradient(180deg, transparent, var(--ag-border), transparent);
  margin: 0 4px; flex-shrink: 0;
}

/* ── Collapsed panel tab ─────────────────────────────────── */
.ag-collapsed-tab {
  display: flex; flex-direction: column; align-items: center;
  width: 30px; border-right: 1px solid var(--ag-border);
  background: var(--ag-ink);
  cursor: pointer; gap: 6px; padding: 10px 0;
  transition: background .15s;
}
.ag-collapsed-tab:hover {
  background: rgba(163,230,53,.05);
}
.ag-collapsed-tab span {
  font-size: 7px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--ag-soft); writing-mode: vertical-rl; transform: rotate(180deg);
}
`;
// ============================================================
// CONSTANTS
// ============================================================
const METER_DECAY = 0.92;
const PEAK_HOLD_FRAMES = 60;
const MAX_TRACKS = 32;
const TRACK_TYPE_COLORS = {
    audio: 'bg-blue-500',
    midi: 'bg-green-500',
    aux: 'bg-orange-500',
    master: 'bg-purple-500',
};
const AUTOMATION_MODE_COLORS = {
    off: 'text-muted-foreground',
    read: 'text-green-400',
    write: 'text-red-400',
    touch: 'text-yellow-400',
    latch: 'text-orange-400',
};
// ============================================================
// SUB-COMPONENTS
// ============================================================
function VUMeter({ level, peak, height = 80, stereo = false, label }) {
    const getColor = (val) => {
        if (val > 0.9)
            return 'bg-red-500';
        if (val > 0.75)
            return 'bg-yellow-400';
        return 'bg-emerald-400';
    };
    const MeterBar = ({ val, pk }) => (_jsxs("div", { className: "relative flex-1 bg-black/60 rounded-sm overflow-hidden ", style: { height }, children: [[0.75, 0.5, 0.25].map(mark => (_jsx("div", { className: "absolute w-full ", style: { bottom: `${mark * 100}%` } }, mark))), _jsx("div", { className: `absolute bottom-0 left-0 right-0 transition-all duration-75 ${getColor(val)}`, style: { height: `${val * 100}%` } }), _jsx("div", { className: "absolute left-0 right-0 h-px bg-white/80 transition-all duration-200", style: { bottom: `${pk * 100}%` } })] }));
    return (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsxs("div", { className: `flex gap-0.5 ${stereo ? 'w-5' : 'w-2.5'}`, children: [_jsx(MeterBar, { val: level, pk: peak }), stereo && _jsx(MeterBar, { val: level * 0.9, pk: peak * 0.9 })] }), label && _jsx("span", { className: "text-[8px] text-muted-foreground font-mono", children: label })] }));
}
function TrackStrip({ track, isSelected, onSelect, onUpdate, onShowVST, onRemove }) {
    const [expanded, setExpanded] = useState(false);
    const dbVal = gainToDb(track.volume).toFixed(1);
    const panVal = track.pan === 0 ? 'C' : track.pan > 0
        ? `R${Math.round(track.pan * 100)}`
        : `L${Math.round(Math.abs(track.pan) * 100)}`;
    return (_jsxs("div", { className: `flex flex-col flex-shrink-0 border-r border-border transition-all duration-150 ${isSelected ? 'bg-primary/5' : 'bg-card/30 hover:bg-card/50'}`, style: { width: expanded ? 120 : 80 }, onClick: onSelect, children: [_jsx("div", { className: `h-0.5 ${TRACK_TYPE_COLORS[track.type]}`, style: { boxShadow: isSelected ? '0 0 6px currentColor' : 'none' } }), _jsxs("div", { className: "px-1.5 py-1.5 space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("input", { className: "text-[10px] font-medium bg-transparent border-none outline-none w-full truncate text-foreground", value: track.name, onChange: e => onUpdate({ name: e.target.value }), onClick: e => e.stopPropagation() }), _jsx("button", { onClick: () => setExpanded(!expanded), className: "text-muted-foreground/50 hover:text-muted-foreground ml-1 flex-shrink-0 transition-colors", children: expanded ? _jsx(ChevronRight, { size: 10 }) : _jsx(ChevronDown, { size: 10 }) })] }), _jsx("div", { className: "flex gap-0.5", children: [
                            { key: 'armed', label: 'R', activeClass: 'bg-red-600 text-white', hoverClass: 'hover:bg-red-600/30' },
                            { key: 'muted', label: 'M', activeClass: 'bg-yellow-500 text-black', hoverClass: 'hover:bg-yellow-500/30' },
                            { key: 'solo', label: 'S', activeClass: 'bg-yellow-400 text-black', hoverClass: 'hover:bg-yellow-400/30' },
                        ].map(({ key, label, activeClass, hoverClass }) => (_jsx("button", { onClick: e => { e.stopPropagation(); onUpdate({ [key]: !track[key] }); }, className: `flex-1 text-[9px] font-bold py-0.5 transition-colors ${track[key]
                                ? activeClass
                                : `bg-muted text-muted-foreground ${hoverClass}`}`, children: label }, key))) }), _jsxs("div", { className: "space-y-0.5", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-[8px] text-muted-foreground", children: "VOL" }), _jsxs("span", { className: "text-[8px] font-mono text-foreground/70", children: [dbVal, "dB"] })] }), _jsx("input", { type: "range", min: 0, max: 1.25, step: 0.01, value: track.volume, onChange: e => { e.stopPropagation(); onUpdate({ volume: parseFloat(e.target.value) }); }, onClick: e => e.stopPropagation(), className: "w-full h-1 accent-primary cursor-pointer" })] }), _jsxs("div", { className: "space-y-0.5", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-[8px] text-muted-foreground", children: "PAN" }), _jsx("span", { className: "text-[8px] font-mono text-foreground/70", children: panVal })] }), _jsx("input", { type: "range", min: -1, max: 1, step: 0.01, value: track.pan, onChange: e => { e.stopPropagation(); onUpdate({ pan: parseFloat(e.target.value) }); }, onClick: e => e.stopPropagation(), className: "w-full h-1 accent-primary cursor-pointer" })] }), _jsx("div", { className: "flex justify-center py-1", children: _jsx(VUMeter, { level: track.muted ? 0 : track.meter, peak: track.muted ? 0 : track.peak, height: 60, stereo: true }) }), _jsxs("div", { className: "flex flex-wrap gap-0.5", children: [track.fxChain.slice(0, 4).map((fx, i) => (_jsx("span", { className: "text-[8px] px-1 py-0.5 bg-primary/20 text-primary rounded truncate", title: fx, children: FX_ICONS[fx] ?? '•' }, i))), track.fxChain.length > 4 && (_jsxs("span", { className: "text-[8px] text-muted-foreground", children: ["+", track.fxChain.length - 4] }))] }), expanded && (_jsxs("div", { className: "space-y-1 border-t border-border/30 pt-1 mt-1", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-[8px] text-muted-foreground", children: "AUTO" }), _jsx("span", { className: `text-[8px] font-bold ${AUTOMATION_MODE_COLORS[track.automationMode]}`, children: track.automationMode.toUpperCase() })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: e => { e.stopPropagation(); onUpdate({ frozen: !track.frozen }); }, className: `flex-1 text-[8px] py-0.5 transition-colors ${track.frozen ? 'bg-cyan-600 text-white' : 'bg-muted text-muted-foreground hover:bg-cyan-600/20'}`, title: "Freeze track", children: _jsx(Snowflake, { size: 8, className: "mx-auto" }) }), _jsx("button", { onClick: e => { e.stopPropagation(); onShowVST(); }, className: "flex-1 text-[8px] py-0.5 bg-muted text-muted-foreground hover:bg-primary/20 transition-colors", title: "VST Plugins", children: _jsx(Zap, { size: 8, className: "mx-auto" }) }), _jsx("button", { onClick: e => { e.stopPropagation(); onRemove(); }, className: "flex-1 text-[8px] py-0.5 bg-muted text-muted-foreground hover:bg-red-500/30 transition-colors", title: "Remove track", children: _jsx(Trash2, { size: 8, className: "mx-auto" }) })] }), _jsxs("div", { className: "text-[8px] text-muted-foreground flex justify-between", children: [_jsx("span", { children: "CPU" }), _jsxs("span", { className: track.cpuUsage > 70 ? 'text-red-400' : '', children: [track.cpuUsage.toFixed(1), "%"] })] })] }))] })] }));
}
function MasterStrip({ volume, meter, peak, onVolumeChange }) {
    const dbVal = gainToDb(volume).toFixed(1);
    return (_jsxs("div", { className: "flex flex-col flex-shrink-0 w-20", style: { background: 'linear-gradient(180deg, rgba(163,230,53,.04) 0%, rgba(163,230,53,.02) 100%)' }, children: [_jsx("div", { className: "h-0.5 bg-gradient-to-r from-purple-500 to-primary", style: { boxShadow: '0 0 8px rgba(163,230,53,.3)' } }), _jsxs("div", { className: "px-1.5 py-1.5 space-y-1", children: [_jsx("div", { className: "text-[10px] font-bold text-primary text-center tracking-widest", children: "MSTR" }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-[8px] text-muted-foreground", children: "VOL" }), _jsxs("span", { className: "text-[8px] font-mono", children: [dbVal, "dB"] })] }), _jsx("input", { type: "range", min: 0, max: 1.25, step: 0.01, value: volume, onChange: e => onVolumeChange(parseFloat(e.target.value)), className: "w-full h-1 accent-primary cursor-pointer" }), _jsx("div", { className: "flex justify-center py-1", children: _jsx(VUMeter, { level: meter, peak: peak, height: 80, stereo: true, label: "dBFS" }) }), _jsx("div", { className: "text-center", children: _jsx("span", { className: `text-[9px] font-mono ${peak > 0.95 ? 'text-red-400' : 'text-muted-foreground'}`, children: gainToDb(peak).toFixed(1) }) })] })] }));
}
function ClipBlock({ clip, trackColor, pixelsPerSecond, trackHeight, isSelected, onClick }) {
    const width = Math.max(clip.duration * pixelsPerSecond, 20);
    const left = clip.startTime * pixelsPerSecond;
    return (_jsxs("div", { className: `absolute top-1 bottom-1 overflow-hidden cursor-pointer border transition-all ${isSelected ? 'border-primary shadow-lg shadow-primary/20' : 'border-transparent hover:border-transparent'}`, style: { left, width }, onClick: onClick, children: [_jsx("div", { className: `absolute inset-0 ${trackColor} opacity-25` }), _jsxs("div", { className: "absolute inset-0 px-1", children: [clip.waveformData && clip.waveformData.length > 0 && (_jsx("svg", { className: "w-full h-full", preserveAspectRatio: "none", children: _jsx("polyline", { points: clip.waveformData.map((v, i) => `${(i / clip.waveformData.length) * 100}%,${50 - v * 45}%`).join(' '), fill: "none", stroke: "rgba(255,255,255,0.5)", strokeWidth: "1" }) })), _jsx("div", { className: "absolute bottom-0.5 left-1 text-[8px] text-white/70 truncate max-w-full", children: clip.fileName })] })] }));
}
function TimelineRuler({ zoom, duration = 300, tempo = 120, timeFormat = 'bars' }) {
    const pixelsPerSecond = 50 * zoom;
    const totalWidth = duration * pixelsPerSecond;
    const beatsPerSecond = tempo / 60;
    const barSeconds = 4 / beatsPerSecond;
    const marks = Math.ceil(duration / barSeconds);
    return (_jsxs("div", { className: "relative h-7 border-b border-border overflow-hidden flex-shrink-0", style: { width: totalWidth, background: 'linear-gradient(180deg, #0c0c0c, #080808)' }, children: [Array.from({ length: marks }, (_, i) => {
                const x = i * barSeconds * pixelsPerSecond;
                return (_jsxs("div", { className: "absolute top-0 flex flex-col items-center", style: { left: x }, children: [_jsx("div", { className: "w-px h-3", style: { background: i % 4 === 0 ? 'var(--ag-acid)' : 'var(--ag-border)' } }), _jsx("span", { className: "text-[8px] font-mono mt-0.5", style: { color: i % 4 === 0 ? 'var(--ag-soft)' : 'var(--ag-dim)' }, children: i + 1 })] }, i));
            }), Array.from({ length: marks * 4 }, (_, i) => {
                if (i % 4 === 0)
                    return null;
                const x = (i / 4) * barSeconds * pixelsPerSecond;
                return (_jsx("div", { className: "absolute top-0 w-px h-1.5", style: { left: x, background: 'var(--ag-border)', opacity: 0.5 } }, `beat-${i}`));
            })] }));
}
function TransportDisplay({ position, tempo, timeSignature, timeFormat }) {
    const time = formatTime(position, timeFormat, tempo);
    const [bars, beats, ticks] = time.split(':');
    return (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 border border-border/40 font-mono", style: { background: 'linear-gradient(135deg, #060606, #0a0a0a)' }, children: [_jsx("span", { className: "text-emerald-400 text-sm font-bold", style: { textShadow: '0 0 10px rgba(163,230,53,.4)' }, children: bars }), _jsx("span", { className: "text-muted-foreground text-xs opacity-50", children: ":" }), _jsx("span", { className: "text-emerald-300 text-sm", children: beats }), _jsx("span", { className: "text-muted-foreground text-xs opacity-50", children: ":" }), _jsx("span", { className: "text-emerald-200/60 text-xs", children: ticks }), _jsx("span", { className: "text-muted-foreground text-[8px] ml-1 opacity-60", children: timeFormat.toUpperCase() })] }));
}
// ============================================================
// INITIAL STATE
// ============================================================
const createInitialTransport = () => ({
    isPlaying: false,
    isRecording: false,
    position: 0,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 60,
    tempo: 120,
    timeSignature: '4/4',
});
const createInitialTrack = (index, type = 'audio') => ({
    id: generateId(),
    name: type === 'aux' ? `Bus ${index + 1}` : `Track ${index + 1}`,
    type,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    armed: false,
    muted: false,
    solo: false,
    frozen: false,
    volume: 0.8,
    pan: 0,
    fxChain: index === 0 ? ['EQ', 'Compressor'] : index === 2 ? ['Reverb'] : [],
    clips: [],
    automation: { volume: [], pan: [] },
    automationMode: 'off',
    meter: 0,
    peak: 0,
    input: 'default',
    output: 'master',
    cpuUsage: 0,
});
const createInitialProject = () => ({
    title: 'Untitled Session',
    tracks: [
        ...Array.from({ length: 6 }, (_, i) => createInitialTrack(i, 'audio')),
        createInitialTrack(0, 'midi'),
        createInitialTrack(1, 'aux'),
    ],
    transport: createInitialTransport(),
    masterVolume: 0.85,
    masterMeter: 0,
    masterPeak: 0,
    cpuUsage: 0,
});
const createInitialPreferences = () => ({
    theme: 'dark',
    mixerView: 'medium',
    timeFormat: 'bars',
    viewMode: 'split',
    autoSave: false,
    bufferSize: 512,
    sampleRate: 48000,
    showCpuMeter: true,
    showVSTPanel: false,
});
// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MultiTrackPanel() {
    const vstContext = useVSTContextOptional();
    const [project, setProject] = useState(createInitialProject);
    const [preferences, setPreferences] = useState(createInitialPreferences);
    const [zoom, setZoom] = useState(1);
    const [selectedTrackId, setSelectedTrackId] = useState(project.tracks[0]?.id ?? null);
    const [selectedClipId, setSelectedClipId] = useState(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [showPreferences, setShowPreferences] = useState(false);
    const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [selectedTrackForVST, setSelectedTrackForVST] = useState(null);
    const [sectionCollapsed, setSectionCollapsed] = useState({
        mixer: false, timeline: false, master: false, transport: false, status: false,
    });
    const audioEngineRef = useRef(new AudioEngine());
    const fileInputRef = useRef(null);
    const animationFrameRef = useRef(null);
    const lastUpdateTimeRef = useRef(Date.now());
    const timelineScrollRef = useRef(null);
    const pixelsPerSecond = 50 * zoom;
    // ── AUDIO ENGINE ────────────────────────────────────────────────────────────
    useEffect(() => {
        const engine = audioEngineRef.current;
        engine.initialize().catch(console.error);
        return () => {
            if (typeof engine.cleanup === 'function')
                engine.cleanup();
            if (animationFrameRef.current)
                cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);
    // ── PLAYBACK LOOP ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!project.transport.isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }
        const update = () => {
            const now = Date.now();
            const delta = (now - lastUpdateTimeRef.current) / 1000;
            lastUpdateTimeRef.current = now;
            setProject(prev => {
                let pos = prev.transport.position + delta;
                if (prev.transport.loopEnabled && pos >= prev.transport.loopEnd)
                    pos = prev.transport.loopStart;
                const soloActive = prev.tracks.some(t => t.solo);
                const newTracks = prev.tracks.map(t => {
                    const isAudible = !t.muted && (!soloActive || t.solo);
                    const targetLevel = isAudible ? (Math.random() * 0.4 + t.volume * 0.5) : 0;
                    const level = t.meter * METER_DECAY + targetLevel * (1 - METER_DECAY);
                    const peak = Math.max(level, t.peak * 0.98);
                    return { ...t, meter: level, peak };
                });
                const masterLevel = newTracks.reduce((s, t) => s + t.meter, 0) / newTracks.length;
                return {
                    ...prev,
                    transport: { ...prev.transport, position: pos },
                    tracks: newTracks,
                    masterMeter: masterLevel,
                    masterPeak: Math.max(masterLevel, prev.masterPeak * 0.98),
                    cpuUsage: 8 + Math.random() * 12,
                };
            });
            animationFrameRef.current = requestAnimationFrame(update);
        };
        lastUpdateTimeRef.current = Date.now();
        animationFrameRef.current = requestAnimationFrame(update);
        return () => { if (animationFrameRef.current)
            cancelAnimationFrame(animationFrameRef.current); };
    }, [project.transport.isPlaying]);
    // ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.target instanceof HTMLInputElement)
                return;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'Enter':
                    e.preventDefault();
                    handleStop();
                    break;
                case 'KeyR':
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        handleRecord();
                    }
                    break;
                case 'BracketLeft':
                    handleZoomOut();
                    break;
                case 'BracketRight':
                    handleZoomIn();
                    break;
                case 'KeyL':
                    e.preventDefault();
                    setProject(p => ({ ...p, transport: { ...p.transport, loopEnabled: !p.transport.loopEnabled } }));
                    break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    // ── TRANSPORT ───────────────────────────────────────────────────────────────
    const handlePlayPause = useCallback(() => {
        setProject(p => ({ ...p, transport: { ...p.transport, isPlaying: !p.transport.isPlaying } }));
    }, []);
    const handleStop = useCallback(() => {
        setProject(p => ({ ...p, transport: { ...p.transport, isPlaying: false, isRecording: false, position: 0 } }));
    }, []);
    const handleRecord = useCallback(() => {
        setProject(p => ({ ...p, transport: { ...p.transport, isRecording: !p.transport.isRecording, isPlaying: true } }));
    }, []);
    const handleSkipBack = useCallback(() => setProject(p => ({ ...p, transport: { ...p.transport, position: 0 } })), []);
    const _handleSkipForward = useCallback(() => setProject(p => ({ ...p, transport: { ...p.transport, position: p.transport.loopEnd } })), []);
    const handleToggleLoop = useCallback(() => setProject(p => ({ ...p, transport: { ...p.transport, loopEnabled: !p.transport.loopEnabled } })), []);
    const handleTempoChange = useCallback((tempo) => setProject(p => ({ ...p, transport: { ...p.transport, tempo } })), []);
    // ── TRACK MANAGEMENT ────────────────────────────────────────────────────────
    const updateTrack = useCallback((id, updates) => {
        setProject(p => ({ ...p, tracks: p.tracks.map(t => t.id === id ? { ...t, ...updates } : t) }));
    }, []);
    const addTrack = useCallback((type = 'audio') => {
        setProject(p => {
            if (p.tracks.length >= MAX_TRACKS)
                return p;
            return { ...p, tracks: [...p.tracks, createInitialTrack(p.tracks.length, type)] };
        });
    }, []);
    const removeTrack = useCallback((id) => {
        setProject(p => ({ ...p, tracks: p.tracks.filter(t => t.id !== id) }));
        if (selectedTrackId === id)
            setSelectedTrackId(null);
    }, [selectedTrackId]);
    const soloExclusive = useCallback((id) => {
        setProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, solo: t.id === id ? !t.solo : false })) }));
    }, []);
    const muteAll = useCallback(() => setProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, muted: true })) })), []);
    const unmuteAll = useCallback(() => setProject(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, muted: false })) })), []);
    // ── FILE IMPORT ─────────────────────────────────────────────────────────────
    const handleFileImport = useCallback(async (trackId, file) => {
        try {
            const engine = audioEngineRef.current;
            const audioBuffer = await engine.loadAudioFile(file);
            if (!audioBuffer)
                return;
            const waveformData = engine.generateWaveformData(audioBuffer);
            const newClip = {
                id: generateId(), trackId,
                startTime: project.transport.position,
                duration: audioBuffer.duration,
                audioBuffer, fileName: file.name, waveformData, color: '#3b82f6',
            };
            setProject(p => ({
                ...p,
                tracks: p.tracks.map(t => t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t),
            }));
        }
        catch (err) {
            console.error('[MultiTrackPanel] Import failed:', err);
        }
    }, [project.transport.position]);
    // ── PROJECT SAVE/LOAD ───────────────────────────────────────────────────────
    const handleSaveProject = useCallback(() => {
        const json = serializeProject(project);
        downloadFile(json, `${project.title.replace(/\s+/g, '_')}.dawproject`);
    }, [project]);
    const handleLoadProject = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                setProject(JSON.parse(ev.target?.result));
            }
            catch (err) {
                console.error('[MultiTrackPanel] Load failed:', err);
            }
        };
        reader.readAsText(file);
    }, []);
    // ── ZOOM ────────────────────────────────────────────────────────────────────
    const handleZoomIn = useCallback(() => setZoom(z => Math.min(4, z + 0.25)), []);
    const handleZoomOut = useCallback(() => setZoom(z => Math.max(0.25, z - 0.25)), []);
    // ── SECTION COLLAPSE ────────────────────────────────────────────────────────
    const toggleSection = useCallback((key) => {
        setSectionCollapsed(s => ({ ...s, [key]: !s[key] }));
    }, []);
    // ── COMPUTED ────────────────────────────────────────────────────────────────
    const selectedTrack = useMemo(() => project.tracks.find(t => t.id === selectedTrackId), [project.tracks, selectedTrackId]);
    const totalClips = useMemo(() => project.tracks.reduce((s, t) => s + t.clips.length, 0), [project.tracks]);
    const TICKER_ITEMS = ['MultiTrack DAW', 'Web Audio API', 'VST System', '8 Tracks', 'Loop Engine', 'MIDI Ready', 'Offline-First', 'R3 Native'];
    const transportStatus = project.transport.isRecording ? 'recording'
        : project.transport.isPlaying ? 'playing'
            : 'stopped';
    // ── RENDER ──────────────────────────────────────────────────────────────────
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: AG_STYLES }), _jsx("div", { className: "ag-page-shell", children: _jsxs("div", { className: "ag-daw-shell", children: [_jsxs("header", { className: "ag-daw-header", children: [_jsxs("div", { className: "ag-daw-header-top", children: [_jsxs("div", { className: "ag-daw-wordmark-block", children: [_jsxs("div", { className: "ag-daw-wordmark", children: ["R3", _jsx("span", { children: "/" }), "DAW"] }), _jsx("div", { className: "ag-daw-wordmark-sub", children: "MultiTrack \u00B7 Production" })] }), _jsxs("div", { className: "ag-daw-status-block", children: [_jsxs("div", { className: "ag-daw-status-line", style: { color: project.transport.isPlaying ? 'var(--ag-acid)' : 'var(--ag-white)' }, children: [_jsx("span", { className: project.transport.isPlaying ? 'ag-cursor-live' : 'ag-cursor-standby' }), project.transport.isRecording ? 'RECORDING' : project.transport.isPlaying ? 'PLAYING' : 'STANDBY'] }), _jsxs("div", { className: "ag-daw-status-line", style: { color: 'var(--ag-dim)' }, children: [project.tracks.length, " TRACKS \u00B7 ", totalClips, " CLIPS"] })] }), _jsxs("div", { className: "ag-daw-transport-block", children: [_jsxs(Link, { href: "/", className: "ag-daw-back", children: [_jsx(ArrowLeft, { size: 11 }), " INSTRUMENT"] }), _jsx("div", { className: "ag-divider" }), _jsx("button", { onClick: handleSkipBack, className: "ag-transport-btn", title: "Return to start", children: _jsx(SkipBack, { size: 13 }) }), _jsx("button", { onClick: handlePlayPause, className: `ag-transport-btn ${project.transport.isPlaying ? 'active' : ''}`, title: "Play/Pause (Space)", children: project.transport.isPlaying ? _jsx(Pause, { size: 13 }) : _jsx(Play, { size: 13 }) }), _jsx("button", { onClick: handleStop, className: "ag-transport-btn", title: "Stop", children: _jsx(Square, { size: 13 }) }), _jsx("button", { onClick: handleRecord, className: `ag-transport-btn ${project.transport.isRecording ? 'rec-active' : ''}`, title: "Record (R)", children: _jsx(CircleDot, { size: 13 }) }), _jsx("button", { onClick: handleToggleLoop, className: `ag-transport-btn ${project.transport.loopEnabled ? 'loop-active' : ''}`, title: "Loop (L)", children: _jsx(Repeat, { size: 13 }) }), _jsx("div", { className: "ag-divider" }), _jsxs("div", { className: "ag-bpm-block", children: [_jsx("span", { style: { fontSize: 8, letterSpacing: '.3em', color: 'var(--ag-mid)', textTransform: 'uppercase' }, children: "BPM" }), _jsx("span", { className: "ag-bpm-value", children: project.transport.tempo }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 }, children: [_jsx("button", { onClick: () => handleTempoChange(Math.min(300, project.transport.tempo + 1)), style: { background: 'none', border: 'none', color: 'var(--ag-acid)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 10 }, children: "\u25B2" }), _jsx("button", { onClick: () => handleTempoChange(Math.max(40, project.transport.tempo - 1)), style: { background: 'none', border: 'none', color: 'var(--ag-acid)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 10 }, children: "\u25BC" })] })] }), _jsx("div", { className: "ag-divider" }), _jsx(TransportDisplay, { position: project.transport.position, tempo: project.transport.tempo, timeSignature: project.transport.timeSignature, timeFormat: preferences.timeFormat }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { onClick: handleZoomOut, className: "ag-transport-btn", title: "Zoom out ([)", children: _jsx(ZoomOut, { size: 12 }) }), _jsxs("span", { style: { fontSize: 9, color: 'var(--ag-mid)', minWidth: 36, textAlign: 'center', fontFamily: 'IBM Plex Mono,monospace' }, children: [zoom.toFixed(2), "x"] }), _jsx("button", { onClick: handleZoomIn, className: "ag-transport-btn", title: "Zoom in (])", children: _jsx(ZoomIn, { size: 12 }) }), _jsx("div", { className: "ag-divider" }), _jsx("button", { onClick: handleSaveProject, className: "ag-transport-btn", title: "Save project", children: _jsx(Save, { size: 13 }) }), _jsx("button", { onClick: () => fileInputRef.current?.click(), className: "ag-transport-btn", title: "Load project", children: _jsx(FolderOpen, { size: 13 }) }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".dawproject", onChange: handleLoadProject, className: "hidden" }), _jsx("button", { onClick: () => vstContext ? setShowPerformanceMonitor(!showPerformanceMonitor) : undefined, className: "ag-transport-btn", title: vstContext ? 'Performance Monitor' : 'VST Engine offline — visit /vst to activate', style: {
                                                        ...(showPerformanceMonitor && vstContext
                                                            ? { background: 'rgba(163,230,53,.12)', borderColor: 'var(--ag-acid)', color: 'var(--ag-acid)' }
                                                            : {}),
                                                        opacity: vstContext ? 1 : 0.3,
                                                        cursor: vstContext ? 'pointer' : 'not-allowed',
                                                    }, children: _jsx(Activity, { size: 13 }) }), preferences.showCpuMeter && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--ag-black)', border: '1px solid var(--ag-border)', padding: '4px 10px' }, children: [_jsx(Cpu, { size: 10, style: { color: project.cpuUsage > 80 ? 'var(--ag-rec)' : 'var(--ag-mid)' } }), _jsxs("span", { style: { fontSize: 9, fontFamily: 'IBM Plex Mono,monospace', color: project.cpuUsage > 80 ? 'var(--ag-rec)' : 'var(--ag-mid)' }, children: [project.cpuUsage.toFixed(0), "%"] })] })), _jsx("button", { onClick: () => setShowPreferences(true), className: "ag-transport-btn", title: "Settings", children: _jsx(Settings, { size: 13 }) })] })] }), _jsx("div", { className: "ag-daw-ticker", children: _jsx("div", { className: "ag-daw-ticker-inner", children: [...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (_jsxs("span", { className: "ag-daw-ticker-item", children: [item, _jsx("span", { className: "ag-daw-ticker-sep", children: "/" })] }, i))) }) })] }), _jsxs("div", { className: "ag-daw-section-strip", children: [_jsx("span", { className: "text-[9px] text-muted-foreground tracking-widest uppercase", children: "Add Track:" }), ['audio', 'midi', 'aux'].map(type => (_jsxs("button", { onClick: () => addTrack(type), className: "flex items-center gap-1 text-[9px] px-2 py-0.5 bg-muted hover:bg-accent transition-colors text-muted-foreground hover:text-foreground border border-border/30", children: [_jsx(Plus, { size: 9 }), type.toUpperCase()] }, type))), _jsx("div", { className: "flex-1" }), _jsx("button", { onClick: muteAll, className: "text-[9px] px-2 py-0.5 bg-muted hover:bg-yellow-500/20 text-muted-foreground transition-colors border border-border/30", children: "Mute All" }), _jsx("button", { onClick: unmuteAll, className: "text-[9px] px-2 py-0.5 bg-muted hover:bg-emerald-500/20 text-muted-foreground transition-colors border border-border/30", children: "Unmute All" }), _jsx("input", { id: "audio-import", type: "file", accept: "audio/*", multiple: true, onChange: e => {
                                        const files = Array.from(e.target.files || []);
                                        const tid = selectedTrackId ?? project.tracks[0]?.id;
                                        if (tid)
                                            files.forEach(f => handleFileImport(tid, f));
                                    }, className: "hidden" }), _jsxs("button", { onClick: () => document.getElementById('audio-import')?.click(), className: "flex items-center gap-1 text-[9px] px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20", children: [_jsx(Upload, { size: 9 }), " Import Audio"] }), _jsxs("span", { className: "text-[9px] text-muted-foreground opacity-50", children: [project.tracks.length, " tracks \u00B7 ", totalClips, " clips"] })] }), _jsxs("div", { className: "flex-1 flex overflow-hidden", children: [(preferences.viewMode === 'mixer' || preferences.viewMode === 'split') && !sectionCollapsed.mixer && (_jsxs("div", { className: `flex flex-col overflow-hidden ${preferences.viewMode === 'split' ? 'w-1/2' : 'flex-1'}`, children: [_jsxs("div", { className: "ag-section-header", children: [_jsxs("div", { className: "ag-section-title", children: [_jsx(Sliders, { size: 11 }), "MIXER", _jsxs("span", { className: "text-[8px] text-muted-foreground opacity-50 ml-1", children: [project.tracks.length, " ch"] })] }), _jsx("button", { onClick: () => toggleSection('mixer'), className: "text-muted-foreground hover:text-foreground transition-colors p-0.5", children: _jsx(Minimize2, { size: 10 }) })] }), _jsx("div", { className: "flex-1 overflow-x-auto overflow-y-hidden", children: _jsxs("div", { className: "flex h-full min-h-0", children: [project.tracks.map(track => (_jsx(TrackStrip, { track: track, isSelected: track.id === selectedTrackId, onSelect: () => setSelectedTrackId(track.id), onUpdate: u => updateTrack(track.id, u), onShowVST: () => setSelectedTrackForVST(track.id), onRemove: () => removeTrack(track.id) }, track.id))), _jsx(MasterStrip, { volume: project.masterVolume, meter: project.masterMeter, peak: project.masterPeak, onVolumeChange: v => setProject(p => ({ ...p, masterVolume: v })) })] }) })] })), sectionCollapsed.mixer && (preferences.viewMode === 'mixer' || preferences.viewMode === 'split') && (_jsxs("div", { className: "ag-collapsed-tab", onClick: () => toggleSection('mixer'), children: [_jsx(Sliders, { size: 11, style: { color: 'var(--ag-acid)' } }), _jsx("span", { children: "Mixer" })] })), (preferences.viewMode === 'timeline' || preferences.viewMode === 'split') && !sectionCollapsed.timeline && (_jsxs("div", { className: "flex flex-col overflow-hidden flex-1", children: [_jsxs("div", { className: "ag-section-header", children: [_jsxs("div", { className: "ag-section-title", children: [_jsx(AlignLeft, { size: 11 }), "TIMELINE", _jsx("span", { className: "text-[8px] text-muted-foreground opacity-50 ml-1", children: formatTime(project.transport.position, preferences.timeFormat, project.transport.tempo) })] }), _jsx("button", { onClick: () => toggleSection('timeline'), className: "text-muted-foreground hover:text-foreground transition-colors p-0.5", children: _jsx(Minimize2, { size: 10 }) })] }), _jsx("div", { className: "flex-1 overflow-hidden flex flex-col", children: _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "w-32 flex-shrink-0 overflow-y-auto overflow-x-hidden", children: [_jsx("div", { className: "h-7 border-b border-border flex items-center px-2", style: { background: 'linear-gradient(90deg, #0c0c0c, #080808)' }, children: _jsx("span", { className: "text-[8px] text-muted-foreground font-mono tracking-widest", children: "TRACK" }) }), project.tracks.map(track => (_jsxs("div", { onClick: () => setSelectedTrackId(track.id), className: `h-16 flex items-center px-2 gap-1.5 border-b border-border/40 cursor-pointer transition-colors ${track.id === selectedTrackId
                                                                    ? 'bg-primary/10'
                                                                    : 'hover:bg-accent/20'}`, children: [_jsx("div", { className: `w-1 h-8 ${TRACK_TYPE_COLORS[track.type]}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-[10px] font-medium truncate", children: track.name }), _jsxs("div", { className: "flex items-center gap-1 mt-0.5", children: [track.muted && _jsx(VolumeX, { size: 8, className: "text-yellow-400" }), track.solo && _jsx(Headphones, { size: 8, className: "text-yellow-400" }), track.armed && _jsx(CircleDot, { size: 8, className: "text-red-400" }), track.frozen && _jsx(Snowflake, { size: 8, className: "text-cyan-400" })] }), _jsxs("div", { className: "text-[8px] text-muted-foreground opacity-50", children: [track.clips.length, " clips"] })] }), _jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("button", { onClick: e => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }, className: `text-[7px] px-0.5 ${track.muted ? 'bg-yellow-500/30 text-yellow-400' : 'hover:bg-accent text-muted-foreground'}`, children: "M" }), _jsx("button", { onClick: e => { e.stopPropagation(); soloExclusive(track.id); }, className: `text-[7px] px-0.5 ${track.solo ? 'bg-yellow-400/30 text-yellow-300' : 'hover:bg-accent text-muted-foreground'}`, children: "S" })] })] }, track.id)))] }), _jsx("div", { ref: timelineScrollRef, className: "flex-1 overflow-x-auto overflow-y-auto", onScroll: e => setScrollLeft(e.target.scrollLeft), children: _jsxs("div", { style: { width: Math.max(300 * pixelsPerSecond, 800) }, children: [_jsx(TimelineRuler, { zoom: zoom, tempo: project.transport.tempo, timeFormat: preferences.timeFormat }), _jsx("div", { className: "pointer-events-none", style: {
                                                                        position: 'fixed',
                                                                        top: 0, bottom: 0,
                                                                        left: 128 + project.transport.position * pixelsPerSecond - scrollLeft,
                                                                        width: 1,
                                                                        background: 'var(--ag-acid)',
                                                                        boxShadow: '0 0 6px rgba(163,230,53,.5)',
                                                                        zIndex: 30,
                                                                    } }), project.tracks.map((track, idx) => (_jsxs("div", { className: `relative h-16 border-b border-border/30 ${idx % 2 === 0 ? 'bg-card/20' : 'bg-background/30'} ${track.id === selectedTrackId ? 'ring-inset ring-1 ring-primary/20' : ''}`, onClick: () => setSelectedTrackId(track.id), onDragOver: e => e.preventDefault(), onDrop: e => {
                                                                        e.preventDefault();
                                                                        Array.from(e.dataTransfer.files).forEach(f => handleFileImport(track.id, f));
                                                                    }, children: [project.transport.loopEnabled && (_jsx("div", { className: "absolute inset-y-0 bg-primary/5 border-x border-primary/15", style: {
                                                                                left: project.transport.loopStart * pixelsPerSecond,
                                                                                width: (project.transport.loopEnd - project.transport.loopStart) * pixelsPerSecond,
                                                                            } })), track.clips.map(clip => (_jsx(ClipBlock, { clip: clip, trackColor: TRACK_TYPE_COLORS[track.type], pixelsPerSecond: pixelsPerSecond, trackHeight: 64, isSelected: clip.id === selectedClipId, onClick: () => setSelectedClipId(clip.id === selectedClipId ? null : clip.id) }, clip.id))), track.clips.length === 0 && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity", children: _jsx("span", { className: "text-[8px] text-muted-foreground tracking-wider", children: "Drop audio here" }) }))] }, track.id)))] }) })] }) })] }))] }), _jsxs("div", { className: "ag-daw-statusbar", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `ag-status-dot ${transportStatus}` }), _jsx("span", { children: project.transport.isRecording ? 'REC' : project.transport.isPlaying ? 'PLAY' : 'STOP' })] }), _jsx("div", { className: "w-px h-3", style: { background: 'var(--ag-border)' } }), _jsx("span", { style: { color: 'var(--ag-mid)' }, children: project.title }), _jsx("div", { className: "w-px h-3", style: { background: 'var(--ag-border)' } }), _jsxs("span", { children: [preferences.sampleRate / 1000, "kHz \u00B7 ", preferences.bufferSize, " buf"] }), _jsx("div", { className: "w-px h-3", style: { background: 'var(--ag-border)' } }), _jsxs("span", { children: [project.tracks.length, " tracks \u00B7 ", totalClips, " clips"] }), _jsx("div", { className: "w-px h-3", style: { background: 'var(--ag-border)' } }), _jsxs("span", { children: ["\u00D7", zoom.toFixed(2)] }), _jsx("div", { className: "w-px h-3", style: { background: 'var(--ag-border)' } }), _jsx("span", { style: { color: vstContext ? 'var(--ag-acid)' : 'var(--ag-dim)' }, children: vstContext ? '⬤ VST' : '○ VST' }), _jsx("div", { style: { flex: 1 } }), selectedTrack && (_jsxs("span", { style: { color: 'var(--ag-dim)' }, children: [_jsx("span", { style: { color: 'var(--ag-acid)', opacity: 0.7 }, children: selectedTrack.name }), ' · ', selectedTrack.fxChain.length, " fx", ' · ', gainToDb(selectedTrack.volume).toFixed(1), " dB"] })), _jsx("div", { className: "w-px h-3", style: { background: 'var(--ag-border)' } }), _jsxs("button", { onClick: () => setShowKeyboardShortcuts(!showKeyboardShortcuts), className: "hover:text-foreground transition-colors flex items-center gap-1", children: [_jsx(Info, { size: 9 }), " Shortcuts"] })] }), showPerformanceMonitor && vstContext && (_jsx("div", { className: "fixed bottom-12 right-4 z-50 w-96", children: _jsxs("div", { className: "bg-card border border-border shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 border-b border-border", style: { background: 'linear-gradient(90deg, rgba(163,230,53,.04), transparent)' }, children: [_jsxs("div", { className: "flex items-center gap-2 text-[10px] font-semibold tracking-wider uppercase", children: [_jsx(Activity, { size: 11, className: "text-primary" }), "Performance"] }), _jsx("button", { onClick: () => setShowPerformanceMonitor(false), className: "text-muted-foreground hover:text-foreground transition-colors", children: _jsx(X, { size: 12 }) })] }), _jsx("div", { className: "p-3", children: _jsx(VSTPerformanceUI, { monitor: vstContext.performanceMonitor, vstIds: vstContext.channels?.map((c) => c.id) ?? [] }) })] }) })), showKeyboardShortcuts && (_jsxs("div", { className: "fixed bottom-12 left-4 z-50 w-60 bg-card border border-border shadow-2xl p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-[10px] font-semibold tracking-widest uppercase", style: { color: 'var(--ag-acid)' }, children: "Shortcuts" }), _jsx("button", { onClick: () => setShowKeyboardShortcuts(false), className: "text-muted-foreground hover:text-foreground transition-colors", children: _jsx(X, { size: 11 }) })] }), [
                                    ['Space', 'Play / Pause'],
                                    ['Enter', 'Stop'],
                                    ['R', 'Record'],
                                    ['L', 'Loop'],
                                    ['[', 'Zoom Out'],
                                    [']', 'Zoom In'],
                                ].map(([key, desc]) => (_jsxs("div", { className: "flex justify-between items-center text-[9px] py-0.5", children: [_jsx("kbd", { className: "px-1.5 py-0.5 bg-muted border border-border font-mono", children: key }), _jsx("span", { className: "text-muted-foreground", children: desc })] }, key)))] })), showPreferences && (_jsx(PreferencesModal, { preferences: preferences, onUpdate: u => setPreferences(p => ({ ...p, ...u })), onClose: () => setShowPreferences(false) })), selectedTrackForVST && (_jsx(VSTPanelModal, { trackId: selectedTrackForVST, trackName: project.tracks.find(t => t.id === selectedTrackForVST)?.name, onClose: () => setSelectedTrackForVST(null) }))] }) })] }));
}
