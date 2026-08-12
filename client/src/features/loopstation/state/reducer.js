export function reducer(state, action) {
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
