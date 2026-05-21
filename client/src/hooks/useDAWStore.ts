// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber)
// Reason: Store default track state color — initial channel strip warning threshold
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
/**
 * useDAWStore.ts
 * Central Zustand store for R3 v4 DAW state.
 * Covers: transport, tracks, arrangement, mixer, FX, MIDI sequencer,
 *         collaboration, cloud sync, AI co-producer, adaptive mastering.
 *
 * All Level 1 / 2 / 3 feature state lives here so DAW.tsx has a single
 * import for reactive reads. Side-effectful operations (audio, WebSocket,
 * tRPC) are handled in companion hooks that call these actions.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ── Track / Arrangement ───────────────────────────────────────────────────────

export interface FXSlot {
  id: string;
  type: 'eq' | 'compressor' | 'reverb' | 'delay' | 'filter' | 'distortion';
  enabled: boolean;
  params: Record<string, number>;
}

export interface TrackRegion {
  id: string;
  trackId: string;
  startBeat: number;
  lengthBeats: number;
  clipId: string;
  label: string;
  color: string;
}

export interface Track {
  id: string;
  label: string;
  type: 'audio' | 'midi' | 'bus' | 'instrument';
  color: string;
  gain: number;        // 0–1.5
  pan: number;         // -1 to 1
  mute: boolean;
  solo: boolean;
  armed: boolean;
  fxChain: FXSlot[];
  sends: { busId: string; level: number }[];
  inputSource: string | null;
}

// ── MIDI Sequencer (Level 2) ──────────────────────────────────────────────────

export type MidiNote = {
  id: string;
  pitch: number;    // MIDI note number 0–127
  step: number;     // 0–31 (32-step grid)
  duration: number; // in steps
  velocity: number; // 0–127
};

export interface MidiPattern {
  id: string;
  name: string;
  steps: 16 | 32 | 64;
  notes: MidiNote[];
  trackId: string;
}

// ── Collaboration (Level 2) ───────────────────────────────────────────────────

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursorBeat: number | null;
  activeTrackId: string | null;
  joinedAt: number;
}

// ── Cloud Sync (Level 2) ──────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

// ── Mastering (Level 3) ───────────────────────────────────────────────────────

export interface MasteringState {
  enabled: boolean;
  targetLUFS: number;         // -23 to -6
  ceilingDB: number;          // -1 to 0
  dynamicsMode: 'natural' | 'compressed' | 'punchy';
  stereoWidth: number;        // 0–2
  analysisResult: {
    inputLUFS: number;
    inputPeak: number;
    outputLUFS: number;
    dynamicRange: number;
    recommendation: string;
  } | null;
  processing: boolean;
}

/** Alias kept for DAW.tsx import compatibility */
export type MasteringSettings = MasteringState;
export type TimeSignature = [number, number];

// ── AI Co-Producer (Level 3) ──────────────────────────────────────────────────

export interface AISuggestion {
  id: string;
  type: 'arrangement' | 'mix' | 'mastering' | 'harmony' | 'rhythm';
  confidence: number;
  description: string;
  params: Record<string, unknown>;
  accepted: boolean | null;
  createdAt: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ── Predictive Arrangement (Level 3) ─────────────────────────────────────────

export interface ArrangementPrediction {
  trackId: string;
  startBeat: number;
  suggestedAction: 'extend' | 'mute' | 'introduce' | 'fade' | 'break';
  confidence: number;
  label: string;
}

// ── Full Store Shape ──────────────────────────────────────────────────────────

interface DAWStore {
  // ── Transport ──────────────────────────────────────────────────────────────
  playing: boolean;
  recording: boolean;
  bpm: number;
  position: number;           // beats
  timeSignature: [number, number];
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  metronomeEnabled: boolean;
  masterGain: number;         // 0–1.5

  // ── Tracks ─────────────────────────────────────────────────────────────────
  tracks: Track[];
  regions: TrackRegion[];
  selectedTrackId: string | null;
  selectedRegionId: string | null;

  // ── Mixer ──────────────────────────────────────────────────────────────────
  mixerVisible: boolean;
  activeFXTrackId: string | null;  // which track's FX is open

