import React from 'react';
import styles from './AutomationLane.module.css';

interface AutomationPoint {
  time: number;
  value: number;
}

interface AutomationLaneProps {
  automationId: string;
  parameter: string;
  points: AutomationPoint[];
  onPointCreate: (time: number, value: number) => void;
  onPointUpdate: (index: number, time: number, value: number) => void;
  onPointDelete: (index: number) => void;
  pixelsPerSecond: number;
  height?: number;
}

/**
 * Automation Lane Component
 * Shows editable automation points for parameters
 * Double-click to create, drag to edit, right-click to delete
 */
export const AutomationLane: React.FC<AutomationLaneProps> = ({
  automationId,
  parameter,
  points = [],
  onPointCreate,
  onPointUpdate,
  onPointDelete,
  pixelsPerSecond = 100,
  height = 60,
}) => {
  const [draggedPoint, setDraggedPoint] = React.useState<number | null>(null);

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const time = (e.clientX - rect.left) / pixelsPerSecond;
    const value = 1 - (e.clientY - rect.top) / height;
    onPointCreate(Math.max(0, time), Math.max(0, Math.min(1, value)));
  };

  const handlePointMouseDown = (index: number) => {
    setDraggedPoint(index);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedPoint === null) return;
      
      const point = points[draggedPoint];
      if (!point) return;

      const container = document.querySelector(`[data-automation="${automationId}"]`);
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newTime = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
      const newValue = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / height));
      
      onPointUpdate(draggedPoint, newTime, newValue);
    };

    const handleMouseUp = () => setDraggedPoint(null);

    if (draggedPoint !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedPoint, points, pixelsPerSecond, height, automationId]);

  return (
    <div
      className={styles.automationLane}
      data-automation={automationId}
      data-parameter={parameter}
      style={{ height: `${height}px` }}
      onDoubleClick={handleCanvasDoubleClick}
      role="region"
      aria-label={`Automation lane: ${parameter}`}
    >
      <div className={styles.grid}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <div
            key={v}
            className={styles.gridLine}
            style={{ bottom: `${v * 100}%` }}
          />
        ))}
      </div>

      {/* Automation curve (line connecting points) */}
      {points.length > 0 && (
        <svg className={styles.curve}>
          <polyline
            points={points
              .map((p) => `${p.time * pixelsPerSecond},${height - p.value * height}`)
              .join(' ')}
          />
        </svg>
      )}

      {/* Automation points (draggable) */}
      {points.map((point, index) => (
        <div
          key={index}
          className={`${styles.point} ${draggedPoint === index ? styles.dragging : ''}`}
          style={{
            left: `${point.time * pixelsPerSecond}px`,
            bottom: `${point.value * 100}%`,
          }}
          onMouseDown={() => handlePointMouseDown(index)}
          onContextMenu={(e) => {
            e.preventDefault();
            onPointDelete(index);
          }}
          role="button"
          tabIndex={0}
          aria-label={`Automation point ${index + 1}: ${(point.value * 100).toFixed(0)}%`}
          title="Drag to adjust · Right-click to delete"
        />
      ))}
    </div>
  );
};

export default AutomationLane;
