/**
 * WaveLabProduction — R3 v4 Multitrack DAW Page
 *
 * Wire.txt Protocol:
 *   FILES READ: instrument.tsx (full 1617 lines), CLAUDE.md, WIRE.txt,
 *               PRIORITIES.md, R3v4_PRD_v4.docx, asi_enhanced.md
 *
 *   FINDINGS:
 *   - instrument.tsx uses --ag-* CSS variables, IBM Plex Mono + Syne fonts,
 *     ag-shell/ag-frame shell, acid (#a3e635) as primary accent, zero border-radius.
 *   - CLAUDE.md: no @ts-nocheck, no any, no console.log, no localStorage,
 *     Zustand state, Wouter routing.
 *   - PRIORITIES.md P4: Mix Suggestion System frontend wiring.
 *   - appRouter has: sessions, sessionMetrics, daw, mixer, dj, aiMix, projects.
 *
 *   CHANGES:
 *   - Adopted ag-shell/ag-frame/ag-header/ag-ticker/ag-content layout exactly.
 *   - Replaced all C.* tokens with --ag-* CSS variables.
 *   - Dual-canvas architecture: staticRef (clips/tracks) + dynRef (playhead RAF).
 *   - Full drag-move + resize-l/r via dragRef (no re-render during drag).
 *   - History via histRef/histIdxRef refs (no stale closures).
 *   - VU meters on 80ms interval during transport.
 *   - Minimap canvas with click-to-scroll.
 *   - Clip Inspector + Activity panels in right column.
 *   - Mix Suggestions panel (LLPTE aiMix route surface — P4).
 *   - All types explicit — zero `any`, zero @ts-nocheck.
 *   - ResizeObserver replaces getBoundingClientRect.
 *   - All keyboard handlers use actionRef pattern (stable, empty deps).
 *
 * @module pages/multitrack
 */

import {
  useState, useEffect, useRef, useCallback, useMemo, type ReactNode,
} from 'react';
import { Link } from 'wouter';
import {
  Activity, Layers, Sliders, Wand2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Track {
  id: number;
  index: number;
  name: string;
  type: 'audio' | 'synth' | 'fx' | 'midi';
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
}

interface Clip {
  id: number;
  trackId: number;
  startBeat: number;
  lenBeats: number;
  name: string;
  color: string;
}

interface Marker {
  id: number;
  beat: number;
  label: string;
  color: string;
}

interface LoopRegion {
  active: boolean;
  startBeat: number;
  endBeat: number;
}

interface Collaborator {
  id: number;
  name: string;
  beat: number;
  color: string;
}

interface MixSuggestion {
  id: number;
  type: 'level' | 'eq' | 'transition' | 'pan';
  target: string;
  description: string;
  confidence: number;
  applied: boolean;
}

interface ActivityEntry {
  id: number;
  user: string;
  action: string;
  ts: number;
}

interface Project {
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  bpm: number;
  beatsPerBar: number;
  scrollX: number;
  zoom: number;
}

interface SelectionState {
  selClipId: number | null;
  hovClipId: number | null;
}

interface DragState {
  type: 'move' | 'resize-l' | 'resize-r' | 'scrub';
  clipId: number;
  startX: number;
  startBeat: number;
  startLen: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TL = {
  HEADER_H: 28,
  TRACK_H: 72,
  LABEL_W: 152,
  MM_H: 28,
  MIN_CLIP_PX: 16,
} as const;

type TransportState = 'stopped' | 'playing' | 'recording';

const SNAP_VALUES = [1, 0.5, 0.25, 0.125] as const;
type SnapValue = (typeof SNAP_VALUES)[number];

const TICKER_ITEMS = [
  'MultiTrack DAW', 'LLPTE Pipeline', 'AI Auto-Level', 'Smart Transitions',
  'Time Savings', 'Mix Suggestions', 'Real-Time Collab', 'Acid Grid',
  'Web Audio API', 'WebMIDI', 'R3 v4',
];

// ─── CSS ──────────────────────────────────────────────────────────────────────

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

/* ── Variables (exact match to instrument.tsx) ──────────────────────────── */
:root {
  --ag-black:  #060606;
  --ag-ink:    #0a0a0a;
  --ag-panel:  #0d0d0d;
  --ag-card:   #0f0f0f;
  --ag-border: #1c1c1c;
  --ag-mute:   #2a2a2a;
  --ag-dim:    #3a3a3a;
  --ag-mid:    #666;
  --ag-soft:   #888;
  --ag-acid:   #a3e635;
  --ag-acid2:  #84cc16;
  --ag-acid-d: #4d6b18;
  --ag-white:  #f0f0f0;
  --ag-err:    #ff3b3b;
  --ag-rec:    #ef4444;
  --ag-cyan:   #22d3ee;
  --ag-amber:  #fbbf24;
  --ag-purp:   #a78bfa;
  --ag-teal:   #2dd4bf;
}

/* ── Shell ─────────────────────────────────────────────────────────────── */
.ag-shell {
  height: calc(100vh - var(--nav-h, 0px)); overflow: hidden; display: flex; flex-direction: column;
  background: var(--ag-black);
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,.012) 3px, rgba(255,255,255,.012) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,.016) 31px, rgba(255,255,255,.016) 32px);
  font-family: 'IBM Plex Mono', monospace;
}

/* ── Frame ─────────────────────────────────────────────────────────────── */
.ag-frame {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  overflow: hidden; position: relative;
  border-left: 3px solid var(--ag-border);
  border-right: 3px solid var(--ag-border);
}
.ag-frame::before {
  content: ''; position: absolute; left: -3px; top: 0; bottom: 0; width: 3px;
  background: var(--ag-acid);
  box-shadow: 0 0 18px var(--ag-acid), 0 0 40px rgba(163,230,53,.3);
}

/* ── Header ────────────────────────────────────────────────────────────── */
.ag-header {
  border-bottom: 3px solid var(--ag-border); position: relative;
  overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.6); flex-shrink: 0;
}
.ag-header-top { display: flex; align-items: stretch; border-bottom: 1px solid var(--ag-border); }

.ag-ghost-bpm {
  position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: clamp(80px, 12vw, 140px); color: transparent;
  -webkit-text-stroke: 1px rgba(163,230,53,.055);
  letter-spacing: -.04em; pointer-events: none; user-select: none; z-index: 0;
}

.ag-wordmark-block {
  padding: 14px 24px 12px; border-right: 1px solid var(--ag-border);
  display: flex; flex-direction: column; justify-content: center;
  min-width: 200px; position: relative; z-index: 1;
}
.ag-wordmark {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 26px;
  letter-spacing: -.02em; color: var(--ag-white); line-height: 1;
}
.ag-wordmark-slash { color: var(--ag-acid); margin: 0 4px; font-size: 32px; line-height: .9; text-shadow: 0 0 12px var(--ag-acid); }
.ag-wordmark-sub { font-size: 8px; letter-spacing: .35em; text-transform: uppercase; color: var(--ag-white); margin-top: 5px; }

.ag-status-block {
  padding: 14px 20px; border-right: 1px solid var(--ag-border);
  display: flex; flex-direction: column; justify-content: center; gap: 5px; z-index: 1;
}
.ag-status-line { font-size: 9px; letter-spacing: .2em; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ag-cursor-live { display: inline-block; width: 8px; height: 14px; background: var(--ag-acid); box-shadow: 0 0 8px var(--ag-acid); animation: ag-blink 1s step-end infinite; }
.ag-cursor-rec  { display: inline-block; width: 8px; height: 14px; background: var(--ag-rec); box-shadow: 0 0 8px var(--ag-rec); animation: ag-blink .8s step-end infinite; }
.ag-cursor-standby { display: inline-block; width: 8px; height: 14px; background: var(--ag-mute); }
@keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
.ag-status-live-text { color: var(--ag-acid); }
.ag-status-rec-text  { color: var(--ag-rec); }
.ag-status-dead-text { color: var(--ag-white); }

.ag-bpm-block { padding: 0 20px; display: flex; align-items: center; gap: 12px; z-index: 1; }
.ag-bpm-label { font-size: 8px; letter-spacing: .3em; color: var(--ag-white); text-transform: uppercase; writing-mode: vertical-rl; transform: rotate(180deg); }
.ag-bpm-number {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 42px;
  letter-spacing: -.04em; color: var(--ag-acid); line-height: 1;
  text-shadow: 0 0 20px rgba(163,230,53,.4), 0 0 40px rgba(163,230,53,.15);
}
.ag-bpm-input {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 42px;
  letter-spacing: -.04em; color: var(--ag-acid); line-height: 1; width: 80px;
  background: transparent; border: none; outline: none; text-align: center;
}

.ag-controls-block { flex: 1; padding: 10px 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; z-index: 1; justify-content: flex-end; }
.ag-nav-btn {
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  background: transparent; border: 1px solid var(--ag-border); padding: 7px 14px;
  color: var(--ag-white); cursor: pointer; transition: all .1s;
  text-decoration: none; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
}
.ag-nav-btn:hover { background: var(--ag-acid); border-color: var(--ag-acid); color: var(--ag-black); }
.ag-nav-btn.active { background: var(--ag-acid); border-color: var(--ag-acid); color: var(--ag-black); box-shadow: 0 0 12px rgba(163,230,53,.3); }
.ag-nav-btn.rec-btn.armed { background: var(--ag-rec); border-color: var(--ag-rec); color: var(--ag-white); box-shadow: 0 0 12px rgba(239,68,68,.4); animation: ag-blink .8s step-end infinite; }

/* ── Ticker ─────────────────────────────────────────────────────────────── */
.ag-ticker-row { padding: 5px 0; background: var(--ag-ink); overflow: hidden; position: relative; flex-shrink: 0; }
.ag-ticker-row::before, .ag-ticker-row::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 40px; z-index: 2;
}
.ag-ticker-row::before { left: 0; background: linear-gradient(90deg, var(--ag-ink), transparent); }
.ag-ticker-row::after  { right: 0; background: linear-gradient(-90deg, var(--ag-ink), transparent); }
.ag-ticker-inner { display: flex; width: max-content; animation: ag-scroll 32s linear infinite; }
@keyframes ag-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
.ag-ticker-item { font-size: 9px; letter-spacing: .25em; text-transform: uppercase; color: var(--ag-white); padding: 0 24px; white-space: nowrap; display: flex; align-items: center; gap: 12px; }
.ag-ticker-sep { color: var(--ag-acid); font-size: 11px; }

/* ── Content grid ──────────────────────────────────────────────────────── */
.ag-content { display: grid; grid-template-columns: 1fr; flex: 1; overflow: hidden; min-height: 0; }
@media(min-width:1024px) { .ag-content { grid-template-columns: 1fr 420px; } }
@media(min-width:1440px) { .ag-content { grid-template-columns: 1fr 480px; } }
@media(min-width:1800px) { .ag-content { grid-template-columns: 1fr 560px; } }

