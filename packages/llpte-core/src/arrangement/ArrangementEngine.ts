import type { Milliseconds } from "../types";

export type ClipId   = string & { readonly __brand: "ClipId" };
export type TrackId  = string & { readonly __brand: "TrackId" };

export interface Clip {
  readonly id: ClipId;
  readonly sourceId: string;   // audio file or MIDI clip ID
  readonly startTime: Milliseconds;
  readonly duration: Milliseconds;
  readonly offset: Milliseconds; // start within source
  readonly gain: number;
  readonly color: string;
}

export interface ArrangementTrack {
  readonly id: TrackId;
  readonly name: string;
  readonly type: "audio" | "midi" | "automation";
  readonly clips: Clip[];
  readonly isMuted: boolean;
  readonly isSoloed: boolean;
  readonly height: number; // px
}

export interface TempoEvent {
  readonly time: Milliseconds;
  readonly bpm: number;
}

export interface ArrangementState {
  readonly tracks: Map<TrackId, ArrangementTrack>;
  readonly tempoMap: TempoEvent[];
  readonly loopStart: Milliseconds | null;
  readonly loopEnd: Milliseconds | null;
  readonly playhead: Milliseconds;
  readonly duration: Milliseconds;
}

type ArrangementAction =
  | { type: "ADD_CLIP";        trackId: TrackId; clip: Clip }
  | { type: "REMOVE_CLIP";     trackId: TrackId; clipId: ClipId }
  | { type: "MOVE_CLIP";       trackId: TrackId; clipId: ClipId; newStart: Milliseconds }
  | { type: "TRIM_CLIP";       trackId: TrackId; clipId: ClipId; duration: Milliseconds }
  | { type: "SET_LOOP";        start: Milliseconds; end: Milliseconds }
  | { type: "CLEAR_LOOP" }
  | { type: "SET_PLAYHEAD";    time: Milliseconds }
  | { type: "ADD_TEMPO_EVENT"; event: TempoEvent };

/**
 * ArrangementEngine — clip-based timeline with tempo map and loop regions.
 *
 * Invariants:
 *   - Clips on a track cannot overlap.
 *   - Clip duration must be positive.
 *   - Loop requires start < end.
 *   - Tempo events maintained in ascending time order.
 */
export class ArrangementEngine {
  private state: ArrangementState;

  constructor(initialState: ArrangementState) {
    this.state = initialState;
  }

  dispatch(action: ArrangementAction): ArrangementState {
    const next = this.reduce(this.state, action);
    this.state = next;
    return next;
  }

  getState(): Readonly<ArrangementState> { return this.state; }

  getTrack(id: TrackId): ArrangementTrack | undefined {
    return this.state.tracks.get(id);
  }

  private reduce(state: ArrangementState, action: ArrangementAction): ArrangementState {
    const tracks = new Map(state.tracks);
    switch (action.type) {
      case "ADD_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        if (action.clip.duration <= 0) throw new RangeError("Clip duration must be positive");
        const overlap = track.clips.some(
          (c) =>
            action.clip.startTime < c.startTime + c.duration &&
            action.clip.startTime + action.clip.duration > c.startTime
        );
        if (overlap) throw new Error(`Clip overlaps existing clip on track ${action.trackId}`);
        const clips = [...track.clips, action.clip].sort((a, b) => a.startTime - b.startTime);
        tracks.set(action.trackId, { ...track, clips });
        return { ...state, tracks };
      }
      case "REMOVE_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        tracks.set(action.trackId, { ...track, clips: track.clips.filter((c) => c.id !== action.clipId) });
        return { ...state, tracks };
      }
      case "MOVE_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        const clips = track.clips.map((c) =>
          c.id === action.clipId ? { ...c, startTime: action.newStart } : c
        ).sort((a, b) => a.startTime - b.startTime);
        tracks.set(action.trackId, { ...track, clips });
        return { ...state, tracks };
      }
      case "TRIM_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        if (action.duration <= 0) throw new RangeError("Trim duration must be positive");
        const clips = track.clips.map((c) =>
          c.id === action.clipId ? { ...c, duration: action.duration } : c
        );
        tracks.set(action.trackId, { ...track, clips });
        return { ...state, tracks };
      }
      case "SET_LOOP":
        if (action.start >= action.end) throw new RangeError("Loop start must be before loop end");
        return { ...state, loopStart: action.start, loopEnd: action.end };
      case "CLEAR_LOOP":
        return { ...state, loopStart: null, loopEnd: null };
      case "SET_PLAYHEAD":
        return { ...state, playhead: Math.max(0, action.time) as Milliseconds };
      case "ADD_TEMPO_EVENT": {
        const tempoMap = [...state.tempoMap, action.event].sort((a, b) => a.time - b.time);
        return { ...state, tempoMap };
      }
      default:
        return state;
    }
  }
}
