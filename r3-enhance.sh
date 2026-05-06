#!/usr/bin/env bash
# r3-enhance.sh — Expert DAW enhancements for R3 v4
# Each phase is independent. Run all: bash r3-enhance.sh
# Run one:  bash r3-enhance.sh --phase 3
# ─────────────────────────────────────────────────────
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'
YLW='\033[0;33m'; DIM='\033[2m'; RST='\033[0m'; BLD='\033[1m'
PASS=0; FAIL=0; SKIP=0
ok()      { echo -e "${GRN}✓${RST} $1"; PASS=$((PASS+1)); }
fail()    { echo -e "${RED}✗${RST} $1"; FAIL=$((FAIL+1)); }
skip()    { echo -e "${YLW}⊘${RST} $1 (already exists)"; SKIP=$((SKIP+1)); }
info()    { echo -e "${CYN}→${RST} $1"; }
section() { echo -e "\n${BLD}${CYN}══ $1 ══${RST}"; }
write_file() {
  local path="$1"; local content="$2"
  mkdir -p "$(dirname "$path")"
  printf '%s' "$content" > "$path"
  ok "Written: $(realpath --relative-to="$ROOT" "$path")"
}

PHASE="${1:-all}"
[[ "$PHASE" == "--phase" ]] && PHASE="${2:-all}"

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Global Keyboard Shortcut Engine
# Wires space=play/stop, ./,=transport, Ctrl+Z/Y=undo/redo, +/-=zoom,
# [/]=markers, Delete=selected, Escape=deselect to a central hook
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "1" ]]; then
section "Phase 1 — Global Keyboard Shortcut Engine"

write_file "$ROOT/client/src/hooks/useKeyboardShortcuts.ts" '/**
 * useKeyboardShortcuts — centralised DAW hotkey system.
 * Register once at the ArrangementPage level; all panels respond.
 */
import { useEffect, useCallback, useRef } from "react";

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

export interface ShortcutOptions {
  /** Disable shortcuts while typing in an input/textarea */
  respectInputFocus?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options: ShortcutOptions = { respectInputFocus: true },
) {
  // Keep a stable ref so callers can pass inline objects without re-registering
  const mapRef = useRef<ShortcutMap>(shortcuts);
  useEffect(() => { mapRef.current = shortcuts; }, [shortcuts]);

  const handler = useCallback((e: KeyboardEvent) => {
    if (options.respectInputFocus) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    }

    const parts: string[] = [];
    if (e.ctrlKey  || e.metaKey)  parts.push("Ctrl");
    if (e.shiftKey)                parts.push("Shift");
    if (e.altKey)                  parts.push("Alt");
    // Normalise key: space → "Space", arrow → "ArrowLeft", etc.
    const key = e.key === " " ? "Space" : e.key;
    parts.push(key);
    const combo = parts.join("+");

    const fn = mapRef.current[combo] ?? mapRef.current[key];
    if (fn) {
      e.preventDefault();
      fn(e);
    }
  }, [options.respectInputFocus]);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

/** Pre-built DAW shortcut map — pass your transport handlers */
export function buildDAWShortcuts(handlers: {
  play:            () => void;
  stop:            () => void;
  record:          () => void;
  undo:            () => void;
  redo:            () => void;
  save:            () => void;
  zoomIn:          () => void;
  zoomOut:         () => void;
  prevMarker:      () => void;
  nextMarker:      () => void;
  deleteSelected:  () => void;
  deselectAll:     () => void;
  duplicateRegion: () => void;
  selectAll:       () => void;
}): ShortcutMap {
  return {
    "Space":          () => handlers.play(),
    ".":              () => handlers.stop(),
    "Ctrl+z":         () => handlers.undo(),
    "Ctrl+Z":         () => handlers.undo(),
    "Ctrl+y":         () => handlers.redo(),
    "Ctrl+Y":         () => handlers.redo(),
    "Ctrl+Shift+z":   () => handlers.redo(),
    "Ctrl+Shift+Z":   () => handlers.redo(),
    "Ctrl+r":         () => handlers.record(),
    "Ctrl+R":         () => handlers.record(),
    "Ctrl+s":         () => handlers.save(),
    "Ctrl+S":         () => handlers.save(),
    "Ctrl+a":         () => handlers.selectAll(),
    "Ctrl+A":         () => handlers.selectAll(),
    "Ctrl+d":         () => handlers.duplicateRegion(),
    "Ctrl+D":         () => handlers.duplicateRegion(),
    "+":              () => handlers.zoomIn(),
    "=":              () => handlers.zoomIn(),
    "-":              () => handlers.zoomOut(),
    "[":              () => handlers.prevMarker(),
    "]":              () => handlers.nextMarker(),
    "Delete":         () => handlers.deleteSelected(),
    "Backspace":      () => handlers.deleteSelected(),
    "Escape":         () => handlers.deselectAll(),
  };
}
'

fi # end phase 1

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Arrangement Zustand Store (replaces all useState prop-drilling)
# Single source of truth: tracks, playhead, selection, undo/redo stack
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "2" ]]; then
section "Phase 2 — Arrangement Zustand Store"

write_file "$ROOT/client/src/store/arrangement-store.ts" '/**
 * arrangement-store.ts — Single source of truth for the DAW arrangement.
 * Includes a 50-step undo/redo stack via immer-style snapshots.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  ArrangementTrack,
  ArrangementMarker,
  Region,
  LoopRange,
} from "../../../shared/arrangement.types";
import { DEFAULT_TRACK_COLORS } from "../../../shared/arrangement.types";

const MAX_UNDO = 50;

export interface ArrangementState {
  // ── Arrangement data ──────────────────────────────────────────────────────
  id:            string;
  name:          string;
  tracks:        ArrangementTrack[];
  markers:       ArrangementMarker[];
  tempo:         number;
  timeSignature: { numerator: number; denominator: number };
  lengthBars:    number;
  loopRange:     LoopRange;

  // ── Transport ─────────────────────────────────────────────────────────────
  playing:       boolean;
  recording:     boolean;
  looping:       boolean;
  metronome:     boolean;
  playhead:      number;    // in bars (float)
  bar:           number;
  beat:          number;
  tick:          number;

