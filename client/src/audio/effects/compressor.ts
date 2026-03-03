// Compressor effect using Tone.js v14
import * as Tone from 'tone';
import { CompressorParams } from '@shared/effects.types';

export class CompressorEffect {
  private compressor: Tone.Compressor;
  private makeupGain: Tone.Gain;
  private dryGain: Tone.Gain;
  private wetGain: Tone.Gain;
  private output: Tone.Gain;
  private params: CompressorParams;

  constructor() {
    this.compressor = new Tone.Compressor({
      threshold: -30,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
      knee: 6,
    });

    this.makeupGain = new Tone.Gain({ gain: 1 });
    this.dryGain   = new Tone.Gain({ gain: 1 });
    this.wetGain   = new Tone.Gain({ gain: 0 });
    this.output    = new Tone.Gain({ gain: 1 });

    // Route: input → dryGain  → output
    //        input → compressor → makeupGain → wetGain → output
    this.compressor.connect(this.makeupGain);
    this.makeupGain.connect(this.wetGain);
    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);
    this.output.toDestination();

    this.params = {
      enabled: true,
      type: 'compressor',
      threshold: -30,
      ratio: 4,
      attack: 3,
      release: 250,
      makeup: 0,
      knee: 6,
      wet: 0.7,
      dry: 0.3,
    };

    this.updateCompressor();
  }

  setParams(params: Partial<CompressorParams>): void {
    this.params = { ...this.params, ...params };
    this.updateCompressor();
  }

  private updateCompressor(): void {
    if (!this.params.enabled) {
      this.wetGain.gain.setValueAtTime(0, Tone.now());
      this.dryGain.gain.setValueAtTime(1, Tone.now());
      return;
    }

    const threshold = Math.max(-100, Math.min(0, this.params.threshold));
    this.compressor.threshold.rampTo(threshold, 0.1);

    const ratio = Math.max(1, Math.min(20, this.params.ratio));
    this.compressor.ratio.rampTo(ratio, 0.1);

    const attackSec = Math.max(0, Math.min(1, this.params.attack / 1000));
    this.compressor.attack.rampTo(attackSec, 0.1);

    const releaseSec = Math.max(0.01, Math.min(3, this.params.release / 1000));
    this.compressor.release.rampTo(releaseSec, 0.1);

    const knee = Math.max(0, Math.min(40, this.params.knee));
    this.compressor.knee.rampTo(knee, 0.1);

    // Tone.js v14: use Math.pow(10, db/20) instead of Math.pow(10, )
    const makeupDb     = this.params.makeup || this.autoCalculateMakeup();
    const makeupLinear = Math.pow(10, makeupDb / 20);
    this.makeupGain.gain.rampTo(makeupLinear, 0.1);

    this.wetGain.gain.rampTo(this.params.wet, 0.1);
    this.dryGain.gain.rampTo(this.params.dry, 0.1);
  }

  private autoCalculateMakeup(): number {
    const maxReduction = Math.abs(this.params.threshold) * (1 - 1 / this.params.ratio);
    return Math.min(40, maxReduction * 0.5);
  }

  getReductionAmount(): number {
    return 0;
  }

  connect(source: Tone.ToneAudioNode): this {
    source.connect(this.dryGain);
    source.connect(this.compressor);
    return this;
  }

  connectFromNode(source: AudioNode): this {
    const gain = Tone.getContext().createGain();
    source.connect(gain);
    Tone.connect(gain as unknown as AudioNode, this.dryGain);
    Tone.connect(gain as unknown as AudioNode, this.compressor);
    return this;
  }

  disconnect(): void {
    this.dryGain.disconnect();
    this.compressor.disconnect();
    this.output.disconnect();
  }

  getParams(): CompressorParams {
    return { ...this.params };
  }

  getNode(): Tone.Compressor {
    return this.compressor;
  }

  dispose(): void {
    this.compressor.dispose();
    this.makeupGain.dispose();
    this.dryGain.dispose();
    this.wetGain.dispose();
    this.output.dispose();
  }
}

export const COMPRESSOR_PRESETS = {
  vocal:    { threshold: -20, ratio: 4,  attack: 5,   release: 100, makeup: 4, knee: 6,  wet: 0.8, dry: 0.2 },
  drum:     { threshold: -30, ratio: 6,  attack: 1,   release: 50,  makeup: 6, knee: 2,  wet: 0.9, dry: 0.1 },
  bass:     { threshold: -25, ratio: 3,  attack: 10,  release: 200, makeup: 3, knee: 8,  wet: 0.7, dry: 0.3 },
  glue:     { threshold: -15, ratio: 2,  attack: 20,  release: 150, makeup: 2, knee: 12, wet: 0.6, dry: 0.4 },
  limiting: { threshold: -6,  ratio: 10, attack: 0.5, release: 30,  makeup: 5, knee: 0,  wet: 1.0, dry: 0.0 },
  punch:    { threshold: -35, ratio: 8,  attack: 2,   release: 80,  makeup: 8, knee: 0,  wet: 0.85,dry: 0.15 },
} as const;

export const COMPRESSOR_STYLES = {
  vocal:    'Smooth vocal control with moderate compression',
  drum:     'Tight drum processing with fast attack',
  bass:     'Warm bass glue with smooth release',
  glue:     'Subtle mix bus style compression',
  limiting: 'Hard limiting to prevent peaks',
  punch:    'Aggressive compression for impact',
} as const;
