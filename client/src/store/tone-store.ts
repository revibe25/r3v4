import { create } from 'zustand';
import * as Tone from 'tone';
import { ReverbEffect } from '../audio/effects/reverb';
import { DelayEffect } from '../audio/effects/delay';
import { FilterEffect } from '../audio/effects/filter';
import { DistortionEffect } from '../audio/effects/distortion';
import { CompressorEffect } from '../audio/effects/compressor';
import { EQEffect } from '../audio/effects/eq';
import { Crossfader } from '../audio/dj-controls/crossfader';
import { TempoControl } from '../audio/dj-controls/tempo-control';
import { CueManager } from '../audio/dj-controls/cue-management';
import { BeatSync } from '../audio/dj-controls/beat-sync';
import { AnyEffectParams, EffectChainNode } from '@shared/effects.types';
import { CrossfaderState, TempoControlState } from '@shared/dj.types';

interface AudioStore {
  // Effects
  effectChain: Map<string, any>;
  addEffect: (type: string) => void;
  updateEffect: (id: string, params: AnyEffectParams) => void;
  removeEffect: (id: string) => void;

  // DJ Controls
  crossfader: Crossfader | null;
  tempoControl: TempoControl | null;
  cueManager: CueManager | null;
  beatSync: BeatSync | null;

  // Actions
  initAudio: () => Promise<void>;
  setCrossfaderPosition: (position: number) => void;
  setTempo: (bpm: number) => void;
  jumpToCue: (index: number) => void;
  setCue: (index: number, position: number) => void;
  
  // State subscriptions
  crossfaderState: CrossfaderState | null;
  tempoState: TempoControlState | null;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  effectChain: new Map(),
  crossfader: null,
  tempoControl: null,
  cueManager: null,
  beatSync: null,
  crossfaderState: null,
  tempoState: null,

  initAudio: async () => {
    await Tone.start();
    const destination = Tone.Destination;

    const crossfader = new Crossfader(destination);
    const tempoControl = new TempoControl(120);
    const cueManager = new CueManager('default');
    const beatSync = new BeatSync(120);

    set({
      crossfader,
      tempoControl,
      cueManager,
      beatSync,
      crossfaderState: crossfader.getState(),
      tempoState: tempoControl.getState(),
    });

    // Subscribe to changes
    tempoControl.subscribe((state) => {
      set({ tempoState: state });
    });
  },

  addEffect: (type: string) => {
    // Implementation depends on selected type
    // Create effect instance and add to chain
  },

  updateEffect: (id: string, params: AnyEffectParams) => {
    const { effectChain } = get();
    const effect = effectChain.get(id);
    if (effect) {
      effect.setParams(params);
    }
  },

  removeEffect: (id: string) => {
    const { effectChain } = get();
    const effect = effectChain.get(id);
    if (effect) {
      effect.dispose();
      effectChain.delete(id);
    }
  },

  setCrossfaderPosition: (position: number) => {
    const { crossfader } = get();
    crossfader?.setPosition(position);
  },

  setTempo: (bpm: number) => {
    const { tempoControl } = get();
    tempoControl?.setBpm(bpm);
  },

  jumpToCue: (index: number) => {
    const { cueManager } = get();
    if (cueManager) {
      try {
        cueManager.jumpToCue(index);
      } catch (err) {
        console.error('Cue error:', err);
      }
    }
  },

  setCue: (index: number, position: number) => {
    const { cueManager } = get();
    cueManager?.setCue(index, position);
  },
}));