  // ── MIDI Sequencer (L2) ────────────────────────────────────────────────────
  sequencerVisible: boolean;
  midiPatterns: MidiPattern[];
  activePatternId: string | null;
  sequencerStep: number;           // current playhead step

  // ── Collaboration (L2) ────────────────────────────────────────────────────
  collabEnabled: boolean;
  collabRoom: string | null;
  collabUsers: CollabUser[];
  collabConnected: boolean;

  // ── Cloud Sync (L2) ───────────────────────────────────────────────────────
  projectId: string | null;
  projectName: string;
  syncStatus: SyncStatus;
  lastSavedAt: number | null;
  autoSaveEnabled: boolean;

  // ── Plugin SDK (L2) ───────────────────────────────────────────────────────
  loadedPlugins: { id: string; name: string; type: string; enabled: boolean }[];

  // ── Adaptive Mastering (L3) ───────────────────────────────────────────────
  mastering: MasteringState;

  // ── AI Co-Producer (L3) ───────────────────────────────────────────────────
  aiPanelTab: 'mix' | 'coproducer' | 'mastering';
  aiPanelVisible: boolean;
  aiSuggestions: AISuggestion[];
  aiChat: AIChatMessage[];
  aiThinking: boolean;

  // ── Arrangement Predictions (L3) ──────────────────────────────────────────
  arrangementPredictions: ArrangementPrediction[];
  predictionsVisible: boolean;

  // ── UI State ──────────────────────────────────────────────────────────────
  sidebarTab: 'files' | 'collab' | 'plugins';
  zoom: number;                  // beats per pixel
  scrollLeft: number;
  metersActive: boolean;
  trackHeightMode: 'compact' | 'normal' | 'large';

  // ── Actions: Transport ────────────────────────────────────────────────────
  setPlaying: (v: boolean) => void;
  setRecording: (v: boolean) => void;
  setBpm: (v: number) => void;
  setPosition: (v: number) => void;
  setTimeSignature: (sig: [number, number]) => void;
  setLoopEnabled: (v: boolean) => void;
  setLoopPoints: (start: number, end: number) => void;
  setMetronome: (v: boolean) => void;
  setMasterGain: (v: number) => void;

  // ── Actions: Tracks ───────────────────────────────────────────────────────
  addTrack: (track: Omit<Track, 'id'>) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, partial: Partial<Track>) => void;
  setSelectedTrack: (id: string | null) => void;
  setSelectedRegion: (id: string | null) => void;
  addRegion: (region: Omit<TrackRegion, 'id'>) => string;
  removeRegion: (id: string) => void;
  updateRegion: (id: string, partial: Partial<TrackRegion>) => void;

  // ── Actions: Mixer ────────────────────────────────────────────────────────
  setMixerVisible: (v: boolean) => void;
  setActiveFXTrack: (id: string | null) => void;
  updateFXSlot: (trackId: string, slotId: string, partial: Partial<FXSlot>) => void;
  toggleFXSlot: (trackId: string, slotId: string) => void;

  // ── Actions: MIDI Sequencer ───────────────────────────────────────────────
  setSequencerVisible: (v: boolean) => void;
  setActivePattern: (id: string | null) => void;
  addMidiNote: (patternId: string, note: Omit<MidiNote, 'id'>) => void;
  removeMidiNote: (patternId: string, noteId: string) => void;
  updateMidiNote: (patternId: string, noteId: string, partial: Partial<MidiNote>) => void;
  setSequencerStep: (step: number) => void;
  addMidiPattern: (pattern: Omit<MidiPattern, 'id'>) => string;

  // ── Actions: Collaboration ────────────────────────────────────────────────
  setCollabEnabled: (v: boolean) => void;
  setCollabRoom: (roomId: string | null) => void;
  setCollabUsers: (users: CollabUser[]) => void;
  upsertCollabUser: (user: CollabUser) => void;
  removeCollabUser: (id: string) => void;
  setCollabConnected: (v: boolean) => void;

  // ── Actions: Cloud Sync ───────────────────────────────────────────────────
  setSyncStatus: (s: SyncStatus) => void;
  setLastSaved: (ts: number) => void;
  setProjectName: (name: string) => void;
  setProjectId: (id: string | null) => void;
  setAutoSave: (v: boolean) => void;

