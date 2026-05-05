// FILE: client/src/audio/clips/ClipTrack.ts
import * as Tone from 'tone';
import { MixerChannel } from '../mixer/mixer-channel';
import type { AudioClipConfig, AudioClipState } from './audio-clip';
import { AudioClip } from './audio-clip';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClipTrackState = 'idle' | 'playing' | 'recording' | 'disposed';

export interface ClipTrackConfig {
  id: string;
  name?: string;
  /** Whether to throw when adding a clip that overlaps an existing one */
  rejectOverlaps?: boolean;
}

export type ClipTrackEventMap = {
  /** A clip was added */
  clipAdded:   { track: ClipTrack; clip: AudioClip };
  /** A clip was removed */
  clipRemoved: { track: ClipTrack; clipId: string };
  /** A clip was replaced via replaceClip() */
  clipReplaced:{ track: ClipTrack; previous: AudioClip; next: AudioClip };
  /** Mute/solo/arm toggled */
  muteChanged: { track: ClipTrack; muted: boolean };
  soloChanged: { track: ClipTrack; solo: boolean };
  armedChanged:{ track: ClipTrack; armed: boolean };
  /** Volume or pan changed */
  volumeChanged:{ track: ClipTrack; value: number };
  panChanged:   { track: ClipTrack; value: number };
  /** Transport stop flushed all clips */
  allStopped:  { track: ClipTrack };
  /** dispose() was called */
  disposed:    { track: ClipTrack };
  /** Any internal error */
  error:       { track: ClipTrack; error: Error };
};

type EventListener<K extends keyof ClipTrackEventMap> = (
  payload: ClipTrackEventMap[K],
) => void;

// ─── ClipTrack ────────────────────────────────────────────────────────────────

export class ClipTrack {
  readonly id: string;
  readonly name: string;
  readonly channel: MixerChannel;

  private clips = new Map<string, AudioClip>();
  private _state: ClipTrackState = 'idle';

  // Track-level flags
  private _muted = false;
  private _solo  = false;
  private _armed = false;

  // Tone transport listeners — stored so they can be removed on dispose
  private _onStop:  () => void;
  private _onStart: () => void;
  private _onPause: () => void;

  private readonly rejectOverlaps: boolean;

  // Typed event emitter
  private listeners: {
    [K in keyof ClipTrackEventMap]?: Set<EventListener<K>>;
  } = {};

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor({ id, name, rejectOverlaps = false }: ClipTrackConfig) {
    this.id             = id;
    this.name           = name ?? id;
    this.channel        = new MixerChannel(id);
    this.rejectOverlaps = rejectOverlaps;

    // Bind handlers so they can be properly removed later
    this._onStop  = () => this.handleTransportStop();
    this._onStart = () => { if (this._state !== 'disposed') this._state = 'playing'; };
    this._onPause = () => { if (this._state === 'playing')  this._state = 'idle'; };

    Tone.Transport.on('stop',  this._onStop);
    Tone.Transport.on('start', this._onStart);
    Tone.Transport.on('pause', this._onPause);
  }

  // ─── State ──────────────────────────────────────────────────────────────────

  get state(): ClipTrackState    { return this._state; }
  get muted(): boolean           { return this._muted; }
  get solo():  boolean           { return this._solo;  }
  get armed(): boolean           { return this._armed; }

  get clipCount(): number        { return this.clips.size; }
  get isEmpty():   boolean       { return this.clips.size === 0; }

  // ─── Clip Management ─────────────────────────────────────────────────────────

  /**
   * Add a new clip. Throws if a clip with the same id already exists,
   * or (when `rejectOverlaps` is set) if it overlaps an existing clip.
   */
  addClip(config: AudioClipConfig): AudioClip {
    this.assertNotDisposed();

    if (this.clips.has(config.id)) {
      throw new Error(`Clip "${config.id}" already exists on track "${this.id}".`);
    }

    if (this.rejectOverlaps) {
      const conflict = this.findOverlap(config);
      if (conflict) {
        throw new Error(
          `Clip "${config.id}" (start=${config.startTime}, ` +
          `end=${config.startTime + (config.duration ?? this.channel.context.sampleRate)}) ` +
          `overlaps existing clip "${conflict.id}".`,
        );
      }
    }

    const clip = new AudioClip(config, this.channel);

    // Bubble clip errors up to the track
    clip.on('error', ({ error }) => this.emit('error', { track: this, error }));

    this.clips.set(config.id, clip);
    this.emit('clipAdded', { track: this, clip });
    return clip;
  }

  /**
   * Remove and dispose a clip by id. No-op if the clip doesn't exist.
   */
  removeClip(clipId: string): boolean {
    const clip = this.clips.get(clipId);
    if (!clip) return false;

    clip.dispose();
    this.clips.delete(clipId);
    this.emit('clipRemoved', { track: this, clipId });
    return true;
  }

