/**
 * Transport Store
 * Manages playback transport state.
 *
 * Flat properties (playing, recording, bpm, position, setBpm …) are exposed
 * directly on the store so components can destructure them without going
 * through useTransportFlat().  The nested `transportState` shape is kept for
 * consumers that need it.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TransportState, TransportPosition } from '@/types/audio';

// ── State & actions ───────────────────────────────────────────────────────────

interface TransportStoreState {
  // ── Nested (original) ─────────────────────────────────────────────────────
  transportState: TransportState;
  position:       TransportPosition;
  isLooping:      boolean;
  loopStart:      number;
  loopEnd:        number;

  // ── Flat convenience properties (what components destructure) ─────────────
  playing:   boolean;
  recording: boolean;
  bpm:       number;
  /** Current position in seconds */
  currentPosition: number;
}

interface TransportStoreActions {
  // ── Original actions ──────────────────────────────────────────────────────
  play:           () => void;
  pause:          () => void;
  stop:           () => void;
  record:         () => void;
  seek:           (position: number) => void;
  setLoop:        (enabled: boolean) => void;
  setLoopRegion:  (start: number, end: number) => void;
  updatePosition: (position: TransportPosition) => void;

  // ── Flat convenience actions ──────────────────────────────────────────────
  setBpm:       (bpm: number) => void;
  setPosition:  (seconds: number) => void;
  togglePlay:   () => void;
  toggleRecord: () => void;
}

export type TransportStore = TransportStoreState & TransportStoreActions;

// ── Default position ──────────────────────────────────────────────────────────

const DEFAULT_POSITION: TransportPosition = {
  seconds:       0,
  beats:         0,
  bars:          0,
  bpm:           120,
  timeSignature: { numerator: 4, denominator: 4 },
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTransportStore = create<TransportStore>()(
  devtools(
    (set, get) => ({
      // ── Initial state ────────────────────────────────────────────────────
      transportState:  'stopped' as TransportState,
      position:        { ...DEFAULT_POSITION },
      isLooping:       false,
      loopStart:       0,
      loopEnd:         0,
      // Flat mirrors
      playing:         false,
      recording:       false,
      bpm:             120,
      currentPosition: 0,

      // ── Original actions ─────────────────────────────────────────────────

      play: () => set({
        transportState: 'playing' as TransportState,
        playing:        true,
        recording:      false,
      }),

      pause: () => set({
        transportState: 'paused' as TransportState,
        playing:        false,
      }),

      stop: () => set({
        transportState:  'stopped' as TransportState,
        playing:         false,
        recording:       false,
        position:        { ...DEFAULT_POSITION, bpm: get().bpm },
        currentPosition: 0,
      }),

      record: () => set({
        transportState: 'recording' as TransportState,
        playing:        true,
        recording:      true,
      }),

      seek: (seconds) => set((s) => ({
        position:        { ...s.position, seconds },
        currentPosition: seconds,
      })),

      setLoop:       (enabled) => set({ isLooping: enabled }),
      setLoopRegion: (start, end) => set({ loopStart: start, loopEnd: end }),

      updatePosition: (position) => set({
        position,
        bpm:             position.bpm,
        currentPosition: position.seconds,
      }),

      // ── Flat convenience actions ──────────────────────────────────────────

      setBpm: (bpm) => set((s) => ({
        bpm,
        position: { ...s.position, bpm },
      })),

      setPosition: (seconds) => set((s) => ({
        position:        { ...s.position, seconds },
        currentPosition: seconds,
      })),

      togglePlay: () => {
        const { playing, play, pause } = get();
        playing ? pause() : play();
      },

      toggleRecord: () => {
        const { recording, record, stop } = get();
        recording ? stop() : record();
      },
    }),
    { name: 'TransportStore' }
  )
);

// ── Legacy aliases ────────────────────────────────────────────────────────────

export const usetransportstore = useTransportStore;
export const useTransportstore = useTransportStore;

/**
 * @deprecated Destructure from useTransportStore directly — flat props are now
 * first-class members of the store.
 */
export const useTransportFlat = () =>
  useTransportStore((s) => ({
    playing:      s.playing,
    recording:    s.recording,
    bpm:          s.bpm,
    position:     s.currentPosition,
    play:         s.play,
    stop:         s.stop,
    record:       s.record,
    setBpm:       s.setBpm,
    setPosition:  s.setPosition,
    togglePlay:   s.togglePlay,
    toggleRecord: s.toggleRecord,
  }));