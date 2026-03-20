/**
 * ir-reverb-engine.ts
 *
 * ConvolverNode-based reverb using real impulse response (IR) files.
 * Replaces or supplements Tone.js algorithmic Reverb for space/authenticity.
 *
 * Tone.js's Reverb uses a convolution reverb internally but generates its IR
 * algorithmically (no pre-recorded spaces). This engine loads real .wav IRs
 * for concert halls, plates, clubs, springs, etc.
 *
 * ROUTING:
 *   inputNode → preGain → convolver → wetGain  ─┐
 *                                                ├→ outputNode
 *   inputNode                 → dryGain  ────────┘
 *
 * INTEGRATION WITH LOOP ENGINE:
 *   Option A — parallel reverb return (recommended):
 *     loopEngine.masterAnalyser → ir.connectSource(...)
 *     ir.connectDestination(loopEngine.masterLimiter as any)
 *
 *   Option B — replace globalReverb:
 *     route track reverbSend gains to ir.inputNode
 *     ir.outputNode → loopEngine.masterBus
 *
 *   See patchIntoLoopEngine() below for the one-call approach.
 *
 * IR FILES:
 *   Place in client/public/ir/
 *   Free sources: OpenAIR (http://www.openairlib.net), Echothief (http://www.echothief.com)
 *   Recommended formats: 44.1kHz 24-bit WAV, stereo
 */

// ── IR Catalog ────────────────────────────────────────────────────────────────

/** Relative paths under /public. Drop .wav files here to unlock presets. */
export const IR_CATALOG = {
  // Spaces
  smallRoom:    '/ir/small-room.wav',
  largeHall:    '/ir/large-hall.wav',
  cathedral:    '/ir/cathedral.wav',
  clubRoom:     '/ir/club-room.wav',
  studio:       '/ir/studio.wav',
  // Plates
  plateMedium:  '/ir/plate-medium.wav',
  plateLarge:   '/ir/plate-large.wav',
  // Special
  springReverb: '/ir/spring-reverb.wav',
  stadium:      '/ir/stadium.wav',
  tunnel:       '/ir/tunnel.wav',
} as const;

export type IRPreset = keyof typeof IR_CATALOG;

// ── Engine ────────────────────────────────────────────────────────────────────

export class IRReverbEngine {
  private _ctx:       AudioContext | null    = null;
  private _conv:      ConvolverNode | null   = null;
  private _input:     GainNode | null        = null;
  private _preGain:   GainNode | null        = null;
  private _wetGain:   GainNode | null        = null;
  private _dryGain:   GainNode | null        = null;
  private _output:    GainNode | null        = null;

  private _wet        = 0.35;
  private _preGainVal = 1.0;
  private _loaded     = false;
  private _loading    = false;
  private _currentUrl = '';

  // ── Init ───────────────────────────────────────────────────────────────────

  /**
   * Initialize with a Web Audio AudioContext.
   * For loopEngine integration:
   *   import { getContext } from 'tone';
   *   irEngine.init(getContext().rawContext as AudioContext);
   */
  init(ctx: AudioContext): void {
    if (this._ctx) this.dispose();

    this._ctx     = ctx;
    this._input   = ctx.createGain();
    this._preGain = ctx.createGain();
    this._conv    = ctx.createConvolver();
    this._wetGain = ctx.createGain();
    this._dryGain = ctx.createGain();
    this._output  = ctx.createGain();

    this._preGain.gain.value = this._preGainVal;
    this._wetGain.gain.value = this._wet;
    this._dryGain.gain.value = 1 - this._wet;

    // Wet path: input → preGain → convolver → wetGain → output
    this._input.connect(this._preGain);
    this._preGain.connect(this._conv);
    this._conv.connect(this._wetGain);
    this._wetGain.connect(this._output);

    // Dry path: input → dryGain → output
    this._input.connect(this._dryGain);
    this._dryGain.connect(this._output);
  }

  // ── IR loading ─────────────────────────────────────────────────────────────

