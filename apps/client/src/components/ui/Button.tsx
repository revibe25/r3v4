/**
 * R3 Native — Button Component
 * CLAUDE.md Compliance: No Redux, no console.log, no any types
 */

import React, { useState, useCallback } from 'react';
import { R3_COLORS, R3_GLOWS, hexToRgba } from '@shared/theme';
import type { ButtonVariant } from '@shared/theme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isFullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      isFullWidth = false,
      disabled,
      children,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const [isHovering, setIsHovering] = useState(false);

    const getVariantStyles = useCallback((): React.CSSProperties => {
      const variants: Record<ButtonVariant, React.CSSProperties> = {
        primary: {
          backgroundColor: R3_COLORS.midnightBlack,
          border: `1px solid ${R3_COLORS.neonGreen}`,
          color: R3_COLORS.neonGreen,
          boxShadow: isHovering
            ? `0 0 30px ${R3_GLOWS.accentGlow}`
            : `0 0 20px ${R3_GLOWS.accentGlowSoft}`,
        },
        secondary: {
          backgroundColor: R3_COLORS.graphite,
          border: `1px solid ${R3_COLORS.graphite}`,
          color: R3_COLORS.pureWhite,
          boxShadow: 'none',
        },
        premium: {
          backgroundColor: R3_COLORS.midnightBlack,
          border: `1px solid ${R3_COLORS.cyberPurple}`,
          color: R3_COLORS.cyberPurple,
          boxShadow: isHovering
            ? `0 0 30px ${R3_GLOWS.primaryGlow}`
            : `0 0 20px ${R3_GLOWS.primaryGlowSoft}`,
        },
        danger: {
          backgroundColor: R3_COLORS.record,
          border: `1px solid ${R3_COLORS.record}`,
          color: R3_COLORS.pureWhite,
          boxShadow: 'none',
        },
        sale: {
          backgroundColor: R3_COLORS.midnightBlack,
          border: `1px solid ${R3_COLORS.orangePromo}`,
          color: R3_COLORS.orangePromo,
          boxShadow: isHovering
            ? `0 0 30px ${R3_GLOWS.orangeGlow}`
            : `0 0 20px rgba(255, 140, 26, 0.30)`,
        },
      };
      return variants[variant];
    }, [variant, isHovering]);

    const getSizeStyles = useCallback((): React.CSSProperties => {
      const sizes: Record<string, React.CSSProperties> = {
        sm: { padding: '8px 16px', fontSize: '0.875rem', minHeight: '32px' },
        md: { padding: '12px 24px', fontSize: '1rem', minHeight: '40px' },
        lg: { padding: '16px 32px', fontSize: '1.125rem', minHeight: '48px' },
      };
      return sizes[size];
    }, [size]);

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled && !isLoading) {
          setIsHovering(true);
          onMouseEnter?.(e);
        }
      },
      [disabled, isLoading, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        setIsHovering(false);
        onMouseLeave?.(e);
      },
      [onMouseLeave],
    );

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          ...getVariantStyles(),
          ...getSizeStyles(),
          borderRadius: 'var(--r3-radius-lg)',
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isDisabled ? 0.6 : 1,
          display: isFullWidth ? 'block' : 'inline-block',
          width: isFullWidth ? '100%' : 'auto',
          ...style,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {isLoading ? '…' : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
