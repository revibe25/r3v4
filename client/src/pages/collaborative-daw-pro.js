import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCollabSocket } from '@/hooks/useCollabSocket';
import { useDAWStore } from '@/hooks/useDAWStore';
import { useMixSuggestions } from '@/hooks/useMixSuggestions';
import React, { useState, useRef, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { Play, Pause, Square, Plus, ZoomIn, ZoomOut, SkipBack, User, Download, Upload, Share2, Undo2, Redo2, Grid3x3, Volume2, VolumeX, Activity, Wifi, WifiOff, Copy, Trash2, Sliders, X, Zap, Radio, Lock, Music, Repeat2, } from 'lucide-react';
// ── Lazy panels ───────────────────────────────────────────────────────────────────────────
const VSTBrowser = lazy(() => import('@/components/vst-browser').then(m => ({ default: m.VSTBrowser })));
const LoopStation505 = lazy(() => import('@/features/loopstation/LoopStation505').then(m => ({ default: m.LoopStation505 })));
// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
    void: '#060606',
    space: '#0a0a0a',
    surface: '#0d0d0d',
    surfaceLift: '#0f0f0f',
    surfaceHover: 'var(--dj-surface3)',
    border: '#1c1c1c',
    borderBright: '#2a2a2a',
    neon: '#a3e635',
    neonGlow: 'rgba(163,230,53,0.5)',
    neonDim: 'rgba(163,230,53,0.08)',
    neonDim2: 'rgba(163,230,53,0.12)',
    acid2: 'var(--looper-lime)',
    cyan: '#00F5FF', // PRD §3 — active state cyan
    magenta: '#ff3b3b',
    yellow: '#ffcc00',
    purple: 'var(--accent-purple)',
    text: '#f0f0f0',
    textMuted: '#555555',
    textDim: 'var(--dj-dimmer)',
    tracks: [
        '#ff3b3b', '#a3e635', '#00F5FF', '#ffcc00',
        '#b048f8', '#ff6600', '#06ffa5', '#f72585', '#0088ff', '#f72585',
    ],
};
const FONT = {
    display: '"Syne", sans-serif',
    mono: '"IBM Plex Mono", monospace',
};
const TL = {
    trackHeight: 88,
    rulerHeight: 44,
    headerWidth: 232,
    gridWidth: 112,
    beatsPerBar: 4,
    minZoom: 0.25,
    maxZoom: 5,
    snapThreshold: 6,
};
// ─── Initial Data ─────────────────────────────────────────────────────────────
const INIT_PROJECT = {
    id: `proj_${Date.now()}`,
    name: 'Untitled Session',
    tempo: 128,
    timeSignature: [4, 4],
    tracks: [
        { id: 't1', name: 'Kick / Snare', color: C.tracks[0], muted: false, solo: false, volume: 0.82, pan: 0, armed: false, type: 'audio', sends: [], locked: false, fxChain: ['Compressor', 'EQ'] },
        { id: 't2', name: '808 Bass', color: C.tracks[1], muted: false, solo: false, volume: 0.76, pan: 0, armed: false, type: 'audio', sends: [], locked: false, fxChain: ['Compressor', 'Limiter'] },
        { id: 't3', name: 'Synth Lead', color: C.tracks[2], muted: false, solo: false, volume: 0.71, pan: 0.2, armed: false, type: 'audio', sends: [], locked: false, fxChain: ['Reverb', 'Delay'] },
        { id: 't4', name: 'Vox Chop', color: C.tracks[3], muted: false, solo: false, volume: 0.88, pan: -0.1, armed: false, type: 'audio', sends: [], locked: false, fxChain: ['Reverb', 'EQ'] },
        { id: 't5', name: 'Pad Texture', color: C.tracks[4], muted: false, solo: false, volume: 0.55, pan: 0.3, armed: false, type: 'audio', sends: [], locked: false, fxChain: ['Reverb'] },
    ],
    clips: [
        { id: 'c1', trackId: 't1', startBar: 0, durationBars: 4, name: 'Kick Pattern', gain: 1.0, fadeIn: 0, fadeOut: 0 },
        { id: 'c2', trackId: 't1', startBar: 4, durationBars: 8, name: 'Full Drums', gain: 1.0, fadeIn: 0.1, fadeOut: 0 },
        { id: 'c3', trackId: 't2', startBar: 2, durationBars: 10, name: '808 Bass', gain: 0.9, fadeIn: 0, fadeOut: 0.2 },
        { id: 'c4', trackId: 't3', startBar: 8, durationBars: 4, name: 'Lead A', gain: 1.0, fadeIn: 0, fadeOut: 0 },
        { id: 'c5', trackId: 't3', startBar: 12, durationBars: 4, name: 'Lead Variation', gain: 0.8, fadeIn: 0, fadeOut: 0 },
        { id: 'c6', trackId: 't4', startBar: 4, durationBars: 12, name: 'Verse 1', gain: 0.95, fadeIn: 0.05, fadeOut: 0.1 },
        { id: 'c7', trackId: 't5', startBar: 0, durationBars: 16, name: 'Pad Atmos', gain: 0.6, fadeIn: 0.5, fadeOut: 0.5 },
    ],
    markers: [
        { id: 'm1', bar: 0, name: 'INTRO', color: C.neon },
        { id: 'm2', bar: 4, name: 'VERSE', color: C.yellow },
        { id: 'm3', bar: 12, name: 'CHORUS', color: C.cyan },
        { id: 'm4', bar: 20, name: 'OUTRO', color: C.magenta },
    ],
};
// ─── Utilities ────────────────────────────────────────────────────────────────
const barsToPixels = (bars, gw) => bars * gw;
const pixelsToBars = (px, gw) => px / gw;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const formatTime = (bars, tempo, bpb) => {
    const secs = (bars * bpb * 60) / tempo;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};
const wfCache = new Map();
const getWaveform = (id, pts) => {
    const key = `${id}_${pts}`;
    if (!wfCache.has(key)) {
        const d = [];
        for (let i = 0; i < pts; i++) {
            const t = i / pts;
            d.push((Math.sin(t * Math.PI * 4 + Math.random()) * 0.6 + (Math.random() - 0.5) * 0.3) * Math.sin(t * Math.PI) * 0.85 + 0.08);
        }
        wfCache.set(key, d);
    }
    return wfCache.get(key);
};
const confidenceColor = (c) => {
    if (c >= 0.65)
        return C.neon;
    if (c >= 0.40)
        return C.yellow;
    return C.magenta;
};
// ─── Sub-components ───────────────────────────────────────────────────────────
const AgBtn = memo(({ children, onClick, disabled = false, active = false, activeColor = C.neon, title, style: sx, }) => (_jsx("button", { onClick: onClick, disabled: disabled, title: title, style: {
        background: active ? activeColor : 'transparent',
        border: `1px solid ${active ? activeColor : C.border}`,
        borderRadius: 0,
        color: active ? C.void : C.text,
        padding: '5px 9px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        transition: 'background .07s, border-color .07s, color .07s',
        outline: 'none',
        opacity: disabled ? 0.3 : 1,
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: active ? `0 0 10px ${activeColor}66` : 'none',
        flexShrink: 0,
        ...sx,
    }, onMouseEnter: e => { if (!disabled && !active) {
        e.currentTarget.style.background = C.neon;
        e.currentTarget.style.borderColor = C.neon;
        e.currentTarget.style.color = C.void;
    } }, onMouseLeave: e => { if (!disabled && !active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.color = C.text;
    } }, children: children })));
AgBtn.displayName = 'AgBtn';
const AgLabel = ({ children, style: sx }) => (_jsx("span", { style: { fontSize: 8, letterSpacing: '.3em', textTransform: 'uppercase', color: C.textMuted, fontFamily: FONT.mono, ...sx }, children: children }));
const Divider = () => (_jsx("div", { style: { width: 1, alignSelf: 'stretch', background: C.border, margin: '0 4px', flexShrink: 0 } }));
// VU Meter
const VUMeter = memo(({ level, color, peaked }) => (_jsx("div", { style: { display: 'flex', flexDirection: 'column-reverse', gap: 1, height: 48, width: 6 }, children: Array.from({ length: 12 }).map((_, i) => {
        const threshold = i / 12;
        const lit = level > threshold;
        const seg = i > 9 ? C.magenta : i > 7 ? C.yellow : color;
        return (_jsx("div", { style: {
                flex: 1, background: lit ? seg : C.border,
                boxShadow: lit && i > 9 ? `0 0 4px ${C.magenta}` : 'none',
                transition: 'background .06s',
            } }, i));
    }) })));
