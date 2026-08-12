// FILE: client/src/audio/clips/AudioClipLoader.ts
import { getAudioContextSync } from '../core/audio-context';
// Allowed MIME prefixes for audio data
const VALID_AUDIO_TYPES = ['audio/', 'video/'];
// ─── AudioClipLoader ──────────────────────────────────────────────────────────
export class AudioClipLoader {
    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor(opts = {}) {
        this.cache = new Map();
        /** Tracks last-access time per id for LRU eviction */
        this.lruOrder = new Map();
        /** In-flight decode promises — prevents parallel decodes of the same id */
        this.inflight = new Map();
        this.listeners = {};
        this.context = getAudioContextSync() ?? new (window.AudioContext || window.webkitAudioContext)();
        this.opts = {
            maxCacheSize: opts.maxCacheSize ?? Infinity,
            maxCacheDurationSeconds: opts.maxCacheDurationSeconds ?? Infinity,
            maxRetries: opts.maxRetries ?? 2,
            retryDelayMs: opts.retryDelayMs ?? 500,
        };
    }
    // ─── Public API ──────────────────────────────────────────────────────────────
    /** Load from a File object (drag-and-drop / file picker). */
    async loadFromFile(file) {
        validateMimeType(file.type);
        const id = fileId(file);
        return this.load(id, async () => {
            const data = await file.arrayBuffer();
            return this.decodeAndStore({
                id,
                name: file.name,
                data,
                sizeBytes: file.size,
                mimeType: file.type,
            });
        });
    }
    /** Load from a URL. Supports progress reporting and automatic retries. */
    async loadFromUrl(url, name = urlBasename(url)) {
        return this.load(url, async () => {
            let data;
            for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
                try {
                    data = await this.fetchWithProgress(url);
                    break;
                }
                catch (err) {
                    if (attempt === this.opts.maxRetries)
                        throw err;
                    await delay(this.opts.retryDelayMs * 2 ** attempt);
                }
            }
            return this.decodeAndStore({ id: url, name, data, sizeBytes: data.byteLength });
        });
    }
    /** Load from a raw ArrayBuffer (e.g. received over WebSocket or IPC). */
    async loadFromArrayBuffer(id, name, data, mimeType) {
        return this.load(id, () => this.decodeAndStore({ id, name, data: data.slice(0), sizeBytes: data.byteLength, mimeType }));
    }
    /** Generic load — wraps any source in the dedup + cache check. */
    async loadFromSource(source) {
        switch (source.type) {
            case 'file': return this.loadFromFile(source.file);
            case 'url': return this.loadFromUrl(source.url, source.name);
            case 'arrayBuffer': return this.loadFromArrayBuffer(source.id, source.name, source.data, source.mimeType);
        }
    }
    /** Retrieve a cached clip without triggering a load. */
    get(id) {
        const clip = this.cache.get(id) ?? null;
        if (clip)
            this.touch(id);
        return clip;
    }
    /** All currently cached clips, newest first. */
    getAll() {
        return [...this.cache.values()].sort((a, b) => b.loadedAt - a.loadedAt);
    }
    /** Whether a clip is cached or currently being decoded. */
    has(id) {
        return this.cache.has(id) || this.inflight.has(id);
    }
    /** Evict a specific clip from the cache. */
    evict(id) {
        const had = this.cache.delete(id);
        this.lruOrder.delete(id);
        if (had)
            this.emit('evicted', { id });
        return had;
    }
    /** Remove all cached clips. */
    clear() {
        const ids = [...this.cache.keys()];
        this.cache.clear();
        this.lruOrder.clear();
        ids.forEach((id) => this.emit('evicted', { id }));
    }
    /** Total cached duration across all clips, in seconds. */
    get totalCachedDuration() {
        return [...this.cache.values()].reduce((s, c) => s + c.duration, 0);
    }
    /** Number of clips currently cached. */
    get size() {
        return this.cache.size;
    }
    // ─── Event emitter ────────────────────────────────────────────────────────────
    on(event, listener) {
        if (!this.listeners[event]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
        return this;
    }
    off(event, listener) {
        this.listeners[event]?.delete(listener);
        return this;
    }
    once(event, listener) {
        const wrapper = (payload) => {
            listener(payload);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
    emit(event, payload) {
        this.listeners[event]?.forEach((fn) => fn(payload));
    }
    // ─── Internal ────────────────────────────────────────────────────────────────
    /**
     * Core dedup wrapper.
     * - Returns from cache immediately if the id is already cached.
     * - Returns the in-flight promise if the same id is already being decoded.
     * - Otherwise runs `loader()` and stores the promise until it resolves.
     */
    load(id, loader) {
        // Cache hit
        const cached = this.cache.get(id);
        if (cached) {
            this.touch(id);
            return Promise.resolve(cached);
        }
        // In-flight dedup — multiple callers waiting for the same id
        const existing = this.inflight.get(id);
        if (existing)
            return existing;
        const promise = loader().then((clip) => {
            this.inflight.delete(id);
            return clip;
        }, (err) => {
            this.inflight.delete(id);
            const error = toError(err);
            this.emit('error', { id, error });
            throw error;
        });
        this.inflight.set(id, promise);
        return promise;
    }
    async decodeAndStore(params) {
        const { id, name, data, sizeBytes, mimeType } = params;
        this.emit('progress', { id, downloadProgress: 1, phase: 'decoding' });
        let buffer;
        try {
            // slice(0) so the original ArrayBuffer isn't detached
            buffer = await this.context.decodeAudioData(data.slice(0));
        }
        catch (err) {
            const error = new Error(`Failed to decode audio "${name}": ${toError(err).message}`);
            this.emit('progress', { id, downloadProgress: 1, phase: 'error', error });
            throw error;
        }
        const clip = {
            id,
            name: sanitizeName(name),
            buffer,
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
            sampleRate: buffer.sampleRate,
            sizeBytes,
            mimeType,
            loadedAt: Date.now(),
        };
        this.cache.set(id, clip);
        this.touch(id);
        this.enforceQuotas();
        this.emit('progress', { id, downloadProgress: 1, phase: 'done' });
        this.emit('loaded', { clip });
        return clip;
    }
    /** Fetch a URL and report download progress events. */
    async fetchWithProgress(url) {
        const id = url;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
        }
        const contentLength = Number(res.headers.get('content-length') ?? 0);
        const reader = res.body?.getReader();
        // If streaming isn't available, fall back to a single read
        if (!reader || contentLength === 0) {
            this.emit('progress', { id, downloadProgress: 0.5, phase: 'downloading' });
            const data = await res.arrayBuffer();
            this.emit('progress', { id, downloadProgress: 1, phase: 'downloading' });
            return data;
        }
        const chunks = [];
        let received = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            chunks.push(value);
            received += value.byteLength;
            this.emit('progress', {
                id,
                downloadProgress: contentLength ? received / contentLength : 0,
                phase: 'downloading',
            });
        }
        // Combine chunks into one ArrayBuffer
        const merged = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return merged.buffer;
    }
    /** Update LRU timestamp for a cache entry. */
    touch(id) {
        this.lruOrder.set(id, Date.now());
    }
    /**
     * Evict least-recently-used clips until we're within both quotas
     * (maxCacheSize and maxCacheDurationSeconds).
     */
    enforceQuotas() {
        const byLru = [...this.lruOrder.entries()].sort((a, b) => a[1] - b[1]);
        while (this.cache.size > this.opts.maxCacheSize ||
            this.totalCachedDuration > this.opts.maxCacheDurationSeconds) {
            const oldest = byLru.shift();
            if (!oldest)
                break;
            this.evict(oldest[0]);
        }
    }
}
// ─── Utilities ────────────────────────────────────────────────────────────────
function fileId(file) {
    return `file__${file.name}__${file.size}__${file.lastModified}`;
}
function urlBasename(url) {
    try {
        const pathname = new URL(url).pathname;
        return decodeURIComponent(pathname.split('/').pop() ?? url);
    }
    catch {
        return url;
    }
}
function sanitizeName(name) {
    // Strip query strings and fragments that sneak in from URL-derived names
    return name.split('?')[0].split('#')[0];
}
function validateMimeType(type) {
    if (!type)
        return; // browser didn't report a type — allow it through
    const ok = VALID_AUDIO_TYPES.some((prefix) => type.startsWith(prefix));
    if (!ok) {
        throw new Error(`Unsupported file type "${type}". Expected an audio file.`);
    }
}
function toError(value) {
    return value instanceof Error ? value : new Error(String(value));
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ─── Singleton ────────────────────────────────────────────────────────────────
export const audioClipLoader = new AudioClipLoader();
