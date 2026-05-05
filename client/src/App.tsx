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
 *   /mixer         → MultitrackView           (protected — drag & drop mixer view)
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
 */

import React from 'react';
import { Switch, Route, Redirect } from 'wouter';
import { TRPCProvider }          from './lib/trpc';
import { ProtectedRoute }         from './components/ProtectedRoute';
import { SubscriptionProvider }   from './hooks/useSubscription';
import { ThemeProvider }          from './components/theme-provider';
import { PageNav, NAV_HEIGHT_PX } from './components/page-nav';

import LoginPage        from './pages/login';
import PricingPage        from './pages/pricing/PricingPage';
import DAW                from './pages/DAW';
import InstrumentPage     from './pages/instrument';
import VSTPage            from './pages/vst';
import { LoopStation505 } from './features/loopstation/LoopStation505';
import VisualsPage        from './pages/visuals';
import NotFound           from './pages/not-found';
import AdminPage          from './pages/AdminPage';
import { AdminAgentSuitePage } from './pages/admin/AgentSuitePage';
import MultiTrackPanel    from './pages/multi-track-panel';
import CollabDAWPro       from './pages/collaborative-daw-pro';
import MultitrackView     from './components/multi-track-view';
import { useDAWStore }    from './hooks/useDAWStore';

// ── /mixer route adapter ─────────────────────────────────────────────────────
// Bridges useDAWStore (StoreTrack shape) to MultitrackView (ViewTrack shape).
// Neither the store nor the component is modified — all adaptation is here.

import type { Track as StoreTrack } from './hooks/useDAWStore';
import type { Track as ViewTrack  } from './components/multi-track-view';

/** Maps store FXSlot.type → component FXType union (nearest semantic fit). */
const FX_TYPE_MAP: Record<string, ViewTrack['fxChain'][number]> = {
  eq:         'EQ',
  compressor: 'Compressor',
  reverb:     'Reverb',
  delay:      'Delay',
  filter:     'EQ',          // no Filter in ViewTrack
  distortion: 'Saturation',  // no Distortion in ViewTrack
};

/** Pure adapter: StoreTrack → ViewTrack. No side effects. */
function adaptTrack(t: StoreTrack): ViewTrack {
  return {
    id:      t.id,
    name:    t.label,
    armed:   t.armed,
    muted:   t.mute,
    solo:    t.solo,
    volume:  t.gain,
    pan:     t.pan,
    input:   t.inputSource ?? '',
    fxChain: t.fxChain.map(fx => FX_TYPE_MAP[fx.type] ?? 'EQ'),
    meter:   undefined,
    color:   t.color,
    locked:  false,
    hidden:  false,
    groupId: undefined,
  };
}

/**
 * MultitrackViewWrapper
 * Connects useDAWStore to MultitrackView, satisfying all required props.
 * Replaces bare <MultitrackView /> at /mixer — tracks is never undefined.
 */
function MultitrackViewWrapper() {
  const {
    tracks, playing, recording, position,
    setPlaying, setRecording, updateTrack, removeTrack, addTrack,
  } = useDAWStore();

  return (
    <MultitrackView
      tracks={tracks.map(adaptTrack)}
      transport={{ isPlaying: playing, isRecording: recording, position }}
      hideTransport={true}
      onTogglePlay={()    => setPlaying(!playing)}
      onToggleRecord={()  => setRecording(!recording)}
      onArmTrack={(id)    => updateTrack(id, { armed: !tracks.find(t => t.id === id)?.armed })}
      onToggleMute={(id)  => updateTrack(id, { mute:  !tracks.find(t => t.id === id)?.mute  })}
      onToggleSolo={(id)  => updateTrack(id, { solo:  !tracks.find(t => t.id === id)?.solo  })}
      onUpdateTrack={(id, data) => {
        const patch: Partial<StoreTrack> = {};
        if (data.name   !== undefined) patch.label       = data.name;
        if (data.volume !== undefined) patch.gain        = data.volume;
        if (data.muted  !== undefined) patch.mute        = data.muted;
        if (data.armed  !== undefined) patch.armed       = data.armed;
        if (data.solo   !== undefined) patch.solo        = data.solo;
        if (data.pan    !== undefined) patch.pan         = data.pan;
        if (data.input  !== undefined) patch.inputSource = data.input;
        updateTrack(id, patch);
      }}
      onDeleteTrack={(id)    => removeTrack(id)}
      onDuplicateTrack={(id) => {
        const src = tracks.find(t => t.id === id);
        if (src) addTrack({ ...src, label: `${src.label} (copy)` });
      }}
    />
  );
}

export default function App() {
  return (
    <TRPCProvider>
      {/*
        SubscriptionProvider inside TRPCProvider — it issues
        trpc.subscription.getMySubscription queries and needs React Query ctx.
      */}
      <SubscriptionProvider>
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
            background:    'var(--t-b0x)',
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
              overflow:  'hidden',
              position:  'relative',
              minHeight: 0,
            }}
          >
            <Switch>
              {/* ── Public ───────────────────────────────────────────────── */}
              <Route path="/auth"    component={LoginPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/login" component={LoginPage} />

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

              {/* Multitrack DAW — MultiTrackPanel (multi-track-panel.tsx is canonical, modular is dead) */}
              <Route path="/multitrack">
                <ProtectedRoute><MultiTrackPanel /></ProtectedRoute>
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
              <Route path="/mixer">
                <ProtectedRoute><MultitrackViewWrapper /></ProtectedRoute>
              </Route>

              <Route path="/visuals">
                <ProtectedRoute><VisualsPage /></ProtectedRoute>
              </Route>

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
      </SubscriptionProvider>
    </TRPCProvider>
  );
}