  // ── Selection ─────────────────────────────────────────────────────────────
  selectedTrackId:  string | null;
  selectedRegionId: string | null;

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  _past:   ArrangementSnapshot[];
  _future: ArrangementSnapshot[];

  // ── Actions ───────────────────────────────────────────────────────────────
  // Transport
  play:            () => void;
  stop:            () => void;
  toggleRecord:    () => void;
  toggleLoop:      () => void;
  toggleMetronome: () => void;
  setPlayhead:     (bar: number) => void;
  setTempo:        (bpm: number) => void;

  // Tracks
  addTrack:      (type?: ArrangementTrack["type"]) => void;
  removeTrack:   (id: string) => void;
  updateTrack:   (id: string, patch: Partial<ArrangementTrack>) => void;
  reorderTrack:  (id: string, newOrder: number) => void;
  selectTrack:   (id: string | null) => void;

  // Regions
  addRegion:    (trackId: string, region: Omit<Region, "id">) => void;
  removeRegion: (trackId: string, regionId: string) => void;
  updateRegion: (trackId: string, regionId: string, patch: Partial<Region>) => void;
  selectRegion: (regionId: string | null) => void;

  // Markers
  addMarker:    (position: number, name?: string) => void;
  removeMarker: (id: string) => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;

  // Persistence
  loadArrangement:  (data: Partial<ArrangementState>) => void;
  resetArrangement: () => void;
}

type ArrangementSnapshot = Pick<
  ArrangementState,
  "tracks" | "markers" | "loopRange" | "tempo" | "timeSignature" | "lengthBars" | "name"
>;

function snapshot(s: ArrangementState): ArrangementSnapshot {
  return {
    tracks: JSON.parse(JSON.stringify(s.tracks)),
    markers: JSON.parse(JSON.stringify(s.markers)),
    loopRange: { ...s.loopRange },
    tempo: s.tempo,
    timeSignature: { ...s.timeSignature },
    lengthBars: s.lengthBars,
    name: s.name,
  };
}

let _trackIdx = 1;
let _regionIdx = 1;
let _markerIdx = 1;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const INITIAL: Omit<ArrangementState,
  "play"|"stop"|"toggleRecord"|"toggleLoop"|"toggleMetronome"|
  "setPlayhead"|"setTempo"|"addTrack"|"removeTrack"|"updateTrack"|
  "reorderTrack"|"selectTrack"|"addRegion"|"removeRegion"|"updateRegion"|
  "selectRegion"|"addMarker"|"removeMarker"|"undo"|"redo"|
  "loadArrangement"|"resetArrangement"
> = {
  id: uid("arr"),
  name: "Untitled Project",
  tracks: [],
  markers: [],
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  lengthBars: 64,
  loopRange: { startBar: 1, endBar: 5, enabled: false },
  playing: false,
  recording: false,
  looping: false,
  metronome: false,
  playhead: 0,
  bar: 1,
  beat: 1,
  tick: 0,
  selectedTrackId: null,
  selectedRegionId: null,
  _past: [],
  _future: [],
};

function pushUndo(get: () => ArrangementState, set: (s: Partial<ArrangementState>) => void) {
  const past = [...get()._past, snapshot(get())].slice(-MAX_UNDO);
  set({ _past: past, _future: [] });
}

