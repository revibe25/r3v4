// @ts-nocheck
// client/src/project/project-loader.ts
//
// Loads a serialised ProjectData object back into the running stores.

import { ProjectData } from "../../../shared/types/project.types";
import { useMixerStore }     from "../store/mixer-store";
import { useTransportStore } from "../store/transport-store";

export function loadProject(data: ProjectData): void {
  const mixer     = useMixerStore.getState();
  const transport = useTransportStore.getState();

  // ── Clear existing state ──────────────────────────────────────────────────
  Object.keys(mixer.channels).forEach(id => mixer.removeChannel(id));

  // ── Restore transport ─────────────────────────────────────────────────────
  transport.setBpm(data.transport.bpm);
  if (data.transport.loop) {
    transport.setLoop(true);
    transport.setLoopRegion(data.transport.loopStart, data.transport.loopEnd);
  }

  // ── Restore tracks ────────────────────────────────────────────────────────
  data.tracks.forEach(track => {
    mixer.addChannel(track.id, {
      name:   track.name ?? track.id,
      volume: track.volume,
      pan:    track.pan,
      muted:  track.muted,
      solo:   track.solo,
    });
  });
}

/**
 * Parse a JSON string exported by exportProjectJSON() and load it.
 */
export function importProjectJSON(json: string): void {
  const data: ProjectData = JSON.parse(json);
  loadProject(data);
}