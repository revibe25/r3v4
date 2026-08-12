/**
 * Clip Store
 * Manages audio clips and timeline arrangement
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
export const useClipStore = create()(devtools((set, get) => ({
    clips: new Map(),
    selectedClipIds: new Set(),
    addClip: (clip) => {
        const clips = new Map(get().clips);
        clips.set(clip.id, clip);
        set({ clips });
    },
    removeClip: (id) => {
        const clips = new Map(get().clips);
        clips.delete(id);
        const selectedClipIds = new Set(get().selectedClipIds);
        selectedClipIds.delete(id);
        set({ clips, selectedClipIds });
    },
    updateClip: (id, updates) => {
        const clips = new Map(get().clips);
        const clip = clips.get(id);
        if (clip) {
            clips.set(id, { ...clip, ...updates });
            set({ clips });
        }
    },
    selectClip: (id, multiSelect = false) => {
        const selectedClipIds = multiSelect
            ? new Set(get().selectedClipIds)
            : new Set();
        selectedClipIds.add(id);
        set({ selectedClipIds });
    },
    deselectClip: (id) => {
        const selectedClipIds = new Set(get().selectedClipIds);
        selectedClipIds.delete(id);
        set({ selectedClipIds });
    },
    clearSelection: () => {
        set({ selectedClipIds: new Set() });
    },
    getClip: (id) => {
        return get().clips.get(id);
    },
    getClipsForTrack: (trackId) => {
        return Array.from(get().clips.values()).filter((clip) => clip.trackId === trackId);
    },
}), { name: 'ClipStore' }));
