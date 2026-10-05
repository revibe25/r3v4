import React from 'react';
import styles from './HeaderBrand.module.css';

/**
 * R3 NATIVE Logo & Brand Component
 * Displays: SVG logo + "R3 NATIVE" text + tagline
 * Color: Acid green (#a6e22e)
 */
export const HeaderBrand: React.FC = () => {
  return (
    <div className={styles.brand}>
      <svg 
        viewBox="0 0 64 64" 
        xmlns="http://www.w3.org/2000/svg"
        className={styles.logo}
        role="img"
        aria-label="R3 NATIVE Logo"
      >
        {/* R3 Circle + Text */}
        <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
        <text 
          x="32" 
          y="40" 
          fontSize="28" 
          fontWeight="700" 
          textAnchor="middle" 
          fill="currentColor"
          fontFamily="var(--f)"
        >
          R3
        </text>
      </svg>
      
      <div className={styles.brandText}>
        <b className={styles.title}>R3 NATIVE</b>
        <small className={styles.subtitle}>Professional multitrack workstation</small>
      </div>
    </div>
  );
};

export default HeaderBrand;
