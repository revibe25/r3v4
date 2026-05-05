/**
 * useMidiSequencer.ts
 * Piano-roll MIDI sequencer logic for R3 v4.
 *
 * Manages:
 *  - Tone.Sequence scheduling notes to the Tone.Transport grid
 *  - WebMIDI note-out to connected hardware
 *  - Step quantisation helpers (snap-to-grid)
 *  - Pattern switching without glitches (clean sequence disposal)
 *
 * Note: AudioWorklet processing is intentionally separated.
 *       This hook drives note scheduling only.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import type { MidiNote, MidiPattern } from './useDAWStore';
import { useDAWStore } from './useDAWStore';

export interface SequencerAPI {
  toggleNote: (step: number, pitch: number, velocity?: number) => void;
  clearPattern: () => void;
  setPatternLength: (steps: 16 | 32 | 64) => void;
  nudgePitch: (noteId: string, delta: number) => void;
  nudgeVelocity: (noteId: string, delta: number) => void;
  duplicate: () => void;
  getPitchLabel: (midi: number) => string;
}

const MIDI_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const getPitchLabel = (midi: number): string => {
  const name   = MIDI_NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
};

// Synth for sequencer preview (monophonic, acid-flavored)
let previewSynth: Tone.MonoSynth | null = null;
const getPreviewSynth = () => {
  if (!previewSynth) {
    previewSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 6, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0.3, release: 0.1 },
      filterEnvelope: {
        attack: 0.002, decay: 0.1, sustain: 0.5, release: 0.1,
        baseFrequency: 200, octaves: 4,
      },
    }).toDestination();
  }
  return previewSynth;
};

export function useMidiSequencer(): SequencerAPI {
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const midiOutRef  = useRef<WebMidi.MIDIOutput | null>(null);

  // ── Wire up MIDI output ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess({ sysex: false }).then(access => {
      const outputs = Array.from(access.outputs.values());
      if (outputs.length > 0) midiOutRef.current = outputs[0] as unknown as WebMidi.MIDIOutput;
      access.onstatechange = () => {
        const updated = Array.from(access.outputs.values());
        midiOutRef.current = (updated[0] ?? null) as unknown as WebMidi.MIDIOutput | null;
      };
    }).catch(() => { /* WebMIDI unavailable — degrade gracefully */ });
  }, []);

  // ── Rebuild Tone.Sequence whenever pattern changes ────────────────────────
  useEffect(() => {
    const rebuild = () => {
      const { activePatternId, midiPatterns } = useDAWStore.getState();
      const pattern = midiPatterns.find(p => p.id === activePatternId);
      if (!pattern) return;

      // Dispose previous
      if (sequenceRef.current) {
        sequenceRef.current.dispose();
        sequenceRef.current = null;
      }

      // Build step array: array of arrays of notes per step
      const stepMap: Map<number, MidiNote[]> = new Map();
      for (const note of pattern.notes) {
        if (!stepMap.has(note.step)) stepMap.set(note.step, []);
        stepMap.get(note.step)!.push(note);
      }

      const steps = Array.from({ length: pattern.steps }, (_, i) => stepMap.get(i) ?? []);

      const seq = new Tone.Sequence(
        (time, notesAtStep) => {
          const step = (seq as unknown as { _index: number })._index ?? 0;
          useDAWStore.getState().setSequencerStep(step);

          for (const note of (notesAtStep as unknown as MidiNote[])) {
            const freq  = Tone.Frequency(note.pitch, 'midi').toFrequency();
            const durSec = Tone.Time('16n').toSeconds() * note.duration;
            getPreviewSynth().triggerAttackRelease(freq, durSec, time, note.velocity / 127);

            // MIDI out
            const midi = midiOutRef.current;
            if (midi) {
              const noteOnDelay  = Math.max(0, (time - Tone.now()) * 1000);
              const noteOffDelay = noteOnDelay + durSec * 1000;
              midi.send([0x90, note.pitch, note.velocity], performance.now() + noteOnDelay);
              midi.send([0x80, note.pitch, 0],             performance.now() + noteOffDelay);
            }
          }
        },
        steps,
        '16n',
      );

      seq.loop  = true;
      sequenceRef.current = seq;

      // If transport is running, start the new sequence
      if (Tone.getTransport().state === 'started') seq.start(0);
    };

    rebuild();
    const unsub = useDAWStore.subscribe(
      s => [s.activePatternId, s.midiPatterns] as [string | null, MidiPattern[]],
      rebuild,
    );
    return () => {
      unsub();
      sequenceRef.current?.dispose();
    };
  }, []);

  // ── Sync sequence start/stop with transport ───────────────────────────────
  useEffect(() => {
    const unsub = useDAWStore.subscribe(
      s => s.playing,
      playing => {
        if (!sequenceRef.current) return;
        if (playing) {
          sequenceRef.current.start(0);
        } else {
          sequenceRef.current.stop();
          useDAWStore.getState().setSequencerStep(-1);
        }
      },
    );
    return () => unsub();
  }, []);

  // ── API ───────────────────────────────────────────────────────────────────
  const toggleNote = useCallback((step: number, pitch: number, velocity = 100) => {
    const { activePatternId, midiPatterns, addMidiNote, removeMidiNote } = useDAWStore.getState();
    if (!activePatternId) return;
    const pattern = midiPatterns.find(p => p.id === activePatternId);
    if (!pattern) return;

    const existing = pattern.notes.find(n => n.step === step && n.pitch === pitch);
    if (existing) {
      removeMidiNote(activePatternId, existing.id);
    } else {
      addMidiNote(activePatternId, { pitch, step, duration: 1, velocity });
    }
  }, []);

  const clearPattern = useCallback(() => {
    const { activePatternId, midiPatterns } = useDAWStore.getState();
    if (!activePatternId) return;
    const pattern = midiPatterns.find(p => p.id === activePatternId);
    if (!pattern) return;
    for (const note of [...pattern.notes]) {
      useDAWStore.getState().removeMidiNote(activePatternId, note.id);
    }
  }, []);

  const setPatternLength = useCallback((steps: 16 | 32 | 64) => {
    const { activePatternId } = useDAWStore.getState();
    if (!activePatternId) return;
    // Slice notes that exceed new length
    const store = useDAWStore.getState();
    const pattern = store.midiPatterns.find(p => p.id === activePatternId);
    if (!pattern) return;
    for (const note of pattern.notes) {
      if (note.step >= steps) store.removeMidiNote(activePatternId, note.id);
    }
    // Update steps count via partial pattern mutation — expose via store if needed
  }, []);

  const nudgePitch = useCallback((noteId: string, delta: number) => {
    const { activePatternId, updateMidiNote } = useDAWStore.getState();
    if (!activePatternId) return;
    const pattern = useDAWStore.getState().midiPatterns.find(p => p.id === activePatternId);
    const note    = pattern?.notes.find(n => n.id === noteId);
    if (!note) return;
    updateMidiNote(activePatternId, noteId, { pitch: Math.max(0, Math.min(127, note.pitch + delta)) });
  }, []);

  const nudgeVelocity = useCallback((noteId: string, delta: number) => {
    const { activePatternId, updateMidiNote } = useDAWStore.getState();
    if (!activePatternId) return;
    const pattern = useDAWStore.getState().midiPatterns.find(p => p.id === activePatternId);
    const note    = pattern?.notes.find(n => n.id === noteId);
    if (!note) return;
    updateMidiNote(activePatternId, noteId, { velocity: Math.max(1, Math.min(127, note.velocity + delta)) });
  }, []);

  const duplicate = useCallback(() => {
    const { activePatternId, midiPatterns, addMidiPattern } = useDAWStore.getState();
    const pattern = midiPatterns.find(p => p.id === activePatternId);
    if (!pattern) return;
    addMidiPattern({ ...pattern, name: `${pattern.name} COPY`, notes: pattern.notes.map(n => ({ ...n })) });
  }, []);

  return { toggleNote, clearPattern, setPatternLength, nudgePitch, nudgeVelocity, duplicate, getPitchLabel };
}