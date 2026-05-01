// shared/types/project.types.ts

import type { AutomationLaneData } from "./automation.types";
import type { TransportState } from "./transport.types";

export type SerializedFX = {
  id: string;
  type: "eq" | "compressor" | "delay";
  params: Record<string, number>;
  bypassed: boolean;
};

export type SerializedTrack = {
  id: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  fx: SerializedFX[];
};

export type ProjectData = {
  version: 1;
  transport: TransportState;
  tracks: SerializedTrack[];
  automation: AutomationLaneData[];
};
