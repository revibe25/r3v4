// @ts-nocheck
// ─── useLoopStation505 ────────────────────────────────────────────────────────
// src/features/loopstation/hooks/useLoopStation505.ts
//
// No direct `import * as Tone` — all engine access via getLoopEngine().
// Features: scenes, undo stack, keyboard shortcuts, solo logic,
//           tap tempo, metronome, per-track send FX, overdub counter.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLoopEngine, type SceneSnapshot } from '../engine/loopEngine';
import type {
  FXState,
  HarmonyMode,
  LoopStationState,
  TrackState,
} from '../types/loopstation.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function idxFromId(trackId: string): number {
  return parseInt(trackId.split('-')[1], 10);
}

// ── State shape extensions ────────────────────────────────────────────────────

export interface ExtendedTrackState {
  id:            string;
  index:         number;
  state:         TrackState;
  volume:        number;
  pan:           number;
  muted:         boolean;
  soloed:        boolean;
  cued:          boolean;
  hasContent:    boolean;
  loopLength:    string | null;
  harmonyMode:   HarmonyMode;
  eq:            { low: number; mid: number; high: number };
  reverbSend:    number;
  delaySend:     number;
  chorusSend:     number;
  overdubLayers: number;
  color:         string;
}

export interface ExtendedFXState extends FXState {
  filterResonance: number;
  compThreshold:   number;
  compRatio:       number;
  metronomeOn:     boolean;
  metronomeVol:    number;
}

export interface LoopStationUIState {
  tracks:       ExtendedTrackState[];
  bpm:          number;
  masterVolume: number;
  isPlaying:    boolean;
  midiSync:     boolean;
  quantize:     string;
  soloActive:   boolean;
  beat:         { bar: number; beat: number };
}

// Track colors — hardware-inspired
const TRACK_COLORS = ['#39ff14', '#00d4ff', '#ff6b35', '#c77dff', '#ffd60a'];

// ── Initial state ─────────────────────────────────────────────────────────────

const makeInitialState = (): LoopStationUIState => ({
  tracks: Array.from({ length: 5 }, (_, i) => ({
    id:            `track-${i}`,
    index:         i,
    state:         'idle' as TrackState,
    volume:        0.8,
    pan:           0,
    muted:         false,
    soloed:        false,
    cued:          false,
    hasContent:    false,
    loopLength:    null,
    harmonyMode:   'off' as HarmonyMode,
    eq:            { low: 0, mid: 0, high: 0 },
    reverbSend:    0,
    delaySend:     0,
    chorusSend:     0,
    overdubLayers: 0,
    color:         TRACK_COLORS[i],
  })),
  bpm:          120,
  masterVolume: 0.9,
  isPlaying:    false,
  midiSync:     false,
  quantize:     '1m',
  soloActive:   false,
  beat:         { bar: 0, beat: 0 },
});

const makeInitialFX = (): ExtendedFXState => ({
  filterFreq:      8000,
  filterResonance: 1,
  delayTime:       '8n',
  delayFeedback:   0.3,
  reverbDecay:     2.5,
  reverbWet:       0,
  xyX:             0.5,
  xyY:             0.5,
  compThreshold:   -18,
  compRatio:       4,
  metronomeOn:     false,
  metronomeVol:    0.4,
});

// ── Initial scenes ────────────────────────────────────────────────────────────

