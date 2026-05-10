// @ts-nocheck
export type { LoopTrack as ExtendedTrackState } from '../state/initialState';
// client/src/features/loopstation/hooks/useLoopStation505.ts
import { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { getLoopEngine } from '../engine/loopEngine';
import type { FXState } from '../types/loopstation.types';
import { initialState } from '../state/initialState';

type State = typeof initialState;
type Action =
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_BPM';   bpm: number }
  | { type: 'SET_BEAT';  beat: number; bar: number; subdivision: number }
  | { type: 'SET_TRACKS'; tracks: State['tracks'] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'TOGGLE_PLAY':  return { ...state, isPlaying: !state.isPlaying };
    case 'SET_PLAYING':  return { ...state, isPlaying: action.playing };
    case 'SET_BPM':      return { ...state, bpm: action.bpm };
    case 'SET_BEAT':     return { ...state, beat: { beat: action.beat, bar: action.bar, subdivision: action.subdivision } };
    case 'SET_TRACKS':   return { ...state, tracks: action.tracks,
                                  soloActive: action.tracks.some(t => t.isSoloed) };
    default:             return state;
  }
}

const noop    = () => {};
const noop1s  = (_s: string) => {};
const noop1n  = (_n: number) => {};
const noop2sn = (_s: string, _n: number) => {};
const noop2nn = (_a: number, _b: number) => {};
const _noopNum = noop1n;

const DEFAULT_FX: FXState = {
  filterFreq:      1000,
  filterResonance: 1,
  filterType:      'lowpass',
  delayTime:       '8n',
  delayFeedback:   0.3,
  reverbDecay:     1.5,
  reverbWet:       0,
  chorusDepth:     0,
  chorusRate:      1,
  chorusWet:       0,
  flangerDepth:    0,
  flangerRate:     1,
  driveAmount:     0,
  bitDepth:        16,
  stereoWidth:     0.5,
  tiltEQ:          0,
  phaserStages:    4,
  phaserRate:      0.5,
  phaserWet:       0,
  granularFreeze:  false,
  granularSize:    0.1,
  granularDensity: 1,
  xyX:             0.5,
  xyY:             0.5,
  metronomeOn:     false,
  metronomeVol:    0.5,
  compThreshold:   -24,
  compRatio:       4,
};

