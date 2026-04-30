/**
 * React Hook: useAudioInitialization
 * 
 * Safely initializes Web Audio API on first user interaction
 * Must be called in your root component (e.g., App.tsx)
 * 
 * Usage:
 *   function App() {
 *     useAudioInitialization();
 *     return <div>Your app</div>;
 *   }
 */

import { useEffect } from 'react';
import { registerAudioInitTriggers } from '../utils/audio';

export function useAudioInitialization(): void {
  useEffect(() => {
    // lockAudioInitialization() and suppressTestAudioInitialization() were
    // removed from utils/audio.ts (r3-wire-fix-master.py Fix 3b) — both
    // gated on window.Tone (CDN-only no-ops in this ESM project).
    // AudioContext deferral is now handled by the MasterEngine lazy getter.
    const cleanup = registerAudioInitTriggers();
    return () => { cleanup(); };
  }, []);
}

export default useAudioInitialization;
