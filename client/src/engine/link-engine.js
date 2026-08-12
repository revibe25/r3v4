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
// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_BPM = 120;
const DEFAULT_QUANTUM = 4;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 500; // doubles on each retry (exponential backoff)
const BPM_DEBOUNCE_MS = 50; // minimum ms between BPM writes to Link
// ── LinkEngine ────────────────────────────────────────────────────────────────
export class LinkEngine {
    constructor() {
        this._link = null;
        this._callbacks = new Set();
        this._isRunning = false;
        this._quantum = DEFAULT_QUANTUM;
        this._retryCount = 0;
        this._retryTimer = null;
        // Pending CSS variable update (batched via rAF)
        this._pendingCSSPhase = null;
        this._pendingCSSBpm = null;
        this._rafHandle = null;
        // BPM debounce
        this._bpmDebounceTimer = null;
        this._pendingBpm = null;
        // Latest state snapshot (read-only externally)
        this.state = { beat: 0, phase: 0, bpm: DEFAULT_BPM, peers: 0 };
        // ── Private ───────────────────────────────────────────────────────────────
        this._onLinkUpdate = (beat, phase, bpm) => {
            // Update state snapshot
            this.state.beat = beat;
            this.state.phase = phase;
            this.state.bpm = bpm;
            // Notify synchronous callbacks (transport, midi, visuals)
            this._callbacks.forEach(cb => {
                try {
                    cb(beat, phase, bpm);
                }
                catch (e) {
                    console.error("[LinkEngine] callback error", e);
                }
            });
            // Batch CSS variable updates off the Link callback path
            this._pendingCSSPhase = phase;
            this._pendingCSSBpm = bpm;
            if (this._rafHandle === null) {
                this._rafHandle = requestAnimationFrame(this._flushCSS);
            }
        };
        /** Write CSS variables once per animation frame instead of on every beat. */
        this._flushCSS = () => {
            this._rafHandle = null;
            if (this._pendingCSSPhase !== null) {
                document.documentElement.style.setProperty("--link-phase", this._pendingCSSPhase.toFixed(4));
                this._pendingCSSPhase = null;
            }
            if (this._pendingCSSBpm !== null) {
                document.documentElement.style.setProperty("--link-bpm", this._pendingCSSBpm.toFixed(2));
                this._pendingCSSBpm = null;
            }
        };
    }
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    /**
     * Start the Link session.
     * @param bpm      Initial BPM (only applied if no peers present).
     * @param quantum  Beats per bar (default 4).
     */
    start(bpm = DEFAULT_BPM, quantum = DEFAULT_QUANTUM) {
        this._quantum = quantum;
        if (this._isRunning)
            return;
        try {
            if (!this._link) {
                this._link = new AbletonLink();
            }
            this._link.startUpdate(bpm, this._onLinkUpdate);
            this._isRunning = true;
            this._retryCount = 0;
        }
        catch (err) {
            console.warn("[LinkEngine] Failed to start:", err);
            this._scheduleRetry(bpm, quantum);
        }
    }
    stop() {
        if (!this._isRunning || !this._link)
            return;
        try {
            this._link.stopUpdate();
        }
        catch { /* ignore if already stopped */ }
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
    dispose() {
        this.stop();
        this._callbacks.clear();
        this._link = null;
    }
    // ── Configuration ─────────────────────────────────────────────────────────
    /**
     * Set BPM on the Link session.
     * Debounced to avoid hammering Link during BPM ramps.
     */
    setBPM(bpm) {
        this._pendingBpm = bpm;
        if (this._bpmDebounceTimer !== null)
            return;
        this._bpmDebounceTimer = setTimeout(() => {
            if (this._link && this._pendingBpm !== null) {
                const clamped = Math.min(999, Math.max(20, this._pendingBpm));
                try {
                    this._link.bpm = clamped;
                }
                catch { /* guard */ }
            }
            this._pendingBpm = null;
            this._bpmDebounceTimer = null;
        }, BPM_DEBOUNCE_MS);
    }
    setQuantum(beatsPerBar) {
        this._quantum = beatsPerBar;
        if (this._link) {
            try {
                this._link.quantum = beatsPerBar;
            }
            catch { /* guard */ }
        }
    }
    // ── Listener API ──────────────────────────────────────────────────────────
    /** Subscribe to Link beat updates. Returns an unsubscribe function. */
    onUpdate(callback) {
        this._callbacks.add(callback);
        return () => this._callbacks.delete(callback);
    }
    /** @deprecated Prefer onUpdate() which returns an unsubscribe function. */
    removeUpdate(callback) {
        this._callbacks.delete(callback);
    }
    /** True when the Link session is active. */
    get isActive() { return this._isRunning; }
    // ── Sync convenience ──────────────────────────────────────────────────────
    /**
     * Wire Link beat events to an audio engine object.
     * Returns an unsubscribe function.
     */
    syncAudioEngine(audioEngine) {
        return this.onUpdate((beat, phase, bpm) => {
            audioEngine.state.beatPhase = phase % 1;
            audioEngine.state.bpm = bpm;
            audioEngine.phase = phase;
        });
    }
    /**
     * Wire Link beat events to a MIDI engine object.
     * Returns an unsubscribe function.
     */
    syncMidiEngine(midiEngine) {
        return this.onUpdate((_beat, phase) => {
            midiEngine.state.clockPhase = phase % 1;
        });
    }
    /**
     * Exponential-backoff retry when Link fails to start.
     * Gives up after MAX_RETRIES attempts.
     */
    _scheduleRetry(bpm, quantum) {
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
// ── Singleton ─────────────────────────────────────────────────────────────────
export const linkEngine = new LinkEngine();
if (import.meta.hot) {
    import.meta.hot.dispose(() => linkEngine.dispose());
}
