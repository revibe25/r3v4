/**
 * Mixer Store
 * Plain-data channel state (volume, pan, mute, solo).
 * Audio-engine objects (MixerChannel, GainNode…) are NOT stored here —
 * they live in the audio engine.  This store is the source of truth for
 * serialisable channel parameters.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ── Channel state shape ───────────────────────────────────────────────────────

export interface ChannelState {
  id:     string;
  name:   string;
  volume: number;   // 0..1
  pan:    number;   // -1..1
  muted:  boolean;
  solo:   boolean;
}

function defaultChannel(id: string): ChannelState {
  return { id, name: id, volume: 1, pan: 0, muted: false, solo: false };
}

// ── Store shape ───────────────────────────────────────────────────────────────

interface MixerStoreState {
  channels: Record<string, ChannelState>;
}

interface MixerStoreActions {
  addChannel:    (id: string, initial?: Partial<Omit<ChannelState, 'id'>>) => void;
  removeChannel: (id: string) => void;
  setVolume:     (id: string, volume: number) => void;
  setPan:        (id: string, pan: number) => void;
  setMute:       (id: string, muted: boolean) => void;
  setSolo:       (id: string, solo: boolean) => void;
  setName:       (id: string, name: string) => void;
  updateChannel: (id: string, patch: Partial<Omit<ChannelState, 'id'>>) => void;
  getChannel:    (id: string) => ChannelState | undefined;
  reset:         () => void;
}

export type MixerStore = MixerStoreState & MixerStoreActions;

// ── Store ─────────────────────────────────────────────────────────────────────

export const _useMixerStore = create<MixerStore>()(
  devtools(
    (set, get) => ({
      channels: {},

      addChannel: (id, initial) => set((s) => {
        if (s.channels[id]) return s; // already registered
        return {
          channels: {
            ...s.channels,
            [id]: { ...defaultChannel(id), ...initial },
          },
        };
      }),

      removeChannel: (id) => set((s) => {
        const _next = { ...s.channels };
        delete next[id];
        return { channels: next };
      }),

      setVolume: (id, volume) => set((s) => ({
        channels: {
          ...s.channels,
          [id]: { ...s.channels[id] ?? defaultChannel(id), volume: Math.max(0, Math.min(1, volume)) },
        },
      })),

      setPan: (id, pan) => set((s) => ({
        channels: {
          ...s.channels,
          [id]: { ...s.channels[id] ?? defaultChannel(id), pan: Math.max(-1, Math.min(1, pan)) },
        },
      })),

      setMute: (id, muted) => set((s) => ({
        channels: {
          ...s.channels,
          [id]: { ...s.channels[id] ?? defaultChannel(id), muted },
        },
      })),

      setSolo: (id, solo) => set((s) => ({
        channels: {
          ...s.channels,
          [id]: { ...s.channels[id] ?? defaultChannel(id), solo },
        },
      })),

      setName: (id, name) => set((s) => ({
        channels: {
          ...s.channels,
          [id]: { ...s.channels[id] ?? defaultChannel(id), name },
        },
      })),

      updateChannel: (id, patch) => set((s) => ({
        channels: {
          ...s.channels,
          [id]: { ...s.channels[id] ?? defaultChannel(id), ...patch },
        },
      })),

      getChannel: (id) => get().channels[id],

      reset: () => set({ channels: {} }),
    }),
    { name: 'MixerStore' }
  )
);

export default useMixerStore;