import type { Milliseconds } from "./audio-graph.types";

export type DeckId = "A" | "B" | "C" | "D";

export interface CuePoint {
  readonly id: string;
  readonly time: Milliseconds;
  readonly label: string;
  readonly color: string;
}

export interface BeatGrid {
  readonly bpm: number;
  readonly offset: Milliseconds;
  readonly markers: Milliseconds[];
}

export interface Deck {
  readonly id: DeckId;
  readonly trackId: string | null;
  readonly position: Milliseconds;
  readonly bpm: number;
  readonly pitch: number;          // semitones, −12 to +12
  readonly playbackRate: number;   // 0.0 to 2.0
  readonly isPlaying: boolean;
  readonly isLooping: boolean;
  readonly loopStart: Milliseconds | null;
  readonly loopEnd: Milliseconds | null;
  readonly cuePoints: CuePoint[];
  readonly beatGrid: BeatGrid | null;
  readonly waveformData: Float32Array | null;
}

export interface DJSession {
  readonly decks: Record<DeckId, Deck>;
  readonly crossfader: number;     // −1.0 (A) to +1.0 (B)
  readonly masterBpm: number;
  readonly syncEnabled: boolean;
  readonly tempoRange: 0.06 | 0.10 | 0.16 | 0.25;
}

export type DJAction =
  | { type: "PLAY";      deckId: DeckId }
  | { type: "PAUSE";     deckId: DeckId }
  | { type: "CUE";       deckId: DeckId; cueId: string }
  | { type: "LOOP_IN";   deckId: DeckId; time: Milliseconds }
  | { type: "LOOP_OUT";  deckId: DeckId; time: Milliseconds }
  | { type: "SYNC";      deckId: DeckId; targetBpm: number }
  | { type: "CROSSFADE"; value: number }
  | { type: "PITCH";     deckId: DeckId; semitones: number };
