// @ts-nocheck
// client/src/features/loopstation/hooks/useLoopStation505.ts
import { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { getLoopEngine } from '../engine/loopEngine';
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
const noopNum = (_n: number) => {};

export function useLoopStation505() {
  const [state,    dispatch]    = useReducer(reducer, initialState);
  const [isReady,  setIsReady]  = useState(false);
  const [isError,  setIsError]  = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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

  return {
    state, isReady, isError, errorMessage: errorMsg,
    fx: null, midiSync: false, midiInputEnabled: false, midiInputs: [],
    scenes: [], activeScene: null, canUndo: false,
    // Transport
    init: noop, togglePlayback, stopPlayback, recordNextTrack: noop,
    setBpm, tapTempo, toggleMetronome: noop,
    // Tracks
    pressTrack, stopTrack, clearTrack, clearAll, undo: noop,
    toggleMute, toggleSolo, toggleCue,
    setTrackVolume, setTrackPan, setTrackEQ: noop,
    setTrackPitchFX: noop, setTrackFineTune: noop, setTrackChorusFX: noop,
    setTrackGateFX: noop, setTrackCompFX: noop, setTrackSatFX: noop, setTrackTrimFX: noop,
    // FX
    setHarmonyMode: noop, setReverbSend: noopNum, setDelaySend: noopNum,
    setChorusSend: noopNum, setMasterVolume,
    setFilter: noop, setFilterType: noop, setDelay: noopNum,
    setReverb: noopNum, setCompressor: noop, setXY: noop,
    // MIDI
    toggleMidiInput: noop, toggleMidiClock: noop, selectMidiInputByIndex: noopNum,
    // Scenes / swing
    saveScene: noop, recallScene: noop,
    setSwing: noopNum, setTimeSignature: noop, setQuantMode: noop, setPlaybackMode: noop,
  };
}