.ag-left  { display: flex; flex-direction: column; overflow: hidden; min-height: 0; height: 100%; }
.ag-right { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; height: 100%; }
@media(min-width:1024px){ .ag-left { border-right: 3px solid var(--ag-border); } }

.ag-section-strip {
  background: var(--ag-ink); border-top: 3px solid var(--ag-border);
  border-bottom: 1px solid var(--ag-border); padding: 5px 20px;
  display: flex; align-items: center; gap: 10px;
  border-left: 3px solid var(--ag-acid);
  box-shadow: inset 0 0 20px rgba(163,230,53,.03); flex-shrink: 0;
}
.ag-section-tag { font-size: 8px; letter-spacing: .35em; text-transform: uppercase; color: var(--ag-white); }
.ag-section-line { flex: 1; height: 1px; background: var(--ag-border); }
.ag-section-tag-r { font-size: 8px; letter-spacing: .2em; text-transform: uppercase; color: var(--ag-mid); margin-left: 8px; }

.ag-panel { position: relative; border-bottom: 1px solid var(--ag-border); }
.ag-panel-ghost {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 72px;
  color: transparent; -webkit-text-stroke: 1px rgba(163,230,53,.07);
  line-height: 1; pointer-events: none; user-select: none; z-index: 0;
}
.ag-panel-header {
  background: var(--ag-ink); border-bottom: 1px solid var(--ag-border);
  padding: 7px 16px; display: flex; align-items: center; gap: 10px;
  cursor: pointer; transition: background .1s; position: relative; z-index: 1;
  user-select: none;
}
.ag-panel-header:hover { background: var(--ag-acid); color: var(--ag-black); }
.ag-panel-header:hover .ag-ph-title,
.ag-panel-header:hover .ag-ph-badge,
.ag-panel-header:hover svg { color: var(--ag-black) !important; }
.ag-panel-header.open { border-left: 3px solid var(--ag-acid); box-shadow: inset 0 0 12px rgba(163,230,53,.06); }
.ag-panel-header.open .ag-ph-title { color: var(--ag-acid); }
.ag-ph-icon { color: var(--ag-mid); flex-shrink: 0; }
.ag-ph-title { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--ag-white); }
.ag-ph-badge { font-size: 8px; letter-spacing: .15em; text-transform: uppercase; color: var(--ag-mid); margin-left: auto; }
.ag-ph-chevron { font-size: 10px; color: var(--ag-mid); margin-left: 8px; transition: transform .15s; }
.ag-ph-chevron.open { transform: rotate(90deg); color: var(--ag-acid); }

/* ── Timeline canvas area ───────────────────────────────────────────────── */
.ag-timeline-wrap {
  flex: 1; position: relative; overflow: hidden; cursor: crosshair;
  background: var(--ag-black);
  background-image: repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(163,230,53,.018) 79px, rgba(163,230,53,.018) 80px);
}
.ag-canvas-static, .ag-canvas-dyn {
  position: absolute; top: 0; left: 0; width: 100%;
}
.ag-canvas-dyn { pointer-events: none; }

/* ── Scrollbar ──────────────────────────────────────────────────────────── */
.ag-scroll-row { height: 10px; background: var(--ag-ink); border-top: 1px solid var(--ag-border); flex-shrink: 0; }
.ag-scroll-row input[type="range"] { width: 100%; height: 10px; margin: 0; accent-color: var(--ag-acid); background: transparent; }

/* ── Minimap ────────────────────────────────────────────────────────────── */
.ag-minimap { display: block; cursor: pointer; flex-shrink: 0; border-top: 1px solid var(--ag-border); }

/* ── Transport toolbar ──────────────────────────────────────────────────── */
.ag-transport {
  background: var(--ag-ink); border-bottom: 1px solid var(--ag-border);
  padding: 6px 14px; display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap;
}
.ag-t-btn {
  font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .12em;
  text-transform: uppercase; background: transparent; border: 1px solid var(--ag-border);
  color: var(--ag-white); padding: 5px 12px; cursor: pointer; transition: all .08s;
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
}
.ag-t-btn:hover { background: var(--ag-acid); border-color: var(--ag-acid); color: var(--ag-black); }
.ag-t-btn.active { background: rgba(163,230,53,.12); border-color: var(--ag-acid); color: var(--ag-acid); box-shadow: 0 0 10px rgba(163,230,53,.2); }
.ag-t-btn.danger  { color: var(--ag-rec); border-color: rgba(239,68,68,.4); }
.ag-t-btn.danger:hover { background: var(--ag-rec); border-color: var(--ag-rec); color: var(--ag-white); }
.ag-t-btn.danger.armed { background: rgba(239,68,68,.12); border-color: var(--ag-rec); color: var(--ag-rec); animation: ag-blink .8s step-end infinite; }
.ag-t-sep { width: 1px; height: 20px; background: var(--ag-border); margin: 0 4px; flex-shrink: 0; }
.ag-t-display {
  font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600;
  color: var(--ag-acid); background: var(--ag-black); padding: 3px 10px;
  border: 1px solid var(--ag-border); letter-spacing: .08em; min-width: 64px; text-align: center;
}
.ag-t-snap-group { display: flex; gap: 0; border: 1px solid var(--ag-border); }
.ag-t-snap-group .ag-t-btn { border: none; border-right: 1px solid var(--ag-border); }
.ag-t-snap-group .ag-t-btn:last-child { border-right: none; }
.ag-t-label { font-size: 8px; letter-spacing: .2em; text-transform: uppercase; color: var(--ag-mid); }
.ag-t-spacer { flex: 1; }

/* ── Right panels ───────────────────────────────────────────────────────── */
.ag-panel-tabs { display: flex; border-bottom: 1px solid var(--ag-border); background: var(--ag-ink); flex-shrink: 0; }
.ag-tab-btn {
  flex: 1; padding: 7px 0; font-family: 'IBM Plex Mono', monospace; font-size: 9px;
  letter-spacing: .12em; text-transform: uppercase; background: transparent;
  color: var(--ag-mid); border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all .1s;
}
.ag-tab-btn:hover { color: var(--ag-white); background: rgba(163,230,53,.04); }
.ag-tab-btn.active { color: var(--ag-acid); border-bottom-color: var(--ag-acid); background: var(--ag-panel); }

.ag-panel-body { flex: 1; overflow-y: auto; }

/* ── Inspector ──────────────────────────────────────────────────────────── */
.ag-insp { padding: 14px; }
.ag-insp-section { margin-bottom: 16px; }
.ag-insp-title {
  font-size: 8px; letter-spacing: .3em; text-transform: uppercase;
  color: var(--ag-acid); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
}
.ag-insp-title::after { content:''; flex:1; height:1px; background:var(--ag-acid-d); }
.ag-field { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ag-field-label { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ag-mid); width: 64px; flex-shrink: 0; }
.ag-field-input {
  flex: 1; font-family: 'IBM Plex Mono', monospace; font-size: 11px;
  background: var(--ag-black); color: var(--ag-acid); border: 1px solid var(--ag-border);
  padding: 4px 8px; outline: none; min-width: 0;
}
.ag-field-input:focus { border-color: var(--ag-acid); box-shadow: 0 0 0 1px var(--ag-acid); }
.ag-field-unit { font-size: 9px; color: var(--ag-mid); letter-spacing: .1em; flex-shrink: 0; }
.ag-color-swatch { width: 20px; height: 20px; cursor: pointer; border: 2px solid transparent; transition: border-color .1s; flex-shrink: 0; }
.ag-color-swatch.selected { border-color: var(--ag-acid); }
.ag-insp-empty { color: var(--ag-dim); font-size: 10px; letter-spacing: .08em; text-align: center; padding: 40px 20px; line-height: 1.8; }
.ag-del-btn {
  width: 100%; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: .18em;
  text-transform: uppercase; background: transparent; border: 1px solid var(--ag-err);
  color: var(--ag-err); padding: 6px; cursor: pointer; margin-top: 12px; transition: all .1s;
}
.ag-del-btn:hover { background: var(--ag-err); color: var(--ag-black); }

/* ── Mixer panel ────────────────────────────────────────────────────────── */
.ag-mixer { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.ag-mx-strip {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: var(--ag-panel); border: 1px solid var(--ag-border); position: relative;
}
.ag-mx-strip::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background: var(--strip-color, var(--ag-acid-d)); }
.ag-mx-name { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ag-white); width: 56px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-mx-fader { flex: 1; accent-color: var(--ag-acid); height: 4px; }
.ag-mx-val { font-size: 9px; color: var(--ag-mid); width: 28px; text-align: right; flex-shrink: 0; }
.ag-mx-mute, .ag-mx-solo {
  font-size: 8px; letter-spacing: .1em; text-transform: uppercase; padding: 3px 6px;
  border: 1px solid var(--ag-border); background: transparent; color: var(--ag-mid); cursor: pointer; transition: all .08s; flex-shrink: 0;
}
.ag-mx-mute.on  { background: var(--ag-amber); border-color: var(--ag-amber); color: var(--ag-black); }
.ag-mx-solo.on  { background: var(--ag-acid);  border-color: var(--ag-acid);  color: var(--ag-black); }
.ag-mx-vu { width: 6px; height: 40px; background: var(--ag-border); position: relative; overflow: hidden; flex-shrink: 0; }
.ag-mx-vu-fill { position: absolute; bottom: 0; left: 0; right: 0; transition: height .08s; }

