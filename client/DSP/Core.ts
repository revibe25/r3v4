import { MSL } from './MSL';
import { LDE } from './LDE';
import { Smoother } from './Smoother';
import { GainComputer } from './GainComputer';
import { FFTAnalyzer } from './FFTAnalyzer';
import { DynamicEQ } from './DynamicEQ';
import { DeEsser } from './DeEsser';
import { PitchDetector } from './PitchDetector';
import { VocalSpectraParameters } from '../Parameters';

export class VocalSpectra /* implements DSPPlugin */ {
  private sampleRate = 48000;
  private maxBlockSize = 128;
  private pitch!: PitchDetector;
  private eq!: DynamicEQ;
  private deEsser!: DeEsser;
  private gainRider!: GainComputer;
  private fft!: FFTAnalyzer;
  private paramSmoothers: Record<string, Smoother> = {};
  private lookaheadSamples = 0;

  prepare(sampleRate: number, maxBlockSize: number, layout: any): void {
    this.sampleRate = sampleRate;
    this.maxBlockSize = maxBlockSize;
    this.pitch = new PitchDetector(sampleRate, maxBlockSize);
    this.eq = new DynamicEQ(sampleRate, maxBlockSize);
    this.deEsser = new DeEsser(sampleRate, maxBlockSize);
    this.gainRider = new GainComputer({ 
      targetDb: -18, maxGainDb: 12, minGainDb: -24, kneeWidthDb: 3 
    });
    this.fft = new FFTAnalyzer(maxBlockSize);

    // Set up all parameter smoothers per PRD
    this.paramSmoothers = {};
    for (const p of VocalSpectraParameters) {
      // only continuous params need smoothing
      if (p.smoothingTimeMs > 0) {
        this.paramSmoothers[p.id] = new Smoother(
          this.sampleRate, p.smoothingTimeMs, p.defaultValue
        );
      }
    }
  }

  processBlock(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const blockSize = inputs?.[0]?.[0]?.length ?? 0;
    if (blockSize === 0) return true;

    // 1. Parameter smoothing (block-based, per DCF v2.0)
    for (const [id, smoother] of Object.entries(this.paramSmoothers)) {
      // all plugin param arrays are k-rate (length=1, per spec)
      smoother.update(parameters[id]?.[0]);
    }

    // 2. Pitch correction
    const input = inputs[0][0]; // assume mono for minimum viable; expand for stereo
    const pitchData = this.pitch.detect(input);
    let signal = this.pitch.correct(
      input,
      pitchData,
      this.paramSmoothers['correction']?.value ?? parameters['correction']?.[0] ?? 100,
      // ... pass other params as needed
    );

    // 3. FFT for adaptive EQ/de-ess
    const spectrum = this.fft.analyze(signal);

    // 4. Adaptive Dynamic EQ
    signal = this.eq.process(signal, parameters, spectrum);

    // 5. Spectral De-Esser
    signal = this.deEsser.process(signal, spectrum, parameters);

    // 6. Intelligent Gain Rider ("smart target")
    const targetDb = this.computeSmartTargetDb(spectrum);
    this.gainRider.setTargetDb(targetDb);
    signal = this.gainRider.apply(signal);

    // 7. Output
    for (let ch = 0; ch < outputs[0].length; ch++) {
      outputs[0][ch].set(signal);
    }

    // 8. Meter reporting (stub per block; to UI thread as needed)
    // (Peak, RMS, GR per PRD §11.3)
    // e.g.: this.postMeters(...);

    return true;
  }

  computeSmartTargetDb(spectrum: Float32Array): number {
    let sumMag = 0, sum = 0;
    for (let i = 0; i < spectrum.length; ++i) {
      sumMag += spectrum[i];
      sum += spectrum[i] * i;
    }
    const centroid = sum / (sumMag + MSL.EPSILON);
    const minDb = -36, maxDb = 0;
    const scale = Math.max(0, Math.min(1, (centroid - 50) / (400 - 50)));
    return maxDb - scale * (maxDb - minDb);
  }

  getLatencySamples(): number {
    // Per PRD: sum relevant latencies
    return (this.pitch?.getLatencySamples?.() || 0)
      + (this.deEsser?.getLatencySamples?.() || 0)
      + (this.eq?.getLatencySamples?.() || 0);
  }
  getTailTimeSeconds(): number { return 0; }
  reset() {
    this.pitch.reset();
    this.eq.reset();
    this.deEsser.reset();
    this.gainRider.reset?.();
    this.fft.reset?.();
  }
  release() {
    // No heap frees needed in JS; free WASM here if used
  }
}