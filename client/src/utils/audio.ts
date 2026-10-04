import { initializeToneFromGesture } from "@/audio/core/tone-runtime";
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
  if (initPromise) return initPromise;
  if (state.initialized) return Promise.resolve();

  state.initializing = true;

  initPromise = (async () => {
    try {
      await initializeToneFromGesture();

      state.initialized = true;
      state.error = null;
      console.log('✅ AudioContext initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.error = err;
      console.error('❌ Failed to initialize AudioContext:', err.message);
    } finally {
      state.initializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

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
  const EVENTS = ['click', 'touchstart', 'keydown', 'pointerdown'] as const;

  let initializing = false;
  let active = true;

  const handleGesture = (): void => {
    if (!active || initializing) return;

    initializing = true;

    // Reached directly from a browser user gesture.
    void initializeToneFromGesture()
      .then(() => {
        if (!active) return;

        EVENTS.forEach((event) => {
          document.removeEventListener(event, handleGesture);
        });
      })
      .catch((audioErr) => {
        initializing = false;

        console.warn(
          '[R3 Audio] Gesture audio initialization failed (non-fatal):',
          audioErr,
        );
      });
  };

  EVENTS.forEach((event) => {
    document.addEventListener(event, handleGesture, {
      once: false,
      passive: true,
    });
  });

  return () => {
    active = false;

    EVENTS.forEach((event) => {
      document.removeEventListener(event, handleGesture);
    });
  };
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
