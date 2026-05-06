/**
 * useDAWKeyboardShortcuts — wires ALL DAW shortcuts to dawStore actions.
 * Mount once at the root DAW page.
 */
import { useDAWStore, useView, useTransport } from "@/state/dawStore";
import { useKeyboardShortcuts, buildDAWShortcuts } from "./useKeyboardShortcuts";

export function useDAWKeyboardShortcuts(): void {
  const store     = useDAWStore();
  const { tool }  = useView();
  const { isPlaying } = useTransport();

  const shortcuts = buildDAWShortcuts({
    play:            () => isPlaying ? store.pause() : store.play(),
    stop:            () => store.stop(),
    record:          () => store.toggleRecord(),
    undo:            () => { /* wired to arrangement-store undo if needed */ },
    redo:            () => { /* wired to arrangement-store redo if needed */ },
    save:            () => store.markClean(),
    zoomIn:          () => store.zoomIn(),
    zoomOut:         () => store.zoomOut(),
    prevMarker:      () => {
      const { markers, transport } = store;
      const prev = [...markers].reverse().find(m => m.position < transport.currentBar - 0.1);
      if (prev) store.jumpToMarker(prev.id);
    },
    nextMarker:      () => {
      const { markers, transport } = store;
      const next = markers.find(m => m.position > transport.currentBar + 0.1);
      if (next) store.jumpToMarker(next.id);
    },
    deleteSelected:  () => {
      const { selection, tracks } = store;
      selection.regionIds.forEach(rid => {
        const track = tracks.find(t => t.regions.some(r => r.id === rid));
        if (track) store.removeRegion(track.id, rid);
      });
      store.selectRegions([]);
    },
    deselectAll:     () => { store.selectRegions([]); store.selectTrack(null); },
    duplicateRegion: () => {
      store.selection.regionIds.forEach(rid => store.duplicateRegion(rid));
    },
    selectAll:       () => {
      const all = store.tracks.flatMap(t => t.regions.map(r => r.id));
      store.selectRegions(all);
    },
  });

  // Tool shortcuts
  const toolMap = {
    "v": () => store.setTool("select"),
    "V": () => store.setTool("select"),
    "d": () => store.setTool("draw"),
    "D": () => store.setTool("draw"),
    "e": () => store.setTool("erase"),
    "E": () => store.setTool("erase"),
    "c": () => store.setTool("cut"),
    "C": () => store.setTool("cut"),
    "f": () => store.setTool("fade"),
    "F": () => store.setTool("fade"),
    // Panel toggles
    "Tab":    () => store.togglePanel("mixer"),
    "p":      () => store.togglePanel("piano"),
    "P":      () => store.togglePanel("piano"),
    "i":      () => store.togglePanel("inspector"),
    "I":      () => store.togglePanel("inspector"),
    "a":      () => store.togglePanel("automation"),
    "A":      () => store.togglePanel("automation"),
    // Return to start
    "Home":   () => store.seekTo(1),
    // Loop toggle
    "l":      () => store.toggleLoop(),
    "L":      () => store.toggleLoop(),
    // Metronome
    "m":      () => store.toggleMetronome(),
    "M":      () => store.toggleMetronome(),
    // Add marker at playhead
    "Ctrl+m": () => store.addMarker(store.transport.currentBar),
    "Ctrl+M": () => store.addMarker(store.transport.currentBar),
    // Duplicate track
    "Ctrl+Shift+d": () => {
      const id = store.selection.trackId;
      if (id) store.duplicateTrack(id);
    },
  };

  useKeyboardShortcuts({ ...shortcuts, ...toolMap });
}
