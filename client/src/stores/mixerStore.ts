import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface Track {
  id:      string
  name:    string
  volume:  number
  muted:   boolean
  soloed:  boolean
}

interface MixerState {
  tracks: Track[]
  setVolume: (id: string, volume: number) => void
  toggleMute: (id: string) => void
}

export const useMixerStore = create<MixerState>()(
  immer((set) => ({
    tracks: [],
    setVolume: (id, volume) =>
      set((s) => {
        const t = s.tracks.find((t) => t.id === id)
        if (t) t.volume = volume
      }),
    toggleMute: (id) =>
      set((s) => {
        const t = s.tracks.find((t) => t.id === id)
        if (t) t.muted = !t.muted
      })
  }))
)
