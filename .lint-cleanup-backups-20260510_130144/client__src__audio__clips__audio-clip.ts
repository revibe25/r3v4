// FILE: client/src/audio/clips/AudioClip.ts
import * as Tone from 'tone';
import { getAudioContext, getAudioContextSync } from '../core/audio-context';
import type { MixerChannel } from '../mixer/mixer-channel';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AudioClipState = 'idle' | 'scheduled' | 'playing' | 'paused' | 'stopped' | 'disposed';

export interface AudioClipConfig {
  id: string;
  buffer: AudioBuffer;
  /** Start time in seconds on the Tone.Transport timeline */
  startTime: number;
  /** Seconds into the buffer to begin playback from */
  offset?: number;
  /** Playback duration in seconds — omit to play to end of buffer */
  duration?: number;
  /** Playback rate multiplier (1 = normal, 0.5 = half speed) */
  playbackRate?: number;
  /** Gain/volume for this clip only (0–1, default 1) */
  gain?: number;
  /** Fade in duration in seconds */
  fadeIn?: number;
  /** Fade out duration in seconds */
  fadeOut?: number;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
}

export type AudioClipEventMap = {
  /** Fires when playback actually starts at the AudioContext level */
  start:   { clip: AudioClip; contextTime: number };
  /** Fires when the source node ends naturally */
  ended:   { clip: AudioClip };
  /** Fires when stop() is called manually */
  stopped: { clip: AudioClip };
  /** Fires when update() is called */
  updated: { clip: AudioClip; changes: Partial<AudioClipConfig> };
  /** Fires when the clip is fully disposed */
  disposed:{ clip: AudioClip };
  /** Fires if scheduling or playback throws */
  error:   { clip: AudioClip; error: Error };
};

type EventListener<K extends keyof AudioClipEventMap> = (
  payload: AudioClipEventMap[K],
) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a Tone.Transport time (seconds from transport start) to the
 * absolute AudioContext time at which that moment will occur.
 */
function transportToContextTime(transportTime: number, ctx: AudioContext): number {
  return ctx.currentTime + (transportTime - Tone.now());
}

// ─── AudioClip ────────────────────────────────────────────────────────────────

export class AudioClip {
  readonly id: string;
  readonly buffer: AudioBuffer;

  private context: AudioContext;
  private channel: MixerChannel;
  private config: AudioClipConfig;

  // Graph nodes
  private source?: AudioBufferSourceNode;
  private gainNode?: GainNode;

  // Tone scheduling handle — stored so we can cancel it
  private scheduleId?: number;

  // Public state
  private _state: AudioClipState = 'idle';
  /** Time (AudioContext seconds) at which playback started — set in start() */
  private _startedAt = 0;

  // Typed event emitter
  private listeners: {
    [K in keyof AudioClipEventMap]?: Set<EventListener<K>>;
  } = {};

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor(config: AudioClipConfig, channel: MixerChannel) {
    this.id      = config.id;
    this.buffer  = config.buffer;
    this.channel = channel;
    this.config  = { ...config };
    this.context = getAudioContextSync() ?? new (window.AudioContext || (window as any).webkitAudioContext)();

    this.schedule();
  }

  // ─── State ──────────────────────────────────────────────────────────────────

  get state(): AudioClipState {
    return this._state;
  }

  /** Seconds the clip has been playing. 0 if not started. */
  get currentTime(): number {
    if (this._state !== 'playing') return 0;
    return this.context.currentTime - this._startedAt;
  }

  /** Total playback duration — config.duration ?? buffer.duration */
  get duration(): number {
    return this.config.duration ?? this.buffer.duration;
  }

  // ─── Scheduling ─────────────────────────────────────────────────────────────

  private schedule(): void {
    if (this._state === 'disposed') return;

    // Cancel any previous schedule before re-scheduling
    this.cancelSchedule();

    try {
      // Tone.Transport.schedule returns an id we can cancel later
      this.scheduleId = Tone.Transport.schedule((time) => {
        this.handleStart(time);
      }, this.config.startTime) as unknown as number;

      this._state = 'scheduled';
    } catch (err) {
      this.emit('error', { clip: this, error: toError(err) });
    }
  }

  private cancelSchedule(): void {
    if (this.scheduleId !== undefined) {
      Tone.Transport.clear(this.scheduleId);
      this.scheduleId = undefined;
    }
  }

  // ─── Playback ────────────────────────────────────────────────────────────────

