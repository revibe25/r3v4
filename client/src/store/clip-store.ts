/**
 * Clip Store
 * Manages audio clips and timeline arrangement
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Clip {
  id: string;
  name: string;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
  audioBuffer?: AudioBuffer;
  color?: string;
}

interface ClipStoreState {
  clips: Map<string, Clip>;
  selectedClipIds: Set<string>;
}

interface ClipStoreActions {
  addClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  selectClip: (id: string, multiSelect?: boolean) => void;
  deselectClip: (id: string) => void;
  clearSelection: () => void;
  getClip: (id: string) => Clip | undefined;
  getClipsForTrack: (trackId: string) => Clip[];
}

type ClipStore = ClipStoreState & ClipStoreActions;

export const useClipStore = create<ClipStore>()(
  devtools(
    (set, get) => ({
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
          : new Set<string>();
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
        return Array.from(get().clips.values()).filter(
          (clip) => clip.trackId === trackId
        );
      },
    }),
    { name: 'ClipStore' }
  )
);

// Alias exports for backwards compatibility
export const useClipstore = useClipStore;
export const useclipstore = useClipStore;