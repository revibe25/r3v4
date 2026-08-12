import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { TRPCProvider } from './lib/trpc';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ThemeProvider } from './components/theme-provider';
import { PageNav, NAV_HEIGHT_PX } from './components/page-nav';
import LoginPage from './pages/login';
import PricingPage from './pages/pricing/PricingPage';
import DAW from './pages/DAW';
import InstrumentPage from './pages/instrument';
import VSTPage from './pages/vst';
import { LoopStation505 } from './features/loopstation/LoopStation505';
import VisualsPage from './pages/visuals';
import NotFound from './pages/not-found';
import AdminPage from './pages/AdminPage';
import { AdminAgentSuitePage } from './pages/admin/AgentSuitePage';
import MultiTrackPanel from './components/multi-track-panel';
import CollabDAWPro from './pages/collaborative-daw-pro';
import MultitrackView from './components/multi-track-view';
import { useDAWStore } from './hooks/useDAWStore';
/** Maps store FXSlot.type → component FXType union (nearest semantic fit). */
const FX_TYPE_MAP = {
    eq: 'EQ',
    compressor: 'Compressor',
    reverb: 'Reverb',
    delay: 'Delay',
    filter: 'EQ', // no Filter in ViewTrack
    distortion: 'Saturation', // no Distortion in ViewTrack
};
/** Pure adapter: StoreTrack → ViewTrack. No side effects. */
function adaptTrack(t) {
    return {
        id: t.id,
        name: t.label,
        armed: t.armed,
        muted: t.mute,
        solo: t.solo,
        volume: t.gain,
        pan: t.pan,
        input: t.inputSource ?? '',
        fxChain: t.fxChain.map(fx => FX_TYPE_MAP[fx.type] ?? 'EQ'),
        meter: undefined,
        color: t.color,
        locked: false,
        hidden: false,
        groupId: undefined,
    };
}
/**
 * MultitrackViewWrapper
 * Connects useDAWStore to MultitrackView, satisfying all required props.
 * Replaces bare <MultitrackView /> at /mixer — tracks is never undefined.
 */
function MultitrackViewWrapper() {
    const { tracks, playing, recording, position, setPlaying, setRecording, updateTrack, removeTrack, addTrack, } = useDAWStore();
    return (_jsx(MultitrackView, { tracks: tracks.map(adaptTrack), transport: { isPlaying: playing, isRecording: recording, position }, onTogglePlay: () => setPlaying(!playing), onToggleRecord: () => setRecording(!recording), onArmTrack: (id) => updateTrack(id, { armed: !tracks.find(t => t.id === id)?.armed }), onToggleMute: (id) => updateTrack(id, { mute: !tracks.find(t => t.id === id)?.mute }), onToggleSolo: (id) => updateTrack(id, { solo: !tracks.find(t => t.id === id)?.solo }), onUpdateTrack: (id, data) => {
            const patch = {};
            if (data.name !== undefined)
                patch.label = data.name;
            if (data.volume !== undefined)
                patch.gain = data.volume;
            if (data.muted !== undefined)
                patch.mute = data.muted;
            if (data.armed !== undefined)
                patch.armed = data.armed;
            if (data.solo !== undefined)
                patch.solo = data.solo;
            if (data.pan !== undefined)
                patch.pan = data.pan;
            if (data.input !== undefined)
                patch.inputSource = data.input;
            updateTrack(id, patch);
        }, onDeleteTrack: (id) => removeTrack(id), onDuplicateTrack: (id) => {
            const src = tracks.find(t => t.id === id);
            if (src)
                addTrack({ ...src, label: `${src.label} (copy)` });
        } }));
}
export default function App() {
    return (_jsx(TRPCProvider, { children: _jsx(SubscriptionProvider, { children: _jsxs(ThemeProvider, { children: [_jsx("style", { children: `:root { --nav-h: ${NAV_HEIGHT_PX}px; }` }), _jsxs("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100vh',
                            overflow: 'hidden',
                            background: '#080808',
                        }, children: [_jsx(PageNav, {}), _jsx("div", { style: {
                                    flex: 1,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    minHeight: 0,
                                }, children: _jsxs(Switch, { children: [_jsx(Route, { path: "/auth", component: LoginPage }), _jsx(Route, { path: "/pricing", component: PricingPage }), _jsx(Route, { path: "/login", component: LoginPage }), _jsx(Route, { path: "/instrument", children: _jsx(ProtectedRoute, { children: _jsx(InstrumentPage, {}) }) }), _jsx(Route, { path: "/daw", children: _jsx(ProtectedRoute, { children: _jsx(DAW, {}) }) }), _jsx(Route, { path: "/loopstation", children: _jsx(ProtectedRoute, { children: _jsx(LoopStation505, {}) }) }), _jsx(Route, { path: "/multitrack", children: _jsx(ProtectedRoute, { children: _jsx(MultiTrackPanel, {}) }) }), _jsx(Route, { path: "/collab", children: _jsx(ProtectedRoute, { children: _jsx(CollabDAWPro, {}) }) }), _jsx(Route, { path: "/vst", children: _jsx(ProtectedRoute, { children: _jsx(VSTPage, {}) }) }), _jsx(Route, { path: "/mixer", children: _jsx(ProtectedRoute, { children: _jsx(MultitrackViewWrapper, {}) }) }), _jsx(Route, { path: "/visuals", children: _jsx(ProtectedRoute, { children: _jsx(VisualsPage, {}) }) }), _jsx(Route, { path: "/", children: _jsx(Redirect, { to: "/pricing" }) }), _jsx(Route, { path: "/admin", children: _jsx(ProtectedRoute, { children: _jsx(AdminPage, {}) }) }), _jsx(Route, { path: "/admin/agents", children: _jsx(ProtectedRoute, { children: _jsx(AdminAgentSuitePage, {}) }) }), _jsx(Route, { component: NotFound })] }) })] })] }) }) }));
}
