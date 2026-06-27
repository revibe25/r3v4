// ─────────────────────────────────────────────────────────────
// packages/llpte-signal/src/analyzers/TrackAnalyzer.ts
//
// Real-time per-track signal analysis using Web Audio AnalyserNode.
// Produces TrackSignalSnapshot each frame for AutoLevelEngine.
// Also exports constants consumed by AutoLevelEngine.
// ─────────────────────────────────────────────────────────────
import { AUTO_LEVEL_CONSTANTS } from '@shared/auto-level.types';
// ── Re-exported constants (consumed by AutoLevelEngine) ──────
export const LUFS_TARGET = AUTO_LEVEL_CONSTANTS.TARGET_LUFS;
export const CLIPPING_THRESHOLD_DBFS = AUTO_LEVEL_CONSTANTS.CLIPPING_THRESHOLD_DBTP;
export function linearTodBFS(linear) {
    if (linear <= 0)
        return -Infinity;
    return 20 * Math.log10(linear);
}
export function dBFSToLinear(db) {
    return Math.pow(10, db / 20);
}
export class TrackAnalyzer {
    constructor(config) {
        this.id = config.trackId;
        this.analyserNode = config.analyserNode;
        this.timeDomainBuffer = new Float32Array(this.analyserNode.fftSize);
    }
    capture(timestamp) {
        this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);
        let sumSq = 0;
        let peak = 0;
        for (let i = 0; i < this.timeDomainBuffer.length; i++) {
            const s = this.timeDomainBuffer[i];
            sumSq += s * s;
            const abs = Math.abs(s);
            if (abs > peak)
                peak = abs;
        }
        const rms = Math.sqrt(sumSq / this.timeDomainBuffer.length);
        const truePeak = linearTodBFS(peak);
        // ITU-R BS.1770-4 short-term approximation (3-s window not available
        // per-frame; use instantaneous RMS-weighted LUFS as proxy).
        const shortTermLufs = -0.691 + 10 * Math.log10(Math.max(rms * rms, 1e-12)) - 10;
        const spectrumBuf = new Float32Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getFloatFrequencyData(spectrumBuf);
        return {
            trackId: this.id,
            timestamp,
            rms,
            truePeak,
            shortTermLufs,
            integratedLufs: shortTermLufs, // full-session gate not computed here
            spectrum: spectrumBuf,
            clipping: peak >= 1.0,
            gateOpen: rms > dBFSToLinear(AUTO_LEVEL_CONSTANTS.GATE_THRESHOLD_LUFS),
        };
    }
    dispose() { }
}
// ── MixAnalyzer ───────────────────────────────────────────────
export class MixAnalyzer {
    constructor(config) {
        this.tracks = new Map();
        this.frameId = 0;
        this.masterAnalyser = config.masterAnalyser;
    }
    registerTrack(analyzer) {
        this.tracks.set(analyzer.id, analyzer);
    }
    unregisterTrack(trackId) {
        this.tracks.delete(trackId);
    }
    captureFrame() {
        const timestamp = performance.now();
        const tracks = new Map();
        for (const [id, analyzer] of this.tracks) {
            tracks.set(id, analyzer.capture(timestamp));
        }
        // Master bus RMS
        const masterBuf = new Float32Array(this.masterAnalyser.fftSize);
        this.masterAnalyser.getFloatTimeDomainData(masterBuf);
        let sumSq = 0;
        for (const s of masterBuf)
            sumSq += s * s;
        const masterRMS = Math.sqrt(sumSq / masterBuf.length);
        const masterLUFS = -0.691 + 10 * Math.log10(Math.max(masterRMS * masterRMS, 1e-12)) - 10;
        return {
            frameId: this.frameId++,
            timestamp,
            tracks,
            masterRMS,
            masterLUFS,
        };
    }
    dispose() {
        this.tracks.clear();
    }
}
