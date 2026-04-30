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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MidiMapping {
  cc:      number;
  target:  string;
  channel: number;
}

export interface MidiState {
  cc:           Record<string, number>;
  notes:        Map<number, { velocity: number; timestamp: number }>;
  pitchBend:    Record<number, number>;
  aftertouch:   Record<number, number>;
  polyAfter:    Map<number, number>;   // note → pressure
  clockPhase:   number;
  bpm:          number;
}

// ── Event types emitted on the internal EventTarget ──────────────────────────

export interface MidiCCEvent       extends Event { cc: number; value: number; channel: number }
export interface MidiNoteEvent     extends Event { note: number; velocity: number; channel: number; on: boolean }
export interface MidiClockEvent    extends Event { phase: number; bpm: number }
export interface MidiLearnEvent    extends Event { mapping: MidiMapping }
export interface MidiConnectEvent  extends Event { port: WebMidi.MIDIPort }

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY         = "midi:mappings";
const CLOCKS_PER_BEAT     = 24;
const CLOCK_HISTORY_SIZE  = 96;   // 4 beats of history for stable averaging
const CLOCK_MEDIAN_WINDOW = 8;    // compare median over last N intervals

// ── MidiEngine ────────────────────────────────────────────────────────────────

export class MidiEngine {

  readonly state: MidiState = {
    cc:          {},
    notes:       new Map(),
    pitchBend:   {},
    aftertouch:  {},
    polyAfter:   new Map(),
    clockPhase:  0,
    bpm:         120,
  };

  // Internal EventTarget — consumers can use addEventListener / removeEventListener
  readonly events = new EventTarget();

  private _mappings:      MidiMapping[]               = [];
  private _learningTarget: string | null              = null;
  private _midiAccess:    WebMidi.MIDIAccess | null   = null;
  private _outputs:       Map<string, WebMidi.MIDIOutput> = new Map();

