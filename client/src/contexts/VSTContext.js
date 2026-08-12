import { jsx as _jsx } from "react/jsx-runtime";
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
import { createContext, useContext, useState } from 'react';
const VSTContext = createContext(null);
// ── Provider ──────────────────────────────────────────────────────────────────
export function VSTProvider({ children }) {
    const [channels] = useState([]);
    const [activeChannelId, setActiveChannel] = useState(null);
    return (_jsx(VSTContext.Provider, { value: { channels, activeChannelId, setActiveChannel }, children: children }));
}
// ── Hooks ─────────────────────────────────────────────────────────────────────
/**
 * Returns the VST context. Throws if called outside VSTProvider.
 * Use in components that are always rendered inside VSTProvider.
 */
export function useVSTContext() {
    const ctx = useContext(VSTContext);
    if (!ctx)
        throw new Error('useVSTContext must be used inside VSTProvider');
    return ctx;
}
/**
 * Returns the VST context, or null if no VSTProvider is present.
 * Safe to call on routes where VSTProvider is absent (e.g. /multitrack).
 */
export function useVSTContextOptional() {
    return useContext(VSTContext);
}
