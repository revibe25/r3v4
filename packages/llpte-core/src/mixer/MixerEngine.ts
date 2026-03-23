import type {
  MixerState, ChannelId, BusId, FaderDb, ChannelStrip, AutomationPoint,
} from "../types";

type MixerEvent =
  | { type: "FADER_CHANGE";     channelId: ChannelId; value: FaderDb }
  | { type: "PAN_CHANGE";       channelId: ChannelId; value: number }
  | { type: "MUTE_TOGGLE";      channelId: ChannelId }
  | { type: "SOLO_TOGGLE";      channelId: ChannelId }
  | { type: "SEND_LEVEL";       channelId: ChannelId; busId: BusId; level: FaderDb }
  | { type: "MASTER_FADER";     value: FaderDb }
  | { type: "AUTOMATION_WRITE"; channelId: ChannelId; paramId: string; point: AutomationPoint };

type Listener = (event: MixerEvent, state: MixerState) => void;

/**
 * MixerEngine — event-sourced, automation-aware channel strip manager.
 *
 * Invariants:
 *   - Solo-exclusive mode: engaging solo clears all others first.
 *   - Fader clamped to [−∞, +12 dB].
 *   - Pan clamped to [−1.0, 1.0].
 *   - Automation points stored in ascending time order.
 */
export class MixerEngine {
  private state: MixerState;
  private readonly listeners: Set<Listener> = new Set();

  constructor(initialState: MixerState) {
    this.state = initialState;
  }

  dispatch(event: MixerEvent): void {
    const next = this.reduce(this.state, event);
    this.state = next;
    for (const fn of this.listeners) fn(event, next);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): Readonly<MixerState> { return this.state; }

  getChannel(id: ChannelId): ChannelStrip | undefined {
    return this.state.channels.get(id);
  }

  private reduce(state: MixerState, event: MixerEvent): MixerState {
    switch (event.type) {
      case "FADER_CHANGE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        channels.set(event.channelId, {
          ...ch, fader: Math.min(12, Math.max(-Infinity, event.value)) as FaderDb,
        });
        return { ...state, channels };
      }
      case "PAN_CHANGE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        channels.set(event.channelId, { ...ch, pan: Math.min(1, Math.max(-1, event.value)) });
        return { ...state, channels };
      }
      case "MUTE_TOGGLE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        channels.set(event.channelId, { ...ch, mute: !ch.mute });
        return { ...state, channels };
      }
      case "SOLO_TOGGLE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        if (state.soloExclusive) {
          for (const [id, c] of channels) channels.set(id, { ...c, solo: false });
        }
        channels.set(event.channelId, { ...ch, solo: !ch.solo });
        return { ...state, channels };
      }
      case "MASTER_FADER":
        return { ...state, masterFader: Math.min(12, Math.max(-Infinity, event.value)) as FaderDb };
      case "AUTOMATION_WRITE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const laneIdx = ch.automationLanes.findIndex((l) => l.parameterId === event.paramId);
        const lanes = [...ch.automationLanes];
        if (laneIdx === -1) {
          lanes.push({ parameterId: event.paramId, points: [event.point] });
        } else {
          const points = [...lanes[laneIdx].points, event.point].sort((a, b) => a.time - b.time);
          lanes[laneIdx] = { ...lanes[laneIdx], points };
        }
        const channels = new Map(state.channels);
        channels.set(event.channelId, { ...ch, automationLanes: lanes });
        return { ...state, channels };
      }
      default:
        return state;
    }
  }
}
