/**
 * Mixer Store
 * Plain-data channel state (volume, pan, mute, solo).
 * Audio-engine objects (MixerChannel, GainNode…) are NOT stored here —
 * they live in the audio engine.  This store is the source of truth for
 * serialisable channel parameters.
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
function defaultChannel(id) {
    return { id, name: id, volume: 1, pan: 0, muted: false, solo: false };
}
// ── Store ─────────────────────────────────────────────────────────────────────
export const useMixerStore = create()(devtools((set, get) => ({
    channels: {},
    addChannel: (id, initial) => set((s) => {
        if (s.channels[id])
            return s; // already registered
        return {
            channels: {
                ...s.channels,
                [id]: { ...defaultChannel(id), ...initial },
            },
        };
    }),
    removeChannel: (id) => set((s) => {
        const next = { ...s.channels };
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
}), { name: 'MixerStore' }));
export default useMixerStore;
