import type { DJSession, DJAction, DeckId, Deck, Milliseconds } from "../types";

type DJListener = (action: DJAction, session: DJSession) => void;

/**
 * DJEngine — stateful deck controller with beat sync and tempo matching.
 *
 * Invariants:
 *   - Crossfader clamped to [−1.0, +1.0].
 *   - Pitch clamped to [−12, +12] semitones.
 *   - Loop requires loopStart < loopEnd; LOOP_OUT with invalid range is rejected.
 *   - Sync adjusts BPM only within the session's tempoRange — never beyond.
 */
export class DJEngine {
  private session: DJSession;
  private readonly listeners: Set<DJListener> = new Set();

  constructor(session: DJSession) {
    this.session = session;
  }

  dispatch(action: DJAction): void {
    const next = this.reduce(this.session, action);
    this.session = next;
    for (const fn of this.listeners) fn(action, next);
  }

  subscribe(fn: DJListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getSession(): Readonly<DJSession> { return this.session; }
  getDeck(id: DeckId): Deck | undefined { return this.session.decks[id]; }

  /** Snap a position to the nearest beat on a given deck */
  snapToBeat(deckId: DeckId, position: Milliseconds): Milliseconds {
    const deck = this.session.decks[deckId];
    if (!deck?.beatGrid) return position;
    const { bpm, offset } = deck.beatGrid;
    const beatDuration = (60_000 / bpm) as Milliseconds;
    const relative = position - offset;
    return (offset + Math.round(relative / beatDuration) * beatDuration) as Milliseconds;
  }

  private reduce(session: DJSession, action: DJAction): DJSession {
    const decks = { ...session.decks };
    switch (action.type) {
      case "PLAY":
        decks[action.deckId] = { ...decks[action.deckId], isPlaying: true };
        return { ...session, decks };
      case "PAUSE":
        decks[action.deckId] = { ...decks[action.deckId], isPlaying: false };
        return { ...session, decks };
      case "CUE": {
        const cue = decks[action.deckId].cuePoints.find((c) => c.id === action.cueId);
        if (!cue) return session;
        decks[action.deckId] = { ...decks[action.deckId], position: cue.time, isPlaying: false };
        return { ...session, decks };
      }
      case "LOOP_IN":
        decks[action.deckId] = { ...decks[action.deckId], loopStart: action.time, isLooping: false };
        return { ...session, decks };
      case "LOOP_OUT": {
        const deck = decks[action.deckId];
        if (deck.loopStart === null || action.time <= deck.loopStart) return session;
        decks[action.deckId] = { ...deck, loopEnd: action.time, isLooping: true };
        return { ...session, decks };
      }
      case "SYNC": {
        const range = session.tempoRange;
        const clampedBpm = Math.min(
          action.targetBpm * (1 + range),
          Math.max(action.targetBpm * (1 - range), decks[action.deckId].bpm)
        );
        decks[action.deckId] = { ...decks[action.deckId], bpm: clampedBpm };
        return { ...session, decks, masterBpm: action.targetBpm };
      }
      case "CROSSFADE":
        return { ...session, crossfader: Math.min(1, Math.max(-1, action.value)) };
      case "PITCH": {
        decks[action.deckId] = { ...decks[action.deckId], pitch: Math.min(12, Math.max(-12, action.semitones)) };
        return { ...session, decks };
      }
      default:
        return session;
    }
  }
}
