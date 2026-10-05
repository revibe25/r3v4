import React from 'react';
import styles from './SendFader.module.css';

interface SendFaderProps {
  value: number; // 0 to 1 (0% to 100%)
  onChange: (value: number) => void;
  label: string; // "Reverb Send", "Delay Send", etc.
  disabled?: boolean;
}

/**
 * Send Fader Component
 * Controls send amount (0-100%) to effects (reverb, delay, etc.)
 * Visual feedback with percentage display
 */
export const SendFader: React.FC<SendFaderProps> = ({ 
  value = 0, 
  onChange, 
  label,
  disabled = false
}) => {
  return (
    <div className={styles.sendFader}>
      <label className={styles.label}>{label}</label>
      
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className={styles.faderInput}
        aria-label={label}
        disabled={disabled}
      />
      
      <div className={styles.sendValue}>
        {Math.round(value * 100)}%
      </div>
    </div>
  );
};

export default SendFader;