  /** Load an IR from a URL. Accepts .wav/.mp3/.ogg at 44.1kHz. */
  async load(url: string): Promise<void> {
    if (!this._ctx || !this._conv) throw new Error('[IRReverbEngine] call init() before load()');
    if (url === this._currentUrl && this._loaded) return;

    this._loading = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[IRReverbEngine] fetch failed: ${url} (${res.status})`);
      const arrayBuf = await res.arrayBuffer();
      const decoded  = await this._ctx.decodeAudioData(arrayBuf);
      this._conv.buffer = decoded;
      this._currentUrl  = url;
      this._loaded      = true;
    } finally {
      this._loading = false;
    }
  }

  /** Load a preset from IR_CATALOG. */
  async loadPreset(preset: IRPreset): Promise<void> {
    await this.load(IR_CATALOG[preset]);
  }

  // ── Connections ────────────────────────────────────────────────────────────

  /** Connect an AudioNode to this reverb's input. */
  connectSource(source: AudioNode): void {
    if (!this._input) throw new Error('[IRReverbEngine] not initialized');
    source.connect(this._input);
  }

  /** Connect this reverb's output to a destination AudioNode. */
  connectDestination(dest: AudioNode): void {
    if (!this._output) throw new Error('[IRReverbEngine] not initialized');
    this._output.connect(dest);
  }

  /**
   * Patch into a running LoopEngine instance as a parallel reverb return.
   *
   * Wires:
   *   loopEngine.masterAnalyser → ir input
   *   ir output → loopEngine.masterLimiter (parallel return, pre-destination)
   *
   * Call AFTER loopEngine.init() resolves.
   */
  patchIntoLoopEngine(loopEngine: {
    masterAnalyser: { connect: (n: AudioNode) => void };
    masterLimiter:  { input?: AudioNode; connect?: (n: AudioNode) => void };
  }): void {
    if (!this._input || !this._output) throw new Error('[IRReverbEngine] not initialized');

    // Tap the master waveform analyser output as our reverb input
    (loopEngine.masterAnalyser as any).connect(this._input);

    // Return into master limiter input
    const limiterInput = (loopEngine.masterLimiter as any).input as AudioNode | undefined;
    if (limiterInput) {
      this._output.connect(limiterInput);
    } else {
      // Fallback: connect via Tone node interface
      (loopEngine.masterLimiter as any).connect(this._output);
    }
  }

  // ── Parameters ─────────────────────────────────────────────────────────────

  setWet(wet: number, rampMs = 50): void {
    this._wet = Math.max(0, Math.min(1, wet));
    const now = this._ctx?.currentTime ?? 0;
    const rampSec = rampMs / 1000;
    this._wetGain?.gain.linearRampToValueAtTime(this._wet,        now + rampSec);
    this._dryGain?.gain.linearRampToValueAtTime(1 - this._wet,    now + rampSec);
  }

  setPreGain(gain: number): void {
    this._preGainVal = Math.max(0, Math.min(4, gain));
    if (this._preGain) this._preGain.gain.value = this._preGainVal;
  }

  // ── State accessors ────────────────────────────────────────────────────────

  get loaded():      boolean            { return this._loaded; }
  get loading():     boolean            { return this._loading; }
  get wet():         number             { return this._wet; }
  get preGainVal():  number             { return this._preGainVal; }
  get currentUrl():  string             { return this._currentUrl; }
  get inputNode():   GainNode | null    { return this._input; }
  get outputNode():  GainNode | null    { return this._output; }

  // ── Dispose ────────────────────────────────────────────────────────────────

  dispose(): void {
    [this._input, this._preGain, this._conv, this._wetGain, this._dryGain, this._output]
      .forEach(n => { try { (n as AudioNode | null)?.disconnect(); } catch { /* ok */ } });
    this._input = this._preGain = this._conv =
      this._wetGain = this._dryGain = this._output = null;
    this._ctx    = null;
    this._loaded = false;
    this._currentUrl = '';
  }
}