  /**
   * Atomically replace a clip's config. The old clip is disposed and a new
   * one is scheduled in its place. Throws if `clipId` doesn't exist.
   */
  replaceClip(clipId: string, config: AudioClipConfig): AudioClip {
    this.assertNotDisposed();

    const previous = this.clips.get(clipId);
    if (!previous) throw new Error(`Clip "${clipId}" not found on track "${this.id}".`);

    previous.dispose();
    const next = new AudioClip({ ...config, id: clipId }, this.channel);
    next.on('error', ({ error }) => this.emit('error', { track: this, error }));

    this.clips.set(clipId, next);
    this.emit('clipReplaced', { track: this, previous, next });
    return next;
  }

  getClip(clipId: string): AudioClip | undefined {
    return this.clips.get(clipId);
  }

  /**
   * All clips sorted by start time ascending.
   */
  getAllClips(): AudioClip[] {
    return [...this.clips.values()].sort(
      (a, b) => (a.toJSON().startTime ?? 0) - (b.toJSON().startTime ?? 0),
    );
  }

  /**
   * Clips whose state matches the given filter.
   */
  getClipsByState(state: AudioClipState): AudioClip[] {
    return this.getAllClips().filter((c) => c.state === state);
  }

  /**
   * Stop all clips without removing them. They can be rescheduled via
   * Tone.Transport restart.
   */
  stopAll(): void {
    for (const clip of this.clips.values()) {
      clip.stop();
    }
    this.emit('allStopped', { track: this });
  }

  /**
   * Dispose every clip and clear the map — useful for clearing the track
   * contents while keeping the track itself alive.
   */
  clearClips(): void {
    for (const clip of this.clips.values()) {
      clip.dispose();
    }
    this.clips.clear();
  }

  // ─── Track Controls ──────────────────────────────────────────────────────────

  setMute(muted: boolean): this {
    if (this._muted === muted) return this;
    this._muted = muted;
    this.channel.setMute(muted);
    this.emit('muteChanged', { track: this, muted });
    return this;
  }

  setSolo(solo: boolean): this {
    if (this._solo === solo) return this;
    this._solo = solo;
    // MixerChannel may expose .solo directly or via a method — support both
    if (typeof (this.channel as unknown as Record<string, unknown>).setSolo === 'function') {
      (this.channel as unknown as { setSolo: (v: boolean) => void }).setSolo(solo);
    } else {
      (this.channel as unknown as { solo: boolean }).solo = solo;
    }
    this.emit('soloChanged', { track: this, solo });
    return this;
  }

  setArmed(armed: boolean): this {
    if (this._armed === armed) return this;
    this._armed = armed;
    this.emit('armedChanged', { track: this, armed });
    return this;
  }

  setVolume(value: number): this {
    this.channel.setVolume(clamp(value, 0, 1));
    this.emit('volumeChanged', { track: this, value });
    return this;
  }

  setPan(value: number): this {
    this.channel.setPan(clamp(value, -1, 1));
    this.emit('panChanged', { track: this, value });
    return this;
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      id:      this.id,
      name:    this.name,
      state:   this._state,
      muted:   this._muted,
      solo:    this._solo,
      armed:   this._armed,
      clips:   this.getAllClips().map((c) => c.toJSON()),
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._state === 'disposed') return;

    // Remove Tone listeners before clearing clips to avoid re-entrant calls
    Tone.Transport.off('stop',  this._onStop);
    Tone.Transport.off('start', this._onStart);
    Tone.Transport.off('pause', this._onPause);

    this.clearClips();
    this.channel.disconnect();

    this._state = 'disposed';
    this.emit('disposed', { track: this });
    this.listeners = {};
  }

  // ─── Event Emitter ────────────────────────────────────────────────────────────

  on<K extends keyof ClipTrackEventMap>(event: K, listener: EventListener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<EventListener<K>>).add(listener);
    return this;
  }

  off<K extends keyof ClipTrackEventMap>(event: K, listener: EventListener<K>): this {
    (this.listeners[event] as Set<EventListener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof ClipTrackEventMap>(event: K, listener: EventListener<K>): this {
    const wrapper: EventListener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof ClipTrackEventMap>(
    event: K,
    payload: ClipTrackEventMap[K],
  ): void {
    (this.listeners[event] as Set<EventListener<K>> | undefined)?.forEach((fn) =>
      fn(payload),
    );
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private handleTransportStop(): void {
    if (this._state === 'disposed') return;
    this.stopAll();
    this._state = 'idle';
  }

  private assertNotDisposed(): void {
    if (this._state === 'disposed') {
      throw new Error(`ClipTrack "${this.id}" has been disposed.`);
    }
  }

  /**
   * Returns the first existing clip that would overlap `incoming`, or null.
   * Overlap = the two time ranges intersect (exclusive of shared endpoints).
   */
  private findOverlap(incoming: AudioClipConfig): AudioClip | null {
    const inStart = incoming.startTime;
    const inEnd   = inStart + (incoming.duration ?? Infinity);

    for (const clip of this.clips.values()) {
      const { startTime, duration } = clip.toJSON();
      const exStart = startTime ?? 0;
      const exEnd   = exStart + (duration ?? Infinity);
      if (inStart < exEnd && inEnd > exStart) return clip;
    }

    return null;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}