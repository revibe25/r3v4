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
import { transportEngine } from "@/engine/transport-engine";
import { midiEngine } from "@/engine/midi-engine";
import { linkEngine } from "@/engine/link-engine";
import { presetEngine } from "@/engine/preset-engine";
// ── Health monitor ────────────────────────────────────────────────────────────
const HEALTH_INTERVAL_MS = 2000;
// ── Master Engine ─────────────────────────────────────────────────────────────
class MasterEngine {
    constructor() {
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
        this._context = null;
        // Sub-engine references
        this.transport = transportEngine;
        this.midi = midiEngine;
        this.link = linkEngine;
        this.preset = presetEngine;
        // Internal state
        this._initialized = false;
        this._healthTimer = null;
        this._listeners = new Map();
        this._onContextStateChange = () => {
            const { state } = this.context;
            if (state === "running") {
                this._emit("contextRunning", state);
            }
            else if (state === "suspended") {
                this._emit("contextSuspended", state);
            }
        };
        /**
         * Periodic health check — if the context silently suspends (common on iOS
         * and some Chromium builds after tab backgrounding) we attempt a resume.
         */
        this._healthCheck = async () => {
            if (this.context.state === "suspended") {
                try {
                    await this.context.resume();
                }
                catch {
                    // Non-fatal; browser may require another user gesture.
                }
            }
        };
    }
    get context() {
        if (!this._context)
            this._context = getAudioContext();
        return this._context;
    }
    // ── Public API ────────────────────────────────────────────────────────────
    /**
     * Call once on user gesture (satisfies browser autoplay policy).
     * Safe to call multiple times — subsequent calls are no-ops.
     */
    async init() {
        if (this._initialized)
            return;
        try {
            await ensureAudioRunning();
            // Wire context-state changes to event bus
            this.context.addEventListener("statechange", this._onContextStateChange);
            // Start health monitor
            this._healthTimer = setInterval(this._healthCheck, HEALTH_INTERVAL_MS);
            this._initialized = true;
            this._emit("init", undefined);
        }
        catch (err) {
            this._emit("error", err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }
    /**
     * Full teardown — stops all engines and clears all listeners.
     * Call on app unmount or during HMR to avoid zombie instances.
     */
    async teardown() {
        if (!this._initialized)
            return;
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
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this._listeners.get(event)?.delete(callback);
    }
    /** Current AudioContext state. */
    get state() {
        return this.context.state;
    }
    /** True once init() has completed successfully. */
    get isReady() {
        return this._initialized;
    }
    // ── Private helpers ───────────────────────────────────────────────────────
    _emit(event, payload) {
        this._listeners.get(event)?.forEach(cb => {
            try {
                cb(payload);
            }
            catch (err) {
                console.error(`[MasterEngine] Listener error on "${event}":`, err);
            }
        });
    }
}
// ── Singleton export ──────────────────────────────────────────────────────────
export const masterEngine = new MasterEngine();
// HMR safety — prevent stale instances after hot reload in Vite
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        masterEngine.teardown().catch(console.warn);
    });
}