VUMeter.displayName = 'VUMeter';
// LLPTE confidence badge
const _ConfBadge = ({ confidence, label }) => {
    const col = confidenceColor(confidence);
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px',
            background: `${col}10`,
            border: `1px solid ${col}44`,
            fontSize: 8, fontFamily: FONT.mono, letterSpacing: '.1em',
        }, children: [_jsx("div", { style: { width: 5, height: 5, background: col, boxShadow: `0 0 6px ${col}` } }), _jsxs("span", { style: { color: col, fontWeight: 700 }, children: [Math.round(confidence * 100), "%"] }), _jsx("span", { style: { color: C.textMuted }, children: label })] }));
};
class DAWErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { error: null };
    }
    static getDerivedStateFromError(e) { return { error: e }; }
    componentDidCatch(e, _info) {
        window.dispatchEvent(new CustomEvent('daw:error', { detail: { error: e } }));
    }
    render() {
        if (this.state.error)
            return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
                    background: '#030303', flexDirection: 'column', gap: 16,
                    fontFamily: '"IBM Plex Mono",monospace' }, children: [_jsx("span", { style: { color: '#ff3b3b', fontSize: 11, letterSpacing: '.2em' }, children: "DAW RENDER ERROR" }), _jsx("span", { style: { color: '#555555', fontSize: 9 }, children: this.state.error.message }), _jsx("button", { onClick: () => this.setState({ error: null }), style: { marginTop: 8, padding: '6px 16px', background: '#a3e635',
                            border: 'none', cursor: 'pointer', fontSize: 9, letterSpacing: '.2em' }, children: "RESET" })] }));
        return this.props.children;
    }
}
export default function CollabDAWPro() {
    return _jsx(DAWErrorBoundary, { children: _jsx(CollabDAWProInner, {}) });
}
function CollabDAWProInner() {
    const [project, setProject] = useState(INIT_PROJECT);
    const [transport, setTransport] = useState('stopped');
    const [currentBar, setCurrentBar] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [selectedClipIds, setSelectedClipIds] = useState([]);
    const [selectedTrackId, setSelectedTrackId] = useState(null);
    const [collaborators, setCollaborators] = useState([]);
    const [activities, setActivities] = useState([
        { id: 1, user: 'You', action: 'Created session', timestamp: Date.now() - 300000, type: 'collab' },
        { id: 2, user: 'Alex Martinez', action: 'Joined session', timestamp: Date.now() - 240000, type: 'collab' },
        { id: 3, user: 'Jordan Kim', action: 'Added "808 Bass"', timestamp: Date.now() - 180000, type: 'edit' },
    ]);
    const [showActivity, setShowActivity] = useState(true);
    const [showMixer, setShowMixer] = useState(false);
    const [showAI, setShowAI] = useState(true);
    const [showVST, setShowVST] = useState(false);
    const [showLoopStation, setShowLoopStation] = useState(false);
    const [connStatus, setConnStatus] = useState('disconnected');
    const [metronome, setMetronome] = useState(false);
    const [snapGrid, setSnapGrid] = useState(true);
    const [loopOn, setLoopOn] = useState(false);
    const [loopRegion, setLoopRegion] = useState({ start: 0, end: 16 });
    const [masterVol, setMasterVol] = useState(0.82);
    const [masterMuted, setMasterMuted] = useState(false);
    const [hoveredClipId, setHoveredClipId] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [history, setHistory] = useState([INIT_PROJECT]);
    const [historyIdx, setHistoryIdx] = useState(0);
    // ── AI suggestions — live LLPTE via useMixSuggestions ─────────────────────
    const mixAI = useMixSuggestions();
    const suggestions = (mixAI.suggestions ?? []).map((s, i) => ({
        id: `ms_${i}`,
        trackId: 'mix',
        type: (() => {
            switch (s.type) {
                case 'arrangement': return 'transition';
                case 'mastering': return 'eq_suggest';
                case 'harmony': return 'conflict_flag';
                default: return 'gain_adjust';
            }
        })(),
        confidence: s.confidence,
        displayedConfidence: s.confidence,
        decision: s.params,
        outcome: (mixAI.acceptedIds.has(i)
            ? 'accepted'
            : mixAI.rejectedIds.has(i)
                ? 'rejected'
                : 'ignored'),
        label: s.description,
    }));
    const llpteLatency = mixAI.latencyMs ?? 0;
    // ── WebSocket collab — wired to useCollabSocket + useDAWStore ──────────────
    const collab = useCollabSocket();
    const collabUsers = useDAWStore((s) => s.collabUsers);
    const storeConnected = useDAWStore((s) => s.collabConnected);
    // Sync WebSocket peer list into local collaborator display state
    useEffect(() => {
        setCollaborators(collabUsers.map((u) => ({
            id: u.id,
            name: u.name,
            color: u.color,
            cursor: { x: 0, y: 0 },
            status: 'active',
            lastAction: `Online since ${new Date(u.joinedAt).toLocaleTimeString()}`,
            timestamp: u.joinedAt,
            editingTrackId: u.activeTrackId ?? undefined,
        })));
    }, [collabUsers]);
    // Sync WebSocket connection flag → connStatus display
    useEffect(() => {
        setConnStatus(storeConnected ? 'connected' : 'disconnected');
    }, [storeConnected]);
    // Auto-join default collab room on mount; leave cleanly on unmount
    useEffect(() => {
        const userId = crypto.randomUUID().slice(0, 8);
        const palette = [C.neon, C.cyan, C.magenta, C.yellow];
        const color = palette[Math.floor(Math.random() * palette.length)];
        collab.joinRoom('COLLAB-MAIN', userId, `USER_${userId.slice(0, 4)}`, color);
        return () => { collab.leaveRoom(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const [cpuLoad, setCpuLoad] = useState(0.38);
    const [vuLevels, setVuLevels] = useState({});
    const [peakedTracks, setPeakedTracks] = useState(new Set());
    const [toasts, setToasts] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [, _tickTs] = useState(0);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const rafRef = useRef(null);
    const startTimeRef = useRef(null);
    const lastRenderRef = useRef(0);
    const dragRef = useRef(null);
    const [dragPreview, setDragPreview] = useState(null);
    const gridWidth = TL.gridWidth * zoom;
    // ── Toast helper ────────────────────────────────────────────────────────────
    const toast = useCallback((msg, type = 'info') => {
        const id = Date.now();
        setToasts(p => [...p, { id, msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    }, []);
    // ── Activity feed ───────────────────────────────────────────────────────────
    const addActivity = useCallback((action, user = 'You', type = 'edit') => {
        setActivities(p => [{ id: Date.now(), user, action, timestamp: Date.now(), type }, ...p].slice(0, 60));
    }, []);
    // ── Transport ────────────────────────────────────────────────────────────────
    const play = useCallback(() => {
        setTransport('playing');
        startTimeRef.current = performance.now() - (currentBar * (60 / project.tempo) * TL.beatsPerBar * 1000);
        addActivity('Started playback', 'You', 'transport');
    }, [currentBar, project.tempo, addActivity]);
    const pause = useCallback(() => {
        setTransport('paused');
        addActivity('Paused', 'You', 'transport');
    }, [addActivity]);
    const stop = useCallback(() => {
        setTransport('stopped');
        setCurrentBar(0);
        startTimeRef.current = null;
        addActivity('Stopped', 'You', 'transport');
    }, [addActivity]);
    const togglePlay = useCallback(() => {
        transport === 'playing' ? pause() : play();
    }, [transport, pause, play]);
    // Playback loop
    useEffect(() => {
        if (transport === 'playing') {
            const tick = () => {
                const elapsed = performance.now() - (startTimeRef.current ?? performance.now());
                const bps = project.tempo / 60;
                let bars = (elapsed / 1000) / TL.beatsPerBar * bps;
                if (loopOn) {
                    const len = loopRegion.end - loopRegion.start;
                    while (bars >= loopRegion.end) {
                        bars -= len;
                        if (startTimeRef.current !== null)
                            startTimeRef.current += (len * TL.beatsPerBar * 60 / project.tempo * 1000);
                    }
                }
                setCurrentBar(bars);
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        }
        else {
            if (rafRef.current)
                cancelAnimationFrame(rafRef.current);
        }
        return () => { if (rafRef.current)
            cancelAnimationFrame(rafRef.current); };
    }, [transport, project.tempo, loopOn, loopRegion]);
    // CPU + VU simulation
    useEffect(() => {
        const interval = setInterval(() => {
            setCpuLoad(transport === 'playing' ? 0.35 + Math.random() * 0.25 : 0.08 + Math.random() * 0.1);
            if (transport === 'playing') {
                const levels = {};
                project.tracks.forEach(t => {
                    if (t.muted) {
                        levels[t.id] = 0;
                        return;
                    }
                    levels[t.id] = clamp((Math.random() * 0.7 + 0.2) * t.volume, 0, 1);
                });
                setVuLevels(levels);
                const peaked = new Set(project.tracks
                    .filter(t => !t.muted && (levels[t.id] ?? 0) > 0.93)
                    .map(t => t.id));
                if (peaked.size) {
                    setPeakedTracks(prev => new Set([...prev, ...peaked]));
                    setTimeout(() => setPeakedTracks(new Set()), 1500);
                }
            }
            else {
                const levels = {};
                project.tracks.forEach(t => { levels[t.id] = 0; });
                setVuLevels(levels);
            }
        }, 80);
        return () => clearInterval(interval);
    }, [transport, project.tracks]);
    // Simulated collab activity
    useEffect(() => {
        if (collabUsers.length === 0)
            return; // No collaborators to simulate
        const interval = setInterval(() => {
            if (Math.random() > 0.65) {
                const user = collabUsers[Math.floor(Math.random() * collabUsers.length)];
                const actions = ["Adjusted fader", "Moved clip", "Added FX", "Muted track", "Set loop"];
                const action = actions[Math.floor(Math.random() * actions.length)];
                addActivity(action, user.name, "edit");
                setCollaborators(p => p.map(c => c.id === user.id
                    ? { ...c, cursor: { x: 200 + Math.random() * 800, y: 80 + Math.random() * 400 }, lastAction: action, timestamp: Date.now() }
                    : c));
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [collabUsers, addActivity]);
    // ── Timestamp ticker ──────────────────────────────────────────────────────
    useEffect(() => {
        const id = setInterval(() => _tickTs(n => n + 1), 8000);
        return () => clearInterval(id);
    }, []);
    // ── History ───────────────────────────────────────────────────────────────────
    const pushHistory = useCallback((next) => {
        const h = history.slice(0, historyIdx + 1);
        h.push(next);
        setHistory(h);
        setHistoryIdx(h.length - 1);
        setProject(next);
    }, [history, historyIdx]);
    const undo = useCallback(() => {
        if (historyIdx > 0) {
            setHistoryIdx(i => i - 1);
            setProject(history[historyIdx - 1]);
            addActivity('Undo');
        }
    }, [history, historyIdx, addActivity]);
    const redo = useCallback(() => {
        if (historyIdx < history.length - 1) {
            setHistoryIdx(i => i + 1);
            setProject(history[historyIdx + 1]);
            addActivity('Redo');
        }
    }, [history, historyIdx, addActivity]);
    // ── Track ops ──────────────────────────────────────────────────────────────────
    const addTrack = useCallback(() => {
        const t = {
            id: `t${Date.now()}`, name: `Track ${project.tracks.length + 1}`,
            color: C.tracks[project.tracks.length % C.tracks.length],
            muted: false, solo: false, volume: 0.8, pan: 0, armed: false,
            type: 'audio', sends: [], locked: false, fxChain: ['EQ'],
        };
        pushHistory({ ...project, tracks: [...project.tracks, t] });
        addActivity(`Added track "${t.name}"`);
    }, [project, pushHistory, addActivity]);
    const _deleteTrack = useCallback((id) => {
        const t = project.tracks.find(x => x.id === id);
        pushHistory({ ...project, tracks: project.tracks.filter(x => x.id !== id), clips: project.clips.filter(c => c.trackId !== id) });
        addActivity(`Deleted "${t?.name}"`);
    }, [project, pushHistory, addActivity]);
    const updateTrack = useCallback((id, patch) => {
        pushHistory({ ...project, tracks: project.tracks.map(t => t.id === id ? { ...t, ...patch } : t) });
    }, [project, pushHistory]);
    const toggleMute = useCallback((id) => {
        const t = project.tracks.find(x => x.id === id);
        if (!t)
            return;
        updateTrack(id, { muted: !t.muted });
        addActivity(`${t.muted ? 'Unmuted' : 'Muted'} "${t.name}"`);
    }, [project.tracks, updateTrack, addActivity]);
    const toggleSolo = useCallback((id) => {
        const t = project.tracks.find(x => x.id === id);
        if (!t)
            return;
        updateTrack(id, { solo: !t.solo });
        addActivity(`${t.solo ? 'Unsoloed' : 'Soloed'} "${t.name}"`);
    }, [project.tracks, updateTrack, addActivity]);
    // ── Clip ops ──────────────────────────────────────────────────────────────────
    const deleteClip = useCallback((id) => {
        const c = project.clips.find(x => x.id === id);
        pushHistory({ ...project, clips: project.clips.filter(x => x.id !== id) });
        setSelectedClipIds(p => p.filter(x => x !== id));
        addActivity(`Deleted "${c?.name}"`);
    }, [project, pushHistory, selectedClipIds, addActivity]);
    const duplicateClip = useCallback((id) => {
        const c = project.clips.find(x => x.id === id);
        if (!c)
            return;
        const nc = { ...c, id: `c${Date.now()}`, startBar: c.startBar + c.durationBars, name: `${c.name} (Copy)` };
        pushHistory({ ...project, clips: [...project.clips, nc] });
        addActivity(`Duplicated "${c.name}"`);
    }, [project, pushHistory, addActivity]);
    const _updateClip = useCallback((id, patch) => {
        pushHistory({ ...project, clips: project.clips.map(c => c.id === id ? { ...c, ...patch } : c) });
    }, [project, pushHistory]);
    // ── AI suggestion ops ──────────────────────────────────────────────────────────
    // TODO(collab-pro-tier): aiDecisionLog metrics not wired on this surface.
    //
    // Previous logSuggestionOutcome implementation called a deprecated tRPC
    // endpoint (aiMix.submitSuggestionOutcome) that never existed, AND passed
    // a local suggestion ID where the server expects an aiDecisionLog row ID.
    // Both bugs deleted.
    //
    // When Pro Artist collab tier ships, migrate to the canonical hook
    // `useMixSuggestions` (see client/src/hooks/useMixSuggestions.ts) — it
    // surfaces decisions via sessionMetrics.recordDecision and updates them
    // via sessionMetrics.recordOutcome with proper decisionId tracking.
    const acceptSuggestion = useCallback((id) => {
        const idx = parseInt(id.replace('ms_', ''), 10);
        if (!isNaN(idx)) {
            mixAI.accept(idx);
            toast('AI suggestion applied', 'ai');
            addActivity('Applied AI suggestion', 'You', 'ai');
        }
    }, [mixAI, toast, addActivity]);
    const rejectSuggestion = useCallback((id) => {
        const idx = parseInt(id.replace('ms_', ''), 10);
        if (!isNaN(idx))
            mixAI.reject(idx);
    }, [mixAI]);
    // ── On-demand LLPTE analysis triggered from AI panel ──────────────────────
    const runAIAnalysis = useCallback(() => {
        const trackInputs = project.tracks.map((t) => ({
            id: t.id,
            gain: t.volume,
            pan: t.pan,
            mute: t.muted,
            solo: t.solo,
        }));
        mixAI.analyse(trackInputs, project.tempo, currentBar);
        addActivity('Ran LLPTE analysis', 'You', 'ai');
        toast('Analysing mix…', 'ai');
    }, [project.tracks, project.tempo, currentBar, mixAI, addActivity, toast]);
    // ── Keyboard shortcuts ─────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.matches('input,textarea'))
                return;
            const mod = e.metaKey || e.ctrlKey;
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }
            if (e.code === 'Escape') {
                e.preventDefault();
                stop();
            }
            if (mod && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if (mod && e.code === 'KeyZ' && e.shiftKey) {
                e.preventDefault();
                redo();
            }
            if ((e.code === 'Delete' || e.code === 'Backspace') && selectedClipIds.length) {
                e.preventDefault();
                selectedClipIds.forEach(deleteClip);
            }
            if (mod && e.code === 'KeyD' && selectedClipIds.length) {
                e.preventDefault();
                selectedClipIds.forEach(duplicateClip);
            }
            if (mod && e.code === 'KeyA') {
                e.preventDefault();
                setSelectedClipIds(project.clips.map(c => c.id));
            }
            if (mod && e.code === 'Equal') {
                e.preventDefault();
                setZoom(z => Math.min(z + 0.2, TL.maxZoom));
            }
            if (mod && e.code === 'Minus') {
                e.preventDefault();
                setZoom(z => Math.max(z - 0.2, TL.minZoom));
            }
            if (mod && e.code === 'Digit0') {
                e.preventDefault();
                setZoom(1);
            }
            if (e.code === 'KeyM') {
                e.preventDefault();
                setMetronome(v => !v);
            }
            if (e.code === 'KeyL') {
                e.preventDefault();
                setLoopOn(v => !v);
            }
            if (e.code === 'KeyG') {
                e.preventDefault();
                setSnapGrid(v => !v);
            }
            if (mod && e.code === 'KeyT') {
                e.preventDefault();
                addTrack();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [togglePlay, stop, undo, redo, selectedClipIds, deleteClip, duplicateClip, project.clips, addTrack]);
    // ── Canvas rendering ──────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const now = performance.now();
        if (now - lastRenderRef.current < 14)
            return;
        lastRenderRef.current = now;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx)
            return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const nw = Math.round(rect.width * dpr);
        const nh = Math.round(rect.height * dpr);
        if (canvas.width !== nw || canvas.height !== nh) {
            canvas.width = nw;
            canvas.height = nh;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const W = rect.width, H = rect.height;
        ctx.fillStyle = C.space;
        ctx.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 4) {
            ctx.fillStyle = 'rgba(255,255,255,0.008)';
            ctx.fillRect(0, y, W, 1);
        }
        drawRuler(ctx, W);
        project.tracks.forEach((track, idx) => {
            const ty = TL.rulerHeight + idx * TL.trackHeight - scrollTop;
            if (ty + TL.trackHeight < 0 || ty > H)
                return;
            drawTrack(ctx, track, ty, W, track.id === selectedTrackId);
            project.clips
                .filter(c => c.trackId === track.id)
                .forEach(c => {
                if (dragPreview?.clipId === c.id)
                    return;
                const cx = barsToPixels(c.startBar, gridWidth) - scrollLeft;
                const cw = barsToPixels(c.durationBars, gridWidth);
                if (cx + cw < 0 || cx > W)
                    return;
                drawClip(ctx, c, track, ty, selectedClipIds.includes(c.id), c.id === hoveredClipId);
            });
        });
        if (dragPreview) {
            const dc = project.clips.find(c => c.id === dragPreview.clipId);
            const dt = project.tracks.find(t => t.id === dragPreview.trackId);
            const didx = project.tracks.findIndex(t => t.id === dragPreview.trackId);
            if (dc && dt && didx >= 0) {
                const dty = TL.rulerHeight + didx * TL.trackHeight - scrollTop;
                const dcx = barsToPixels(dragPreview.startBar, gridWidth) - scrollLeft;
                const dcw = barsToPixels(dc.durationBars, gridWidth);
                if (dcx + dcw >= 0 && dcx <= W) {
                    ctx.globalAlpha = 0.82;
                    drawClip(ctx, { ...dc, startBar: dragPreview.startBar }, dt, dty, true, false);
                    ctx.globalAlpha = 1;
                }
            }
        }
        project.markers.forEach(m => drawMarker(ctx, m, H));
        drawPlayhead(ctx, H);
        if (loopOn)
            drawLoop(ctx, H);
        collaborators.filter(c => c.status === 'active').forEach(c => drawCursor(ctx, c));
    }, [project, currentBar, zoom, scrollLeft, scrollTop, selectedClipIds, selectedTrackId, collaborators, gridWidth, hoveredClipId, loopOn, loopRegion, dragPreview]);
    const drawRuler = (ctx, W) => {
        ctx.fillStyle = C.surface;
        ctx.fillRect(0, 0, W, TL.rulerHeight);
        ctx.fillStyle = C.neon;
        ctx.fillRect(0, 0, 3, TL.rulerHeight);
        ctx.fillRect(0, TL.rulerHeight - 2, W, 2);
        ctx.font = `600 10px ${FONT.mono}`;
        ctx.textAlign = 'center';
        const total = Math.ceil((W + scrollLeft) / gridWidth) + 2;
        const start = Math.floor(scrollLeft / gridWidth);
        for (let i = start; i < start + total; i++) {
            const x = i * gridWidth - scrollLeft;
            ctx.strokeStyle = i % 4 === 0 ? C.borderBright : C.border;
            ctx.lineWidth = i % 4 === 0 ? 1.5 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, TL.rulerHeight);
            ctx.stroke();
            if (i % 2 === 0) {
                ctx.fillStyle = C.neon;
                ctx.fillText(String(i + 1), x + gridWidth / 2, TL.rulerHeight - 10);
            }
            for (let b = 1; b < TL.beatsPerBar; b++) {
                const bx = x + b * gridWidth / TL.beatsPerBar;
                ctx.strokeStyle = C.border;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(bx, TL.rulerHeight - 8);
                ctx.lineTo(bx, TL.rulerHeight);
                ctx.stroke();
            }
        }
    };
    const drawTrack = (ctx, track, ty, W, sel) => {
        ctx.fillStyle = sel ? C.surfaceLift : C.surface;
        ctx.fillRect(0, ty, W, TL.trackHeight);
        ctx.strokeStyle = sel ? C.neon : C.border;
        ctx.lineWidth = sel ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, ty + TL.trackHeight - 0.5);
        ctx.lineTo(W, ty + TL.trackHeight - 0.5);
        ctx.stroke();
        ctx.fillStyle = track.color;
        ctx.fillRect(0, ty, 3, TL.trackHeight);
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = C.borderBright;
        ctx.lineWidth = 0.5;
        const ts = Math.floor(scrollLeft / gridWidth), te = Math.ceil((W + scrollLeft) / gridWidth) + 2;
        for (let i = ts; i < te; i++) {
            const x = i * gridWidth - scrollLeft;
            ctx.beginPath();
            ctx.moveTo(x, ty);
            ctx.lineTo(x, ty + TL.trackHeight);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (track.muted) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, ty, W, TL.trackHeight);
        }
    };
    const drawClip = (ctx, clip, track, ty, sel, hov) => {
        const x = barsToPixels(clip.startBar, gridWidth) - scrollLeft;
        const cw = barsToPixels(clip.durationBars, gridWidth);
        const cy = ty + 6;
        const ch = TL.trackHeight - 12;
        const g = ctx.createLinearGradient(x, cy, x, cy + ch);
        if (sel) {
            g.addColorStop(0, `${track.color}66`);
            g.addColorStop(1, `${track.color}22`);
        }
        else {
            g.addColorStop(0, `${track.color}30`);
            g.addColorStop(1, `${track.color}10`);
        }
        ctx.fillStyle = g;
        ctx.fillRect(x, cy, cw, ch);
        if (hov || sel) {
            ctx.shadowColor = track.color;
            ctx.shadowBlur = sel ? 12 : 6;
        }
        ctx.strokeStyle = sel ? C.neon : track.color;
        ctx.lineWidth = sel ? 1.5 : 1;
        ctx.strokeRect(x + 0.5, cy + 0.5, cw - 1, ch - 1);
        ctx.shadowBlur = 0;
        const wpts = Math.max(20, Math.min(180, Math.floor(cw / 2)));
        const wf = getWaveform(clip.id, wpts);
        ctx.strokeStyle = `${C.neon}60`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        wf.forEach((a, i) => {
            const wx = x + (i / wf.length) * cw, wy = cy + ch / 2, wh = a * (ch * 0.65);
            i === 0 ? ctx.moveTo(wx, wy - wh / 2) : ctx.lineTo(wx, wy - wh / 2);
        });
        ctx.stroke();
        ctx.beginPath();
        wf.forEach((a, i) => {
            const wx = x + (i / wf.length) * cw, wy = cy + ch / 2, wh = a * (ch * 0.65);
            i === 0 ? ctx.moveTo(wx, wy + wh / 2) : ctx.lineTo(wx, wy + wh / 2);
        });
        ctx.stroke();
        ctx.lineWidth = 1;
        if (clip.fadeIn > 0) {
            const fw = barsToPixels(clip.fadeIn, gridWidth);
            ctx.fillStyle = `${track.color}25`;
            ctx.beginPath();
            ctx.moveTo(x, cy);
            ctx.lineTo(x + fw, cy);
            ctx.lineTo(x + fw, cy + ch);
            ctx.lineTo(x, cy + ch);
            ctx.closePath();
            ctx.fill();
        }
        if (clip.fadeOut > 0) {
            const fw = barsToPixels(clip.fadeOut, gridWidth);
            ctx.fillStyle = `${track.color}25`;
            ctx.beginPath();
            ctx.moveTo(x + cw, cy);
            ctx.lineTo(x + cw - fw, cy);
            ctx.lineTo(x + cw - fw, cy + ch);
            ctx.lineTo(x + cw, cy + ch);
            ctx.closePath();
            ctx.fill();
        }
        if (cw > 48) {
            ctx.fillStyle = `${C.surface}D0`;
            ctx.fillRect(x + 8, cy + 5, Math.min(cw - 16, 120), 16);
            ctx.fillStyle = C.text;
            ctx.font = `500 9px ${FONT.mono}`;
            ctx.textAlign = 'left';
            ctx.fillText(clip.name, x + 12, cy + 16, cw - 24);
        }
    };
    const drawMarker = (ctx, m, H) => {
        const x = barsToPixels(m.bar, gridWidth) - scrollLeft;
        const col = m.color ?? C.yellow;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, TL.rulerHeight);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, TL.rulerHeight);
        ctx.lineTo(x + 10, TL.rulerHeight + 6);
        ctx.lineTo(x, TL.rulerHeight + 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = C.surface;
        ctx.fillRect(x + 12, TL.rulerHeight + 1, m.name.length * 7 + 12, 16);
        ctx.fillStyle = col;
        ctx.font = `700 9px ${FONT.mono}`;
        ctx.textAlign = 'left';
        ctx.fillText(m.name, x + 16, TL.rulerHeight + 12);
        ctx.lineWidth = 1;
    };
    const drawPlayhead = (ctx, H) => {
        const x = barsToPixels(currentBar, gridWidth) - scrollLeft;
        ctx.shadowColor = C.neon;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = C.neon;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, TL.rulerHeight);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = C.neon;
        ctx.beginPath();
        ctx.moveTo(x - 9, TL.rulerHeight);
        ctx.lineTo(x + 9, TL.rulerHeight);
        ctx.lineTo(x, TL.rulerHeight + 14);
        ctx.closePath();
        ctx.fill();
        const label = formatTime(currentBar, project.tempo, TL.beatsPerBar);
        ctx.fillStyle = C.surface;
        ctx.fillRect(x - 38, TL.rulerHeight + 17, 76, 19);
        ctx.strokeStyle = C.neon;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - 38, TL.rulerHeight + 17, 76, 19);
        ctx.fillStyle = C.neon;
        ctx.font = `700 10px ${FONT.mono}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, TL.rulerHeight + 30);
        ctx.lineWidth = 1;
    };
    const drawLoop = (ctx, H) => {
        const sx = barsToPixels(loopRegion.start, gridWidth) - scrollLeft;
        const ex = barsToPixels(loopRegion.end, gridWidth) - scrollLeft;
        ctx.fillStyle = `${C.cyan}0E`;
        ctx.fillRect(sx, TL.rulerHeight, ex - sx, H - TL.rulerHeight);
        [sx, ex].forEach((x, i) => {
            ctx.strokeStyle = C.cyan;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, TL.rulerHeight);
            ctx.lineTo(x, H);
            ctx.stroke();
            ctx.fillStyle = C.cyan;
            ctx.beginPath();
            i === 0 ? (ctx.moveTo(x, TL.rulerHeight), ctx.lineTo(x + 10, TL.rulerHeight + 6), ctx.lineTo(x, TL.rulerHeight + 12))
                : (ctx.moveTo(x, TL.rulerHeight), ctx.lineTo(x - 10, TL.rulerHeight + 6), ctx.lineTo(x, TL.rulerHeight + 12));
            ctx.closePath();
            ctx.fill();
        });
        ctx.lineWidth = 1;
    };
    const drawCursor = (ctx, c) => {
        const { x, y } = c.cursor;
        ctx.fillStyle = c.color;
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12, y + 5);
        ctx.lineTo(x + 5, y + 12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        const lw = c.name.split(' ').map(n => n[0]).join('') + '  ' + c.name;
        ctx.fillStyle = `${c.color}E0`;
        ctx.fillRect(x + 14, y - 2, lw.length * 6 + 14, 20);
        ctx.fillStyle = C.void;
        ctx.font = `700 9px ${FONT.mono}`;
        ctx.textAlign = 'left';
        ctx.fillText(c.name.split(' ').map(n => n[0]).join('') + '  ' + c.lastAction, x + 20, y + 12, 160);
    };
    // ── Canvas interactions ───────────────────────────────────────────────────────
    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left + scrollLeft;
        const cy = e.clientY - rect.top + scrollTop;
        let hit = null;
        project.tracks.forEach((t, idx) => {
            const ty = TL.rulerHeight + idx * TL.trackHeight;
            project.clips.filter(c => c.trackId === t.id).forEach(c => {
                const x = barsToPixels(c.startBar, gridWidth), w = barsToPixels(c.durationBars, gridWidth);
                if (cx >= x && cx <= x + w && cy >= ty + 6 && cy <= ty + TL.trackHeight - 6)
                    hit = c.id;
            });
        });
        if (hit) {
            const h = hit;
            e.metaKey || e.ctrlKey
                ? setSelectedClipIds(p => p.includes(h) ? p.filter(x => x !== h) : [...p, h])
                : !selectedClipIds.includes(h) && setSelectedClipIds([h]);
        }
        else {
            setSelectedClipIds([]);
        }
        if (cy < TL.rulerHeight) {
            let bar = pixelsToBars(cx, gridWidth);
            if (snapGrid)
                bar = Math.round(bar);
            setCurrentBar(bar);
            if (transport === 'playing' && startTimeRef.current !== null)
                startTimeRef.current = performance.now() - (bar * (60 / project.tempo) * TL.beatsPerBar * 1000);
        }
    };
    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left + scrollLeft;
        const cy = e.clientY - rect.top + scrollTop;
        if (dragRef.current) {
            const drag = dragRef.current;
            const dxBars = pixelsToBars(cx - drag.startX, gridWidth);
            const newBar = Math.max(0, drag.origStartBar + dxBars);
            const trackIdx = Math.max(0, Math.min(project.tracks.length - 1, Math.floor((cy - TL.rulerHeight) / TL.trackHeight)));
            const newTrackId = project.tracks[trackIdx]?.id ?? drag.origTrackId;
            setDragPreview({ clipId: drag.clipId, startBar: newBar, trackId: newTrackId });
            return;
        }
        let hov = null;
        project.tracks.forEach((t, idx) => {
            const ty = TL.rulerHeight + idx * TL.trackHeight;
            project.clips.filter(c => c.trackId === t.id).forEach(c => {
                const x = barsToPixels(c.startBar, gridWidth), w = barsToPixels(c.durationBars, gridWidth);
                if (cx >= x && cx <= x + w && cy >= ty + 6 && cy <= ty + TL.trackHeight - 6)
                    hov = c.id;
            });
        });
        setHoveredClipId(hov);
    };
    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left + scrollLeft;
        const cy = e.clientY - rect.top + scrollTop;
        if (cy < TL.rulerHeight)
            return;
        let hit = null;
        project.tracks.forEach((t, idx) => {
            const ty = TL.rulerHeight + idx * TL.trackHeight;
            project.clips.filter(c => c.trackId === t.id).forEach(c => {
                const x = barsToPixels(c.startBar, gridWidth), w = barsToPixels(c.durationBars, gridWidth);
                if (cx >= x && cx <= x + w && cy >= ty + 6 && cy <= ty + TL.trackHeight - 6)
                    hit = c.id;
            });
        });
        if (!hit)
            return;
        const clip = project.clips.find(c => c.id === hit);
        dragRef.current = { clipId: hit, origStartBar: clip.startBar, origTrackId: clip.trackId, startX: cx, startY: cy };
        setDragPreview({ clipId: hit, startBar: clip.startBar, trackId: clip.trackId });
        e.preventDefault();
    };
    const handleMouseUp = (_e) => {
        const drag = dragRef.current;
        if (!drag || !dragPreview) {
            dragRef.current = null;
            setDragPreview(null);
            return;
        }
        dragRef.current = null;
        const finalBar = Math.max(0, snapGrid ? Math.round(dragPreview.startBar) : dragPreview.startBar);
        pushHistory({
            ...project,
            clips: project.clips.map(c => c.id === drag.clipId ? { ...c, startBar: finalBar, trackId: dragPreview.trackId } : c),
        });
        setDragPreview(null);
    };
    const totalTH = project.tracks.length * TL.trackHeight + TL.rulerHeight;
    // ─── Ticker items ──────────────────────────────────────────────────────────
    const TICKER_ITEMS = [
        'R3 Native', 'Web Audio API', 'Offline-First', 'MIDI Support', 'Polyphony',
        'Accessible', 'MultiTrack DAW', 'VST System', 'LLPTE Engine', 'Collaborative',
    ];
    // ─── Render ───────────────────────────────────────────────────────────────────
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

        /* ── Acid Grid header classes (ported from instrument.tsx) ────────── */
        .ag-header {
          border-bottom: 3px solid var(--ag-border, #1c1c1c);
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,.6);
          flex-shrink: 0;
          z-index: 100;
        }
        .ag-header-top {
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid var(--ag-border, #1c1c1c);
        }
        .ag-ghost-bpm {
          position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
          font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: clamp(56px, 9vw, 110px);
          color: transparent; -webkit-text-stroke: 1px rgba(163,230,53,0.04);
          letter-spacing: -0.04em; pointer-events: none; user-select: none; z-index: 0;
        }
        .ag-wordmark-block {
          padding: 12px 20px 10px;
          border-right: 1px solid var(--ag-border, #1c1c1c);
          display: flex; flex-direction: column; justify-content: center;
          min-width: 176px; position: relative; z-index: 1; flex-shrink: 0;
        }
        .ag-wordmark {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px;
          letter-spacing: -0.02em; color: var(--ag-white, #f0f0f0); line-height: 1;
        }
        .ag-wordmark-slash {
          color: var(--ag-acid, #a3e635); margin: 0 2px; font-size: 26px;
          line-height: .9; text-shadow: 0 0 14px #a3e635;
        }
        .ag-wordmark-sub {
          font-size: 7px; letter-spacing: .4em; text-transform: uppercase;
          color: var(--ag-mid, #555); margin-top: 4px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-status-block {
          padding: 10px 14px;
          border-right: 1px solid var(--ag-border, #1c1c1c);
          display: flex; flex-direction: column; justify-content: center;
          gap: 5px; z-index: 1; flex-shrink: 0;
        }
        .ag-status-line {
          font-size: 8px; letter-spacing: .2em; text-transform: uppercase;
          display: flex; align-items: center; gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-cursor-live {
          display: inline-block; width: 7px; height: 12px;
          background: var(--ag-acid, #a3e635); box-shadow: 0 0 8px #a3e635;
          animation: ag-blink 1s step-end infinite; flex-shrink: 0;
        }
        .ag-cursor-standby {
          display: inline-block; width: 7px; height: 12px;
          background: #555; flex-shrink: 0;
        }
        .ag-status-live-text  { color: var(--ag-acid, #a3e635); }
        .ag-status-dead-text  { color: #ff3b3b; }
        .ag-bpm-block {
          padding: 0 16px;
          border-right: 1px solid var(--ag-border, #1c1c1c);
          display: flex; align-items: center; gap: 10px; z-index: 1; flex-shrink: 0;
        }
        .ag-bpm-label {
          font-size: 7px; letter-spacing: .3em; color: var(--ag-mid, #555);
          text-transform: uppercase; writing-mode: vertical-rl; transform: rotate(180deg);
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-bpm-number {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px;
          letter-spacing: -0.04em; color: var(--ag-acid, #a3e635); line-height: 1;
          text-shadow: 0 0 20px rgba(163,230,53,.4), 0 0 40px rgba(163,230,53,.15);
        }
        .ag-controls-block {
          flex: 1; padding: 8px 12px;
          display: flex; align-items: center;
          gap: 4px; flex-wrap: wrap; z-index: 1; overflow: hidden;
        }

        /* ── Ticker ──────────────────────────────────────────────────────── */
        .ag-ticker-row {
          padding: 4px 0;
          background: #080808;
          overflow: hidden; position: relative; flex-shrink: 0;
        }
        .ag-ticker-row::before, .ag-ticker-row::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 32px; z-index: 2;
        }
        .ag-ticker-row::before { left: 0; background: linear-gradient(90deg, #080808, transparent); }
        .ag-ticker-row::after  { right: 0; background: linear-gradient(-90deg, #080808, transparent); }
        .ag-ticker-inner {
          display: flex; width: max-content;
          animation: ag-scroll 28s linear infinite;
        }
        @keyframes ag-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .ag-ticker-item {
          font-size: 9px; letter-spacing: .2em; text-transform: uppercase;
          color: #fff; padding: 0 18px; white-space: nowrap;
          display: flex; align-items: center; gap: 10px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-ticker-sep { color: #a3e635; font-size: 10px; }

        /* ── Animations ──────────────────────────────────────────────────── */
        @keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ag-pulse { 0%,100%{box-shadow:0 0 6px #a3e635} 50%{box-shadow:0 0 18px #a3e635,0 0 30px rgba(163,230,53,.3)} }
        @keyframes ag-slidein { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes ag-rec { 0%,100%{background:#ff3b3b} 50%{background:#ff3b3b88} }

        /* ── Scrollbars ───────────────────────────────────────────────────── */
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:${C.surface}; }
        ::-webkit-scrollbar-thumb { background:${C.borderBright}; }
        ::-webkit-scrollbar-thumb:hover { background:${C.neon}; }
        input[type=range] { -webkit-appearance:none; appearance:none; outline:none; cursor:pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; background:${C.neon}; cursor:pointer; }
      ` }), _jsx("div", { style: { position: 'fixed', top: 80, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }, children: toasts.map(t => (_jsxs("div", { style: {
                        padding: '8px 14px',
                        background: t.type === 'ai' ? `rgba(163,230,53,0.12)` : C.surface,
                        border: `1px solid ${t.type === 'ai' ? C.neon : C.border}`,
                        borderLeft: `3px solid ${t.type === 'ai' ? C.neon : C.cyan}`,
                        fontFamily: FONT.mono, fontSize: 10, color: C.text,
                        animation: 'ag-slidein .2s ease',
                        boxShadow: `0 4px 24px rgba(0,0,0,.8)`,
                        maxWidth: 320,
                    }, children: [t.type === 'ai' && _jsx("span", { style: { color: C.neon, marginRight: 8 }, children: "\u26A1 AI" }), t.msg] }, t.id))) }), _jsxs("div", { style: {
                    width: '100%',
                    height: 'calc(100vh - var(--nav-h, 44px))',
                    background: C.void,
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: FONT.mono,
                    color: C.text,
                    overflow: 'hidden',
                    position: 'relative',
                }, children: [_jsx("div", { style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.neon, boxShadow: `0 0 20px ${C.neon}`, zIndex: 300, pointerEvents: 'none' } }), _jsx("div", { style: {
                            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                            background: `repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.007) 3px,rgba(255,255,255,0.007) 4px)`,
                        } }), _jsx("div", { style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                            background: 'radial-gradient(circle at 15% 50%, rgba(163,230,53,0.04) 0%, transparent 55%)',
                        } }), _jsxs("header", { className: "ag-header", style: { background: C.surface }, children: [_jsxs("div", { className: "ag-header-top", children: [_jsx("span", { className: "ag-ghost-bpm", "aria-hidden": "true", children: Math.round(project.tempo) }), _jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "COLLAB"] }), _jsx("div", { className: "ag-wordmark-sub", children: "Collaborative \u00B7 Session" })] }), _jsxs("div", { className: "ag-status-block", children: [_jsxs("div", { className: `ag-status-line ${connStatus === 'connected' ? 'ag-status-live-text' : 'ag-status-dead-text'}`, children: [_jsx("span", { className: connStatus === 'connected' ? 'ag-cursor-live' : 'ag-cursor-standby' }), connStatus === 'connected'
                                                        ? _jsx(Wifi, { size: 9, style: { flexShrink: 0 } })
                                                        : _jsx(WifiOff, { size: 9, style: { flexShrink: 0 } }), connStatus.toUpperCase()] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [collaborators.map((c, i) => (_jsxs("div", { title: `${c.name} — ${c.lastAction}`, style: {
                                                            width: 20, height: 20, background: c.color,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            border: `2px solid ${C.surface}`, fontSize: 7, fontWeight: 700, color: C.void,
                                                            position: 'relative', cursor: 'pointer', zIndex: collaborators.length - i,
                                                            marginLeft: i === 0 ? 0 : -5, flexShrink: 0,
                                                        }, children: [c.name.split(' ').map(n => n[0]).join(''), c.status === 'active' && (_jsx("div", { style: { position: 'absolute', bottom: -2, right: -2, width: 5, height: 5, background: C.neon, border: `1.5px solid ${C.surface}` } }))] }, c.id))), _jsx("div", { style: { width: 20, height: 20, background: C.neon, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.surface}`, marginLeft: -5, flexShrink: 0 }, children: _jsx(User, { size: 10, color: C.void }) })] })] }), _jsxs("div", { className: "ag-bpm-block", children: [_jsx("span", { className: "ag-bpm-label", children: "BPM" }), _jsx("input", { type: "number", value: project.tempo, min: 40, max: 240, onChange: e => pushHistory({ ...project, tempo: clamp(Number(e.target.value), 40, 240) }), className: "ag-bpm-number", style: {
                                                    background: 'transparent', border: 'none', outline: 'none',
                                                    width: 64, textAlign: 'center', cursor: 'ew-resize',
                                                } }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 6, letterSpacing: '.3em', textTransform: 'uppercase', color: C.textMuted, fontFamily: FONT.mono }, children: "SIG" }), _jsxs("span", { style: { fontSize: 13, fontWeight: 700, color: C.textMuted, fontFamily: FONT.display, lineHeight: 1 }, children: [project.timeSignature[0], "/", project.timeSignature[1]] })] })] }), _jsxs("div", { className: "ag-controls-block", children: [_jsx(AgBtn, { onClick: () => setCurrentBar(0), title: "Return to start (Home)", children: _jsx(SkipBack, { size: 13 }) }), _jsx(AgBtn, { onClick: togglePlay, active: transport === 'playing', title: "Play/Pause (Space)", children: transport === 'playing' ? _jsx(Pause, { size: 13 }) : _jsx(Play, { size: 13 }) }), _jsx(AgBtn, { onClick: stop, title: "Stop (Esc)", children: _jsx(Square, { size: 13 }) }), _jsx(AgBtn, { onClick: () => setTransport(t => t === 'recording' ? 'stopped' : 'recording'), active: transport === 'recording', activeColor: C.magenta, title: "Record", children: _jsx("div", { style: {
                                                        width: 9, height: 9,
                                                        background: transport === 'recording' ? C.magenta : C.textMuted,
                                                        animation: transport === 'recording' ? 'ag-rec 1s infinite' : 'none',
                                                        flexShrink: 0,
                                                    } }) }), _jsx(Divider, {}), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 }, children: [_jsx(AgLabel, { children: "BAR" }), _jsx("div", { style: { fontSize: 18, fontWeight: 800, fontFamily: FONT.display, color: C.neon, lineHeight: 1 }, children: String(Math.floor(currentBar) + 1).padStart(3, '0') })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 }, children: [_jsx(AgLabel, { children: "TIME" }), _jsx("div", { style: { fontSize: 9, fontWeight: 600, fontFamily: FONT.mono, color: C.textMuted }, children: formatTime(currentBar, project.tempo, TL.beatsPerBar) })] }), _jsx(Divider, {}), _jsxs(AgBtn, { onClick: () => setMetronome(v => !v), active: metronome, title: "Metronome (M)", children: [_jsx(Activity, { size: 11 }), " MET"] }), _jsxs(AgBtn, { onClick: () => setSnapGrid(v => !v), active: snapGrid, title: "Snap Grid (G)", children: [_jsx(Grid3x3, { size: 11 }), " SNAP"] }), _jsxs(AgBtn, { onClick: () => setLoopOn(v => !v), active: loopOn, activeColor: C.cyan, title: "Loop (L)", children: [_jsx("span", { style: { fontSize: 11, fontWeight: 900 }, children: "\u21BA" }), " LOOP"] }), _jsx(Divider, {}), _jsx(AgBtn, { onClick: undo, disabled: historyIdx === 0, title: "Undo (\u2318Z)", children: _jsx(Undo2, { size: 11 }) }), _jsx(AgBtn, { onClick: redo, disabled: historyIdx === history.length - 1, title: "Redo (\u2318\u21E7Z)", children: _jsx(Redo2, { size: 11 }) }), _jsx(Divider, {}), _jsx(AgBtn, { onClick: () => setZoom(z => Math.max(z - 0.2, TL.minZoom)), title: "Zoom out", children: _jsx(ZoomOut, { size: 11 }) }), _jsxs("span", { style: { fontSize: 8, color: C.textMuted, minWidth: 28, textAlign: 'center', fontWeight: 600, flexShrink: 0 }, children: [Math.round(zoom * 100), "%"] }), _jsx(AgBtn, { onClick: () => setZoom(z => Math.min(z + 0.2, TL.maxZoom)), title: "Zoom in", children: _jsx(ZoomIn, { size: 11 }) }), _jsx(Divider, {}), _jsxs(AgBtn, { onClick: () => setShowMixer(v => !v), active: showMixer, title: "Mixer", children: [_jsx(Sliders, { size: 11 }), " MIX"] }), _jsxs(AgBtn, { onClick: () => setShowAI(v => !v), active: showAI, title: "AI Panel", children: [_jsx(Zap, { size: 11 }), " AI"] }), _jsxs(AgBtn, { onClick: () => setShowActivity(v => !v), active: showActivity, title: "Activity Log", children: [_jsx(Radio, { size: 11 }), " LOG"] }), _jsxs(AgBtn, { onClick: () => setShowVST(v => !v), active: showVST, title: "VST Browser", children: [_jsx(Music, { size: 11 }), " VST"] }), _jsxs(AgBtn, { onClick: () => setShowLoopStation(v => !v), active: showLoopStation, title: "Loop Station", children: [_jsx(Repeat2, { size: 11 }), " 505"] }), _jsx(Divider, {}), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx(AgLabel, { children: "CPU" }), _jsx("div", { style: { width: 48, height: 3, background: C.border, flexShrink: 0 }, children: _jsx("div", { style: {
                                                                        height: '100%', width: `${cpuLoad * 100}%`,
                                                                        background: cpuLoad > 0.8 ? C.magenta : cpuLoad > 0.6 ? C.yellow : C.neon,
                                                                        transition: 'width .2s, background .2s',
                                                                    } }) }), _jsxs("span", { style: { fontSize: 7, color: C.textMuted, width: 22, textAlign: 'right' }, children: [Math.round(cpuLoad * 100), "%"] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx(AgLabel, { children: "LLPTE" }), _jsxs("span", { style: { fontSize: 7, color: C.neon, fontWeight: 700, animation: 'ag-pulse 2s infinite' }, children: [llpteLatency, "ms"] })] })] }), _jsx(Divider, {}), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }, children: [_jsx("button", { onClick: () => setMasterMuted(v => !v), style: { background: 'none', border: 'none', cursor: 'pointer', color: masterMuted ? C.magenta : C.textMuted, padding: 2, flexShrink: 0 }, children: masterMuted ? _jsx(VolumeX, { size: 11 }) : _jsx(Volume2, { size: 11 }) }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: masterMuted ? 0 : masterVol, onChange: e => setMasterVol(Number(e.target.value)), style: { width: 60, height: 2, accentColor: C.neon } }), _jsx("span", { style: { fontSize: 7, color: C.neon, minWidth: 24, textAlign: 'right', flexShrink: 0 }, children: masterMuted ? '—' : `${Math.round(masterVol * 100)}%` })] }), _jsx(AgBtn, { title: "Export", children: _jsx(Download, { size: 11 }) }), _jsx(AgBtn, { title: "Share", children: _jsx(Share2, { size: 11 }) })] })] }), _jsx("div", { className: "ag-ticker-row", children: _jsx("div", { className: "ag-ticker-inner", children: [...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (_jsxs("span", { className: "ag-ticker-item", children: [item, _jsx("span", { className: "ag-ticker-sep", children: "/" })] }, i))) }) })] }), _jsxs("div", { style: {
                            height: 28, background: C.void, borderBottom: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', gap: 0, padding: '0 20px', flexShrink: 0,
                            overflowX: 'auto', zIndex: 90,
                        }, children: [_jsx(AgLabel, { style: { marginRight: 12, flexShrink: 0 }, children: "LLPTE PIPELINE" }), ['inputRouter', 'spectralAnalyzer', 'aiMixEngine', 'transitionGraph', 'outputBus'].map((node, i) => (_jsxs(React.Fragment, { children: [_jsxs("div", { style: {
                                            padding: '2px 10px',
                                            background: i === 2 ? C.neonDim2 : 'transparent',
                                            border: `1px solid ${i === 2 ? C.neon : C.border}`,
                                            fontSize: 7, letterSpacing: '.15em', textTransform: 'uppercase',
                                            color: i === 2 ? C.neon : C.textMuted,
                                            flexShrink: 0,
                                            boxShadow: i === 2 ? `0 0 8px ${C.neonDim}` : 'none',
                                        }, children: [node, i === 2 && _jsxs("span", { style: { marginLeft: 6, color: C.neon, fontWeight: 700 }, children: [llpteLatency, "ms"] })] }), i < 4 && (_jsx("div", { style: { width: 18, height: 1, background: `linear-gradient(90deg,${C.neon},${C.border})`, flexShrink: 0 } }))] }, node))), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 7, letterSpacing: '.2em', textTransform: 'uppercase', color: C.textMuted }, children: "EDGES" }), _jsx("span", { style: { fontSize: 7, color: C.neon, fontWeight: 700 }, children: "847" }), _jsx("span", { style: { fontSize: 7, color: C.textMuted, letterSpacing: '.2em', marginLeft: 8 }, children: "TICK" }), _jsx("span", { style: { fontSize: 7, color: C.neon, fontWeight: 700 }, children: "0.8ms" }), _jsx("span", { style: { fontSize: 7, color: C.textMuted, letterSpacing: '.2em', marginLeft: 8 }, children: "CONF GATE" }), _jsx("span", { style: { fontSize: 7, color: C.neon, fontWeight: 700 }, children: "\u22650.65" })] })] }), showVST && (_jsxs("div", { style: { height: 340, background: C.void, borderTop: `2px solid ${C.neon}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }, children: [_jsxs("div", { style: { height: 28, padding: '0 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.void, flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { width: 6, height: 6, background: C.neon, boxShadow: `0 0 6px ${C.neon}` } }), _jsx("span", { style: { fontSize: 7, letterSpacing: '.3em', textTransform: 'uppercase', color: C.neon, fontFamily: FONT.mono }, children: "VIRTUAL VSTS" })] }), _jsx("button", { onClick: () => setShowVST(false), style: { background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2 }, children: _jsx(X, { size: 12 }) })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(Suspense, { fallback: _jsx("div", { style: { padding: 16, fontSize: 8, color: C.textMuted, fontFamily: FONT.mono, letterSpacing: '.2em' }, children: "LOADING VSTS\u2026" }), children: _jsx(VSTBrowser, { onPluginSelect: () => { } }) }) })] })), showLoopStation && (_jsxs("div", { style: { height: 340, background: C.void, borderTop: `2px solid ${C.neon}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }, children: [_jsxs("div", { style: { height: 28, padding: '0 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.void, flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { width: 6, height: 6, background: C.neon, boxShadow: `0 0 6px ${C.neon}` } }), _jsx("span", { style: { fontSize: 7, letterSpacing: '.3em', textTransform: 'uppercase', color: C.neon, fontFamily: FONT.mono }, children: "LOOP STATION 505" })] }), _jsx("button", { onClick: () => setShowLoopStation(false), style: { background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2 }, children: _jsx(X, { size: 12 }) })] }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(Suspense, { fallback: _jsx("div", { style: { padding: 16, fontSize: 8, color: C.textMuted, fontFamily: FONT.mono, letterSpacing: '.2em' }, children: "LOADING LOOP STATION\u2026" }), children: _jsx(LoopStation505, {}) }) })] })), _jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }, children: [_jsxs("div", { style: {
                                    width: TL.headerWidth, flexShrink: 0,
                                    background: C.surface, borderRight: `2px solid ${C.border}`,
                                    display: 'flex', flexDirection: 'column', overflowY: 'hidden',
                                }, children: [_jsx("div", { style: {
                                            height: TL.rulerHeight, background: C.void, borderBottom: `2px solid ${C.neon}`,
                                            display: 'flex', alignItems: 'center', paddingLeft: 8,
                                        }, children: _jsx(AgLabel, { style: { fontSize: 7 }, children: "TRACKS" }) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto' }, children: [project.tracks.map(track => (_jsxs("div", { onClick: () => setSelectedTrackId(t => t === track.id ? null : track.id), style: {
                                                    height: TL.trackHeight,
                                                    background: selectedTrackId === track.id ? C.surfaceLift : 'transparent',
                                                    borderBottom: `1px solid ${C.border}`,
                                                    borderLeft: `3px solid ${selectedTrackId === track.id ? C.neon : track.color}`,
                                                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                                    justifyContent: 'center', padding: '6px 8px', gap: 4, position: 'relative',
                                                }, children: [collaborators.filter(c => c.editingTrackId === track.id && c.status === 'active').map(c => (_jsx("div", { style: {
                                                            position: 'absolute', top: 4, right: 4,
                                                            width: 8, height: 8, background: c.color, boxShadow: `0 0 6px ${c.color}`,
                                                        }, title: `${c.name} editing` }, c.id))), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("div", { style: { width: 8, height: 8, background: track.color, flexShrink: 0 } }), _jsx("span", { style: { fontSize: 9, fontWeight: 600, color: C.text, letterSpacing: '.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: track.name }), track.locked && _jsx(Lock, { size: 8, color: C.textMuted })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 3 }, children: [_jsx(AgBtn, { onClick: e => { e.stopPropagation(); toggleMute(track.id); }, active: track.muted, activeColor: C.yellow, style: { height: 18, padding: '0 5px', fontSize: 7 }, children: "M" }), _jsx(AgBtn, { onClick: e => { e.stopPropagation(); toggleSolo(track.id); }, active: track.solo, activeColor: C.cyan, style: { height: 18, padding: '0 5px', fontSize: 7 }, children: "S" }), _jsx(AgBtn, { onClick: e => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }); }, active: track.armed, activeColor: C.magenta, style: { height: 18, padding: '0 5px', fontSize: 7 }, children: "R" }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 2 }, children: [_jsx(VUMeter, { level: vuLevels[track.id] ?? 0, color: track.color, peaked: peakedTracks.has(track.id) }), _jsx(VUMeter, { level: (vuLevels[track.id] ?? 0) * 0.9, color: track.color, peaked: peakedTracks.has(track.id) })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: track.volume, onChange: e => { e.stopPropagation(); updateTrack(track.id, { volume: Number(e.target.value) }); }, onClick: e => e.stopPropagation(), style: { flex: 1, height: 2, accentColor: track.color } }), _jsxs("span", { style: { fontSize: 7, color: C.textMuted, minWidth: 22, textAlign: 'right' }, children: [Math.round(track.volume * 100), "%"] })] }), track.fxChain.length > 0 && (_jsxs("div", { style: { display: 'flex', gap: 2, flexWrap: 'wrap' }, children: [track.fxChain.slice(0, 2).map(fx => (_jsx("span", { style: { fontSize: 6, color: C.textDim, border: `1px solid ${C.border}`, padding: '1px 4px', letterSpacing: '.1em', textTransform: 'uppercase' }, children: fx }, fx))), track.fxChain.length > 2 && _jsxs("span", { style: { fontSize: 6, color: C.textDim }, children: ["+", track.fxChain.length - 2] })] }))] }, track.id))), _jsxs("button", { onClick: addTrack, style: {
                                                    width: '100%', height: 40, background: 'transparent', border: 'none',
                                                    borderTop: `1px solid ${C.border}`, color: C.neon, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                    fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.25em',
                                                    fontFamily: FONT.mono, transition: 'background .1s',
                                                }, onMouseEnter: e => { e.currentTarget.style.background = C.neon; e.currentTarget.style.color = C.void; }, onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.neon; }, children: [_jsx(Plus, { size: 12 }), " ADD TRACK"] })] })] }), _jsxs("div", { ref: containerRef, onScroll: e => {
                                    setScrollLeft(e.currentTarget.scrollLeft);
                                    setScrollTop(e.currentTarget.scrollTop);
                                }, style: { flex: 1, position: 'relative', overflow: 'auto' }, children: [_jsx("div", { style: { width: Math.max(3000, project.clips.reduce((acc, c) => Math.max(acc, c.startBar + c.durationBars), 0) * gridWidth + 200), height: Math.max(totalTH, 400), position: 'relative' }, children: _jsx("canvas", { ref: canvasRef, onClick: handleCanvasClick, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, onContextMenu: e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }, style: { position: 'sticky', top: 0, left: 0, width: '100%', height: '100%', cursor: hoveredClipId ? 'pointer' : 'crosshair', display: 'block' } }) }), selectedClipIds.length > 0 && (_jsxs("div", { style: {
                                            position: 'fixed', bottom: 16, left: TL.headerWidth + 16,
                                            background: C.surface, border: `1px solid ${C.neon}`, borderLeft: `3px solid ${C.neon}`,
                                            padding: '5px 12px', fontSize: 8, fontFamily: FONT.mono, color: C.neon,
                                            letterSpacing: '.15em', textTransform: 'uppercase', zIndex: 200,
                                        }, children: [selectedClipIds.length, " CLIP", selectedClipIds.length > 1 ? 'S' : '', " SELECTED \u2014 DEL to remove \u00B7 \u2318D duplicate"] }))] }), showAI && (_jsxs("div", { style: {
                                    width: 240, background: C.surface, borderLeft: `2px solid ${C.border}`,
                                    display: 'flex', flexDirection: 'column', flexShrink: 0,
                                }, children: [_jsxs("div", { style: {
                                            height: TL.rulerHeight + 28, padding: '0 12px',
                                            borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${C.neon}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            background: C.void,
                                        }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 7, letterSpacing: '.3em', textTransform: 'uppercase', color: C.neon, marginBottom: 2 }, children: "AI SUGGESTIONS" }), _jsxs("div", { style: { fontSize: 7, color: C.textMuted, letterSpacing: '.1em' }, children: ["LLPTE \u00B7 ", llpteLatency, "ms"] })] }), _jsx(Zap, { size: 14, color: C.neon })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }, children: suggestions.length === 0 ? (_jsx("div", { style: { padding: 16, textAlign: 'center', fontSize: 8, color: C.textDim, letterSpacing: '.15em' }, children: "NO PENDING SUGGESTIONS" })) : suggestions.map(s => {
                                            const track = project.tracks.find(t => t.id === s.trackId);
                                            const col = confidenceColor(s.confidence);
                                            return (_jsxs("div", { style: {
                                                    background: C.void, border: `1px solid ${C.border}`,
                                                    borderLeft: `2px solid ${col}`, padding: '8px 10px',
                                                }, children: [_jsxs("div", { style: { fontSize: 7, color: C.textMuted, letterSpacing: '.1em', marginBottom: 4, textTransform: 'uppercase' }, children: [track?.name ?? s.trackId, " \u00B7 ", s.type.replace('_', ' ')] }), _jsx("div", { style: { fontSize: 9, color: C.text, marginBottom: 6, lineHeight: 1.4 }, children: s.label }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 5, height: 5, background: col, boxShadow: `0 0 5px ${col}` } }), _jsxs("span", { style: { fontSize: 8, color: col, fontWeight: 700 }, children: [Math.round(s.confidence * 100), "%"] })] }), _jsx("span", { style: { fontSize: 7, color: C.textMuted, letterSpacing: '.1em', textTransform: 'uppercase' }, children: s.confidence >= 0.65 ? 'AUTO' : 'SUGGEST' })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => acceptSuggestion(s.id), style: {
                                                                    flex: 1, height: 22, background: C.neonDim2, border: `1px solid ${C.neon}`,
                                                                    color: C.neon, cursor: 'pointer', fontSize: 7, fontFamily: FONT.mono,
                                                                    letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 700,
                                                                }, children: "\u2713 ACCEPT" }), _jsx("button", { onClick: () => rejectSuggestion(s.id), style: {
                                                                    flex: 1, height: 22, background: 'transparent', border: `1px solid ${C.border}`,
                                                                    color: C.textMuted, cursor: 'pointer', fontSize: 7, fontFamily: FONT.mono,
                                                                    letterSpacing: '.15em', textTransform: 'uppercase',
                                                                }, children: "\u2715 REJECT" })] })] }, s.id));
                                        }) }), _jsxs("div", { style: { padding: 10, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsx(AgLabel, { style: { marginBottom: 4 }, children: "CONFIDENCE GATES" }), [
                                                { label: 'AUTO APPLY', threshold: '≥0.65', color: C.neon },
                                                { label: 'SUGGEST', threshold: '≥0.40', color: C.yellow },
                                                { label: 'DISCARD', threshold: '<0.40', color: C.magenta },
                                            ].map(g => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("div", { style: { width: 5, height: 5, background: g.color } }), _jsx("span", { style: { fontSize: 7, color: g.color, fontWeight: 700, letterSpacing: '.1em' }, children: g.label })] }), _jsx("span", { style: { fontSize: 7, color: C.textMuted }, children: g.threshold })] }, g.label)))] })] })), showActivity && (_jsxs("div", { style: {
                                    width: 220, background: C.surface, borderLeft: `2px solid ${C.border}`,
                                    display: 'flex', flexDirection: 'column', flexShrink: 0,
                                }, children: [_jsxs("div", { style: {
                                            height: TL.rulerHeight + 28, padding: '0 12px',
                                            borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${C.neon}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            background: C.void,
                                        }, children: [_jsx("div", { style: { fontSize: 7, letterSpacing: '.3em', textTransform: 'uppercase', color: C.neon }, children: "ACTIVITY" }), _jsxs("div", { style: { fontSize: 7, color: C.textMuted }, children: [collaborators.filter(c => c.status === 'active').length, " ONLINE"] })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }, children: activities.map(a => {
                                            const ago = Date.now() - a.timestamp;
                                            const mins = Math.floor(ago / 60000);
                                            const secs = Math.floor((ago % 60000) / 1000);
                                            const t = mins > 0 ? `${mins}m` : secs > 0 ? `${secs}s` : 'now';
                                            const col = a.type === 'ai' ? C.neon : a.type === 'transport' ? C.cyan : a.type === 'collab' ? C.yellow : C.textMuted;
                                            return (_jsxs("div", { style: {
                                                    padding: '6px 8px', background: C.void,
                                                    border: `1px solid ${C.border}`, borderLeft: `2px solid ${col}`,
                                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 2 }, children: [_jsx("span", { style: { fontSize: 8, color: C.neon, fontWeight: 700 }, children: a.user }), _jsx("span", { style: { fontSize: 7, color: C.textDim }, children: t })] }), _jsx("div", { style: { fontSize: 8, color: C.textMuted, letterSpacing: '.05em' }, children: a.action })] }, a.id));
                                        }) })] }))] }), showMixer && (_jsxs("div", { style: {
                            height: 140, background: C.surface, borderTop: `2px solid ${C.border}`,
                            display: 'flex', flexShrink: 0, overflowX: 'auto',
                        }, children: [_jsx("div", { style: {
                                    width: TL.headerWidth, flexShrink: 0, borderRight: `2px solid ${C.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px',
                                }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }, children: [_jsx(AgLabel, { children: "MASTER FADER" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: masterMuted ? 0 : masterVol, onChange: e => setMasterVol(Number(e.target.value)), style: { flex: 1, accentColor: C.neon } }), _jsx("span", { style: { fontSize: 10, color: C.neon, fontWeight: 700, minWidth: 30, textAlign: 'right' }, children: Math.round(masterVol * 100) })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx(VUMeter, { level: vuLevels[project.tracks[0]?.id] ?? 0, color: C.neon, peaked: false }), _jsx(VUMeter, { level: (vuLevels[project.tracks[0]?.id] ?? 0) * 0.95, color: C.neon, peaked: false })] })] }) }), project.tracks.map(track => (_jsxs("div", { style: {
                                    width: 80, flexShrink: 0, borderRight: `1px solid ${C.border}`,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    padding: '8px 6px', gap: 4,
                                    background: selectedTrackId === track.id ? C.surfaceLift : 'transparent',
                                    borderTop: `3px solid ${track.color}`,
                                }, children: [_jsx("span", { style: { fontSize: 7, color: C.textMuted, letterSpacing: '.08em', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }, children: track.name }), _jsxs("div", { style: { display: 'flex', gap: 3, marginBottom: 2 }, children: [_jsx(VUMeter, { level: vuLevels[track.id] ?? 0, color: track.color, peaked: peakedTracks.has(track.id) }), _jsx(VUMeter, { level: (vuLevels[track.id] ?? 0) * 0.88, color: track.color, peaked: peakedTracks.has(track.id) })] }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: track.volume, onChange: e => updateTrack(track.id, { volume: Number(e.target.value) }), style: { width: 60, accentColor: track.color } }), _jsx("span", { style: { fontSize: 7, color: C.textMuted }, children: Math.round(track.volume * 100) }), _jsxs("div", { style: { display: 'flex', gap: 2 }, children: [_jsx(AgBtn, { onClick: () => toggleMute(track.id), active: track.muted, activeColor: C.yellow, style: { height: 16, padding: '0 4px', fontSize: 6 }, children: "M" }), _jsx(AgBtn, { onClick: () => toggleSolo(track.id), active: track.solo, activeColor: C.cyan, style: { height: 16, padding: '0 4px', fontSize: 6 }, children: "S" })] })] }, track.id)))] })), _jsxs("div", { style: {
                            height: 26, background: C.void, borderTop: `1px solid ${C.border}`,
                            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 24, flexShrink: 0,
                        }, children: [[
                                ['SPC', 'Play/Pause'], ['ESC', 'Stop'], ['⌘Z', 'Undo'], ['⌘D', 'Dup'],
                                ['DEL', 'Remove'], ['M', 'Metro'], ['L', 'Loop'], ['G', 'Snap'], ['⌘T', 'Track'],
                            ].map(([k, v]) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("span", { style: { fontSize: 7, color: C.neon, fontWeight: 700, fontFamily: FONT.mono, padding: '1px 4px', border: `1px solid ${C.border}`, letterSpacing: '.05em' }, children: k }), _jsx("span", { style: { fontSize: 7, color: C.textDim, letterSpacing: '.1em', textTransform: 'uppercase' }, children: v })] }, k))), _jsxs("div", { style: { marginLeft: 'auto', fontSize: 7, color: C.textDim, letterSpacing: '.2em' }, children: [project.tracks.length, " TRACKS \u00B7 ", project.clips.length, " CLIPS \u00B7 ", project.markers.length, " MARKERS"] })] }), contextMenu && (_jsxs(_Fragment, { children: [_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 998 }, onClick: () => setContextMenu(null) }), _jsx("div", { style: {
                                    position: 'fixed', left: contextMenu.x, top: contextMenu.y,
                                    background: C.surface, border: `1px solid ${C.border}`, borderTop: `2px solid ${C.neon}`,
                                    padding: 4, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,.9)', zIndex: 999,
                                }, children: selectedClipIds.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs(CtxItem, { onClick: () => { selectedClipIds.forEach(duplicateClip); setContextMenu(null); }, children: [_jsx(Copy, { size: 11 }), " Duplicate"] }), _jsxs(CtxItem, { onClick: () => { selectedClipIds.forEach(deleteClip); setContextMenu(null); }, children: [_jsx(Trash2, { size: 11 }), " Delete"] })] })) : (_jsxs(_Fragment, { children: [_jsxs(CtxItem, { onClick: () => { addTrack(); setContextMenu(null); }, children: [_jsx(Plus, { size: 11 }), " Add Track"] }), _jsxs(CtxItem, { onClick: () => setContextMenu(null), children: [_jsx(Upload, { size: 11 }), " Import Audio"] })] })) })] }))] })] }));
}
const CtxItem = ({ children, onClick }) => (_jsx("div", { onClick: onClick, style: {
        padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 9, fontFamily: FONT.mono, letterSpacing: '.1em', textTransform: 'uppercase',
        color: C.text, transition: 'background .07s, color .07s', borderLeft: '2px solid transparent',
    }, onMouseEnter: e => { e.currentTarget.style.background = C.neon; e.currentTarget.style.color = C.void; e.currentTarget.style.borderColor = C.neon; }, onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = 'transparent'; }, children: children }));
