/**
 * server/lib/engine-stubs.ts
 *
 * Temporary stub implementations of MixerEngine and DJEngine.
 * These replace the real @r3/llpte-core classes until the LLPTE monorepo
 * packages produce a runnable engine.
 *
 * SINGLE CANONICAL LOCATION. Do not redeclare these classes anywhere else.
 *
 * Swap path when @r3/llpte-core is ready:
 *   1. Delete this file.
 *   2. Update the import in server/trpc.ts to the real package.
 *   3. No other file needs to change.
 */
export class MixerEngine {
    constructor(_config) { }
    getState() {
        return {
            channels: new Map(),
            buses: new Map(),
            masterFader: 0,
            soloExclusive: true,
        };
    }
    dispatch(_action) {
        return { ok: true };
    }
}
export class DJEngine {
    constructor(_config) { }
    getSession() {
        return {};
    }
    dispatch(_action) {
        return { ok: true };
    }
}
// ── Singleton instances ───────────────────────────────────────────────────────
// Injected into TRPCContext via createContext() in server/trpc.ts.
const EMPTY_MIXER_STATE = {
    channels: new Map(),
    buses: new Map(),
    masterFader: 0,
    soloExclusive: true,
};
const DEFAULT_DJ_SESSION = {
    decks: {
        A: { id: 'A', trackId: null, position: 0, bpm: 120, pitch: 0, playbackRate: 1,
            isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
            cuePoints: [], beatGrid: null, waveformData: null },
        B: { id: 'B', trackId: null, position: 0, bpm: 120, pitch: 0, playbackRate: 1,
            isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
            cuePoints: [], beatGrid: null, waveformData: null },
        C: { id: 'C', trackId: null, position: 0, bpm: 120, pitch: 0, playbackRate: 1,
            isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
            cuePoints: [], beatGrid: null, waveformData: null },
        D: { id: 'D', trackId: null, position: 0, bpm: 120, pitch: 0, playbackRate: 1,
            isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
            cuePoints: [], beatGrid: null, waveformData: null },
    },
    crossfader: 0,
    masterBpm: 120,
    syncEnabled: false,
    tempoRange: 0.10,
};
export const mixerEngine = new MixerEngine(EMPTY_MIXER_STATE);
export const djEngine = new DJEngine(DEFAULT_DJ_SESSION);
