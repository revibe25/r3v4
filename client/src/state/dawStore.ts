/**
 * dawStore.ts — Single source of truth for the entire DAW.
 *
 * Architecture:
 *   React UI  →  dawStore  →  Scheduler  →  LLPTE Engine  →  Audio Out
 *
 * Rules enforced here:
 *   - UI never talks directly to the engine
 *   - Engine never mutates store state; it only reads scheduled data
 *   - Every user action is a store mutation + optional engine command
 */
import { create } from "zustand";
import { subscribeWithSelector, devtools } from "zustand/middleware";
import type { ArrangementTrack, ArrangementMarker, Region } from "../../../shared/arrangement.types";
import type { AutomationLane, AutomationPoint } from "../../../shared/automation.types";
import { DEFAULT_TRACK_COLORS } from "../../../shared/arrangement.types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SnapValue = "1" | "1/2" | "1/4" | "1/8" | "1/16" | "1/32" | "off";
export type EditTool  = "select" | "draw" | "erase" | "cut" | "fade";
export type ViewMode  = "arrangement" | "mixer" | "piano" | "automation";

export interface TransportState {
  isPlaying:     boolean;
  isRecording:   boolean;
  isLooping:     boolean;
  metronomeOn:   boolean;
  tempo:         number;
  currentTime:   number;   // seconds (float, driven by RAF clock)
  currentBar:    number;   // 1-indexed
  currentBeat:   number;   // 1-indexed
  currentTick:   number;   // 0–479
  timeSignature: { numerator: number; denominator: number };
  loopStart:     number;   // bars
  loopEnd:       number;   // bars
}

export interface MixerChannelState {
  id:       string;
  name:     string;
  volume:   number;   // 0–1
  pan:      number;   // -1 to 1
  muted:    boolean;
  soloed:   boolean;
  armed:    boolean;
  peakL:    number;
  peakR:    number;
  inserts:  string[];
}

export interface SelectionState {
  trackId:    string | null;
  regionIds:  string[];
  noteIds:    string[];
  timeRange:  { start: number; end: number } | null;
}

export interface ViewState {
  mode:           ViewMode;
  scrollX:        number;
  scrollY:        number;
  pxPerBar:       number;   // zoom level
  visibleBars:    number;
  snap:           SnapValue;
  tool:           EditTool;
  showAutomation: boolean;
  showMixer:      boolean;
  showInspector:  boolean;
  showPianoRoll:  boolean;
  focusedTrackId: string | null;
}

export interface DAWState {
  // ── Core data ──────────────────────────────────────────────────────────────
  projectId:   string | null;
  projectName: string;
  tracks:      ArrangementTrack[];
  markers:     ArrangementMarker[];
  automation:  Record<string, AutomationLane[]>;  // keyed by trackId

  // ── Sub-state slices ───────────────────────────────────────────────────────
  transport:   TransportState;
  mixer:       Record<string, MixerChannelState>;
  selection:   SelectionState;
  view:        ViewState;

  // ── Dirty / persistence ────────────────────────────────────────────────────
  isDirty:     boolean;
  lastSavedAt: Date | null;

  // ── Transport actions ──────────────────────────────────────────────────────
  play:              () => void;
  stop:              () => void;
  pause:             () => void;
  toggleRecord:      () => void;
  toggleLoop:        () => void;
  toggleMetronome:   () => void;
  setTempo:          (bpm: number) => void;
  setTimeSignature:  (n: number, d: number) => void;
  seekTo:            (bar: number) => void;
  setCurrentTime:    (seconds: number) => void;
  setLoopPoints:     (start: number, end: number) => void;

  // ── Track actions ──────────────────────────────────────────────────────────
  addTrack:       (type?: ArrangementTrack["type"], name?: string) => ArrangementTrack;
  removeTrack:    (id: string) => void;
  updateTrack:    (id: string, patch: Partial<ArrangementTrack>) => void;
  duplicateTrack: (id: string) => void;
  reorderTracks:  (fromIdx: number, toIdx: number) => void;
  selectTrack:    (id: string | null) => void;

  // ── Region actions ─────────────────────────────────────────────────────────
  addRegion:      (trackId: string, region: Omit<Region, "id">) => Region;
  removeRegion:   (trackId: string, regionId: string) => void;
  updateRegion:   (trackId: string, regionId: string, patch: Partial<Region>) => void;
  moveRegion:     (regionId: string, toTrackId: string, startBar: number) => void;
  splitRegion:    (regionId: string, atBar: number) => void;
  duplicateRegion:(regionId: string) => void;
  selectRegions:  (regionIds: string[]) => void;

