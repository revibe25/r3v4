/**
 * client/src/App.tsx
 * R3 v4 — root router (Wouter + TRPCProvider + SubscriptionProvider)
 *
 * Routes
 * ──────
 *   /              → redirect → /pricing      ← visitor entry point
 *   /auth          → AuthPage                 (public  — no nav rendered)
 *   /login         → redirect → /auth         (legacy alias)
 *   /pricing       → PricingPage              (public)
 *   /instrument    → InstrumentPage           (protected — Acid Grid)
 *   /daw           → DAW                      (protected — Studio suite)
 *   /loopstation   → LoopStation505           (protected — loop recorder)
 *   /multitrack    → MultiTrackPanel          (protected — multitrack DAW)
 *   /collab        → CollabDAWPro             (protected — collaborative DAW pro)
 *   /visuals       → VisualsPage              (protected — Three.js)
 *   /admin         → AdminPage               (protected)
 *   *              → NotFound
 *
 * Layout
 * ──────
 *   A flex-column shell occupies exactly 100vh.
 *   PageNav sits at the top and exposes its height as --nav-h on :root.
 *   The page area fills the remainder with overflow:hidden so individual
 *   pages manage their own internal scroll without double-scrollbars.
 *   Pages needing to fill the remaining height should use:
 *     height: calc(100vh - var(--nav-h))   ← instead of 100vh
 *   The auth page suppresses the nav entirely via PageNav's own guard.
 *
 * Stack
 * ─────
 *   Router : Wouter (Switch / Route / Redirect) — NOT react-router-dom
 *   Auth   : ProtectedRoute rehydrates JWT from localStorage via initAuth()
 *   Data   : TRPCProvider (React Query) wraps entire tree
 *   Sub    : SubscriptionProvider must be inside TRPCProvider
 *   Tokens : injectTokenCSS() called once on mount (CSS custom properties)
 */

import React, { useEffect } from 'react';
import { Switch, Route, Redirect, useLocation } from 'wouter';
import { TRPCProvider }          from './lib/trpc';
import { ProtectedRoute }         from './components/ProtectedRoute';
import { SubscriptionProvider }   from './hooks/useSubscription';
import { TrialGate }              from './components/TrialGate';
import { ThemeProvider }          from './components/theme-provider';
import { PageNav, NAV_HEIGHT_PX } from './components/page-nav';
import { injectTokenCSS }         from './tokens';          // ← NEW: token bridge

import PricingPage        from './pages/pricing/PricingPage';
import DAW                from './pages/DAW';
import InstrumentPage     from './pages/instrument';
import VSTPage            from './pages/vst';
import { LoopStation505 } from './features/loopstation/LoopStation505';
import VisualsPage        from './pages/visuals';
import NotFound           from './pages/not-found';
import SubscribePage      from './pages/subscribe';
import AdminPage          from './pages/AdminPage';
import { AdminAgentSuitePage } from './pages/admin/AgentSuitePage';
import MultitrackV130     from './features/multitrack-v130/MultitrackV130';
import CollabDAWPro       from './pages/collaborative-daw-pro';

function AuthHtmlRedirect() {
  useEffect(() => {
    window.location.replace(`/auth.html${window.location.search}`);
  }, []);

  return null;
}

export default function App() {
  const [location] = useLocation();

  const isDocumentPage =
    location === "/pricing" ||
    location === "/subscribe";

  // ── Inject CSS custom properties once on mount ───────────────────────────
  useEffect(() => {
    injectTokenCSS();
  }, []);

  return (
    <TRPCProvider>
      {/*
        SubscriptionProvider inside TRPCProvider — it issues
        trpc.subscription.getMySubscription queries and needs React Query ctx.
      */}
      <SubscriptionProvider>
        <TrialGate>
        <ThemeProvider>
        {/*
          Expose nav height as a CSS custom property so child pages can use
          calc(100vh - var(--nav-h)) to fill the correct remaining height.
          Value is the single source of truth exported from page-nav.tsx.
        */}
        <style>{`:root { --nav-h: ${NAV_HEIGHT_PX}px; }`}</style>

        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            height:        '100vh',
            overflow:      'hidden',
            background:    'var(--bg-base)',
          }}
        >
          {/*
            PageNav renders nothing when location === '/auth' or '/login'.
            See NAV_HIDDEN_ON in page-nav.tsx.
          */}
          <PageNav />

          {/*
            Page area: fills remaining height after nav.
            overflow:hidden — each page owns its internal scroll.
            position:relative — scopes absolute children in page components.
            minHeight:0 — required to prevent flex child overflow.
          */}
          <div
            style={{
              flex:      1,
              overflow:  isDocumentPage ? 'auto' : 'hidden',
              position:  'relative',
              minHeight: 0,
            }}
          >
            <Switch>
              {/* ── Public ───────────────────────────────────────────────── */}
              <Route path="/auth"    component={AuthHtmlRedirect} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/login" component={AuthHtmlRedirect} />

              {/* ── Protected — ordered by user journey ──────────────────── */}
              <Route path="/instrument">
                <ProtectedRoute><InstrumentPage /></ProtectedRoute>
              </Route>

              <Route path="/daw">
                <ProtectedRoute><DAW /></ProtectedRoute>
              </Route>

              <Route path="/loopstation">
                <ProtectedRoute><LoopStation505 /></ProtectedRoute>
              </Route>

              {/* Multitrack DAW — R3 NATIVE Multitrack v1.3.0 */}
              <Route path="/multitrack">
                <ProtectedRoute><MultitrackV130 /></ProtectedRoute>
              </Route>

              {/* Collaborative DAW Pro — collaborative-daw-pro.jsx (WaveLab) */}
              <Route path="/collab">
                <ProtectedRoute><CollabDAWPro /></ProtectedRoute>
              </Route>

              {/* VST Plugin Browser — standalone page */}
              <Route path="/vst">
                <ProtectedRoute><VSTPage /></ProtectedRoute>
              </Route>

              {/* Multitrack View — multi-track-view.tsx (drag & drop, grouping, undo/redo) */}
              <Route path="/visuals">
                <ProtectedRoute><VisualsPage /></ProtectedRoute>
              </Route>
              <Route path="/visual">
                <ProtectedRoute><VisualsPage /></ProtectedRoute>
              </Route>

              {/* ── Subscribe ───────────────────────────────────────────── */}
              <Route path="/subscribe" component={SubscribePage} />

              {/* ── Root → Pricing (visitor entry point) ─────────────────── */}
              <Route path="/">
                <Redirect to="/pricing" />
              </Route>

              {/* ── Admin ────────────────────────────────────────────────── */}
              <Route path="/admin/agents">
                <ProtectedRoute><AdminAgentSuitePage /></ProtectedRoute>
              </Route>
              <Route path="/admin">
                <ProtectedRoute><AdminPage /></ProtectedRoute>
              </Route>
              {/* ── 404 ──────────────────────────────────────────────────── */}
              <Route component={NotFound} />
            </Switch>
          </div>
        </div>
        </ThemeProvider>
              </TrialGate>
      </SubscriptionProvider>
    </TRPCProvider>
  );
}