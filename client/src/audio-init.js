/**
 * Audio Initialization Module
 * Handles Web Audio API AudioContext initialization with browser autoplay policy compliance
 * Tone.js v14+ compatible - React ready
 */

let audioInitialized = false;
let initPromise = null;

/**
 * Initialize Tone.js AudioContext after user gesture.
 * @returns {Promise<void>}
 */
export async function initializeAudio() {
  // Return existing promise if initialization already in progress
  if (initPromise) return initPromise;
  if (audioInitialized) return Promise.resolve();

  initPromise = (async () => {
    try {
      if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
        await Tone.start();
        audioInitialized = true;
        console.log('✓ AudioContext started successfully');
      }
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Check if audio is currently initialized
 * @returns {boolean}
 */
export function isAudioInitialized() {
  return audioInitialized && typeof Tone !== 'undefined' && Tone.context?.state === 'running';
}

/**
 * Attach audio initialization to user gestures.
 * Works on desktop (click, keydown) and mobile (touchstart).
 */
export function attachAudioInitTriggers() {
  if (typeof window === 'undefined') return; // SSR safety
  
  const events = ['click', 'touchstart', 'keydown'];
  
  const handleUserGesture = async () => {
    try {
      await initializeAudio();
      // Remove listeners after first successful initialization
      events.forEach(event => {
        document.removeEventListener(event, handleUserGesture);
      });
      console.log('✓ Audio initialization triggers detached');
    } catch (error) {
      console.error('Audio initialization failed on user gesture:', error);
    }
  };

  events.forEach(event => {
    document.addEventListener(event, handleUserGesture);
  });

  console.log('✓ Audio initialization triggers attached');
}

/**
 * Manual initialization trigger for UI buttons
 * @param {string} triggerSource - Description of what triggered initialization
 * @returns {Promise<boolean>}
 */
export async function triggerAudioInitialization(triggerSource = 'manual') {
  try {
    await initializeAudio();
    console.log(`✓ AudioContext initialized by: ${triggerSource}`);
    return true;
  } catch (error) {
    console.error(`Failed to initialize audio (${triggerSource}):`, error);
    return false;
  }
}
