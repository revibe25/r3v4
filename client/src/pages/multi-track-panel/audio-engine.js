/**
 * pages/multi-track-panel/audio-engine.ts
 * Minimal Web Audio engine for MultiTrackPanel.
 * Provides: initialize, cleanup, loadAudioFile, generateWaveformData.
 */
export class AudioEngine {
    constructor() {
        this.ctx = null;
    }
    async initialize() {
        try {
            this.ctx = new (window.AudioContext ?? window.webkitAudioContext)();
        }
        catch (err) {
            console.error('[AudioEngine] init failed:', err);
        }
    }
    cleanup() {
        try {
            this.ctx?.close();
        }
        catch { /* ignore */ }
        this.ctx = null;
    }
    async loadAudioFile(file) {
        if (!this.ctx)
            return null;
        try {
            const ab = await file.arrayBuffer();
            return await this.ctx.decodeAudioData(ab);
        }
        catch (err) {
            console.error('[AudioEngine] loadAudioFile failed:', err);
            return null;
        }
    }
    generateWaveformData(buffer, samples = 200) {
        const ch = buffer.getChannelData(0);
        const step = Math.max(1, Math.floor(ch.length / samples));
        const out = [];
        for (let i = 0; i < samples; i++) {
            let peak = 0;
            for (let j = 0; j < step; j++) {
                peak = Math.max(peak, Math.abs(ch[i * step + j] ?? 0));
            }
            out.push(peak);
        }
        return out;
    }
}
