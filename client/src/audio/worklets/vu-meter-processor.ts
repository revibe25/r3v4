/**
 * vu-meter-processor.ts
 * AudioWorkletProcessor — computes peak + RMS per channel every 50ms.
 * Compiled to a separate worklet bundle by the Vite worklet build step.
 */

interface MeterProcessorOptions {
  numberOfInputs: number;
  numberOfOutputs: number;
  outputChannelCount: number[];
  processorOptions: { intervalMs: number };
}

class VUMeterProcessor extends AudioWorkletProcessor {
  private _interval:   number;
  private _framesSince: number = 0;
  private _peakL:  number = 0;
  private _peakR:  number = 0;
  private _sumSqL: number = 0;
  private _sumSqR: number = 0;
  private _frames: number = 0;

  constructor(options: MeterProcessorOptions) {
    super();
    const intervalMs = options.processorOptions?.intervalMs ?? 50;
    // sampleRate is a global inside AudioWorkletGlobalScope
    this._interval = Math.round((sampleRate / 1000) * intervalMs);
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const L = input[0] ?? new Float32Array(0);
    const R = input[1] ?? input[0] ?? new Float32Array(0);

    for (let i = 0; i < L.length; i++) {
      const l = L[i]; const r = R[i] ?? l;
      if (Math.abs(l) > this._peakL) this._peakL = Math.abs(l);
      if (Math.abs(r) > this._peakR) this._peakR = Math.abs(r);
      this._sumSqL += l * l;
      this._sumSqR += r * r;
    }
    this._frames      += L.length;
    this._framesSince += L.length;

    if (this._framesSince >= this._interval) {
      const rmsL = Math.sqrt(this._sumSqL / this._frames);
      const rmsR = Math.sqrt(this._sumSqR / this._frames);
      this.port.postMessage({
        peakL: this._peakL, peakR: this._peakR,
        rmsL, rmsR,
      });
      // Decay peak (not reset — simulate peak hold)
      this._peakL      *= 0.92;
      this._peakR      *= 0.92;
      this._sumSqL      = 0;
      this._sumSqR      = 0;
      this._frames      = 0;
      this._framesSince = 0;
    }
    return true;
  }
}

registerProcessor("vu-meter-processor", VUMeterProcessor);
