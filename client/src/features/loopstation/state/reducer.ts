import type { LoopState } from './initialState';

type Action =
  | { type: 'SET_BEAT'; beat: number; bar: number; subdivision: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_TRACKS'; tracks: LoopState['tracks'] };

export function reducer(state: LoopState, action: Action): LoopState {
  switch (action.type) {
    case 'SET_BEAT':
      return { ...state, beat: { beat: action.beat, bar: action.bar, subdivision: action.subdivision } };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing };
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };
    case 'SET_BPM':
      return { ...state, bpm: action.bpm };
    case 'SET_TRACKS':
      return { ...state, tracks: action.tracks };
    default:
      return state;
  }
}
