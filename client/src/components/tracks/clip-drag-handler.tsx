import { useEffect, useRef } from 'react';

// Constants
const PIXELS_PER_SECOND = 100;
const GRID_SIZE = 0.25; // 16th notes at 120 BPM

// Utility functions
export const _snapToGrid = (time: number, gridSize: number): number => {
  return Math.round(time / gridSize) * gridSize;
};

export const _timeToPixels = (time: number): number => {
  return time * PIXELS_PER_SECOND;
};

export const _pixelsToTime = (pixels: number): number => {
  return pixels / PIXELS_PER_SECOND;
};

// Hook for clip dragging
export const _useClipDrag = (
  clipId: string | null,
  initialX: number,
  initialTime: number,
  snapEnabled: boolean,
  onPositionChange: (clipId: string, newTime: number) => void,
  onDragEnd: () => void
) => {
  useEffect(() => {
    if (!clipId) return;

    const _handleMouseMove = (e: MouseEvent) => {
      const _deltaX = e.clientX - initialX;
      const _deltaTime = pixelsToTime(deltaX);
      let _newTime = initialTime + deltaTime;

      if (snapEnabled) {
        newTime = snapToGrid(newTime, GRID_SIZE);
      }

      onPositionChange(clipId, Math.max(0, newTime));
    };

    const _handleMouseUp = () => {
      onDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clipId, initialX, initialTime, snapEnabled, onPositionChange, onDragEnd]);
};

// Clip resize hook
export const _useClipResize = (
  clipId: string | null,
  initialX: number,
  initialDuration: number,
  snapEnabled: boolean,
  onDurationChange: (clipId: string, newDuration: number) => void,
  onResizeEnd: () => void
) => {
  useEffect(() => {
    if (!clipId) return;

    const _handleMouseMove = (e: MouseEvent) => {
      const _deltaX = e.clientX - initialX;
      const _deltaTime = pixelsToTime(deltaX);
      let _newDuration = initialDuration + deltaTime;

      if (snapEnabled) {
        newDuration = snapToGrid(newDuration, GRID_SIZE);
      }

      onDurationChange(clipId, Math.max(GRID_SIZE, newDuration));
    };

    const _handleMouseUp = () => {
      onResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clipId, initialX, initialDuration, snapEnabled, onDurationChange, onResizeEnd]);
};