export function useLoopStation505() {
  const [state,    dispatch]    = useReducer(reducer, initialState);
  const [isReady,  setIsReady]  = useState(false);
  const [isError,  setIsError]  = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fxState,  setFxState]  = useState<FXState>(DEFAULT_FX);
  const engRef = useRef<ReturnType<typeof getLoopEngine> | null>(null);

  // ── Init engine + wire events ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const eng = getLoopEngine();
      engRef.current = eng;
      // Beat counter
      eng.on?.('beat', (bar: number, beat: number, sub: number) => {
        dispatch({ type: 'SET_BEAT', beat, bar, subdivision: sub ?? 0 });
      });
      // Transport state
      eng.on?.('start', () => dispatch({ type: 'SET_PLAYING', playing: true  }));
      eng.on?.('stop',  () => dispatch({ type: 'SET_PLAYING', playing: false }));
      // Hydrate fx state from engine snapshot (fields it exposes)
      const snap = eng.getSnapshot?.();
      if (snap?.fx) {
        setFxState(prev => ({
          ...prev,
          filterFreq:      snap.fx.filterFreq      ?? prev.filterFreq,
          filterType:      snap.fx.filterType      ?? prev.filterType,
          filterResonance: snap.fx.filterRes        ?? prev.filterResonance,
          reverbWet:       snap.fx.reverbWet        ?? prev.reverbWet,
          reverbDecay:     snap.fx.reverbDecay      ?? prev.reverbDecay,
          delayFeedback:   snap.fx.delayFeedback    ?? prev.delayFeedback,
          delayTime:       snap.fx.delayTime        ?? prev.delayTime,
          driveAmount:     snap.fx.driveAmount      ?? prev.driveAmount,
          stereoWidth:     snap.fx.stereoWidth      ?? prev.stereoWidth,
          phaserWet:       snap.fx.phaserWet        ?? prev.phaserWet,
          bitDepth:        snap.fx.bitDepth         ?? prev.bitDepth,
          granularFreeze:  snap.fx.granularFreeze   ?? prev.granularFreeze,
        }));
      }
      setIsReady(true);
    } catch (e) {
      setIsError(true);
      setErrorMsg(String(e));
    }
  }, []);

  const eng = () => engRef.current ?? getLoopEngine();

  // ── Transport ──────────────────────────────────────────────────────────────
  const togglePlayback = useCallback(() => {
    eng().toggleTransport();
    dispatch({ type: 'TOGGLE_PLAY' });
  }, []);

  const stopPlayback = useCallback(() => {
    try { eng().stop?.(); } catch {}
    dispatch({ type: 'SET_PLAYING', playing: false });
  }, []);

  const setBpm = useCallback((bpm: number) => {
    eng().setBpm(bpm);
    dispatch({ type: 'SET_BPM', bpm });
  }, []);

  const tapTempo = useCallback(() => {
    try { eng().tapTempo?.(); } catch {}
  }, []);

  // ── Tracks ─────────────────────────────────────────────────────────────────
  const pressTrack = useCallback((trackId: string) => {
    dispatch({
      type: 'SET_TRACKS',
      tracks: state.tracks.map(t => {
        if (t.id !== trackId) return t;
        const next = t.state === 'empty' ? 'recording'
                   : t.state === 'recording' ? 'playing' : 'empty';
        return { ...t, state: next, hasContent: next === 'playing' ? true : t.hasContent };
      }),
    });
  }, [state.tracks]);

  const stopTrack = useCallback((trackId: string) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, state: 'empty' } : t) });
  }, [state.tracks]);

  const clearTrack = useCallback((trackId: string) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, state: 'empty', hasContent: false } : t) });
  }, [state.tracks]);

  const clearAll = useCallback(() => {
    dispatch({ type: 'SET_TRACKS', tracks: initialState.tracks });
  }, []);

  const toggleMute = useCallback((trackId: string) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t) });
  }, [state.tracks]);

  const toggleSolo = useCallback((trackId: string) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, isSoloed: !t.isSoloed } : t) });
  }, [state.tracks]);

  const toggleCue = useCallback((trackId: string) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, isCued: !t.isCued } : t) });
  }, [state.tracks]);

  const setTrackVolume = useCallback((trackId: string, v: number) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, volume: v } : t) });
  }, [state.tracks]);

  const setTrackPan = useCallback((trackId: string, v: number) => {
    dispatch({ type: 'SET_TRACKS',
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, pan: v } : t) });
  }, [state.tracks]);

  const setMasterVolume = useCallback((v: number) => {
    try { eng().setMasterVolume?.(v); } catch {}
  }, []);

  const toggleMetronome = useCallback(() => {
    setFxState(prev => {
      const next = !prev.metronomeOn;
      try { (eng() as any).setMetronome?.(next); } catch {}
      return { ...prev, metronomeOn: next };
    });
  }, []);

  return {
    state, isReady, isError, errorMessage: errorMsg,
    fx: fxState, midiSync: false, midiInputEnabled: false, midiInputs: [] as string[],
    scenes: [], activeScene: null, canUndo: false,
    // Transport
    init: noop, togglePlayback, stopPlayback, recordNextTrack: noop,
    setBpm, tapTempo, toggleMetronome,
    // Tracks
    pressTrack, stopTrack, clearTrack, clearAll, undo: noop,
    toggleMute, toggleSolo, toggleCue,
    setTrackVolume, setTrackPan, setTrackEQ: (_s: string, _v: unknown) => {},
    setTrackPitchFX: noop2sn, setTrackFineTune: noop2sn, setTrackChorusFX: noop2sn,
    setTrackGateFX: noop2sn, setTrackCompFX: noop2sn, setTrackSatFX: noop2sn, setTrackTrimFX: noop2sn,
    // FX
    setHarmonyMode: noop1s, setReverbSend: noop2sn, setDelaySend: noop2sn,
    setChorusSend: noop2sn, setMasterVolume,
    setFilter: noop2nn, setFilterType: noop1s, setDelay: noop2sn,
    setReverb: noop2nn, setCompressor: noop2nn, setXY: (_p: { x: number; y: number }) => {},
    // MIDI
    toggleMidiInput: noop, toggleMidiClock: noop, selectMidiInputByIndex: noop1n,
    // Scenes / swing
    saveScene: noop1n, recallScene: noop1n,
    setSwing: noop1n, setTimeSignature: noop1s, setQuantMode: noop1s, setPlaybackMode: noop1s,
  };
}
