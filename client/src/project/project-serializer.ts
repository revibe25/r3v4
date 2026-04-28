// @ts-nocheck
// client/src/project/project-serializer.ts
//
// Serializes the current project state to a plain ProjectData object.
//
// IMPORTANT: This module reads from *stores* (plain serialisable data) only.
// It never touches audio-engine objects (MixerChannel, GainNode …) because
// those are runtime-only and cannot be JSON-stringified.
//
// FIX (2026-04-25): Was reading from useTransportStore which DAW.tsx never
// writes to. Swapped to useDAWStore — the canonical live transport source.
// Field renames: currentPosition→position, isLooping→loopEnabled.
//
// KNOWN UNIT GAP: TransportState.position is typed in seconds; useDAWStore.position
// is in beats. Writing beats here for now — a real value beats always-zero.
// Resolve when position model is unified. Tracked: TODO-position-unit.

import { ProjectData } from "../../../shared/types/project.types";
import { useMixerStore } from "../store/mixer-store";
import { useDAWStore }   from "../hooks/useDAWStore";

export function serializeProject(): ProjectData {
  const mixer = useMixerStore.getState();
  const daw   = useDAWStore.getState();

  return {
    version:   1,
    timestamp: Date.now(),
    transport: {
      playing:   daw.playing,
      recording: daw.recording,
      bpm:       daw.bpm,
      position:  daw.position,  // NOTE: beats, not seconds — see TODO-position-unit
      loop:      daw.loopEnabled,
      loopStart: daw.loopStart,
      loopEnd:   daw.loopEnd,
    },
    tracks: Object.values(mixer.channels).map(ch => ({
      id:     ch.id,
      name:   ch.name,
      volume: ch.volume,
      pan:    ch.pan,
      muted:  ch.muted,
      solo:   ch.solo,
      fx:     [], // FX chain is runtime-only; serialise via fx-store if needed
    })),
    automation: [],
  };
}

/**
 * Serialise to JSON string — convenience wrapper around serializeProject().
 */
export function exportProjectJSON(): string {
  return JSON.stringify(serializeProject(), null, 2);
}