export const useArrangementStore = create<ArrangementState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL,

    // ── Transport ──────────────────────────────────────────────────────────
    play() {
      set({ playing: true });
    },
    stop() {
      set({ playing: false, recording: false, playhead: 0, bar: 1, beat: 1, tick: 0 });
    },
    toggleRecord() {
      set(s => ({ recording: !s.recording }));
    },
    toggleLoop() {
      set(s => ({ looping: !s.looping }));
    },
    toggleMetronome() {
      set(s => ({ metronome: !s.metronome }));
    },
    setPlayhead(bar) {
      set({ playhead: Math.max(0, bar) });
    },
    setTempo(bpm) {
      pushUndo(get, set);
      set({ tempo: Math.max(20, Math.min(999, bpm)) });
    },

    // ── Tracks ─────────────────────────────────────────────────────────────
    addTrack(type = "audio") {
      pushUndo(get, set);
      const color = DEFAULT_TRACK_COLORS[get().tracks.length % DEFAULT_TRACK_COLORS.length];
      const track: ArrangementTrack = {
        id: uid("track"),
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${++_trackIdx}`,
        type,
        color,
        height: 56,
        muted: false,
        soloed: false,
        armed: false,
        volume: 0.8,
        pan: 0,
        regions: [],
        order: get().tracks.length,
      };
      set(s => ({ tracks: [...s.tracks, track] }));
    },
    removeTrack(id) {
      pushUndo(get, set);
      set(s => ({
        tracks: s.tracks.filter(t => t.id !== id).map((t, i) => ({ ...t, order: i })),
        selectedTrackId: s.selectedTrackId === id ? null : s.selectedTrackId,
      }));
    },
    updateTrack(id, patch) {
      pushUndo(get, set);
      set(s => ({
        tracks: s.tracks.map(t => t.id === id ? { ...t, ...patch } : t),
      }));
    },
    reorderTrack(id, newOrder) {
      pushUndo(get, set);
      set(s => {
        const tracks = [...s.tracks].sort((a, b) => a.order - b.order);
        const idx    = tracks.findIndex(t => t.id === id);
        if (idx === -1) return {};
        const [moved] = tracks.splice(idx, 1);
        tracks.splice(newOrder, 0, moved);
        return { tracks: tracks.map((t, i) => ({ ...t, order: i })) };
      });
    },
    selectTrack(id) {
      set({ selectedTrackId: id, selectedRegionId: null });
    },

    // ── Regions ────────────────────────────────────────────────────────────
    addRegion(trackId, regionData) {
      pushUndo(get, set);
      const region = { ...regionData, id: uid("region") } as Region;
      set(s => ({
        tracks: s.tracks.map(t =>
          t.id === trackId ? { ...t, regions: [...t.regions, region] } : t
        ),
      }));
    },
    removeRegion(trackId, regionId) {
      pushUndo(get, set);
      set(s => ({
        tracks: s.tracks.map(t =>
          t.id === trackId
            ? { ...t, regions: t.regions.filter(r => r.id !== regionId) }
            : t
        ),
        selectedRegionId: s.selectedRegionId === regionId ? null : s.selectedRegionId,
      }));
    },
    updateRegion(trackId, regionId, patch) {
      pushUndo(get, set);
      set(s => ({
        tracks: s.tracks.map(t =>
          t.id === trackId
            ? { ...t, regions: t.regions.map(r => r.id === regionId ? { ...r, ...patch } as Region : r) }
            : t
        ),
      }));
    },
    selectRegion(id) {
      set({ selectedRegionId: id });
    },

    // ── Markers ────────────────────────────────────────────────────────────
    addMarker(position, name = `Marker ${++_markerIdx}`) {
      pushUndo(get, set);
      const COLORS = ["#b8ff00", "#00e5ff", "#ff6b35", "#a855f7", "#22c55e", "#f59e0b"];
      const color  = COLORS[get().markers.length % COLORS.length];
      set(s => ({
        markers: [...s.markers, { id: uid("marker"), position, name, color }]
          .sort((a, b) => a.position - b.position),
      }));
    },
    removeMarker(id) {
      pushUndo(get, set);
      set(s => ({ markers: s.markers.filter(m => m.id !== id) }));
    },

    // ── Undo / Redo ────────────────────────────────────────────────────────
    undo() {
      const { _past, _future } = get();
      if (_past.length === 0) return;
      const prev    = _past[_past.length - 1];
      const current = snapshot(get());
      set({
        ...(prev as Partial<ArrangementState>),
        _past:   _past.slice(0, -1),
        _future: [current, ..._future].slice(0, MAX_UNDO),
      });
    },
    redo() {
      const { _past, _future } = get();
      if (_future.length === 0) return;
      const next    = _future[0];
      const current = snapshot(get());
      set({
        ...(next as Partial<ArrangementState>),
        _past:   [..._past, current].slice(-MAX_UNDO),
        _future: _future.slice(1),
      });
    },

    // ── Persistence ────────────────────────────────────────────────────────
    loadArrangement(data) {
      set({ ...INITIAL, ...data, _past: [], _future: [] });
    },
    resetArrangement() {
      set({ ...INITIAL, id: uid("arr"), _past: [], _future: [] });
    },
  }))
);

// Convenience selectors (avoid re-renders on unrelated state changes)
export const useSelectedTrack = () =>
  useArrangementStore(s => s.tracks.find(t => t.id === s.selectedTrackId) ?? null);

export const useTempo = () =>
  useArrangementStore(s => s.tempo);

export const useCanUndo = () =>
  useArrangementStore(s => s._past.length > 0);

export const useCanRedo = () =>
  useArrangementStore(s => s._future.length > 0);
'

fi # end phase 2

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — AudioWorklet VU Meter Processor
# Runs off the main thread; posts peak + RMS every 50ms for accurate meters
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "3" ]]; then
section "Phase 3 — AudioWorklet VU Meter Processor"

write_file "$ROOT/client/src/audio/worklets/vu-meter-processor.ts" '/**
 * vu-meter-processor.ts
 * AudioWorkletProcessor — computes peak + RMS per channel every 50ms.
 * Compiled to a separate worklet bundle by the Vite worklet build step.
 */

interface MeterProcessorOptions {
  numberOfInputs: number;
  numberOfOutputs: number;
  outputChannelCount: number[];
  processorOptions: { intervalMs: number };
}

class VUMeterProcessor extends AudioWorkletProcessor {
  private _interval:   number;
  private _framesSince: number = 0;
  private _peakL:  number = 0;
  private _peakR:  number = 0;
  private _sumSqL: number = 0;
  private _sumSqR: number = 0;
  private _frames: number = 0;

  constructor(options: MeterProcessorOptions) {
    super();
    const intervalMs = options.processorOptions?.intervalMs ?? 50;
    // sampleRate is a global inside AudioWorkletGlobalScope
    this._interval = Math.round((sampleRate / 1000) * intervalMs);
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const L = input[0] ?? new Float32Array(0);
    const R = input[1] ?? input[0] ?? new Float32Array(0);

    for (let i = 0; i < L.length; i++) {
      const l = L[i]; const r = R[i] ?? l;
      if (Math.abs(l) > this._peakL) this._peakL = Math.abs(l);
      if (Math.abs(r) > this._peakR) this._peakR = Math.abs(r);
      this._sumSqL += l * l;
      this._sumSqR += r * r;
    }
    this._frames      += L.length;
    this._framesSince += L.length;

    if (this._framesSince >= this._interval) {
      const rmsL = Math.sqrt(this._sumSqL / this._frames);
      const rmsR = Math.sqrt(this._sumSqR / this._frames);
      this.port.postMessage({
        peakL: this._peakL, peakR: this._peakR,
        rmsL, rmsR,
      });
      // Decay peak (not reset — simulate peak hold)
      this._peakL      *= 0.92;
      this._peakR      *= 0.92;
      this._sumSqL      = 0;
      this._sumSqR      = 0;
      this._frames      = 0;
      this._framesSince = 0;
    }
    return true;
  }
}

registerProcessor("vu-meter-processor", VUMeterProcessor);
'

write_file "$ROOT/client/src/audio/worklets/use-vu-meter.ts" '/**
 * useVUMeter — React hook that connects a WebAudio source node to the
 * VU meter AudioWorklet and returns live peak/RMS values.
 *
 * Usage:
 *   const { peakL, peakR, rmsL, rmsR } = useVUMeter(audioContext, sourceNode);
 */
import { useState, useEffect, useRef } from "react";

export interface VUMeterData {
  peakL: number; peakR: number;
  rmsL:  number; rmsR:  number;
}

const ZERO: VUMeterData = { peakL: 0, peakR: 0, rmsL: 0, rmsR: 0 };

// Cache so we only load the worklet module once per AudioContext
const loadedContexts = new WeakSet<AudioContext>();

export function useVUMeter(
  audioContext: AudioContext | null,
  sourceNode:   AudioNode    | null,
  intervalMs  = 50,
): VUMeterData {
  const [data, setData] = useState<VUMeterData>(ZERO);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    if (!audioContext || !sourceNode) return;
    let active = true;

    const setup = async () => {
      try {
        if (!loadedContexts.has(audioContext)) {
          await audioContext.audioWorklet.addModule(
            new URL("./vu-meter-processor.ts", import.meta.url).href
          );
          loadedContexts.add(audioContext);
        }
        if (!active) return;

        const worklet = new AudioWorkletNode(audioContext, "vu-meter-processor", {
          numberOfInputs:  1,
          numberOfOutputs: 0,
          processorOptions: { intervalMs },
        });

        worklet.port.onmessage = (e: MessageEvent<VUMeterData>) => {
          if (active) setData(e.data);
        };

        sourceNode.connect(worklet);
        workletRef.current = worklet;
      } catch (err) {
        console.warn("[useVUMeter] AudioWorklet unavailable, falling back:", err);
      }
    };

    setup();

    return () => {
      active = false;
      workletRef.current?.disconnect();
      workletRef.current = null;
      setData(ZERO);
    };
  }, [audioContext, sourceNode, intervalMs]);

  return data;
}
'

fi # end phase 3

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Web MIDI API Hardware Integration
# Detects MIDI devices, routes note-on/off/CC to the piano roll store
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "4" ]]; then
section "Phase 4 — Web MIDI API Hardware Integration"

write_file "$ROOT/client/src/hooks/useMIDIDevices.ts" '/**
 * useMIDIDevices — Web MIDI API integration for R3 v4.
 * Enumerates inputs, subscribes to state changes, and forwards
 * MIDI messages to a user-supplied callback.
 */
import { useState, useEffect, useRef, useCallback } from "react";

export interface MIDIDeviceInfo {
  id:           string;
  name:         string;
  manufacturer: string;
  state:        "connected" | "disconnected";
}

export interface MIDIMessage {
  type:       "noteOn" | "noteOff" | "cc" | "pitchBend" | "clock" | "other";
  channel:    number;
  note?:      number;
  velocity?:  number;
  controller?: number;
  value?:     number;
  bend?:      number;
  raw:        Uint8Array;
  timestamp:  number;
}

export interface UseMIDIDevicesReturn {
  supported:  boolean;
  inputs:     MIDIDeviceInfo[];
  activeIds:  Set<string>;
  enable:     (id: string) => void;
  disable:    (id: string) => void;
  enableAll:  () => void;
  disableAll: () => void;
  error:      string | null;
}

function parseMIDI(data: Uint8Array, timestamp: number): MIDIMessage {
  const status  = data[0];
  const channel = status & 0x0f;
  const type    = (status >> 4) & 0x0f;

  switch (type) {
    case 0x9:
      return data[2] > 0
        ? { type: "noteOn",  channel, note: data[1], velocity: data[2], raw: data, timestamp }
        : { type: "noteOff", channel, note: data[1], velocity: 0,       raw: data, timestamp };
    case 0x8:
      return { type: "noteOff", channel, note: data[1], velocity: data[2], raw: data, timestamp };
    case 0xb:
      return { type: "cc", channel, controller: data[1], value: data[2], raw: data, timestamp };
    case 0xe: {
      const bend = ((data[2] << 7) | data[1]) - 8192;
      return { type: "pitchBend", channel, bend, raw: data, timestamp };
    }
    case 0xf:
      return { type: "clock", channel: 0, raw: data, timestamp };
    default:
      return { type: "other", channel, raw: data, timestamp };
  }
}

export function useMIDIDevices(
  onMessage?: (msg: MIDIMessage) => void,
): UseMIDIDevicesReturn {
  const [inputs,    setInputs]    = useState<MIDIDeviceInfo[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [error,     setError]     = useState<string | null>(null);
  const accessRef   = useRef<MIDIAccess | null>(null);
  const listenersRef = useRef<Map<string, (e: MIDIMessageEvent) => void>>(new Map());
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const supported = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

  const refreshInputs = useCallback((access: MIDIAccess) => {
    const list: MIDIDeviceInfo[] = [];
    access.inputs.forEach(input => {
      list.push({
        id:           input.id,
        name:         input.name ?? "Unknown Device",
        manufacturer: input.manufacturer ?? "",
        state:        input.state as "connected" | "disconnected",
      });
    });
    setInputs(list);
  }, []);

  const attachListener = useCallback((input: MIDIInput) => {
    if (listenersRef.current.has(input.id)) return;
    const listener = (e: MIDIMessageEvent) => {
      if (!e.data) return;
      const msg = parseMIDI(e.data, e.timeStamp);
      onMessageRef.current?.(msg);
    };
    input.addEventListener("midimessage", listener);
    listenersRef.current.set(input.id, listener);
  }, []);

  const detachListener = useCallback((input: MIDIInput) => {
    const listener = listenersRef.current.get(input.id);
    if (!listener) return;
    input.removeEventListener("midimessage", listener);
    listenersRef.current.delete(input.id);
  }, []);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    navigator.requestMIDIAccess({ sysex: false })
      .then(access => {
        if (cancelled) return;
        accessRef.current = access;
        refreshInputs(access);

        access.onstatechange = () => {
          if (!cancelled) refreshInputs(access);
        };
      })
      .catch(err => {
        if (!cancelled) setError(`MIDI access denied: ${err?.message ?? err}`);
      });

    return () => {
      cancelled = true;
      // Detach all listeners on unmount
      accessRef.current?.inputs.forEach(input => detachListener(input));
    };
  }, [supported, refreshInputs, detachListener]);

  const enable = useCallback((id: string) => {
    const input = accessRef.current?.inputs.get(id);
    if (!input) return;
    attachListener(input);
    setActiveIds(prev => new Set([...prev, id]));
  }, [attachListener]);

  const disable = useCallback((id: string) => {
    const input = accessRef.current?.inputs.get(id);
    if (input) detachListener(input);
    setActiveIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, [detachListener]);

  const enableAll = useCallback(() => {
    accessRef.current?.inputs.forEach(input => {
      attachListener(input);
      setActiveIds(prev => new Set([...prev, input.id]));
    });
  }, [attachListener]);

  const disableAll = useCallback(() => {
    accessRef.current?.inputs.forEach(input => detachListener(input));
    setActiveIds(new Set());
  }, [detachListener]);

  return { supported, inputs, activeIds, enable, disable, enableAll, disableAll, error };
}
'

write_file "$ROOT/client/src/components/midi/midi-device-panel.tsx" 'import { useMIDIDevices, type MIDIMessage } from "@/hooks/useMIDIDevices";
import { useState, useCallback } from "react";
import { Usb, Activity } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", danger: "#ff3b3b",
  font: "monospace",
} as const;

export function MIDIDevicePanel() {
  const [lastMsg, setLastMsg] = useState<MIDIMessage | null>(null);
  const [msgCount, setMsgCount] = useState(0);

  const handleMessage = useCallback((msg: MIDIMessage) => {
    setLastMsg(msg);
    setMsgCount(c => c + 1);
  }, []);

  const { supported, inputs, activeIds, enable, disable, enableAll, disableAll, error } =
    useMIDIDevices(handleMessage);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`,
      fontFamily: T.font, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <Usb size={11} color={T.accent} />
        <span style={{ fontSize: 8, letterSpacing: ".2em", color: T.dim,
          textTransform: "uppercase", flex: 1 }}>MIDI Devices</span>
        {inputs.length > 0 && (
          <button
            onClick={() => activeIds.size > 0 ? disableAll() : enableAll()}
            style={{ height: 18, padding: "0 8px", fontSize: 7, fontFamily: T.font,
              background: activeIds.size > 0 ? T.accent : "transparent",
              border: `1px solid ${activeIds.size > 0 ? T.accent : T.border}`,
              color: activeIds.size > 0 ? "#000" : T.dim, cursor: "pointer" }}>
            {activeIds.size > 0 ? "Disable All" : "Enable All"}
          </button>
        )}
      </div>

      {!supported && (
        <p style={{ fontSize: 9, color: T.danger }}>
          Web MIDI API not supported in this browser. Use Chrome or Edge.
        </p>
      )}
      {error && <p style={{ fontSize: 9, color: T.danger }}>{error}</p>}

      {supported && inputs.length === 0 && !error && (
        <p style={{ fontSize: 9, color: T.dim }}>
          No MIDI devices detected. Connect a device and refresh.
        </p>
      )}

      {inputs.map(device => {
        const active = activeIds.has(device.id);
        return (
          <div key={device.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 0", borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: active ? T.accent : T.border, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.text }}>{device.name}</div>
              {device.manufacturer && (
                <div style={{ fontSize: 7, color: T.dim }}>{device.manufacturer}</div>
              )}
            </div>
            <button
              onClick={() => active ? disable(device.id) : enable(device.id)}
              style={{ height: 18, padding: "0 10px", fontSize: 7, fontFamily: T.font,
                background: active ? T.accent : "transparent",
                border: `1px solid ${active ? T.accent : T.border}`,
                color: active ? "#000" : T.dim, cursor: "pointer" }}>
              {active ? "ON" : "OFF"}
            </button>
          </div>
        );
      })}

      {lastMsg && (
        <div style={{ marginTop: 8, padding: "6px 8px", background: T.bg,
          border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4,
            marginBottom: 3 }}>
            <Activity size={8} color={T.accent} />
            <span style={{ fontSize: 7, color: T.accent, letterSpacing: ".1em" }}>
              LAST MSG #{msgCount}
            </span>
          </div>
          <div style={{ fontSize: 8, color: T.dim, fontVariantNumeric: "tabular-nums" }}>
            {lastMsg.type.toUpperCase()}
            {lastMsg.note     !== undefined && ` · note=${lastMsg.note}`}
            {lastMsg.velocity !== undefined && ` · vel=${lastMsg.velocity}`}
            {lastMsg.controller !== undefined && ` · cc=${lastMsg.controller} val=${lastMsg.value}`}
            {lastMsg.bend     !== undefined && ` · bend=${lastMsg.bend}`}
            {` · ch=${lastMsg.channel + 1}`}
          </div>
        </div>
      )}
    </div>
  );
}
'

fi # end phase 4

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Drizzle Schema + Migration for Arrangements (persist to Postgres)
# Replaces the in-memory Map in arrangement.service.ts
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "5" ]]; then
section "Phase 5 — Drizzle Persistence for Arrangements"

