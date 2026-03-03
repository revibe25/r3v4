import * as Tone from 'tone';
import { DelayParams } from '@shared/effects.types';

export class DelayEffect {
  private delay: Tone.FeedbackDelay;
  private dryGain: Tone.Gain;
  private wetGain: Tone.Gain;
  private output: Tone.Gain;
  private params: DelayParams;

  constructor() {
    this.delay    = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.3, wet: 1 });
    this.dryGain  = new Tone.Gain({ gain: 0.7 });
    this.wetGain  = new Tone.Gain({ gain: 0.3 });
    this.output   = new Tone.Gain({ gain: 1 });

    this.delay.connect(this.wetGain);
    this.dryGain.connect(this.output);
    this.wetGain.connect(this.output);
    this.output.toDestination();

    this.params = {
      enabled: true, type: 'delay',
      delayTime: 0.25, feedback: 0.3,
      wet: 0.3, dry: 0.7,
    };
  }

  setParams(params: Partial<DelayParams>): void {
    this.params = { ...this.params, ...params };
    this.updateDelay();
  }

  private updateDelay(): void {
    if (!this.params.enabled) {
      this.wetGain.gain.rampTo(0, 0.05);
      this.dryGain.gain.rampTo(1, 0.05);
      return;
    }
    this.delay.delayTime.rampTo(this.params.delayTime, 0.1);
    this.delay.feedback.rampTo(Math.min(0.95, this.params.feedback), 0.1);
    this.wetGain.gain.rampTo(this.params.wet, 0.1);
    this.dryGain.gain.rampTo(this.params.dry, 0.1);
  }

  connect(source: Tone.ToneAudioNode): this {
    source.connect(this.dryGain);
    source.connect(this.delay);
    return this;
  }

  disconnect(): void {
    this.dryGain.disconnect();
    this.delay.disconnect();
    this.output.disconnect();
  }

  getParams(): DelayParams { return { ...this.params }; }
  getNode(): Tone.FeedbackDelay { return this.delay; }

  dispose(): void {
    this.delay.dispose();
    this.dryGain.dispose();
    this.wetGain.dispose();
    this.output.dispose();
  }
}

export const DELAY_PRESETS = {
  slap:    { delayTime: 0.08,  feedback: 0.1,  wet: 0.25, dry: 0.75 },
  room:    { delayTime: 0.15,  feedback: 0.2,  wet: 0.3,  dry: 0.7  },
  echo:    { delayTime: 0.375, feedback: 0.45, wet: 0.35, dry: 0.65 },
  ping:    { delayTime: 0.5,   feedback: 0.5,  wet: 0.4,  dry: 0.6  },
  wash:    { delayTime: 0.667, feedback: 0.65, wet: 0.5,  dry: 0.5  },
} as const;

export const TEMPO_MULTIPLIERS = {
  '1/32': 0.125, '1/16': 0.25, '1/8': 0.5,
  '1/4':  1,     '3/8':  1.5,  '1/2': 2,
} as const;
