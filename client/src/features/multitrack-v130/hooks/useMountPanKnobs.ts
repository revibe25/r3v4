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
 * Watches for #strips container and mounts components when ready.
 * Cleans up on unmount.
 */
export function useMountPanKnobs(): void {
  useEffect(() => {
    // Find the mixer strips container
    const stripsContainer = document.querySelector<HTMLElement>('#strips');

    if (!stripsContainer) {
      // Not ready yet, try again soon
      const timer = setTimeout(() => {
        const retryContainer = document.querySelector<HTMLElement>('#strips');
        if (retryContainer) {
          mountPanKnobs(retryContainer);
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    // Container exists, mount components
    mountPanKnobs(stripsContainer);

    // Cleanup on unmount
    return () => {
      unmountPanKnobs();
    };
  }, []);
}

export default useMountPanKnobs;
