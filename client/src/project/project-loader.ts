// @ts-nocheck
// client/src/project/project-loader.ts
//
// Loads a serialised ProjectData object back into the running stores.
//
// FIX (2026-04-25): Was writing to useTransportStore which DAW.tsx never
// reads from. Swapped to useDAWStore — the canonical live transport source.
// Action renames: setLoop→setLoopEnabled, setLoopRegion→setLoopPoints.
// BUG FIX: loop=false case now explicitly calls setLoopEnabled(false) so
// loading a no-loop project clears any active loop from the previous session.

import type { ProjectData } from "../../../shared/types/project.types";
import { useMixerStore } from "../store/mixer-store";
import { useDAWStore }   from "../hooks/useDAWStore";

export function loadProject(data: ProjectData): void {
  const mixer = useMixerStore.getState();
  const daw   = useDAWStore.getState();

  // ── Clear existing state ──────────────────────────────────────────────────
  Object.keys(mixer.channels).forEach(id => mixer.removeChannel(id));

  // ── Restore transport ─────────────────────────────────────────────────────
  daw.setBpm(data.transport.bpm);
  daw.setLoopEnabled(data.transport.loop);          // covers both true and false
  if (data.transport.loop) {
    daw.setLoopPoints(data.transport.loopStart, data.transport.loopEnd);
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
