import React from 'react';
import styles from './Footer.module.css';

interface FooterProps {
  deviceName: string;
  sampleRate: number;
  bitDepth: number;
  latency: number;
  bufferSize: number;
}

/**
 * Footer Component
 * Shows: Audio device, sample rate, bit depth, latency, buffer size
 * Located at bottom of window
 */
export const Footer: React.FC<FooterProps> = ({ 
  deviceName = 'Default',
  sampleRate = 44100,
  bitDepth = 24,
  latency = 16,
  bufferSize = 512,
}) => {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerItem}>
        Device – <strong>{deviceName}</strong>
      </div>
      <div className={styles.footerItem}>
        Renderer: <strong>{(sampleRate / 1000).toFixed(1)} kHz / {bitDepth} bit</strong>
      </div>
      <div className={styles.footerItem}>
        Buffer – <strong>{bufferSize}</strong> latency – <strong>{latency.toFixed(1)} ms</strong>/native
      </div>
    </footer>
  );
};

export default Footer;
