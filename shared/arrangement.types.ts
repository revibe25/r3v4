/**
 * shared/arrangement.types.ts — Canonical arrangement/timeline types for R3 v4
 */

export type TrackType = "audio" | "midi" | "bus" | "master" | "return";

export interface AudioRegion {
  id: string;
  trackId: string;
  name: string;
  startBar: number;
  length: number;       // in bars
  offset: number;       // trim start offset in bars
  gain: number;         // 0–2 (1 = unity)
  fadeIn: number;       // bars
  fadeOut: number;      // bars
  muted: boolean;
  reversed: boolean;
  audioFileId: string;
  color?: string;
}

export interface MidiRegionRef {
  id: string;
  trackId: string;
  name: string;
  startBar: number;
  length: number;
  midiRegionId: string;
  color?: string;
}

export type Region = AudioRegion | MidiRegionRef;

export interface ArrangementTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  height: number;       // pixels
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  volume: number;       // 0–1
  pan: number;          // -1 to 1
  regions: Region[];
  order: number;
}

export interface TransportPosition {
  bar: number;
  beat: number;
  tick: number;
  seconds: number;
}

export interface LoopRange {
  startBar: number;
  endBar: number;
  enabled: boolean;
}

export interface ArrangementMarker {
  id: string;
  position: number;     // in bars
  name: string;
  color: string;
}

export interface Arrangement {
  id: string;
  name: string;
  tracks: ArrangementTrack[];
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  lengthBars: number;
  loopRange: LoopRange;
  markers: ArrangementMarker[];
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_TRACK_COLORS = [
  "#b8ff00","#00e5ff","#ff6b35","#a855f7",
  "#22c55e","#f59e0b","#ec4899","#64748b",
] as const;

export const DEFAULT_ARRANGEMENT: Omit<Arrangement, "id" | "createdAt" | "updatedAt"> = {
  name: "Untitled Project",
  tracks: [],
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  lengthBars: 64,
  loopRange: { startBar: 1, endBar: 5, enabled: false },
  markers: [],
};

