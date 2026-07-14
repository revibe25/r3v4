/**
 * R3 Native — Badge Component
 * Status indicator for recording, clipping, premium features, etc.
 */

import React from 'react';
import { R3_COLORS, R3_GRADIENTS } from '@shared/theme';
import type { BadgeType } from '@shared/theme';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type?: BadgeType;
  size?: 'sm' | 'md';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ type = 'info', size = 'md', children, style, className, ...props }, ref) => {
    const getTypeStyles = (): React.CSSProperties => {
      const types: Record<BadgeType, React.CSSProperties> = {
        success: {
          backgroundColor: R3_COLORS.play,
          color: R3_COLORS.pureBlack,
          borderColor: R3_COLORS.play,
        },
        warning: {
          backgroundColor: R3_COLORS.warningGold,
          color: R3_COLORS.pureBlack,
          borderColor: R3_COLORS.warningGold,
        },
        error: {
          backgroundColor: R3_COLORS.record,
          color: R3_COLORS.pureWhite,
          borderColor: R3_COLORS.record,
        },
        premium: {
          background: R3_GRADIENTS.premium.css,
          color: R3_COLORS.pureWhite,
          borderColor: 'transparent',
        },
        info: {
          backgroundColor: R3_COLORS.neonGreen,
          color: R3_COLORS.pureBlack,
          borderColor: R3_COLORS.neonGreen,
        },
      };
      return types[type];
    };

    const getSizeStyles = (): React.CSSProperties => {
      const sizes: Record<string, React.CSSProperties> = {
        sm: {
          padding: 'var(--r3-space-xs) var(--r3-space-sm)',
          fontSize: '0.75rem',
        },
        md: {
          padding: 'var(--r3-space-sm) var(--r3-space-md)',
          fontSize: '0.875rem',
        },
      };
      return sizes[size];
    };

    return (
      <span
        ref={ref}
        className={className}
        style={{
          ...getTypeStyles(),
          ...getSizeStyles(),
          borderRadius: 'var(--r3-radius-full)',
          display: 'inline-block',
          fontWeight: 600,
          border: '1px solid',
          whiteSpace: 'nowrap',
          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';
