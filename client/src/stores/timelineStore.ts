import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface TimelineState {
  playhead:   number
  zoom:       number
  isPlaying:  boolean
  setPlayhead:  (pos: number) => void
  setZoom:      (zoom: number) => void
  setIsPlaying: (playing: boolean) => void
}

export const useTimelineStore = create<TimelineState>()(
  immer((set) => ({
    playhead:  0,
    zoom:      1,
    isPlaying: false,
    setPlayhead:  (pos)     => set((s) => { s.playhead   = pos }),
    setZoom:      (zoom)    => set((s) => { s.zoom       = zoom }),
    setIsPlaying: (playing) => set((s) => { s.isPlaying  = playing })
  }))
)
