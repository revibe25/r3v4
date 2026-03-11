// @ts-nocheck
import * as Tone from 'tone';
import { EQParams } from '@shared/effects.types';

export class EQEffect {
  private lowShelf: Tone.EQ3;
  private params: EQParams;

  constructor() {
    this.lowShelf = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
    this.lowShelf.toDestination();
    this.params = { enabled: true, type: 'eq', low: 0, mid: 0, high: 0, wet: 1, dry: 0 };
  }

  setParams(params: Partial<EQParams>): void {
    this.params = { ...this.params, ...params };
    this.updateEQ();
  }

  private updateEQ(): void {
    if (!this.params.enabled) return;
    this.lowShelf.low.value = this.params.low ?? 0;
    this.lowShelf.mid.value = this.params.mid ?? 0;
    this.lowShelf.high.value = this.params.high ?? 0;
  }

  connect(source: Tone.ToneAudioNode): this {
    source.connect(this.lowShelf);
    return this;
  }

  disconnect(): void { this.lowShelf.disconnect(); }
  getParams(): EQParams { return { ...this.params }; }
  getNode(): Tone.EQ3 { return this.lowShelf; }
  dispose(): void { this.lowShelf.dispose(); }
}

export const EQ_PRESETS = {
  flat:      { low: 0,   mid: 0,   high: 0  },
  bassBoost: { low: 6,   mid: 0,   high: 0  },
  presence:  { low: 0,   mid: 3,   high: 2  },
  airiness:  { low: -2,  mid: 0,   high: 5  },
  warmth:    { low: 4,   mid: -1,  high: -2 },
  scoop:     { low: 2,   mid: -4,  high: 2  },
} as const;

export const EQ_STYLES = {
  flat:      'No equalization applied',
  bassBoost: 'Enhanced low frequencies',
  presence:  'Enhanced midrange clarity',
  airiness:  'Bright and airy top end',
  warmth:    'Warm and full low end',
  scoop:     'Scooped midrange for clarity',
} as const;