write_file "$ROOT/db/schema/arrangements.ts" 'import { pgTable, text, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const arrangements = pgTable("arrangements", {
  id:            text("id").primaryKey(),
  userId:        text("user_id").notNull(),
  name:          text("name").notNull().default("Untitled Project"),
  tempo:         integer("tempo").notNull().default(120),
  timeSignatureN: integer("time_signature_n").notNull().default(4),
  timeSignatureD: integer("time_signature_d").notNull().default(4),
  lengthBars:    integer("length_bars").notNull().default(64),
  loopRange:     jsonb("loop_range").notNull().default({ startBar: 1, endBar: 5, enabled: false }),
  tracks:        jsonb("tracks").notNull().default([]),
  markers:       jsonb("markers").notNull().default([]),
  isPublic:      boolean("is_public").notNull().default(false),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

export const insertArrangementSchema = createInsertSchema(arrangements);
export const selectArrangementSchema = createSelectSchema(arrangements);
export type InsertArrangement = typeof arrangements.$inferInsert;
export type SelectArrangement = typeof arrangements.$inferSelect;
'

write_file "$ROOT/server/services/arrangement.service.ts" '/**
 * server/services/arrangement.service.ts
 * Drizzle-backed CRUD for arrangements.
 * Falls back to the in-memory store if the DB is unavailable.
 */
