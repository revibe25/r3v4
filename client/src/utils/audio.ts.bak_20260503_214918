/**
 * Audio System Utility Module
 * Handles Web Audio API initialization with browser autoplay policy compliance
 * 
 * CRITICAL REQUIREMENTS:
 * - Must not initialize AudioContext automatically
 * - Must only initialize on explicit user gesture (click, touch, keydown)
 * - Must be idempotent (safe to call multiple times)
 * - Must handle errors gracefully
 * - Must prevent test code from auto-initializing audio
 */

interface AudioContextState {
  initialized: boolean;
  initializing: boolean;
  error: Error | null;
}

const state: AudioContextState = {
  initialized: false,
  initializing: false,
  error: null,
};

let initPromise: Promise<void> | null = null;

/**
 * Initialize Web Audio Context
 * Safe to call multiple times - will only initialize once
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeAudioContext(): Promise<void> {
  // Return pending promise if initialization is in progress
  if (initPromise) return initPromise;

  // Return immediately if already initialized
  if (state.initialized) return Promise.resolve();

  // Mark as initializing
  state.initializing = true;

  initPromise = (async () => {
    try {
      // Check if Tone is available (loaded from CDN or npm)
      if (typeof (window as any).Tone === 'undefined') {
        console.warn('⚠ Tone.js not available - audio features will be limited');
        return;
      }

      const _Tone = (window as any).Tone;

      // Check AudioContext state
      if (Tone.context && Tone.context.state !== 'running') {
        console.log('ℹ Resuming AudioContext...');
        await Tone.start();
      }

      state.initialized = true;
      state.error = null;
      console.log('✅ AudioContext initialized successfully');
    } catch (error) {
      const _err = error instanceof Error ? error : new Error(String(error));
      state.error = err;
      console.error('❌ Failed to initialize AudioContext:', err.message);

      // Don't rethrow - allow app to continue without audio
      // This prevents one audio failure from breaking the entire app
    } finally {
      state.initializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Get current audio initialization state
 */
export function getAudioState() {
  return { ...state };
}

/**
 * Check if audio is ready for use
 */
export function isAudioReady(): boolean {
  return state.initialized && !state.error;
}

/**
 * registerAudioInitTriggers
 *
 * Attaches passive listeners that resume the Web Audio context on the user's
 * first gesture (click / touch / keyboard). Returns a cleanup function.
 *
 * KEY DESIGN DECISIONS:
 *  • Uses dynamic `import('tone')` — Tone.js is an npm ESM module, NOT a
 *    CDN global. `window.Tone` is always undefined in this project, so the
 *    previous implementation that gated on window.Tone was a complete no-op.
 *  • `Tone.start()` is the canonical API for satisfying the browser autoplay
 *    policy. It creates (if needed) and resumes the standardized-audio-context
 *    that Tone.js wraps internally.
 *  • After Tone.start() resolves, all subsequent AudioContext and AudioNode
 *    operations are unblocked for the lifetime of the page.
 *  • Listeners are removed after first successful resume — Tone.start() is
 *    never called more than once per page load.
 *  • `resumed = false` in catch allows retry on next gesture (non-fatal path).
 */
export function registerAudioInitTriggers(): () => void {
  const _EVENTS = ['click', 'touchstart', 'keydown', 'pointerdown'] as const;
  let _resumed = false;

  const _handleGesture = async (): Promise<void> => {
    if (resumed) return;
    resumed = true;

    try {
      // Dynamic import — Tone.js must NOT be imported at module scope in a
      // utility that loads before any user gesture.
      const _Tone = await import('tone');
      await Tone.start();
      console.debug('[R3 Audio] AudioContext resumed via user gesture.');
    } catch (audioErr) {
      // Non-fatal: Tone.js may not yet be in the chunk for the current route.
      // MasterEngine.init() will resume on the next explicit call.
      console.warn('[R3 Audio] Gesture resume failed (non-fatal):', audioErr);
      resumed = false; // allow retry on next gesture
    } finally {
      if (resumed) {
        EVENTS.forEach(e => document.removeEventListener(e, handleGesture));
      }
    }
  };

  EVENTS.forEach(e =>
    document.addEventListener(e, handleGesture, { once: false, passive: true }),
  );

  return () => EVENTS.forEach(e => document.removeEventListener(e, handleGesture));
}

// suppressTestAudioInitialization() and lockAudioInitialization() REMOVED.
//
// REASON: Both functions gated on `typeof window.Tone === 'undefined'` and
// returned immediately. Tone.js in this project is an npm ESM import — it
// never sets window.Tone. Every call to these functions was a silent no-op.
//
// The probe errors they were intended to suppress are now prevented upstream:
//   • MasterEngine.context is a lazy getter — no AudioContext created on import.
//   • registerAudioInitTriggers() resumes AudioContext on first user gesture.
// To suppress probes in Vitest unit tests, add an AudioContext mock to
// vitest.setup.ts instead.
