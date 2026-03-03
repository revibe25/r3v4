/**
 * Transport Store
 * Manages playback transport state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TransportState, TransportPosition } from '@/types/audio';

interface TransportStoreState {
  state: TransportState;
  position: TransportPosition;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;
}

interface TransportStoreActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  record: () => void;
  seek: (position: number) => void;
  setLoop: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  updatePosition: (position: TransportPosition) => void;
}

type TransportStore = TransportStoreState & TransportStoreActions;

export const useTransportStore = create<TransportStore>()(
  devtools(
    (set) => ({
      state: 'stopped' as TransportState,
      position: {
        seconds: 0,
        beats: 0,
        bars: 0,
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      },
      isLooping: false,
      loopStart: 0,
      loopEnd: 0,

      play: () => set({ state: 'playing' as TransportState }),
      pause: () => set({ state: 'paused' as TransportState }),
      stop: () => set({ 
        state: 'stopped' as TransportState,
        position: {
          seconds: 0,
          beats: 0,
          bars: 0,
          bpm: 120,
          timeSignature: { numerator: 4, denominator: 4 },
        },
      }),
      record: () => set({ state: 'recording' as TransportState }),
      
      seek: (position) => set((state) => ({
        position: {
          ...state.position,
          seconds: position,
        },
      })),

      setLoop: (enabled) => set({ isLooping: enabled }),
      
      setLoopRegion: (start, end) => set({
        loopStart: start,
        loopEnd: end,
      }),

      updatePosition: (position) => set({ position }),
    }),
    { name: 'TransportStore' }
  )
);

// Alias exports
export const usetransportstore = useTransportStore;
export const useTransportstore = useTransportStore;