  // ── Mixer actions ──────────────────────────────────────────────────────────
  setChannelVolume: (id: string, v: number) => void;
  setChannelPan:    (id: string, v: number) => void;
  toggleMute:       (id: string) => void;
  toggleSolo:       (id: string) => void;
  toggleArm:        (id: string) => void;
  updatePeaks:      (id: string, peakL: number, peakR: number) => void;

  // ── View actions ───────────────────────────────────────────────────────────
  setViewMode:    (mode: ViewMode) => void;
  setZoom:        (pxPerBar: number) => void;
  zoomIn:         () => void;
  zoomOut:        () => void;
  setSnap:        (snap: SnapValue) => void;
  setTool:        (tool: EditTool) => void;
  setScroll:      (x: number, y: number) => void;
  togglePanel:    (panel: "mixer" | "inspector" | "piano" | "automation") => void;

  // ── Marker actions ─────────────────────────────────────────────────────────
  addMarker:    (bar: number, name?: string) => void;
  removeMarker: (id: string) => void;
  jumpToMarker: (id: string) => void;

  // ── Automation actions ─────────────────────────────────────────────────────
  addAutomationPoint:    (trackId: string, laneId: string, point: Omit<AutomationPoint, "id">) => void;
  removeAutomationPoint: (trackId: string, laneId: string, pointId: string) => void;
  updateAutomationPoint: (trackId: string, laneId: string, pointId: string, patch: Partial<AutomationPoint>) => void;

