/**
 * useTrackPan.ts
 * 
 * Subscribe to track pan state in DAW store.
 * Returns current pan value + update callback.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDAWStore } from '@/hooks/useDAWStore';

export interface TrackPanState {
  pan: number;           // -1 to 1
  updatePan: (value: number) => void;
  trackLabel: string;
}

/**
 * Custom hook: track pan state + update callback
 * 
 * Subscribes to DAW store track.pan field for live updates.
 * updatePan callback writes back to store.
 */
export function useTrackPan(trackId: string): TrackPanState {
  const [pan, setPan] = useState(() => {
    const track = useDAWStore.getState().tracks.find(t => t.id === trackId);
    return track?.pan ?? 0;
  });

  const [trackLabel, setTrackLabel] = useState(() => {
    const track = useDAWStore.getState().tracks.find(t => t.id === trackId);
    return track?.label ?? 'Track';
  });

  // Subscribe to this specific track's pan + label
  useEffect(() => {
    const unsubscribePan = useDAWStore.subscribe(
      (s) => {
        const track = s.tracks.find(t => t.id === trackId);
        return track?.pan ?? 0;
      },
      (panValue) => setPan(panValue),
    );

    const unsubscribeLabel = useDAWStore.subscribe(
      (s) => {
        const track = s.tracks.find(t => t.id === trackId);
        return track?.label ?? 'Track';
      },
      (label) => setTrackLabel(label),
    );

    return () => {
      unsubscribePan();
      unsubscribeLabel();
    };
  }, [trackId]);

  // Update callback: writes pan change back to store
  const updatePan = useCallback(
    (newValue: number) => {
      const clamped = Math.max(-1, Math.min(1, newValue));
      useDAWStore.getState().updateTrack(trackId, { pan: clamped });
    },
    [trackId],
  );

  return {
    pan,
    updatePan,
    trackLabel,
  };
}

export default useTrackPan;
