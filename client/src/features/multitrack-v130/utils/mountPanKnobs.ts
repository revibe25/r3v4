/**
 * mountPanKnobs.ts
 * 
 * Utility to mount React PanKnobController components into mixer strip pan knob divs.
 * Called after ensureMixer() creates the DOM structure.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import PanKnobController from '../components/PanKnobController';
import { useDAWStore } from '@/hooks/useDAWStore';

// Track React roots for cleanup
const panKnobRoots = new Map<string, Root>();

/**
 * Mount PanKnobController into each mixer strip's pan knob div.
 * 
 * Expects ensureMixer() to have already created DOM with structure:
 * <div class="strip" data-i="0">
 *   <div class="kn">...</div>  ← Target for mounting
 * </div>
 */
export function mountPanKnobs(stripContainer: HTMLElement | null): void {
  if (!stripContainer) return;

  // Find all strip elements
  const strips = stripContainer.querySelectorAll<HTMLElement>('.strip');
  const tracks = useDAWStore.getState().tracks;

  strips.forEach((strip, index) => {
    if (index >= tracks.length) return;

    const track = tracks[index];
    const knobDiv = strip.querySelector<HTMLElement>('.kn');

    if (!knobDiv) return;

    // Clear existing root if any
    const existingRoot = panKnobRoots.get(track.id);
    if (existingRoot) {
      existingRoot.unmount();
      panKnobRoots.delete(track.id);
    }

    // Clear the knob div (remove static SVG)
    knobDiv.innerHTML = '';

    // Mount PanKnobController React component
    const root = createRoot(knobDiv);
    root.render(
      React.createElement(PanKnobController, { trackId: track.id }),
    );

    panKnobRoots.set(track.id, root);
  });

  // Also mount master pan knob if it exists
  const masterStrip = stripContainer.querySelector<HTMLElement>('.strip.master');
  if (masterStrip) {
    const masterKnobDiv = masterStrip.querySelector<HTMLElement>('.kn');
    if (masterKnobDiv) {
      const existingRoot = panKnobRoots.get('master');
      if (existingRoot) {
        existingRoot.unmount();
        panKnobRoots.delete('master');
      }

      masterKnobDiv.innerHTML = '';
      const root = createRoot(masterKnobDiv);
      root.render(
        React.createElement(PanKnobController, { trackId: 'master' }),
      );
      panKnobRoots.set('master', root);
    }
  }
}

/**
 * Cleanup: unmount all PanKnobController components
 */
export function unmountPanKnobs(): void {
  panKnobRoots.forEach((root) => root.unmount());
  panKnobRoots.clear();
}

export default mountPanKnobs;
