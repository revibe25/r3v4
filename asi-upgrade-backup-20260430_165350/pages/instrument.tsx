/**
 * Instrument Page — Acid Grid: Component Edition
 *
 * Same Acid Grid aesthetic but now every component interior is fully restyled:
 * DrumPads, PianoKeys, FXPanel, DJControls, AudioVisualizer,
 * MicrophoneInput, HeaderControls, TransportControls
 *
 * ALL original logic preserved exactly.
 *
 * @module pages/instrument
 */

import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import {
  Mic, AlertCircle, Activity, SlidersHorizontal,
  Headphones, Music, Music2, Repeat2
} from 'lucide-react';
import { Link } from 'wouter';
import { MicrophoneInput } from '@/components/microphone-input';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useTheme } from "@/components/theme-provider";
import { DrumPads } from '@/components/drum-pads';
import { PianoKeys } from '@/components/piano-keys';
import { FXPanel } from '@/components/fx-panel';
import { DJControls } from '@/components/dj-controls';
import { TransportControls } from '@/components/transport-controls';
import { AudioVisualizer } from '@/components/audio-visualizer';

import { VSTBrowser } from '@/components/vst-browser';
import type { VSTPluginInfo } from '@/audio/fx/vst-scanner';
import { HeaderControls } from '@/components/header-controls';
import { CollapsibleFXPanel } from '@/components/collapsible-fx-panel';

import { useToast } from '@/hooks/use-toast';
import { useMidi } from '@/hooks/use-midi';
import { saveSession } from '@/lib/session-store';

interface SessionData {
  bpm: number;
  fx: Record<string, boolean>;
  filterVal: number;
  pitchSemitones: number;
  recordedEvents: unknown[];
}

interface InstrumentPageProps {
  autoInitialize?: boolean;
  defaultBpm?: number;
}

// ── Lazy panels (code-split: only loaded when the FX panel opens) ─────────
const WaveformEditor = lazy(() =>
  import('@/components/waveform-editor').then(m => ({ default: m.WaveformEditor })));
const LoopStation505 = lazy(() =>
  import('@/features/loopstation/LoopStation505').then(m => ({ default: m.LoopStation505 })));

// ── Keyboard shortcuts ────────────────────────────────────────────────────
const KEYBOARD_SHORTCUTS = {
  pads: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  keys: ['Z', 'S', 'X', 'D', 'C', 'V', 'G', 'B', 'H', 'N', 'J', 'M'],
  transport: { arm: 'A', record: 'R', play: 'Space', stop: 'S' },
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

/* ── Variables ─────────────────────────────────────────────────────────── */
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
  --ag-cyan:   #00F5FF;   /* PRD §3 canonical active-state cyan */
}

/* ── Shell ─────────────────────────────────────────────────────────────── */
.ag-shell {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--ag-black);
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,.012) 3px, rgba(255,255,255,.012) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,.016) 31px, rgba(255,255,255,.016) 32px);
  font-family: 'IBM Plex Mono', monospace;
}

/* ── Frame ─────────────────────────────────────────────────────────────── */
.ag-frame {
  width: 100%;
  border-left: 3px solid var(--ag-border);
  border-right: 3px solid var(--ag-border);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.ag-frame::before {
  content: '';
  position: absolute;
  left: -3px; top: 0; bottom: 0; width: 3px;
  background: var(--ag-acid);
  box-shadow: 0 0 18px var(--ag-acid), 0 0 40px rgba(163,230,53,.3);
}

/* ── Header ────────────────────────────────────────────────────────────── */
.ag-header { border-bottom: 3px solid var(--ag-border); position: relative; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.6); }
.ag-header-top { display: flex; align-items: stretch; border-bottom: 1px solid var(--ag-border); }

.ag-ghost-bpm {
  position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: clamp(80px,12vw,140px);
  color: transparent; -webkit-text-stroke: 1px rgba(163,230,53,.055);
  letter-spacing: -.04em; pointer-events: none; user-select: none; z-index: 0;
}

.ag-wordmark-block {
  padding: 14px 24px 12px; border-right: 1px solid var(--ag-border);
  display: flex; flex-direction: column; justify-content: center;
  min-width: 220px; position: relative; z-index: 1;
}
.ag-wordmark {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 28px;
  letter-spacing: -.02em; color: var(--ag-white); line-height: 1;
}
.ag-wordmark-slash {
  color: var(--ag-acid); margin: 0 4px; font-size: 34px;
  line-height: .9; text-shadow: 0 0 12px var(--ag-acid);
}
.ag-wordmark-sub {
  font-size: 8px; letter-spacing: .35em; text-transform: uppercase;
  color: var(--ag-white); margin-top: 5px;
}

.ag-status-block {
  padding: 14px 20px; border-right: 1px solid var(--ag-border);
  display: flex; flex-direction: column; justify-content: center; gap: 5px; z-index: 1;
}
.ag-status-line { font-size: 9px; letter-spacing: .2em; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ag-cursor-live {
  display: inline-block; width: 8px; height: 14px;
  background: var(--ag-acid); box-shadow: 0 0 8px var(--ag-acid);
  animation: ag-blink 1s step-end infinite;
}
.ag-cursor-standby { display: inline-block; width: 8px; height: 14px; background: var(--ag-mute); }
@keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
.ag-status-live-text  { color: var(--ag-acid); }
.ag-status-dead-text  { color: var(--ag-white); }

.ag-bpm-block {
  padding: 0 24px; display: flex; align-items: center; gap: 12px; z-index: 1;
}
.ag-bpm-label {
  font-size: 8px; letter-spacing: .3em; color: var(--ag-white);
  text-transform: uppercase; writing-mode: vertical-rl; transform: rotate(180deg);
}
.ag-bpm-number {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 42px;
  letter-spacing: -.04em; color: var(--ag-acid); line-height: 1;
  text-shadow: 0 0 20px rgba(163,230,53,.4), 0 0 40px rgba(163,230,53,.15);
}

.ag-controls-block {
  flex: 1; padding: 12px 20px;
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; flex-wrap: wrap; z-index: 1;
}

/* ticker */
.ag-ticker-row { padding: 5px 0; background: var(--ag-ink); overflow: hidden; position: relative; }
.ag-ticker-row::before, .ag-ticker-row::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 40px; z-index: 2;
}
.ag-ticker-row::before { left: 0; background: linear-gradient(90deg, var(--ag-ink), transparent); }
.ag-ticker-row::after  { right: 0; background: linear-gradient(-90deg, var(--ag-ink), transparent); }
.ag-ticker-inner { display: flex; width: max-content; animation: ag-scroll 28s linear infinite; }
@keyframes ag-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
.ag-ticker-item {
  font-size: 9px; letter-spacing: .25em; text-transform: uppercase;
  color: var(--ag-white); padding: 0 24px; white-space: nowrap;
  display: flex; align-items: center; gap: 12px;
}
.ag-ticker-sep { color: var(--ag-acid); font-size: 11px; }

/* nav buttons */
.ag-nav-btn {
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  background: transparent; border: 1px solid var(--ag-border); padding: 7px 14px;
  color: var(--ag-white); cursor: pointer; transition: all .1s;
  text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
}
.ag-nav-btn:hover { background: var(--ag-acid); border-color: var(--ag-acid); color: var(--ag-black); }

/* ── Content grid ──────────────────────────────────────────────────────── */
.ag-content { display: grid; grid-template-columns: 1fr; flex: 1; overflow: hidden; min-height: 0; }
@media(min-width:1024px)                       { .ag-content { grid-template-columns: 1fr 490px; } }
@media(min-width:1600px)                       { .ag-content { grid-template-columns: 1fr 580px; } }
@media(min-width:1920px)                       { .ag-content { grid-template-columns: 1fr 680px; } }

.ag-left { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; height: 100%; }
@media(min-width:1024px){ .ag-left { border-right: 3px solid var(--ag-border); } }