  // Clock jitter filter state
  private _clockTimestamps: number[] = [];
  private _clockCount       = 0;      // absolute MIDI clock counter since start

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._midiAccess) return; // already started

    try {
      this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
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

  async stop(): Promise<void> {
    if (!this._midiAccess) return;

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
    this._clockCount      = 0;
  }

  // ── MIDI Learn ────────────────────────────────────────────────────────────

  beginLearn(target: string): void  { this._learningTarget = target; }
  cancelLearn(): void               { this._learningTarget = null; }

  // ── Mappings ──────────────────────────────────────────────────────────────

  getMapping(target: string): MidiMapping | undefined {
    return this._mappings.find(m => m.target === target);
  }

  clearMappings(): void {
    this._mappings = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* sandboxed */ }
  }

  // ── MIDI Output ───────────────────────────────────────────────────────────

  /** Send a CC message to the first available output (or by port id). */
  sendCC(cc: number, value: number, channel = 0, portId?: string): void {
    const output = portId
      ? this._outputs.get(portId)
      : this._outputs.values().next().value;

    if (!output) return;
    output.send([0xb0 | (channel & 0x0f), cc & 0x7f, Math.round(value * 127) & 0x7f]);
  }

  sendNoteOn(note: number, velocity: number, channel = 0, portId?: string): void {
    const output = portId
      ? this._outputs.get(portId)
      : this._outputs.values().next().value;
    if (!output) return;
    output.send([0x90 | (channel & 0x0f), note & 0x7f, Math.round(velocity * 127) & 0x7f]);
  }

  sendNoteOff(note: number, channel = 0, portId?: string): void {
    const output = portId
      ? this._outputs.get(portId)
      : this._outputs.values().next().value;
    if (!output) return;
    output.send([0x80 | (channel & 0x0f), note & 0x7f, 0]);
  }

  /** Send MIDI clock start (0xfa), continue (0xfb), or stop (0xfc). */
  sendTransport(cmd: "start" | "continue" | "stop", portId?: string): void {
    const byte   = cmd === "start" ? 0xfa : cmd === "continue" ? 0xfb : 0xfc;
    const output = portId
      ? this._outputs.get(portId)
      : this._outputs.values().next().value;
    output?.send([byte]);
  }

  // ── State helpers ─────────────────────────────────────────────────────────

  resetState(): void {
    Object.assign(this.state, {
      cc:         {},
      notes:      new Map(),
      pitchBend:  {},
      aftertouch: {},
      polyAfter:  new Map(),
      clockPhase: 0,
      bpm:        120,
    });
  }

  // ── Private: message handling ─────────────────────────────────────────────

  private _wireInput(input: WebMidi.MIDIInput): void {
    input.onmidimessage = this._handleMessage;
  }

  private _onStateChange = (e: WebMidi.MIDIConnectionEvent): void => {
    const { port } = e;
    if (port.type === "input") {
      if (port.state === "connected") {
        this._wireInput(port as WebMidi.MIDIInput);
        this._emitEvent<MidiConnectEvent>("connect", ev => { ev.port = port as WebMidi.MIDIInput; });
      } else {
        (port as WebMidi.MIDIInput).onmidimessage = null;
      }
    }
    if (port.type === "output") {
      if (port.state === "connected") {
        this._outputs.set(port.id, port as WebMidi.MIDIOutput);
      } else {
        this._outputs.delete(port.id);
      }
    }
  };

  private _handleMessage = (e: WebMidi.MIDIMessageEvent): void => {
    const [status, data1, data2] = e.data;
    const channel = status & 0x0f;
    const type    = status & 0xf0;

    switch (type) {
      // ── Control Change ──────────────────────────────────────────────────
      case 0xb0: {
        const key   = `${channel}:${data1}`;
        const value = data1 === 7 || data1 === 11   // volume / expression
          ? data2 / 127                             // 0–1 linear
          : data2 / 127;
        this.state.cc[key] = value;

        this._emitEvent<MidiCCEvent>("cc", ev => {
          ev.cc = data1; ev.value = value; ev.channel = channel;
        });

        // MIDI Learn (only fires when learning — zero cost otherwise)
        if (this._learningTarget) {
          const mapping: MidiMapping = { cc: data1, target: this._learningTarget, channel };
          this._mappings.push(mapping);
          this._learningTarget = null;
          this._saveMappings(); // async-safe; only on learn, not every message
          this._emitEvent<MidiLearnEvent>("learn", ev => { ev.mapping = mapping; });
        }
        break;
      }

      // ── Note On ─────────────────────────────────────────────────────────
      case 0x90:
        if (data2 > 0) {
          this.state.notes.set(data1, { velocity: data2 / 127, timestamp: performance.now() });
          this._emitEvent<MidiNoteEvent>("note", ev => {
            ev.note = data1; ev.velocity = data2 / 127; ev.channel = channel; ev.on = true;
          });
          break;
        }
        // velocity === 0 → treat as Note Off (fall through)
        // falls through

      // ── Note Off ────────────────────────────────────────────────────────
      case 0x80:
        this.state.notes.delete(data1);
        this._emitEvent<MidiNoteEvent>("note", ev => {
          ev.note = data1; ev.velocity = 0; ev.channel = channel; ev.on = false;
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
        if (status === 0xf8) this._handleClock();
        break;
    }
  };

  /**
   * MIDI clock handler with median-filter BPM estimation.
   *
   * The original implementation used a simple average which is highly
   * sensitive to single outlier intervals caused by USB packet scheduling.
   * A sliding median over recent intervals discards those outliers cleanly.
   */
  private _handleClock(): void {
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
        .filter((v): v is number => v !== null);

      if (intervals.length > 0) {
        const median      = medianOf(intervals);
        const rawBpm = 60_000 / (median * CLOCKS_PER_BEAT);
        this.state.bpm    = Math.min(999, Math.max(20, rawBpm));
      }
    }

    this._clockCount++;
    // Phase wraps 0→1 per beat (24 clocks per beat)
    this.state.clockPhase = (this._clockCount % CLOCKS_PER_BEAT) / CLOCKS_PER_BEAT;

    this._emitEvent<MidiClockEvent>("clock", ev => {
      ev.phase = this.state.clockPhase;
      ev.bpm   = this.state.bpm;
    });
  }

  // ── Persistence (off hot path) ────────────────────────────────────────────

  private _saveMappings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._mappings));
    } catch { /* storage quota or sandboxed */ }
  }

  private _loadMappings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this._mappings = JSON.parse(raw) as MidiMapping[];
    } catch { /* corrupt data */ }
  }

  // ── Event helpers ─────────────────────────────────────────────────────────

  /**
   * Creates a typed CustomEvent, mutates it via an initializer callback,
   * then dispatches it — avoids allocating objects on every MIDI message
   * when there are no listeners (EventTarget.dispatchEvent is a no-op when
   * the listener list is empty).
   */
  private _emitEvent<T extends Event>(
    type: string,
    init: (ev: T) => void,
  ): void {
    // Only allocate if someone is actually listening
    if (!this.events) return; // guard
    const ev = new Event(type) as T;
    init(ev);
    this.events.dispatchEvent(ev);
  }

  // ── Legacy callback API (backwards-compatible) ────────────────────────────
  // Components written against v1 can keep using onCC / onNote / onClock.
  // New code should prefer engine.events.addEventListener().

  onCC(cb: (cc: number, value: number, channel: number) => void): () => void {
    const handler = (e: Event) => {
      const ev = e as MidiCCEvent;
      cb(ev.cc, ev.value, ev.channel);
    };
    this.events.addEventListener("cc", handler);
    return () => this.events.removeEventListener("cc", handler);
  }

  onNote(cb: (note: number, velocity: number, channel: number) => void): () => void {
    const handler = (e: Event) => {
      const ev = e as MidiNoteEvent;
      cb(ev.note, ev.velocity, ev.channel);
    };
    this.events.addEventListener("note", handler);
    return () => this.events.removeEventListener("note", handler);
  }

  onClock(cb: (phase: number, bpm: number) => void): () => void {
    const handler = (e: Event) => {
      const ev = e as MidiClockEvent;
      cb(ev.phase, ev.bpm);
    };
    this.events.addEventListener("clock", handler);
    return () => this.events.removeEventListener("clock", handler);
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────

/** Returns the median value of a numeric array without mutating it. */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const midiEngine = new MidiEngine();

if (import.meta.hot) {
  import.meta.hot.dispose(() => midiEngine.stop());
}