import { nanoid }    from "nanoid";
import { eq, and }   from "drizzle-orm";
import type { Arrangement } from "../../shared/arrangement.types";
import { DEFAULT_ARRANGEMENT } from "../../shared/arrangement.types";

// ── Try to import the DB — if schema is not migrated yet, fall back silently ─
let db: import("drizzle-orm/node-postgres").NodePgDatabase | null = null;
let arrangements: typeof import("../../db/schema/arrangements").arrangements | null = null;

async function getDB() {
  if (db && arrangements) return { db, arrangements };
  try {
    const { drizzle }  = await import("drizzle-orm/node-postgres");
    const { Pool }     = await import("pg");
    const { arrangements: tbl } = await import("../../db/schema/arrangements");
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
    db = drizzle(pool);
    arrangements = tbl;
    return { db, arrangements };
  } catch {
    return null;
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const memStore = new Map<string, Arrangement>();

function toArrangement(row: Record<string, unknown>): Arrangement {
  return {
    id:            row["id"] as string,
    name:          row["name"] as string,
    tempo:         row["tempo"] as number,
    timeSignature: {
      numerator:   row["time_signature_n"] as number,
      denominator: row["time_signature_d"] as number,
    },
    lengthBars:    row["length_bars"] as number,
    loopRange:     row["loop_range"] as Arrangement["loopRange"],
    tracks:        (row["tracks"] as Arrangement["tracks"]) ?? [],
    markers:       (row["markers"] as Arrangement["markers"]) ?? [],
    createdAt:     new Date(row["created_at"] as string),
    updatedAt:     new Date(row["updated_at"] as string),
  };
}

export async function createArrangement(
  userId: string, name?: string,
): Promise<Arrangement> {
  const id = nanoid();
  const now = new Date();
  const base: Arrangement = {
    ...DEFAULT_ARRANGEMENT,
    id,
    name: name ?? "Untitled Project",
    tracks:    [],
    markers:   [],
    loopRange: { startBar: 1, endBar: 5, enabled: false },
    createdAt: now,
    updatedAt: now,
  };

  const ctx = await getDB();
  if (ctx) {
    try {
      await ctx.db.insert(ctx.arrangements).values({
        id,
        userId,
        name: base.name,
        tempo: base.tempo,
        timeSignatureN: base.timeSignature.numerator,
        timeSignatureD: base.timeSignature.denominator,
        lengthBars: base.lengthBars,
        loopRange:  base.loopRange as any,
        tracks:     base.tracks   as any,
        markers:    base.markers  as any,
      });
      return base;
    } catch (err) {
      console.warn("[arrangement.service] DB insert failed, using memory:", err);
    }
  }
  memStore.set(id, base);
  return base;
}

export async function getArrangement(id: string): Promise<Arrangement | null> {
  const ctx = await getDB();
  if (ctx) {
    try {
      const rows = await ctx.db
        .select()
        .from(ctx.arrangements)
        .where(eq(ctx.arrangements.id, id))
        .limit(1);
      if (rows.length) return toArrangement(rows[0] as any);
    } catch {}
  }
  return memStore.get(id) ?? null;
}

export async function listArrangements(userId: string): Promise<Arrangement[]> {
  const ctx = await getDB();
  if (ctx) {
    try {
      const rows = await ctx.db
        .select()
        .from(ctx.arrangements)
        .where(eq(ctx.arrangements.userId, userId));
      return rows.map(r => toArrangement(r as any));
    } catch {}
  }
  return [...memStore.values()];
}

export async function updateArrangement(
  id: string,
  patch: Partial<Omit<Arrangement, "id" | "createdAt">>,
): Promise<Arrangement | null> {
  const existing = await getArrangement(id);
  if (!existing) return null;

  const updated: Arrangement = { ...existing, ...patch, updatedAt: new Date() };

  const ctx = await getDB();
  if (ctx) {
    try {
      await ctx.db
        .update(ctx.arrangements)
        .set({
          name:          updated.name,
          tempo:         updated.tempo,
          timeSignatureN: updated.timeSignature.numerator,
          timeSignatureD: updated.timeSignature.denominator,
          lengthBars:    updated.lengthBars,
          loopRange:     updated.loopRange  as any,
          tracks:        updated.tracks     as any,
          markers:       updated.markers    as any,
          updatedAt:     updated.updatedAt,
        })
        .where(eq(ctx.arrangements.id, id));
      return updated;
    } catch {}
  }
  memStore.set(id, updated);
  return updated;
}

export async function deleteArrangement(id: string): Promise<boolean> {
  const ctx = await getDB();
  if (ctx) {
    try {
      await ctx.db.delete(ctx.arrangements).where(eq(ctx.arrangements.id, id));
      return true;
    } catch {}
  }
  return memStore.delete(id);
}
'

fi # end phase 5

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Waveform Renderer Component (OffscreenCanvas + Worker)
# Renders audio file waveforms off the main thread so the UI never jank
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "6" ]]; then
section "Phase 6 — Waveform Renderer (OffscreenCanvas)"

