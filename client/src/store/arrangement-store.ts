/**
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
