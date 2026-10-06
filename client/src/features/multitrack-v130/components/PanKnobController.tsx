/**
 * PanKnobController.tsx
 * 
 * React wrapper that wires PanKnob to DAW store track pan state.
 * Used by ensureMixer() to mount interactive pan controls in mixer strips.
 */

import React from 'react';
import { PanKnob } from './PanKnob';
import { useTrackPan } from '../hooks/useTrackPan';

interface PanKnobControllerProps {
  trackId: string;
}

/**
 * PanKnobController: stateful pan control component
 * 
 * Subscribes to DAW store track.pan, renders PanKnob with live state.
 * onChange → updateTrack() in DAW store (persists across renders).
 */
export const PanKnobController: React.FC<PanKnobControllerProps> = ({ trackId }) => {
  const { pan, updatePan, trackLabel } = useTrackPan(trackId);

  return (
    <PanKnob
      value={pan}
      onChange={updatePan}
      label={trackLabel}
      disabled={false}
    />
  );
};

export default PanKnobController;