  // ── Project ────────────────────────────────────────────────────────────────
  markDirty:      () => void;
  markClean:      () => void;
  loadProject:    (data: Partial<DAWState>) => void;
  resetProject:   () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_TRANSPORT: TransportState = {
  isPlaying: false, isRecording: false, isLooping: false, metronomeOn: false,
  tempo: 120, currentTime: 0, currentBar: 1, currentBeat: 1, currentTick: 0,
  timeSignature: { numerator: 4, denominator: 4 },
  loopStart: 1, loopEnd: 5,
};

const DEFAULT_VIEW: ViewState = {
  mode: "arrangement", scrollX: 0, scrollY: 0, pxPerBar: 80,
  visibleBars: 64, snap: "1/4", tool: "select",
  showAutomation: false, showMixer: true,
  showInspector: true, showPianoRoll: false, focusedTrackId: null,
};

const DEFAULT_SELECTION: SelectionState = {
  trackId: null, regionIds: [], noteIds: [], timeRange: null,
};

let _tid = 0; let _rid = 0; let _mid = 0;
const uid = (p: string) => `${p}_${Date.now()}_${(++_tid).toString(36)}`;

function barsToSeconds(bars: number, tempo: number, sig: { numerator: number }): number {
  const beatsPerBar = sig.numerator;
  const secondsPerBeat = 60 / tempo;
  return (bars - 1) * beatsPerBar * secondsPerBeat;
}

function makeChannel(track: ArrangementTrack): MixerChannelState {
  return {
    id: track.id, name: track.name,
    volume: track.volume, pan: track.pan,
    muted: track.muted, soloed: track.soloed, armed: track.armed,
    peakL: 0, peakR: 0, inserts: [],
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDAWStore = create<DAWState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      projectId:   null,
      projectName: "Untitled Project",
      tracks:      [],
      markers:     [],
      automation:  {},
      transport:   { ...DEFAULT_TRANSPORT },
      mixer:       {},
      selection:   { ...DEFAULT_SELECTION },
      view:        { ...DEFAULT_VIEW },
      isDirty:     false,
      lastSavedAt: null,

      // ── Transport ────────────────────────────────────────────────────────────
      play() {
        set(s => ({ transport: { ...s.transport, isPlaying: true }, isDirty: false }));
      },
      stop() {
        set(s => ({
          transport: {
            ...s.transport,
            isPlaying: false, isRecording: false,
            currentTime: 0, currentBar: 1, currentBeat: 1, currentTick: 0,
          },
        }));
      },
      pause() {
        set(s => ({ transport: { ...s.transport, isPlaying: false } }));
      },
      toggleRecord() {
        set(s => ({ transport: { ...s.transport, isRecording: !s.transport.isRecording } }));
      },
      toggleLoop() {
        set(s => ({ transport: { ...s.transport, isLooping: !s.transport.isLooping } }));
      },
      toggleMetronome() {
        set(s => ({ transport: { ...s.transport, metronomeOn: !s.transport.metronomeOn } }));
      },
      setTempo(bpm) {
        const clamped = Math.max(20, Math.min(999, bpm));
        set(s => ({ transport: { ...s.transport, tempo: clamped }, isDirty: true }));
      },
      setTimeSignature(n, d) {
        set(s => ({ transport: { ...s.transport, timeSignature: { numerator: n, denominator: d } }, isDirty: true }));
      },
      seekTo(bar) {
        const { transport } = get();
        const seconds = barsToSeconds(Math.max(1, bar), transport.tempo, transport.timeSignature);
        set(s => ({ transport: { ...s.transport, currentTime: seconds, currentBar: Math.max(1, bar), currentBeat: 1, currentTick: 0 } }));
      },
      setCurrentTime(seconds) {
        const { transport } = get();
        const { tempo, timeSignature: sig } = transport;
        const secondsPerBeat = 60 / tempo;
        const totalBeats = seconds / secondsPerBeat;
        const currentBar  = Math.floor(totalBeats / sig.numerator) + 1;
        const currentBeat = Math.floor(totalBeats % sig.numerator) + 1;
        const currentTick = Math.floor((totalBeats % 1) * 480);
        set(s => ({ transport: { ...s.transport, currentTime: seconds, currentBar, currentBeat, currentTick } }));
      },
      setLoopPoints(start, end) {
        set(s => ({ transport: { ...s.transport, loopStart: start, loopEnd: end }, isDirty: true }));
      },

      // ── Tracks ───────────────────────────────────────────────────────────────
      addTrack(type = "audio", name?) {
        const color = DEFAULT_TRACK_COLORS[get().tracks.length % DEFAULT_TRACK_COLORS.length];
        const track: ArrangementTrack = {
          id: uid("t"), name: name ?? `${type.charAt(0).toUpperCase()}${type.slice(1)} ${++_tid}`,
          type, color, height: 64,
          muted: false, soloed: false, armed: false,
          volume: 0.8, pan: 0, regions: [],
          order: get().tracks.length,
        };
        set(s => ({
          tracks: [...s.tracks, track],
          mixer:  { ...s.mixer, [track.id]: makeChannel(track) },
          isDirty: true,
        }));
        return track;
      },
      removeTrack(id) {
        set(s => {
          const mixer = { ...s.mixer };
          delete mixer[id];
          return {
            tracks:    s.tracks.filter(t => t.id !== id).map((t, i) => ({ ...t, order: i })),
            mixer,
            selection: { ...s.selection, trackId: s.selection.trackId === id ? null : s.selection.trackId },
            isDirty:   true,
          };
        });
      },
      updateTrack(id, patch) {
        set(s => ({
          tracks:  s.tracks.map(t => t.id === id ? { ...t, ...patch } : t),
          mixer:   s.mixer[id] ? { ...s.mixer, [id]: { ...s.mixer[id], ...patch } } : s.mixer,
          isDirty: true,
        }));
      },
      duplicateTrack(id) {
        const src = get().tracks.find(t => t.id === id);
        if (!src) return;
        const copy: ArrangementTrack = {
          ...src,
          id: uid("t"),
          name: `${src.name} (copy)`,
          order: get().tracks.length,
          regions: src.regions.map(r => ({ ...r, id: uid("r") })),
        };
        set(s => ({
          tracks: [...s.tracks, copy],
          mixer:  { ...s.mixer, [copy.id]: makeChannel(copy) },
          isDirty: true,
        }));
      },
      reorderTracks(fromIdx, toIdx) {
        set(s => {
          const arr = [...s.tracks].sort((a, b) => a.order - b.order);
          const [moved] = arr.splice(fromIdx, 1);
          arr.splice(toIdx, 0, moved);
          return { tracks: arr.map((t, i) => ({ ...t, order: i })), isDirty: true };
        });
      },
      selectTrack(id) {
        set(s => ({ selection: { ...s.selection, trackId: id, regionIds: [], noteIds: [] }, view: { ...s.view, focusedTrackId: id } }));
      },

      // ── Regions ──────────────────────────────────────────────────────────────
      addRegion(trackId, data) {
        const region = { ...data, id: uid("r") } as Region;
        set(s => ({
          tracks: s.tracks.map(t =>
            t.id === trackId ? { ...t, regions: [...t.regions, region] } : t
          ),
          isDirty: true,
        }));
        return region;
      },
      removeRegion(trackId, regionId) {
        set(s => ({
          tracks: s.tracks.map(t =>
            t.id === trackId ? { ...t, regions: t.regions.filter(r => r.id !== regionId) } : t
          ),
          isDirty: true,
        }));
      },
      updateRegion(trackId, regionId, patch) {
        set(s => ({
          tracks: s.tracks.map(t =>
            t.id !== trackId ? t : {
              ...t, regions: t.regions.map(r =>
                r.id !== regionId ? r : { ...r, ...patch } as Region
              ),
            }
          ),
          isDirty: true,
        }));
      },
      moveRegion(regionId, toTrackId, startBar) {
        const { tracks } = get();
        let region: Region | undefined;
        let fromTrackId: string | undefined;
        for (const t of tracks) {
          const r = t.regions.find(r => r.id === regionId);
          if (r) { region = r; fromTrackId = t.id; break; }
        }
        if (!region || !fromTrackId) return;
        const moved = { ...region, trackId: toTrackId, startBar } as Region;
        set(s => ({
          tracks: s.tracks.map(t => {
            if (t.id === fromTrackId) return { ...t, regions: t.regions.filter(r => r.id !== regionId) };
            if (t.id === toTrackId)  return { ...t, regions: [...t.regions, moved] };
            return t;
          }),
          isDirty: true,
        }));
      },
      splitRegion(regionId, atBar) {
        const { tracks } = get();
        for (const track of tracks) {
          const region = track.regions.find(r => r.id === regionId);
          if (!region) continue;
          if (atBar <= region.startBar || atBar >= region.startBar + region.length) return;
          const leftLen  = atBar - region.startBar;
          const rightLen = region.length - leftLen;
          const left:  Region = { ...region, length: leftLen };
          const right: Region = { ...region, id: uid("r"), startBar: atBar, length: rightLen };
          set(s => ({
            tracks: s.tracks.map(t =>
              t.id !== track.id ? t : {
                ...t, regions: [...t.regions.filter(r => r.id !== regionId), left, right],
              }
            ),
            isDirty: true,
          }));
          return;
        }
      },
      duplicateRegion(regionId) {
        const { tracks } = get();
        for (const track of tracks) {
          const region = track.regions.find(r => r.id === regionId);
          if (!region) continue;
          const copy: Region = { ...region, id: uid("r"), startBar: region.startBar + region.length };
          set(s => ({
            tracks: s.tracks.map(t =>
              t.id !== track.id ? t : { ...t, regions: [...t.regions, copy] }
            ),
            isDirty: true,
          }));
          return;
        }
      },
      selectRegions(ids) {
        set(s => ({ selection: { ...s.selection, regionIds: ids } }));
      },

      // ── Mixer ────────────────────────────────────────────────────────────────
      setChannelVolume(id, v) {
        set(s => ({
          mixer:  { ...s.mixer, [id]: { ...s.mixer[id], volume: Math.max(0, Math.min(1, v)) } },
          tracks: s.tracks.map(t => t.id === id ? { ...t, volume: v } : t),
          isDirty: true,
        }));
      },
      setChannelPan(id, v) {
        set(s => ({
          mixer:  { ...s.mixer, [id]: { ...s.mixer[id], pan: Math.max(-1, Math.min(1, v)) } },
          tracks: s.tracks.map(t => t.id === id ? { ...t, pan: v } : t),
          isDirty: true,
        }));
      },
      toggleMute(id) {
        set(s => {
          const muted = !s.mixer[id]?.muted;
          return {
            mixer:  { ...s.mixer, [id]: { ...s.mixer[id], muted } },
            tracks: s.tracks.map(t => t.id === id ? { ...t, muted } : t),
            isDirty: true,
          };
        });
      },
      toggleSolo(id) {
        set(s => {
          const soloed = !s.mixer[id]?.soloed;
          return {
            mixer:  { ...s.mixer, [id]: { ...s.mixer[id], soloed } },
            tracks: s.tracks.map(t => t.id === id ? { ...t, soloed } : t),
            isDirty: true,
          };
        });
      },
      toggleArm(id) {
        set(s => {
          const armed = !s.mixer[id]?.armed;
          return {
            mixer:  { ...s.mixer, [id]: { ...s.mixer[id], armed } },
            tracks: s.tracks.map(t => t.id === id ? { ...t, armed } : t),
            isDirty: true,
          };
        });
      },
      updatePeaks(id, peakL, peakR) {
        set(s => ({ mixer: { ...s.mixer, [id]: { ...s.mixer[id], peakL, peakR } } }));
      },

      // ── View ─────────────────────────────────────────────────────────────────
      setViewMode(mode) { set(s => ({ view: { ...s.view, mode } })); },
      setZoom(pxPerBar) {
        set(s => ({ view: { ...s.view, pxPerBar: Math.max(20, Math.min(400, pxPerBar)) } }));
      },
      zoomIn()  { get().setZoom(get().view.pxPerBar * 1.25); },
      zoomOut() { get().setZoom(get().view.pxPerBar * 0.8); },
      setSnap(snap) { set(s => ({ view: { ...s.view, snap } })); },
      setTool(tool) { set(s => ({ view: { ...s.view, tool } })); },
      setScroll(x, y) { set(s => ({ view: { ...s.view, scrollX: Math.max(0, x), scrollY: Math.max(0, y) } })); },
      togglePanel(panel) {
        set(s => {
          const v = s.view;
          if (panel === "mixer")      return { view: { ...v, showMixer: !v.showMixer } };
          if (panel === "inspector")  return { view: { ...v, showInspector: !v.showInspector } };
          if (panel === "piano")      return { view: { ...v, showPianoRoll: !v.showPianoRoll } };
          if (panel === "automation") return { view: { ...v, showAutomation: !v.showAutomation } };
          return {};
        });
      },

      // ── Markers ──────────────────────────────────────────────────────────────
      addMarker(bar, name) {
        const COLORS = ["#b8ff00","#00e5ff","#ff6b35","#a855f7","#22c55e","#f59e0b"];
        const color  = COLORS[get().markers.length % COLORS.length];
        const marker: ArrangementMarker = { id: uid("m"), position: bar, name: name ?? `Marker ${++_mid}`, color };
        set(s => ({ markers: [...s.markers, marker].sort((a, b) => a.position - b.position), isDirty: true }));
      },
      removeMarker(id) { set(s => ({ markers: s.markers.filter(m => m.id !== id), isDirty: true })); },
      jumpToMarker(id) {
        const m = get().markers.find(m => m.id === id);
        if (m) get().seekTo(m.position);
      },

      // ── Automation ───────────────────────────────────────────────────────────
      addAutomationPoint(trackId, laneId, point) {
        const newPt = { ...point, id: uid("ap") } as AutomationPoint;
        set(s => {
          const lanes = s.automation[trackId] ?? [];
          return {
            automation: {
              ...s.automation,
              [trackId]: lanes.map(l =>
                l.id !== laneId ? l : {
                  ...l, points: [...l.points, newPt].sort((a, b) => a.position - b.position),
                }
              ),
            },
            isDirty: true,
          };
        });
      },
      removeAutomationPoint(trackId, laneId, pointId) {
        set(s => ({
          automation: {
            ...s.automation,
            [trackId]: (s.automation[trackId] ?? []).map(l =>
              l.id !== laneId ? l : { ...l, points: l.points.filter(p => p.id !== pointId) }
            ),
          },
          isDirty: true,
        }));
      },
      updateAutomationPoint(trackId, laneId, pointId, patch) {
        set(s => ({
          automation: {
            ...s.automation,
            [trackId]: (s.automation[trackId] ?? []).map(l =>
              l.id !== laneId ? l : {
                ...l, points: l.points.map(p => p.id !== pointId ? p : { ...p, ...patch }),
              }
            ),
          },
          isDirty: true,
        }));
      },

      // ── Project ──────────────────────────────────────────────────────────────
      markDirty()    { set({ isDirty: true }); },
      markClean()    { set({ isDirty: false, lastSavedAt: new Date() }); },
      loadProject(data) {
        set({ ...data, isDirty: false, lastSavedAt: new Date() } as Partial<DAWState>);
      },
      resetProject() {
        set({
          projectId: null, projectName: "Untitled Project",
          tracks: [], markers: [], automation: {},
          transport: { ...DEFAULT_TRANSPORT },
          mixer: {}, selection: { ...DEFAULT_SELECTION },
          view: { ...DEFAULT_VIEW },
          isDirty: false, lastSavedAt: null,
        });
      },
    })),
    { name: "R3-DAW" }
  )
);

// ── Selectors (stable references — prevent unnecessary re-renders) ─────────────
export const useTracks    = () => useDAWStore(s => s.tracks);
export const useTransport = () => useDAWStore(s => s.transport);
export const useView      = () => useDAWStore(s => s.view);
export const useMixer     = () => useDAWStore(s => s.mixer);
export const useSelection = () => useDAWStore(s => s.selection);
export const useMarkers   = () => useDAWStore(s => s.markers);
export const useIsDirty   = () => useDAWStore(s => s.isDirty);
export const useSelectedTrack = () =>
  useDAWStore(s => s.tracks.find(t => t.id === s.selection.trackId) ?? null);
