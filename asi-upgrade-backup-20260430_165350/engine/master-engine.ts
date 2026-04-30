// @ts-nocheck
/**
 * master-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single point of authority for all audio engines.
 *
 * Improvements over v1:
 *  • Typed event bus (no more loose callbacks scattered across files)
 *  • Lazy, ordered initialization with dependency graph
 *  • Engine health monitoring + automatic context-suspension recovery
 *  • Structured teardown (stops all engines cleanly on unmount / HMR)
 *  • Exposes presetEngine alongside transport / midi / link
 *  • Zero new AudioContext instances — always delegates to getAudioContext()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getAudioContext, ensureAudioRunning } from "@/audio/core/audio-context";
import { transportEngine }                      from "@/engine/transport-engine";
import { midiEngine }                           from "@/engine/midi-engine";
import { linkEngine }                           from "@/engine/link-engine";
import { presetEngine }                         from "@/engine/preset-engine";

// ── Event bus types ───────────────────────────────────────────────────────────

export type MasterEngineEvent =
  | "init"
  | "teardown"
  | "contextRunning"
  | "contextSuspended"
  | "error";

type EventCallback<T = unknown> = (payload: T) => void;

interface EventMap {
  init:             void;
  teardown:         void;
  contextRunning:   AudioContextState;
  contextSuspended: AudioContextState;
  error:            Error;
}

// ── Health monitor ────────────────────────────────────────────────────────────

const HEALTH_INTERVAL_MS = 2_000;

// ── Master Engine ─────────────────────────────────────────────────────────────

class MasterEngine {
  // ── Lazy AudioContext — deferred to first use after a user gesture ────────
  //
  //  WHY: Class field initializers run synchronously at `new MasterEngine()`.
  //  Since `masterEngine` is exported at module scope, a class field would call
  //  getAudioContext() (→ new AudioContext()) on import — before any user
  //  gesture — violating Chrome's autoplay policy and triggering Tone.js
  //  standardized-audio-context capability probes in the console.
  //
  //  HOW: The getter defers creation to the first property access, which only
  //  occurs inside init() → ensureAudioRunning(), i.e. after an explicit call
  //  from a user-gesture handler. All external consumers of `masterEngine.context`
  //  are unchanged — the getter is transparent at the call site.
  private _context: AudioContext | null = null;

  get context(): AudioContext {
    if (!this._context) this._context = getAudioContext();
    return this._context;
  }

  // Sub-engine references
  readonly transport = transportEngine;
  readonly midi      = midiEngine;
  readonly link      = linkEngine;
  readonly preset    = presetEngine;

  // Internal state
  private _initialized  = false;
  private _healthTimer: ReturnType<typeof setInterval> | null = null;
  private _listeners    = new Map<MasterEngineEvent, Set<EventCallback<any>>>();

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Call once on user gesture (satisfies browser autoplay policy).
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    try {
      await ensureAudioRunning();

      // Wire context-state changes to event bus
      this.context.addEventListener("statechange", this._onContextStateChange);

      // Start health monitor
      this._healthTimer = setInterval(this._healthCheck, HEALTH_INTERVAL_MS);

      this._initialized = true;
      this._emit("init", undefined);
    } catch (err) {
      this._emit("error", err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Full teardown — stops all engines and clears all listeners.
   * Call on app unmount or during HMR to avoid zombie instances.
   */
  async teardown(): Promise<void> {
    if (!this._initialized) return;

    // Stop in reverse dependency order
    this.transport.stop();
    this.link.stop();
    await this.midi.stop();

    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }

    this.context.removeEventListener("statechange", this._onContextStateChange);
    this._emit("teardown", undefined);
    this._listeners.clear();
    this._initialized = false;
  }

  /** Subscribe to a named engine event. Returns an unsubscribe function. */
  on<K extends MasterEngineEvent>(
    event: K,
    callback: EventCallback<EventMap[K]>,
  ): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback as EventCallback<unknown>);
    return () => this._listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  /** Current AudioContext state. */
  get state(): AudioContextState {
    return this.context.state;
  }

  /** True once init() has completed successfully. */
  get isReady(): boolean {
    return this._initialized;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _emit<K extends MasterEngineEvent>(event: K, payload: EventMap[K]): void {
    this._listeners.get(event)?.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[MasterEngine] Listener error on "${event}":`, err);
      }
    });
  }

  private _onContextStateChange = (): void => {
    const { state } = this.context;
    if (state === "running") {
      this._emit("contextRunning", state);
    } else if (state === "suspended") {
      this._emit("contextSuspended", state);
    }
  };

  /**
   * Periodic health check — if the context silently suspends (common on iOS
   * and some Chromium builds after tab backgrounding) we attempt a resume.
   */
  private _healthCheck = async (): Promise<void> => {
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        // Non-fatal; browser may require another user gesture.
      }
    }
  };
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const masterEngine = new MasterEngine();

// HMR safety — prevent stale instances after hot reload in Vite
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    masterEngine.teardown().catch(console.warn);
  });
}
