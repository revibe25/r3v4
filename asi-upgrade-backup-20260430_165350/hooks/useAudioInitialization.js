/**
 * React Hook for Audio Initialization
 * Initializes Tone.js AudioContext on first user interaction
 * 
 * Usage:
 *   import { useAudioInitialization } from '@/hooks/useAudioInitialization';
 *   
 *   function App() {
 *     useAudioInitialization();
 *     return <div>Your app</div>;
 *   }
 */

import { useEffect } from 'react';
import { attachAudioInitTriggers } from '../audio-init';

export function useAudioInitialization() {
  useEffect(() => {
    // Attach audio initialization to user gestures on mount
    attachAudioInitTriggers();
  }, []);
}

export default useAudioInitialization;
