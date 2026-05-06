/**
 * shared/midi.types.ts — Canonical MIDI data types for R3 v4
 */

export interface MidiNote {
  id: string;
  pitch: number;        // 0–127
  velocity: number;     // 0–127
  startTick: number;    // in ticks (PPQ-relative)
  duration: number;     // in ticks
  channel: number;      // 0–15
}

export interface MidiCC {
  controller: number;   // 0–127
  value: number;        // 0–127
  tick: number;
  channel: number;
}

export interface MidiPitchBend {
  value: number;        // -8192 to 8191
  tick: number;
  channel: number;
}

export interface MidiRegion {
  id: string;
  name: string;
  notes: MidiNote[];
  controlChanges: MidiCC[];
  pitchBend: MidiPitchBend[];
  length: number;       // in ticks
}

export interface MidiDevice {
  id: string;
  name: string;
  type: "input" | "output";
  connected: boolean;
}

export const MIDI_PPQ = 480; // Pulses Per Quarter note
export const MIDI_NOTE_NAMES = [
  "C","C#","D","D#","E","F","F#","G","G#","A","A#","B"
] as const;

export function midiNoteToName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const name = MIDI_NOTE_NAMES[pitch % 12];
  return `${name}${octave}`;
}

export function ticksToBars(ticks: number, ppq = MIDI_PPQ, beatsPerBar = 4): number {
  return ticks / (ppq * beatsPerBar);
}

export function barsToTicks(bars: number, ppq = MIDI_PPQ, beatsPerBar = 4): number {
  return bars * ppq * beatsPerBar;
}

