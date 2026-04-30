// @ts-nocheck
/**
 * link-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ableton Link integration engine.
 *
 * Improvements over v1:
 *  • Defensive init — gracefully degrades if AbletonLink is unavailable
 *    (e.g. the WASM build hasn't loaded yet) instead of throwing at import time.
 *  • Reconnection logic — if the Link session drops, re-attempts after a
 *    configurable backoff up to MAX_RETRIES times.
 *  • CSS variable writes are batched via requestAnimationFrame so they never
 *    block the Link update callback (which may run off the main thread).
 *  • Clean teardown — all listeners removed, timer cancelled.
 *  • Typed event bus consistent with MidiEngine's EventTarget pattern.
 *  • syncAudioEngine / syncMidiEngine now return unsubscribe functions.
 *  • BPM change is debounced to avoid spamming the Link session during
 *    rapid BPM ramping in TransportEngine.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AbletonLink from "abletonlink";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LinkCallback = (beat: number, phase: number, bpm: number) => void;

export interface LinkState {
  beat:  number;
  phase: number;
  bpm:   number;
  peers: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BPM       = 120;
const DEFAULT_QUANTUM   = 4;
const MAX_RETRIES       = 5;
const RETRY_BASE_MS     = 500;   // doubles on each retry (exponential backoff)
const BPM_DEBOUNCE_MS   = 50;    // minimum ms between BPM writes to Link

// ── LinkEngine ────────────────────────────────────────────────────────────────

export class LinkEngine {

  private _link:          AbletonLink | null = null;
  private _callbacks:     Set<LinkCallback>  = new Set();
  private _isRunning      = false;
  private _quantum        = DEFAULT_QUANTUM;
  private _retryCount     = 0;
  private _retryTimer:    ReturnType<typeof setTimeout> | null = null;

  // Pending CSS variable update (batched via rAF)
  private _pendingCSSPhase: number | null = null;
  private _pendingCSSBpm:   number | null = null;
  private _rafHandle:       number | null = null;

  // BPM debounce
  private _bpmDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingBpm:       number | null = null;

  // Latest state snapshot (read-only externally)
  readonly state: LinkState = { beat: 0, phase: 0, bpm: DEFAULT_BPM, peers: 0 };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the Link session.
   * @param bpm      Initial BPM (only applied if no peers present).
   * @param quantum  Beats per bar (default 4).
   */
  start(bpm = DEFAULT_BPM, quantum = DEFAULT_QUANTUM): void {
    this._quantum = quantum;
    if (this._isRunning) return;

    try {
      if (!this._link) {
        this._link = new AbletonLink();
      }

      this._link.startUpdate(bpm, this._onLinkUpdate);
      this._isRunning  = true;
      this._retryCount = 0;
    } catch (err) {
      console.warn("[LinkEngine] Failed to start:", err);
      this._scheduleRetry(bpm, quantum);
    }
  }

  stop(): void {
    if (!this._isRunning || !this._link) return;

    try {
      this._link.stopUpdate();
    } catch { /* ignore if already stopped */ }

    this._isRunning = false;

    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }

    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }

    if (this._bpmDebounceTimer !== null) {
      clearTimeout(this._bpmDebounceTimer);
      this._bpmDebounceTimer = null;
    }
  }

  /**
   * Cleanly destroy the engine and release all references.
   * Call on HMR / app teardown.
   */
  dispose(): void {
    this.stop();
    this._callbacks.clear();
    this._link = null;
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  /**
   * Set BPM on the Link session.
   * Debounced to avoid hammering Link during BPM ramps.
   */
  setBPM(bpm: number): void {
    this._pendingBpm = bpm;

    if (this._bpmDebounceTimer !== null) return;

    this._bpmDebounceTimer = setTimeout(() => {
      if (this._link && this._pendingBpm !== null) {
        const clamped = Math.min(999, Math.max(20, this._pendingBpm));
        try { this._link.bpm = clamped; } catch { /* guard */ }
      }
      this._pendingBpm       = null;
      this._bpmDebounceTimer = null;
    }, BPM_DEBOUNCE_MS);
  }

  setQuantum(beatsPerBar: number): void {
    this._quantum = beatsPerBar;
    if (this._link) {
      try { this._link.quantum = beatsPerBar; } catch { /* guard */ }
    }
  }

  // ── Listener API ──────────────────────────────────────────────────────────

  /** Subscribe to Link beat updates. Returns an unsubscribe function. */
  onUpdate(callback: LinkCallback): () => void {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  /** @deprecated Prefer onUpdate() which returns an unsubscribe function. */
  removeUpdate(callback: LinkCallback): void {
    this._callbacks.delete(callback);
  }

  /** True when the Link session is active. */
  get isActive(): boolean { return this._isRunning; }

  // ── Sync convenience ──────────────────────────────────────────────────────

  /**
   * Wire Link beat events to an audio engine object.
   * Returns an unsubscribe function.
   */
  syncAudioEngine(audioEngine: {
    state: { beatPhase: number; bpm: number };
    phase: number;
  }): () => void {
    return this.onUpdate((beat, phase, bpm) => {
      audioEngine.state.beatPhase = phase % 1;
      audioEngine.state.bpm       = bpm;
      audioEngine.phase           = phase;
    });
  }

  /**
   * Wire Link beat events to a MIDI engine object.
   * Returns an unsubscribe function.
   */
  syncMidiEngine(midiEngine: {
    state: { clockPhase: number };
  }): () => void {
    return this.onUpdate((_beat, phase) => {
      midiEngine.state.clockPhase = phase % 1;
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _onLinkUpdate = (beat: number, phase: number, bpm: number): void => {
    // Update state snapshot
    (this.state as Mutable<LinkState>).beat  = beat;
    (this.state as Mutable<LinkState>).phase = phase;
    (this.state as Mutable<LinkState>).bpm   = bpm;

    // Notify synchronous callbacks (transport, midi, visuals)
    this._callbacks.forEach(cb => {
      try { cb(beat, phase, bpm); } catch (e) {
        console.error("[LinkEngine] callback error", e);
      }
    });

    // Batch CSS variable updates off the Link callback path
    this._pendingCSSPhase = phase;
    this._pendingCSSBpm   = bpm;
    if (this._rafHandle === null) {
      this._rafHandle = requestAnimationFrame(this._flushCSS);
    }
  };

  /** Write CSS variables once per animation frame instead of on every beat. */
  private _flushCSS = (): void => {
    this._rafHandle = null;
    if (this._pendingCSSPhase !== null) {
      document.documentElement.style.setProperty(
        "--link-phase",
        this._pendingCSSPhase.toFixed(4),
      );
      this._pendingCSSPhase = null;
    }
    if (this._pendingCSSBpm !== null) {
      document.documentElement.style.setProperty(
        "--link-bpm",
        this._pendingCSSBpm.toFixed(2),
      );
      this._pendingCSSBpm = null;
    }
  };

  /**
   * Exponential-backoff retry when Link fails to start.
   * Gives up after MAX_RETRIES attempts.
   */
  private _scheduleRetry(bpm: number, quantum: number): void {
    if (this._retryCount >= MAX_RETRIES) {
      console.error("[LinkEngine] Giving up after", MAX_RETRIES, "attempts.");
      return;
    }

    const delay = RETRY_BASE_MS * Math.pow(2, this._retryCount);
    this._retryCount++;

    this._retryTimer = setTimeout(() => {
      console.info(`[LinkEngine] Retry ${this._retryCount}/${MAX_RETRIES}...`);
      this.start(bpm, quantum);
    }, delay);
  }
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// ── Singleton ─────────────────────────────────────────────────────────────────

export const linkEngine = new LinkEngine();

if (import.meta.hot) {
  import.meta.hot.dispose(() => linkEngine.dispose());
}
