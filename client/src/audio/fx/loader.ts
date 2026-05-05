// @ts-nocheck
// FILE: client/src/audio/fx/loader.ts
import type { VSTFXConfig } from './vst-fx-node';
import { VSTFXNode } from './vst-fx-node';
import { getAudioContext } from '../core/audio-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VSTLoadOptions {
  /** AudioContext to use — falls back to the shared singleton */
  audioContext?: AudioContext;
  /** Name of the AudioWorklet processor registered by the plugin */
  workletName?: string;
  /** Extra config forwarded to VSTFXNode */
  config?: Omit<VSTFXConfig, 'vstUrl' | 'workletName'>;
  /**
   * Number of load attempts before throwing (default: 2).
   * Useful for transient network errors on remote VST bundles.
   */
  retries?: number;
  /** Ms to wait between retry attempts (default: 500) */
  retryDelay?: number;
  /** AbortSignal — reject immediately if aborted before/during load */
  signal?: AbortSignal;
}

export type VSTLoadStatus =
  | 'pending'
  | 'loading'
  | 'ready'
  | 'error'
  | 'disposed';

export interface VSTRegistryEntry {
  id:        string;
  vstUrl:    string;
  node:      VSTFXNode;
  status:    VSTLoadStatus;
  loadedAt:  number;
  error?:    Error;
}

export type VSTLoaderEventMap = {
  /** A plugin started loading */
  loading:  { id: string; vstUrl: string };
  /** A plugin finished loading successfully */
  ready:    { entry: VSTRegistryEntry };
  /** A plugin load failed after all retries */
  error:    { id: string; vstUrl: string; error: Error };
  /** A plugin was evicted from the registry */
  evicted:  { id: string };
  /** A retry is being attempted */
  retrying: { id: string; attempt: number; maxAttempts: number };
};