/* ── Mix suggestions ────────────────────────────────────────────────────── */
.ag-suggest { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.ag-suggest-card {
  background: var(--ag-panel); border: 1px solid var(--ag-border);
  border-left: 3px solid var(--ag-acid-d); padding: 10px 12px; position: relative;
}
.ag-suggest-card.applied { border-left-color: var(--ag-mid); opacity: .5; }
.ag-suggest-card.high-conf { border-left-color: var(--ag-acid); }
.ag-suggest-type { font-size: 8px; letter-spacing: .25em; text-transform: uppercase; color: var(--ag-acid); margin-bottom: 4px; }
.ag-suggest-desc { font-size: 10px; color: var(--ag-white); letter-spacing: .05em; line-height: 1.5; margin-bottom: 8px; }
.ag-suggest-meta { display: flex; align-items: center; gap: 8px; }
.ag-suggest-conf { font-size: 9px; color: var(--ag-mid); letter-spacing: .1em; }
.ag-suggest-bar { flex: 1; height: 2px; background: var(--ag-border); }
.ag-suggest-bar-fill { height: 100%; background: var(--ag-acid); transition: width .3s; }
.ag-apply-btn {
  font-size: 8px; letter-spacing: .15em; text-transform: uppercase;
  background: transparent; border: 1px solid var(--ag-acid-d); color: var(--ag-acid);
  padding: 3px 10px; cursor: pointer; transition: all .1s; flex-shrink: 0;
}
.ag-apply-btn:hover { background: var(--ag-acid); color: var(--ag-black); border-color: var(--ag-acid); }
.ag-suggest-empty { font-size: 10px; color: var(--ag-dim); text-align: center; padding: 28px; letter-spacing: .08em; line-height: 1.8; }
.ag-suggest-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ag-suggest-hdr-label { font-size: 8px; letter-spacing: .3em; text-transform: uppercase; color: var(--ag-acid); }
.ag-suggest-hdr-conf { font-size: 8px; letter-spacing: .1em; color: var(--ag-mid); margin-left: auto; }

/* ── Activity feed ──────────────────────────────────────────────────────── */
.ag-activity { padding: 0; }
.ag-activity-row { padding: 10px 14px; border-bottom: 1px solid var(--ag-border); }
.ag-activity-user { font-size: 10px; color: var(--ag-white); letter-spacing: .08em; margin-bottom: 3px; }
.ag-activity-action { font-size: 9px; color: var(--ag-mid); letter-spacing: .06em; margin-bottom: 2px; }
.ag-activity-time { font-size: 8px; color: var(--ag-dim); letter-spacing: .1em; }

/* ── Guide ──────────────────────────────────────────────────────────────── */
.ag-guide { border-top: 3px solid var(--ag-border); background: var(--ag-ink); padding: 14px 16px; flex-shrink: 0; }
.ag-guide-header { font-size: 8px; letter-spacing: .35em; text-transform: uppercase; color: var(--ag-acid); margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.ag-guide-header::after { content:''; flex:1; height:1px; background:var(--ag-acid-d); }
.ag-guide-row { display: flex; gap: 0; border-bottom: 1px solid var(--ag-border); }
.ag-guide-key { font-weight: 600; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ag-white); padding: 6px 10px 6px 0; min-width: 68px; border-right: 1px solid var(--ag-border); margin-right: 10px; flex-shrink: 0; }
.ag-guide-val { font-size: 9px; letter-spacing: .06em; color: var(--ag-white); padding: 6px 0; }
.ag-kbd-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--ag-border); display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ag-kbd-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; }
.ag-kbd-label { font-size: 8px; letter-spacing: .2em; text-transform: uppercase; color: var(--ag-white); }
.ag-kbd-tag { font-size: 9px; font-weight: 600; color: var(--ag-acid); background: rgba(163,230,53,.08); border: 1px solid var(--ag-acid-d); padding: 2px 6px; letter-spacing: .05em; }

