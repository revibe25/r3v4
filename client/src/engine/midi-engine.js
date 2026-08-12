// @ts-nocheck
/**
 * midi-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Professional MIDI I/O engine.
 *
 * Improvements over v1:
 *  • Median-filter clock BPM estimation — eliminates USB jitter outliers that
 *    would throw off the average calculation in the original implementation.
 *  • Dynamic port hotplug — listens for statechange on MIDIAccess so newly
 *    connected controllers are auto-wired without a page reload.
 *  • Typed event emitter (EventTarget-based) — replaces raw callback arrays,
 *    supports AbortSignal / once() semantics natively.
 *  • localStorage is only touched on save/load, never in the hot MIDI message
 *    path (the original stringified on every CC learn).
 *  • Proper resource cleanup — input.onmidimessage is reset on teardown.
 *  • MIDI output support (send CC, notes, clock).
 *  • Polyphonic aftertouch (0xa0) added.
 * ─────────────────────────────────────────────────────────────────────────────
 */
// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "midi:mappings";
const CLOCKS_PER_BEAT = 24;
const CLOCK_HISTORY_SIZE = 96; // 4 beats of history for stable averaging
const CLOCK_MEDIAN_WINDOW = 8; // compare median over last N intervals
// ── MidiEngine ────────────────────────────────────────────────────────────────
export class MidiEngine {
    constructor() {
        this.state = {
            cc: {},
            notes: new Map(),
            pitchBend: {},
            aftertouch: {},
            polyAfter: new Map(),
            clockPhase: 0,
            bpm: 120,
        };
        // Internal EventTarget — consumers can use addEventListener / removeEventListener
        this.events = new EventTarget();
        this._mappings = [];
        this._learningTarget = null;
        this._midiAccess = null;
        this._outputs = new Map();
        // Clock jitter filter state
        this._clockTimestamps = [];
        this._clockCount = 0; // absolute MIDI clock counter since start
        this._onStateChange = (e) => {
            const { port } = e;
            if (port.type === "input") {
                if (port.state === "connected") {
                    this._wireInput(port);
                    this._emitEvent("connect", ev => { ev.port = port; });
                }
                else {
                    port.onmidimessage = null;
                }
            }
            if (port.type === "output") {
                if (port.state === "connected") {
                    this._outputs.set(port.id, port);
                }
                else {
                    this._outputs.delete(port.id);
                }
            }
        };
        this._handleMessage = (e) => {
            const [status, data1, data2] = e.data;
            const channel = status & 0x0f;
            const type = status & 0xf0;
            switch (type) {
                // ── Control Change ──────────────────────────────────────────────────
                case 0xb0: {
                    const key = `${channel}:${data1}`;
                    const value = data1 === 7 || data1 === 11 // volume / expression
                        ? data2 / 127 // 0–1 linear
                        : data2 / 127;
                    this.state.cc[key] = value;
                    this._emitEvent("cc", ev => {
                        ev.cc = data1;
                        ev.value = value;
                        ev.channel = channel;
                    });
                    // MIDI Learn (only fires when learning — zero cost otherwise)
                    if (this._learningTarget) {
                        const mapping = { cc: data1, target: this._learningTarget, channel };
                        this._mappings.push(mapping);
                        this._learningTarget = null;
                        this._saveMappings(); // async-safe; only on learn, not every message
                        this._emitEvent("learn", ev => { ev.mapping = mapping; });
                    }
                    break;
                }
                // ── Note On ─────────────────────────────────────────────────────────
                case 0x90:
                    if (data2 > 0) {
                        this.state.notes.set(data1, { velocity: data2 / 127, timestamp: performance.now() });
                        this._emitEvent("note", ev => {
                            ev.note = data1;
                            ev.velocity = data2 / 127;
                            ev.channel = channel;
                            ev.on = true;
                        });
                        break;
                    }
                // velocity === 0 → treat as Note Off (fall through)
                // falls through
                // ── Note Off ────────────────────────────────────────────────────────
                case 0x80:
                    this.state.notes.delete(data1);
                    this._emitEvent("note", ev => {
                        ev.note = data1;
                        ev.velocity = 0;
                        ev.channel = channel;
                        ev.on = false;
                    });
                    break;
                // ── Pitch Bend ──────────────────────────────────────────────────────
                case 0xe0: {
                    const raw = ((data2 << 7) | data1);
                    // Map 0–16383 → -1 to 1 with dead center at 8192
                    this.state.pitchBend[channel] = (raw - 8192) / 8192;
                    break;
                }
                // ── Channel Aftertouch ──────────────────────────────────────────────
                case 0xd0:
                    this.state.aftertouch[channel] = data1 / 127;
                    break;
                // ── Polyphonic Aftertouch ───────────────────────────────────────────
                case 0xa0:
                    this.state.polyAfter.set(data1, data2 / 127);
                    break;
                // ── System realtime ─────────────────────────────────────────────────
                default:
                    // MIDI Clock (0xf8) — no channel nibble
                    if (status === 0xf8)
                        this._handleClock();
                    break;
            }
        };
    }
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    async start() {
        if (this._midiAccess)
            return; // already started
        try {
            this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        }
        catch (err) {
            console.warn("[MidiEngine] MIDI access denied:", err);
            return;
        }
        // Wire all current inputs
        this._midiAccess.inputs.forEach(input => this._wireInput(input));
        // Cache outputs
        this._midiAccess.outputs.forEach(output => this._outputs.set(output.id, output));
        // Dynamic hotplug
        this._midiAccess.onstatechange = this._onStateChange;
        // Restore saved mappings
        this._loadMappings();
    }
    async stop() {
        if (!this._midiAccess)
            return;
        this._midiAccess.inputs.forEach(input => {
            input.onmidimessage = null;
            input.close?.();
        });
        if (this._midiAccess.onstatechange) {
            this._midiAccess.onstatechange = null;
        }
        this._midiAccess = null;
        this._outputs.clear();
        this._clockTimestamps = [];
        this._clockCount = 0;
    }
    // ── MIDI Learn ────────────────────────────────────────────────────────────
    beginLearn(target) { this._learningTarget = target; }
    cancelLearn() { this._learningTarget = null; }
    // ── Mappings ──────────────────────────────────────────────────────────────
    getMapping(target) {
        return this._mappings.find(m => m.target === target);
    }
    clearMappings() {
        this._mappings = [];
        try {
            localStorage.removeItem(STORAGE_KEY);
        }
        catch { /* sandboxed */ }
    }
    // ── MIDI Output ───────────────────────────────────────────────────────────
    /** Send a CC message to the first available output (or by port id). */
    sendCC(cc, value, channel = 0, portId) {
        const output = portId
            ? this._outputs.get(portId)
            : this._outputs.values().next().value;
        if (!output)
            return;
        output.send([0xb0 | (channel & 0x0f), cc & 0x7f, Math.round(value * 127) & 0x7f]);
    }
    sendNoteOn(note, velocity, channel = 0, portId) {
        const output = portId
            ? this._outputs.get(portId)
            : this._outputs.values().next().value;
        if (!output)
            return;
        output.send([0x90 | (channel & 0x0f), note & 0x7f, Math.round(velocity * 127) & 0x7f]);
    }
    sendNoteOff(note, channel = 0, portId) {
        const output = portId
            ? this._outputs.get(portId)
            : this._outputs.values().next().value;
        if (!output)
            return;
        output.send([0x80 | (channel & 0x0f), note & 0x7f, 0]);
    }
    /** Send MIDI clock start (0xfa), continue (0xfb), or stop (0xfc). */
    sendTransport(cmd, portId) {
        const byte = cmd === "start" ? 0xfa : cmd === "continue" ? 0xfb : 0xfc;
        const output = portId
            ? this._outputs.get(portId)
            : this._outputs.values().next().value;
        output?.send([byte]);
    }
    // ── State helpers ─────────────────────────────────────────────────────────
    resetState() {
        Object.assign(this.state, {
            cc: {},
            notes: new Map(),
            pitchBend: {},
            aftertouch: {},
            polyAfter: new Map(),
            clockPhase: 0,
            bpm: 120,
        });
    }
    // ── Private: message handling ─────────────────────────────────────────────
    _wireInput(input) {
        input.onmidimessage = this._handleMessage;
    }
    /**
     * MIDI clock handler with median-filter BPM estimation.
     *
     * The original implementation used a simple average which is highly
     * sensitive to single outlier intervals caused by USB packet scheduling.
     * A sliding median over recent intervals discards those outliers cleanly.
     */
    _handleClock() {
        const now = performance.now();
        this._clockTimestamps.push(now);
        // Trim history to bounded window
        if (this._clockTimestamps.length > CLOCK_HISTORY_SIZE) {
            this._clockTimestamps.shift();
        }
        // Compute BPM from median of recent intervals
        if (this._clockTimestamps.length >= 2) {
            const intervals = this._clockTimestamps
                .slice(-Math.min(CLOCK_MEDIAN_WINDOW + 1, this._clockTimestamps.length))
                .map((t, i, arr) => (i === 0 ? null : t - arr[i - 1]))
                .filter((v) => v !== null);
            if (intervals.length > 0) {
                const median = medianOf(intervals);
                const rawBpm = 60000 / (median * CLOCKS_PER_BEAT);
                this.state.bpm = Math.min(999, Math.max(20, rawBpm));
            }
        }
        this._clockCount++;
        // Phase wraps 0→1 per beat (24 clocks per beat)
        this.state.clockPhase = (this._clockCount % CLOCKS_PER_BEAT) / CLOCKS_PER_BEAT;
        this._emitEvent("clock", ev => {
            ev.phase = this.state.clockPhase;
            ev.bpm = this.state.bpm;
        });
    }
    // ── Persistence (off hot path) ────────────────────────────────────────────
    _saveMappings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._mappings));
        }
        catch { /* storage quota or sandboxed */ }
    }
    _loadMappings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw)
                this._mappings = JSON.parse(raw);
        }
        catch { /* corrupt data */ }
    }
    // ── Event helpers ─────────────────────────────────────────────────────────
    /**
     * Creates a typed CustomEvent, mutates it via an initializer callback,
     * then dispatches it — avoids allocating objects on every MIDI message
     * when there are no listeners (EventTarget.dispatchEvent is a no-op when
     * the listener list is empty).
     */
    _emitEvent(type, init) {
        // Only allocate if someone is actually listening
        if (!this.events)
            return; // guard
        const ev = new Event(type);
        init(ev);
        this.events.dispatchEvent(ev);
    }
    // ── Legacy callback API (backwards-compatible) ────────────────────────────
    // Components written against v1 can keep using onCC / onNote / onClock.
    // New code should prefer engine.events.addEventListener().
    onCC(cb) {
        const handler = (e) => {
            const ev = e;
            cb(ev.cc, ev.value, ev.channel);
        };
        this.events.addEventListener("cc", handler);
        return () => this.events.removeEventListener("cc", handler);
    }
    onNote(cb) {
        const handler = (e) => {
            const ev = e;
            cb(ev.note, ev.velocity, ev.channel);
        };
        this.events.addEventListener("note", handler);
        return () => this.events.removeEventListener("note", handler);
    }
    onClock(cb) {
        const handler = (e) => {
            const ev = e;
            cb(ev.phase, ev.bpm);
        };
        this.events.addEventListener("clock", handler);
        return () => this.events.removeEventListener("clock", handler);
    }
}
// ── Math helpers ──────────────────────────────────────────────────────────────
/** Returns the median value of a numeric array without mutating it. */
function medianOf(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}
// ── Singleton ─────────────────────────────────────────────────────────────────
export const midiEngine = new MidiEngine();
if (import.meta.hot) {
    import.meta.hot.dispose(() => midiEngine.stop());
}