type Listener<K extends keyof VSTLoaderEventMap> = (
  payload: VSTLoaderEventMap[K],
) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** Derive a stable registry id from the URL + worklet name combo */
function makeId(vstUrl: string, workletName?: string): string {
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
  private registry = new Map<string, VSTRegistryEntry>();

  /** In-flight load promises — prevents parallel loads of the same URL */
  private inFlight = new Map<string, Promise<VSTFXNode>>();

  private _disposed = false;

  private listeners: {
    [K in keyof VSTLoaderEventMap]?: Set<Listener<K>>;
  } = {};

  // ─── Load ──────────────────────────────────────────────────────────────────

  /**
   * Load a VST plugin by URL. Returns a cached node on subsequent calls
   * with the same URL + workletName combination.
   */
  async load(vstUrl: string, options: VSTLoadOptions = {}): Promise<VSTFXNode> {
    this.assertNotDisposed();

    const {
      audioContext,
      workletName,
      config,
      retries    = 2,
      retryDelay = 500,
      signal,
    } = options;

    const id = makeId(vstUrl, workletName);

    // ── Return cached entry if already ready ──
    const existing = this.registry.get(id);
    if (existing?.status === 'ready') return existing.node;

    // ── Coalesce parallel requests for the same plugin ──
    const inFlight = this.inFlight.get(id);
    if (inFlight) return inFlight;

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
    } finally {
      this.inFlight.delete(id);
    }
  }

  private async loadWithRetry(
    id: string,
    vstUrl: string,
    opts: Required<Omit<VSTLoadOptions, 'audioContext'>> & { audioContext?: AudioContext },
  ): Promise<VSTFXNode> {
    const { retries, retryDelay, signal } = opts;
    const maxAttempts = Math.max(1, retries);

    // Register as pending
    this.registry.set(id, {
      id, vstUrl, status: 'pending',
      node: undefined as unknown as VSTFXNode, // filled on success
      loadedAt: 0,
    });

    this.emit('loading', { id, vstUrl });

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      signal?.throwIfAborted?.();

      try {
        const ctx  = opts.audioContext ?? getAudioContext();
        const node = new VSTFXNode(ctx, {
          vstUrl,
          workletName: opts.workletName,
          ...opts.config,
        });

        // Update registry to 'loading' while initialize() runs
        this.registry.set(id, { ...this.registry.get(id)!, status: 'loading', node });

        await node.initialize();

        signal?.throwIfAborted?.();

        const entry: VSTRegistryEntry = {
          id, vstUrl, node,
          status:   'ready',
          loadedAt: Date.now(),
        };

        this.registry.set(id, entry);
        this.emit('ready', { entry });

        return node;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on abort
        if (lastError.name === 'AbortError') break;

        if (attempt < maxAttempts) {
          this.emit('retrying', { id, attempt, maxAttempts });
          await sleep(retryDelay, signal);
        }
      }
    }

    this.registry.set(id, {
      ...this.registry.get(id)!,
      status: 'error',
      error:  lastError,
    });

    this.emit('error', { id, vstUrl, error: lastError });
    throw lastError;
  }

  // ─── Registry access ──────────────────────────────────────────────────────

  /** Look up a loaded node without triggering a load. Returns undefined if not found. */
  get(vstUrl: string, workletName?: string): VSTFXNode | undefined {
    return this.registry.get(makeId(vstUrl, workletName))?.node;
  }

  /** Full registry entry including status and timestamps. */
  getEntry(vstUrl: string, workletName?: string): VSTRegistryEntry | undefined {
    return this.registry.get(makeId(vstUrl, workletName));
  }

  /** All currently registered entries. */
  get entries(): VSTRegistryEntry[] {
    return [...this.registry.values()];
  }

  /** Entries filtered by status. */
  getByStatus(status: VSTLoadStatus): VSTRegistryEntry[] {
    return this.entries.filter((e) => e.status === status);
  }

  // ─── Eviction ─────────────────────────────────────────────────────────────

  /**
   * Dispose a single plugin and remove it from the registry.
   * Safe to call if the entry doesn't exist.
   */
  evict(vstUrl: string, workletName?: string): boolean {
    const id    = makeId(vstUrl, workletName);
    const entry = this.registry.get(id);
    if (!entry) return false;

    try { entry.node?.dispose?.(); } catch { /* ok */ }
    this.registry.delete(id);
    this.emit('evicted', { id });
    return true;
  }

  /**
   * Evict all plugins that failed to load, freeing their entries.
   */
  evictErrors(): void {
    for (const entry of this.entries) {
      if (entry.status === 'error') this.evict(entry.vstUrl);
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /** Dispose all loaded plugins and clear the registry. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    for (const entry of this.registry.values()) {
      try { entry.node?.dispose?.(); } catch { /* ok */ }
    }

    this.registry.clear();
    this.inFlight.clear();
    this.listeners = {};
  }

  toJSON() {
    return {
      disposed: this._disposed,
      entries:  this.entries.map(({ id, vstUrl, status, loadedAt, error }) => ({
        id, vstUrl, status, loadedAt, error: error?.message,
      })),
    };
  }

  // ─── Event emitter ────────────────────────────────────────────────────────

  on<K extends keyof VSTLoaderEventMap>(event: K, listener: Listener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return this;
  }

  off<K extends keyof VSTLoaderEventMap>(event: K, listener: Listener<K>): this {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof VSTLoaderEventMap>(event: K, listener: Listener<K>): this {
    const wrapper: Listener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof VSTLoaderEventMap>(
    event: K,
    payload: VSTLoaderEventMap[K],
  ): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) =>
      fn(payload),
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertNotDisposed(): void {
    if (this._disposed) throw new Error('[VSTLoader] Instance has been disposed.');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _sharedLoader: VSTLoader | null = null;

/**
 * Shared VSTLoader singleton — use this unless you need an isolated instance
 * (e.g. in tests or for a separate plugin sandbox).
 */
export function getVSTLoader(): VSTLoader {
  if (!_sharedLoader || (_sharedLoader as unknown as { _disposed: boolean })._disposed) {
    _sharedLoader = new VSTLoader();
  }
  return _sharedLoader;
}

// ─── Convenience function (backwards-compatible) ──────────────────────────────

/**
 * Load a single VST plugin via the shared loader.
 * Identical to `getVSTLoader().load(vstUrl, options)`.
 *
 * @example
 * const node = await loadVSTPlugin('/plugins/chorus.js', {
 *   workletName: 'chorus-processor',
 *   retries: 3,
 * });
 */
export async function loadVSTPlugin(
  vstUrl: string,
  options?: VSTLoadOptions,
): Promise<VSTFXNode>;

/**
 * @deprecated Pass an options object instead of positional arguments.
 */
export async function loadVSTPlugin(
  audioContext: AudioContext,
  vstUrl: string,
  workletName?: string,
  config?: Record<string, unknown>,
): Promise<VSTFXNode>;

export async function loadVSTPlugin(
  vstUrlOrCtx: string | AudioContext,
  optionsOrUrl?: VSTLoadOptions | string,
  workletName?: string,
  config?: Record<string, unknown>,
): Promise<VSTFXNode> {
  // ── New signature: (vstUrl, options?) ──
  if (typeof vstUrlOrCtx === 'string') {
    return getVSTLoader().load(vstUrlOrCtx, optionsOrUrl as VSTLoadOptions | undefined);
  }

  // ── Legacy signature: (audioContext, vstUrl, workletName?, config?) ──
  const vstUrl = optionsOrUrl as string;
  return getVSTLoader().load(vstUrl, {
    audioContext: vstUrlOrCtx,
    workletName,
    config,
  });
}

export { VSTFXNode };