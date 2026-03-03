// client/src/audio/core/audio-context.ts
// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON AudioContext — use this everywhere instead of new AudioContext()
//
// WHY: Browsers cap AudioContext instances (~6). Creating one per component
// causes silent audio failures and memory leaks on unmount.
//
// HOW TO USE in any component:
//   import { getAudioContext } from '@/audio/core/audio-context';
//   const ctx = await getAudioContext();
// ─────────────────────────────────────────────────────────────────────────────

let _audioContext: AudioContext | null = null;

/**
 * Returns the shared singleton AudioContext.
 * Creates it on first call and resumes it if suspended (browser autoplay policy).
 */
export async function getAudioContext(): Promise<AudioContext> {
  if (!_audioContext) {
    _audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Browsers suspend AudioContext until user gesture — resume if needed
  if (_audioContext.state === 'suspended') {
    await _audioContext.resume();
  }

  return _audioContext;
}

/**
 * Returns the context synchronously if already created.
 * Use getAudioContext() for first access.
 */
export function getAudioContextSync(): AudioContext | null {
  return _audioContext;
}

/**
 * Closes and destroys the singleton. Call on full app teardown only.
 * Not needed on component unmount — that's the whole point of a singleton.
 */
export async function destroyAudioContext(): Promise<void> {
  if (_audioContext) {
    await _audioContext.close();
    _audioContext = null;
  }
}