.ag-right { display: flex; flex-direction: column; overflow-y: auto; min-height: 0; height: 100%; }

.ag-section-strip {
  background: var(--ag-ink); border-top: 3px solid var(--ag-border);
  border-bottom: 1px solid var(--ag-border); padding: 5px 20px;
  display: flex; align-items: center; gap: 10px;
  border-left: 3px solid var(--ag-acid);
  box-shadow: inset 0 0 20px rgba(163,230,53,.03);
}
.ag-section-tag { font-size: 8px; letter-spacing: .35em; text-transform: uppercase; color: var(--ag-white); }
.ag-section-line { flex: 1; height: 1px; background: var(--ag-border); }

.ag-panel { position: relative; border-bottom: 1px solid var(--ag-border); }
.ag-panel-ghost {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 72px;
  color: transparent; -webkit-text-stroke: 1px rgba(163,230,53,.07);
  line-height: 1; pointer-events: none; user-select: none; z-index: 0;
}

/* ── CollapsibleFXPanel overrides ─────────────────────────────────────── */
.ag-frame [class*="rounded"],
.ag-frame .bg-card\/50, .ag-frame .bg-card\/30 { border-radius: 0 !important; }
.ag-frame .bg-card\/50, .ag-frame .bg-card\/30 {
  background: var(--ag-panel) !important; border: none !important;
}
.ag-frame button[aria-expanded] {
  background: var(--ag-ink) !important; border-radius: 0 !important;
  border-bottom: 1px solid var(--ag-border) !important;
  padding-left: 56px !important; transition: background .1s, color .1s !important;
  position: relative; z-index: 1;
}
.ag-frame button[aria-expanded]:hover {
  background: var(--ag-acid) !important; color: var(--ag-black) !important;
}
.ag-frame button[aria-expanded]:hover .text-foreground,
.ag-frame button[aria-expanded]:hover .text-muted-foreground,
.ag-frame button[aria-expanded]:hover svg { color: var(--ag-black) !important; }
.ag-frame button[aria-expanded="true"] { border-left: 3px solid var(--ag-acid) !important; box-shadow: inset 3px 0 12px rgba(163,230,53,.08) !important; }
.ag-frame button[aria-expanded="true"] .text-foreground { color: var(--ag-acid) !important; }
.ag-frame [role="region"] > div { background: var(--ag-panel) !important; border-radius: 0 !important; }
.ag-frame button[aria-expanded] .text-foreground {
  font-family: 'IBM Plex Mono', monospace !important; font-size: 11px !important;
  letter-spacing: .15em !important; text-transform: uppercase !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* DRUM PADS                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Section wrapper */
.ag-frame section.relative {
  background: var(--ag-panel) !important;
  border: none !important; border-radius: 0 !important;
  box-shadow: none !important;
}

/* Individual pad buttons */
.ag-frame [data-testid^="pad-"] {
  border-radius: 0 !important;
  border: 1px solid #3a3a3a !important;
  border-top: 1px solid #4a4a4a !important;
  border-bottom: 2px solid #111 !important;
  background: linear-gradient(180deg, #2a2a2a 0%, #1c1c1c 60%, #141414 100%) !important;
  color: var(--ag-white) !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 9px !important;
  letter-spacing: .15em !important;
  text-transform: uppercase !important;
  transition: background .06s, border-color .06s, box-shadow .06s !important;
  position: relative !important;
  overflow: hidden !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 2px 4px rgba(0,0,0,.6) !important;
}

/* Pad hover */
.ag-frame [data-testid^="pad-"]:hover {
  border-color: var(--ag-acid-d) !important;
  border-top-color: var(--ag-acid) !important;
  background: linear-gradient(180deg, #333 0%, #242424 60%, #1a1a1a 100%) !important;
  color: var(--ag-acid) !important;
  box-shadow: inset 0 1px 0 rgba(163,230,53,.15), 0 0 8px rgba(163,230,53,.1) !important;
}

/* Pad active/pressed — full acid inversion */
.ag-frame [data-testid^="pad-"]:active,
.ag-frame [data-testid^="pad-"][data-active="true"],
.ag-frame [data-testid^="pad-"].active {
  background: linear-gradient(180deg, var(--ag-acid) 0%, var(--ag-acid2) 100%) !important;
  border-color: var(--ag-acid) !important;
  border-top-color: #d4ff40 !important;
  color: var(--ag-black) !important;
  box-shadow: 0 0 0 1px var(--ag-acid), 0 0 24px rgba(163,230,53,.6), inset 0 0 16px rgba(163,230,53,.3) !important;
}

/* Pad that has a sample loaded — acid left stripe */
.ag-frame [data-testid^="pad-"].has-sample,
.ag-frame [data-testid^="pad-"][data-has-sample="true"] {
  border-left: 3px solid var(--ag-acid) !important;
}

/* Pad grid layout */
.ag-frame .grid.grid-cols-4 { gap: 3px !important; }
.ag-frame .grid.grid-cols-4 > * { border-radius: 0 !important; }

/* Pad header bar */
.ag-frame section.relative > div:first-child {
  background: var(--ag-ink) !important;
  border-bottom: 1px solid var(--ag-border) !important;
}

/* Pad top-bar title text */
.ag-frame section.relative h3 {
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 10px !important; letter-spacing: .2em !important;
  text-transform: uppercase !important; color: var(--ag-white) !important;
}

/* Pad footer / controls tray */
.ag-frame section.relative > div:last-child {
  background: var(--ag-ink) !important;
  border-top: 1px solid var(--ag-border) !important;
  border-radius: 0 !important;
}

/* Buttons inside pad tray (Upload, Assign, etc) */
.ag-frame section.relative button:not([data-testid^="pad-"]) {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 9px !important; letter-spacing: .1em !important;
  text-transform: uppercase !important;
  background: var(--ag-ink) !important;
  border: 1px solid var(--ag-border) !important;
  color: var(--ag-white) !important;
}
.ag-frame section.relative button:not([data-testid^="pad-"]):hover {
  background: var(--ag-acid) !important;
  border-color: var(--ag-acid) !important;
  color: var(--ag-black) !important;
}

/* Recording mode indicator */
.ag-frame .animate-pulse { animation: ag-rec-blink 0.8s ease-in-out infinite !important; }
@keyframes ag-rec-blink { 0%,100%{opacity:1; box-shadow:0 0 8px var(--ag-rec)} 50%{opacity:.4; box-shadow:none} }

/* Select triggers */
.ag-frame [role="combobox"], .ag-frame .select-trigger {
  border-radius: 0 !important; background: var(--ag-ink) !important;
  border-color: var(--ag-border) !important;
  font-family: 'IBM Plex Mono', monospace !important; font-size: 9px !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* PIANO KEYS                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

/* White keys — pure white */
.ag-frame [data-testid^="piano-key-"].rounded-b-lg {
  border-radius: 0 !important;
  background: #ffffff !important;
  border: 1px solid #ccc !important;
  border-top: none !important;
  border-bottom: 3px solid #aaa !important;
  color: #333 !important;
  box-shadow: inset 0 -2px 4px rgba(0,0,0,.1), 1px 0 0 #ccc !important;
  transition: background .05s, border-color .05s, box-shadow .05s !important;
}

/* White key active */
.ag-frame [data-testid^="piano-key-"].rounded-b-lg:active,
.ag-frame [data-testid^="piano-key-"].rounded-b-lg.bg-white {
  background: #ffffff !important;
  border-color: #aaa !important;
  color: #333 !important;
  box-shadow: inset 0 3px 8px rgba(0,0,0,.15) !important;
}

/* White key hover */
.ag-frame [data-testid^="piano-key-"].rounded-b-lg:hover:not(:active) {
  background: #f5f5f5 !important;
  border-color: #bbb !important;
  color: #333 !important;
  box-shadow: inset 0 -2px 4px rgba(0,0,0,.08) !important;
}

/* Black keys — pure black */
.ag-frame [data-testid^="piano-key-"].rounded-b-md {
  border-radius: 0 !important;
  background: #000000 !important;
  border: 1px solid #222 !important;
  border-bottom: 3px solid #000 !important;
  box-shadow: 2px 4px 8px rgba(0,0,0,.9) !important;
}
.ag-frame [data-testid^="piano-key-"].rounded-b-md:active,
.ag-frame [data-testid^="piano-key-"].rounded-b-md.bg-black {
  background: #000000 !important;
  border-color: #333 !important;
  box-shadow: inset 0 2px 6px rgba(0,0,0,.6) !important;
}
.ag-frame [data-testid^="piano-key-"].rounded-b-md:hover:not(:active) {
  background: #0a0a0a !important;
  border-color: #333 !important;
  box-shadow: 0 4px 10px rgba(0,0,0,.8) !important;
}

/* Key labels */
.ag-frame [data-testid^="piano-key-"].rounded-b-lg span {
  font-family: 'IBM Plex Mono', monospace !important;
  color: #555 !important; font-size: 8px !important;
}
.ag-frame [data-testid^="piano-key-"].rounded-b-md span {
  font-family: 'IBM Plex Mono', monospace !important;
  color: #888 !important; font-size: 8px !important;
}
.ag-frame [data-testid^="piano-key-"]:active span,
.ag-frame [data-testid^="piano-key-"]:hover span { color: #333 !important; }

/* Velocity fill — restyle to acid gradient */
.ag-frame .bg-gradient-to-t.from-blue-400\/40 {
  background: linear-gradient(180deg, transparent, rgba(163,230,53,.35)) !important;
}
.ag-frame .bg-gradient-to-t.from-blue-500\/50 {
  background: linear-gradient(180deg, transparent, rgba(163,230,53,.45)) !important;
}

/* Assignment color dots on keys */
.ag-frame .rounded-full[style*="backgroundColor"] {
  border-radius: 0 !important;
}

/* Layer badge on keys */
.ag-frame .rounded-full.bg-blue-500,
.ag-frame .rounded-full.bg-blue-600 {
  background: var(--ag-acid) !important; border-radius: 0 !important;
  color: var(--ag-black) !important; font-family: 'IBM Plex Mono', monospace !important;
}

/* Piano section controls (octave, sustain, etc.) */
.ag-frame section.relative .rounded-xl.border {
  border-radius: 0 !important; background: var(--ag-ink) !important;
  border-color: var(--ag-border) !important;
}

/* Tabs inside Piano section */
.ag-frame [role="tablist"] {
  background: var(--ag-black) !important; border-radius: 0 !important;
  border-bottom: 1px solid var(--ag-border) !important;
}
.ag-frame [role="tab"] {
  font-family: 'IBM Plex Mono', monospace !important; font-size: 9px !important;
  letter-spacing: .12em !important; text-transform: uppercase !important;
  border-radius: 0 !important; color: var(--ag-white) !important;
}
.ag-frame [role="tab"][data-state="active"] {
  background: var(--ag-acid) !important; color: var(--ag-black) !important;
  box-shadow: none !important;
}

/* Sliders inside Piano */
.ag-frame [role="slider"] {
  background: var(--ag-acid) !important; border: none !important;
  border-radius: 0 !important; box-shadow: 0 0 8px rgba(163,230,53,.4) !important;
}
.ag-frame [data-orientation="horizontal"].relative.flex.w-full.touch-none {
  height: 2px !important;
}
.ag-frame [data-orientation="horizontal"].relative.flex.w-full.touch-none > span:first-child {
  background: var(--ag-border) !important; border-radius: 0 !important;
}
.ag-frame [data-orientation="horizontal"].relative.flex.w-full.touch-none span[data-orientation] {
  background: var(--ag-acid) !important; border-radius: 0 !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* FX PANEL                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Strip all FXPanel rounded corners */
.ag-frame [style*="borderRadius: 18"],
.ag-frame [style*="borderRadius: 12"],
.ag-frame [style*="borderRadius: 10"],
.ag-frame [style*="borderRadius: 8"],
.ag-frame [style*="border-radius: 18"],
.ag-frame [style*="border-radius: 12"] {
  border-radius: 0 !important;
}

/* FX toggle buttons — the per-effect toggle chips */
.ag-frame [style*="borderRadius"][style*="cursor: pointer"]:not([aria-expanded]),
.ag-frame [style*="border-radius"][style*="cursor: pointer"]:not([aria-expanded]) {
  border-radius: 0 !important;
}

/* FX chips: inactive */
.ag-frame [style*="background: rgba"][style*="border:"] {
  border-radius: 0 !important;
}

/* FX active glow — override the colored box-shadow to acid grid */
/* NOTE: We can't override inline boxShadow easily so we add ring effect via outline */
.ag-frame [style*="boxShadow"][style*="border"][style*="background"] {
  border-radius: 0 !important;
}

/* Spectrum analyzer bars inside FXPanel */
.ag-frame .flex.items-end.justify-center.gap-0\\.5 > div {
  border-radius: 0 !important;
}

/* FX panel category header labels */
.ag-frame [style*="letterSpacing"][style*="textTransform: uppercase"][style*="fontSize: 9"] {
  font-family: 'IBM Plex Mono', monospace !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* DJ CONTROLS                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Outer container — override the 18px border-radius + blurry bg */
.ag-frame [style*="borderRadius: 18"][style*="backdropFilter"] {
  border-radius: 0 !important;
  backdrop-filter: none !important;
  background: var(--ag-panel) !important;
  border: 1px solid var(--ag-border) !important;
  box-shadow: none !important;
}

/* DJ header */
.ag-frame [style*="borderRadius: 18"][style*="backdropFilter"] > div:first-child {
  background: var(--ag-ink) !important;
  border-bottom: 1px solid var(--ag-border) !important;
}

/* Logo icon bubble inside DJ header */
.ag-frame [style*="borderRadius: 8"][style*="background: linear-gradient"][style*="10b981"] {
  border-radius: 0 !important;
  background: var(--ag-acid) !important;
  box-shadow: 0 0 10px rgba(163,230,53,.3) !important;
}
.ag-frame [style*="borderRadius: 8"][style*="background: linear-gradient"][style*="10b981"] svg {
  stroke: var(--ag-black) !important;
}

/* DJ transport buttons */
.ag-frame [style*="borderRadius: 10"][style*="cursor: pointer"] {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
}
.ag-frame [style*="borderRadius: 10"][style*="background: rgba(41,55,79"] {
  background: var(--ag-ink) !important;
  border-color: var(--ag-border) !important;
  color: var(--ag-white) !important;
}
.ag-frame [style*="borderRadius: 10"][style*="background: rgba(41,55,79"]:hover {
  background: var(--ag-acid) !important; color: var(--ag-black) !important;
  border-color: var(--ag-acid) !important;
}

/* Active transport button */
.ag-frame [style*="10b981"][style*="borderRadius: 10"] {
  border-radius: 0 !important;
  border-color: var(--ag-acid) !important;
  color: var(--ag-acid) !important;
  background: rgba(163,230,53,.1) !important;
}

/* ModeSwitcher — strip overflow:hidden rounded */
.ag-frame [style*="borderRadius: 8"][style*="overflow: hidden"][style*="border: 1px"] {
  border-radius: 0 !important;
}
.ag-frame [style*="borderRadius: 8"][style*="overflow: hidden"][style*="border: 1px"] button {
  border-radius: 0 !important; font-family: 'IBM Plex Mono', monospace !important;
  font-size: 8px !important; letter-spacing: .12em !important; text-transform: uppercase !important;
}
.ag-frame [style*="borderRadius: 8"][style*="overflow: hidden"][style*="border: 1px"] button[style*="10b981"] {
  background: var(--ag-acid) !important; color: var(--ag-black) !important;
}

/* LIVE badge pill */
.ag-frame [style*="borderRadius: 20"] {
  border-radius: 0 !important;
  background: rgba(163,230,53,.08) !important;
  border-color: var(--ag-acid-d) !important;
}

/* Collapse button */
.ag-frame [style*="borderRadius: 8"][style*="width: 28"][style*="height: 28"] {
  border-radius: 0 !important;
  background: var(--ag-ink) !important;
  border-color: var(--ag-border) !important;
}

/* Knob body circle — we can't override SVG fill easily but can target the surrounding div */
.ag-frame [style*="touchAction: none"][style*="cursor"] {
  filter: contrast(1.1) !important;
}

/* Crossfader track */
.ag-frame [style*="height: 4"][style*="borderRadius"][style*="background"] {
  border-radius: 0 !important;
}
.ag-frame [style*="height: 2"][style*="borderRadius"][style*="background"] {
  border-radius: 0 !important;
}

/* EQ strips */
.ag-frame [style*="flex: 1"][style*="height"][style*="borderRadius"][style*="transition"] {
  border-radius: 0 !important;
}

/* Hot cue buttons */
.ag-frame [style*="borderRadius: 4"][style*="cursor: pointer"][style*="fontFamily"] {
  border-radius: 0 !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* TRANSPORT CONTROLS (from TransportControls component)                  */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Any buttons in transport area that aren't pads */
.ag-frame .flex.items-center.gap-2 button,
.ag-frame .flex.items-center.gap-1 button {
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 9px !important; letter-spacing: .1em !important;
  text-transform: uppercase !important;
}

/* Generic shadcn Button variants inside our frame */
.ag-frame .inline-flex.items-center.justify-center.gap-2 {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 10px !important; letter-spacing: .1em !important;
}

/* Variant=outline buttons */
.ag-frame .border.bg-background {
  background: var(--ag-ink) !important;
  border-color: var(--ag-border) !important;
  color: var(--ag-white) !important;
  border-radius: 0 !important;
}
.ag-frame .border.bg-background:hover {
  background: var(--ag-acid) !important;
  border-color: var(--ag-acid) !important;
  color: var(--ag-black) !important;
}

/* Variant=default buttons */
.ag-frame .bg-primary.text-primary-foreground {
  background: var(--ag-acid) !important;
  color: var(--ag-black) !important;
  border-radius: 0 !important;
  box-shadow: 0 0 12px rgba(163,230,53,.3) !important;
}
.ag-frame .bg-primary.text-primary-foreground:hover {
  background: var(--ag-acid2) !important;
}

/* Destructive variant — keep red but square it */
.ag-frame .bg-destructive.text-destructive-foreground {
  border-radius: 0 !important;
  background: var(--ag-rec) !important;
  box-shadow: 0 0 10px rgba(239,68,68,.4) !important;
}

/* Ghost variant */
.ag-frame .bg-transparent.hover\:bg-accent {
  border-radius: 0 !important; color: var(--ag-white) !important;
}
.ag-frame .bg-transparent.hover\:bg-accent:hover {
  background: var(--ag-acid) !important; color: var(--ag-black) !important;
}

/* Cards inside transport */
.ag-frame .rounded-lg { border-radius: 0 !important; }
.ag-frame .rounded-md { border-radius: 0 !important; }
.ag-frame .rounded-xl { border-radius: 0 !important; }
.ag-frame .rounded-full:not([data-testid]) { border-radius: 0 !important; }

/* VU meters — green segments stay but get sharper */
.ag-frame .rounded-t { border-radius: 0 !important; }
.ag-frame .rounded { border-radius: 0 !important; }

/* ═══════════════════════════════════════════════════════════════════════ */
/* AUDIO VISUALIZER                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

/* The outer visualizer wrapper */
.ag-frame [style*="borderRadius: 12"][style*="fontFamily"][style*="JetBrains"] {
  border-radius: 0 !important;
  border: 1px solid var(--ag-border) !important;
  box-shadow: none !important;
}

/* Header bar of visualizer */
.ag-frame [style*="background: linear-gradient"][style*="rgba(255,255,255,0.03)"][style*="cursor: pointer"] {
  background: var(--ag-ink) !important;
  border-bottom: 1px solid var(--ag-border) !important;
}

/* Visualizer icon bubble */
.ag-frame [style*="borderRadius: 6"][style*="background: linear-gradient"][style*="width: 24"] {
  border-radius: 0 !important;
  background: var(--ag-acid) !important;
  color: var(--ag-black) !important;
}

/* Start/Stop button in visualizer */
.ag-frame [style*="borderRadius: 4"][style*="fontSize: 10"][style*="fontWeight: 600"] {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
}

/* Mode selector buttons */
.ag-frame [style*="borderRadius: 6"][style*="cursor: pointer"][style*="fontSize: 10"],
.ag-frame [style*="borderRadius: 4"][style*="cursor: pointer"][style*="fontSize: 10"] {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 8px !important; letter-spacing: .1em !important;
  text-transform: uppercase !important;
}

/* Mode button active state */
.ag-frame [style*="boxShadow"][style*="00f0ff"],
.ag-frame [style*="boxShadow"][style*="ff00aa"] {
  outline: 1px solid var(--ag-acid) !important;
  box-shadow: none !important;
}

/* Theme pill buttons */
.ag-frame [style*="borderRadius: 20"][style*="cursor: pointer"] {
  border-radius: 0 !important;
}

/* Sensitivity slider */
.ag-frame input[type="range"] {
  accent-color: var(--ag-acid) !important;
  background: transparent !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MICROPHONE INPUT                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Main container */
.ag-frame [style*="background: linear-gradient(180deg"][style*="borderRadius: 16"] {
  border-radius: 0 !important;
  background: var(--ag-panel) !important;
  border: 1px solid var(--ag-border) !important;
  box-shadow: none !important;
}

/* MIC header */
.ag-frame [style*="borderRadius: 16"] > div:first-child {
  background: var(--ag-ink) !important;
}

/* MIC ARM button */
.ag-frame [style*="borderRadius: 12"][style*="cursor: pointer"][style*="width: 36"] {
  border-radius: 0 !important;
}

/* MIC toggle (arm state) */
.ag-frame [style*="borderRadius: 12"][style*="background: rgba(239,68,68"] {
  border-radius: 0 !important;
  background: var(--ag-rec) !important;
  box-shadow: 0 0 12px rgba(239,68,68,.4) !important;
}

/* EQ preset buttons */
.ag-frame [style*="borderRadius: 4"][style*="padding: 4px"][style*="cursor: pointer"] {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 8px !important;
}
.ag-frame [style*="background: rgba(16,185,129"][style*="cursor: pointer"] {
  background: var(--ag-acid) !important;
  color: var(--ag-black) !important;
  box-shadow: none !important;
}

/* MIC KNOBs container */
.ag-frame [style*="touchAction: none"][style*="cursor: grab"] {
  filter: saturate(.5) brightness(1.2) !important;
}

/* Canvas elements — add a scanline pseudo overlay via parent */
.ag-frame canvas {
  image-rendering: pixelated;
}

/* Level meter bars inside mic */
.ag-frame [style*="height: 6"][style*="borderRadius: 2"] {
  border-radius: 0 !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* HEADER CONTROLS                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Strip sticky header / backdrop from HeaderControls inner wrapper */
.ag-frame .flex.flex-wrap.items-center.gap-3.p-3.bg-background {
  background: transparent !important;
  backdrop-filter: none !important;
  border-bottom: none !important;
  padding: 0 !important;
  position: static !important;
  z-index: auto !important;
}

/* BPM control background bubble */
.ag-frame .flex.items-center.gap-3.bg-muted\/50 {
  background: var(--ag-ink) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 0 !important;
  padding: 6px 12px !important;
}

/* Separator */
.ag-frame [data-orientation="vertical"].w-px.h-6 {
  background: var(--ag-border) !important;
}

/* Dropdown trigger */
.ag-frame [data-radix-collection-item],
.ag-frame [data-state][role="button"] {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 10px !important; letter-spacing: .1em !important;
}

/* Dropdown content */
.ag-frame [role="menu"], .ag-frame [role="listbox"] {
  background: var(--ag-ink) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 0 !important;
  box-shadow: 0 4px 20px rgba(0,0,0,.8) !important;
  font-family: 'IBM Plex Mono', monospace !important;
}
.ag-frame [role="menuitem"], .ag-frame [role="option"] {
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 10px !important; letter-spacing: .08em !important;
  color: var(--ag-white) !important;
}
.ag-frame [role="menuitem"]:focus, .ag-frame [role="option"]:focus,
.ag-frame [role="menuitem"][data-highlighted], .ag-frame [role="option"][data-highlighted] {
  background: var(--ag-acid) !important; color: var(--ag-black) !important;
}

/* Dialog / Modal */
.ag-frame [role="dialog"],
[role="dialog"][style*="background"] {
  background: var(--ag-ink) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  box-shadow: 0 0 60px rgba(0,0,0,.9) !important;
}
[role="dialog"] input {
  background: var(--ag-black) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 0 !important;
  color: var(--ag-white) !important;
  font-family: 'IBM Plex Mono', monospace !important;
}
[role="dialog"] input:focus {
  border-color: var(--ag-acid) !important;
  box-shadow: 0 0 0 1px var(--ag-acid) !important;
  outline: none !important;
}

/* Tooltip */
[role="tooltip"] {
  background: var(--ag-acid) !important;
  color: var(--ag-black) !important;
  border-radius: 0 !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 9px !important; letter-spacing: .15em !important;
  text-transform: uppercase !important;
  padding: 4px 8px !important;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* WAVEFORM EDITOR                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

/* Track list panel */
.ag-frame [class*="bg-background\/60"] {
  background: var(--ag-ink) !important;
}
.ag-frame [class*="border-border\/30"],
.ag-frame [class*="border-border\/40"] {
  border-color: var(--ag-border) !important;
}

/* Track row */
.ag-frame [class*="hover:bg-muted\/30"] {
  border-radius: 0 !important;
}
.ag-frame [class*="hover:bg-muted\/30"]:hover {
  background: rgba(163,230,53,.05) !important;
}

/* Armed track */
.ag-frame [class*="bg-red-500\/10"], .ag-frame [class*="bg-red-600\/20"] {
  background: rgba(239,68,68,.08) !important;
}

/* Master meter area */
.ag-frame .w-16.flex-shrink-0 {
  background: var(--ag-ink) !important;
  border-left: 1px solid var(--ag-border) !important;
}

/* Transport bar */
.ag-frame [class*="bg-background\/80"][class*="border-t"] {
  background: var(--ag-ink) !important;
  border-top: 1px solid var(--ag-border) !important;
}

/* Time display */
.ag-frame [class*="bg-black\/40"] {
  background: var(--ag-black) !important;
  border-radius: 0 !important;
}
.ag-frame .text-emerald-400 { color: var(--ag-acid) !important; }
.ag-frame .bg-emerald-600 { background: var(--ag-acid) !important; color: var(--ag-black) !important; }
.ag-frame .hover\:bg-emerald-700:hover { background: var(--ag-acid2) !important; }

/* Level meter segments */
.ag-frame [class*="rounded-t"] { border-radius: 0 !important; }

/* ═══════════════════════════════════════════════════════════════════════ */
/* ── Independent panel scrollbars ──────────────────────────────────────────── */
.ag-panel-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--ag-acid) var(--ag-ink);
}
.ag-panel-scroll::-webkit-scrollbar       { width: 4px; }
.ag-panel-scroll::-webkit-scrollbar-track { background: var(--ag-ink); }
.ag-panel-scroll::-webkit-scrollbar-thumb { background: var(--ag-acid); border-radius: 0; }
.ag-panel-scroll::-webkit-scrollbar-thumb:hover { background: #84cc16; box-shadow: 0 0 6px rgba(184,255,0,.5); }

/* GLOBAL OVERRIDES (input, scrollbars, focus rings)                     */
/* ═══════════════════════════════════════════════════════════════════════ */

.ag-frame input[type="number"] {
  background: var(--ag-black) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 0 !important;
  color: var(--ag-acid) !important;
  font-family: 'IBM Plex Mono', monospace !important;
  font-size: 11px !important;
}
.ag-frame input[type="number"]:focus {
  border-color: var(--ag-acid) !important;
  box-shadow: 0 0 0 1px var(--ag-acid) !important;
  outline: none !important;
}

.ag-frame *:focus-visible {
  outline: 1px solid var(--ag-acid) !important;
  outline-offset: 1px !important;
  box-shadow: none !important;
}

/* Scrollbar */
.ag-frame ::-webkit-scrollbar { width: 6px; height: 6px; background: var(--ag-black); }
.ag-frame ::-webkit-scrollbar-track { background: var(--ag-ink); border-left: 1px solid var(--ag-border); }
.ag-frame ::-webkit-scrollbar-thumb { background: var(--ag-border); border-radius: 0; box-shadow: inset 0 0 4px rgba(163,230,53,.15); }
.ag-frame ::-webkit-scrollbar-thumb:hover { background: var(--ag-acid); box-shadow: 0 0 8px rgba(163,230,53,.4); }
.ag-content::-webkit-scrollbar { width: 6px; background: var(--ag-black); }
.ag-content::-webkit-scrollbar-track { background: var(--ag-ink); border-left: 1px solid var(--ag-border); }
.ag-content::-webkit-scrollbar-thumb { background: var(--ag-border); border-radius: 0; box-shadow: inset 0 0 4px rgba(163,230,53,.15); }
.ag-content::-webkit-scrollbar-thumb:hover { background: var(--ag-acid); box-shadow: 0 0 8px rgba(163,230,53,.4); }

/* Success / error badges */
.ag-frame [class*="bg-green-500\/10"] {
  background: rgba(163,230,53,.08) !important;
  border-color: var(--ag-acid-d) !important;
  border-radius: 0 !important;
}
.ag-frame [class*="text-green-700"], .ag-frame [class*="text-green-400"] {
  color: var(--ag-acid) !important;
}
.ag-frame [class*="bg-red-500\/10"], .ag-frame [class*="bg-destructive"] {
  background: rgba(239,68,68,.08) !important;
  border-color: rgba(239,68,68,.3) !important;
  border-radius: 0 !important;
}

/* ── Guide / footer ────────────────────────────────────────────────────── */
.ag-guide {
  border-top: 3px solid var(--ag-border);
  background: var(--ag-ink); padding: 16px 20px;
}
.ag-guide-header {
  font-size: 8px; letter-spacing: .35em; text-transform: uppercase;
  color: var(--ag-acid); margin-bottom: 12px;
  display: flex; align-items: center; gap: 10px;
}
.ag-guide-header::after { content:''; flex:1; height:1px; background:var(--ag-acid-d); }
.ag-guide-row {
  display: flex; gap: 0; border-bottom: 1px solid var(--ag-border);
}
.ag-guide-row:last-child { border-bottom: none; }
.ag-guide-key {
  font-weight: 600; font-size: 9px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--ag-white); padding: 7px 12px 7px 0; min-width: 72px;
  border-right: 1px solid var(--ag-border); margin-right: 12px; flex-shrink: 0;
}
.ag-guide-val { font-size: 9px; letter-spacing: .06em; color: var(--ag-white); padding: 7px 0; line-height: 1.5; }
.ag-kbd-section {
  margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--ag-border);
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.ag-kbd-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
.ag-kbd-label { font-size: 8px; letter-spacing: .2em; text-transform: uppercase; color: var(--ag-white); }
.ag-kbd-tag {
  font-size: 9px; font-weight: 600; color: var(--ag-acid);
  background: rgba(163,230,53,.08); border: 1px solid var(--ag-acid-d);
  padding: 2px 7px; letter-spacing: .05em;
}

.ag-footer {
  border-top: 3px solid var(--ag-border); background: var(--ag-ink); padding: 10px 24px;
  display: flex; flex-direction: column; gap: 4px;
}
@media(min-width:768px){ .ag-footer { flex-direction: row; align-items: center; justify-content: space-between; } }
.ag-footer-left {
  font-size: 8px; letter-spacing: .22em; text-transform: uppercase;
  color: var(--ag-white); display: flex; flex-wrap: wrap;
}
.ag-footer-feat { display: flex; align-items: center; gap: 10px; }
.ag-footer-feat + .ag-footer-feat::before { content:'/'; color:var(--ag-acid); margin:0 2px; font-size:10px; }
.ag-footer-right { font-size: 8px; letter-spacing: .15em; text-transform: uppercase; color: var(--ag-white); }
.ag-ver-tag {
  background: rgba(163,230,53,.08); border: 1px solid var(--ag-acid-d);
  padding: 2px 8px; font-size: 8px; letter-spacing: .2em; color: var(--ag-acid-d); margin-left: 10px;
}

/* ── Responsive Viewport Scaling ──────────────────────────────── */

/* Ensure columns constrain correctly at every breakpoint */
.ag-left  { min-height: 0; }
.ag-right { min-height: 0; }

/* Single-column stacked layout on viewport < 1024 px */
@media (max-width: 1023px) {
  .ag-left  { height: auto; border-right: none !important; }
  .ag-right { height: auto; }
  .ag-content { overflow-y: auto; }
}

/* Compact header on landscape-short devices (phones rotated, short tablets) */
@media (max-height: 600px) and (orientation: landscape) {
  .ag-bpm-number    { font-size: clamp(22px, 4.5vw, 36px) !important; }
  .ag-wordmark      { font-size: clamp(16px, 2.5vw, 24px) !important; }
  .ag-wordmark-block { padding: 6px 14px 4px !important; min-width: 160px !important; }
  .ag-bpm-block     { padding: 0 10px !important; }
  .ag-status-block  { padding: 6px 14px !important; }
  .ag-controls-block { padding: 6px 12px !important; }
  .ag-ticker-row    { padding: 3px 0 !important; }
  .ag-guide         { padding: 8px 14px !important; }
  .ag-footer        { padding: 6px 14px !important; }
  .ag-guide-row     { padding: 5px 0 !important; }
}

/* Prevent horizontal bleeding on very narrow screens */
@media (max-width: 400px) {
  .ag-frame { border-left-width: 2px !important; border-right-width: 2px !important; }
  .ag-wordmark-block { min-width: 140px !important; padding: 10px 12px !important; }
}

/* error strip */
.ag-error {
  background: rgba(255,59,59,.06); border-left: 3px solid var(--ag-err);
  border-bottom: 1px solid rgba(255,59,59,.2); padding: 12px 20px;
  display: flex; gap: 12px; align-items: flex-start;
}
.ag-error-title {
  font-weight: 600; font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--ag-err); margin-bottom: 4px;
}
.ag-error-desc { font-size: 9px; color: rgba(255,59,59,.5); line-height: 1.6; }
.ag-error-btn {
  font-size: 9px; letter-spacing: .15em; text-transform: uppercase;
  background: transparent; border: 1px solid var(--ag-err); padding: 5px 12px;
  color: var(--ag-err); cursor: pointer; margin-top: 8px; transition: background .1s, color .1s;
}
.ag-error-btn:hover { background: var(--ag-err); color: var(--ag-black); }

/* init overlay */
.ag-overlay {
  position: fixed; inset: 0; z-index: 50; background: var(--ag-black);
  display: flex; align-items: center; justify-content: center;
  background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.013) 2px, rgba(255,255,255,.013) 4px);
}
.ag-init-box {
  width: min(480px, calc(100vw - 40px)); border: 2px solid var(--ag-border);
  border-top: 3px solid var(--ag-acid); background: var(--ag-ink); padding: 0;
  animation: ag-box-in .35s cubic-bezier(.16,1,.3,1) forwards; position: relative;
}
@keyframes ag-box-in { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.ag-init-title-row { padding: 20px 24px 0; display: flex; align-items: baseline; gap: 14px; }
.ag-init-big { font-family:'Syne',sans-serif; font-weight:800; font-size:36px; letter-spacing:-.03em; color:var(--ag-white); line-height:1; }
.ag-init-big span { color:var(--ag-acid); text-shadow:0 0 16px var(--ag-acid); }
.ag-init-label { font-size:8px; letter-spacing:.3em; text-transform:uppercase; color:var(--ag-white); }
.ag-init-body { padding:16px 24px 20px; border-top:1px solid var(--ag-border); margin-top:16px; }
.ag-init-desc { font-size:10px; letter-spacing:.08em; color:var(--ag-white); line-height:1.8; margin-bottom:20px; }
.ag-init-cta { font-weight:600; font-size:11px; letter-spacing:.25em; text-transform:uppercase; color:var(--ag-acid); display:flex; align-items:center; gap:10px; }
.ag-init-loader { margin-top:16px; height:2px; background:var(--ag-border); position:relative; overflow:hidden; }
.ag-init-loader::after {
  content:''; position:absolute; left:-60%; top:0; bottom:0; width:60%;
  background:linear-gradient(90deg,transparent,var(--ag-acid),transparent);
  animation:ag-sweep 1.2s linear infinite;
}
@keyframes ag-sweep { from{left:-60%} to{left:100%} }
.ag-init-status { font-size:9px; letter-spacing:.15em; color:var(--ag-white); margin-top:10px; }
.ag-op-overlay {
  position:fixed; inset:0; z-index:40; background:rgba(6,6,6,.82);
  display:flex; align-items:center; justify-content:center;
}
.ag-op-box {
  background:var(--ag-ink); border:1px solid var(--ag-border);
  border-top:2px solid var(--ag-acid); padding:20px 28px;
  display:flex; align-items:center; gap:16px;
}
.ag-op-bar { width:140px; height:2px; background:var(--ag-border); position:relative; overflow:hidden; }
.ag-op-bar::after {
  content:''; position:absolute; left:-50%; top:0; bottom:0; width:50%;
  background:var(--ag-acid); animation:ag-sweep 1s linear infinite;
  box-shadow:0 0 8px var(--ag-acid);
}
.ag-op-text { font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--ag-white); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function InstrumentPage({
  autoInitialize = false,
  defaultBpm = 120,
}: InstrumentPageProps = {}) {
  const { toast } = useToast();
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const [tapFlash,   setTapFlash]   = useState(false);
  const {
    state, isInitialized, init,
    triggerPad, triggerKey, toggleFX, setFilter, setPitch, setCrossfade,
    setBpm, toggleMetronome, arm, record, stop, play, undo, redo,
    getAnalyserData, getWaveformData, loadSample,
    assignPadSample, assignKeySample, exportSession, importSession,
  } = useAudioEngine();

  const handleTapTempo = useCallback(() => {
    const now   = performance.now();
    const fresh = tapTimesRef.current.filter(t => now - t < 3000);
    fresh.push(now);
    tapTimesRef.current = fresh.slice(-8);
    if (fresh.length >= 2) {
      const intervals = fresh.slice(1).map((t, i) => t - fresh[i]);
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      if (bpm >= 20 && bpm <= 999) setBpm(bpm);
    }
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
  }, [setBpm]);

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const go = async () => {
      if (isInitialized) return;
      try {
        setIsLoading(true); setInitError(null);
        await init();
        if (defaultBpm !== 120) setBpm(defaultBpm);
        toast({ title: 'Audio Engine Initialized', description: 'Ready to make music!' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setInitError(msg);
        toast({ variant: 'destructive', title: 'Initialization Failed', description: msg });
      } finally { setIsLoading(false); }
    };
    if (autoInitialize) { go(); return; }
    const onClick   = () => { if (!isInitialized && !isLoading) go(); };
    const onKeyDown = () => { if (!isInitialized && !isLoading) go(); };
    window.addEventListener('click',   onClick,   { once: true });
    window.addEventListener('keydown', onKeyDown, { once: true });
    return () => { window.removeEventListener('click', onClick); window.removeEventListener('keydown', onKeyDown); };
  }, [isInitialized, init, autoInitialize, defaultBpm, setBpm, isLoading, toast]);

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isInitialized) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toUpperCase();
      const pi = KEYBOARD_SHORTCUTS.pads.indexOf(k);
      if (pi !== -1 && state.pads[pi]) { e.preventDefault(); triggerPad(pi); return; }
      const ki = KEYBOARD_SHORTCUTS.keys.indexOf(k);
      if (ki !== -1 && state.keys[ki]) { e.preventDefault(); triggerKey(ki); return; }
      if (e.ctrlKey || e.metaKey) {
        if (k === 'A') { e.preventDefault(); arm(); }
        else if (k === 'R') { e.preventDefault(); record(); }
        else if (k === 'S') { e.preventDefault(); stop(); }
      } else if (k === ' ' && e.code === 'Space') { e.preventDefault(); play(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isInitialized, state.pads, state.keys, triggerPad, triggerKey, arm, record, stop, play]);

  // ────────────────────────────────────────────────────────────
  // ── MIDI Input
  //    onPad is intentionally NOT wired: drum-pads.tsx owns its own
  //    midiAccessRef. Passing onPad here too would double-trigger every
  //    pad hit (playPadWithFx fires once from drum-pads MIDI handler,
  //    once from triggerPad here).
  // ────────────────────────────────────────────────────────────
  const handleMidiKey = useCallback(
    (index: number, octaveShift: number, velocity: number) => {
      // triggerKey(index, octaveShift, velocity) — 3 params confirmed on engine.
      // index   : MIDI note - 60 (0-based key index into state.keys[])
      // octaveShift: 0 from use-midi (piano-keys adds its own internal offset)
      // velocity: normalized 0–1 from MIDI note velocity / 127
      if (isInitialized && state.keys[index]) {
        triggerKey(index, octaveShift, velocity);
      }
    },
    [isInitialized, state.keys, triggerKey],
  );

  const { midiStatus, midiInputCount } = useMidi({
    // No onPad — see comment above
    onKey:   handleMidiKey,
    enabled: isInitialized,
  });

  // ── Session ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    try {
      const json = exportSession();
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const ts   = new Date().toISOString().replace(/[:.]/g, '-');
      const fn   = `r3vibe-session-${ts}.json`;
      const a    = document.createElement('a');
      a.href = url; a.download = fn;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: 'Session Saved', description: `Saved as ${fn}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [exportSession, toast]);

  const handleLoad = useCallback(async (file: File) => {
    try {
      setIsLoading(true);
      const text = await file.text();
      try { JSON.parse(text); } catch { throw new Error('Invalid JSON file'); }
      await importSession(text);
      toast({ title: 'Session Loaded', description: `Loaded ${file.name}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Load Failed', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally { setIsLoading(false); }
  }, [importSession, toast]);

  const handleExport = useCallback(() => handleSave(), [handleSave]);

  // ── handleLoadJson — accepts the JSON string HeaderControls passes ────────
  //    HeaderControls reads the file itself and calls onLoad(jsonString).
  //    handleLoad(file: File) is kept for the direct file-input path.
  const handleLoadJson = useCallback(async (json: string) => {
    try {
      setIsLoading(true);
      try { JSON.parse(json); } catch { throw new Error('Invalid JSON'); }
      await importSession(json);
      toast({ title: 'Session Loaded', description: 'Session restored.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Load Failed', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally { setIsLoading(false); }
  }, [importSession, toast]);

  const getSessionData = useCallback((): SessionData => ({
    bpm: state.bpm,
    fx:  state.fx as unknown as Record<string, boolean>,
    filterVal: state.filterVal,
    pitchSemitones: state.pitchSemitones,
    recordedEvents: state.recordedEvents,
  }), [state.bpm, state.fx, state.filterVal, state.pitchSemitones, state.recordedEvents]);

  // ────────────────────────────────────────────────────────────
  // ── IndexedDB Auto-Save (2 s debounce)
  //    exportSession() confirmed on useAudioEngine hook.
  // ────────────────────────────────────────────────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isInitialized) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      // exportSession() is bound to instrumentEngine.exportSession
      saveSession(exportSession()).catch(() => { /* non-critical */ });
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, state]);

  // ── Mic / Samples ─────────────────────────────────────────────────────────

  const handleMicrophoneData  = useCallback((data: Float32Array) => {
    const rms = Math.sqrt(data.reduce((s, x) => s + x * x, 0) / data.length);
    if (rms > 0.5) { /* visual hook */ }
  }, []);

  const handleMicrophoneError = useCallback((error: Error) => {
    toast({ variant: 'destructive', title: 'Microphone Error', description: error.message });
  }, [toast]);

  const handleLoadSample = useCallback(async (file: File) => {
    try {
      if (!file.type.startsWith('audio/')) throw new Error('Please select an audio file');
      if (file.size > 50 * 1024 * 1024) throw new Error('File size exceeds 50MB limit');
      const buffer = await loadSample(file);
      toast({ title: 'Sample Loaded', description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)` });
      return buffer;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Sample Load Failed', description: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  }, [loadSample, toast]);

  // ── Ticker ───────────────────────────────────────────────────────────────

  const TICKER = ['Polyphony','Web Audio API','Offline-First','MIDI Support','Accessible',
    'MultiTrack DAW','VST System','IndexedDB','Mobile-Friendly','R3 Native','Designed by Ernesto'];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>

      <div className="ag-shell">
        <div className="ag-frame">

          {/* Error */}
          {initError && (
            <div className="ag-error">
              <AlertCircle size={14} color="var(--ag-err)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div className="ag-error-title">ERR / INIT FAILED</div>
                <div className="ag-error-desc">{initError}</div>
                <button className="ag-error-btn" onClick={() => { setInitError(null); init(); }}>RETRY</button>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="ag-header">
            <div className="ag-header-top">

              <div className="ag-wordmark-block">
                <div className="ag-wordmark" data-testid="text-title">
                  R3<span className="ag-wordmark-slash">/</span>NATIVE
                </div>
                <div className="ag-wordmark-sub">Instrument · Virtual VSTs</div>
              </div>

              <div className="ag-status-block">
                <div className={`ag-status-line ${isInitialized ? 'ag-status-live-text' : 'ag-status-dead-text'}`}>
                  <span className={isInitialized ? 'ag-cursor-live' : 'ag-cursor-standby'} />
                  {isInitialized ? 'LIVE' : 'STANDBY'}
                </div>
                <div className="ag-status-line" style={{ color: 'var(--ag-white)' }}>ERNESTO · R3VIBE</div>
                <div className="ag-status-line" style={{
                  color: midiStatus === 'active' ? 'var(--ag-acid)'
                       : midiStatus === 'denied' ? 'var(--ag-err)'
                       : 'var(--ag-mid)',
                }}>
                  MIDI {(midiStatus ?? 'idle').toUpperCase()}{midiInputCount > 0 ? ` (${midiInputCount})` : ''}
                </div>
              </div>

              <div className="ag-bpm-block">
                <span className="ag-bpm-label">BPM</span>
                <span className="ag-bpm-number">{isInitialized ? state.bpm : '120'}</span>
                <button
                  onClick={handleTapTempo}
                  style={{
                    background: tapFlash ? 'var(--ag-acid)' : 'transparent',
                    border: '1px solid var(--ag-border)',
                    color: tapFlash ? 'var(--ag-black)' : 'var(--ag-white)',
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 8,
                    letterSpacing: '.2em',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'background .06s, color .06s',
                    flexShrink: 0,
                  }}
                  title="Tap Tempo (tap 2–8× to set BPM)"
                >TAP</button>
              </div>

              <span className="ag-ghost-bpm" aria-hidden="true">
                {isInitialized ? state.bpm : '120'}
              </span>

              <div className="ag-controls-block">
                <Link href="/daw" className="ag-nav-btn">🎚 DAW</Link>

              </div>
            </div>
            <HeaderControls
              bpm={state.bpm} onBpmChange={setBpm}
              metronomeOn={state.metronomeOn} onMetronomeToggle={toggleMetronome}
              onSave={handleSave} onLoad={handleLoadJson}
              getSessionData={getSessionData}
            />

            {/* Ticker */}
            <div className="ag-ticker-row">
              <div className="ag-ticker-inner">
                {[...TICKER, ...TICKER].map((item, i) => (
                  <span key={i} className="ag-ticker-item">
                    {item}<span className="ag-ticker-sep">/</span>
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* Main grid */}
          <div className="ag-content">

            {/* Left — Instruments */}
            <div className="ag-left">
              <div className="ag-section-strip">
                <span className="ag-section-tag">01 — Instruments</span>
                <span className="ag-section-line" />
              </div>

              {[
                { num: '01', title: 'Drum Pads', maxHeight: 400,      icon: <Music className="h-4 w-4" />,    open: true,
                  body: <DrumPads pads={state.pads} onTrigger={triggerPad} onAssignSample={assignPadSample} loadSample={handleLoadSample} disabled={!isInitialized} /> },
                { num: '02', title: 'Piano Keys', maxHeight: 280,     icon: <Music2 className="h-4 w-4" />,   open: true,
                  body: <PianoKeys keys={state.keys} onTrigger={triggerKey} onAssignSample={assignKeySample} loadSample={handleLoadSample} disabled={!isInitialized} /> },
                { num: '03', title: 'Waveform Editor', maxHeight: 360,icon: <Activity className="h-4 w-4" />, open: false,
                  body: <Suspense fallback={<div style={{padding:'20px',color:'var(--ag-mid)',fontSize:10,letterSpacing:'.15em',fontFamily:"'IBM Plex Mono',monospace"}}>LOADING...</div>}><WaveformEditor getWaveformData={getWaveformData} isInitialized={isInitialized} /></Suspense> },
                { num: '03B', title: 'VST Browser', maxHeight: 400,   icon: <Music2 className="h-4 w-4" />,  open: false,
                  body: (
                    <VSTBrowser
                      onPluginSelect={(plugin: VSTPluginInfo) => {
                        toast({ title: 'Plugin Selected', description: `${plugin.name} by ${plugin.vendor}` });
                      }}
                    />
                  )},
                { num: '04', title: 'Loop Station', maxHeight: 440,   icon: <Repeat2 className="h-4 w-4" />,  open: false,
                  body: <Suspense fallback={<div style={{padding:'20px',color:'var(--ag-mid)',fontSize:10,letterSpacing:'.15em',fontFamily:"'IBM Plex Mono',monospace"}}>LOADING...</div>}><LoopStation505 /></Suspense> },
              ].map(({ num, title, icon, open, body, maxHeight }) => (
                <div key={num} className="ag-panel">
                  <span className="ag-panel-ghost" aria-hidden="true">{num}</span>
                  <CollapsibleFXPanel title={title} icon={icon} defaultOpen={open} variant="default" scrollable={true} maxHeight={maxHeight ?? 360}>
                    {body}
                  </CollapsibleFXPanel>
                </div>
              ))}
            </div>

            {/* Right — Controls */}
            <div className="ag-right">
              <div className="ag-section-strip">
                <span className="ag-section-tag">02 — Controls</span>
                <span className="ag-section-line" />
              </div>

              {[
                { num: '05', title: 'Visualizer & Transport', maxHeight: 340, icon: <Activity className="h-4 w-4" />, open: true,
                  body: (
                    <>
                      <AudioVisualizer getAnalyserData={getAnalyserData} isInitialized={isInitialized} isActive={isInitialized} />
                      <div className="mt-4">
                        <TransportControls
                          isArmed={state.isArmed} isRecording={state.isRecording} isPlaying={state.isPlaying}
                          recordedEventsCount={state.recordedEvents.length}
                          onArm={arm} onRecord={record} onStop={stop} onPlay={play}
                          onUndo={undo} onRedo={redo} onExport={handleExport} disabled={!isInitialized} />
                      </div>
                    </>
                  )},
                { num: '06', title: 'Microphone Input', maxHeight: 260, icon: <Mic className="h-4 w-4" />, open: false,
                  body: <MicrophoneInput onAudioData={handleMicrophoneData} /> },
                { num: '07', title: 'FX Chain', maxHeight: 320,         icon: <SlidersHorizontal className="h-4 w-4" />, open: false,
                  body: <FXPanel fx={state.fx} onToggle={toggleFX} /> },
                { num: '08', title: 'DJ Controls', maxHeight: 400,      icon: <Headphones className="h-4 w-4" />, open: false,
                  body: <DJControls filterVal={state.filterVal} pitchSemitones={state.pitchSemitones} crossfade={state.crossfade} onFilterChange={setFilter} onPitchChange={setPitch} onCrossfadeChange={setCrossfade} /> },
              ].map(({ num, title, icon, open, body, maxHeight }) => (
                <div key={num} className="ag-panel">
                  <span className="ag-panel-ghost" aria-hidden="true">{num}</span>
                  <CollapsibleFXPanel title={title} icon={icon} defaultOpen={open} variant="default" scrollable={true} maxHeight={maxHeight ?? 360}>
                    {body}
                  </CollapsibleFXPanel>
                </div>
              ))}

              {/* Quick reference */}
              <div className="ag-guide">
                <div className="ag-guide-header">Reference</div>
                {[['Play','Click pads/keys or keyboard'],['Upload','Custom samples via upload'],
                  ['Record','Arm → Record → Play → Stop'],['Effects','FX + DJ controls live'],
                  ['DAW','MultiTrack for advanced mix'],['Save','Export session anytime']
                ].map(([k, v]) => (
                  <div key={k} className="ag-guide-row">
                    <span className="ag-guide-key">{k}</span>
                    <span className="ag-guide-val">{v}</span>
                  </div>
                ))}
                <div className="ag-kbd-section">
                  {[['Pads','Q–]'],['Keys','Z–M'],['Play','SPC'],['Rec','Ctrl+R']].map(([l, t]) => (
                    <div key={l} className="ag-kbd-row">
                      <span className="ag-kbd-label">{l}</span>
                      <span className="ag-kbd-tag">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="ag-footer">
            <div className="ag-footer-left" data-testid="text-features">
              {['Polyphony','Accessible','Mobile-Friendly','Offline-First','MultiTrack DAW','VST System'].map(f => (
                <span key={f} className="ag-footer-feat">{f}</span>
              ))}
            </div>
            <div className="ag-footer-right" data-testid="text-tech">
              Web Audio API · AudioWorklet · Web MIDI API · IndexedDB · LLPTE
              <span className="ag-ver-tag">v4.1</span>
            </div>
          </footer>
        </div>

        {/* Init overlay */}
        {!isInitialized && !autoInitialize && (
          <div className="ag-overlay">
            <div className="ag-init-box">
              <div className="ag-init-title-row">
                <div className="ag-init-big">R3<span>/</span>NATIVE</div>
                <div className="ag-init-label">{isLoading ? 'LOADING' : 'INSTRUMENT'}</div>
              </div>
              <div className="ag-init-body">
                <div className="ag-init-desc">
                  {isLoading
                    ? 'Calibrating audio context.\nInitializing DSP subsystems...'
                    : 'Click anywhere or press any key\nto initialize the audio engine\nand begin your session.'}
                </div>
                {!isLoading && <div className="ag-init-cta">CLICK OR PRESS ANY KEY</div>}
                {isLoading && (
                  <>
                    <div className="ag-init-loader" />
                    <div className="ag-init-status">Initializing audio context...</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Op loader */}
        {isLoading && isInitialized && (
          <div className="ag-op-overlay">
            <div className="ag-op-box">
              <div className="ag-op-bar" />
              <span className="ag-op-text">Processing</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export type { SessionData, InstrumentPageProps };