  // ── Actions: Mastering ────────────────────────────────────────────────────
  updateMastering: (partial: Partial<MasteringState>) => void;

  // ── Actions: AI ───────────────────────────────────────────────────────────
  setAIPanelTab: (tab: 'mix' | 'coproducer' | 'mastering') => void;
  setAIPanelVisible: (v: boolean) => void;
  addAISuggestion: (s: Omit<AISuggestion, 'id' | 'createdAt' | 'accepted'>) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  addAIChat: (msg: Omit<AIChatMessage, 'id' | 'timestamp'>) => void;
  setAIThinking: (v: boolean) => void;
  setArrangementPredictions: (preds: ArrangementPrediction[]) => void;
  setPredictionsVisible: (v: boolean) => void;

  // ── Actions: UI ───────────────────────────────────────────────────────────
  setSidebarTab: (tab: 'files' | 'collab' | 'plugins') => void;
  setZoom: (z: number) => void;
  setScrollLeft: (v: number) => void;
  setTrackHeightMode: (m: 'compact' | 'normal' | 'large') => void;
}

let id = 0;
const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${++id}`;

const DEFAULT_TRACKS: Track[] = [
  { id: 'trk_1', label: 'KICK',   type: 'audio', color: 'var(--status-warn)', gain: 0.8, pan: 0,    mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
  { id: 'trk_2', label: 'SNARE',  type: 'audio', color: '#ef4444', gain: 0.75,pan: 0,    mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
  { id: 'trk_3', label: 'HI-HAT', type: 'audio', color: 'var(--accent-green)', gain: 0.6, pan: 0.3,  mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
  { id: 'trk_4', label: 'BASS',   type: 'midi',  color: 'var(--looper-cyan)', gain: 0.9, pan: -0.1, mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
  { id: 'trk_5', label: 'SYNTH',  type: 'midi',  color: 'var(--accent-violet)', gain: 0.7, pan: 0.2,  mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
  { id: 'trk_6', label: 'PAD',    type: 'midi',  color: 'var(--looper-pink)', gain: 0.5, pan: -0.2, mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
  { id: 'trk_7', label: 'FX BUS', type: 'bus',   color: 'var(--text-dim)', gain: 0.8, pan: 0,    mute: false, solo: false, armed: false, fxChain: [], sends: [] , inputSource: null},
];

const DEFAULT_REGIONS: TrackRegion[] = [
  { id: 'reg_1', trackId: 'trk_1', startBeat: 0,  lengthBeats: 16, clipId: 'c1', label: 'INTRO',  color: 'var(--status-warn)' },
  { id: 'reg_2', trackId: 'trk_1', startBeat: 16, lengthBeats: 32, clipId: 'c2', label: 'LOOP A', color: 'var(--status-warn)' },
  { id: 'reg_3', trackId: 'trk_2', startBeat: 4,  lengthBeats: 28, clipId: 'c3', label: 'GROOVE', color: '#ef4444' },
  { id: 'reg_4', trackId: 'trk_4', startBeat: 0,  lengthBeats: 48, clipId: 'c4', label: 'BASS A', color: 'var(--looper-cyan)' },
  { id: 'reg_5', trackId: 'trk_5', startBeat: 16, lengthBeats: 16, clipId: 'c5', label: 'ARP',    color: 'var(--accent-violet)' },
];

const DEFAULT_PATTERN: MidiPattern = {
  id: 'pat_1',
  name: 'PATTERN 1',
  steps: 16,
  trackId: 'trk_4',
  notes: [
    { id: 'n1', pitch: 36, step: 0,  duration: 1, velocity: 100 },
    { id: 'n2', pitch: 36, step: 4,  duration: 1, velocity: 90  },
    { id: 'n3', pitch: 38, step: 8,  duration: 1, velocity: 95  },
    { id: 'n4', pitch: 36, step: 12, duration: 1, velocity: 85  },
  ],
};

export const useDAWStore = create<DAWStore>()(
  subscribeWithSelector((set, get) => ({
    // Transport
    playing: false,
    recording: false,
    bpm: 128,
    position: 0,
    timeSignature: [4, 4],
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 16,
    metronomeEnabled: false,
    masterGain: 0.8,

    // Tracks
    tracks: DEFAULT_TRACKS,
    regions: DEFAULT_REGIONS,
    selectedTrackId: null,
    selectedRegionId: null,

    // Mixer
    mixerVisible: true,
    activeFXTrackId: null,

    // MIDI Sequencer
    sequencerVisible: false,
    midiPatterns: [DEFAULT_PATTERN],
    activePatternId: 'pat_1',
    sequencerStep: -1,

    // Collaboration
    collabEnabled: false,
    collabRoom: null,
    collabUsers: [],
    collabConnected: false,

    // Cloud Sync
    projectId: null,
    projectName: 'UNTITLED PROJECT',
    syncStatus: 'idle',
    lastSavedAt: null,
    autoSaveEnabled: true,

    // Plugins
    loadedPlugins: [],

    // Mastering
    mastering: {
      enabled: false,
      targetLUFS: -14,
      ceilingDB: -0.3,
      dynamicsMode: 'natural',
      stereoWidth: 1,
      analysisResult: null,
      processing: false,
    },

    // AI
    aiPanelTab: 'mix',
    aiPanelVisible: true,
    aiSuggestions: [],
    aiChat: [],
    aiThinking: false,
    arrangementPredictions: [],
    predictionsVisible: false,

    // UI
    sidebarTab: 'files',
    zoom: 2,
    scrollLeft: 0,
    metersActive: true,
    trackHeightMode: 'normal',

    // ── Transport actions ────────────────────────────────────────────────────
    setPlaying: (v) => set({ playing: v }),
    setRecording: (v) => set({ recording: v }),
    setBpm: (v) => set({ bpm: Math.max(40, Math.min(240, v)) }),
    setPosition: (v) => set({ position: Math.max(0, v) }),
    setTimeSignature: (sig) => set({ timeSignature: sig }),
    setLoopEnabled: (v) => set({ loopEnabled: v }),
    setLoopPoints: (start, end) => set({ loopStart: start, loopEnd: end }),
    setMetronome: (v) => set({ metronomeEnabled: v }),
    setMasterGain: (v) => set({ masterGain: Math.max(0, Math.min(1.5, v)) }),

    // ── Track actions ────────────────────────────────────────────────────────
    addTrack: (track) => {
      const id = uid('trk');
      set(s => ({ tracks: [...s.tracks, { ...track, id }] }));
      return id;
    },
    removeTrack: (id) =>
      set(s => ({
        tracks: s.tracks.filter(t => t.id !== id),
        regions: s.regions.filter(r => r.trackId !== id),
      })),
    updateTrack: (id, partial) =>
      set(s => ({ tracks: s.tracks.map(t => t.id === id ? { ...t, ...partial } : t) })),
    setSelectedTrack: (id) => set({ selectedTrackId: id }),
    setSelectedRegion: (id) => set({ selectedRegionId: id }),
    addRegion: (region) => {
      const id = uid('reg');
      set(s => ({ regions: [...s.regions, { ...region, id }] }));
      return id;
    },
    removeRegion: (id) => set(s => ({ regions: s.regions.filter(r => r.id !== id) })),
    updateRegion: (id, partial) =>
      set(s => ({ regions: s.regions.map(r => r.id === id ? { ...r, ...partial } : r) })),

    // ── Mixer actions ────────────────────────────────────────────────────────
    setMixerVisible: (v) => set({ mixerVisible: v }),
    setActiveFXTrack: (id) => set({ activeFXTrackId: id }),
    updateFXSlot: (trackId, slotId, partial) =>
      set(s => ({
        tracks: s.tracks.map(t =>
          t.id === trackId
            ? { ...t, fxChain: t.fxChain.map(fx => fx.id === slotId ? { ...fx, ...partial } : fx) }
            : t,
        ),
      })),
    toggleFXSlot: (trackId, slotId) =>
      set(s => ({
        tracks: s.tracks.map(t =>
          t.id === trackId
            ? { ...t, fxChain: t.fxChain.map(fx => fx.id === slotId ? { ...fx, enabled: !fx.enabled } : fx) }
            : t,
        ),
      })),

    // ── MIDI Sequencer actions ────────────────────────────────────────────────
    setSequencerVisible: (v) => set({ sequencerVisible: v }),
    setActivePattern: (id) => set({ activePatternId: id }),
    addMidiNote: (patternId, note) =>
      set(s => ({
        midiPatterns: s.midiPatterns.map(p =>
          p.id === patternId
            ? { ...p, notes: [...p.notes, { ...note, id: uid('note') }] }
            : p,
        ),
      })),
    removeMidiNote: (patternId, noteId) =>
      set(s => ({
        midiPatterns: s.midiPatterns.map(p =>
          p.id === patternId ? { ...p, notes: p.notes.filter(n => n.id !== noteId) } : p,
        ),
      })),
    updateMidiNote: (patternId, noteId, partial) =>
      set(s => ({
        midiPatterns: s.midiPatterns.map(p =>
          p.id === patternId
            ? { ...p, notes: p.notes.map(n => n.id === noteId ? { ...n, ...partial } : n) }
            : p,
        ),
      })),
    setSequencerStep: (step) => set({ sequencerStep: step }),
    addMidiPattern: (pattern) => {
      const id = uid('pat');
      set(s => ({ midiPatterns: [...s.midiPatterns, { ...pattern, id }] }));
      return id;
    },

    // ── Collab actions ────────────────────────────────────────────────────────
    setCollabEnabled: (v) => set({ collabEnabled: v }),
    setCollabRoom: (roomId) => set({ collabRoom: roomId }),
    setCollabUsers: (users) => set({ collabUsers: users }),
    upsertCollabUser: (user) =>
      set(s => ({
        collabUsers: s.collabUsers.find(u => u.id === user.id)
          ? s.collabUsers.map(u => u.id === user.id ? user : u)
          : [...s.collabUsers, user],
      })),
    removeCollabUser: (id) =>
      set(s => ({ collabUsers: s.collabUsers.filter(u => u.id !== id) })),
    setCollabConnected: (v) => set({ collabConnected: v }),

    // ── Cloud sync actions ────────────────────────────────────────────────────
    setSyncStatus: (s) => set({ syncStatus: s }),
    setLastSaved: (ts) => set({ lastSavedAt: ts }),
    setProjectName: (name) => set({ projectName: name }),
    setProjectId: (id) => set({ projectId: id }),
    setAutoSave: (v) => set({ autoSaveEnabled: v }),

    // ── Mastering actions ────────────────────────────────────────────────────
    updateMastering: (partial) =>
      set(s => ({ mastering: { ...s.mastering, ...partial } })),

    // ── AI actions ────────────────────────────────────────────────────────────
    setAIPanelTab: (tab) => set({ aiPanelTab: tab }),
    setAIPanelVisible: (v) => set({ aiPanelVisible: v }),
    addAISuggestion: (s) =>
      set(state => ({
        aiSuggestions: [
          { ...s, id: uid('sug'), createdAt: Date.now(), accepted: null },
          ...state.aiSuggestions.slice(0, 19),
        ],
      })),
    acceptSuggestion: (id) =>
      set(s => ({ aiSuggestions: s.aiSuggestions.map(sg => sg.id === id ? { ...sg, accepted: true } : sg) })),
    rejectSuggestion: (id) =>
      set(s => ({ aiSuggestions: s.aiSuggestions.map(sg => sg.id === id ? { ...sg, accepted: false } : sg) })),
    addAIChat: (msg) =>
      set(s => ({
        aiChat: [...s.aiChat, { ...msg, id: uid('chat'), timestamp: Date.now() }],
      })),
    setAIThinking: (v) => set({ aiThinking: v }),
    setArrangementPredictions: (preds) => set({ arrangementPredictions: preds }),
    setPredictionsVisible: (v) => set({ predictionsVisible: v }),

    // ── UI actions ────────────────────────────────────────────────────────────
    setSidebarTab: (tab) => set({ sidebarTab: tab }),
    setZoom: (z) => set({ zoom: Math.max(0.5, Math.min(10, z)) }),
    setScrollLeft: (v) => set({ scrollLeft: Math.max(0, v) }),
    setTrackHeightMode: (m) => set({ trackHeightMode: m }),
  }))
);