/**
 * useAudioGraphState.ts
 * 
 * Merges AudioGraph + DAW store state into a single live subscription.
 * Polls AudioContext.currentTime at 60Hz and subscribes to BPM/timeSignature changes.
 * 
 * Returns: { currentTime (sec), bpm, timeSignature, playing, position (beats) }
 */

import { useEffect, useState, useCallback } from 'react';
import { useDAWStore } from '@/hooks/useDAWStore';

export interface AudioGraphState {
  currentTime: number;      // seconds (from AudioContext)
  bpm: number;              // from DAW store
  timeSignature: [number, number]; // from DAW store
  playing: boolean;         // from DAW store
  position: number;         // beats (from DAW store)
}

/**
 * Custom hook: live audio graph + DAW transport state
 * 
 * Updates at 60Hz (requestAnimationFrame) to stay in sync with playhead.
 * Subscribes to DAW store changes (bpm, timeSignature) with zero overhead.
 */
export function useAudioGraphState(): AudioGraphState {
  const [state, setState] = useState<AudioGraphState>(() => {
    const daw = useDAWStore.getState();
    return {
      currentTime: 0,
      bpm: daw.bpm,
      timeSignature: daw.timeSignature,
      playing: daw.playing,
      position: daw.position,
    };
  });

  // Subscribe to DAW store (bpm, timeSignature, playing, position)
  useEffect(() => {
    const unsubscribeBpm = useDAWStore.subscribe(
      (s) => s.bpm,
      (bpm) => setState((prev) => ({ ...prev, bpm })),
    );

    const unsubscribeTimeSignature = useDAWStore.subscribe(
      (s) => s.timeSignature,
      (timeSignature) => setState((prev) => ({ ...prev, timeSignature })),
    );

    const unsubscribePlaying = useDAWStore.subscribe(
      (s) => s.playing,
      (playing) => setState((prev) => ({ ...prev, playing })),
    );

    const unsubscribePosition = useDAWStore.subscribe(
      (s) => s.position,
      (position) => setState((prev) => ({ ...prev, position })),
    );

    return () => {
      unsubscribeBpm();
      unsubscribeTimeSignature();
      unsubscribePlaying();
      unsubscribePosition();
    };
  }, []);

  // Poll AudioContext.currentTime at 60Hz
  useEffect(() => {
    let frameId: number;
    let lastUpdateTime = 0;

    const updateTime = () => {
      const now = performance.now();
      
      // Only update state at 60Hz (~16.67ms per frame)
      if (now - lastUpdateTime >= 16.67) {
        const audioContext = (window as any).__audioGraph?.context;
        if (audioContext) {
          const currentTime = audioContext.currentTime || 0;
          setState((prev) => {
            // Only trigger re-render if time changed significantly
            if (Math.abs(currentTime - prev.currentTime) > 0.001) {
              return { ...prev, currentTime };
            }
            return prev;
          });
          lastUpdateTime = now;
        }
      }

      frameId = requestAnimationFrame(updateTime);
    };

    frameId = requestAnimationFrame(updateTime);

    return () => cancelAnimationFrame(frameId);
  }, []);

  return state;
}

export default useAudioGraphState;
