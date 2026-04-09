/**
 * shared/types/audio-additions.ts
 *
 * Additional audio types that were missing from shared/audio.types.ts,
 * causing TS2305 errors in:
 *   client/src/audio/fx/vst-sidechain.ts      — SidechainConfig
 *   client/src/audio/mixer/effect-chain.ts    — EffectChain, AudioEffect, EffectChainState
 *   client/src/audio/mixer/mixer-channel.ts   — MixerChannelConfig, EffectChain
 *
 * INSTALLATION:
 *   Append the contents of this file to shared/audio.types.ts  (or merge into
 *   the existing file), then ensure shared/index.ts re-exports these symbols.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * APPEND TO: shared/audio.types.ts
 * ADD TO:    shared/index.ts → export { ... } from './audio.types';
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Sidechain ─────────────────────────────────────────────────────────────────

/** Configuration for a sidechain routing in a VST or internal processor. */
export interface SidechainConfig {
  /** Source track ID whose signal drives the sidechain detector. */
  sourceTrackId: string;
  /** Threshold in dBFS above which the sidechain detector triggers. */
  threshold:     number;
  /** Attack time in seconds. */
  attack:        number;
  /** Release time in seconds. */
  release:       number;
  /** Whether the sidechain is actively engaged. */
  enabled:       boolean;
}

// ── Audio Effect (individual effect node) ─────────────────────────────────────

/** A single audio effect as stored and applied in a chain. */
export interface AudioEffect {
  /** Stable ID (UUID / nanoid). */
  id:         string;
  /** Registry key from EFFECTS_REGISTRY (e.g. 'eq-3band', 'reverb'). */
  type:       string;
  /** Human-readable name, may be customised by the user. */
  name:       string;
  /** Whether the effect is currently bypassed. */
  bypassed:   boolean;
  /** Effect-specific parameter values keyed by parameter name. */
  parameters: Record<string, number | boolean | string>;
}

// ── Effect Chain ──────────────────────────────────────────────────────────────

/** An ordered list of effects applied to a single audio bus or track. */
export interface EffectChain {
  /** ID of the track or bus this chain belongs to. */
  ownerId: string;
  /** Ordered array of effects; processing happens left-to-right. */
  effects: AudioEffect[];
}

/** Serialisable snapshot of an effect chain (e.g. for undo/redo or persistence). */
export interface EffectChainState {
  ownerId:   string;
  effects:   AudioEffect[];
  /** ISO-8601 timestamp of the last modification. */
  updatedAt: string;
}

// ── Mixer Channel ─────────────────────────────────────────────────────────────

/** Configuration for a single channel strip in the R3 mixer. */
export interface MixerChannelConfig {
  /** Unique channel ID. */
  id:        string;
  /** Display name shown in the mixer strip. */
  name:      string;
  /** Output volume in dBFS (-Infinity to +6). */
  volume:    number;
  /** Stereo pan position in the range [-1, 1] (L, centre, R). */
  pan:       number;
  /** Whether the channel is muted. */
  muted:     boolean;
  /** Whether the channel is soloed. */
  soloed:    boolean;
  /** The effects chain attached to this channel. */
  chain:     EffectChain;
  /** Optional sidechain routing. */
  sidechain: SidechainConfig | null;
}
