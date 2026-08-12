// CRIT-4: Never instantiate AudioContext at module level — it is a browser-only
// global and will throw in SSR, Vitest (jsdom), or any Node import path.
// Use the lazy singleton below; call getAudioEngine() only after mount.
export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.rafHandle = null;
    }
    get context() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
        }
        return this.ctx;
    }
    start() {
        if (this.ctx?.state === 'suspended') {
            void this.ctx.resume();
        }
    }
    stop() {
        if (this.rafHandle !== null) {
            cancelAnimationFrame(this.rafHandle);
            this.rafHandle = null;
        }
    }
    async destroy() {
        this.stop();
        await this.ctx?.close();
        this.ctx = null;
    }
}
// Lazy singleton — module-level variable only holds null until first call
let _instance = null;
export function getAudioEngine() {
    if (!_instance)
        _instance = new AudioEngine();
    return _instance;
}
