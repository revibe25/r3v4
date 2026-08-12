// @ts-nocheck
/**
 * transport-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sample-accurate transport using the Web Audio clock.
 *
 * Critical upgrade over v1:
 *  • Replaces requestAnimationFrame with AudioContext.currentTime scheduling.
 *    The Web Audio clock runs at sample rate (~44 100 Hz) vs rAF's ~60 Hz,
 *    eliminating all transport jitter and drift.
 *  • Dual-phase lookahead scheduler:
 *      – scheduleAheadTime (default 100 ms) — how far ahead we pre-schedule
 *      – schedulerInterval (default 25 ms)  — how often the scheduler runs
 *    This mirrors the canonical Web Audio scheduling pattern (C. Wilson 2013).
 *  • Exponential BPM ramp via AudioParam-style math for click-free changes.
 *  • Tape-style loop: loop-end wraps beat position without resetting phase.
 *  • Emits tick events with the *scheduled* AudioContext time so downstream
 *    nodes (clips, MIDI, Link) can schedule ahead accurately.
 *  • Full cleanup / teardown support.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { getAudioContext } from "@/audio/core/audio-context";
import { beatDetector } from "@/audio/core/beat-detector";
import { midiEngine } from "./midi-engine";
import { linkEngine } from "./link-engine";
// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_BPM = 120;
const SCHEDULE_AHEAD_TIME = 0.1; // seconds — schedule this far ahead
const SCHEDULER_INTERVAL_MS = 25; // ms     — how often scheduler fires
const BPM_RAMP_TIME = 0.05; // seconds — exponential BPM ramp window
const BEATS_PER_BAR_DEFAULT = 4;
// ── TransportEngine ───────────────────────────────────────────────────────────
export class TransportEngine {
    constructor() {
        // Public state snapshot (read-only from outside; mutate via methods)
        this.state = {
            playing: false,
            bpm: DEFAULT_BPM,
            beat: 0,
            bar: 1,
            phase: 0,
            loopStart: 0,
            loopEnd: BEATS_PER_BAR_DEFAULT,
            loopEnabled: false,
            timeSignatureNumerator: 4,
            timeSignatureDenominator: 4,
        };
        // ── Private scheduler state ───────────────────────────────────────────────
        /** AudioContext.currentTime of the last scheduled beat boundary */
        this._nextBeatTime = 0;
        /** Fractional beat position corresponding to _nextBeatTime */
        this._nextBeat = 0;
        /** setTimeout handle */
        this._schedulerTimer = null;
        /** Target BPM for smooth ramp */
        this._targetBpm = DEFAULT_BPM;
        /** Listeners */
        this._stateCallbacks = new Set();
        this._tickCallbacks = new Set();
        // ── Internal scheduler ────────────────────────────────────────────────────
        /**
         * Core lookahead scheduler.
         * Runs every SCHEDULER_INTERVAL_MS ms and pre-schedules all beat events
         * that fall within the next SCHEDULE_AHEAD_TIME seconds.
         */
        this._schedule = () => {
            if (!this.state.playing)
                return;
            const ctx = getAudioContext();
            const deadline = ctx.currentTime + SCHEDULE_AHEAD_TIME;
            // Apply smooth BPM ramp
            if (this.state.bpm !== this._targetBpm) {
                const newBpm = exponentialApproach(this.state.bpm, this._targetBpm, SCHEDULER_INTERVAL_MS / 1000, BPM_RAMP_TIME);
                this.state.bpm = newBpm;
            }
            // Schedule all beats that fit in the lookahead window
            while (this._nextBeatTime < deadline) {
                this._scheduleBeat(this._nextBeat, this._nextBeatTime);
                const beatDuration = 60 / this.state.bpm;
                this._nextBeatTime += beatDuration;
                this._nextBeat += 1;
                // Loop wrap — preserve exact timing
                if (this.state.loopEnabled &&
                    this._nextBeat >= this.state.loopEnd) {
                    const overshoot = this._nextBeat - this.state.loopEnd;
                    this._nextBeat = this.state.loopStart + overshoot;
                }
            }
            // Sync live state to the most recently scheduled beat for UI display
            const s = this.state;
            const now = ctx.currentTime;
            if (this._nextBeatTime > now) {
                const elapsed = (SCHEDULE_AHEAD_TIME - (this._nextBeatTime - now)) /
                    (60 / this.state.bpm);
                s.phase = Math.max(0, Math.min(1, elapsed));
            }
            s.beat = Math.floor(this._nextBeat);
            this._updateBar();
            this._syncExternalEngines();
            this._notifyState();
            // Re-arm
            this._schedulerTimer = setTimeout(this._schedule, SCHEDULER_INTERVAL_MS);
        };
    }
    // ── Public control API ────────────────────────────────────────────────────
    play() {
        if (this.state.playing)
            return;
        const ctx = getAudioContext();
        this.state.playing = true;
        // Align next beat to *just* ahead of now so first tick fires cleanly
        this._nextBeatTime = ctx.currentTime + 0.01;
        this._nextBeat = this.state.beat;
        this._schedule();
        this._notifyState();
    }
    stop() {
        if (!this.state.playing)
            return;
        this.state.playing = false;
        if (this._schedulerTimer !== null) {
            clearTimeout(this._schedulerTimer);
            this._schedulerTimer = null;
        }
        this._resetPosition();
        this._notifyState();
    }
    pause() {
        if (!this.state.playing)
            return;
        this.state.playing = false;
        if (this._schedulerTimer !== null) {
            clearTimeout(this._schedulerTimer);
            this._schedulerTimer = null;
        }
        this._notifyState();
    }
    toggle() {
        this.state.playing ? this.stop() : this.play();
    }
    /** Seek to an absolute beat position (safe during playback). */
    seekToBeat(beat) {
        const ctx = getAudioContext();
        this._nextBeat = beat;
        this._nextBeatTime = ctx.currentTime + 0.01;
        this.state.beat = beat;
        this.state.phase = 0;
        this._updateBar();
        this._notifyState();
    }
    /**
     * Change BPM.
     * @param bpm    Target BPM (clamped 20–300).
     * @param smooth When true (default) applies a short exponential ramp to
     *               prevent clicks. When false takes effect immediately.
     */
    setBPM(bpm, smooth = true) {
        const clamped = Math.max(20, Math.min(300, bpm));
        this._targetBpm = clamped;
        if (!smooth) {
            this.state.bpm = clamped;
        }
        // Smooth ramp is handled inside _schedule() on the next scheduler tick.
    }
    setLoop(start, end, enabled = true) {
        const s = this.state;
        s.loopStart = start;
        s.loopEnd = end;
        s.loopEnabled = enabled;
    }
    setTimeSignature(numerator, denominator) {
        const s = this.state;
        s.timeSignatureNumerator = numerator;
        s.timeSignatureDenominator = denominator;
    }
    // ── Listener registration ─────────────────────────────────────────────────
    /** Called on every UI-rate state update (~60 fps equivalent). */
    onUpdate(cb) {
        this._stateCallbacks.add(cb);
        return () => this._stateCallbacks.delete(cb);
    }
    /** Called once per scheduled beat, with the precise AudioContext timestamp. */
    onTick(cb) {
        this._tickCallbacks.add(cb);
        return () => this._tickCallbacks.delete(cb);
    }
    /** @deprecated Prefer onUpdate() which returns an unsubscribe fn. */
    removeListener(cb) {
        this._stateCallbacks.delete(cb);
    }
    /** Emit a single scheduled beat event. */
    _scheduleBeat(beat, audioTime) {
        const tick = {
            beat,
            bar: Math.floor(beat / this.state.timeSignatureNumerator) + 1,
            phase: beat % 1,
            bpm: this.state.bpm,
            audioTime,
        };
        this._tickCallbacks.forEach(cb => {
            try {
                cb(tick);
            }
            catch (e) {
                console.error("[TransportEngine] tick cb error", e);
            }
        });
    }
    _resetPosition() {
        const s = this.state;
        s.beat = 0;
        s.bar = 1;
        s.phase = 0;
        this._nextBeat = 0;
        this._nextBeatTime = 0;
    }
    _updateBar() {
        const beatsPerBar = this.state.timeSignatureNumerator;
        this.state.bar =
            Math.floor(this.state.beat / beatsPerBar) + 1;
    }
    _syncExternalEngines() {
        // Beat detector (visual sync)
        beatDetector.state.beatPhase = this.state.phase;
        beatDetector.state.bpm = this.state.bpm;
        // Ableton Link
        if (linkEngine.isActive) {
            linkEngine.setQuantum(this.state.timeSignatureNumerator);
            linkEngine.setBPM(this.state.bpm);
        }
        // MIDI clock phase
        midiEngine.state.clockPhase = this.state.phase;
    }
    _notifyState() {
        this._stateCallbacks.forEach(cb => {
            try {
                cb(this.state);
            }
            catch (e) {
                console.error("[TransportEngine] state cb error", e);
            }
        });
    }
    /** Cleanly dispose the engine (call on HMR / unmount). */
    dispose() {
        if (this._schedulerTimer !== null) {
            clearTimeout(this._schedulerTimer);
            this._schedulerTimer = null;
        }
        this._stateCallbacks.clear();
        this._tickCallbacks.clear();
    }
}
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Exponential approach — smoothly moves `current` toward `target`.
 * Replaces the original sin-based lerp which caused overshoot.
 * @param current  Current value
 * @param target   Target value
 * @param dt       Delta time in seconds
 * @param tau      Time constant (63% of the way in `tau` seconds)
 */
function exponentialApproach(current, target, dt, tau) {
    return target + (current - target) * Math.exp(-dt / tau);
}
/** @deprecated Use exponentialApproach. Kept for API compatibility. */
export function bpmLerp(from, to, phase) {
    return from + (to - from) * Math.sin(Math.PI * phase);
}
// ── Singleton ─────────────────────────────────────────────────────────────────
export const transportEngine = new TransportEngine();
if (import.meta.hot) {
    import.meta.hot.dispose(() => transportEngine.dispose());
}
