/**
 * client/src/contexts/VSTContext.tsx
 * Canonical source for VST context hooks.
 *
 * Previously these were exported from App.tsx — moved here so App.tsx
 * can remain a pure router without side-effecting context exports.
 *
 * VSTProvider is optional — multi-track-panel mounts without it.
 * useVSTContextOptional() returns null safely when no provider is present.
 * useVSTContext() throws if called outside a VSTProvider.
 */

import React, { createContext, useContext, useState } from 'react';

// ── Minimal VST context shape ─────────────────────────────────────────────────
// Extend this interface as VST engine capabilities are confirmed and stabilised.
export interface VSTChannel {
  id:     string;
  name:   string;
  active: boolean;
}

export interface VSTContextType {
  channels:       VSTChannel[];
  activeChannelId: string | null;
  setActiveChannel: (id: string | null) => void;
}

const VSTContext = createContext<VSTContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function VSTProvider({ children }: { children: React.ReactNode }) {
  const [channels]        = useState<VSTChannel[]>([]);
  const [activeChannelId, setActiveChannel] = useState<string | null>(null);

  return (
    <VSTContext.Provider value={{ channels, activeChannelId, setActiveChannel }}>
      {children}
    </VSTContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Returns the VST context. Throws if called outside VSTProvider.
 * Use in components that are always rendered inside VSTProvider.
 */
export function useVSTContext(): VSTContextType {
  const ctx = useContext(VSTContext);
  if (!ctx) throw new Error('useVSTContext must be used inside VSTProvider');
  return ctx;
}

/**
 * Returns the VST context, or null if no VSTProvider is present.
 * Safe to call on routes where VSTProvider is absent (e.g. /multitrack).
 */
export function useVSTContextOptional(): VSTContextType | null {
  return useContext(VSTContext);
}
