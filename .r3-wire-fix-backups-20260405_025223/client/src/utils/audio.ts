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

      const Tone = (window as any).Tone;

      // Check AudioContext state
      if (Tone.context && Tone.context.state !== 'running') {
        console.log('ℹ Resuming AudioContext...');
        await Tone.start();
      }

      state.initialized = true;
      state.error = null;
      console.log('✅ AudioContext initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
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
 * Register automatic initialization on user gesture
 * Attaches listeners to common user interaction events
 * Automatically detaches after first successful initialization
 */
export function registerAudioInitTriggers(): () => void {
  const events = ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'];
  let initialized = false;

  const handleUserInteraction = async () => {
    // Prevent double initialization
    if (initialized) return;
    initialized = true;

    try {
      await initializeAudioContext();

      // Clean up listeners after successful initialization
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction);
      });

      console.log('ℹ Audio initialization triggers removed');
    } catch (error) {
      console.error('Audio initialization failed:', error);
      // Allow retrying on next gesture
      initialized = false;
    }
  };

  // Attach listeners
  events.forEach((event) => {
    document.addEventListener(event, handleUserInteraction, { passive: true });
  });

  console.log('ℹ Audio initialization triggers registered');

  // Return cleanup function
  return () => {
    events.forEach((event) => {
      document.removeEventListener(event, handleUserInteraction);
    });
  };
}

/**
 * Suppress test file auto-initialization
 * MUST be called during app initialization to prevent test files from starting audio
 */
export function suppressTestAudioInitialization(): void {
  // Intercept Tone.Oscillator, ConstantSourceNode, etc. test constructors
  // to prevent them from auto-starting
  if (typeof (window as any).Tone === 'undefined') return;

  const Tone = (window as any).Tone;

  // Store original constructor
  const originalOscillator = Tone.Oscillator;
  const originalConstantSourceNode = Tone.ConstantSourceNode;

  // Wrap constructors to suppress auto-start
  if (Tone.Oscillator) {
    Tone.Oscillator = function (...args: any[]) {
      const instance = new originalOscillator(...args);
      // Override start to require explicit call
      const originalStart = instance.start?.bind(instance);
      instance.start = function (time?: any) {
        // Only call if we're in app context, not test context
        if (state.initialized) {
          return originalStart?.(time);
        }
        console.debug('ℹ Audio start suppressed (not initialized)');
        return instance;
      };
      return instance;
    };
  }

  console.log('ℹ Test audio auto-initialization suppressed');
}

/**
 * Prevent automatic Tone.js initialization on import
 * Call this at the very start of your app
 */
export function lockAudioInitialization(): void {
  if (typeof (window as any).Tone === 'undefined') return;

  const Tone = (window as any).Tone;

  // Prevent Tone.start() from being called automatically
  const originalStart = Tone.start?.bind(Tone);
  if (originalStart) {
    let manualStartRequired = true;

    Tone.start = async function (...args: any[]) {
      if (!manualStartRequired) {
        return originalStart(...args);
      }
      console.debug('ℹ Auto start prevented - waiting for user gesture');
      return Promise.resolve();
    };

    console.log('ℹ Tone.js auto-initialization locked');
  }
}
