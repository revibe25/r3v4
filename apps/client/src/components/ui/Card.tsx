/**
 * R3 Native — Card Component
 * Container for grouping related content with R3 theme
 */

import React from 'react';
import { R3_COLORS, R3_GLOWS } from '@shared/theme';
import type { CardVariant } from '@shared/theme';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, style, ...props }, ref) => {
    const getPaddingStyles = (): React.CSSProperties => {
      const paddings: Record<string, React.CSSProperties> = {
        sm: { padding: 'var(--r3-space-md)' },
        md: { padding: 'var(--r3-space-lg)' },
        lg: { padding: 'var(--r3-space-xl)' },
      };
      return paddings[padding];
    };

    const getVariantStyles = (): React.CSSProperties => {
      const variants: Record<CardVariant, React.CSSProperties> = {
        default: {
          backgroundColor: R3_COLORS.graphite,
          border: `1px solid ${R3_COLORS.neonGreen}`,
          boxShadow: `0 0 20px ${R3_GLOWS.accentGlowSoft}`,
        },
        premium: {
          backgroundColor: R3_COLORS.graphite,
          border: `1px solid ${R3_COLORS.cyberPurple}`,
          boxShadow: `0 0 20px ${R3_GLOWS.primaryGlow}`,
        },
      };
      return variants[variant];
    };

    return (
      <div
        ref={ref}
        className={className}
        style={{
          ...getVariantStyles(),
          ...getPaddingStyles(),
          borderRadius: 'var(--r3-radius-lg)',
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(36, 36, 36, 0.9)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
