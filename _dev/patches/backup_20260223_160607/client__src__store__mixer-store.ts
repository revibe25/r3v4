import { create } from 'zustand';
import { useAudioStore } from './audio-store';

interface MixerStore {
  channels: string[];
  addChannel: (id: string) => void;
}

export const useMixerStore = create<MixerStore>((set) => ({
  channels: [],
  addChannel: (id) => set((state) => ({ channels: [...state.channels, id] })),
}));

export default useMixerStore;