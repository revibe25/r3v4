import { VSTFXNode } from './vst-fx-node';
import { getAudioContext } from '../core/audio-context';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted)
            return reject(new DOMException('Aborted', 'AbortError'));
        const id = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(id);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}
/** Derive a stable registry id from the URL + worklet name combo */
function makeId(vstUrl, workletName) {
    return workletName ? `${vstUrl}#${workletName}` : vstUrl;
}
// ─── VSTLoader ────────────────────────────────────────────────────────────────
/**
 * Manages loading, caching, and lifecycle of VSTFXNode instances.
 *
 * @example
 * const loader = new VSTLoader();
 *
 * const node = await loader.load('/plugins/reverb.js', { workletName: 'reverb-processor' });
 *
 * // Same URL returns cached node — no double-load
 * const same = await loader.load('/plugins/reverb.js');
 *
 * loader.on('ready', ({ entry }) => console.log('Loaded:', entry.id));
 *
 * loader.dispose(); // tears down all loaded nodes
 */
export class VSTLoader {
    constructor() {
        this.registry = new Map();
        /** In-flight load promises — prevents parallel loads of the same URL */
        this.inFlight = new Map();
        this._disposed = false;
        this.listeners = {};
    }
    // ─── Load ──────────────────────────────────────────────────────────────────
    /**
     * Load a VST plugin by URL. Returns a cached node on subsequent calls
     * with the same URL + workletName combination.
     */
    async load(vstUrl, options = {}) {
        this.assertNotDisposed();
        const { audioContext, workletName, config, retries = 2, retryDelay = 500, signal, } = options;
        const id = makeId(vstUrl, workletName);
        // ── Return cached entry if already ready ──
        const existing = this.registry.get(id);
        if (existing?.status === 'ready')
            return existing.node;
        // ── Coalesce parallel requests for the same plugin ──
        const inFlight = this.inFlight.get(id);
        if (inFlight)
            return inFlight;
        // ── New load ──
        const promise = this.loadWithRetry(id, vstUrl, {
            audioContext,
            workletName,
            config,
            retries,
            retryDelay,
            signal,
        });
        this.inFlight.set(id, promise);
        try {
            const node = await promise;
            return node;
        }
        finally {
            this.inFlight.delete(id);
        }
    }
    async loadWithRetry(id, vstUrl, opts) {
        const { retries, retryDelay, signal } = opts;
        const maxAttempts = Math.max(1, retries);
        // Register as pending
        this.registry.set(id, {
            id, vstUrl, status: 'pending',
            node: undefined, // filled on success
            loadedAt: 0,
        });
        this.emit('loading', { id, vstUrl });
        let lastError = new Error('Unknown error');
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            signal?.throwIfAborted?.();
            try {
                const ctx = opts.audioContext ?? getAudioContext();
                const node = new VSTFXNode(ctx, {
                    vstUrl,
                    workletName: opts.workletName,
                    ...opts.config,
                });
                // Update registry to 'loading' while initialize() runs
                this.registry.set(id, { ...this.registry.get(id), status: 'loading', node });
                await node.initialize();
                signal?.throwIfAborted?.();
                const entry = {
                    id, vstUrl, node,
                    status: 'ready',
                    loadedAt: Date.now(),
                };
                this.registry.set(id, entry);
                this.emit('ready', { entry });
                return node;
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                // Don't retry on abort
                if (lastError.name === 'AbortError')
                    break;
                if (attempt < maxAttempts) {
                    this.emit('retrying', { id, attempt, maxAttempts });
                    await sleep(retryDelay, signal);
                }
            }
        }
        this.registry.set(id, {
            ...this.registry.get(id),
            status: 'error',
            error: lastError,
        });
        this.emit('error', { id, vstUrl, error: lastError });
        throw lastError;
    }
    // ─── Registry access ──────────────────────────────────────────────────────
    /** Look up a loaded node without triggering a load. Returns undefined if not found. */
    get(vstUrl, workletName) {
        return this.registry.get(makeId(vstUrl, workletName))?.node;
    }
    /** Full registry entry including status and timestamps. */
    getEntry(vstUrl, workletName) {
        return this.registry.get(makeId(vstUrl, workletName));
    }
    /** All currently registered entries. */
    get entries() {
        return [...this.registry.values()];
    }
    /** Entries filtered by status. */
    getByStatus(status) {
        return this.entries.filter((e) => e.status === status);
    }
    // ─── Eviction ─────────────────────────────────────────────────────────────
    /**
     * Dispose a single plugin and remove it from the registry.
     * Safe to call if the entry doesn't exist.
     */
    evict(vstUrl, workletName) {
        const id = makeId(vstUrl, workletName);
        const entry = this.registry.get(id);
        if (!entry)
            return false;
        try {
            entry.node?.dispose?.();
        }
        catch { /* ok */ }
        this.registry.delete(id);
        this.emit('evicted', { id });
        return true;
    }
    /**
     * Evict all plugins that failed to load, freeing their entries.
     */
    evictErrors() {
        for (const entry of this.entries) {
            if (entry.status === 'error')
                this.evict(entry.vstUrl);
        }
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────
    /** Dispose all loaded plugins and clear the registry. */
    dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        for (const entry of this.registry.values()) {
            try {
                entry.node?.dispose?.();
            }
            catch { /* ok */ }
        }
        this.registry.clear();
        this.inFlight.clear();
        this.listeners = {};
    }
    toJSON() {
        return {
            disposed: this._disposed,
            entries: this.entries.map(({ id, vstUrl, status, loadedAt, error }) => ({
                id, vstUrl, status, loadedAt, error: error?.message,
            })),
        };
    }
    // ─── Event emitter ────────────────────────────────────────────────────────
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
    // ─── Private helpers ──────────────────────────────────────────────────────
    assertNotDisposed() {
        if (this._disposed)
            throw new Error('[VSTLoader] Instance has been disposed.');
    }
}
// ─── Singleton ────────────────────────────────────────────────────────────────
let _sharedLoader = null;
/**
 * Shared VSTLoader singleton — use this unless you need an isolated instance
 * (e.g. in tests or for a separate plugin sandbox).
 */
export function getVSTLoader() {
    if (!_sharedLoader || _sharedLoader._disposed) {
        _sharedLoader = new VSTLoader();
    }
    return _sharedLoader;
}
export async function loadVSTPlugin(vstUrlOrCtx, optionsOrUrl, workletName, config) {
    // ── New signature: (vstUrl, options?) ──
    if (typeof vstUrlOrCtx === 'string') {
        return getVSTLoader().load(vstUrlOrCtx, optionsOrUrl);
    }
    // ── Legacy signature: (audioContext, vstUrl, workletName?, config?) ──
    const vstUrl = optionsOrUrl;
    return getVSTLoader().load(vstUrl, {
        audioContext: vstUrlOrCtx,
        workletName,
        config,
    });
}
export { VSTFXNode };
