import React from 'react';
import styles from './ArrangeMarkers.module.css';

interface Marker {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  color?: string;
}

interface ArrangeMarkersProps {
  markers: Marker[];
  pixelsPerSecond: number;
  onMarkerCreate?: (time: number) => void;
  onMarkerDelete?: (id: string) => void;
}

/**
 * Arrange Markers Component
 * Displays section labels (Verse 1, Chorus, Bridge, etc.)
 * Shows as colored labels above timeline
 */
export const ArrangeMarkers: React.FC<ArrangeMarkersProps> = ({
  markers = [],
  pixelsPerSecond = 100,
  onMarkerCreate,
  onMarkerDelete,
}) => {
  return (
    <div className={styles.markersContainer} role="region" aria-label="Arrangement markers">
      {markers.map((marker) => {
        const left = marker.startTime * pixelsPerSecond;
        const width = marker.endTime
          ? (marker.endTime - marker.startTime) * pixelsPerSecond
          : undefined;

        return (
          <div
            key={marker.id}
            className={styles.markerLabel}
            style={{
              left: `${left}px`,
              width: width ? `${width}px` : 'auto',
              borderLeftColor: marker.color || 'var(--ac)',
            }}
            role="button"
            tabIndex={0}
            onContextMenu={(e) => {
              e.preventDefault();
              onMarkerDelete?.(marker.id);
            }}
          >
            <span className={styles.markerText}>{marker.name}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ArrangeMarkers;
