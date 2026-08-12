// client/src/audio/engine/AudioEngine.ts
import { VisualIntelligenceLayer } from './VIL';
export class AudioEngine {
    constructor() {
        this.Tone = null;
        this.started = false;
        this.workletNode = null;
        this.vil = new VisualIntelligenceLayer();
    }
    async init() {
        if (this.started)
            return;
        this.Tone = await import('tone');
        const ctx = new this.Tone.Context({
            latencyHint: 'interactive',
        });
        this.Tone.setContext(ctx);
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        await this.Tone.start();
        const audioCtx = ctx.rawContext;
        // 🔥 LOAD WORKLET
        await audioCtx.audioWorklet.addModule('/src/audio/engine/worklet/processor.ts');
        // 🔊 CREATE WORKLET NODE
        this.workletNode = new AudioWorkletNode(audioCtx, 'llpte-processor');
        // 🎛 TEST SOURCE (replace later)
        const osc = new this.Tone.Oscillator(220, 'sawtooth').start();
        osc.connect(this.workletNode);
        this.workletNode.connect(audioCtx.destination);
        // 📡 RECEIVE ANALYSIS → VIL
        this.workletNode.port.onmessage = (e) => {
            if (e.data?.type === 'analysis') {
                this.vil.emit(e.data);
            }
        };
        this.started = true;
    }
    getVIL() {
        return this.vil;
    }
}
