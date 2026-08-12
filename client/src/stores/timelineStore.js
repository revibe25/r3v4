import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
export const useTimelineStore = create()(immer((set) => ({
    playhead: 0,
    zoom: 1,
    isPlaying: false,
    setPlayhead: (pos) => set((s) => { s.playhead = pos; }),
    setZoom: (zoom) => set((s) => { s.zoom = zoom; }),
    setIsPlaying: (playing) => set((s) => { s.isPlaying = playing; })
})));
