import React, { useState } from 'react';
import styles from './PanKnob.module.css';

interface PanKnobProps {
  value: number; // -1 (left) to 1 (right)
  onChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Pan Knob Component
 * Visual rotary knob for stereo panning (L-C-R)
 * Draggable: drag up/down to adjust pan
 */
export const PanKnob: React.FC<PanKnobProps> = ({ 
  value = 0, 
  onChange, 
  label = 'Pan',
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    if (!disabled) setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;
    
    // Scale: 1px = 0.01 pan value
    const delta = e.movementX * 0.01;
    const newValue = Math.max(-1, Math.min(1, value + delta));
    onChange(newValue);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent) => handleMouseMove(e);
      const handleUp = () => setIsDragging(false);
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging, value]);

  const angle = (value + 1) * 45; // -1 = -45°, 0 = 0°, 1 = 45°
  const posLabel = value < -0.1 ? 'L' : value > 0.1 ? 'R' : 'C';
  const displayValue = Math.abs(Math.round(value * 100));

  return (
    <div 
      className={`${styles.panKnob} ${isDragging ? styles.dragging : ''}`}
      role="slider"
      aria-label={label}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-disabled={disabled}
    >
      <label className={styles.label}>{label}</label>
      
      <svg 
        className={styles.knobSvg}
        viewBox="0 0 64 64"
        width="40"
        height="40"
        onMouseDown={handleMouseDown}
        style={{ cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Knob background circle */}
        <circle cx="32" cy="32" r="28" fill="none" stroke="var(--ln2)" strokeWidth="1" />
        
        {/* Pan indicator arc */}
        <circle 
          cx="32" 
          cy="32" 
          r="28" 
          fill="none" 
          stroke="var(--ac2)" 
          strokeWidth="2"
          strokeDasharray={`${Math.abs(angle / 360) * 176} 176`}
          strokeLinecap="round"
          opacity="0.6"
        />
        
        {/* Knob pointer line */}
        <line 
          x1="32" 
          y1="8" 
          x2="32" 
          y2="14"
          stroke="var(--ac)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ 
            transform: `rotate(${angle}deg)`,
            transformOrigin: '32px 32px',
            transition: isDragging ? 'none' : 'transform 0.05s'
          }}
        />
      </svg>

      <div className={styles.panDisplay}>
        <span className={styles.pos}>{posLabel}</span>
        <span className={styles.value}>{displayValue}</span>
      </div>
    </div>
  );
};

export default PanKnob;