/* ── Footer ─────────────────────────────────────────────────────────────── */
.ag-footer {
  border-top: 3px solid var(--ag-border); background: var(--ag-ink); padding: 8px 20px;
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
@media(min-width:768px){ .ag-footer { flex-direction: row; align-items: center; justify-content: space-between; } }
.ag-footer-left { font-size: 8px; letter-spacing: .22em; text-transform: uppercase; color: var(--ag-white); display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
.ag-footer-feat { display: flex; align-items: center; }
.ag-footer-feat + .ag-footer-feat::before { content:'/'; color: var(--ag-acid); margin: 0 6px; font-size: 10px; }
.ag-footer-right { font-size: 8px; letter-spacing: .15em; text-transform: uppercase; color: var(--ag-white); display: flex; align-items: center; gap: 8px; }
.ag-footer-stat { color: var(--ag-acid); }
.ag-ver-tag { background: rgba(163,230,53,.08); border: 1px solid var(--ag-acid-d); padding: 2px 8px; font-size: 8px; letter-spacing: .2em; color: var(--ag-acid-d); }

/* ── LLPTE status bar ───────────────────────────────────────────────────── */
.ag-llpte-bar {
  display: flex; align-items: center; gap: 0; background: var(--ag-ink);
  border-top: 1px solid var(--ag-border); flex-shrink: 0; overflow: hidden;
}
.ag-llpte-node {
  flex: 1; padding: 4px 0; text-align: center; font-size: 8px; letter-spacing: .18em;
  text-transform: uppercase; color: var(--ag-mid); border-right: 1px solid var(--ag-border);
  position: relative; overflow: hidden;
}
.ag-llpte-node:last-child { border-right: none; }
.ag-llpte-node.active { color: var(--ag-acid); }
.ag-llpte-node.active::before { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:var(--ag-acid); box-shadow:0 0 6px var(--ag-acid); }
.ag-llpte-arrow { color: var(--ag-acid-d); font-size: 8px; flex-shrink: 0; }

/* ── Global overrides ───────────────────────────────────────────────────── */
.ag-frame input[type="number"] {
  background: var(--ag-black) !important; border: 1px solid var(--ag-border) !important;
  color: var(--ag-acid) !important; font-family: 'IBM Plex Mono', monospace !important;
  font-size: 11px !important;
}
.ag-frame input[type="range"] { accent-color: var(--ag-acid); }
.ag-frame *:focus-visible { outline: 1px solid var(--ag-acid) !important; outline-offset: 1px !important; box-shadow: none !important; }
.ag-frame ::-webkit-scrollbar { width: 6px; height: 6px; background: var(--ag-black); }
.ag-frame ::-webkit-scrollbar-track { background: var(--ag-ink); }
.ag-frame ::-webkit-scrollbar-thumb { background: var(--ag-border); }
.ag-frame ::-webkit-scrollbar-thumb:hover { background: var(--ag-acid); }
.ag-frame canvas { image-rendering: pixelated; }

/* ── Settings modal ─────────────────────────────────────────────────────── */
.ag-modal-backdrop {
  position: fixed; inset: 0; background: rgba(6,6,6,.85); z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.ag-modal {
  background: var(--ag-ink); border: 2px solid var(--ag-border);
  border-top: 3px solid var(--ag-acid); width: min(420px, calc(100vw - 40px));
  max-height: 80vh; overflow-y: auto; animation: ag-box-in .25s ease forwards;
}
@keyframes ag-box-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.ag-modal-header { padding: 12px 16px; border-bottom: 1px solid var(--ag-border); display: flex; align-items: center; justify-content: space-between; }
.ag-modal-title { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--ag-acid); }
.ag-modal-close { background: transparent; border: none; color: var(--ag-mid); cursor: pointer; font-size: 16px; transition: color .1s; }
.ag-modal-close:hover { color: var(--ag-err); }
.ag-modal-body { padding: 14px 16px; }
.ag-setting-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--ag-border); }
.ag-setting-label { font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: var(--ag-mid); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media(max-width:1023px){
  .ag-left  { height: auto; border-right: none !important; }
  .ag-right { height: auto; }
  .ag-content { overflow-y: auto; }
}
@media(max-height:600px) and (orientation:landscape){
  .ag-bpm-number, .ag-bpm-input { font-size: clamp(24px,4vw,36px) !important; }
  .ag-wordmark { font-size: clamp(16px,2.2vw,22px) !important; }
}
`;

// ─── UID factory ─────────────────────────────────────────────────────────────

let _uid = 1;
const uid = () => _uid++;

// ─── Clip colors ─────────────────────────────────────────────────────────────

const CLIP_COLORS = [
  '#4d6b18', '#116644', '#4d3d96', '#7a5500', '#0d3d7a', '#7a1a26',
];

// ─── Initial state ────────────────────────────────────────────────────────────

function makeProject(): Project {
  const tracks: Track[] = [
    { id: uid(), index: 0, name: 'Kick',  type: 'audio', color: '#a3e635', muted: false, solo: false, volume: 0.8, pan: 0 },
    { id: uid(), index: 1, name: 'Snare', type: 'audio', color: '#2dd4bf', muted: false, solo: false, volume: 0.8, pan: 0 },
    { id: uid(), index: 2, name: 'Bass',  type: 'synth', color: '#a78bfa', muted: false, solo: false, volume: 0.9, pan: 0 },
    { id: uid(), index: 3, name: 'Lead',  type: 'synth', color: '#fbbf24', muted: false, solo: false, volume: 0.7, pan: 0.2 },
    { id: uid(), index: 4, name: 'Pad',   type: 'synth', color: '#60a5fa', muted: false, solo: false, volume: 0.6, pan: -0.15 },
    { id: uid(), index: 5, name: 'FX',    type: 'fx',    color: '#f87171', muted: false, solo: false, volume: 0.5, pan: 0 },
  ];
  const [tk, ts, tb, tl, tp, tf] = tracks;
  const clips: Clip[] = [
    { id: uid(), trackId: tk.id, startBeat: 0,  lenBeats: 4,  name: 'K-Main',  color: '#4d6b18' },
    { id: uid(), trackId: tk.id, startBeat: 4,  lenBeats: 4,  name: 'K-Fill',  color: '#4d6b18' },
    { id: uid(), trackId: tk.id, startBeat: 8,  lenBeats: 8,  name: 'K-Break', color: '#4d6b18' },
    { id: uid(), trackId: ts.id, startBeat: 0,  lenBeats: 8,  name: 'Sn-Main', color: '#116644' },
    { id: uid(), trackId: ts.id, startBeat: 8,  lenBeats: 4,  name: 'Sn-Fill', color: '#116644' },
    { id: uid(), trackId: tb.id, startBeat: 0,  lenBeats: 4,  name: 'Bass A',  color: '#4d3d96' },
    { id: uid(), trackId: tb.id, startBeat: 4,  lenBeats: 4,  name: 'Bass B',  color: '#4d3d96' },
    { id: uid(), trackId: tb.id, startBeat: 8,  lenBeats: 8,  name: 'Bass C',  color: '#4d3d96' },
    { id: uid(), trackId: tl.id, startBeat: 4,  lenBeats: 8,  name: 'Lead',    color: '#7a5500' },
    { id: uid(), trackId: tp.id, startBeat: 0,  lenBeats: 16, name: 'Pad',     color: '#0d3d7a' },
    { id: uid(), trackId: tf.id, startBeat: 12, lenBeats: 4,  name: 'Riser',   color: '#7a1a26' },
  ];
  const markers: Marker[] = [
    { id: uid(), beat: 0,  label: 'Intro', color: '#fbbf24' },
    { id: uid(), beat: 8,  label: 'Drop',  color: '#a3e635' },
    { id: uid(), beat: 16, label: 'Break', color: '#2dd4bf' },
  ];
  return { tracks, clips, markers, bpm: 128, beatsPerBar: 4, scrollX: 0, zoom: 1 };
}

function makeSuggestions(): MixSuggestion[] {
  return [
    { id: uid(), type: 'level', target: 'Kick',   description: 'Boost kick 2dB — sitting below the mix at current BPM transients.', confidence: 0.81, applied: false },
    { id: uid(), type: 'eq',    target: 'Bass',   description: 'High-pass at 40Hz — low-end mud conflicts with kick sub.', confidence: 0.74, applied: false },
    { id: uid(), type: 'pan',   target: 'Lead',   description: 'Pan lead +15% right — mono centre conflict with bass fundamental.', confidence: 0.67, applied: false },
    { id: uid(), type: 'level', target: 'Pad',    description: 'Reduce pad 3dB in drop section — masking reverb tail on snare.', confidence: 0.61, applied: false },
  ];
}

// ─── Pure drawing functions (outside component — no closure captures) ─────────

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, seed: number,
): void {
  const segs = Math.max(4, Math.floor(w / 4));
  const pts: number[] = [];
  let rng = seed;
  for (let i = 0; i <= segs; i++) {
    rng = ((rng * 1664525 + 1013904223) | 0) >>> 0;
    pts.push(0.18 + (rng / 0xffffffff) * 0.78);
  }
  const mid = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(x, mid);
  for (let i = 0; i <= segs; i++) {
    ctx.lineTo(x + (i / segs) * w, mid - pts[i] * h * 0.38);
  }
  for (let i = segs; i >= 0; i--) {
    ctx.lineTo(x + (i / segs) * w, mid + pts[i] * h * 0.38);
  }
  ctx.closePath();
}

function drawRuler(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, scrollX: number, zoom: number, beatsPerBar: number,
): void {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); ctx.stroke();

  const pxPerBeat = zoom * 80;
  const first = Math.floor(scrollX / pxPerBeat);
  const last  = Math.ceil((scrollX + w) / pxPerBeat) + 1;
  ctx.font = `10px 'IBM Plex Mono', monospace`;
  ctx.textBaseline = 'middle';

  for (let b = first; b <= last; b++) {
    const x = b * pxPerBeat - scrollX + TL.LABEL_W;
    const isBar = b % beatsPerBar === 0;
    ctx.strokeStyle = isBar ? '#2a2a2a' : '#1c1c1c';
    ctx.lineWidth = isBar ? 0.8 : 0.5;
    ctx.beginPath(); ctx.moveTo(x, isBar ? 0 : h * 0.6); ctx.lineTo(x, h); ctx.stroke();
    if (isBar) {
      ctx.fillStyle = '#666';
      ctx.fillText(`${Math.floor(b / beatsPerBar) + 1}`, x + 3, h / 2);
    }
  }
}

interface DrawAllParams {
  ctx: CanvasRenderingContext2D;
  proj: Project;
  sl: SelectionState;
  gw: number;
  gh: number;
  loop: LoopRegion;
  vuLevels: Record<number, number>;
}

function drawAll({ ctx, proj, sl, gw, gh, loop, vuLevels }: DrawAllParams): void {
  const { scrollX, zoom, tracks, clips, markers, beatsPerBar } = proj;
  const pxPerBeat = zoom * 80;

  ctx.clearRect(0, 0, gw, gh);

  // BG
  ctx.fillStyle = '#060606';
  ctx.fillRect(0, 0, gw, gh);

  // Track rows
  tracks.forEach((tr, i) => {
    const y = i * TL.TRACK_H + TL.HEADER_H;
    ctx.fillStyle = i % 2 === 0 ? '#0a0a0a' : '#060606';
    ctx.fillRect(TL.LABEL_W, y, gw - TL.LABEL_W, TL.TRACK_H);
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(TL.LABEL_W, y + TL.TRACK_H - 0.5); ctx.lineTo(gw, y + TL.TRACK_H - 0.5); ctx.stroke();
  });

  // Bar grid lines
  const firstBar = Math.floor(scrollX / (pxPerBeat * beatsPerBar));
  const lastBar  = Math.ceil((scrollX + gw) / (pxPerBeat * beatsPerBar)) + 1;
  for (let b = firstBar; b <= lastBar; b++) {
    const x = b * beatsPerBar * pxPerBeat - scrollX + TL.LABEL_W;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, TL.HEADER_H); ctx.lineTo(x, gh); ctx.stroke();
  }

  // Loop region
  if (loop.active) {
    const x1 = loop.startBeat * pxPerBeat - scrollX + TL.LABEL_W;
    const x2 = loop.endBeat   * pxPerBeat - scrollX + TL.LABEL_W;
    if (x2 > TL.LABEL_W && x1 < gw) {
      ctx.fillStyle = '#2dd4bf';
      ctx.globalAlpha = 0.06;
      ctx.fillRect(x1, TL.HEADER_H, x2 - x1, gh - TL.HEADER_H);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1, TL.HEADER_H); ctx.lineTo(x1, gh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, TL.HEADER_H); ctx.lineTo(x2, gh); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Clips
  clips.forEach(clip => {
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) return;
    const cx = clip.startBeat * pxPerBeat - scrollX + TL.LABEL_W;
    const cw = Math.max(TL.MIN_CLIP_PX, clip.lenBeats * pxPerBeat);
    const cy = track.index * TL.TRACK_H + TL.HEADER_H + 1;
    const ch = TL.TRACK_H - 2;
    if (cx + cw < TL.LABEL_W || cx > gw) return;

    const isSel = sl.selClipId === clip.id;
    const isHov = sl.hovClipId === clip.id;

    ctx.globalAlpha = isSel ? 1 : isHov ? 0.93 : 0.82;

    // Body
    ctx.fillStyle = clip.color;
    ctx.fillRect(cx, cy, cw, ch);

    // Waveform
    if (cw > 24) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 1, cy + 1, cw - 2, ch - 2);
      ctx.clip();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      drawWaveform(ctx, cx + 2, cy + 3, cw - 4, ch - 6, clip.id * 13337);
      ctx.fill();
      ctx.globalAlpha = isSel ? 0.85 : 0.55;
      ctx.fillStyle = '#fff';
      drawWaveform(ctx, cx + 2, cy + 3, cw - 4, ch - 6, clip.id * 13337);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // Label
    if (cw > 28) {
      ctx.font = `500 9px 'IBM Plex Mono', monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textBaseline = 'top';
      ctx.fillText(clip.name.slice(0, Math.floor(cw / 7)), cx + 5, cy + 4);
    }

    // Selection border
    if (isSel) {
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#a3e635';
      ctx.strokeRect(cx, cy, cw, ch);
      ctx.shadowBlur = 0;
    }

    // Resize handles
    if (isSel || isHov) {
      ctx.fillStyle = isSel ? '#a3e635' : '#888';
      ctx.globalAlpha = 0.65;
      ctx.fillRect(cx, cy + 2, 3, ch - 4);
      ctx.fillRect(cx + cw - 3, cy + 2, 3, ch - 4);
      ctx.globalAlpha = 1;
    }
  });

  // Markers
  markers.forEach(m => {
    const x = m.beat * pxPerBeat - scrollX + TL.LABEL_W;
    if (x < TL.LABEL_W || x > gw) return;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, TL.HEADER_H); ctx.lineTo(x, gh); ctx.stroke();
    ctx.setLineDash([]);
    if (m.label) {
      ctx.fillStyle = m.color;
      ctx.font = `9px 'IBM Plex Mono', monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(m.label, x + 3, TL.HEADER_H + 2);
    }
  });

  // Ruler
  drawRuler(ctx, gw, TL.HEADER_H, scrollX, zoom, beatsPerBar);

  // Label column
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, TL.LABEL_W, gh);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(TL.LABEL_W, 0); ctx.lineTo(TL.LABEL_W, gh); ctx.stroke();

  tracks.forEach((tr, i) => {
    const y = i * TL.TRACK_H + TL.HEADER_H;

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(1, y + 1, TL.LABEL_W - 2, TL.TRACK_H - 2);

    // Color stripe
    ctx.fillStyle = tr.color;
    ctx.fillRect(1, y + 1, 3, TL.TRACK_H - 2);

    // Name
    ctx.fillStyle = '#f0f0f0';
    ctx.font = `500 10px 'IBM Plex Mono', monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(tr.name, 12, y + 8);

    // Type
    ctx.fillStyle = '#555';
    ctx.font = `9px 'IBM Plex Mono', monospace`;
    ctx.fillText(tr.type.toUpperCase(), 12, y + 22);

    // Mute/Solo
    const muteX = TL.LABEL_W - 46;
    const soloX = TL.LABEL_W - 26;
    const btnY  = y + TL.TRACK_H - 19;

    ctx.fillStyle = tr.muted ? '#fbbf24' : '#1c1c1c';
    ctx.fillRect(muteX, btnY, 18, 14);
    ctx.fillStyle = tr.muted ? '#060606' : '#666';
    ctx.font = `8px 'IBM Plex Mono', monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText('M', muteX + 5, btnY + 7);

    ctx.fillStyle = tr.solo ? '#a3e635' : '#1c1c1c';
    ctx.fillRect(soloX, btnY, 18, 14);
    ctx.fillStyle = tr.solo ? '#060606' : '#666';
    ctx.fillText('S', soloX + 5, btnY + 7);

    // VU meter
    const vuH = TL.TRACK_H - 10;
    const lvl = vuLevels[tr.id] ?? 0;
    const fillH = Math.floor(lvl * vuH);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(TL.LABEL_W - 8, y + 4, 4, vuH);
    const vuCol = lvl > 0.85 ? '#f87171' : lvl > 0.6 ? '#fbbf24' : '#a3e635';
    ctx.fillStyle = vuCol;
    ctx.fillRect(TL.LABEL_W - 8, y + 4 + vuH - fillH, 4, fillH);
  });
}

interface DrawDynParams {
  ctx: CanvasRenderingContext2D;
  proj: Project;
  gw: number;
  gh: number;
  barPos: number;
  collabs: Collaborator[];
}

function drawDyn({ ctx, proj, gw, gh, barPos, collabs }: DrawDynParams): void {
  ctx.clearRect(0, 0, gw, gh);
  const { scrollX, zoom } = proj;
  const pxPerBeat = zoom * 80;

  // Collaborator cursors
  collabs.forEach(col => {
    const x = col.beat * pxPerBeat - scrollX + TL.LABEL_W;
    if (x < TL.LABEL_W || x > gw) return;
    ctx.strokeStyle = col.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(x, TL.HEADER_H); ctx.lineTo(x, gh); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col.color;
    ctx.font = `8px 'IBM Plex Mono', monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(col.name, x + 2, TL.HEADER_H + 2);
  });

  // Playhead
  const px = barPos * pxPerBeat - scrollX + TL.LABEL_W;
  if (px >= TL.LABEL_W && px <= gw) {
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#a3e635';
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, gh); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.moveTo(px - 6, 0);
    ctx.lineTo(px + 6, 0);
    ctx.lineTo(px, 10);
    ctx.closePath();
    ctx.fill();
  }
}

interface DrawMinimapParams {
  ctx: CanvasRenderingContext2D;
  proj: Project;
  gw: number;
  canvasW: number;
}

