// client/src/audio/audio-engine.ts
import { transportEngine } from '../transport/transport-engine';
import { midiEngine } from '@/engine/midi-engine';
export class AudioEngine {
    constructor(automationEngine) {
        this.context = null;
        this.masterGain = null;
        this.analyserNodes = new Map();
        this.clipNodes = new Map();
        this.trackStates = new Map();
        this.fftSize = 1024;
        this.smoothingTime = 0.8;
        this.quantization = 16;
        this.automationEngine = null;
        this.visualCallbacks = [];
        // ML model placeholder
        this.drumModel = null;
        if (automationEngine)
            this.automationEngine = automationEngine;
    }
    async loadDrumModel(_url) {
        console.warn("DrumClassifier: TF.js not installed");
    }
    onVisualUpdate(callback) {
        this.visualCallbacks.push(callback);
    }
    async initialize() {
        if (this.context)
            return this.context;
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setTargetAtTime(1, this.context.currentTime, 0.015);
        this.masterGain.connect(this.context.destination);
        this.loop();
        return this.context;
    }
    createAnalyser(trackId) {
        if (!this.context)
            throw new Error('AudioContext not initialized');
        const analyser = this.context.createAnalyser();
        analyser.fftSize = this.fftSize;
        analyser.smoothingTimeConstant = this.smoothingTime;
        const spectrumLength = analyser.frequencyBinCount;
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
    connectClip(trackId, source) {
        if (!this.context || !this.masterGain)
            return;
        const analyser = this.analyserNodes.get(trackId) || this.createAnalyser(trackId);
        source.connect(analyser);
        analyser.connect(this.masterGain);
        this.clipNodes.set(trackId, source);
    }
    applyFX(trackId, fx) {
        const state = this.trackStates.get(trackId);
        if (!state)
            return;
        state.fxChains.push(fx);
        const analyser = this.analyserNodes.get(trackId);
        if (analyser)
            fx.getOutput().connect(analyser);
    }
    async loop() {
        if (!this.context)
            return;
        const now = this.context.currentTime;
        const bpm = transportEngine.state.bpm || 120;
        const secondsPerBeat = 60 / bpm;
        // --- Gather all track onsets first for cross-track alignment ---
        const trackOnsets = new Map();
        for (const [trackId, state] of this.trackStates.entries()) {
            const analyser = this.analyserNodes.get(trackId);
            if (!analyser)
                continue;
            const data = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(data);
            state.spectrum = data;
            state.onsetDetected = state.spectralFlux > 0.002;
            // ML Drum Classification: TF.js stub - not active
            // --- Beat & quantized beat ---
            const bpm = transportEngine.state.bpm || 120;
            const secondsPerBeat = 60 / bpm;
            const minBeatInterval = 0.2;
            if (state.onsetDetected && now - state.lastBeatTime > minBeatInterval) {
                state.lastBeatTime = now;
                state.beatPhase = 0;
                const beatFraction = (now / secondsPerBeat) % 1;
                state.quantizedBeat = Math.round(beatFraction * this.quantization) / this.quantization;
                // MIDI triggers
                midiEngine.state.notes.forEach(() => state.midiTriggered = true);
            }
            else {
                state.beatPhase += (1 / secondsPerBeat) * (this.context.currentTime - now);
                state.beatPhase %= 1;
                state.midiTriggered = false;
            }
            // --- Visual update ---
            const visualData = {
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
        if (this.context && this.context.state !== 'closed')
            this.context.close();
        this.context = null;
    }
}
export const analysisEngine = new AudioEngine();
