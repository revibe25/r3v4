import React, { useState } from 'react';
import styles from './ParameterKnob.module.css';

interface ParameterKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Parameter Knob Component
 * Visual knob for plugin parameters (threshold, ratio, attack, etc.)
 * Drag up/down to adjust, displays value + unit
 */
export const ParameterKnob: React.FC<ParameterKnobProps> = ({
  label,
  value,
  min,
  max,
  unit = '',
  onChange,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    if (!disabled) setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;

    // Scale: negative movementY = increase value
    const range = max - min;
    const delta = (e.movementY * -1) * 0.5; // Drag up = increase
    const step = range / 100; // Scale to percentage
    const newValue = Math.max(min, Math.min(max, value + (step * (delta / 50))));
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
  }, [isDragging, value, min, max]);

  const percentage = ((value - min) / (max - min)) * 100;
  const displayValue = value.toFixed(value < 100 ? 1 : 0);

  return (
    <div 
      className={`${styles.parameterKnob} ${isDragging ? styles.dragging : ''}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
    >
      <label className={styles.label}>{label}</label>
      
      <svg 
        className={styles.knobSvg}
        viewBox="0 0 64 64" 
        width="48" 
        height="48"
        onMouseDown={handleMouseDown}
        style={{ cursor: disabled ? 'not-allowed' : isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Background circle */}
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--ln2)" strokeWidth="1" />
        
        {/* Value arc */}
        <circle 
          cx="32" 
          cy="32" 
          r="26" 
          fill="none" 
          stroke="var(--ac)" 
          strokeWidth="2"
          strokeDasharray={`${(percentage / 100) * 163} 163`}
          strokeLinecap="round"
          opacity="0.8"
        />
        
        {/* Pointer line */}
        <line
          x1="32"
          y1="6"
          x2="32"
          y2="14"
          stroke="var(--ac)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            transform: `rotate(${225 + (percentage / 100) * 270}deg)`,
            transformOrigin: '32px 32px',
            transition: isDragging ? 'none' : 'transform 0.05s'
          }}
        />
      </svg>

      <div className={styles.paramDisplay}>
        <span className={styles.paramValue}>
          {displayValue}{unit}
        </span>
      </div>
    </div>
  );
};

export default ParameterKnob;