function drawMinimap({ ctx, proj, gw, canvasW }: DrawMinimapParams): void {
  ctx.clearRect(0, 0, gw, TL.MM_H);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, gw, TL.MM_H);

  const { tracks, clips, zoom, scrollX } = proj;
  const totalBeats = Math.max(32, ...clips.map(c => c.startBeat + c.lenBeats));
  const scaleX = (gw - TL.LABEL_W) / (totalBeats * zoom * 80);

  clips.forEach(clip => {
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track) return;
    const x = TL.LABEL_W + clip.startBeat * zoom * 80 * scaleX;
    const w = Math.max(2, clip.lenBeats * zoom * 80 * scaleX);
    const y = 2 + (track.index / tracks.length) * (TL.MM_H - 4);
    const h = Math.max(2, (TL.MM_H - 4) / tracks.length - 1);
    ctx.fillStyle = clip.color;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(x, y, w, h);
  });
  ctx.globalAlpha = 1;

  // Viewport indicator
  const viewW = ((canvasW - TL.LABEL_W) / (totalBeats * zoom * 80)) * (gw - TL.LABEL_W);
  const viewX = TL.LABEL_W + (scrollX / (totalBeats * zoom * 80)) * (gw - TL.LABEL_W);
  ctx.strokeStyle = '#a3e635';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#a3e635';
  ctx.globalAlpha = 0.1;
  ctx.fillRect(viewX, 0, Math.max(8, viewW), TL.MM_H);
  ctx.globalAlpha = 0.8;
  ctx.strokeRect(viewX, 0.5, Math.max(8, viewW), TL.MM_H - 1);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(gw, 0); ctx.stroke();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaveLabProduction() {

  // ── Core state ──────────────────────────────────────────────────────────

  const [proj, setProj]               = useState<Project>(makeProject);
  const [transport, setTransport]     = useState<TransportState>('stopped');
  const [barPos, setBarPos]           = useState(0);
  const [selClipId, setSelClipId]     = useState<number | null>(null);
  const [hovClipId, setHovClipId]     = useState<number | null>(null);
  const [snap, setSnap]               = useState<SnapValue>(1);
  const [loop, setLoop]               = useState<LoopRegion>({ active: false, startBeat: 0, endBeat: 8 });
  const [collabs]                     = useState<Collaborator[]>([
    { id: 1, name: 'Nadia', beat: 5.2, color: '#2dd4bf' },
    { id: 2, name: 'Erik',  beat: 9.8, color: '#a78bfa' },
  ]);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [suggestions, setSuggestions] = useState<MixSuggestion[]>(makeSuggestions);
  const [activity, setActivity]       = useState<ActivityEntry[]>([
    { id: 1, user: 'Nadia', action: 'edited Pad clip',    ts: Date.now() - 90000 },
    { id: 2, user: 'Erik',  action: 'added Riser clip',   ts: Date.now() - 45000 },
    { id: 3, user: 'You',   action: 'opened session',     ts: Date.now() - 5000  },
  ]);
  const [rightTab, setRightTab]       = useState<'inspector' | 'mixer' | 'activity'>('inspector');
  const [canUndo, setCanUndo]         = useState(false);
  const [canRedo, setCanRedo]         = useState(false);
  const [vuLevels, setVuLevels]       = useState<Record<number, number>>({});

  // ── Canvas refs ──────────────────────────────────────────────────────────

  const staticRef    = useRef<HTMLCanvasElement>(null);
  const dynRef       = useRef<HTMLCanvasElement>(null);
  const mmRef        = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gwRef        = useRef(800);
  const ghRef        = useRef(proj.tracks.length * TL.TRACK_H + TL.HEADER_H);

  // ── Stable mirrors (for RAF/events — avoid stale closures) ──────────────

  const projRef     = useRef(proj);
  const slRef       = useRef<SelectionState>({ selClipId, hovClipId });
  const trRef       = useRef<TransportState>(transport);
  const barRef      = useRef(barPos);
  const loopRef     = useRef(loop);
  const collabsRef  = useRef(collabs);
  const snapRef     = useRef(snap);
  const vuRef       = useRef(vuLevels);

  useEffect(() => { projRef.current = proj; }, [proj]);
  useEffect(() => { slRef.current = { selClipId, hovClipId }; }, [selClipId, hovClipId]);
  useEffect(() => { trRef.current = transport; }, [transport]);
  useEffect(() => { barRef.current = barPos; }, [barPos]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { collabsRef.current = collabs; }, [collabs]);
  useEffect(() => { snapRef.current = snap; }, [snap]);
  useEffect(() => { vuRef.current = vuLevels; }, [vuLevels]);

  // ── History ──────────────────────────────────────────────────────────────

  const histRef    = useRef<Project[]>([proj]);
  const histIdxRef = useRef(0);

  const pushHistory = useCallback((next: Project) => {
    const hist = histRef.current.slice(0, histIdxRef.current + 1);
    hist.push(next);
    if (hist.length > 80) hist.shift();
    histRef.current    = hist;
    histIdxRef.current = hist.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    setProj(histRef.current[histIdxRef.current]);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= histRef.current.length - 1) return;
    histIdxRef.current++;
    setProj(histRef.current[histIdxRef.current]);
    setCanUndo(true);
    setCanRedo(histIdxRef.current < histRef.current.length - 1);
  }, []);

  // ── Drag state (ref — no re-render during drag) ──────────────────────────

  const dragRef = useRef<DragState | null>(null);

  // ── ResizeObserver ───────────────────────────────────────────────────────

  const triggerStaticRedraw = useCallback(() => {
    const c = staticRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawAll({
      ctx, proj: projRef.current, sl: slRef.current,
      gw: gwRef.current, gh: ghRef.current,
      loop: loopRef.current, vuLevels: vuRef.current,
    });
  }, []);

  const triggerDynRedraw = useCallback(() => {
    const c = dynRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawDyn({ ctx, proj: projRef.current, gw: gwRef.current, gh: ghRef.current, barPos: barRef.current, collabs: collabsRef.current });
  }, []);

  const triggerMmRedraw = useCallback(() => {
    const c = mmRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawMinimap({ ctx, proj: projRef.current, gw: gwRef.current, canvasW: gwRef.current });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        gwRef.current = width;
        const trackH = projRef.current.tracks.length * TL.TRACK_H + TL.HEADER_H;
        ghRef.current = trackH;
        [staticRef, dynRef].forEach(r => {
          if (!r.current) return;
          r.current.width  = width;
          r.current.height = trackH;
        });
        if (mmRef.current) {
          mmRef.current.width  = width;
          mmRef.current.height = TL.MM_H;
        }
        triggerStaticRedraw();
        triggerDynRedraw();
        triggerMmRedraw();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [triggerStaticRedraw, triggerDynRedraw, triggerMmRedraw]);

  // ── Redraw on state changes ──────────────────────────────────────────────

  useEffect(() => { triggerStaticRedraw(); triggerMmRedraw(); }, [proj, selClipId, hovClipId, loop, vuLevels, triggerStaticRedraw, triggerMmRedraw]);
  useEffect(() => { triggerDynRedraw(); }, [barPos, collabs, triggerDynRedraw]);

  // Bug 3 fix: ResizeObserver only fires on width changes. When tracks are added,
  // the canvas height attribute updates correctly via React but ghRef.current stays
  // stale, causing all draw calls to clip against the wrong height.
  useEffect(() => {
    const next = proj.tracks.length * TL.TRACK_H + TL.HEADER_H;
    ghRef.current = next;
    [staticRef, dynRef].forEach(r => {
      if (!r.current) return;
      r.current.height = next;
    });
    triggerStaticRedraw();
    triggerDynRedraw();
  }, [proj.tracks.length, triggerStaticRedraw, triggerDynRedraw]);

  // ── Transport RAF loop ───────────────────────────────────────────────────

  const rafRef    = useRef<number>(0);
  const lastTsRef = useRef(0);

  useEffect(() => {
    if (transport === 'playing' || transport === 'recording') {
      lastTsRef.current = performance.now();
      const tick = (now: number) => {
        if (trRef.current !== 'playing' && trRef.current !== 'recording') return;
        const dt  = (now - lastTsRef.current) / 1000;
        lastTsRef.current = now;
        const bps = projRef.current.bpm / 60;
        setBarPos(p => {
          const next = p + bps * dt;
          const lr   = loopRef.current;
          if (lr.active && next >= lr.endBeat) return lr.startBeat;
          return next;
        });
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [transport]);

  // ── VU meter animation ───────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (trRef.current !== 'playing' && trRef.current !== 'recording') return;
      setVuLevels(prev => {
        const next: Record<number, number> = {};
        projRef.current.tracks.forEach(tr => {
          const r = Math.random();
          next[tr.id] = Math.min(1, (prev[tr.id] ?? 0) * 0.7 + (tr.muted ? 0 : r * 0.85));
        });
        return next;
      });
    }, 80);
    return () => clearInterval(id);
  }, []);

  // ── Activity ticker ──────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setActivity(a => [...a]);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Beat snapping ────────────────────────────────────────────────────────

  const snapBeat = useCallback((beat: number) => {
    const s = snapRef.current;
    return Math.round(beat / s) * s;
  }, []);

  // ── Hit-test clips ───────────────────────────────────────────────────────

  const hitClip = useCallback((px: number, py: number) => {
    const p = projRef.current;
    const pxPerBeat = p.zoom * 80;
    for (let i = p.clips.length - 1; i >= 0; i--) {
      const clip  = p.clips[i];
      const track = p.tracks.find(t => t.id === clip.trackId);
      if (!track) continue;
      const cx = clip.startBeat * pxPerBeat - p.scrollX + TL.LABEL_W;
      const cw = Math.max(TL.MIN_CLIP_PX, clip.lenBeats * pxPerBeat);
      const cy = track.index * TL.TRACK_H + TL.HEADER_H;
      if (px >= cx && px <= cx + cw && py >= cy && py <= cy + TL.TRACK_H) {
        let handle: DragState['type'] | null = null;
        if (px <= cx + 5)       handle = 'resize-l';
        else if (px >= cx + cw - 5) handle = 'resize-r';
        return { clip, handle };
      }
    }
    return null;
  }, []);

  // ── Canvas pointer handlers ──────────────────────────────────────────────

  const onCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = staticRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Ruler scrub
    if (py < TL.HEADER_H && px > TL.LABEL_W) {
      const p = projRef.current;
      const beat = (px - TL.LABEL_W + p.scrollX) / (p.zoom * 80);
      dragRef.current = { type: 'scrub', clipId: -1, startX: px, startBeat: beat, startLen: 0 };
      setBarPos(Math.max(0, beat));
      return;
    }

    const hit = hitClip(px, py);
    if (hit) {
      const { clip, handle } = hit;
      setSelClipId(clip.id);
      setRightTab('inspector');
      dragRef.current = {
        type: handle ?? 'move',
        clipId: clip.id,
        startX: px,
        startBeat: clip.startBeat,
        startLen: clip.lenBeats,
      };
      e.preventDefault();
    } else {
      setSelClipId(null);
    }
  }, [hitClip]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = staticRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (dragRef.current) {
      const d = dragRef.current;
      const p = projRef.current;
      const pxPerBeat = p.zoom * 80;
      const dBeats = (px - d.startX) / pxPerBeat;

      if (d.type === 'scrub') {
        const beat = (px - TL.LABEL_W + p.scrollX) / pxPerBeat;
        setBarPos(Math.max(0, beat));
        return;
      }

      setProj(prev => {
        const clips = prev.clips.map(c => {
          if (c.id !== d.clipId) return c;
          if (d.type === 'move') {
            return { ...c, startBeat: snapBeat(Math.max(0, d.startBeat + dBeats)) };
          }
          if (d.type === 'resize-r') {
            return { ...c, lenBeats: snapBeat(Math.max(0.25, d.startLen + dBeats)) };
          }
          if (d.type === 'resize-l') {
            const delta    = snapBeat(dBeats);
            const newStart = Math.max(0, d.startBeat + delta);
            const newLen   = Math.max(0.25, d.startLen - delta);
            return { ...c, startBeat: newStart, lenBeats: newLen };
          }
          return c;
        });
        return { ...prev, clips };
      });
      return;
    }

    // Hover
    const hit = hitClip(px, py);
    setHovClipId(hit ? hit.clip.id : null);

    const el = staticRef.current;
    if (!el) return;
    if (py < TL.HEADER_H && px > TL.LABEL_W) el.style.cursor = 'col-resize';
    else if (hit?.handle) el.style.cursor = 'ew-resize';
    else if (hit)         el.style.cursor = 'grab';
    else                  el.style.cursor = 'crosshair';
  }, [hitClip, snapBeat]);

  const onCanvasMouseUp = useCallback(() => {
    // History push is handled by the global mouseup below to cover
    // drags that end outside the canvas. Just null the ref here.
    dragRef.current = null;
  }, []);

  // Global mouseup — catches drags released outside the canvas element.
  // Without this, releasing the mouse outside the canvas leaves dragRef set
  // and the next mousemove resumes the drag uninvited.
  useEffect(() => {
    const handler = () => {
      if (dragRef.current && dragRef.current.type !== 'scrub') {
        pushHistory(projRef.current);
      }
      dragRef.current = null;
    };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [pushHistory]);

  const onCanvasDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = staticRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (py < TL.HEADER_H || hitClip(px, py)) return;
    const p = projRef.current;
    const beat = snapBeat((px - TL.LABEL_W + p.scrollX) / (p.zoom * 80));
    const idx  = Math.floor((py - TL.HEADER_H) / TL.TRACK_H);
    const track = p.tracks[idx];
    if (!track) return;
    const newClip: Clip = {
      id: uid(), trackId: track.id,
      startBeat: Math.max(0, beat), lenBeats: 2,
      name: 'Clip', color: track.color,
    };
    const next: Project = { ...projRef.current, clips: [...projRef.current.clips, newClip] };
    setProj(next);
    pushHistory(next);
    setSelClipId(newClip.id);
    setRightTab('inspector');
    setActivity(a => [{ id: uid(), user: 'You', action: `added clip on ${track.name}`, ts: Date.now() }, ...a.slice(0, 9)]);
  }, [hitClip, snapBeat, pushHistory]);

  // Non-passive wheel listener — React registers wheel as passive by default
  // which silently swallows e.preventDefault(). Must be imperative.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const z = e.deltaY > 0 ? 0.88 : 1.14;
        setProj(p => ({ ...p, zoom: Math.min(5, Math.max(0.2, p.zoom * z)) }));
      } else {
        setProj(p => ({ ...p, scrollX: Math.max(0, p.scrollX + e.deltaX + e.deltaY * 0.6) }));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []); // setProj is stable

  // ── Keyboard actions via ref (stable, empty deps) ────────────────────────

  const actionRef = useRef({
    togglePlay: () => {},
    stopReset:  () => {},
    record:     () => {},
    deleteSelected: () => {},
    undo:       () => {},
    redo:       () => {},
  });

  actionRef.current = useMemo(() => ({
    togglePlay: () => setTransport(t => t === 'playing' ? 'stopped' : 'playing'),
    stopReset:  () => { setTransport('stopped'); setBarPos(0); },
    record:     () => setTransport(t => t === 'recording' ? 'stopped' : 'recording'),
    deleteSelected: () => {
      const id = slRef.current.selClipId;
      if (!id) return;
      const next: Project = { ...projRef.current, clips: projRef.current.clips.filter(c => c.id !== id) };
      setProj(next);
      pushHistory(next);
      setSelClipId(null);
    },
    undo,
    redo,
  }), [pushHistory, undo, redo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); actionRef.current.togglePlay(); }
      if (e.code === 'Escape') actionRef.current.stopReset();
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) actionRef.current.undo();
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) actionRef.current.redo();
      if ((e.code === 'Delete' || e.code === 'Backspace') && !(e.target as HTMLElement).isContentEditable) actionRef.current.deleteSelected();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // stable via actionRef

  // ── Derived ──────────────────────────────────────────────────────────────

  const selClip  = useMemo(() => proj.clips.find(c => c.id === selClipId) ?? null, [proj.clips, selClipId]);
  const selTrack = useMemo(() => selClip ? proj.tracks.find(t => t.id === selClip.trackId) ?? null : null, [selClip, proj.tracks]);
  const canvasH  = proj.tracks.length * TL.TRACK_H + TL.HEADER_H;

  const posDisplay = useMemo(() => {
    const bar  = Math.floor(barPos / proj.beatsPerBar) + 1;
    const beat = Math.floor(barPos % proj.beatsPerBar) + 1;
    return `${String(bar).padStart(2, '0')}:${beat}`;
  }, [barPos, proj.beatsPerBar]);

  // ── Track / clip updaters ────────────────────────────────────────────────

  function updateClip(patch: Partial<Clip>) {
    if (!selClipId) return;
    const next: Project = {
      ...projRef.current,
      clips: projRef.current.clips.map(c => c.id === selClipId ? { ...c, ...patch } : c),
    };
    setProj(next);
    pushHistory(next);
  }

  function updateTrack(id: number, patch: Partial<Track>) {
    setProj(p => {
      const next = { ...p, tracks: p.tracks.map(t => t.id === id ? { ...t, ...patch } : t) };
      pushHistory(next);
      return next;
    });
  }

  // ── Relative time ────────────────────────────────────────────────────────

  function relTime(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  // ── Apply suggestion ─────────────────────────────────────────────────────

  function applySuggestion(id: number) {
    // Read before any setState — React 18 batching means suggestions.find
    // inside setActivity would see a pre-update snapshot.
    const sg = suggestions.find(x => x.id === id);
    setSuggestions(s => s.map(item => item.id === id ? { ...item, applied: true } : item));
    setActivity(a => [
      { id: uid(), user: 'AI', action: `Applied: ${sg?.description.slice(0, 40) ?? '...'}`, ts: Date.now() },
      ...a.slice(0, 9),
    ]);
  }

  // LLPTE nodes — active index cycles on an interval during playback.
  // Date.now() in render only evaluates once per render and then freezes
  // until the next state update; an interval drives animation correctly.
  const llpteNodes = ['inputRouter', 'spectralAnalyzer', 'aiMixEngine', 'transitionGraph', 'outputBus'];
  const [llpteActive, setLlpteActive] = useState(-1);

  useEffect(() => {
    if (transport === 'stopped') {
      setLlpteActive(-1);
      return;
    }
    const id = setInterval(() => {
      setLlpteActive(n => (n + 1) % llpteNodes.length);
    }, 800);
    return () => clearInterval(id);
  }, [transport]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject styles once on mount — avoids re-injecting ~600 lines of CSS on every render.
  useEffect(() => {
    const el = document.createElement('style');
    el.setAttribute('data-r3-daw', '1');
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="ag-shell">
        <div className="ag-frame">

          {/* ── Header ── */}
          <header className="ag-header">
            <div className="ag-header-top">

              {/* Wordmark */}
              <div className="ag-wordmark-block">
                <div className="ag-wordmark">
                  R3<span className="ag-wordmark-slash">/</span>WAVE
                </div>
                <div className="ag-wordmark-sub">Multitrack Production v4</div>
              </div>

              {/* Status */}
              <div className="ag-status-block">
                <div className="ag-status-line">
                  {transport === 'playing'   ? <><span className="ag-cursor-live"/><span className="ag-status-live-text">LIVE</span></> :
                   transport === 'recording' ? <><span className="ag-cursor-rec" /><span className="ag-status-rec-text">REC</span></> :
                                               <><span className="ag-cursor-standby"/><span className="ag-status-dead-text">STANDBY</span></>}
                </div>
                <div className="ag-status-line">
                  <span style={{ color: 'var(--ag-mid)' }}>{proj.clips.length} CLIPS / {proj.tracks.length} TRACKS</span>
                </div>
              </div>

              {/* BPM */}
              <div className="ag-bpm-block">
                <div className="ag-bpm-label">BPM</div>
                <input
                  type="number"
                  className="ag-bpm-input"
                  value={proj.bpm}
                  min={40} max={240} step={1}
                  onChange={e => {
                    const v = Math.max(40, Math.min(240, +e.target.value || 40));
                    setProj(p => ({ ...p, bpm: v }));
                  }}
                />
              </div>

              {/* Nav buttons */}
              <div className="ag-controls-block">
                <Link href="/instrument" className="ag-nav-btn">
                  🎹 Instrument
                </Link>
                <button
                  className={`ag-nav-btn${transport === 'playing' ? ' active' : ''}`}
                  onClick={() => actionRef.current.togglePlay()}
                  title="Play / Pause (Space)"
                >
                  {transport === 'playing' ? '⏸ PAUSE' : '▶ PLAY'}
                </button>
                <button
                  className="ag-nav-btn"
                  onClick={() => actionRef.current.stopReset()}
                  title="Stop (Esc)"
                >
                  ⏹ STOP
                </button>
                <button
                  className={`ag-nav-btn rec-btn${transport === 'recording' ? ' armed' : ''}`}
                  onClick={() => actionRef.current.record()}
                  title="Record"
                >
                  ⏺ REC
                </button>
                <button
                  className="ag-nav-btn"
                  onClick={() => setShowSettings(true)}
                  title="Settings"
                >
                  ⚙ CFG
                </button>
              </div>

              <span className="ag-ghost-bpm" aria-hidden="true">{proj.bpm}</span>
            </div>

            {/* Ticker */}
            <div className="ag-ticker-row">
              <div className="ag-ticker-inner">
                {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                  <span key={i} className="ag-ticker-item">
                    {item}<span className="ag-ticker-sep">/</span>
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* ── Main content ── */}
          <div className="ag-content">

            {/* ── LEFT — Timeline ── */}
            <div className="ag-left">

              <div className="ag-section-strip">
                <span className="ag-section-tag">01 — Timeline</span>
                <span className="ag-section-line" />
                <span className="ag-section-tag-r">{Math.round(proj.zoom * 100)}% ZOOM</span>
              </div>

              {/* Transport toolbar */}
              <div className="ag-transport">
                <button className="ag-t-btn" onClick={() => { setBarPos(0); setTransport('stopped'); }} title="Return to start">⏮</button>
                <button className={`ag-t-btn${transport === 'playing' ? ' active' : ''}`} onClick={() => actionRef.current.togglePlay()} title="Play / Pause (Space)">
                  {transport === 'playing' ? '⏸' : '▶'}
                </button>
                <button className={`ag-t-btn danger${transport === 'recording' ? ' armed' : ''}`} onClick={() => actionRef.current.record()} title="Record">⏺</button>

                <div className="ag-t-sep" />

                <div className="ag-t-display">{posDisplay}</div>

                <div className="ag-t-sep" />

                {/* Snap */}
                <span className="ag-t-label">SNAP</span>
                <div className="ag-t-snap-group">
                  {SNAP_VALUES.map(s => (
                    <button key={s} className={`ag-t-btn${snap === s ? ' active' : ''}`} onClick={() => setSnap(s)}>
                      {s === 1 ? '1' : s === 0.5 ? '½' : s === 0.25 ? '¼' : '⅛'}
                    </button>
                  ))}
                </div>

                <div className="ag-t-sep" />

                {/* Loop */}
                <button className={`ag-t-btn${loop.active ? ' active' : ''}`} onClick={() => setLoop(l => ({ ...l, active: !l.active }))}>
                  LOOP
                </button>

                <div className="ag-t-sep" />

                {/* Zoom */}
                <button className="ag-t-btn" onClick={() => setProj(p => ({ ...p, zoom: Math.max(0.2, p.zoom * 0.8) }))}>−</button>
                <button className="ag-t-btn" onClick={() => setProj(p => ({ ...p, zoom: Math.min(5, p.zoom * 1.25) }))}>+</button>

                <div className="ag-t-spacer" />

                {/* History */}
                <button className="ag-t-btn" onClick={undo} title="Undo (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.35 }}>↩ UNDO</button>
                <button className="ag-t-btn" onClick={redo} title="Redo (Ctrl+Y)" style={{ opacity: canRedo ? 1 : 0.35 }}>↪ REDO</button>
                <button className={`ag-t-btn${showMinimap ? ' active' : ''}`} onClick={() => setShowMinimap(v => !v)}>MAP</button>
              </div>

              {/* Canvas area */}
              <div
                ref={containerRef}
                className="ag-timeline-wrap"
                style={{ height: canvasH + 10 }}
              >
                <canvas
                  ref={staticRef}
                  className="ag-canvas-static"
                  width={gwRef.current}
                  height={canvasH}
                  style={{ height: canvasH }}
                  onMouseDown={onCanvasMouseDown}
                  onMouseMove={onCanvasMouseMove}
                  onMouseUp={onCanvasMouseUp}
                  onMouseLeave={onCanvasMouseUp}
                  onDoubleClick={onCanvasDblClick}
                />
                <canvas
                  ref={dynRef}
                  className="ag-canvas-dyn"
                  width={gwRef.current}
                  height={canvasH}
                  style={{ height: canvasH }}
                />
              </div>

              {/* Horizontal scrollbar */}
              <div className="ag-scroll-row">
                <input
                  type="range" min={0} max={6000} step={1}
                  value={proj.scrollX}
                  onChange={e => setProj(p => ({ ...p, scrollX: +e.target.value }))}
                />
              </div>

              {/* Minimap */}
              {showMinimap && (
                <canvas
                  ref={mmRef}
                  className="ag-minimap"
                  width={gwRef.current}
                  height={TL.MM_H}
                  style={{ height: TL.MM_H, width: '100%' }}
                  onClick={e => {
                    const rect = mmRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const rx = e.clientX - rect.left - TL.LABEL_W;
                    const totalBeats = Math.max(32, ...proj.clips.map(c => c.startBeat + c.lenBeats));
                    const frac = Math.max(0, rx / (rect.width - TL.LABEL_W));
                    setProj(p => ({ ...p, scrollX: frac * totalBeats * p.zoom * 80 }));
                  }}
                />
              )}

              {/* LLPTE pipeline status */}
              <div className="ag-llpte-bar" title="LLPTE Pipeline — Live">
                {llpteNodes.map((node, i) => (
                  <span key={node} className={`ag-llpte-node${i === llpteActive ? ' active' : ''}`} title={node}>
                    {node.replace(/([A-Z])/g, ' $1').trim().toUpperCase().slice(0, 8)}
                  </span>
                ))}
              </div>

              {/* Keyboard guide */}
              <div className="ag-guide">
                <div className="ag-guide-header">Reference</div>
                {[
                  ['Double-click', 'Create clip on timeline'],
                  ['Drag clip',    'Move — handles resize'],
                  ['Ctrl+scroll',  'Zoom in / out'],
                  ['Space',        'Play / Pause'],
                  ['Delete',       'Remove selected clip'],
                  ['Ctrl+Z',       'Undo / Ctrl+Y Redo'],
                ].map(([k, v]) => (
                  <div key={k} className="ag-guide-row">
                    <span className="ag-guide-key">{k}</span>
                    <span className="ag-guide-val">{v}</span>
                  </div>
                ))}
                <div className="ag-kbd-section">
                  {[['Play', 'SPC'], ['Stop', 'ESC'], ['Undo', 'Ctrl+Z'], ['Redo', 'Ctrl+Y']].map(([l, t]) => (
                    <div key={l} className="ag-kbd-row">
                      <span className="ag-kbd-label">{l}</span>
                      <span className="ag-kbd-tag">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT — Panels ── */}
            <div className="ag-right">

              <div className="ag-section-strip">
                <span className="ag-section-tag">02 — Controls</span>
                <span className="ag-section-line" />
              </div>

              {/* Panel: Mixer */}
              <PanelBlock
                num="05"
                title="Mixer"
                badge={`${proj.tracks.length} TRACKS`}
                icon={<Sliders size={14} />}
                defaultOpen
              >
                <div className="ag-mixer">
                  {proj.tracks.map(tr => {
                    const lvl = vuLevels[tr.id] ?? 0;
                    const vuFillH = Math.floor(lvl * 40);
                    const vuCol = lvl > 0.85 ? '#f87171' : lvl > 0.6 ? '#fbbf24' : '#a3e635';
                    return (
                      <div
                        key={tr.id}
                        className="ag-mx-strip"
                        style={{ '--strip-color': tr.color } as React.CSSProperties}
                      >
                        <div className="ag-mx-vu">
                          <div className="ag-mx-vu-fill" style={{ height: vuFillH, background: vuCol }} />
                        </div>
                        <span className="ag-mx-name" style={{ borderLeft: `3px solid ${tr.color}`, paddingLeft: 6 }}>{tr.name}</span>
                        <input
                          type="range" className="ag-mx-fader" min={0} max={1} step={0.01}
                          value={tr.volume}
                          onChange={e => updateTrack(tr.id, { volume: +e.target.value })}
                          title={`${tr.name} volume`}
                        />
                        <span className="ag-mx-val">{Math.round(tr.volume * 100)}</span>
                        <button className={`ag-mx-mute${tr.muted ? ' on' : ''}`} onClick={() => updateTrack(tr.id, { muted: !tr.muted })}>M</button>
                        <button className={`ag-mx-solo${tr.solo  ? ' on' : ''}`} onClick={() => updateTrack(tr.id, { solo:  !tr.solo  })}>S</button>
                      </div>
                    );
                  })}
                </div>
              </PanelBlock>

              {/* Panel: AI Mix Engine (P4) */}
              <PanelBlock
                num="06"
                title="AI Mix Engine"
                badge="LLPTE"
                icon={<Wand2 size={14} />}
                defaultOpen
              >
                <div className="ag-suggest">
                  <div className="ag-suggest-hdr">
                    <span className="ag-suggest-hdr-label">Suggestions</span>
                    <span className="ag-suggest-hdr-conf">
                      Confidence gate: ≥0.40 · Auto-apply: ≥0.65
                    </span>
                  </div>
                  {suggestions.filter(s => !s.applied).length === 0 ? (
                    <div className="ag-suggest-empty">
                      All suggestions applied.<br />LLPTE re-analyzing session...
                    </div>
                  ) : (
                    suggestions.map(sg => (
                      <div
                        key={sg.id}
                        className={`ag-suggest-card${sg.applied ? ' applied' : ''}${sg.confidence >= 0.75 ? ' high-conf' : ''}`}
                      >
                        <div className="ag-suggest-type">{sg.type.toUpperCase()} — {sg.target}</div>
                        <div className="ag-suggest-desc">{sg.description}</div>
                        <div className="ag-suggest-meta">
                          <span className="ag-suggest-conf">{Math.round(sg.confidence * 100)}%</span>
                          <div className="ag-suggest-bar">
                            <div className="ag-suggest-bar-fill" style={{ width: `${sg.confidence * 100}%` }} />
                          </div>
                          {!sg.applied && (
                            <button className="ag-apply-btn" onClick={() => applySuggestion(sg.id)}>APPLY</button>
                          )}
                          {sg.applied && <span style={{ fontSize: 8, color: 'var(--ag-mid)', letterSpacing: '.15em' }}>APPLIED</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PanelBlock>

              {/* Panel: Inspector + Activity (tabbed) */}
              <PanelBlock
                num="07"
                title="Inspector"
                badge={selClip ? selClip.name.toUpperCase() : 'SELECT CLIP'}
                icon={<Activity size={14} />}
                defaultOpen
              >
                {/* Tab bar */}
                <div className="ag-panel-tabs">
                  {(['inspector', 'mixer', 'activity'] as const).map(tab => (
                    <button
                      key={tab}
                      className={`ag-tab-btn${rightTab === tab ? ' active' : ''}`}
                      onClick={() => setRightTab(tab)}
                    >
                      {tab === 'inspector' ? 'CLIP' : tab === 'mixer' ? 'TRACK' : 'ACTIVITY'}
                    </button>
                  ))}
                </div>

                <div className="ag-panel-body">

                  {/* Inspector tab */}
                  {rightTab === 'inspector' && (
                    <div className="ag-insp">
                      {selClip ? (
                        <>
                          <div className="ag-insp-section">
                            <div className="ag-insp-title">Clip</div>
                            <div className="ag-field">
                              <span className="ag-field-label">Name</span>
                              <input className="ag-field-input" value={selClip.name} onChange={e => updateClip({ name: e.target.value })} />
                            </div>
                            <div className="ag-field">
                              <span className="ag-field-label">Start</span>
                              <input className="ag-field-input" type="number" value={selClip.startBeat.toFixed(2)} step={0.25} min={0}
                                onChange={e => updateClip({ startBeat: Math.max(0, +e.target.value) })} />
                              <span className="ag-field-unit">beat</span>
                            </div>
                            <div className="ag-field">
                              <span className="ag-field-label">Length</span>
                              <input className="ag-field-input" type="number" value={selClip.lenBeats.toFixed(2)} step={0.25} min={0.25}
                                onChange={e => updateClip({ lenBeats: Math.max(0.25, +e.target.value) })} />
                              <span className="ag-field-unit">beat</span>
                            </div>
                            <div className="ag-field">
                              <span className="ag-field-label">Color</span>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {CLIP_COLORS.map(col => (
                                  <div
                                    key={col}
                                    className={`ag-color-swatch${selClip.color === col ? ' selected' : ''}`}
                                    style={{ background: col }}
                                    onClick={() => updateClip({ color: col })}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {selTrack && (
                            <div className="ag-insp-section">
                              <div className="ag-insp-title">Track</div>
                              <div className="ag-field">
                                <span className="ag-field-label">Volume</span>
                                <input className="ag-field-input" type="number" value={Math.round(selTrack.volume * 100)} min={0} max={100} step={1}
                                  onChange={e => updateTrack(selTrack.id, { volume: +e.target.value / 100 })} />
                                <span className="ag-field-unit">%</span>
                              </div>
                              <div className="ag-field">
                                <span className="ag-field-label">Pan</span>
                                <input className="ag-field-input" type="number" value={selTrack.pan.toFixed(2)} min={-1} max={1} step={0.05}
                                  onChange={e => updateTrack(selTrack.id, { pan: Math.max(-1, Math.min(1, +e.target.value)) })} />
                              </div>
                              <div className="ag-field">
                                <span className="ag-field-label">Status</span>
                                <button
                                  className="ag-t-btn"
                                  style={{ flex: 1, borderColor: selTrack.muted ? 'var(--ag-amber)' : 'var(--ag-border)', color: selTrack.muted ? 'var(--ag-amber)' : '' }}
                                  onClick={() => updateTrack(selTrack.id, { muted: !selTrack.muted })}
                                >
                                  {selTrack.muted ? '🔇 MUTED' : '🔊 LIVE'}
                                </button>
                                <button
                                  className="ag-t-btn"
                                  style={{ borderColor: selTrack.solo ? 'var(--ag-acid)' : 'var(--ag-border)', color: selTrack.solo ? 'var(--ag-acid)' : '' }}
                                  onClick={() => updateTrack(selTrack.id, { solo: !selTrack.solo })}
                                >
                                  {selTrack.solo ? 'SOLO ON' : 'SOLO'}
                                </button>
                              </div>
                            </div>
                          )}

                          <button
                            className="ag-del-btn"
                            onClick={() => actionRef.current.deleteSelected()}
                          >
                            DELETE CLIP
                          </button>
                        </>
                      ) : (
                        <div className="ag-insp-empty">
                          Select a clip to inspect<br />or double-click the timeline<br />to create one.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Track mixer tab */}
                  {rightTab === 'mixer' && (
                    <div className="ag-insp">
                      {selTrack ? (
                        <>
                          <div className="ag-insp-title">Track · {selTrack.name}</div>
                          {['volume', 'pan'].map(param => (
                            <div key={param} className="ag-field">
                              <span className="ag-field-label">{param.toUpperCase()}</span>
                              <input
                                type="range"
                                style={{ flex: 1, accentColor: 'var(--ag-acid)' }}
                                min={param === 'pan' ? -1 : 0}
                                max={param === 'pan' ? 1 : 1}
                                step={param === 'pan' ? 0.05 : 0.01}
                                value={selTrack[param as keyof Track] as number}
                                onChange={e => updateTrack(selTrack.id, { [param]: +e.target.value })}
                              />
                              <span className="ag-field-unit" style={{ minWidth: 36, textAlign: 'right' }}>
                                {param === 'pan'
                                  ? selTrack.pan === 0 ? 'C' : selTrack.pan > 0 ? `R${Math.round(selTrack.pan * 100)}` : `L${Math.round(-selTrack.pan * 100)}`
                                  : `${Math.round(selTrack.volume * 100)}%`
                                }
                              </span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="ag-insp-empty">Select a clip to access<br />its track controls.</div>
                      )}
                    </div>
                  )}

                  {/* Activity tab */}
                  {rightTab === 'activity' && (
                    <div className="ag-activity">
                      {activity.map(ev => (
                        <div key={ev.id} className="ag-activity-row">
                          <div className="ag-activity-user">{ev.user}</div>
                          <div className="ag-activity-action">{ev.action}</div>
                          <div className="ag-activity-time">{relTime(ev.ts)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PanelBlock>

              {/* Panel: Session stats */}
              <PanelBlock
                num="08"
                title="Session"
                badge="METRICS"
                icon={<Layers size={14} />}
                defaultOpen={false}
              >
                <div className="ag-insp">
                  <div className="ag-insp-title">Project</div>
                  {[
                    ['BPM',     proj.bpm],
                    ['Clips',   proj.clips.length],
                    ['Tracks',  proj.tracks.length],
                    ['Markers', proj.markers.length],
                    ['Zoom',    `${Math.round(proj.zoom * 100)}%`],
                    ['Position', posDisplay],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="ag-field">
                      <span className="ag-field-label">{k}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--ag-acid)', letterSpacing: '.05em' }}>{v}</span>
                    </div>
                  ))}

                  <div className="ag-insp-title" style={{ marginTop: 12 }}>LLPTE</div>
                  {[
                    ['Latency p50', '10ms'],
                    ['Node tick',   '0.8ms'],
                    ['Active edges','847'],
                    ['Conf gate',   '≥0.65'],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="ag-field">
                      <span className="ag-field-label">{k}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--ag-cyan)', letterSpacing: '.05em' }}>{v}</span>
                    </div>
                  ))}

                  <button
                    className="ag-t-btn"
                    style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
                    onClick={() => {
                      setSuggestions(makeSuggestions());
                      setActivity(a => [{ id: uid(), user: 'AI', action: 'Re-analyzed session — new suggestions ready', ts: Date.now() }, ...a.slice(0, 9)]);
                    }}
                  >
                    🔄 RE-ANALYZE SESSION
                  </button>
                </div>
              </PanelBlock>

            </div>{/* ag-right */}
          </div>{/* ag-content */}

          {/* ── Footer ── */}
          <footer className="ag-footer">
            <div className="ag-footer-left">
              {['MultiTrack DAW', 'LLPTE Pipeline', 'AI Auto-Level', 'Smart Transitions', 'Mix Suggestions', 'Real-Time Collab'].map(f => (
                <span key={f} className="ag-footer-feat">{f}</span>
              ))}
            </div>
            <div className="ag-footer-right">
              <span>Web Audio API · WebMIDI · IndexedDB</span>
              <span className="ag-footer-stat">{proj.clips.length} clips</span>
              <span className="ag-ver-tag">v4.0</span>
            </div>
          </footer>

        </div>{/* ag-frame */}
      </div>{/* ag-shell */}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div
          className="ag-modal-backdrop"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="ag-modal">
            <div className="ag-modal-header">
              <span className="ag-modal-title">Session Configuration</span>
              <button className="ag-modal-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="ag-modal-body">
              <div className="ag-setting-row">
                <span className="ag-setting-label">BPM</span>
                <input
                  type="number" min={40} max={240} step={1}
                  className="ag-field-input"
                  value={proj.bpm}
                  onChange={e => {
                    const v = Math.max(40, Math.min(240, +e.target.value || 40));
                    setProj(p => ({ ...p, bpm: v }));
                  }}
                  style={{ width: 72 }}
                />
              </div>
              <div className="ag-setting-row">
                <span className="ag-setting-label">Time signature</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" min={2} max={12} step={1}
                    className="ag-field-input"
                    value={proj.beatsPerBar}
                    onChange={e => setProj(p => ({ ...p, beatsPerBar: +e.target.value }))}
                    style={{ width: 48 }}
                  />
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--ag-mid)' }}>/4</span>
                </span>
              </div>
              <div className="ag-setting-row">
                <span className="ag-setting-label">Snap</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {SNAP_VALUES.map(s => (
                    <button key={s} className={`ag-t-btn${snap === s ? ' active' : ''}`} onClick={() => setSnap(s)}>
                      {s === 1 ? '1' : s === 0.5 ? '½' : s === 0.25 ? '¼' : '⅛'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="ag-setting-row">
                <span className="ag-setting-label">Loop</span>
                <button className={`ag-t-btn${loop.active ? ' active' : ''}`} onClick={() => setLoop(l => ({ ...l, active: !l.active }))}>
                  {loop.active ? 'ON' : 'OFF'}
                </button>
              </div>
              {loop.active && (
                <>
                  <div className="ag-setting-row">
                    <span className="ag-setting-label">Loop start</span>
                    <input type="number" min={0} step={1} className="ag-field-input"
                      value={loop.startBeat} onChange={e => setLoop(l => ({ ...l, startBeat: +e.target.value }))} style={{ width: 60 }} />
                  </div>
                  <div className="ag-setting-row">
                    <span className="ag-setting-label">Loop end</span>
                    <input type="number" min={0} step={1} className="ag-field-input"
                      value={loop.endBeat} onChange={e => setLoop(l => ({ ...l, endBeat: +e.target.value }))} style={{ width: 60 }} />
                  </div>
                </>
              )}
              <div className="ag-setting-row">
                <span className="ag-setting-label">Minimap</span>
                <button className={`ag-t-btn${showMinimap ? ' active' : ''}`} onClick={() => setShowMinimap(v => !v)}>
                  {showMinimap ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="ag-setting-row">
                <span className="ag-setting-label">Add track</span>
                <button
                  className="ag-t-btn"
                  onClick={() => {
                    const idx = proj.tracks.length;
                    const newTrack: Track = {
                      id: uid(), index: idx, name: `Track ${idx + 1}`, type: 'audio',
                      color: '#2dd4bf', muted: false, solo: false, volume: 0.8, pan: 0,
                    };
                    setProj(p => ({ ...p, tracks: [...p.tracks, newTrack] }));
                  }}
                >
                  + ADD TRACK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

// ─── PanelBlock sub-component ─────────────────────────────────────────────────

interface PanelBlockProps {
  num: string;
  title: string;
  badge?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

function PanelBlock({ num, title, badge, icon, defaultOpen = true, children }: PanelBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ag-panel">
      <span className="ag-panel-ghost" aria-hidden="true">{num}</span>
      <div
        className={`ag-panel-header${open ? ' open' : ''}`}
        onClick={() => setOpen(v => !v)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
      >
        <span className="ag-ph-icon">{icon}</span>
        <span className="ag-ph-title">{title}</span>
        {badge && <span className="ag-ph-badge">{badge}</span>}
        <span className={`ag-ph-chevron${open ? ' open' : ''}`}>▶</span>
      </div>
      {open && children}
    </div>
  );
}