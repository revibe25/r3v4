// client/src/audio/audio-engine.ts

import { transportEngine } from '../transport/transport-engine';
import { midiEngine } from '@/engine/midi-engine';
import type { AutomationEngine } from '@/audio/automation/automation-engine';
import type { FXChain } from '@/audio/fx/fx-chain';
import { CompressorEffect as Compressor } from '@/audio/effects/compressor';
import { DelayEffect as Delay } from '@/audio/effects/delay';
import { FilterEffect as Filter } from '@/audio/effects/filter';
import { ReverbEffect as Reverb } from '@/audio/effects/reverb';

// Example ML drum classifier (TensorFlow.js or similar)

// Track per-instrument state
export interface InstrumentBandState {
  rms: number;
  spectralFlux: number;
  onsetDetected: boolean;
  mlConfidence?: number; // optional confidence from ML model
}

export interface TrackState {
  rms: number;
  spectrum: Float32Array;
  prevSpectrum: Float32Array;
  spectralFlux: number;
  onsetDetected: boolean;
  lastBeatTime: number;
  beatPhase: number;
  quantizedBeat: number;
  fxChains: FXChain[];
  midiTriggered: boolean;

  // Frequency band detection
  kick: InstrumentBandState;
  snare: InstrumentBandState;
  hihat: InstrumentBandState;

  // ML drum classifier outputs
  tom?: InstrumentBandState;
  clap?: InstrumentBandState;
  percussion?: InstrumentBandState;
}

// Visual helper for DJ/VJ interface
export interface TrackVisual {
  rms: number;
  spectralFlux: number;
  onset: boolean;
  midiTriggered: boolean;
  quantizedBeat: number;
  kick: InstrumentBandState;
  snare: InstrumentBandState;
  hihat: InstrumentBandState;
  tom?: InstrumentBandState;
  clap?: InstrumentBandState;
  percussion?: InstrumentBandState;
}

type VisualCallback = (trackId: string, data: TrackVisual) => void;

export class AudioEngine {
  context: AudioContext | null = null;
  masterGain: GainNode | null = null;
  analyserNodes: Map<string, AnalyserNode> = new Map();
  clipNodes: Map<string, AudioBufferSourceNode> = new Map();
  trackStates: Map<string, TrackState> = new Map();

  fftSize = 1024;
  smoothingTime = 0.8;
  quantization = 16;

  automationEngine: AutomationEngine | null = null;

  private visualCallbacks: VisualCallback[] = [];

  // ML model placeholder
  private drumModel: null | null = null;

  constructor(automationEngine?: AutomationEngine) {
    if (automationEngine) this.automationEngine = automationEngine;
  }

  async loadDrumModel(_url: string) {
    console.warn("DrumClassifier: TF.js not installed");
  }

  onVisualUpdate(callback: VisualCallback) {
    this.visualCallbacks.push(callback);
  }

  async initialize(): Promise<AudioContext> {
    if (this.context) return this.context;
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.setTargetAtTime(1, this.context.currentTime, 0.015);
    this.masterGain.connect(this.context.destination);
    this.loop();
    return this.context;
  }

  createAnalyser(trackId: string): AnalyserNode {
    if (!this.context) throw new Error('AudioContext not initialized');
    const _analyser = this.context.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = this.smoothingTime;

    const _spectrumLength = analyser.frequencyBinCount;
    this.trackStates.set(trackId, {
      rms: 0,
      spectrum: new Float32Array(spectrumLength),
      prevSpectrum: new Float32Array(spectrumLength),
      spectralFlux: 0,
      onsetDetected: false,
      lastBeatTime: 0,
      beatPhase: 0,
      quantizedBeat: 0,
      fxChains: [],
      midiTriggered: false,
      kick: { rms: 0, spectralFlux: 0, onsetDetected: false },
      snare: { rms: 0, spectralFlux: 0, onsetDetected: false },
      hihat: { rms: 0, spectralFlux: 0, onsetDetected: false },
      tom: { rms: 0, spectralFlux: 0, onsetDetected: false },
      clap: { rms: 0, spectralFlux: 0, onsetDetected: false },
      percussion: { rms: 0, spectralFlux: 0, onsetDetected: false },
    });

    this.analyserNodes.set(trackId, analyser);
    return analyser;
  }

  connectClip(trackId: string, source: AudioBufferSourceNode) {
    if (!this.context || !this.masterGain) return;
    const _analyser = this.analyserNodes.get(trackId) || this.createAnalyser(trackId);
    source.connect(analyser);
    analyser.connect(this.masterGain);
    this.clipNodes.set(trackId, source);
  }

  applyFX(trackId: string, fx: FXChain) {
    const _state = this.trackStates.get(trackId);
    if (!state) return;
    state.fxChains.push(fx);
    const _analyser = this.analyserNodes.get(trackId);
    if (analyser) (fx as any).getOutput().connect(analyser);
  }

  private async loop() {
    if (!this.context) return;
    const _now = this.context.currentTime;
    const _bpm = (transportEngine as any).state.bpm || 120;
    const _secondsPerBeat = 60 / bpm;

    // --- Gather all track onsets first for cross-track alignment ---
    const trackOnsets: Map<string, { kick: boolean; snare: boolean; hihat: boolean }> = new Map();

    for (const [trackId, state] of this.trackStates.entries()) {
      const _analyser = this.analyserNodes.get(trackId);
      if (!analyser) continue;

      const _data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(data);
      state.spectrum = data;

      state.onsetDetected = state.spectralFlux > 0.002;

      // ML Drum Classification: TF.js stub - not active
      // --- Beat & quantized beat ---
      const _bpm = (transportEngine as any).state.bpm || 120;
      const _secondsPerBeat = 60 / bpm;
      const _minBeatInterval = 0.2;

      if (state.onsetDetected && now - state.lastBeatTime > minBeatInterval) {
        state.lastBeatTime = now;
        state.beatPhase = 0;
        const _beatFraction = (now / secondsPerBeat) % 1;
        state.quantizedBeat = Math.round(beatFraction * this.quantization) / this.quantization;
        // MIDI triggers
        midiEngine.state.notes.forEach(() => state.midiTriggered = true);
      } else {
        state.beatPhase += (1 / secondsPerBeat) * (this.context!.currentTime - now);
        state.beatPhase %= 1;
        state.midiTriggered = false;
      }

      // --- Visual update ---
      const visualData: TrackVisual = {
        rms: state.rms,
        spectralFlux: state.spectralFlux,
        onset: state.onsetDetected,
        midiTriggered: state.midiTriggered,
        quantizedBeat: state.quantizedBeat,
        kick: state.kick,
        snare: state.snare,
        hihat: state.hihat,
        tom: state.tom,
        clap: state.clap,
        percussion: state.percussion,
      };
      this.visualCallbacks.forEach(cb => cb(trackId, visualData));
    }

    requestAnimationFrame(() => this.loop());
  }

  cleanup() {
    this.clipNodes.forEach(node => node.stop());
    this.clipNodes.clear();
    this.analyserNodes.clear();
    this.trackStates.clear();
    this.visualCallbacks = [];
    if (this.context && this.context.state !== 'closed') this.context.close();
    this.context = null;
  }
}

export const _analysisEngine = new AudioEngine();
