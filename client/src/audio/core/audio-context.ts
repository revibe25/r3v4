/**
 * audio-context.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single AudioContext authority for the entire application.
 *
 * Exports (all backward-compatible):
 *   getAudioContext()       — sync, creates on first call
 *   getAudioContextSync()   — alias for getAudioContext() (legacy compat)
 *   ensureAudioRunning()    — async resume, race-safe
 *   resumeAudioContext()    — alias for ensureAudioRunning() (legacy compat)
 *   onAudioContext(cb)      — subscribe to context creation/availability
 *   closeAudioContext()     — alias for closeAudio() (legacy compat)
 *   suspendAudio()
 *   closeAudio()
 * ─────────────────────────────────────────────────────────────────────────────
 */

let _ctx: AudioContext | null = null;
let _initializing: Promise<AudioContext> | null = null;
const _listeners: Array<(ctx: AudioContext) => void> = [];

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Returns the shared AudioContext, creating it on first call.
 * Synchronous — safe after the context is known to be running.
 */
export function getAudioContext(): AudioContext {
  if (_ctx) return _ctx;

  _ctx = new AudioContext({
    latencyHint: "interactive",
    sampleRate: 44100,
  });

  // Notify any onAudioContext subscribers
  _listeners.forEach((cb) => {
    try { cb(_ctx!); } catch {}
  });

  return _ctx;
}

/**
 * Legacy alias — identical to getAudioContext().
 * Kept for files that imported `getAudioContextSync` from the old module.
 */
export const getAudioContextSync = getAudioContext;

// ── Resume ────────────────────────────────────────────────────────────────────

/**
 * Resumes the shared AudioContext if suspended.
 * Race-safe: concurrent callers share one Promise.
 */
export async function ensureAudioRunning(): Promise<AudioContext> {
  const ctx = getAudioContext();

  if (ctx.state === "running") return ctx;

  if (!_initializing) {
    _initializing = ctx.resume().then(() => {
      _initializing = null;
      return ctx;
    });
  }

  return _initializing;
}

/**
 * Legacy alias — identical to ensureAudioRunning().
 * Kept for files that imported `resumeAudioContext` from the old module.
 */
export const resumeAudioContext = ensureAudioRunning;

// ── Subscription ──────────────────────────────────────────────────────────────

/**
 * Register a callback that fires as soon as the AudioContext is available.
 * If the context already exists the callback is invoked synchronously.
 * Returns an unsubscribe function.
 *
 * Kept for files that imported `onAudioContext` from the old module.
 */
export function onAudioContext(
  callback: (ctx: AudioContext) => void
): () => void {
  if (_ctx) {
    try { callback(_ctx); } catch {}
    // Return no-op unsubscribe — already fired
    return () => {};
  }

  _listeners.push(callback);
  return () => {
    const idx = _listeners.indexOf(callback);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

// ── Teardown ──────────────────────────────────────────────────────────────────

/**
 * Suspends the shared context (e.g. app backgrounded).
 */
export async function suspendAudio(): Promise<void> {
  if (_ctx && _ctx.state === "running") {
    await _ctx.suspend();
  }
}

/**
 * Closes and destroys the shared context.
 * Only call on full app teardown — NOT between sessions.
 */
export async function closeAudio(): Promise<void> {
  if (_ctx) {
    await _ctx.close();
    _ctx = null;
    _initializing = null;
    _listeners.length = 0;
  }
}

/**
 * Legacy alias — identical to closeAudio().
 * Kept for files that imported `closeAudioContext` from the old module.
 */
export const closeAudioContext = closeAudio;