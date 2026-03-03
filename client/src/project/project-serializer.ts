// client/src/project/project-serializer.ts
//
// Serializes the current project state to a plain ProjectData object.
//
// IMPORTANT: This module reads from *stores* (plain serialisable data) only.
// It never touches audio-engine objects (MixerChannel, GainNode …) because
// those are runtime-only and cannot be JSON-stringified.

import { ProjectData } from "../../../shared/types/project.types";
import { useMixerStore }     from "../store/mixer-store";
import { useTransportStore } from "../store/transport-store";

export function serializeProject(): ProjectData {
  const mixer     = useMixerStore.getState();
  const transport = useTransportStore.getState();

  return {
    version:   1,
    timestamp: Date.now(),
    transport: {
      playing:   transport.playing,
      recording: transport.recording,
      bpm:       transport.bpm,           // ← flat property on store
      position:  transport.currentPosition,
      loop:      transport.isLooping,
      loopStart: transport.loopStart,
      loopEnd:   transport.loopEnd,
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