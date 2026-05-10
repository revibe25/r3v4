// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber)
// Reason: Tier gate warning UI — subscription status indicator only
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
/**
 * client/src/components/ProtectedRoute.tsx
 * Wouter-based route guard for R3 v4.
 *
 * Renders children only when the user is authenticated.
 * On mount it calls initAuth() to rehydrate from localStorage.
 * Redirects to /auth if unauthenticated after hydration.
 *
 * Usage in App.tsx:
 *   <Route path="/daw">
 *     <ProtectedRoute>
 *       <DAW />
 *     </ProtectedRoute>
 *   </Route>
 *
 * Routing uses Wouter — NOT react-router-dom.
 * Uses <Redirect> from wouter (not <Navigate>).
 */

import React, { useEffect } from 'react';
import { Redirect } from 'wouter';
import { useAuthStore, selectIsAuthed } from '../hooks/authStore';

interface Props {
  children: React.ReactNode;
  /** Optional: minimum tier required. Aligned to AuthUser.tier — explorer by default. */
  minTier?: 'explorer' | 'creator' | 'pro_artist';
}

const TIER_ORDER = { explorer: 0, creator: 1, pro_artist: 2 } as const;

export function ProtectedRoute({ children, minTier = 'explorer' }: Props) {
  const { loading, _error } = useAuthStore();
  const isAuthed = useAuthStore(selectIsAuthed);
  const tier     = useAuthStore(s => s.user?.tier ?? 'explorer');
  const initAuth = useAuthStore(s => s.initAuth);

  // Re-hydrate token on mount (no-op if already loaded or no token stored)
  useEffect(() => {
    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading: token check in progress
  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid var(--t-b3)',
              borderTop: '2px solid var(--status-warn)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: 'var(--dj-dim)', fontSize: 11, letterSpacing: '0.2em' }}>
            INITIALISING
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to auth page
  if (!isAuthed) {
    return <Redirect to="/auth" />;
  }

  // Tier insufficient → show upgrade prompt inline
  if (TIER_ORDER[tier] < TIER_ORDER[minTier]) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          fontFamily: '"JetBrains Mono", monospace',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <p style={{ color: 'var(--status-warn)', fontSize: 12, letterSpacing: '0.2em' }}>
          {minTier.toUpperCase()} TIER REQUIRED
        </p>
        <p style={{ color: 'var(--dj-dim)', fontSize: 10 }}>
          This feature requires the {minTier} plan or higher.
        </p>
        <a
          href="/pricing"
          style={{
            padding: '6px 16px',
            border: '1px solid #f59e0b44',
            color: 'var(--status-warn)',
            fontSize: 10,
            letterSpacing: '0.15em',
            borderRadius: 4,
            textDecoration: 'none',
          }}
        >
          UPGRADE
        </a>
      </div>
    );
  }

  return <>{children}</>;
}