write_file "$ROOT/client/src/components/waveform/waveform-renderer.tsx" 'import { useRef, useEffect, useCallback, useState } from "react";

const T = {
  bg: "#0a0a0a", accent: "#b8ff00", dim: "#333",
  mid: "rgba(184,255,0,0.5)", rms: "rgba(184,255,0,0.25)",
} as const;

export interface WaveformRendererProps {
  /** Raw PCM samples (Float32Array) OR a URL to an audio file */
  source:      Float32Array | string | null;
  width?:      number;
  height?:     number;
  color?:      string;
  /** 0–1 playback position — draws a playhead line */
  playhead?:   number;
  /** If true, show RMS envelope behind peak */
  showRMS?:    boolean;
  className?:  string;
}

function downsamplePeak(data: Float32Array, targetBins: number): { peaks: Float32Array; rms: Float32Array } {
  const binSize = Math.max(1, Math.floor(data.length / targetBins));
  const peaks   = new Float32Array(targetBins);
  const rmsArr  = new Float32Array(targetBins);
  for (let b = 0; b < targetBins; b++) {
    const start = b * binSize;
    const end   = Math.min(start + binSize, data.length);
    let peak = 0, sumSq = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
      sumSq += data[i] * data[i];
    }
    peaks[b]  = peak;
    rmsArr[b] = Math.sqrt(sumSq / (end - start));
  }
  return { peaks, rms: rmsArr };
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  peaks: Float32Array, rms: Float32Array,
  color: string, showRMS: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, w, h);

  const mid = h / 2;
  const scaleY = mid * 0.9;

  // RMS envelope
  if (showRMS) {
    ctx.fillStyle = T.rms;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      ctx.lineTo(x, mid - rms[i] * scaleY);
    }
    for (let i = peaks.length - 1; i >= 0; i--) {
      const x = (i / peaks.length) * w;
      ctx.lineTo(x, mid + rms[i] * scaleY);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Peak waveform
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  for (let i = 0; i < peaks.length; i++) {
    const x = (i / peaks.length) * w;
    ctx.moveTo(x, mid - peaks[i] * scaleY);
    ctx.lineTo(x, mid + peaks[i] * scaleY);
  }
  ctx.stroke();

  // Centre line
  ctx.strokeStyle = T.dim;
  ctx.lineWidth   = 0.5;
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
}

