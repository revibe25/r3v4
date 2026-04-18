import type { NodeId, Milliseconds } from "./audio-graph.types";

export type ChannelId = string & { readonly __brand: "ChannelId" };
export type BusId     = string & { readonly __brand: "BusId" };
export type FaderDb   = number & { readonly __brand: "dB" }; // −∞ to +12

export interface ChannelStrip {
  readonly id: ChannelId;
  readonly name: string;
  readonly fader: FaderDb;
  readonly pan: number;     // −1.0 to 1.0
  readonly mute: boolean;
  readonly solo: boolean;
  readonly inserts: NodeId[];
  readonly sends: SendRoute[];
  readonly automationLanes: AutomationLane[];
}

export interface SendRoute {
  readonly destinationBus: BusId;
  readonly level: FaderDb;
  readonly preFader: boolean;
}

export interface Bus {
  readonly id: BusId;
  readonly name: string;
  readonly type: "aux" | "master" | "group";
  readonly fader: FaderDb;
  readonly inserts: NodeId[];
}

export interface AutomationLane {
  readonly parameterId: string;
  readonly points: AutomationPoint[];
}

export interface AutomationPoint {
  readonly time: Milliseconds;
  readonly value: number;
  readonly curve: "linear" | "smooth" | "step";
}

export interface MixerState {
  readonly channels: Map<ChannelId, ChannelStrip>;
  readonly buses: Map<BusId, Bus>;
  readonly masterFader: FaderDb;
  readonly soloExclusive: boolean;
}
