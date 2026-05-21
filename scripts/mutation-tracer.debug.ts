/**
 * Mutation Tracer — Frontend mutation recording and replay system
 * 
 * Environment Guard:
 * - Activates ONLY if __DEV__ === true (Vite define plugin)
 * - Fallback: localhost check if __DEV__ not available
 * - Not removable by user code
 * 
 * Scope:
 * - Read-only observer; never modifies requests/responses
 * - tRPC httpLink middleware only (not global fetch)
 * - Safe/forbidden field filtering applied
 * 
 * @module client/src/debug/mutation-tracer.debug.ts
 */

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT GUARD
// ─────────────────────────────────────────────────────────────────────────

declare const __DEV__: boolean;

function isDevEnvironment(): boolean {
  try {
    if (typeof __DEV__ !== 'undefined') {
      return __DEV__;
    }
  } catch {
    // __DEV__ not defined; fall through to fallback
  }

  // Fallback: check localhost
  try {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface Mutation {
  id: string;
  timestamp: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  baseline: unknown;
  deviation: string;
  source: 'trpc' | 'internal';
}

export interface Timeline {
  mutations: Mutation[];
  baselineValues: Record<string, unknown>;
  createdAt: number;
  mutationCount: number;
}

export interface TraceSession {
  timeline: Timeline;
  isRecording: boolean;
  lastMutationId: string;
}

// ─────────────────────────────────────────────────────────────────────────
// SAFE/FORBIDDEN FIELD LISTS
// ─────────────────────────────────────────────────────────────────────────

const SAFE_FIELDS = new Set([
  'token',
  'tier',
  'projectId',
  'projectName',
  'userId',
  'email',
  'displayName',
  'role',
]);

const FORBIDDEN_FIELDS = new Set([
  'activeTrack',
  'systemPrompt',
  'apiKey',
  'password',
  'secret',
  'privateKey',
  'refreshToken',
  'sessionToken',
]);

function isSafeField(fieldName: string): boolean {
  // Explicitly safe
  if (SAFE_FIELDS.has(fieldName)) {
    return true;
  }

  // Explicitly forbidden
  if (FORBIDDEN_FIELDS.has(fieldName)) {
    return false;
  }

  // Default: forbid unknown fields (whitelist model)
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// MUTATION TRACER CLASS
// ─────────────────────────────────────────────────────────────────────────

class MutationTracer {
  private session: TraceSession;
  private maxMutations = 500;
  private mutationCounter = 0;

  constructor() {
    this.session = {
      timeline: {
        mutations: [],
        baselineValues: {},
        createdAt: Date.now(),
        mutationCount: 0,
      },
      isRecording: true,
      lastMutationId: '',
    };
  }

  /**
   * Record a mutation from tRPC middleware
   * Used internally by trpc-tracer.debug.ts
   */
  recordMutation(
    field: string,
    oldValue: unknown,
    newValue: unknown,
    source: 'trpc' | 'internal' = 'trpc'
  ): void {
    if (!this.session.isRecording) {
      return;
    }

    // Field filtering: only safe fields
    if (!isSafeField(field)) {
      return;
    }

    try {
      // Establish baseline on first mutation for this field
      if (!(field in this.session.timeline.baselineValues)) {
        this.session.timeline.baselineValues[field] = oldValue;
      }

      const baseline = this.session.timeline.baselineValues[field];

      // Detect deviation: is newValue different from baseline?
      const isDeviation = !this.deepEqual(newValue, baseline);

      if (!isDeviation) {
        return; // No deviation, don't record
      }

      // Generate deviation description
      const deviation = this.describeDeviation(baseline, newValue, field);

      // Create mutation record
      const mutation: Mutation = {
        id: `mut_${Date.now()}_${++this.mutationCounter}`,
        timestamp: Date.now(),
        field,
        oldValue,
        newValue,
        baseline,
        deviation,
        source,
      };

      // Add to timeline
      this.session.timeline.mutations.push(mutation);
      this.session.timeline.mutationCount++;
      this.session.lastMutationId = mutation.id;

      // Enforce circular buffer (max 500 mutations)
      if (this.session.timeline.mutations.length > this.maxMutations) {
        this.session.timeline.mutations.shift(); // FIFO eviction
      }
    } catch (error) {
      // Never crash on tracer error; log and continue
      console.warn('[TRACER] Failed to record mutation:', { field, error });
    }
  }

  /**
   * Replay mutations from timeline
   * Public API: window.__mutationTracer.replay()
   */
  replay(): Mutation[] {
    try {
      if (!this.session.timeline.mutations.length) {
        return [];
      }
      return [...this.session.timeline.mutations]; // Return copy
    } catch (error) {
      console.warn('[TRACER] Failed to replay mutations:', error);
      return [];
    }
  }

  /**
   * Export timeline as JSON
   * Useful for debugging
   */
  export(): Timeline {
    try {
      return JSON.parse(JSON.stringify(this.session.timeline)); // Deep copy
    } catch (error) {
      console.warn('[TRACER] Failed to export timeline:', error);
      return {
        mutations: [],
        baselineValues: {},
        createdAt: Date.now(),
        mutationCount: 0,
      };
    }
  }

  /**
   * Clear all mutations and reset baseline
   */
  clear(): void {
    this.session.timeline.mutations = [];
    this.session.timeline.baselineValues = {};
    this.session.timeline.createdAt = Date.now();
    this.session.timeline.mutationCount = 0;
    this.mutationCounter = 0;
    this.session.lastMutationId = '';
  }

  /**
   * Get current session state
   */
  getState(): TraceSession {
    return JSON.parse(JSON.stringify(this.session)); // Deep copy
  }

  /**
   * Pause/resume recording
   */
  setRecording(enabled: boolean): void {
    this.session.isRecording = enabled;
  }

  /**
   * Configure max mutations in timeline
   */
  setMaxMutations(max: number): void {
    if (max > 0) {
      this.maxMutations = max;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (
        !this.deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private describeDeviation(baseline: unknown, current: unknown, field: string): string {
    try {
      const baselineStr = JSON.stringify(baseline);
      const currentStr = JSON.stringify(current);

      if (baselineStr.length + currentStr.length > 200) {
        return `${field}: [baseline length ${baselineStr.length}] → [current length ${currentStr.length}]`;
      }

      return `${field}: ${baselineStr} → ${currentStr}`;
    } catch {
      return `${field}: type mutation detected`;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE & GLOBAL EXPOSURE
// ─────────────────────────────────────────────────────────────────────────

let tracer: MutationTracer | null = null;

function initializeTracer(): MutationTracer {
  if (!tracer) {
    tracer = new MutationTracer();
  }
  return tracer;
}

function getTracer(): MutationTracer | null {
  return tracer;
}

/**
 * Initialize the mutation tracer and expose public API
 * Call once during app initialization (see main.tsx)
 */
export function setupMutationTracer(): void {
  if (!isDevEnvironment()) {
    return; // Do not initialize outside dev environment
  }

  if (tracer) {
    return; // Already initialized
  }

  try {
    const instance = initializeTracer();

    // Expose public API on window
    (window as any).__mutationTracer = {
      replay: () => instance.replay(),
      export: () => instance.export(),
      clear: () => instance.clear(),
      getState: () => instance.getState(),
      setRecording: (enabled: boolean) => instance.setRecording(enabled),
      setMaxMutations: (max: number) => instance.setMaxMutations(max),
    };

    console.log('[TRACER] Mutation tracer initialized (dev mode)');
  } catch (error) {
    console.error('[TRACER] Failed to initialize mutation tracer:', error);
  }
}

/**
 * Internal access for tRPC middleware
 */
export function recordMutationFromMiddleware(
  field: string,
  oldValue: unknown,
  newValue: unknown
): void {
  const instance = getTracer();
  if (instance) {
    instance.recordMutation(field, oldValue, newValue, 'trpc');
  }
}

// Dead-code elimination: if __DEV__ is false, entire module tree-shakes
if (!isDevEnvironment()) {
  // This block ensures TypeScript doesn't complain about unused exports
  // In production, entire module is eliminated by Vite
  const _unused = {
    setupMutationTracer,
    recordMutationFromMiddleware,
    MutationTracer,
  };
}