  private handleStart(transportTime: number): void {
    if (this._state === 'disposed') return;

    try {
      this.teardownSource(); // clean up any existing source safely

      // Build the clip gain node so volume / fades don't bleed into the
      // channel-level gain that MixerChannel owns.
      this.gainNode = this.context.createGain();
      this.gainNode.gain.setTargetAtTime(this.config.gain ?? 1, this.context.currentTime, 0.015);
      this.gainNode.connect(this.channel.input);

      // Build the buffer source
      const src = this.context.createBufferSource();
      src.buffer = this.buffer;
      src.playbackRate.value = this.config.playbackRate ?? 1;

      if (this.config.loop) {
        src.loop      = true;
        src.loopStart = this.config.loopStart ?? 0;
        src.loopEnd   = this.config.loopEnd   ?? this.buffer.duration;
      }

      src.connect(this.gainNode);

      const when    = transportToContextTime(transportTime, this.context);
      const offset  = this.config.offset   ?? 0;
      const duration = this.config.duration;

      // Fades — schedule against gainNode
      const gain = this.gainNode.gain;
      const targetGain = this.config.gain ?? 1;

      if ((this.config.fadeIn ?? 0) > 0) {
        gain.setValueAtTime(0, when);
        gain.linearRampToValueAtTime(targetGain, when + this.config.fadeIn!);
      } else {
        gain.setValueAtTime(targetGain, when);
      }

      if ((this.config.fadeOut ?? 0) > 0 && duration !== undefined) {
        const fadeStart = when + duration - this.config.fadeOut!;
        gain.setValueAtTime(targetGain, fadeStart);
        gain.linearRampToValueAtTime(0, when + duration);
      }

      // Start the source
      if (duration !== undefined) {
        src.start(when, offset, duration);
      } else {
        src.start(when, offset);
      }

      src.onended = () => {
        if (this._state === 'playing') {
          this._state = 'stopped';
          this.emit('ended', { clip: this });
          this.teardownSource();
        }
      };

      this.source    = src;
      this._startedAt = when;
      this._state    = 'playing';

      this.emit('start', { clip: this, contextTime: when });
    } catch (err) {
      this._state = 'idle';
      this.emit('error', { clip: this, error: toError(err) });
    }
  }

  /** Immediately stop playback and clean up the source node. */
  stop(): void {
    if (this._state === 'disposed') return;
    this.cancelSchedule();
    this.teardownSource();
    this._state = 'stopped';
    this.emit('stopped', { clip: this });
  }

  /** Tear down just the source+gain without changing state. */
  private teardownSource(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source.disconnect();
      this.source = undefined;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = undefined;
    }
  }

  /** Stop, release all nodes, and cancel all listeners. */
  dispose(): void {
    if (this._state === 'disposed') return;
    this.stop();
    this._state = 'disposed';
    this.listeners = {};
    this.emit('disposed', { clip: this });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  /**
   * Patch the clip config. If `startTime` changes the clip is rescheduled.
   * If `gain` or `playbackRate` changes they are applied immediately if playing.
   */
  update(changes: Partial<Omit<AudioClipConfig, 'id' | 'buffer'>>): void {
    if (this._state === 'disposed') return;

    const prev = { ...this.config };
    this.config = { ...this.config, ...changes };

    // Apply live-patchable params immediately
    if (changes.gain !== undefined && this.gainNode) {
      this.gainNode.gain.setTargetAtTime(
        changes.gain,
        this.context.currentTime,
        0.015, // 15 ms ramp — avoids clicks
      );
    }

    if (changes.playbackRate !== undefined && this.source) {
      this.source.playbackRate.setTargetAtTime(
        changes.playbackRate,
        this.context.currentTime,
        0.015,
      );
    }

    if (changes.loop !== undefined && this.source) {
      this.source.loop      = changes.loop;
      this.source.loopStart = this.config.loopStart ?? 0;
      this.source.loopEnd   = this.config.loopEnd   ?? this.buffer.duration;
    }

    // Re-schedule if the transport position changed
    if (changes.startTime !== undefined && changes.startTime !== prev.startTime) {
      this.stop();
      this.schedule();
    }

    this.emit('updated', { clip: this, changes });
  }

  // ─── Event emitter ────────────────────────────────────────────────────────────

  on<K extends keyof AudioClipEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<EventListener<K>>).add(listener);
    return this;
  }

  off<K extends keyof AudioClipEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    (this.listeners[event] as Set<EventListener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof AudioClipEventMap>(
    event: K,
    listener: EventListener<K>,
  ): this {
    const wrapper: EventListener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof AudioClipEventMap>(
    event: K,
    payload: AudioClipEventMap[K],
  ): void {
    (this.listeners[event] as Set<EventListener<K>> | undefined)?.forEach((fn) =>
      fn(payload),
    );
  }

  // ─── Debug ───────────────────────────────────────────────────────────────────

  toJSON() {
    return {
      id:          this.id,
      state:       this._state,
      startTime:   this.config.startTime,
      offset:      this.config.offset,
      duration:    this.config.duration,
      gain:        this.config.gain,
      playbackRate: this.config.playbackRate,
      loop:        this.config.loop,
      fadeIn:      this.config.fadeIn,
      fadeOut:     this.config.fadeOut,
    };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}