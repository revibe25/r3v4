/**
 * useMountPanKnobs.ts
 * 
 * Hook that detects when mixer strips are rendered and mounts
 * PanKnobController React components into the pan knob divs.
 */

import { useEffect } from 'react';
import { mountPanKnobs, unmountPanKnobs } from '../utils/mountPanKnobs';

/**
 * Custom hook: auto-mount PanKnobController when mixer strips appear
 * 
 * Polls for #strips + .kn divs, mounts components when ready.
 * Cleans up on unmount.
 */
export function useMountPanKnobs(): void {
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const attemptMount = () => {
      const stripsContainer = document.querySelector<HTMLElement>('#strips');
      if (!stripsContainer) return false;

      // Wait for .kn divs to exist
      const knobDivs = stripsContainer.querySelectorAll<HTMLElement>('.kn');
      if (knobDivs.length === 0) return false;

      // Success: mount components
      if (isMounted) {
        mountPanKnobs(stripsContainer);
        if (pollInterval) clearInterval(pollInterval);
      }
      return true;
    };

    // Try immediately
    if (!attemptMount()) {
      // Poll every 50ms for up to 2 seconds
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        if (attemptMount() || attempts > 40) {
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 50);
    }

    // Cleanup
    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      unmountPanKnobs();
    };
  }, []);
}

export default useMountPanKnobs;