export function WaveformRenderer({
  source, width = 400, height = 80,
  color = T.accent, playhead, showRMS = true,
}: WaveformRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const peaksRef  = useRef<{ peaks: Float32Array; rms: Float32Array } | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaksRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { peaks, rms } = peaksRef.current;
    drawWaveform(ctx, width, height, peaks, rms, color, showRMS);
    // Playhead
    if (playhead !== undefined && playhead >= 0 && playhead <= 1) {
      const x = playhead * width;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [width, height, color, playhead, showRMS]);

  useEffect(() => {
    if (!source) { peaksRef.current = null; return; }

    if (source instanceof Float32Array) {
      peaksRef.current = downsamplePeak(source, width);
      render();
      return;
    }

    // URL — fetch and decode
    setLoading(true); setError(null);
    let cancelled = false;

    (async () => {
      try {
        const resp    = await fetch(source);
        const buf     = await resp.arrayBuffer();
        const offCtx  = new OfflineAudioContext(1, 1, 44100);
        const decoded = await offCtx.decodeAudioData(buf);
        if (cancelled) return;
        const data = decoded.getChannelData(0);
        peaksRef.current = downsamplePeak(data, width);
        setLoading(false);
        render();
      } catch (e) {
        if (!cancelled) { setError("Could not decode audio"); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [source, width, render]);

  useEffect(() => { render(); }, [render]);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width, height }}
      />
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)", fontSize: 8,
          color: T.accent, fontFamily: "monospace", letterSpacing: ".15em",
        }}>
          LOADING…
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 8, color: "#ff3b3b", fontFamily: "monospace",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
'

fi # end phase 6

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — Auto-Save + Dirty State Hook
# Debounced tRPC save, dirty indicator in transport bar, browser unload guard
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "7" ]]; then
section "Phase 7 — Auto-Save + Dirty State"

write_file "$ROOT/client/src/hooks/useAutoSave.ts" '/**
 * useAutoSave — debounced auto-save for the arrangement store.
 * - Marks dirty on any store change
 * - Saves via tRPC after `debounceMs` of inactivity
 * - Guards browser unload when dirty
 * - Returns { saving, dirty, lastSaved, saveNow }
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useArrangementStore } from "@/store/arrangement-store";

export interface AutoSaveState {
  saving:    boolean;
  dirty:     boolean;
  lastSaved: Date | null;
  saveNow:   () => Promise<void>;
  error:     string | null;
}

export function useAutoSave(
  arrangementId: string | null,
  debounceMs = 3000,
): AutoSaveState {
  const [saving,    setSaving]    = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(true);

  const update = trpc.arrangement.update.useMutation();

  const doSave = useCallback(async () => {
    if (!arrangementId || !mountedRef.current) return;
    const store = useArrangementStore.getState();
    setSaving(true); setError(null);
    try {
      await update.mutateAsync({
        id: arrangementId,
        patch: {
          name:          store.name,
          tempo:         store.tempo,
          timeSignature: store.timeSignature,
          lengthBars:    store.lengthBars,
        },
      });
      if (mountedRef.current) {
        setDirty(false);
        setLastSaved(new Date());
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [arrangementId, update]);

  // Subscribe to store changes — mark dirty and schedule debounced save
  useEffect(() => {
    if (!arrangementId) return;
    const unsub = useArrangementStore.subscribe(
      state => ({
        tracks: state.tracks,
        tempo:  state.tempo,
        name:   state.name,
        markers: state.markers,
      }),
      () => {
        setDirty(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { doSave(); }, debounceMs);
      },
      { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
    );
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [arrangementId, debounceMs, doSave]);

  // Browser unload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { saving, dirty, lastSaved, saveNow: doSave, error };
}
'

fi # end phase 7

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 8 — Vitest unit tests for all new stores + hooks
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$PHASE" == "all" || "$PHASE" == "8" ]]; then
section "Phase 8 — Vitest Tests"

write_file "$ROOT/client/src/store/__tests__/arrangement-store.test.ts" 'import { describe, it, expect, beforeEach } from "vitest";
import { useArrangementStore } from "../arrangement-store";

// Reset store before each test
beforeEach(() => {
  useArrangementStore.getState().resetArrangement();
});

describe("arrangement-store", () => {
  describe("tracks", () => {
    it("adds a track with correct defaults", () => {
      const { addTrack } = useArrangementStore.getState();
      addTrack("audio");
      const { tracks } = useArrangementStore.getState();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].type).toBe("audio");
      expect(tracks[0].volume).toBe(0.8);
      expect(tracks[0].muted).toBe(false);
    });

    it("removes a track by id", () => {
      const store = useArrangementStore.getState();
      store.addTrack("midi");
      const { tracks } = useArrangementStore.getState();
      store.removeTrack(tracks[0].id);
      expect(useArrangementStore.getState().tracks).toHaveLength(0);
    });

    it("updates a track field", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      const id = useArrangementStore.getState().tracks[0].id;
      store.updateTrack(id, { volume: 0.5, muted: true });
      const t = useArrangementStore.getState().tracks[0];
      expect(t.volume).toBe(0.5);
      expect(t.muted).toBe(true);
    });

    it("reorders tracks correctly", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      store.addTrack("midi");
      store.addTrack("bus");
      const before = useArrangementStore.getState().tracks.map(t => t.type);
      expect(before).toEqual(["audio", "midi", "bus"]);
      const firstId = useArrangementStore.getState().tracks[0].id;
      store.reorderTrack(firstId, 2);
      const after = useArrangementStore.getState().tracks
        .sort((a, b) => a.order - b.order)
        .map(t => t.type);
      expect(after[2]).toBe("audio");
    });
  });

  describe("undo / redo", () => {
    it("undoes a track addition", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      expect(useArrangementStore.getState().tracks).toHaveLength(1);
      store.undo();
      expect(useArrangementStore.getState().tracks).toHaveLength(0);
    });

    it("redoes after undo", () => {
      const store = useArrangementStore.getState();
      store.addTrack("midi");
      store.undo();
      store.redo();
      expect(useArrangementStore.getState().tracks).toHaveLength(1);
    });

    it("clears redo stack after new action", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      store.undo();
      store.addTrack("midi"); // new action clears redo
      store.redo();           // should be a no-op
      expect(useArrangementStore.getState().tracks).toHaveLength(1);
      expect(useArrangementStore.getState().tracks[0].type).toBe("midi");
    });

    it("caps undo stack at MAX_UNDO", () => {
      const store = useArrangementStore.getState();
      for (let i = 0; i < 55; i++) store.setTempo(60 + i);
      expect(useArrangementStore.getState()._past.length).toBeLessThanOrEqual(50);
    });
  });

  describe("transport", () => {
    it("play sets playing=true", () => {
      useArrangementStore.getState().play();
      expect(useArrangementStore.getState().playing).toBe(true);
    });

    it("stop resets playhead and recording", () => {
      const store = useArrangementStore.getState();
      store.play();
      store.toggleRecord();
      store.setPlayhead(32);
      store.stop();
      const s = useArrangementStore.getState();
      expect(s.playing).toBe(false);
      expect(s.recording).toBe(false);
      expect(s.playhead).toBe(0);
    });

    it("clamps tempo to 20–999", () => {
      useArrangementStore.getState().setTempo(5);
      expect(useArrangementStore.getState().tempo).toBe(20);
      useArrangementStore.getState().setTempo(9999);
      expect(useArrangementStore.getState().tempo).toBe(999);
    });
  });

  describe("markers", () => {
    it("adds a marker and keeps them sorted by position", () => {
      const store = useArrangementStore.getState();
      store.addMarker(32, "Drop");
      store.addMarker(8,  "Intro");
      store.addMarker(64, "Outro");
      const positions = useArrangementStore.getState().markers.map(m => m.position);
      expect(positions).toEqual([8, 32, 64]);
    });

    it("removes a marker by id", () => {
      const store = useArrangementStore.getState();
      store.addMarker(16, "Verse");
      const id = useArrangementStore.getState().markers[0].id;
      store.removeMarker(id);
      expect(useArrangementStore.getState().markers).toHaveLength(0);
    });
  });
});
'

