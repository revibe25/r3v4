import * as Tone from 'tone';
import { ReverbParams } from '@shared/effects.types';

export class ReverbEffect {
  private reverb: Tone.Reverb;
  private dryGain: Tone.Gain;
  private wetGain: Tone.Gain;
  private output: Tone.Gain;
  private params: ReverbParams;

  constructor() {
    this.reverb  = new Tone.Reverb({ decay: 1.5, preDelay: 0.01, wet: 1 });
    this.dryGain = new Tone.Gain({ gain: 0.6 });
    this.wetGain = new Tone.Gain({ gain: 0.4 });
    this.output  = new Tone.Gain({ gain: 1 });

    this.reverb.connect(this.wetGain);
    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);

    this.params = {
      enabled: true, type: 'reverb',
      decay: 1.5, preDelay: 0.01,
      wet: 0.4, dry: 0.6,
    };
  }

  setParams(params: Partial<ReverbParams>): void {
    this.params = { ...this.params, ...params };
    this.updateReverb();
  }

  private updateReverb(): void {
    if (!this.params.enabled) {
      this.wetGain.gain.rampTo(0, 0.05);
      this.dryGain.gain.rampTo(1, 0.05);
      return;
    }
    // Reverb.decay requires regeneration - set directly
    this.reverb.decay    = Math.max(0.001, this.params.decay);
    this.reverb.preDelay = Math.max(0, this.params.preDelay);
    this.wetGain.gain.rampTo(this.params.wet, 0.1);
    this.dryGain.gain.rampTo(this.params.dry, 0.1);
  }

  connect(source: Tone.ToneAudioNode): this {
    source.connect(this.dryGain);
    source.connect(this.reverb);
    return this;
  }

  disconnect(): void {
    this.dryGain.disconnect();
    this.reverb.disconnect();
    this.output.disconnect();
  }

  getParams(): ReverbParams { return { ...this.params }; }
  getNode(): Tone.Reverb { return this.reverb; }

  dispose(): void {
    this.reverb.dispose();
    this.dryGain.dispose();
    this.wetGain.dispose();
    this.output.dispose();
  }
  /** Returns the terminal output node for explicit chain wiring. */
  getOutput(): Tone.Gain {
    return this.output;
  }

  /**
   * Connect this effect into an explicit audio chain.
   * Use instead of letting the effect route to ctx.destination directly.
   */
  connectTo(destination: Tone.ToneAudioNode): this {
    this.output.connect(destination);
    return this;
  }
}

export const REVERB_PRESETS = {
  room:       { decay: 0.5,  preDelay: 0.005, wet: 0.2, dry: 0.8 },
  hall:       { decay: 2.0,  preDelay: 0.02,  wet: 0.35,dry: 0.65},
  chamber:    { decay: 1.2,  preDelay: 0.01,  wet: 0.3, dry: 0.7 },
  plate:      { decay: 1.8,  preDelay: 0.0,   wet: 0.4, dry: 0.6 },
  cathedral:  { decay: 5.0,  preDelay: 0.04,  wet: 0.5, dry: 0.5 },
  spring:     { decay: 0.8,  preDelay: 0.008, wet: 0.25,dry: 0.75},
} as const;
