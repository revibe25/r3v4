// client/src/features/loopstation/state/initialState.ts
const COLORS = ['#a3e635', '#00F5FF', '#f97316', '#d946ef', '#facc15'];

export const initialState = {
  beat:       { beat: 0, bar: 0, subdivision: 0 },
  isPlaying:  false,
  bpm:        120,
  soloActive: false,
  canUndo:    false,
  tracks: Array.from({ length: 5 }, (_, i) => ({
    id:         `track-${i}`,
    index:      i,
    state:      'empty' as 'empty' | 'recording' | 'playing' | 'overdubbing',
    color:      COLORS[i],
    hasContent: false,
    isMuted:    false,
    isSoloed:   false,
    isCued:     false,
    volume:     1,
    pan:        0,
    eq:         { low: 0, mid: 0, high: 0 },
    loopLength:  null as string | null,
    cued:        false,
    reverbSend:  0,
    delaySend:   0,
    chorusSend:  0,
    overdubLayers: 0,
    harmonyMode:   '' as string,
  })),
  scenes:      [] as string[],
  activeScene: null as string | null,
};

export type LoopState = typeof initialState;
export type LoopTrack = LoopState['tracks'][number];
