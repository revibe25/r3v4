import * as Tone from 'tone';
import { FilterParams } from '@shared/effects.types';

export class FilterEffect {
  private filter: Tone.Filter;
  private params: FilterParams;

  constructor() {
    this.filter = new Tone.Filter({ frequency: 20000, type: 'lowpass', rolloff: -12 });
    this.filter.toDestination();
    this.params = {
      enabled: true, type: 'filter',
      frequency: 20000, filterType: 'lowpass',
      resonance: 1, rolloff: -12,
      wet: 1, dry: 0,
    };
  }

  setParams(params: Partial<FilterParams>): void {
    this.params = { ...this.params, ...params };
    this.updateFilter();
  }

  private updateFilter(): void {
    if (!this.params.enabled) return;
    this.filter.frequency.rampTo(
      Math.max(20, Math.min(20000, this.params.frequency)), 0.05
    );
    this.filter.Q.rampTo(Math.max(0.1, this.params.resonance), 0.05);
    this.filter.type = this.params.filterType as BiquadFilterType;
  }

  connect(source: Tone.ToneAudioNode): this {
    source.connect(this.filter);
    return this;
  }

  disconnect(): void { this.filter.disconnect(); }
  getParams(): FilterParams { return { ...this.params }; }
  getNode(): Tone.Filter { return this.filter; }
  dispose(): void { this.filter.dispose(); }
}

export const FILTER_PRESETS = {
  open:     { frequency: 20000, filterType: 'lowpass',  resonance: 1   },
  warm:     { frequency: 8000,  filterType: 'lowpass',  resonance: 0.7 },
  dark:     { frequency: 3000,  filterType: 'lowpass',  resonance: 1   },
  telephone:{ frequency: 3000,  filterType: 'bandpass', resonance: 8   },
  highpass: { frequency: 200,   filterType: 'highpass', resonance: 1   },
  notch:    { frequency: 1000,  filterType: 'notch',    resonance: 10  },
} as const;

export const FILTER_FREQUENCIES = {
  subBass: 60, bass: 200, lowMid: 500,
  mid: 1000, highMid: 4000, presence: 8000, air: 16000,
} as const;
