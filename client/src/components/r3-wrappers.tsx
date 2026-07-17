/**
 * R3 Native Founder Edition — Theme Wrapper Components
 * These components inject R3 branding (Cyber Purple #8E3CFF + Neon Green #B7FF00)
 * into the existing component library, replacing Tailwind defaults.
 * 
 * Usage: Replace <button> with <R3Button>, <Card> with <R3Card>, etc.
 * WIRE.txt Protocol: Each wrapper is anchor-verified, no assumptions.
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ==================== BUTTONS ====================

interface R3ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'accent' | 'sale';
  size?: 'sm' | 'md' | 'lg';
}

export const R3Button = React.forwardRef<HTMLButtonElement, R3ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variantClasses = {
      primary: 'r3-btn-primary',
      secondary: 'r3-btn-secondary',
      danger: 'r3-btn-danger',
      accent: 'r3-btn-accent',
      sale: 'r3-btn-sale',
    };

    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  }
);
R3Button.displayName = 'R3Button';

// ==================== CARDS ====================

interface R3CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export const R3Card = React.forwardRef<HTMLDivElement, R3CardProps>(
  ({ className, accent = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(accent ? 'r3-card-accent' : 'r3-card', className)}
      {...props}
    />
  )
);
R3Card.displayName = 'R3Card';

// ==================== BADGES ====================

interface R3BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'error' | 'premium';
}

export const R3Badge = React.forwardRef<HTMLDivElement, R3BadgeProps>(
  ({ className, variant = 'success', ...props }, ref) => {
    const variantClasses = {
      success: 'r3-badge-success',
      warning: 'r3-badge-warning',
      error: 'r3-badge-error',
      premium: 'r3-badge-premium',
    };

    return (
      <div
        ref={ref}
        className={cn(variantClasses[variant], className)}
        {...props}
      />
    );
  }
);
R3Badge.displayName = 'R3Badge';

// ==================== TEXT ====================

interface R3TextProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'headline' | 'subheading' | 'body' | 'muted';
}

export const R3Text = React.forwardRef<HTMLDivElement, R3TextProps>(
  ({ className, variant = 'body', ...props }, ref) => {
    const variantClasses = {
      headline: 'r3-text-headline',
      subheading: 'r3-text-subheading',
      body: 'r3-text-body',
      muted: 'text-[var(--r3-soft-gray)]',
    };

    return (
      <div
        ref={ref}
        className={cn(variantClasses[variant], className)}
        {...props}
      />
    );
  }
);
R3Text.displayName = 'R3Text';

// ==================== DIVIDER ====================

export const R3Divider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('r3-divider', className)} {...props} />
));
R3Divider.displayName = 'R3Divider';

// ==================== GLOW CONTAINER ====================

interface R3GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  glowType?: 'primary' | 'accent' | 'orange';
}

export const R3Glow = React.forwardRef<HTMLDivElement, R3GlowProps>(
  ({ className, glowType = 'primary', children, ...props }, ref) => {
    const glowClasses = {
      primary: 'r3-glow-effect',
      accent: 'r3-glow-effect-accent',
      orange: 'r3-glow-effect-orange',
    };

    return (
      <div
        ref={ref}
        className={cn(glowClasses[glowType], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
R3Glow.displayName = 'R3Glow';

// ==================== SPECIALIZED: LOGIN BUTTON ====================
// Maps existing login button state logic to R3 theme colors
// Preserves all animations and hover effects
// Handles all LoginState values: 'idle' | 'loading' | 'success' | 'error'

interface R3LoginButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state?: 'idle' | 'loading' | 'success' | 'error';
}

export const R3LoginButton = React.forwardRef<HTMLButtonElement, R3LoginButtonProps>(
  ({ className, state = 'idle', children, ...props }, ref) => {
    const isLoading = state === 'loading';
    const isSuccess = state === 'success';
    const isError = state === 'error';
    const [hovered, setHovered] = React.useState(false);

    // R3 Color mapping (Founder Edition)
    // Primary: Cyber Purple #8E3CFF
    // Accent: Neon Green #B7FF00
    // Success: Cyan (kept for success state)
    // Error: Red
    const R3_CYAN = '#00D9FF';
    const R3_RED = '#FF3B30';
    const R3_PRIMARY = '#8E3CFF'; // Cyber Purple
    const R3_PRIMARY_HOVER = '#A14BFF'; // Electric Violet
    const R3_ACCENT = '#B7FF00'; // Neon Green

    const bg = isSuccess
      ? R3_CYAN
      : isError
      ? R3_RED
      : hovered && !isLoading
      ? R3_PRIMARY_HOVER
      : R3_PRIMARY;

    return (
      <button
        ref={ref}
        type="submit"
        disabled={isLoading || isSuccess || isError}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          width: '100%',
          padding: '15px',
          border: 'none',
          borderRadius: 0,
          background: bg,
          color: '#080808', // Midnight Black text on bright background
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          letterSpacing: '.3em',
          textTransform: 'uppercase',
          fontWeight: 700,
          cursor: isLoading || isSuccess || isError ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s, box-shadow 0.2s',
          opacity: isLoading ? 0.8 : 1,
          boxShadow: isSuccess
            ? `0 0 30px ${R3_CYAN}55, 0 0 60px ${R3_CYAN}22`
            : isError
            ? `0 0 30px ${R3_RED}55, 0 0 60px ${R3_RED}22`
            : hovered && !isLoading
            ? `0 0 20px ${R3_PRIMARY}44`
            : `0 0 12px ${R3_PRIMARY}22`,
          position: 'relative',
          overflow: 'hidden',
        }}
        {...props}
      >
        {/* Sweep shimmer on hover */}
        {hovered && !isLoading && !isSuccess && !isError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
              animation: 'r3-scan 0.6s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}
        {children}
      </button>
    );
  }
);
R3LoginButton.displayName = 'R3LoginButton';

// ==================== EXPORT ALL ====================

export default {
  Button: R3Button,
  Card: R3Card,
  Badge: R3Badge,
  Text: R3Text,
  Divider: R3Divider,
  Glow: R3Glow,
  LoginButton: R3LoginButton,
};
