// client/src/components/studio/StudioShell.tsx
// Layout shell matching the HTML prototype's grid architecture.
// Preserves the existing VisualEngine (Three.js background) as a sibling.

import { type ReactNode } from 'react';
import { VisualEngine } from '@/components/visual-engine';

interface StudioShellProps {
  children: ReactNode;
  className?: string;
}

export function StudioShell({ children, className = '' }: StudioShellProps) {
  return (
    <>
      {/* Background shader layer — existing, untouched */}
      <VisualEngine />

      {/* Instrument shell — R3 token context */}
      <div className={`r3-instrument-body relative min-h-screen overflow-x-auto ${className}`}>
        {children}
      </div>
    </>
  );
}
