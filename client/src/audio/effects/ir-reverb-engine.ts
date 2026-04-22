/**
 * ir-reverb-engine.ts
 *
 * ConvolverNode-based reverb using real impulse response files.
 * Drop .wav IRs in client/public/ir/ to enable presets.
 * Free IR sources: openairlib.net, echothief.com
 *
 * ROUTING:
 *   inputNode → preGain → convolver → wetGain ─┐
 *                                               ├─→ outputNode
 *   inputNode               → dryGain ──────────┘
 */

export const IR_CATALOG = {
  smallRoom:    "/ir/small-room.wav",
  largeHall:    "/ir/large-hall.wav",
  cathedral:    "/ir/cathedral.wav",
  clubRoom:     "/ir/club-room.wav",
  studio:       "/ir/studio.wav",
  plateMedium:  "/ir/plate-medium.wav",
  plateLarge:   "/ir/plate-large.wav",
  springReverb: "/ir/spring-reverb.wav",
  stadium:      "/ir/stadium.wav",
  tunnel:       "/ir/tunnel.wav",
} as const;

export type IRPreset = keyof typeof IR_CATALOG;

export class IRReverbEngine {
  private _ctx:      AudioContext | null = null;
  private _conv:     ConvolverNode | null = null;
  private _input:    GainNode | null = null;
  private _preGain:  GainNode | null = null;
  private _wetGain:  GainNode | null = null;
  private _dryGain:  GainNode | null = null;
  private _output:   GainNode | null = null;
  private _wet       = 0.35;
  private _preG      = 1.0;
  private _loaded    = false;
  private _loading   = false;
  private _curUrl    = "";

  init(ctx: AudioContext): void {
    if (this._ctx) this.dispose();
    this._ctx    = ctx;
    this._input  = ctx.createGain();
    this._preGain = ctx.createGain();
    this._conv   = ctx.createConvolver();
    this._wetGain = ctx.createGain();
    this._dryGain = ctx.createGain();
    this._output = ctx.createGain();
    this._preGain.gain.setTargetAtTime(this._preG, this._ctx.currentTime, 0.015);
    this._wetGain.gain.setTargetAtTime(this._wet, ctx.currentTime, 0.015);
    this._dryGain.gain.setTargetAtTime(1 - this._wet, ctx.currentTime, 0.015);
    // Wet path
    this._input.connect(this._preGain);
    this._preGain.connect(this._conv);
    this._conv.connect(this._wetGain);
    this._wetGain.connect(this._output);
    // Dry path
    this._input.connect(this._dryGain);
    this._dryGain.connect(this._output);
  }

  async load(url: string): Promise<void> {
    if (!this._ctx || !this._conv) throw new Error("[IRReverbEngine] call init() first");
    if (url === this._curUrl && this._loaded) return;
    this._loading = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[IRReverbEngine] fetch failed: ${url} (${res.status})`);
      const buf     = await res.arrayBuffer();
      const decoded = await this._ctx.decodeAudioData(buf);
      this._conv.buffer = decoded;
      this._curUrl  = url;
      this._loaded  = true;
    } finally {
      this._loading = false;
    }
  }

  async loadPreset(preset: IRPreset): Promise<void> {
    await this.load(IR_CATALOG[preset]);
  }

  connectSource(src: AudioNode): void      { this._input?.connect(src as any); src.connect(this._input!); }
  connectDestination(dest: AudioNode): void { this._output?.connect(dest); }

  /**
   * Patch into loopEngine as parallel reverb return.
   * Call after loopEngine.init() resolves.
   */
  patchIntoLoopEngine(loopEngine: any): void {
    if (!this._input || !this._output) throw new Error("[IRReverbEngine] not initialized");
    // Tap master analyser → our input
    (loopEngine.masterAnalyser as any).connect(this._input);
    // Return → master limiter input
    const limIn = (loopEngine.masterLimiter as any).input as AudioNode | undefined;
    if (limIn) this._output.connect(limIn);
    else       (loopEngine.masterLimiter as any).connect(this._output);
  }

  setWet(wet: number, rampMs = 50): void {
    this._wet = Math.max(0, Math.min(1, wet));
    const now = this._ctx?.currentTime ?? 0;
    const r   = rampMs / 1000;
    this._wetGain?.gain.linearRampToValueAtTime(this._wet,     now + r);
    this._dryGain?.gain.linearRampToValueAtTime(1 - this._wet, now + r);
  }

  setPreGain(gain: number): void {
    this._preG = Math.max(0, Math.min(4, gain));
    if (this._preGain) this._preGain.gain.setTargetAtTime(this._preG, this._ctx?.currentTime ?? 0, 0.015);
  }

  get loaded()   { return this._loaded; }
  get loading()  { return this._loading; }
  get wet()      { return this._wet; }
  get inputNode(){ return this._input; }
  get outputNode(){ return this._output; }

  dispose(): void {
    [this._input, this._preGain, this._conv, this._wetGain, this._dryGain, this._output]
      .forEach(n => { try { (n as any)?.disconnect(); } catch { /**/ } });
    this._input = this._preGain = this._conv =
      this._wetGain = this._dryGain = this._output = null;
    this._ctx = null; this._loaded = false; this._curUrl = "";
  }
}
