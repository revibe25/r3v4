import { AutomationCurve } from '@/types/audio';
export class VSTAutomationEngine {
    createLane(id, paramPath) {
        const lane = { id, points: [], enabled: true, paramPath };
        this.lanes.set(id, lane);
        return lane;
    }
    removeLane(id) { this.lanes.delete(id); }
    getLane(id) { return this.lanes.get(id); }
    getAllLanes() { return Array.from(this.lanes.values()); }
    clearLane(id) { const l = this.lanes.get(id); if (l)
        l.points = []; }
    clearAll() { this.lanes.forEach((_, id) => this.clearLane(id)); }
    setCurrentTime(t) { this.currentTime = t; }
    getValueAtTime(_laneId, _t) { return 0; }
    constructor(audioContext) {
        // ── AutomationEngine interface implementation ──────────────
        this.lanes = new Map();
        this.currentTime = 0;
        this.automationLanes = new Map();
        this.lfos = new Map();
        this.envelopes = new Map();
        this.playbackPosition = 0;
        this.isPlaying = false;
        this.audioContext = audioContext;
    }
    createAutomationLane(id, paramId, points) {
        const lane = new AutomationLaneImpl(id, paramId, points, this.audioContext);
        this.automationLanes.set(id, lane);
    }
    createLFO(id, paramId, config) {
        const lfo = new LFO(id, paramId, config, this.audioContext);
        this.lfos.set(id, lfo);
    }
    createEnvelope(id, paramId, config) {
        const envelope = new Envelope(id, paramId, config, this.audioContext);
        this.envelopes.set(id, envelope);
    }
    getAutomationValue(paramId, time) {
        let value = 0;
        let hasAutomation = false;
        this.automationLanes.forEach(lane => {
            if (lane.paramId === paramId && lane.enabled) {
                value = lane.getValueAtTime(time);
                hasAutomation = true;
            }
        });
        this.lfos.forEach(lfo => {
            if (lfo.paramId === paramId && lfo.enabled) {
                const lfoValue = lfo.getValueAtTime(time);
                value = hasAutomation ? value + lfoValue * lfo.config.depth : lfoValue;
                hasAutomation = true;
            }
        });
        return hasAutomation ? Math.max(0, Math.min(1, value)) : value;
    }
    triggerEnvelope(id) { this.envelopes.get(id)?.trigger(); }
    releaseEnvelope(id) { this.envelopes.get(id)?.release(); }
    start() {
        this.isPlaying = true;
        this.playbackPosition = this.audioContext.currentTime;
    }
    stop() { this.isPlaying = false; }
    pause() { this.isPlaying = false; }
    update() {
        if (this.isPlaying)
            this.playbackPosition = this.audioContext.currentTime;
    }
    dispose() {
        this.automationLanes.clear();
        this.lfos.forEach(lfo => lfo.dispose());
        this.lfos.clear();
        this.envelopes.clear();
    }
}
// ── Internal implementation classes ───────────────────────────
class AutomationLaneImpl {
    constructor(id, paramId, points, audioContext) {
        this.enabled = true;
        this.id = id;
        this.paramId = paramId;
        this.points = [...points].sort((a, b) => a.time - b.time);
        this.audioContext = audioContext;
    }
    getValueAtTime(time) {
        if (this.points.length === 0)
            return 0;
        if (time <= this.points[0].time)
            return this.points[0].value;
        if (time >= this.points[this.points.length - 1].time)
            return this.points[this.points.length - 1].value;
        let i = 0;
        while (i < this.points.length - 1 && this.points[i + 1].time <= time)
            i++;
        const p1 = this.points[i];
        const p2 = this.points[i + 1];
        if (!p2)
            return p1.value;
        const t = (time - p1.time) / (p2.time - p1.time);
        return this.interpolate(p1.value, p2.value, t, p1.curve);
    }
    interpolate(v1, v2, t, curve) {
        switch (curve) {
            case AutomationCurve.EXPONENTIAL:
                return v1 * Math.pow(v2 / v1, t);
            case AutomationCurve.LOGARITHMIC:
                return v1 + (v2 - v1) * Math.log(1 + t * (Math.E - 1)) / Math.log(Math.E);
            case AutomationCurve.SMOOTH: {
                const s = t * t * (3 - 2 * t);
                return v1 + (v2 - v1) * s;
            }
            case AutomationCurve.STEP:
                return t < 0.5 ? v1 : v2;
            case AutomationCurve.LINEAR:
            default:
                return v1 + (v2 - v1) * t;
        }
    }
    addPoint(point) {
        this.points.push(point);
        this.points.sort((a, b) => a.time - b.time);
    }
    removePoint(time) { this.points = this.points.filter(p => p.time !== time); }
    updatePoint(time, value) {
        const p = this.points.find(p => p.time === time);
        if (p)
            p.value = value;
    }
}
class LFO {
    constructor(id, paramId, config, audioContext) {
        this.enabled = true;
        this.oscillator = null;
        this.gainNode = null;
        this.id = id;
        this.paramId = paramId;
        this.config = config;
        this.audioContext = audioContext;
        this.createOscillator();
    }
    createOscillator() {
        this.oscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        this.oscillator.type = this.config.waveform;
        this.oscillator.frequency.value = this.config.frequency;
        this.gainNode.gain.setTargetAtTime(this.config.depth, this.audioContext.currentTime, 0.015);
        this.oscillator.connect(this.gainNode);
        this.oscillator.start();
    }
    getValueAtTime(time) {
        const phase = (time * this.config.frequency + this.config.phase) % 1;
        switch (this.config.waveform) {
            case 'sine': return Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
            case 'triangle': return phase < 0.5 ? phase * 2 : 2 - phase * 2;
            case 'square': return phase < 0.5 ? 0 : 1;
            case 'saw': return phase;
            case 'random': return Math.random();
            default: return 0.5;
        }
    }
    updateConfig(config) {
        Object.assign(this.config, config);
        if (this.oscillator && config.frequency !== undefined)
            this.oscillator.frequency.setValueAtTime(config.frequency, this.audioContext.currentTime);
        if (this.gainNode && config.depth !== undefined)
            this.gainNode.gain.setValueAtTime(config.depth, this.audioContext.currentTime);
    }
    dispose() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
    }
}
class Envelope {
    constructor(id, paramId, config, audioContext) {
        this.stage = 'idle';
        this.startTime = 0;
        this.releaseStartTime = 0;
        this.id = id;
        this.paramId = paramId;
        this.config = config;
        this.audioContext = audioContext;
    }
    trigger() {
        this.startTime = this.audioContext.currentTime;
        this.stage = 'attack';
    }
    release() {
        this.releaseStartTime = this.audioContext.currentTime;
        this.stage = 'release';
    }
    getValueAtTime(time) {
        if (this.stage === 'idle')
            return 0;
        const elapsed = time - this.startTime;
        if (this.stage === 'attack') {
            if (elapsed < this.config.attack)
                return elapsed / this.config.attack;
            this.stage = 'decay';
        }
        if (this.stage === 'decay') {
            const decayElapsed = elapsed - this.config.attack;
            if (decayElapsed < this.config.decay) {
                return 1 - (1 - this.config.sustain) * (decayElapsed / this.config.decay);
            }
            this.stage = 'sustain';
        }
        if (this.stage === 'sustain')
            return this.config.sustain;
        if (this.stage === 'release') {
            const releaseElapsed = time - this.releaseStartTime;
            if (releaseElapsed < this.config.release) {
                return this.config.sustain * (1 - releaseElapsed / this.config.release);
            }
            this.stage = 'idle';
            return 0;
        }
        return 0;
    }
}