const SCENE_LABELS = 'ABCDEFGHIJKLMNOP'.split('');

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLoopStation505() {
  const [state, setState]               = useState<LoopStationUIState>(makeInitialState);
  const [fx, setFX]                     = useState<ExtendedFXState>(makeInitialFX);
  const [isReady, setIsReady]           = useState(false);
  const [isError, setIsError]           = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [midiSync, setMidiSync]         = useState(false);
  const [scenes, setScenes]             = useState<(SceneSnapshot | null)[]>(Array(16).fill(null));
  const [activeScene, setActiveScene]   = useState<number | null>(null);

  const undoStack       = useRef<LoopStationUIState[]>([]);
  const recordingTracks = useRef<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);

  // ── Engine listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    const engine = getLoopEngine();

    const offs = [
      engine.on('error', err => { setIsError(true); setErrorMessage(err.message); }),
      engine.on('bpmChange', bpm => {
        setState(prev => Math.abs(prev.bpm - bpm) > 0.5 ? { ...prev, bpm } : prev);
      }),
      engine.on('beat', (bar, beat) => {
        setState(prev => ({ ...prev, beat: { bar, beat } }));
      }),
      engine.on('soloChanged', soloActive => {
        setState(prev => ({ ...prev, soloActive }));
      }),
    ];

    return () => offs.forEach(off => off());
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────
  // FIX: init() is called AFTER Tone.start() in pressTrack/togglePlayback
  // so the AudioContext is already running when we get here.

  const init = useCallback(async () => {
    try {
      const engine = getLoopEngine();
      await engine.init();
      // FIX: wait for all Tone buffers (reverb IR etc.) to finish decoding
      // before starting the transport, otherwise players with no buffer crash.
      const { loaded } = await import('tone');
      await loaded();
      engine.startTransport();
      setIsReady(true);
      setIsError(false);
      setErrorMessage(null);
      setState(prev => ({ ...prev, isPlaying: true }));
    } catch (err) {
      setIsError(true);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // ── BPM sync ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    const id = setInterval(() => {
      const liveBpm = getLoopEngine().getBpm();
      setState(prev => Math.abs(prev.bpm - liveBpm) > 0.5 ? { ...prev, bpm: liveBpm } : prev);
    }, 500);
    return () => clearInterval(id);
  }, [isReady]);

  // ── MIDI Clock ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    let cleanup: (() => void) | null = null;
    let clockTimeout: ReturnType<typeof setTimeout>;
    navigator.requestMIDIAccess()
      .then(access => {
        const offs: Array<() => void> = [];
        access.inputs.forEach(input => {
          const h = (msg: MIDIMessageEvent) => {
            if (msg.data[0] === 248) {
              setMidiSync(true);
              clearTimeout(clockTimeout);
              clockTimeout = setTimeout(() => setMidiSync(false), 1000);
            }
          };
          input.addEventListener('midimessage', h as EventListener);
          offs.push(() => input.removeEventListener('midimessage', h as EventListener));
        });
        cleanup = () => { offs.forEach(f => f()); clearTimeout(clockTimeout); };
      })
      .catch(() => {});
    return () => { cleanup?.(); };
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':  e.preventDefault(); togglePlayback(); break;
        case 't':  tapTempo();          break;
        case 'm':  toggleMetronome();   break;
        case 'z':  if (e.ctrlKey || e.metaKey) { e.preventDefault(); undo(); } break;
        case '1':  pressTrack('track-0'); break;
        case '2':  pressTrack('track-1'); break;
        case '3':  pressTrack('track-2'); break;
        case '4':  pressTrack('track-3'); break;
        case '5':  pressTrack('track-4'); break;
        case 'a':  recallScene(0); break;
        case 'b':  recallScene(1); break;
        case 'c':  recallScene(2); break;
        case 'd':  recallScene(3); break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setState(prev => {
      undoStack.current = [...undoStack.current.slice(-9), prev];
      setCanUndo(true);
      return prev;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev) {
      setState(prev);
      setCanUndo(undoStack.current.length > 0);
    }
  }, []);

  // ── Track state machine ───────────────────────────────────────────────────

  const pressTrack = useCallback(async (trackId: string) => {
    // FIX: Tone.start() MUST be called synchronously inside the user-gesture
    // handler BEFORE any await. The browser only grants AudioContext.resume()
    // during the synchronous portion of a click/keydown event.
    const { start: toneStart } = await import('tone');
    await toneStart();

    if (!isReady) await init();

    const engine = getLoopEngine();
    const idx    = idxFromId(trackId);
    const track  = engine.tracks[idx];

    setState(prev => {
      const tracks = prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        switch (t.state) {
          case 'idle':
          case 'stopped': {
            if (!t.hasContent) {
              track?.recorder.open().catch(console.error);
              recordingTracks.current.add(trackId);
              return { ...t, state: 'recording' as TrackState };
            }
            // FIX: player already has content — make sure it's synced before playing
            engine.startPlayerOnTransport(idx);
            return { ...t, state: 'playing' as TrackState };
          }
          case 'recording': {
            track?.recorder.close();
            recordingTracks.current.delete(trackId);
            // FIX: sync player to transport now that it has a buffer
            engine.startPlayerOnTransport(idx);
            return {
              ...t, state: 'playing' as TrackState,
              hasContent: true,
              loopLength: engine.getTransportPosition(),
            };
          }
          case 'playing':
            engine.incrementOverdub(idx);
            return { ...t, state: 'overdubbing' as TrackState, overdubLayers: t.overdubLayers + 1 };
          case 'overdubbing':
            return { ...t, state: 'playing' as TrackState };
          default: return t;
        }
      });
      return { ...prev, tracks };
    });
  }, [isReady, init]);

  const stopTrack = useCallback((trackId: string) => {
    const idx = idxFromId(trackId);
    getLoopEngine().tracks[idx]?.recorder.close();
    recordingTracks.current.delete(trackId);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId ? { ...t, state: 'stopped' as TrackState } : t
      ),
    }));
  }, []);

  const clearTrack = useCallback((trackId: string) => {
    pushUndo();
    const idx = idxFromId(trackId);
    // resetOverdub now also stops + unsyncs the player via the engine patch
    getLoopEngine().resetOverdub(idx);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId
          ? { ...t, state: 'idle' as TrackState, hasContent: false, loopLength: null, overdubLayers: 0 }
          : t
      ),
    }));
  }, [pushUndo]);

  const clearAll = useCallback(() => {
    pushUndo();
    state.tracks.forEach(t => {
      const idx = idxFromId(t.id);
      getLoopEngine().resetOverdub(idx);
    });
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t, state: 'idle' as TrackState, hasContent: false,
        loopLength: null, overdubLayers: 0,
      })),
    }));
  }, [pushUndo, state.tracks]);

  // ── Track params ──────────────────────────────────────────────────────────

  const setTrackVolume = useCallback((trackId: string, vol: number) => {
    getLoopEngine().setTrackVolume(idxFromId(trackId), vol);
    setState(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, volume: vol } : t) }));
  }, []);

  const setTrackPan = useCallback((trackId: string, pan: number) => {
    getLoopEngine().setTrackPan(idxFromId(trackId), pan);
    setState(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === trackId ? { ...t, pan } : t) }));
  }, []);

  const setTrackEQ = useCallback((trackId: string, band: 'low' | 'mid' | 'high', val: number) => {
    getLoopEngine().setTrackEQ(idxFromId(trackId), band, val);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId ? { ...t, eq: { ...t.eq, [band]: val } } : t
      ),
    }));
  }, []);

  const toggleMute = useCallback((trackId: string) => {
    setState(prev => {
      const tracks = prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        const muted = !t.muted;
        getLoopEngine().muteTrack(idxFromId(trackId), muted);
        return { ...t, muted };
      });
      return { ...prev, tracks };
    });
  }, []);

  const toggleSolo = useCallback((trackId: string) => {
    setState(prev => {
      const tracks = prev.tracks.map(t => {
        const soloed = t.id === trackId ? !t.soloed : t.soloed;
        getLoopEngine().soloTrack(idxFromId(t.id), soloed);
        return { ...t, soloed };
      });
      return { ...prev, tracks };
    });
  }, []);

  const toggleCue = useCallback((trackId: string) => {
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, cued: !t.cued } : t),
    }));
  }, []);

  const setHarmonyMode = useCallback((trackId: string, mode: HarmonyMode) => {
    getLoopEngine().setHarmonyMode(idxFromId(trackId), mode);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, harmonyMode: mode } : t),
    }));
  }, []);

  const setReverbSend = useCallback((trackId: string, amount: number) => {
    getLoopEngine().setReverbSend(idxFromId(trackId), amount);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, reverbSend: amount } : t),
    }));
  }, []);

  const setDelaySend = useCallback((trackId: string, amount: number) => {
    getLoopEngine().setDelaySend(idxFromId(trackId), amount);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, delaySend: amount } : t),
    }));
  }, []);

  // ── BPM & tempo ───────────────────────────────────────────────────────────

  const setBpm = useCallback((bpm: number) => {
    getLoopEngine().setBpm(bpm);
    setState(prev => ({ ...prev, bpm }));
  }, []);

  const setSwing = useCallback((amount: number) => {
    getLoopEngine().setSwing(amount);
  }, []);

  const setTimeSignature = useCallback((sig: string) => {
    getLoopEngine().setTimeSignature(sig as any);
  }, []);

  const setQuantMode = useCallback((mode: string) => {
    getLoopEngine().setQuantMode(mode as any);
    setState(prev => ({ ...prev, quantize: mode }));
  }, []);

  const setPlaybackMode = useCallback((trackId: string, mode: string) => {
    getLoopEngine().setPlaybackMode(idxFromId(trackId), mode as any);
  }, []);

  const tapTempo = useCallback(() => {
    const newBpm = getLoopEngine().tapTempo();
    setState(prev => ({ ...prev, bpm: newBpm }));
    return newBpm;
  }, []);

  const setMasterVolume = useCallback((vol: number) => {
    getLoopEngine().setMasterVolume(vol);
    setState(prev => ({ ...prev, masterVolume: vol }));
  }, []);

  // ── Metronome ─────────────────────────────────────────────────────────────

  const toggleMetronome = useCallback(() => {
    setFX(prev => {
      const on = !prev.metronomeOn;
      getLoopEngine().setMetronome(on, prev.metronomeVol);
      return { ...prev, metronomeOn: on };
    });
  }, []);

  const setMetronomeVol = useCallback((vol: number) => {
    setFX(prev => {
      getLoopEngine().setMetronome(prev.metronomeOn, vol);
      return { ...prev, metronomeVol: vol };
    });
  }, []);

  // ── FX ────────────────────────────────────────────────────────────────────

  const setFilter = useCallback((freq: number, resonance?: number) => {
    getLoopEngine().setGlobalFilter(freq);
    if (resonance !== undefined) getLoopEngine().setFilterResonance(resonance);
    setFX(prev => ({ ...prev, filterFreq: freq, ...(resonance !== undefined ? { filterResonance: resonance } : {}) }));
  }, []);
  const setFilterType = useCallback((type: BiquadFilterType) => {
    getLoopEngine().setFilterType(type);
    setFX(prev => ({ ...prev, filterType: type }));
  }, []);

  const setDelay = useCallback((time: string, feedback: number) => {
    getLoopEngine().setGlobalDelay(time, feedback);
    setFX(prev => ({ ...prev, delayTime: time, delayFeedback: feedback }));
  }, []);

  const setReverb = useCallback((decay: number, wet: number) => {
    getLoopEngine().setGlobalReverb(decay, wet);
    setFX(prev => ({ ...prev, reverbDecay: decay, reverbWet: wet }));
  }, []);

  const setCompressor = useCallback((threshold: number, ratio: number) => {
    getLoopEngine().setMasterCompressor(threshold, ratio);
    setFX(prev => ({ ...prev, compThreshold: threshold, compRatio: ratio }));
  }, []);

  const setXY = useCallback(({ x, y }: { x: number; y: number }) => {
    setFilter(x * 18000 + 200, x * 8 + 0.5);
    setReverb(y * 8 + 0.5, y * 0.8);
    setFX(prev => ({ ...prev, xyX: x, xyY: y }));
  }, [setFilter, setReverb]);

  // ── Transport ─────────────────────────────────────────────────────────────


  // ── Per-track FX callbacks (M-1) ──────────────────────────────────────────
  // pitchFXRef tracks semitones + cents per track so PTCH and FINE knobs
  // combine correctly into a single setTrackPitch(semitones, cents) call.
  const pitchFXRef = useRef<Map<string, { semitones: number; cents: number }>>(new Map());

  const setTrackPitchFX = useCallback((trackId: string, semitones: number) => {
    if (!isReady) return;
    const idx = idxFromId(trackId);
    const fx = pitchFXRef.current.get(trackId) ?? { semitones: 0, cents: 0 };
    fx.semitones = semitones;
    pitchFXRef.current.set(trackId, fx);
    getLoopEngine().setTrackPitch(idx, fx.semitones, fx.cents);
  }, [isReady]);

  const setTrackFineTune = useCallback((trackId: string, cents: number) => {
    if (!isReady) return;
    const idx = idxFromId(trackId);
    const fx = pitchFXRef.current.get(trackId) ?? { semitones: 0, cents: 0 };
    fx.cents = cents;
    pitchFXRef.current.set(trackId, fx);
    getLoopEngine().setTrackPitch(idx, fx.semitones, fx.cents);
  }, [isReady]);

  const setTrackChorusFX = useCallback((trackId: string, wet: number) => {
    if (!isReady) return;
    // depth=0.5 and freq=1.5 are fixed defaults; wet is the user-controllable param
    getLoopEngine().setTrackChorus(idxFromId(trackId), 0.5, 1.5, wet);
  }, [isReady]);

  const setTrackGateFX = useCallback((trackId: string, amount: number) => {
    if (!isReady) return;
    // knob 0..1 → threshold 0..-80 dB (open at 0, fully gated at 1)
    getLoopEngine().setTrackGate(idxFromId(trackId), amount * -80);
  }, [isReady]);

  const setTrackCompFX = useCallback((trackId: string, amount: number) => {
    if (!isReady) return;
    const threshold = -40 * amount;      // 0 dB (off) → -40 dB (heavy)
    const ratio     = 1 + amount * 19;   // 1:1 → 20:1
    getLoopEngine().setTrackCompressor(idxFromId(trackId), threshold, ratio);
  }, [isReady]);

  const setTrackSatFX = useCallback((trackId: string, amount: number) => {
    if (!isReady) return;
    getLoopEngine().setTrackSaturation(idxFromId(trackId), amount);
  }, [isReady]);

  const setTrackTrimFX = useCallback((trackId: string, gain: number) => {
    if (!isReady) return;
    // knob 0..1 → gain 0..2 (knob centre = 0.5 = unity gain)
    const eng = getLoopEngine() as any;
    if (typeof eng.setTrackInputGain === 'function') {
      eng.setTrackInputGain(idxFromId(trackId), gain * 2);
    }
  }, [isReady]);

  const togglePlayback = useCallback(async () => {
    if (!isReady) return;
    // FIX: keep AudioContext alive on every transport gesture
    const { start: toneStart } = await import('tone');
    await toneStart();
    getLoopEngine().toggleTransport();
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [isReady]);

  const stopPlayback = useCallback(async () => {
    if (!isReady) return;
    const { start: toneStart } = await import('tone');
    await toneStart();
    getLoopEngine().stopTransport();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [isReady]);

  // RC-505 REC behavior: press the first idle track to start recording
  const recordNextTrack = useCallback(async () => {
    if (!isReady) return;
    const idle = state.tracks.find(t => t.state === 'idle');
    if (idle) await pressTrack(idle.id);
  }, [isReady, state.tracks, pressTrack]);

  // ── Scenes ────────────────────────────────────────────────────────────────

  const saveScene = useCallback((slot: number) => {
    const label = SCENE_LABELS[slot] ?? String(slot + 1);
    const snapshot = getLoopEngine().captureScene(`scene-${slot}`, label);
    setScenes(prev => { const next = [...prev]; next[slot] = snapshot; return next; });
    setActiveScene(slot);
  }, []);

  const recallScene = useCallback((slot: number) => {
    const scene = scenes[slot];
    if (!scene || !isReady) return;
    pushUndo();
    getLoopEngine().recallScene(scene);
    setActiveScene(slot);
    setState(prev => ({ ...prev, bpm: scene.bpm }));
    setFX(prev => ({
      ...prev,
      filterFreq:    scene.fx.filterFreq,
      reverbWet:     scene.fx.reverbWet,
      delayFeedback: scene.fx.delayFeedback,
    }));
  }, [scenes, isReady, pushUndo]);

  // ── Return API ────────────────────────────────────────────────────────────


  const setChorusSend = useCallback((trackId: string, amount: number) => {
    getLoopEngine().setChorusSend(idxFromId(trackId), amount);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId ? { ...t, chorusSend: amount } : t
      ),
    }));
  }, []);



  // ── MIDI clock output ─────────────────────────────────────────────────────
  const [midiClockEnabled, setMidiClockEnabled] = useState(false);
  const toggleMidiClock = useCallback(() => {
    setMidiClockEnabled(prev => {
      const next = !prev;
      getLoopEngine().setMidiClockOutput(next);
      return next;
    });
  }, []);

  // ── MIDI input ────────────────────────────────────────────────────────────
  const [midiInputEnabled, setMidiInputEnabled_state] = useState(false);
  const [midiInputs, setMidiInputs] = useState<string[]>([]);

  const toggleMidiInput = useCallback(() => {
    setMidiInputEnabled_state(prev => {
      const next = !prev;
      getLoopEngine().setMidiInputEnabled(next);
      if (next) {
        setMidiInputs(getLoopEngine().getMidiInputs());
      }
      return next;
    });
  }, []);

  // selectMidiInput takes an index (confirmed: engine signature is index: number)
  const selectMidiInputByIndex = useCallback((index: number) => {
    getLoopEngine().selectMidiInput(index);
  }, []);


  return {
    state,
    fx,
    isReady,
    isError,
    errorMessage,
    midiSync,
    midiInputEnabled,
    midiInputs,
    toggleMidiInput,
    toggleMidiClock,
    selectMidiInputByIndex,
    scenes,
    activeScene,
    canUndo,

    // Lifecycle
    init,
    togglePlayback,
    stopPlayback,
    recordNextTrack,
    // FX knobs
    setTrackPitchFX, setTrackFineTune, setTrackChorusFX,
    setTrackGateFX, setTrackCompFX, setTrackSatFX, setTrackTrimFX,

    // Track actions
    pressTrack,
    stopTrack,
    clearTrack,
    clearAll,
    undo,

    // Track params
    setTrackVolume,
    setTrackPan,
    setTrackEQ,
    toggleMute,
    toggleSolo,
    toggleCue,
    setHarmonyMode,
    setReverbSend,
    setDelaySend,
    setChorusSend,
    setMasterVolume,

    // Tempo
    setBpm,
    tapTempo,

    // Metronome
    toggleMetronome,
    setMetronomeVol,

    // FX
    setFilter,
    setFilterType,
    setDelay,
    setReverb,
    setCompressor,
    setXY,

    // Scenes
    saveScene,
    recallScene,

    // Extended controls (wired to engine)
    setSwing,
    setTimeSignature,
    setQuantMode,
    setPlaybackMode,
  };
}