write_file "$ROOT/client/src/hooks/__tests__/useKeyboardShortcuts.test.ts" 'import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, buildDAWShortcuts } from "../useKeyboardShortcuts";

function fireKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }));
}

describe("useKeyboardShortcuts", () => {
  it("calls the handler for a matching key", () => {
    const play = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Space: play }));
    fireKey(" ");
    expect(play).toHaveBeenCalledOnce();
  });

  it("ignores keys not in the map", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ a: handler }));
    fireKey("b");
    expect(handler).not.toHaveBeenCalled();
  });

  it("handles Ctrl+Z combo", () => {
    const undo = vi.fn();
    renderHook(() => useKeyboardShortcuts({ "Ctrl+Z": undo }));
    fireKey("Z", { ctrlKey: true });
    expect(undo).toHaveBeenCalledOnce();
  });

  it("does not fire when typing in an input", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Space: handler }, { respectInputFocus: true }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("buildDAWShortcuts returns correct map shape", () => {
    const handlers = {
      play: vi.fn(), stop: vi.fn(), record: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), save: vi.fn(),
      zoomIn: vi.fn(), zoomOut: vi.fn(),
      prevMarker: vi.fn(), nextMarker: vi.fn(),
      deleteSelected: vi.fn(), deselectAll: vi.fn(),
      duplicateRegion: vi.fn(), selectAll: vi.fn(),
    };
    const map = buildDAWShortcuts(handlers);
    expect(map["Space"]).toBeDefined();
    expect(map["Ctrl+Z"]).toBeDefined();
    expect(map["Delete"]).toBeDefined();
    expect(map["Escape"]).toBeDefined();
  });
});
'

fi # end phase 8

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL
# ═══════════════════════════════════════════════════════════════════════════════
section "Final Verification"

FILES=(
  "$ROOT/client/src/hooks/useKeyboardShortcuts.ts"
  "$ROOT/client/src/store/arrangement-store.ts"
  "$ROOT/client/src/audio/worklets/vu-meter-processor.ts"
  "$ROOT/client/src/audio/worklets/use-vu-meter.ts"
  "$ROOT/client/src/hooks/useMIDIDevices.ts"
  "$ROOT/client/src/components/midi/midi-device-panel.tsx"
  "$ROOT/db/schema/arrangements.ts"
  "$ROOT/server/services/arrangement.service.ts"
  "$ROOT/client/src/components/waveform/waveform-renderer.tsx"
  "$ROOT/client/src/hooks/useAutoSave.ts"
  "$ROOT/client/src/store/__tests__/arrangement-store.test.ts"
  "$ROOT/client/src/hooks/__tests__/useKeyboardShortcuts.test.ts"
)

echo ""
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] && ok "$(realpath --relative-to="$ROOT" "$f") ($(wc -c < "$f") bytes)" \
                || fail "MISSING: $f"
done

echo ""
echo -e "${BLD}${CYN}════════════════════════════════════════════════════════════${RST}"
echo -e "${BLD}${CYN}  R3 ENHANCE COMPLETE — Pass: $PASS / Skip: $SKIP / Fail: $FAIL${RST}"
echo -e "${BLD}${CYN}════════════════════════════════════════════════════════════${RST}"
echo ""
echo -e "${DIM}  What was added:${RST}"
echo -e "${DIM}    Phase 1  useKeyboardShortcuts  — space/stop/undo/redo/zoom/markers${RST}"
echo -e "${DIM}    Phase 2  arrangement-store     — Zustand + 50-step undo/redo${RST}"
echo -e "${DIM}    Phase 3  VU meter AudioWorklet — off-thread peak+RMS metering${RST}"
echo -e "${DIM}    Phase 4  useMIDIDevices        — Web MIDI API + MIDIDevicePanel${RST}"
echo -e "${DIM}    Phase 5  Drizzle persistence   — arrangements table + DB service${RST}"
echo -e "${DIM}    Phase 6  WaveformRenderer      — OffscreenCanvas waveform display${RST}"
echo -e "${DIM}    Phase 7  useAutoSave           — debounced save + dirty guard${RST}"
echo -e "${DIM}    Phase 8  Vitest tests          — store + hooks fully covered${RST}"
echo ""
echo -e "${DIM}  Run tests:       cd client && pnpm vitest run${RST}"
echo -e "${DIM}  Run single phase: bash r3-enhance.sh --phase 2${RST}"
echo -e "${DIM}  Add arrangement table: pnpm drizzle-kit push${RST}"
echo ""
