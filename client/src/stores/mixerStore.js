import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
export const useMixerStore = create()(immer((set) => ({
    tracks: [],
    setVolume: (id, volume) => set((s) => {
        const t = s.tracks.find((t) => t.id === id);
        if (t)
            t.volume = volume;
    }),
    toggleMute: (id) => set((s) => {
        const t = s.tracks.find((t) => t.id === id);
        if (t)
            t.muted = !t.muted;
    })
})));
