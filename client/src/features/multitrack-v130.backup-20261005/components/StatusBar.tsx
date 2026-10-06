import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  isRendering: boolean;
  audioEngineStatus: 'online' | 'offline' | 'suspended';
  midiRoutingValid: boolean;
  canExport: boolean;
}

/**
 * Status Bar Component
 * Shows: Render status, Audio engine state, MIDI routing, Export readiness
 * Located between header and main content area
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  isRendering = false,
  audioEngineStatus = 'offline',
  midiRoutingValid = true,
  canExport = false,
}) => {
  return (
    <div className={styles.statusBar} role="status" aria-live="polite">
      <div className={styles.statusItem}>
        <span className={`${styles.indicator} ${isRendering ? styles.active : ''}`} />
        {isRendering ? 'Rendering...' : 'Ready'}
      </div>

      <div className={styles.statusItem}>
        Audio engine: <strong>{audioEngineStatus}</strong>
      </div>

      <div className={styles.statusItem}>
        <span className={`${styles.indicator} ${midiRoutingValid ? styles.valid : styles.invalid}`} />
        MIDI – {midiRoutingValid ? 'Routing valid' : 'Routing error'}
      </div>

      <div className={styles.statusItem}>
        <span className={`${styles.indicator} ${canExport ? styles.active : ''}`} />
        {canExport ? 'Export ready' : 'Cannot export'}
      </div>
    </div>
  );
};

export default StatusBar;
