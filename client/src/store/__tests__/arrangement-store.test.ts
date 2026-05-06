import { describe, it, expect, beforeEach } from "vitest";
import { useArrangementStore } from "../arrangement-store";

// Reset store before each test
beforeEach(() => {
  useArrangementStore.getState().resetArrangement();
});

describe("arrangement-store", () => {
  describe("tracks", () => {
    it("adds a track with correct defaults", () => {
      const { addTrack } = useArrangementStore.getState();
      addTrack("audio");
      const { tracks } = useArrangementStore.getState();
      expect(tracks).toHaveLength(1);
      expect(tracks[0].type).toBe("audio");
      expect(tracks[0].volume).toBe(0.8);
      expect(tracks[0].muted).toBe(false);
    });

    it("removes a track by id", () => {
      const store = useArrangementStore.getState();
      store.addTrack("midi");
      const { tracks } = useArrangementStore.getState();
      store.removeTrack(tracks[0].id);
      expect(useArrangementStore.getState().tracks).toHaveLength(0);
    });

    it("updates a track field", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      const id = useArrangementStore.getState().tracks[0].id;
      store.updateTrack(id, { volume: 0.5, muted: true });
      const t = useArrangementStore.getState().tracks[0];
      expect(t.volume).toBe(0.5);
      expect(t.muted).toBe(true);
    });

    it("reorders tracks correctly", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      store.addTrack("midi");
      store.addTrack("bus");
      const before = useArrangementStore.getState().tracks.map(t => t.type);
      expect(before).toEqual(["audio", "midi", "bus"]);
      const firstId = useArrangementStore.getState().tracks[0].id;
      store.reorderTrack(firstId, 2);
      const after = useArrangementStore.getState().tracks
        .sort((a, b) => a.order - b.order)
        .map(t => t.type);
      expect(after[2]).toBe("audio");
    });
  });

  describe("undo / redo", () => {
    it("undoes a track addition", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      expect(useArrangementStore.getState().tracks).toHaveLength(1);
      store.undo();
      expect(useArrangementStore.getState().tracks).toHaveLength(0);
    });

    it("redoes after undo", () => {
      const store = useArrangementStore.getState();
      store.addTrack("midi");
      store.undo();
      store.redo();
      expect(useArrangementStore.getState().tracks).toHaveLength(1);
    });

    it("clears redo stack after new action", () => {
      const store = useArrangementStore.getState();
      store.addTrack("audio");
      store.undo();
      store.addTrack("midi"); // new action clears redo
      store.redo();           // should be a no-op
      expect(useArrangementStore.getState().tracks).toHaveLength(1);
      expect(useArrangementStore.getState().tracks[0].type).toBe("midi");
    });

    it("caps undo stack at MAX_UNDO", () => {
      const store = useArrangementStore.getState();
      for (let i = 0; i < 55; i++) store.setTempo(60 + i);
      expect(useArrangementStore.getState()._past.length).toBeLessThanOrEqual(50);
    });
  });

  describe("transport", () => {
    it("play sets playing=true", () => {
      useArrangementStore.getState().play();
      expect(useArrangementStore.getState().playing).toBe(true);
    });

    it("stop resets playhead and recording", () => {
      const store = useArrangementStore.getState();
      store.play();
      store.toggleRecord();
      store.setPlayhead(32);
      store.stop();
      const s = useArrangementStore.getState();
      expect(s.playing).toBe(false);
      expect(s.recording).toBe(false);
      expect(s.playhead).toBe(0);
    });

    it("clamps tempo to 20–999", () => {
      useArrangementStore.getState().setTempo(5);
      expect(useArrangementStore.getState().tempo).toBe(20);
      useArrangementStore.getState().setTempo(9999);
      expect(useArrangementStore.getState().tempo).toBe(999);
    });
  });

  describe("markers", () => {
    it("adds a marker and keeps them sorted by position", () => {
      const store = useArrangementStore.getState();
      store.addMarker(32, "Drop");
      store.addMarker(8,  "Intro");
      store.addMarker(64, "Outro");
      const positions = useArrangementStore.getState().markers.map(m => m.position);
      expect(positions).toEqual([8, 32, 64]);
    });

    it("removes a marker by id", () => {
      const store = useArrangementStore.getState();
      store.addMarker(16, "Verse");
      const id = useArrangementStore.getState().markers[0].id;
      store.removeMarker(id);
      expect(useArrangementStore.getState().markers).toHaveLength(0);
    });
  });
});
