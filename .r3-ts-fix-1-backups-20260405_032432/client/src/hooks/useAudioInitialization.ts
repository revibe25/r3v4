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
import {
  registerAudioInitTriggers,
  lockAudioInitialization,
  suppressTestAudioInitialization,
} from '../utils/audio';

export function useAudioInitialization(): void {
  useEffect(() => {
    // Lock audio initialization to prevent auto-start
    lockAudioInitialization();

    // Suppress test file audio initialization
    suppressTestAudioInitialization();

    // Register initialization triggers for user interactions
    const cleanup = registerAudioInitTriggers();

    // Cleanup listeners on unmount
    return () => {
      cleanup();
    };
  }, []);
}

export default useAudioInitialization;
