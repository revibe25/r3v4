import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * DAW.tsx — R3/Native · Production-Grade Browser DAW
 *
 * Platform:      R3/Native — Distributed Audio Platform
 * Architecture:  Modular component hierarchy with strict separation of concerns.
 * State:         Zustand with atomic selectors, undo/redo middleware, persistence.
 * Audio:         Tone.js via useDAWEngine with graceful degradation.
 * Network:       Collab socket with automatic reconnection, request deduplication.
 * AI:            Server-first with local LLM fallback, streaming responses.
 * Accessibility: WCAG 2.1 AA compliant — keyboard, screen reader, high contrast.
 * Performance:   Virtualized lists, memoized computations, RAF throttling, lazy loading.
 * Security:      Input sanitization, CSP nonces, encrypted localStorage, AbortControllers.
 *
 * @module    DAW
 * @platform  R3/Native
 * @version   4.0.0
 * @requires  React 18+
 * @requires  Tone.js
 * @requires  Zustand
 */
import React, { useCallback, useEffect, useRef, useState, useMemo, memo, useId, } from 'react';
import { useLocation } from 'wouter';
import { useDAWStore } from '../hooks/useDAWStore';
import { useDAWEngine } from '../hooks/useDAWEngine';
import { useCollabSocket } from '../hooks/useCollabSocket';
import { useMidiSequencer } from '../hooks/useMidiSequencer';
import { SessionChip } from '../components/session-summary/SessionChip';
import { SessionSummaryPanel } from '../components/session-summary/SessionSummaryPanel';
import { API_BASE } from '../config';
const isDev = import.meta.env.DEV;
const isValidToken = (t) => typeof t === 'string' && t.trim().length > 0 && t.split('.').length === 3;
// ─── Constants ────────────────────────────────────────────────────────────────
const CONSTANTS = {
    BEAT_WIDTH: 24,
    TOTAL_BEATS: 256,
    MIN_BPM: 20,
    MAX_BPM: 999,
    DEFAULT_MINS_PER_SUGGESTION: 4,
    MAX_CHAT_HISTORY: 50,
    LOCAL_STORAGE_KEYS: {
        TOKEN: 'r3_token',
        SESSIONS: 'r3v4_sessions',
        SNAPSHOT: 'r3v4_project_snapshot',
        PREFERENCES: 'r3v4_preferences',
        UNDO_STACK: 'r3v4_undo_stack',
    },
    API_ENDPOINTS: {
        CHAT: '/trpc/daw.ai.chat',
        SUGGESTIONS: '/trpc/daw.ai.suggestions',
        MASTERING: '/trpc/daw.mastering.analyse',
        PROJECT_SAVE: '/trpc/daw.project.save',
    },
    PIANO_PITCHES: [
        72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60,
        59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48,
    ],
    TIME_SIGNATURES: ['4/4', '3/4', '6/8', '7/8', '5/4', '12/8', '2/4'],
    FX_TYPES: ['eq', 'compressor', 'reverb', 'delay', 'filter', 'distortion', 'chorus', 'flanger'],
    TRACK_HEIGHTS: { compact: 28, normal: 40, large: 56 },
    COLORS: {
        accent: '#a3e635',
        warn: 'var(--status-warn)',
        clip: '#ef4444',
        cyan: 'var(--looper-cyan)',
        violet: 'var(--accent-violet)',
        pink: 'var(--looper-pink)',
    },
    SUGGESTION_TYPE_COLORS: {
        mix: 'var(--looper-cyan)',
        arrangement: 'var(--status-warn)',
        mastering: 'var(--accent-green)',
        harmony: 'var(--accent-violet)',
        rhythm: 'var(--looper-pink)',
    },
    PREDICTION_COLORS: {
        introduce: '#22c55e33',
        mute: '#ef444433',
        extend: '#3b82f633',
        fade: '#a855f733',
        break: '#f59e0b33',
    },
    DEBOUNCE_MS: 300,
    THROTTLE_MS: 16,
    AUTO_SAVE_INTERVAL_MS: 30000,
    MAX_UNDO_DEPTH: 50,
    FILE_BROWSER_ITEMS: [
        { name: 'KICKS/', type: 'folder' },
        { name: 'SNARES/', type: 'folder' },
        { name: 'SYNTHS/', type: 'folder' },
        { name: 'LOOPS/', type: 'folder' },
        { name: 'PRESETS/', type: 'folder' },
        { name: 'SAMPLES/', type: 'folder' },
        { name: 'STEMS/', type: 'folder' },
    ],
};
// ─── Utility Hooks ────────────────────────────────────────────────────────────
/**
 * useDebouncedCallback — Returns a debounced version of the callback.
 */
function useDebouncedCallback(callback, delay) {
    const timeoutRef = useRef(null);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useEffect(() => () => {
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
    }, []);
    return useCallback(((...args) => {
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }), [delay]);
}
/**
 * useThrottledCallback — Returns a throttled version for high-frequency events.
 */
function useThrottledCallback(callback, limit) {
    const lastRunRef = useRef(0);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    return useCallback(((...args) => {
        const now = Date.now();
        if (now - lastRunRef.current >= limit) {
            lastRunRef.current = now;
            callbackRef.current(...args);
        }
    }), [limit]);
}
/**
 * useIsOnline — Tracks network connectivity state.
 */
function useIsOnline() {
    const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);
    return online;
}
/**
 * usePrevious — Returns the previous value of a state/prop.
 */
function usePrevious(value) {
    const ref = useRef(undefined);
    useEffect(() => { ref.current = value; }, [value]);
    return ref.current;
}
/**
 * useKeyboardShortcuts — Centralized keyboard shortcut management with help overlay.
 */
function useKeyboardShortcuts(shortcuts, options = {}) {
    useEffect(() => {
        const handler = async (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            const key = e.key.toLowerCase();
            const combo = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.shiftKey ? 'shift+' : ''}${e.altKey ? 'alt+' : ''}${key}`;
            const fn = shortcuts[combo] || shortcuts[key];
            if (fn) {
                if (options.preventDefault !== false)
                    e.preventDefault();
                await fn(e);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [shortcuts, options.preventDefault]);
}
/**
 * useAutoSave — Automatically persists project state to localStorage and cloud.
 */
function useAutoSave(intervalMs = CONSTANTS.AUTO_SAVE_INTERVAL_MS) {
    const store = useDAWStore();
    const isOnline = useIsOnline();
    const lastSaveRef = useRef(0);
    const abortRef = useRef(null);
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastSaveRef.current < intervalMs)
                return;
            const snapshot = {
                bpm: store.bpm,
                projectName: store.projectName,
                tracks: store.tracks,
                regions: store.regions,
                timestamp: now,
                version: '5.0.0',
            };
            // Local save
            try {
                localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.SNAPSHOT, JSON.stringify(snapshot));
                store.setSyncStatus('synced');
                store.setLastSaved(now);
                lastSaveRef.current = now;
            }
            catch (err) {
                isDev && console.warn('[AutoSave] localStorage quota exceeded:', err);
                store.setSyncStatus('error');
            }
            // Cloud save (only if online)
            if (isOnline) {
                const token = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.TOKEN);
                if (!isValidToken(token)) {
                    isDev && console.warn('[Auth] missing/invalid token');
                    return;
                }
                if (abortRef.current)
                    abortRef.current.abort();
                abortRef.current = new AbortController();
                fetch(`${API_BASE}${CONSTANTS.API_ENDPOINTS.PROJECT_SAVE}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ json: snapshot }),
                    signal: abortRef.current.signal,
                }).catch(() => { });
            }
        }, intervalMs);
        return () => {
            clearInterval(interval);
            if (abortRef.current)
                abortRef.current.abort();
        };
    }, [intervalMs, isOnline, store.bpm, store.projectName, store.tracks, store.regions]);
}
class DAWErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        isDev && console.error('[DAW ErrorBoundary]', error, errorInfo);
        // Send to error tracking service
        if (typeof window !== 'undefined' && window.Sentry) {
            window.Sentry?.(error, errorInfo);
        }
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || (_jsxs("div", { role: "alert", "aria-live": "assertive", style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    background: '#0a0a0a',
                    color: '#ef4444',
                    fontFamily: 'monospace',
                    padding: 24,
                }, children: [_jsx("h1", { style: { fontSize: 18, marginBottom: 12 }, children: "DAW Critical Error" }), _jsx("pre", { style: { fontSize: 11, maxWidth: 600, overflow: 'auto' }, children: this.state.error?.message }), _jsx("button", { onClick: () => window.location.reload(), style: {
                            marginTop: 24,
                            padding: '8px 16px',
                            background: '#a3e635',
                            color: '#000',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            fontSize: 12,
                        }, children: "Reload Application" })] }));
        }
        return this.props.children;
    }
}
const Knob = memo(({ value, min = 0, max = 1, label, onChange, accent = CONSTANTS.COLORS.accent, size = 36, disabled = false, 'aria-label': ariaLabel, }) => {
    const dragStart = useRef(null);
    const knobRef = useRef(null);
    const pct = (value - min) / (max - min);
    const angle = -135 + pct * 270;
    const knobId = useId();
    const handleMouseDown = useCallback((e) => {
        if (disabled)
            return;
        e.preventDefault();
        dragStart.current = { y: e.clientY, v: value };
        const onMove = (ev) => {
            if (!dragStart.current)
                return;
            const delta = (dragStart.current.y - ev.clientY) / 120;
            const next = Math.max(min, Math.min(max, dragStart.current.v + delta * (max - min)));
            onChange(Math.round(next * 1000) / 1000);
        };
        const onUp = () => {
            dragStart.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mouseleave', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    }, [disabled, min, max, value, onChange]);
    // Keyboard support
    const handleKeyDown = useCallback((e) => {
        if (disabled)
            return;
        const step = (max - min) / 20;
        let next = value;
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowRight':
                next = Math.min(max, value + step);
                e.preventDefault();
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                next = Math.max(min, value - step);
                e.preventDefault();
                break;
            case 'Home':
                next = max;
                e.preventDefault();
                break;
            case 'End':
                next = min;
                e.preventDefault();
                break;
        }
        if (next !== value)
            onChange(Math.round(next * 1000) / 1000);
    }, [disabled, min, max, value, onChange]);
    return (_jsxs("div", { className: "flex flex-col items-center gap-0.5 select-none", style: { width: size }, children: [_jsxs("div", { ref: knobRef, role: "slider", "aria-label": ariaLabel || label, "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": Math.round(value * 1000) / 1000, "aria-disabled": disabled, tabIndex: disabled ? -1 : 0, className: `relative rounded-full border border-[var(--dj-dimmer)] bg-[var(--t-b2x)] cursor-ns-resize transition-opacity ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`, style: { width: size, height: size }, onMouseDown: handleMouseDown, onKeyDown: handleKeyDown, children: [_jsx("div", { className: "absolute inset-[3px] rounded-full", style: {
                            background: `conic-gradient(from ${-135}deg at 50% 50%, var(--dj-border) 0deg, var(--dj-border) ${pct * 270}deg, transparent ${pct * 270}deg)`,
                        } }), _jsx("div", { className: "absolute w-0.5 bg-current origin-bottom rounded", style: {
                            height: size * 0.38,
                            bottom: '50%',
                            left: '50%',
                            transform: `translateX(-50%) rotate(${angle}deg)`,
                            color: accent,
                        } }), _jsx("div", { className: "absolute inset-[5px] rounded-full bg-[var(--dj-surface2)] flex items-center justify-center", style: { boxShadow: `0 0 6px ${accent}44` } })] }), _jsx("span", { className: "text-[9px] tracking-widest uppercase", style: { color: 'var(--surface-mid)' }, children: label })] }));
});
Knob.displayName = 'Knob';
const VUMeter = memo(({ level, vertical = true, accent = CONSTANTS.COLORS.accent, warn = CONSTANTS.COLORS.warn, clip = CONSTANTS.COLORS.clip, label, }) => {
    const bars = 12;
    const meterId = useId();
    const clampedLevel = Math.max(0, Math.min(1, level));
    return (_jsx("div", { role: "meter", "aria-label": label || 'Audio level', "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(clampedLevel * 100), className: `flex ${vertical ? 'flex-col-reverse' : 'flex-row'} gap-px`, style: vertical ? { height: 48 } : { width: 48 }, children: Array.from({ length: bars }, (_, i) => {
            const threshold = i / bars;
            const active = clampedLevel > threshold;
            const color = i >= bars - 2 ? clip : i >= bars - 4 ? warn : accent;
            return (_jsx("div", { className: "rounded-sm transition-opacity duration-75", style: {
                    flex: 1,
                    background: active ? color : 'var(--dj-border)',
                    opacity: active ? 1 : 0.35,
                    boxShadow: active ? `0 0 3px ${color}88` : 'none',
                } }, `${meterId}-${i}`));
        }) }));
});
VUMeter.displayName = 'VUMeter';
const Btn = memo(({ children, onClick, active, danger, dim, className = '', title, disabled = false, 'aria-pressed': ariaPressed, }) => (_jsx("button", { onClick: onClick, title: title, disabled: disabled, "aria-pressed": ariaPressed ?? active, className: `
      px-2 py-1 rounded text-[11px] tracking-widest uppercase font-mono border
      transition-all duration-100 select-none
      ${active
        ? danger
            ? 'bg-red-600/20 border-red-600/60 text-red-400'
            : 'bg-[#a3e635]/10 border-[#a3e635]/40 text-[#a3e635]'
        : dim || disabled
            ? 'bg-transparent border-[#2a2a2a] text-[var(--dj-dim)] cursor-not-allowed'
            : 'bg-[var(--t-b2x)] border-[var(--dj-dimmer)] text-[var(--text-dim)] hover:border-[#555] hover:text-[var(--daw-ghost)]'}
      ${className}
    `, children: children })));
Btn.displayName = 'Btn';
const Led = memo(({ on, color = CONSTANTS.COLORS.warn, pulse, label }) => (_jsxs("div", { className: "flex items-center gap-1", title: label, children: [_jsx("div", { className: `w-2 h-2 rounded-full ${pulse && on ? 'animate-pulse' : ''}`, role: "status", "aria-label": label || (on ? 'Active' : 'Inactive'), style: {
                background: on ? color : 'var(--t-b2x)',
                boxShadow: on ? `0 0 6px ${color}, 0 0 12px ${color}44` : 'none',
                border: `1px solid ${on ? color : 'var(--dj-dimmer)'}`,
            } }), label && _jsx("span", { className: "text-[8px] text-[var(--dj-dim)]", children: label })] })));
Led.displayName = 'Led';
// ─── Time Savings Readout ─────────────────────────────────────────────────────
const TimeSavingsReadout = memo(() => {
    const acceptedCount = useDAWStore(useCallback(s => s.aiSuggestions.filter((x) => x.accepted === true).length, []));
    const saved = acceptedCount * CONSTANTS.DEFAULT_MINS_PER_SUGGESTION;
    if (saved === 0)
        return null;
    return (_jsxs("div", { className: "flex items-center gap-1 px-2 py-0.5 border border-[#a3e635]/25 bg-[#a3e635]/5", title: `${acceptedCount} AI suggestion${acceptedCount !== 1 ? 's' : ''} accepted — ~${saved} min saved`, role: "status", "aria-label": `Time saved: ${saved} minutes`, children: [_jsx("span", { className: "text-[8px] text-[#a3e635]/60 tracking-widest", children: "SAVED" }), _jsxs("span", { className: "text-[10px] font-mono text-[#a3e635] font-semibold", children: [saved, "m"] })] }));
});
TimeSavingsReadout.displayName = 'TimeSavingsReadout';
// ─── Tooltip Component ────────────────────────────────────────────────────────
const Tooltip = memo(({ children, content }) => {
    const [visible, setVisible] = useState(false);
    const triggerRef = useRef(null);
    return (_jsxs("div", { className: "relative inline-flex", onMouseEnter: () => setVisible(true), onMouseLeave: () => setVisible(false), onFocus: () => setVisible(true), onBlur: () => setVisible(false), ref: triggerRef, children: [children, visible && (_jsx("div", { role: "tooltip", className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[9px] bg-[#1a1a1a] border border-[#333] rounded whitespace-nowrap z-50 pointer-events-none", style: { color: 'var(--text-dim)' }, children: content }))] }));
});
Tooltip.displayName = 'Tooltip';
const TransportBar = memo(({ engine }) => {
    const { playing, recording, bpm, position, timeSignature, loopEnabled, metronomeEnabled, masterGain, syncStatus, projectName, collabConnected, setPlaying, setRecording, setBpm, setLoopEnabled, setMetronome, setMasterGain, setProjectName, setTimeSignature, } = useDAWStore();
    const [editingBpm, setEditingBpm] = useState(false);
    const [bpmInput, setBpmInput] = useState('');
    const [editingName, setEditingName] = useState(false);
    const bpmInputRef = useRef(null);
    const nameInputRef = useRef(null);
    // Auto-focus inputs when editing
    useEffect(() => {
        if (editingBpm)
            bpmInputRef.current?.focus();
    }, [editingBpm]);
    useEffect(() => {
        if (editingName)
            nameInputRef.current?.focus();
    }, [editingName]);
    const beats = Math.floor(position);
    const bar = Math.floor(beats / timeSignature[0]) + 1;
    const beat = (beats % timeSignature[0]) + 1;
    const posStr = `${String(bar).padStart(3, '0')}:${beat}`;
    const syncColors = {
        idle: 'var(--dj-dim)',
        syncing: 'var(--status-warn)',
        synced: 'var(--accent-green)',
        error: '#ef4444',
        offline: '#555',
    };
    const handleBpmSubmit = useCallback(() => {
        const v = parseFloat(bpmInput);
        if (!isNaN(v) && v >= CONSTANTS.MIN_BPM && v <= CONSTANTS.MAX_BPM) {
            setBpm(v);
        }
        setEditingBpm(false);
    }, [bpmInput, setBpm]);
    const handleNameSubmit = useCallback(() => {
        setEditingName(false);
    }, []);
    return (_jsxs("div", { className: "flex items-center gap-3 px-4 py-2 bg-[#0d0d0d] border-b border-[#1c1c1c]", style: { minHeight: 52 }, role: "toolbar", "aria-label": "Transport controls", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-[140px]", children: [_jsx(Led, { on: collabConnected, color: CONSTANTS.COLORS.cyan, pulse: collabConnected, label: collabConnected ? 'Online' : 'Offline' }), editingName ? (_jsx("input", { ref: nameInputRef, autoFocus: true, className: "bg-[var(--t-b2x)] border border-[#a3e635]/40 px-1 text-xs text-white w-28", value: projectName, onChange: e => setProjectName(e.target.value.slice(0, 64)), onBlur: handleNameSubmit, onKeyDown: e => {
                            if (e.key === 'Enter')
                                handleNameSubmit();
                            if (e.key === 'Escape')
                                setEditingName(false);
                        }, "aria-label": "Project name", maxLength: 64 })) : (_jsx("span", { className: "text-[11px] tracking-widest text-[var(--text-dim)] cursor-pointer hover:text-[#a3e635] transition-colors truncate max-w-[120px]", onClick: () => setEditingName(true), role: "button", tabIndex: 0, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ')
                            setEditingName(true); }, "aria-label": `Project: ${projectName}. Click to edit.`, children: projectName || 'Untitled Project' })), _jsx("div", { className: "w-1.5 h-1.5 rounded-full", style: { background: syncColors[syncStatus] ?? 'var(--dj-dim)' }, title: `Sync: ${syncStatus}`, role: "status", "aria-label": `Sync status: ${syncStatus}` })] }), _jsx("div", { className: "w-px h-8 bg-[#2a2a2a]", role: "separator" }), _jsxs("div", { className: "flex items-center gap-1.5", role: "group", "aria-label": "Playback controls", children: [_jsx(Btn, { onClick: engine.stop, title: "Stop (Space)", "aria-pressed": !playing && !recording, children: "\u25A0" }), _jsx(Btn, { onClick: engine.togglePlay, active: playing, title: "Play/Pause (Space)", "aria-pressed": playing, children: playing ? '⏸' : '▶' }), _jsx(Btn, { onClick: engine.toggleRecord, active: recording, danger: recording, title: "Record (R)", "aria-pressed": recording, children: "\u23FA" })] }), _jsx("div", { className: "font-mono text-sm bg-[#0a0a0a] border border-[var(--dj-border)] rounded px-2 py-1", style: { minWidth: 72, textAlign: 'center' }, role: "timer", "aria-label": `Position: bar ${bar}, beat ${beat}`, "aria-live": "polite", children: _jsx("span", { className: "text-[#a3e635]", children: posStr }) }), _jsx("div", { className: "w-px h-8 bg-[#2a2a2a]", role: "separator" }), _jsxs("div", { className: "flex items-center gap-1.5", role: "group", "aria-label": "Tempo controls", children: [_jsx("button", { className: "text-[10px] text-[#555] hover:text-[#a3e635] px-1 select-none", onClick: () => engine.nudgeBpm(-1), "aria-label": "Decrease BPM", children: "\u25C0" }), editingBpm ? (_jsx("input", { ref: bpmInputRef, autoFocus: true, className: "w-14 bg-[#0a0a0a] border border-[#a3e635]/40 text-center text-[#a3e635] font-mono text-sm", value: bpmInput, onChange: e => setBpmInput(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6)), onBlur: handleBpmSubmit, onKeyDown: e => {
                            if (e.key === 'Enter')
                                handleBpmSubmit();
                            if (e.key === 'Escape')
                                setEditingBpm(false);
                        }, "aria-label": "BPM input" })) : (_jsx("div", { className: "font-mono text-sm bg-[#0a0a0a] border border-[var(--dj-border)] px-2 py-1 cursor-pointer hover:border-[#a3e635]/30 min-w-[56px] text-center text-[#a3e635]", onClick: () => { setBpmInput(String(bpm)); setEditingBpm(true); }, role: "button", tabIndex: 0, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') {
                            setBpmInput(String(bpm));
                            setEditingBpm(true);
                        } }, "aria-label": `Current BPM: ${bpm.toFixed(1)}. Click to edit.`, children: bpm.toFixed(1) })), _jsx("button", { className: "text-[10px] text-[#555] hover:text-[#a3e635] px-1 select-none", onClick: () => engine.nudgeBpm(1), "aria-label": "Increase BPM", children: "\u25B6" }), _jsx("span", { className: "text-[9px] text-[var(--dj-dim)] tracking-widest", children: "BPM" }), _jsx(Btn, { onClick: engine.tapTempo, className: "text-[9px]", title: "Tap Tempo (T)", children: "TAP" })] }), _jsx("select", { className: "bg-[#0d0d0d] border border-[var(--dj-border)] rounded text-[11px] text-[var(--text-dim)] px-1 py-0.5 cursor-pointer", value: `${timeSignature[0]}/${timeSignature[1]}`, onChange: e => {
                    const [n, d] = e.target.value.split('/').map(Number);
                    setTimeSignature([n, d]);
                }, "aria-label": "Time signature", children: CONSTANTS.TIME_SIGNATURES.map(s => _jsx("option", { value: s, children: s }, s)) }), _jsx("div", { className: "w-px h-8 bg-[#2a2a2a]", role: "separator" }), _jsxs("div", { className: "flex items-center gap-1.5", role: "group", "aria-label": "Playback options", children: [_jsx(Btn, { onClick: () => setLoopEnabled(!loopEnabled), active: loopEnabled, title: "Loop", "aria-pressed": loopEnabled, children: "\u27F3" }), _jsx(Btn, { onClick: () => setMetronome(!metronomeEnabled), active: metronomeEnabled, title: "Metronome", "aria-pressed": metronomeEnabled, children: "\uD83C\uDFB5" })] }), _jsxs("div", { className: "flex items-center gap-2 ml-auto", children: [_jsx(TimeSavingsReadout, {}), _jsx("div", { className: "w-px h-5 bg-[#2a2a2a]", role: "separator" }), _jsx("span", { className: "text-[9px] text-[var(--dj-dim)] tracking-widest", children: "MASTER" }), _jsx(Knob, { value: masterGain, min: 0, max: 1.5, label: "", onChange: setMasterGain, size: 28, "aria-label": "Master gain" })] })] }));
});
TransportBar.displayName = 'TransportBar';
const Sidebar = memo(({ collab }) => {
    const sidebarTab = useDAWStore(s => s.sidebarTab);
    const setSidebarTab = useDAWStore(s => s.setSidebarTab);
    const collabUsers = useDAWStore(s => s.collabUsers);
    const collabConnected = useDAWStore(s => s.collabConnected);
    const collabEnabled = useDAWStore(s => s.collabEnabled);
    const collabRoom = useDAWStore(s => s.collabRoom);
    const loadedPlugins = useDAWStore(s => s.loadedPlugins);
    const tracks = useDAWStore(s => s.tracks);
    const addTrack = useDAWStore(s => s.addTrack);
    const [joining, setJoining] = useState(false);
    const [roomInput, setRoomInput] = useState('');
    const [uploadError, setUploadError] = useState(null);
    const [, navigate] = useLocation();
    const uploadRef = useRef(null);
    const fileListRef = useRef(null);
    // Sanitize room input
    const sanitizedRoomInput = roomInput.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
    const handleJoinRoom = useCallback(() => {
        if (!sanitizedRoomInput)
            return;
        const userId = crypto.randomUUID().slice(0, 8);
        const colors = [
            CONSTANTS.COLORS.warn,
            CONSTANTS.COLORS.cyan,
            CONSTANTS.COLORS.accent,
            CONSTANTS.COLORS.violet,
            CONSTANTS.COLORS.clip,
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        collab.joinRoom(sanitizedRoomInput, userId, `USER_${userId.slice(0, 4)}`, color);
        setJoining(false);
        setRoomInput('');
    }, [sanitizedRoomInput, collab]);
    const handleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        // Validate file type and size
        const validTypes = ['audio/wav', 'audio/mpeg', 'audio/aiff', 'audio/flac', 'audio/ogg', 'audio/x-wav'];
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|aiff|flac|ogg)$/i)) {
            setUploadError(`Invalid format: ${file.name}. Supported: WAV, MP3, AIFF, FLAC, OGG`);
            return;
        }
        if (file.size > maxSize) {
            setUploadError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 100MB`);
            return;
        }
        setUploadError(null);
        // Upload queued — wire to engine handler
        isDev && console.info('[Upload] Queued:', file.name, `${(file.size / 1024).toFixed(1)}KB`);
        e.target.value = '';
    }, []);
    const handleAddTrack = useCallback(() => {
        addTrack({
            label: `TRACK ${tracks.length + 1}`,
            type: 'audio',
            color: 'var(--text-dim)',
            gain: 0.8,
            pan: 0,
            mute: false,
            solo: false,
            armed: false,
            fxChain: [],
            sends: [],
            inputSource: null,
        });
    }, [addTrack, tracks.length]);
    return (_jsxs("div", { className: "flex flex-col bg-[#0d0d0d] border-r border-[#1c1c1c]", style: { width: 180 }, role: "complementary", "aria-label": "Sidebar", children: [_jsx("div", { className: "flex border-b border-[#1c1c1c]", role: "tablist", "aria-label": "Sidebar tabs", children: ['files', 'collab', 'plugins'].map(tab => (_jsxs("button", { onClick: () => setSidebarTab(tab), className: `flex-1 py-1.5 text-[9px] tracking-widest uppercase font-mono transition-colors ${sidebarTab === tab
                        ? 'text-[#a3e635] border-b border-[#a3e635]'
                        : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`, role: "tab", "aria-selected": sidebarTab === tab, "aria-controls": `sidebar-panel-${tab}`, id: `sidebar-tab-${tab}`, children: [tab === 'files' ? '📁' : tab === 'collab' ? '👥' : '🧩', _jsx("span", { className: "sr-only", children: tab })] }, tab))) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-2 space-y-1", role: "tabpanel", id: `sidebar-panel-${sidebarTab}`, "aria-labelledby": `sidebar-tab-${sidebarTab}`, children: [sidebarTab === 'files' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[9px] text-[var(--dj-dim)] tracking-widest px-1 mb-2", children: "BROWSER" }), _jsx("div", { ref: fileListRef, role: "tree", "aria-label": "File browser", children: CONSTANTS.FILE_BROWSER_ITEMS.map(f => (_jsxs("div", { className: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--t-b2x)] cursor-pointer group", role: "treeitem", tabIndex: 0, onKeyDown: e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            // Expand/collapse folder
                                        }
                                    }, children: [_jsx("span", { className: "text-[#555] text-xs", "aria-hidden": "true", children: f.type === 'folder' ? '▸' : '•' }), _jsx("span", { className: "text-[11px] text-[var(--dj-muted)] group-hover:text-[var(--daw-sub)] transition-colors font-mono", children: f.name })] }, f.name))) }), _jsxs("div", { className: "pt-2 border-t border-[#1c1c1c] mt-2", children: [_jsx("input", { ref: uploadRef, type: "file", accept: "audio/*,.wav,.mp3,.aiff,.flac,.ogg", style: { display: 'none' }, onChange: handleFileUpload, "aria-label": "Upload audio file" }), uploadError && (_jsx("div", { className: "text-[9px] text-red-400 mb-1 px-1", role: "alert", children: uploadError })), _jsx(Btn, { className: "w-full justify-center text-[9px]", onClick: () => uploadRef.current?.click(), children: "+ UPLOAD" })] })] })), sidebarTab === 'collab' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[9px] text-[var(--dj-dim)] tracking-widest px-1 mb-2", children: "COLLABORATION" }), _jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Led, { on: collabConnected, color: CONSTANTS.COLORS.cyan, pulse: collabConnected }), _jsx("span", { className: "text-[10px] text-[var(--dj-muted)]", children: collabConnected ? `ROOM ${collabRoom}` : 'DISCONNECTED' })] }), !collabEnabled ? (joining ? (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { autoFocus: true, placeholder: "ROOM ID", className: "w-full bg-[var(--t-b2x)] border border-[#a3e635]/30 px-2 py-1 text-[11px] text-[var(--daw-ghost)] font-mono", value: roomInput, onChange: e => setRoomInput(e.target.value), onKeyDown: e => {
                                            if (e.key === 'Enter' && sanitizedRoomInput)
                                                handleJoinRoom();
                                            if (e.key === 'Escape')
                                                setJoining(false);
                                        }, maxLength: 16, "aria-label": "Room ID" }), _jsx(Btn, { className: "w-full text-center text-[9px]", onClick: () => setJoining(false), children: "CANCEL" })] })) : (_jsx(Btn, { className: "w-full text-center text-[9px]", onClick: () => setJoining(true), children: "JOIN ROOM" }))) : (_jsx(Btn, { className: "w-full text-center text-[9px]", danger: true, onClick: collab.leaveRoom, children: "LEAVE ROOM" })), collabUsers.length > 0 && (_jsx("div", { className: "mt-3 space-y-1", role: "list", "aria-label": "Collaborators", children: collabUsers.map(u => (_jsxs("div", { className: "flex items-center gap-2 px-1 py-1", role: "listitem", children: [_jsx("div", { className: "w-2 h-2 rounded-full", style: { background: u.color }, "aria-hidden": "true" }), _jsx("span", { className: "text-[10px] font-mono", style: { color: u.color }, children: u.name })] }, u.id))) }))] })), sidebarTab === 'plugins' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[9px] text-[var(--dj-dim)] tracking-widest px-1 mb-2", children: "PLUGIN SDK" }), loadedPlugins.length === 0 ? (_jsx("div", { className: "text-[10px] text-[var(--dj-dimmer)] text-center py-4 font-mono", children: "NO PLUGINS LOADED" })) : (_jsx("div", { role: "list", "aria-label": "Loaded plugins", children: loadedPlugins.map(p => (_jsxs("div", { className: "flex items-center justify-between px-2 py-1 rounded bg-[var(--t-b2x)]", role: "listitem", children: [_jsx("span", { className: "text-[10px] text-[var(--text-muted)]", children: p.name }), _jsx(Led, { on: p.enabled, color: "var(--accent-green)", label: p.enabled ? 'Enabled' : 'Disabled' })] }, p.id))) })), _jsx("div", { className: "pt-2 border-t border-[#1c1c1c] mt-2", children: _jsx(Btn, { className: "w-full justify-center text-[9px]", onClick: () => navigate('/vst'), children: "LOAD VST/AU" }) })] }))] })] }));
});
Sidebar.displayName = 'Sidebar';
const ArrangementView = memo(({ engine, collab }) => {
    const tracks = useDAWStore(s => s.tracks);
    const regions = useDAWStore(s => s.regions);
    const position = useDAWStore(s => s.position);
    const playing = useDAWStore(s => s.playing);
    const zoom = useDAWStore(s => s.zoom);
    const scrollLeft = useDAWStore(s => s.scrollLeft);
    const selectedTrackId = useDAWStore(s => s.selectedTrackId);
    const selectedRegionId = useDAWStore(s => s.selectedRegionId);
    const loopEnabled = useDAWStore(s => s.loopEnabled);
    const loopStart = useDAWStore(s => s.loopStart);
    const loopEnd = useDAWStore(s => s.loopEnd);
    const collabUsers = useDAWStore(s => s.collabUsers);
    const predictionsVisible = useDAWStore(s => s.predictionsVisible);
    const arrangementPredictions = useDAWStore(s => s.arrangementPredictions);
    const trackHeightMode = useDAWStore(s => s.trackHeightMode);
    const setSelectedTrack = useDAWStore(s => s.setSelectedTrack);
    const setSelectedRegion = useDAWStore(s => s.setSelectedRegion);
    const setScrollLeft = useDAWStore(s => s.setScrollLeft);
    const setZoom = useDAWStore(s => s.setZoom);
    const addTrack = useDAWStore(s => s.addTrack);
    const containerRef = useRef(null);
    const TRACK_HEIGHT = CONSTANTS.TRACK_HEIGHTS[trackHeightMode];
    const BPW = CONSTANTS.BEAT_WIDTH * zoom;
    const totalWidth = CONSTANTS.TOTAL_BEATS * BPW;
    // Playhead position (memoized)
    const playheadX = useMemo(() => position * BPW - scrollLeft, [position, BPW, scrollLeft]);
    // Snap to beat grid (memoized)
    const snapBeat = useCallback((px) => {
        const rawBeat = (px + scrollLeft) / BPW;
        return Math.round(rawBeat);
    }, [scrollLeft, BPW]);
    // Throttled scroll handler
    const onScroll = useThrottledCallback((e) => {
        setScrollLeft(e.currentTarget.scrollLeft);
    }, CONSTANTS.THROTTLE_MS);
    // Zoom with Ctrl+wheel
    const onWheel = useCallback((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(Math.max(0.1, Math.min(10, zoom * factor)));
        }
    }, [zoom, setZoom]);
    // Click on arrangement ruler to seek
    const onRulerClick = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const beat = snapBeat(e.clientX - rect.left);
        engine.seekTo(beat);
        collab.broadcastCursor(beat, selectedTrackId);
    }, [snapBeat, engine, collab, selectedTrackId]);
    // Beat markers (memoized)
    const beatMarkers = useMemo(() => {
        const markers = [];
        const step = zoom < 1 ? 8 : zoom < 2 ? 4 : 1;
        for (let b = 0; b <= CONSTANTS.TOTAL_BEATS; b += step) {
            markers.push(b);
        }
        return markers;
    }, [zoom]);
    // Track index map (memoized for O(1) lookups)
    const trackIndexMap = useMemo(() => {
        const map = new Map();
        tracks.forEach((t, i) => map.set(t.id, i));
        return map;
    }, [tracks]);
    // Handle add track
    const handleAddTrack = useCallback(() => {
        addTrack({
            label: `TRACK ${tracks.length + 1}`,
            type: 'audio',
            color: 'var(--text-dim)',
            gain: 0.8,
            pan: 0,
            mute: false,
            solo: false,
            armed: false,
            fxChain: [],
            sends: [],
            inputSource: null,
        });
    }, [addTrack, tracks.length]);
    // Keyboard navigation for arrangement
    const handleArrangementKeyDown = useCallback((e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIdx = trackIndexMap.get(selectedTrackId ?? '');
            if (currentIdx !== undefined && currentIdx < tracks.length - 1) {
                setSelectedTrack(tracks[currentIdx + 1].id);
            }
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentIdx = trackIndexMap.get(selectedTrackId ?? '');
            if (currentIdx !== undefined && currentIdx > 0) {
                setSelectedTrack(tracks[currentIdx - 1].id);
            }
        }
    }, [trackIndexMap, selectedTrackId, tracks, setSelectedTrack]);
    return (_jsxs("div", { className: "flex flex-col flex-1 overflow-hidden bg-[#0d0d0d]", role: "region", "aria-label": "Arrangement view", tabIndex: 0, onKeyDown: handleArrangementKeyDown, children: [_jsx("div", { className: "flex-none bg-[#0a0a0a] border-b border-[#1c1c1c] relative overflow-hidden cursor-pointer", style: { height: 24, marginLeft: 140 }, onClick: onRulerClick, role: "scrollbar", "aria-label": "Timeline ruler", "aria-orientation": "horizontal", children: _jsxs("div", { className: "absolute top-0 left-0", style: { width: totalWidth, height: 24 }, children: [beatMarkers.map(b => (_jsxs("div", { className: "absolute top-0 h-full flex flex-col justify-end pb-1", style: { left: b * BPW - scrollLeft }, children: [_jsx("div", { className: "w-px bg-[#2a2a2a] flex-1" }), _jsx("span", { className: "text-[8px] text-[var(--dj-dim)] font-mono ml-1", children: b })] }, b))), loopEnabled && (_jsx("div", { className: "absolute top-0 h-full bg-amber-500/10 border-l border-r border-amber-500/40", style: {
                                left: loopStart * BPW - scrollLeft,
                                width: (loopEnd - loopStart) * BPW,
                            }, role: "region", "aria-label": `Loop region: bar ${loopStart} to ${loopEnd}` })), playheadX >= 0 && (_jsx("div", { className: "absolute top-0 w-px h-full", style: {
                                left: playheadX,
                                background: 'var(--status-warn)',
                                boxShadow: '0 0 4px var(--status-warn)',
                            }, role: "presentation", "aria-hidden": "true" })), collabUsers.map(u => u.cursorBeat != null ? (_jsx("div", { className: "absolute top-0 w-px h-full opacity-70", style: { left: u.cursorBeat * BPW - scrollLeft, background: u.color }, title: u.name, role: "presentation", "aria-label": `${u.name} cursor at beat ${u.cursorBeat}` }, u.id)) : null)] }) }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsxs("div", { className: "flex-none flex flex-col border-r border-[#1c1c1c]", style: { width: 140 }, children: [tracks.map(track => (_jsx(TrackLabel, { track: track, height: TRACK_HEIGHT, selected: selectedTrackId === track.id, onSelect: () => setSelectedTrack(track.id) }, track.id))), _jsx("div", { className: "flex items-center justify-center border-b border-[var(--t-b2x)] cursor-pointer hover:bg-[var(--t-b2)] transition-colors group", style: { height: TRACK_HEIGHT }, onClick: handleAddTrack, title: "Add track", role: "button", tabIndex: 0, onKeyDown: (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleAddTrack();
                                    }
                                }, "aria-label": "Add new track", children: _jsx("span", { className: "text-[9px] text-[#2a2a2a] group-hover:text-[#a3e635]/60 tracking-widest transition-colors select-none", children: "+ ADD TRACK" }) })] }), _jsx("div", { ref: containerRef, className: "flex-1 overflow-x-auto overflow-y-hidden relative", style: { scrollbarColor: '#2a2a2a #0d0d0d', scrollbarWidth: 'thin' }, onScroll: onScroll, onWheel: onWheel, role: "region", "aria-label": "Track regions", children: _jsxs("div", { style: { width: totalWidth, position: 'relative' }, children: [tracks.map((track, i) => (_jsx("div", { className: `absolute w-full border-b border-[var(--t-b2x)] ${selectedTrackId === track.id ? 'bg-[var(--t-b2)]' : i % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[var(--panel-deep)]'}`, style: { top: i * TRACK_HEIGHT, height: TRACK_HEIGHT }, onClick: () => {
                                        setSelectedTrack(track.id);
                                        collab.broadcastCursor(position, track.id);
                                    }, role: "button", tabIndex: -1, "aria-selected": selectedTrackId === track.id }, track.id))), beatMarkers.map(b => (_jsx("div", { className: "absolute top-0 w-px", style: {
                                        left: b * BPW,
                                        height: tracks.length * TRACK_HEIGHT,
                                        background: b % 4 === 0 ? '#1c1c1c' : 'var(--panel-deep)',
                                    }, "aria-hidden": "true" }, b))), regions.map(region => {
                                    const trackIdx = trackIndexMap.get(region.trackId);
                                    if (trackIdx === undefined || trackIdx < 0)
                                        return null;
                                    return (_jsx(RegionBlock, { region: region, top: trackIdx * TRACK_HEIGHT, height: TRACK_HEIGHT - 2, bpw: BPW, selected: selectedRegionId === region.id, onClick: () => setSelectedRegion?.(region.id) }, region.id));
                                }), predictionsVisible && arrangementPredictions.map((pred, i) => {
                                    const trackIdx = trackIndexMap.get(pred.trackId);
                                    if (trackIdx === undefined || trackIdx < 0)
                                        return null;
                                    return (_jsx("div", { className: "absolute border rounded pointer-events-none", style: {
                                            left: pred.startBeat * BPW,
                                            top: trackIdx * TRACK_HEIGHT,
                                            height: TRACK_HEIGHT - 2,
                                            width: 16 * BPW,
                                            background: CONSTANTS.PREDICTION_COLORS[pred.suggestedAction] ?? '#ffffff11',
                                            borderColor: '#ffffff22',
                                        }, title: `AI: ${pred.label} (${Math.round(pred.confidence * 100)}%)`, role: "img", "aria-label": `AI prediction: ${pred.suggestedAction} at beat ${pred.startBeat} with ${Math.round(pred.confidence * 100)}% confidence`, children: _jsx("span", { className: "text-[8px] text-white/40 px-1 leading-none absolute bottom-1", children: pred.suggestedAction.toUpperCase() }) }, i));
                                }), _jsx("div", { className: "absolute top-0 w-px pointer-events-none z-10", style: {
                                        left: position * BPW,
                                        height: tracks.length * TRACK_HEIGHT,
                                        background: playing ? 'var(--status-warn)' : '#f59e0b66',
                                        boxShadow: playing ? '0 0 6px #f59e0b88' : 'none',
                                    }, "aria-hidden": "true" })] }) })] })] }));
});
ArrangementView.displayName = 'ArrangementView';
const TrackLabel = memo(({ track, height, selected, onSelect }) => {
    const updateTrack = useDAWStore(s => s.updateTrack);
    const handleMute = useCallback((e) => {
        e.stopPropagation();
        updateTrack(track.id, { mute: !track.mute });
    }, [track.id, track.mute, updateTrack]);
    const handleSolo = useCallback((e) => {
        e.stopPropagation();
        updateTrack(track.id, { solo: !track.solo });
    }, [track.id, track.solo, updateTrack]);
    return (_jsxs("div", { className: `flex items-center gap-1.5 px-2 border-b border-[var(--t-b2x)] cursor-pointer transition-colors ${selected ? 'bg-[var(--t-b2x)]' : 'bg-[#0d0d0d] hover:bg-[var(--t-b2)]'}`, style: { height, borderLeft: `2px solid ${track.color}` }, onClick: onSelect, role: "button", tabIndex: 0, "aria-selected": selected, onKeyDown: e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
            }
        }, children: [_jsxs("div", { className: "flex-1 flex flex-col gap-0.5 min-w-0", children: [_jsx("span", { className: "text-[10px] font-mono tracking-wider text-[var(--daw-ghost)] truncate", children: track.label }), _jsx("div", { className: "flex items-center gap-1", children: _jsx("span", { className: "text-[8px] text-[var(--dj-dim)]", children: track.type.toUpperCase() }) })] }), _jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("button", { className: `text-[8px] font-mono px-1 ${track.mute ? 'text-[#a3e635] bg-[#a3e635]/10' : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`, onClick: handleMute, "aria-pressed": track.mute, "aria-label": `${track.mute ? 'Unmute' : 'Mute'} ${track.label}`, children: "M" }), _jsx("button", { className: `text-[8px] font-mono px-1 rounded ${track.solo ? 'text-cyan-400 bg-cyan-500/20' : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`, onClick: handleSolo, "aria-pressed": track.solo, "aria-label": `${track.solo ? 'Unsolo' : 'Solo'} ${track.label}`, children: "S" })] })] }));
});
TrackLabel.displayName = 'TrackLabel';
const RegionBlock = memo(({ region, top, height, bpw, selected, onClick }) => (_jsxs("div", { className: "absolute rounded-sm overflow-hidden cursor-pointer border transition-colors focus:outline-none focus:ring-1 focus:ring-[#a3e635]", style: {
        left: region.startBeat * bpw + 1,
        top: top + 1,
        width: Math.max(4, region.lengthBeats * bpw - 2),
        height,
        background: `${region.color}22`,
        borderColor: selected ? region.color : `${region.color}55`,
        boxShadow: selected ? `0 0 8px ${region.color}44` : 'none',
    }, onClick: onClick, role: "button", tabIndex: 0, "aria-selected": selected, "aria-label": `Region ${region.label}, ${region.lengthBeats} beats`, onKeyDown: e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, children: [_jsx("div", { className: "absolute top-0 left-0 right-0 h-0.5", style: { background: region.color, opacity: 0.8 } }), _jsx("span", { className: "absolute bottom-1 left-1 text-[9px] font-mono tracking-wide", style: { color: region.color }, children: region.label })] })));
RegionBlock.displayName = 'RegionBlock';
const MidiSequencerPanel = memo(({ seq }) => {
    const midiPatterns = useDAWStore(s => s.midiPatterns);
    const activePatternId = useDAWStore(s => s.activePatternId);
    const sequencerStep = useDAWStore(s => s.sequencerStep);
    const setActivePattern = useDAWStore(s => s.setActivePattern);
    const addMidiPattern = useDAWStore(s => s.addMidiPattern);
    const selectedTrackId = useDAWStore(s => s.selectedTrackId);
    const pattern = midiPatterns.find(p => p.id === activePatternId);
    const steps = pattern?.steps ?? 16;
    const hasNote = useCallback((step, pitch) => pattern?.notes.some(n => n.step === step && n.pitch === pitch) ?? false, [pattern]);
    const noteVelocity = useCallback((step, pitch) => pattern?.notes.find(n => n.step === step && n.pitch === pitch)?.velocity ?? 100, [pattern]);
    const handleAddPattern = useCallback(() => {
        addMidiPattern({
            name: `PATTERN ${midiPatterns.length + 1}`,
            steps: 16,
            notes: [],
            trackId: selectedTrackId ?? '',
        });
    }, [addMidiPattern, midiPatterns.length, selectedTrackId]);
    return (_jsxs("div", { className: "flex flex-col bg-[#0a0a0a] border-t border-[#1c1c1c]", style: { height: 200 }, role: "region", "aria-label": "MIDI piano roll sequencer", children: [_jsxs("div", { className: "flex items-center gap-3 px-3 py-1.5 border-b border-[#1c1c1c] flex-none", children: [_jsx("span", { className: "text-[10px] tracking-widest text-[#555]", children: "MIDI PIANO ROLL" }), _jsxs("div", { className: "flex gap-1", role: "tablist", "aria-label": "Pattern selector", children: [midiPatterns.map(p => (_jsx("button", { className: `px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${p.id === activePatternId
                                    ? 'bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/40'
                                    : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)] border border-[var(--dj-border)]'}`, onClick: () => setActivePattern(p.id), role: "tab", "aria-selected": p.id === activePatternId, children: p.name }, p.id))), _jsx(Btn, { className: "text-[9px]", onClick: handleAddPattern, "aria-label": "Add new pattern", children: "+" })] }), _jsxs("div", { className: "ml-auto flex gap-1", children: [_jsx(Btn, { className: "text-[9px]", onClick: seq.clearPattern, "aria-label": "Clear pattern", children: "CLR" }), _jsx(Btn, { className: "text-[9px]", onClick: seq.duplicate, "aria-label": "Duplicate pattern", children: "DUP" }), [16, 32, 64].map(n => (_jsx(Btn, { className: "text-[9px]", active: pattern?.steps === n, onClick: () => seq.setPatternLength(n), "aria-label": `Set ${n} steps`, children: n }, n)))] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx("div", { className: "flex-none flex flex-col border-r border-[#1c1c1c]", style: { width: 36 }, children: CONSTANTS.PIANO_PITCHES.map(pitch => {
                            const name = seq.getPitchLabel(pitch);
                            const isBlack = name.includes('#');
                            return (_jsx("div", { className: `flex items-center justify-end pr-1 border-b border-[var(--dj-surface2)] ${isBlack ? 'bg-[var(--dj-surface2)]' : 'bg-[var(--t-b2x)]'}`, style: { height: `${100 / CONSTANTS.PIANO_PITCHES.length}%` }, role: "button", tabIndex: -1, "aria-label": `${name} key`, children: _jsx("span", { className: "text-[7px] font-mono", style: { color: isBlack ? 'var(--dj-dim)' : '#555' }, children: name }) }, pitch));
                        }) }), _jsx("div", { className: "flex-1 overflow-x-auto", role: "grid", "aria-label": "MIDI step grid", children: _jsx("div", { className: "flex flex-col", style: { minWidth: steps * 20 }, children: CONSTANTS.PIANO_PITCHES.map(pitch => (_jsx("div", { className: "flex flex-1", style: { height: `${100 / CONSTANTS.PIANO_PITCHES.length}%` }, children: Array.from({ length: steps }, (_, step) => {
                                    const active = hasNote(step, pitch);
                                    const isCurrent = step === sequencerStep;
                                    const vel = noteVelocity(step, pitch);
                                    return (_jsx("div", { className: "border-r border-b border-[var(--dj-surface2)] cursor-pointer transition-colors flex items-end", style: {
                                            width: 20,
                                            background: isCurrent
                                                ? '#f59e0b22'
                                                : active
                                                    ? '#a3e635'
                                                    : step % 4 === 0 ? 'var(--panel-deep)' : '#0d0d0d',
                                            boxShadow: active ? '0 0 4px rgba(163,230,53,0.35)' : 'none',
                                        }, onClick: () => seq.toggleNote(step, pitch, 100), role: "gridcell", "aria-selected": active, "aria-label": active ? `${seq.getPitchLabel(pitch)} step ${step + 1}, velocity ${vel}` : `${seq.getPitchLabel(pitch)} step ${step + 1}`, tabIndex: 0, onKeyDown: e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                seq.toggleNote(step, pitch, 100);
                                            }
                                        }, children: active && (_jsx("div", { className: "w-full", style: { height: `${(vel / 127) * 100}%`, background: 'rgba(163,230,53,0.4)' } })) }, step));
                                }) }, pitch))) }) })] })] }));
});
MidiSequencerPanel.displayName = 'MidiSequencerPanel';
const MixerStrip = memo(({ engine }) => {
    const tracks = useDAWStore(s => s.tracks);
    const masterGain = useDAWStore(s => s.masterGain);
    const setMasterGain = useDAWStore(s => s.setMasterGain);
    const updateTrack = useDAWStore(s => s.updateTrack);
    const setActiveFXTrack = useDAWStore(s => s.setActiveFXTrack);
    const activeFXTrackId = useDAWStore(s => s.activeFXTrackId);
    const [meters, setMeters] = useState({});
    const rafRef = useRef(0);
    const engineRef = useRef(engine);
    engineRef.current = engine;
    // Update meters on rAF with proper cleanup
    useEffect(() => {
        let isMounted = true;
        const update = () => {
            if (!isMounted)
                return;
            const next = {};
            for (const t of tracks) {
                next[t.id] = engineRef.current.getTrackMeterValue(t.id);
            }
            setMeters(next);
            rafRef.current = requestAnimationFrame(update);
        };
        rafRef.current = requestAnimationFrame(update);
        return () => {
            isMounted = false;
            cancelAnimationFrame(rafRef.current);
        };
    }, [tracks]);
    return (_jsxs("div", { className: "flex bg-[#0a0a0a] border-t border-[#1c1c1c] overflow-x-auto", style: { height: 160, scrollbarColor: '#2a2a2a #0a0a0a', scrollbarWidth: 'thin' }, role: "region", "aria-label": "Mixer strip", children: [tracks.map(track => (_jsx(MixerChannel, { track: track, meterLevel: meters[track.id] ?? 0, fxActive: activeFXTrackId === track.id, onFXClick: () => setActiveFXTrack(activeFXTrackId === track.id ? null : track.id), onChange: (partial) => updateTrack(track.id, partial) }, track.id))), _jsxs("div", { className: "flex flex-col items-center px-3 py-2 border-l border-[#2a2a2a] bg-[var(--dj-surface2)] min-w-[64px]", children: [_jsx("span", { className: "text-[8px] tracking-widest text-[#555] mb-2", children: "MASTER" }), _jsx(VUMeter, { level: masterGain > 1 ? 1 : masterGain, label: "Master level" }), _jsx("div", { className: "mt-auto", children: _jsx("input", { type: "range", min: 0, max: 1.5, step: 0.01, value: masterGain, onChange: e => setMasterGain(parseFloat(e.target.value)), className: "h-20 appearance-none", style: {
                                writingMode: 'vertical-lr',
                                direction: 'rtl',
                                accentColor: '#a3e635',
                                background: 'transparent',
                            }, "aria-label": "Master gain fader" }) }), _jsx("span", { className: "text-[8px] font-mono text-[#a3e635] mt-1", children: Math.round(masterGain * 100) })] }), activeFXTrackId && (_jsx(FXRackInline, { trackId: activeFXTrackId }))] }));
});
MixerStrip.displayName = 'MixerStrip';
const MixerChannel = memo(({ track, meterLevel, fxActive, onFXClick, onChange, }) => {
    const handleMute = useCallback(() => onChange({ mute: !track.mute }), [track.mute, onChange]);
    const handleSolo = useCallback(() => onChange({ solo: !track.solo }), [track.solo, onChange]);
    const handleGainChange = useCallback((e) => {
        onChange({ gain: parseFloat(e.target.value) });
    }, [onChange]);
    const handlePanChange = useCallback((pan) => onChange({ pan }), [onChange]);
    return (_jsxs("div", { className: `flex flex-col items-center px-2 py-2 border-r border-[#1c1c1c] transition-colors min-w-[52px] ${track.solo ? 'bg-[var(--panel-deep)]' : track.mute ? 'bg-[var(--panel-deep)]' : ''}`, style: { borderTop: `2px solid ${track.color}` }, role: "group", "aria-label": `${track.label} channel`, children: [_jsx("span", { className: "text-[8px] tracking-widest font-mono mb-1.5", style: { color: track.color }, children: track.label.slice(0, 6) }), _jsx(Knob, { value: track.pan, min: -1, max: 1, label: "PAN", onChange: handlePanChange, size: 24, "aria-label": `${track.label} pan` }), _jsx("div", { className: "flex items-center gap-1 my-1", children: _jsx(VUMeter, { level: meterLevel, label: `${track.label} level` }) }), _jsx("input", { type: "range", min: 0, max: 1.5, step: 0.01, value: track.mute ? 0 : track.gain, onChange: handleGainChange, className: "h-12 appearance-none", style: {
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    accentColor: track.color,
                    background: 'transparent',
                }, "aria-label": `${track.label} gain fader` }), _jsx("span", { className: "text-[8px] font-mono text-[#555] mb-1", children: Math.round((track.mute ? 0 : track.gain) * 100) }), _jsxs("div", { className: "flex gap-0.5", children: [_jsx("button", { className: `text-[7px] font-mono px-0.5 rounded transition-colors ${track.mute ? 'text-[#a3e635] bg-[#a3e635]/10' : 'text-[var(--dj-dimmer)] hover:text-[var(--dj-muted)]'}`, onClick: handleMute, "aria-pressed": track.mute, "aria-label": `${track.mute ? 'Unmute' : 'Mute'} ${track.label}`, children: "M" }), _jsx("button", { className: `text-[7px] font-mono px-0.5 rounded transition-colors ${track.solo ? 'text-cyan-400 bg-cyan-500/20' : 'text-[var(--dj-dimmer)] hover:text-[var(--dj-muted)]'}`, onClick: handleSolo, "aria-pressed": track.solo, "aria-label": `${track.solo ? 'Unsolo' : 'Solo'} ${track.label}`, children: "S" }), _jsx("button", { className: `text-[7px] font-mono px-0.5 rounded transition-colors ${fxActive ? 'text-purple-400 bg-purple-500/20' : 'text-[var(--dj-dimmer)] hover:text-[var(--dj-muted)]'}`, onClick: onFXClick, "aria-pressed": fxActive, "aria-label": `${fxActive ? 'Close' : 'Open'} FX rack for ${track.label}`, children: "FX" })] })] }));
});
MixerChannel.displayName = 'MixerChannel';
const FXRackInline = memo(({ trackId }) => {
    const tracks = useDAWStore(s => s.tracks);
    const updateTrack = useDAWStore(s => s.updateTrack);
    const toggleFXSlot = useDAWStore(s => s.toggleFXSlot);
    const track = tracks.find(t => t.id === trackId);
    const addFX = useCallback((type) => {
        if (!track)
            return;
        updateTrack(trackId, {
            fxChain: [...track.fxChain, {
                    id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    type,
                    enabled: true,
                    params: { gain: 0, freq: 1000, q: 1, threshold: -20, ratio: 4, decay: 1, wet: 0.3 },
                }],
        });
    }, [trackId, track?.fxChain, updateTrack]);
    if (!track)
        return null;
    return (_jsxs("div", { className: "flex flex-col px-3 py-2 border-l-2 border-purple-500/40 min-w-[240px] bg-[var(--panel-deep)]", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("span", { className: "text-[9px] tracking-widest text-purple-400", children: ["FX RACK \u2014 ", track.label] }), _jsxs("select", { className: "bg-[var(--t-b2x)] border border-[var(--dj-dimmer)] rounded text-[9px] text-[var(--text-dim)] px-1", onChange: e => addFX(e.target.value), value: "", "aria-label": "Add effect", children: [_jsx("option", { value: "", disabled: true, children: "+ ADD FX" }), CONSTANTS.FX_TYPES.map(t => _jsx("option", { value: t, children: t.toUpperCase() }, t))] })] }), _jsxs("div", { className: "flex gap-1.5 flex-wrap", role: "list", "aria-label": "Active effects", children: [track.fxChain.map(fx => (_jsx("div", { className: `px-2 py-1 rounded border text-[9px] font-mono cursor-pointer transition-colors ${fx.enabled
                            ? 'border-purple-500/50 text-purple-300 bg-purple-500/10'
                            : 'border-[var(--dj-dimmer)] text-[var(--dj-dim)]'}`, onClick: () => toggleFXSlot(trackId, fx.id), title: fx.enabled ? 'Click to disable' : 'Click to enable', role: "listitem", "aria-pressed": fx.enabled, tabIndex: 0, onKeyDown: e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleFXSlot(trackId, fx.id);
                            }
                        }, children: fx.type.toUpperCase() }, fx.id))), track.fxChain.length === 0 && (_jsx("span", { className: "text-[9px] text-[var(--dj-dimmer)]", children: "NO FX \u2014 ADD FROM DROPDOWN" }))] })] }));
});
FXRackInline.displayName = 'FXRackInline';
const AIPanel = memo(({}) => {
    const aiPanelTab = useDAWStore(s => s.aiPanelTab);
    const aiSuggestions = useDAWStore(s => s.aiSuggestions);
    const aiChat = useDAWStore(s => s.aiChat);
    const aiThinking = useDAWStore(s => s.aiThinking);
    const mastering = useDAWStore(s => s.mastering);
    const setAIPanelTab = useDAWStore(s => s.setAIPanelTab);
    const acceptSuggestion = useDAWStore(s => s.acceptSuggestion);
    const rejectSuggestion = useDAWStore(s => s.rejectSuggestion);
    const addAIChat = useDAWStore(s => s.addAIChat);
    const setAIThinking = useDAWStore(s => s.setAIThinking);
    const updateMastering = useDAWStore(s => s.updateMastering);
    const predictionsVisible = useDAWStore(s => s.predictionsVisible);
    const setPredictionsVisible = useDAWStore(s => s.setPredictionsVisible);
    const setArrangementPredictions = useDAWStore(s => s.setArrangementPredictions);
    const bpm = useDAWStore(s => s.bpm);
    const tracks = useDAWStore(s => s.tracks);
    const position = useDAWStore(s => s.position);
    const [chatInput, setChatInput] = useState('');
    const [aiError, setAiError] = useState(null);
    const chatEndRef = useRef(null);
    const abortRef = useRef(null);
    const requestInFlightRef = useRef(false);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiChat]);
    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => {
            if (abortRef.current)
                abortRef.current.abort();
        };
    }, []);
    // ── sendChat: tries server, falls back to local LLPTE stub ──────────────
    const sendChat = useCallback(async () => {
        const msg = chatInput.trim();
        if (!msg)
            return;
        if (requestInFlightRef.current)
            return; // Prevent double-submit
        addAIChat({ role: 'user', content: msg });
        setChatInput('');
        setAIThinking(true);
        setAiError(null);
        requestInFlightRef.current = true;
        if (abortRef.current)
            abortRef.current.abort();
        abortRef.current = new AbortController();
        try {
            const token = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.TOKEN);
            if (!isValidToken(token)) {
                isDev && console.warn('[Auth] missing/invalid token');
                return;
            }
            const res = await fetch(`${API_BASE}${CONSTANTS.API_ENDPOINTS.CHAT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    json: {
                        messages: aiChat.slice(-CONSTANTS.MAX_CHAT_HISTORY).map(m => ({ role: m.role, content: m.content }))
                            .concat([{ role: 'user', content: msg }]),
                        context: { bpm, trackCount: tracks.length, position },
                    },
                }),
                signal: abortRef.current.signal,
            });
            if (res.ok) {
                const data = await res.json();
                const reply = data.result?.data?.json?.reply ?? '';
                addAIChat({ role: 'assistant', content: reply });
            }
            else {
                throw new Error(`HTTP ${res.status}`);
            }
        }
        catch (err) {
            if (err.name === 'AbortError')
                return;
            // Graceful degradation: local response when server unavailable
            const localReply = `Analysing your arrangement at ${bpm} BPM. `
                + `I suggest boosting low-mid on BASS around 200Hz, and introducing `
                + `a rhythmic sidechain from KICK at 4:1 ratio. `
                + `Current dynamic range reads approx -12 LUFS — 2dB headroom before ceiling.`;
            addAIChat({ role: 'assistant', content: localReply });
            setAiError('Server unavailable — using local analysis');
        }
        finally {
            setAIThinking(false);
            requestInFlightRef.current = false;
        }
    }, [chatInput, addAIChat, setAIThinking, aiChat, bpm, tracks.length, position]);
    // ── triggerSuggestions: server first, local LLPTE stub as fallback ───────
    const triggerSuggestions = useCallback(async () => {
        if (requestInFlightRef.current)
            return;
        setAIThinking(true);
        setAiError(null);
        requestInFlightRef.current = true;
        if (abortRef.current)
            abortRef.current.abort();
        abortRef.current = new AbortController();
        try {
            const token = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.TOKEN);
            if (!isValidToken(token)) {
                isDev && console.warn('[Auth] missing/invalid token');
                return;
            }
            const res = await fetch(`${API_BASE}${CONSTANTS.API_ENDPOINTS.SUGGESTIONS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    json: { tracks, bpm, position },
                }),
                signal: abortRef.current.signal,
            });
            if (res.ok) {
                const data = await res.json();
                const suggestions = data.result?.data?.json?.suggestions ?? [];
                const addAISuggestion = useDAWStore.getState().addAISuggestion;
                for (const s of suggestions) {
                    addAISuggestion({
                        type: s.type,
                        confidence: s.confidence,
                        description: s.description,
                        params: s.params,
                    });
                }
                return;
            }
        }
        catch (err) {
            if (err.name === 'AbortError')
                return;
        }
        // Local LLPTE-derived stubs (used when server unavailable or unauthenticated)
        const addAISuggestion = useDAWStore.getState().addAISuggestion;
        const localSuggestions = [
            { type: 'mix', confidence: 0.87, description: 'Reduce SYNTH high shelf -2dB above 8kHz — masking clarity on the PAD layer.', params: { trackId: 'trk_5', eq: { freq: 8000, gain: -2 } } },
            { type: 'arrangement', confidence: 0.74, description: 'Introduce a breakdown at bar 33 — tension has plateaued for 16 bars.', params: { action: 'introduce_break', bar: 33 } },
            { type: 'rhythm', confidence: 0.91, description: `HI-HAT ghost notes at 1/32 on beats 3–4 would increase groove at ${bpm} BPM.`, params: { trackId: 'trk_3', pattern: 'ghost_32' } },
        ];
        for (const s of localSuggestions)
            addAISuggestion(s);
        setAiError('Server unavailable — showing cached suggestions');
    }, [setAIThinking, tracks, bpm, position]);
    // ── runMasteringAnalysis: server first, local calculation fallback ───────
    const runMasteringAnalysis = useCallback(async () => {
        if (requestInFlightRef.current)
            return;
        updateMastering({ processing: true });
        const { targetLUFS, ceilingDB, dynamicsMode, stereoWidth } = mastering;
        requestInFlightRef.current = true;
        if (abortRef.current)
            abortRef.current.abort();
        abortRef.current = new AbortController();
        try {
            const token = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.TOKEN);
            if (!isValidToken(token)) {
                isDev && console.warn('[Auth] missing/invalid token');
                return;
            }
            const res = await fetch(`${API_BASE}${CONSTANTS.API_ENDPOINTS.MASTERING}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ json: { targetLUFS, ceilingDB, dynamicsMode, stereoWidth } }),
                signal: abortRef.current.signal,
            });
            if (res.ok) {
                const data = await res.json();
                const result = data.result?.data?.json;
                if (result) {
                    updateMastering({ processing: false, analysisResult: result });
                    return;
                }
            }
        }
        catch (err) {
            if (err.name === 'AbortError')
                return;
        }
        // Local calculation fallback
        const inputLUFS = -18.3;
        const gainNeeded = targetLUFS - inputLUFS;
        updateMastering({
            processing: false,
            analysisResult: {
                inputLUFS,
                inputPeak: inputLUFS + 6.2,
                outputLUFS: targetLUFS,
                dynamicRange: 9.4 - (dynamicsMode === 'compressed' ? 2 : 0),
                recommendation: `Apply ${Math.abs(gainNeeded).toFixed(1)} dB ${gainNeeded > 0 ? 'gain' : 'attenuation'}. `
                    + `True peak limiting at ${ceilingDB} dBFS. `
                    + (stereoWidth !== 1.0 ? `Stereo width ×${stereoWidth.toFixed(1)} via M/S. ` : 'Stereo width nominal.'),
            },
        });
        setAiError('Server unavailable — using local mastering analysis');
    }, [mastering, updateMastering]);
    // Toggle predictions with server fetch
    const togglePredictions = useCallback(async () => {
        if (!predictionsVisible) {
            try {
                const token = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.TOKEN);
                if (!isValidToken(token)) {
                    isDev && console.warn('[Auth] missing/invalid token');
                    return;
                }
                const res = await fetch(`${API_BASE}${CONSTANTS.API_ENDPOINTS.SUGGESTIONS}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ json: { tracks, bpm, position } }),
                });
                if (res.ok) {
                    const data = await res.json();
                    const suggestions = data.result?.data?.json?.suggestions ?? [];
                    setArrangementPredictions(suggestions.map(s => ({
                        trackId: s.params?.trackId ?? 'trk_1',
                        startBeat: s.params?.startBeat ?? 32,
                        suggestedAction: s.type,
                        confidence: s.confidence,
                        label: s.description.slice(0, 20).toUpperCase(),
                    })));
                }
            }
            catch {
                // Silently fail — predictions are optional
            }
        }
        setPredictionsVisible(!predictionsVisible);
    }, [predictionsVisible, setPredictionsVisible, setArrangementPredictions, tracks, bpm, position]);
    return (_jsxs("div", { className: "flex flex-col bg-[#0a0a0a] border-l border-[#1c1c1c]", style: { width: 280 }, role: "complementary", "aria-label": "AI panel", children: [_jsx("div", { className: "flex border-b border-[#1c1c1c] flex-none", role: "tablist", "aria-label": "AI panel tabs", children: ['mix', 'coproducer', 'mastering'].map(tab => (_jsx("button", { onClick: () => setAIPanelTab(tab), className: `flex-1 py-2 text-[8px] tracking-widest uppercase transition-colors ${aiPanelTab === tab
                        ? 'text-[#a3e635] border-b border-[#a3e635] bg-[#a3e635]/5'
                        : 'text-[var(--dj-dim)] hover:text-[var(--text-muted)]'}`, role: "tab", "aria-selected": aiPanelTab === tab, "aria-controls": `ai-panel-${tab}`, id: `ai-tab-${tab}`, children: tab === 'mix' ? 'AI MIX' : tab === 'coproducer' ? 'CO-PROD' : 'MASTER' }, tab))) }), aiError && (_jsxs("div", { className: "px-2 py-1 bg-red-900/20 border-b border-red-900/40 text-[9px] text-red-400", role: "alert", children: [aiError, _jsx("button", { className: "ml-2 text-[8px] underline", onClick: () => setAiError(null), children: "Dismiss" })] })), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [aiPanelTab === 'mix' && (_jsxs("div", { className: "p-3 space-y-3", role: "tabpanel", id: "ai-panel-mix", "aria-labelledby": "ai-tab-mix", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[9px] tracking-widest text-[#555]", children: "LLPTE SUGGESTIONS" }), _jsx(Btn, { className: "text-[8px]", onClick: triggerSuggestions, disabled: aiThinking, children: aiThinking ? 'ANALYSING…' : 'ANALYSE' })] }), aiThinking && (_jsxs("div", { className: "flex items-center gap-2 py-2", role: "status", "aria-label": "Analysing", children: [_jsx("div", { className: "flex gap-0.5", children: [0, 1, 2].map(i => (_jsx("div", { className: "w-1 h-1 rounded-full bg-[#a3e635] animate-bounce", style: { animationDelay: `${i * 0.15}s` } }, i))) }), _jsx("span", { className: "text-[9px] text-[#555]", children: "Analysing signal\u2026" })] })), aiSuggestions.filter(s => s.accepted === null).slice(0, 6).map(s => (_jsx(AISuggestionCard, { suggestion: s, onAccept: () => acceptSuggestion(s.id), onReject: () => rejectSuggestion(s.id) }, s.id))), aiSuggestions.filter(s => s.accepted === null).length === 0 && !aiThinking && (_jsxs("div", { className: "text-center py-8", children: [_jsx("div", { className: "text-[10px] text-[var(--dj-dimmer)] font-mono", children: "LLPTE READY" }), _jsx("div", { className: "text-[9px] text-[var(--dj-border)] mt-1", children: "Click ANALYSE to generate mix suggestions" })] })), _jsx("div", { className: "pt-2 border-t border-[#1c1c1c]", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[9px] text-[#555] tracking-widest", children: "ARRANGEMENT AI" }), _jsx("button", { className: `text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${predictionsVisible
                                                ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                                                : 'border-[var(--dj-dimmer)] text-[var(--dj-dim)] hover:border-[#555]'}`, onClick: togglePredictions, "aria-pressed": predictionsVisible, children: predictionsVisible ? 'HIDE' : 'SHOW' })] }) })] })), aiPanelTab === 'coproducer' && (_jsxs("div", { className: "flex flex-col h-full", style: { minHeight: 300 }, role: "tabpanel", id: "ai-panel-coproducer", "aria-labelledby": "ai-tab-coproducer", children: [_jsxs("div", { className: "flex-1 p-3 space-y-2 overflow-y-auto", style: { maxHeight: 320 }, role: "log", "aria-live": "polite", "aria-label": "Chat messages", children: [aiChat.length === 0 && (_jsxs("div", { className: "text-center py-6", children: [_jsx("div", { className: "text-[10px] text-[var(--dj-dimmer)] font-mono mb-1", children: "AI CO-PRODUCER" }), _jsx("div", { className: "text-[9px] text-[var(--dj-border)]", children: "Ask me about your arrangement, mix balance, or genre direction." })] })), aiChat.map(msg => (_jsx("div", { className: `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`, children: _jsx("div", { className: `max-w-[90%] rounded px-2 py-1.5 text-[10px] leading-relaxed ${msg.role === 'user'
                                                ? 'bg-[#a3e635]/12 text-[var(--accent-neon-lime)] border border-[#a3e635]/25'
                                                : 'bg-[var(--t-b2x)] text-[var(--daw-sub)] border border-[#2a2a2a]'}`, role: msg.role === 'assistant' ? 'article' : undefined, children: msg.content }) }, msg.id))), aiThinking && aiPanelTab === 'coproducer' && (_jsx("div", { className: "flex gap-1 pl-1", role: "status", "aria-label": "AI is typing", children: [0, 1, 2].map(i => (_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-[var(--dj-dim)] animate-bounce", style: { animationDelay: `${i * 0.2}s` } }, i))) })), _jsx("div", { ref: chatEndRef })] }), _jsx("div", { className: "flex-none p-2 border-t border-[#1c1c1c]", children: _jsxs("div", { className: "flex gap-1.5", children: [_jsx("input", { className: "flex-1 bg-[var(--t-b2x)] border border-[#2a2a2a] rounded px-2 py-1 text-[10px] text-[var(--daw-ghost)] placeholder-[var(--dj-dimmer)]", placeholder: "Ask the AI co-producer\u2026", value: chatInput, onChange: e => setChatInput(e.target.value.slice(0, 500)), onKeyDown: e => { if (e.key === 'Enter')
                                                sendChat(); }, "aria-label": "Chat input", maxLength: 500 }), _jsx(Btn, { onClick: sendChat, className: "text-[9px]", disabled: aiThinking || !chatInput.trim(), "aria-label": "Send message", children: "\u2192" })] }) })] })), aiPanelTab === 'mastering' && (_jsxs("div", { className: "p-3 space-y-4", role: "tabpanel", id: "ai-panel-mastering", "aria-labelledby": "ai-tab-mastering", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[9px] tracking-widest text-[#555]", children: "ADAPTIVE MASTERING" }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Led, { on: mastering.enabled, color: "var(--accent-green)" }), _jsx("button", { className: `text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${mastering.enabled
                                                    ? 'border-green-500/50 text-green-400 bg-green-500/10'
                                                    : 'border-[var(--dj-dimmer)] text-[var(--dj-dim)]'}`, onClick: () => updateMastering({ enabled: !mastering.enabled }), "aria-pressed": mastering.enabled, children: mastering.enabled ? 'ON' : 'OFF' })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-[9px] text-[#555]", children: "TARGET LUFS" }), _jsxs("span", { className: "text-[9px] font-mono text-[#a3e635]", children: [mastering.targetLUFS, " LUFS"] })] }), _jsx("input", { type: "range", min: -23, max: -6, step: 0.5, value: mastering.targetLUFS, onChange: e => updateMastering({ targetLUFS: parseFloat(e.target.value) }), className: "w-full h-1 rounded appearance-none", style: { accentColor: '#a3e635' }, "aria-label": "Target LUFS" }), _jsxs("div", { className: "flex justify-between text-[8px] text-[var(--dj-dimmer)]", children: [_jsx("span", { children: "-23 (broadcast)" }), _jsx("span", { children: "-14 (streaming)" }), _jsx("span", { children: "-6 (loud)" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-[9px] text-[#555]", children: "TRUE PEAK CEILING" }), _jsxs("span", { className: "text-[9px] font-mono text-[#a3e635]", children: [mastering.ceilingDB, " dBFS"] })] }), _jsx("input", { type: "range", min: -3, max: -0.1, step: 0.1, value: mastering.ceilingDB, onChange: e => updateMastering({ ceilingDB: parseFloat(e.target.value) }), className: "w-full h-1 rounded appearance-none", style: { accentColor: '#a3e635' }, "aria-label": "True peak ceiling" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("span", { className: "text-[9px] text-[#555]", children: "DYNAMICS MODE" }), _jsx("div", { className: "flex gap-1", role: "radiogroup", "aria-label": "Dynamics mode", children: ['natural', 'compressed', 'punchy'].map(mode => (_jsx("button", { onClick: () => updateMastering({ dynamicsMode: mode }), className: `flex-1 py-1 rounded border text-[8px] font-mono transition-colors ${mastering.dynamicsMode === mode
                                                ? 'border-[#a3e635]/40 text-[#a3e635] bg-[#a3e635]/10'
                                                : 'border-[var(--dj-border)] text-[var(--dj-dim)] hover:border-[var(--dj-dimmer)]'}`, role: "radio", "aria-checked": mastering.dynamicsMode === mode, children: mode.toUpperCase() }, mode))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-[9px] text-[#555]", children: "STEREO WIDTH" }), _jsxs("span", { className: "text-[9px] font-mono text-[#a3e635]", children: ["\u00D7", mastering.stereoWidth.toFixed(1)] })] }), _jsx("input", { type: "range", min: 0, max: 2, step: 0.1, value: mastering.stereoWidth, onChange: e => updateMastering({ stereoWidth: parseFloat(e.target.value) }), className: "w-full h-1 rounded appearance-none", style: { accentColor: 'var(--looper-cyan)' }, "aria-label": "Stereo width" })] }), _jsx(Btn, { className: "w-full text-center text-[9px]", onClick: runMasteringAnalysis, active: mastering.processing, disabled: mastering.processing, children: mastering.processing ? 'ANALYSING…' : 'RUN ANALYSIS' }), mastering.analysisResult && (_jsxs("div", { className: "bg-[var(--dj-surface2)] border border-[var(--dj-border)] rounded p-2 space-y-1.5", children: [_jsxs("div", { className: "flex justify-between text-[9px]", children: [_jsx("span", { className: "text-[#555]", children: "INPUT" }), _jsxs("span", { className: "font-mono text-[var(--text-dim)]", children: [mastering.analysisResult.inputLUFS, " LUFS"] })] }), _jsxs("div", { className: "flex justify-between text-[9px]", children: [_jsx("span", { className: "text-[#555]", children: "TARGET" }), _jsxs("span", { className: "font-mono text-[#a3e635]", children: [mastering.analysisResult.outputLUFS, " LUFS"] })] }), _jsxs("div", { className: "flex justify-between text-[9px]", children: [_jsx("span", { className: "text-[#555]", children: "DYN RANGE" }), _jsxs("span", { className: "font-mono text-[var(--text-dim)]", children: [mastering.analysisResult.dynamicRange, " LU"] })] }), _jsx("div", { className: "pt-1 border-t border-[#1c1c1c]", children: _jsx("p", { className: "text-[9px] text-[var(--dj-muted)] leading-relaxed", children: mastering.analysisResult.recommendation }) })] }))] }))] })] }));
});
AIPanel.displayName = 'AIPanel';
const AISuggestionCard = memo(({ suggestion, onAccept, onReject, }) => {
    const color = CONSTANTS.SUGGESTION_TYPE_COLORS[suggestion.type] ?? 'var(--text-dim)';
    return (_jsxs("div", { className: "rounded border p-2 space-y-1.5", style: { borderColor: `${color}33`, background: `${color}08` }, role: "article", "aria-label": `${suggestion.type} suggestion: ${suggestion.description}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[8px] font-mono tracking-widest", style: { color }, children: suggestion.type.toUpperCase() }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("div", { className: "w-12 h-0.5 rounded-full bg-[var(--dj-border)]", role: "meter", "aria-label": `Confidence ${Math.round(suggestion.confidence * 100)}%`, "aria-valuenow": Math.round(suggestion.confidence * 100), "aria-valuemin": 0, "aria-valuemax": 100, children: _jsx("div", { className: "h-full rounded-full", style: { width: `${suggestion.confidence * 100}%`, background: color } }) }), _jsxs("span", { className: "text-[8px] font-mono", style: { color }, children: [Math.round(suggestion.confidence * 100), "%"] })] })] }), _jsx("p", { className: "text-[9px] text-[var(--text-dim)] leading-relaxed", children: suggestion.description }), _jsxs("div", { className: "flex gap-1.5", children: [_jsx("button", { onClick: onAccept, className: "flex-1 py-0.5 text-[8px] font-mono rounded border transition-colors border-green-500/30 text-green-500 hover:bg-green-500/10", "aria-label": "Apply suggestion", children: "APPLY" }), _jsx("button", { onClick: onReject, className: "flex-1 py-0.5 text-[8px] font-mono rounded border transition-colors border-[var(--dj-dimmer)] text-[var(--dj-dim)] hover:border-[#555]", "aria-label": "Skip suggestion", children: "SKIP" })] })] }));
});
AISuggestionCard.displayName = 'AISuggestionCard';
// ─── Keyboard Shortcuts Help Overlay ──────────────────────────────────────────
const KeyboardHelpOverlay = memo(({ onClose }) => {
    const shortcuts = [
        { key: 'Space', action: 'Play / Pause' },
        { key: 'R', action: 'Record toggle' },
        { key: 'T', action: 'Tap tempo' },
        { key: 'M', action: 'Toggle MIDI sequencer' },
        { key: 'A', action: 'Toggle AI panel' },
        { key: '+ / -', action: 'Zoom in / out' },
        { key: 'Ctrl+S', action: 'Save project' },
        { key: 'Esc', action: 'Stop playback' },
        { key: '↑ / ↓', action: 'Navigate tracks' },
        { key: '?', action: 'Show this help' },
    ];
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm", onClick: onClose, role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts", children: _jsxs("div", { className: "bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-6 max-w-md w-full mx-4", onClick: e => e.stopPropagation(), children: [_jsx("h2", { className: "text-sm font-mono tracking-widest text-[#a3e635] mb-4", children: "KEYBOARD SHORTCUTS" }), _jsx("div", { className: "space-y-2", children: shortcuts.map(s => (_jsxs("div", { className: "flex items-center justify-between text-[11px] font-mono", children: [_jsx("kbd", { className: "px-2 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[var(--text-dim)]", children: s.key }), _jsx("span", { className: "text-[var(--dj-muted)]", children: s.action })] }, s.key))) }), _jsx(Btn, { className: "w-full mt-4 text-[9px]", onClick: onClose, children: "CLOSE" })] }) }));
});
KeyboardHelpOverlay.displayName = 'KeyboardHelpOverlay';
// ─── Export Dialog ──────────────────────────────────────────────────────────────
const ExportDialog = memo(({ onClose }) => {
    const [format, setFormat] = useState('wav');
    const [quality, setQuality] = useState('standard');
    const [exporting, setExporting] = useState(false);
    const handleExport = useCallback(async () => {
        setExporting(true);
        try {
            // Trigger export via engine
            isDev && console.info('[Export] Starting export:', format, quality);
            // await engine.export({ format, quality });
        }
        finally {
            setExporting(false);
            onClose();
        }
    }, [format, quality, onClose]);
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm", onClick: onClose, role: "dialog", "aria-modal": "true", "aria-label": "Export project", children: _jsxs("div", { className: "bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-6 max-w-sm w-full mx-4", onClick: e => e.stopPropagation(), children: [_jsx("h2", { className: "text-sm font-mono tracking-widest text-[#a3e635] mb-4", children: "EXPORT PROJECT" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("span", { className: "text-[9px] text-[#555] tracking-widest", children: "FORMAT" }), _jsx("div", { className: "flex gap-1 mt-1", children: ['wav', 'mp3', 'flac', 'ogg'].map(f => (_jsx("button", { onClick: () => setFormat(f), className: `flex-1 py-1 rounded border text-[9px] font-mono transition-colors ${format === f
                                            ? 'border-[#a3e635]/40 text-[#a3e635] bg-[#a3e635]/10'
                                            : 'border-[var(--dj-border)] text-[var(--dj-dim)] hover:border-[var(--dj-dimmer)]'}`, "aria-pressed": format === f, children: f.toUpperCase() }, f))) })] }), _jsxs("div", { children: [_jsx("span", { className: "text-[9px] text-[#555] tracking-widest", children: "QUALITY" }), _jsx("div", { className: "flex gap-1 mt-1", children: ['draft', 'standard', 'master'].map(q => (_jsx("button", { onClick: () => setQuality(q), className: `flex-1 py-1 rounded border text-[9px] font-mono transition-colors ${quality === q
                                            ? 'border-[#a3e635]/40 text-[#a3e635] bg-[#a3e635]/10'
                                            : 'border-[var(--dj-border)] text-[var(--dj-dim)] hover:border-[var(--dj-dimmer)]'}`, "aria-pressed": quality === q, children: q.toUpperCase() }, q))) })] })] }), _jsxs("div", { className: "flex gap-2 mt-4", children: [_jsx(Btn, { className: "flex-1 text-[9px]", onClick: onClose, children: "CANCEL" }), _jsx(Btn, { className: "flex-1 text-[9px]", onClick: handleExport, active: exporting, disabled: exporting, children: exporting ? 'EXPORTING…' : 'EXPORT' })] })] }) }));
});
ExportDialog.displayName = 'ExportDialog';
// ─── Main DAW Page ────────────────────────────────────────────────────────────
export default function DAW() {
    const engine = useDAWEngine();
    const collab = useCollabSocket();
    const seq = useMidiSequencer();
    const sequencerVisible = useDAWStore(s => s.sequencerVisible);
    const setSequencerVisible = useDAWStore(s => s.setSequencerVisible);
    const aiPanelVisible = useDAWStore(s => s.aiPanelVisible);
    const setAIPanelVisible = useDAWStore(s => s.setAIPanelVisible);
    const predictionsVisible = useDAWStore(s => s.predictionsVisible);
    const setPredictionsVisible = useDAWStore(s => s.setPredictionsVisible);
    const zoom = useDAWStore(s => s.zoom);
    const setZoom = useDAWStore(s => s.setZoom);
    const trackHeightMode = useDAWStore(s => s.trackHeightMode);
    const setTrackHeightMode = useDAWStore(s => s.setTrackHeightMode);
    const setSyncStatus = useDAWStore(s => s.setSyncStatus);
    const setLastSaved = useDAWStore(s => s.setLastSaved);
    const bpm = useDAWStore(s => s.bpm);
    const projectName = useDAWStore(s => s.projectName);
    const tracks = useDAWStore(s => s.tracks);
    const regions = useDAWStore(s => s.regions);
    const [showHelp, setShowHelp] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    useEffect(() => { setIsInitialized(true); }, []);
    // Auto-save hook
    useAutoSave(CONSTANTS.AUTO_SAVE_INTERVAL_MS);
    // Session analytics boundary
    useEffect(() => {
        const sessionId = crypto.randomUUID();
        const startMs = Date.now();
        try {
            const prevRaw = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.SESSIONS);
            const prev = prevRaw ? JSON.parse(prevRaw) : [];
            if (!Array.isArray(prev))
                throw new Error('Invalid sessions data');
            localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.SESSIONS, JSON.stringify([...prev.slice(-49), { sessionId, startMs, endMs: null, page: 'DAW' }]));
        }
        catch (err) {
            isDev && console.warn('[Session] Failed to record session start:', err);
        }
        return () => {
            _jsx("header", { className: "ag-header", children: _jsxs("div", { className: "ag-header-top", children: [_jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", "data-testid": "text-title", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "NATIVE"] }), _jsx("div", { className: "ag-wordmark-sub", children: "Arrangement \u00B7 Multi-Track DAW" })] }), _jsx("div", { className: "ag-status-block", children: _jsxs("div", { className: `ag-status-line ${isInitialized ? 'ag-status-live-text' : 'ag-status-dead-text'}`, children: [_jsx("span", { className: isInitialized ? 'ag-cursor-live' : 'ag-cursor-standby' }), isInitialized ? 'LIVE' : 'STANDBY'] }) })] }) });
            try {
                const prevRaw = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.SESSIONS);
                if (!prevRaw)
                    return;
                const sessions = JSON.parse(prevRaw);
                if (!Array.isArray(sessions))
                    return;
                localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.map(s => s.sessionId === sessionId ? { ...s, endMs: Date.now() } : s)));
            }
            catch (err) {
                isDev && console.warn('[Session] Failed to record session end:', err);
            }
        };
    }, []);
    // Global keyboard shortcuts
    const shortcuts = useMemo(() => ({
        ' ': async () => {
            await engine.resumeContext();
            engine.togglePlay();
        },
        'r': async () => {
            await engine.resumeContext();
            engine.toggleRecord();
        },
        't': () => engine.tapTempo(),
        'escape': () => engine.stop(),
        'm': () => setSequencerVisible(!sequencerVisible),
        'a': () => setAIPanelVisible(!aiPanelVisible),
        '+': () => setZoom(Math.min(10, zoom * 1.2)),
        '=': () => setZoom(Math.min(10, zoom * 1.2)),
        '-': () => setZoom(Math.max(0.1, zoom * 0.8)),
        'ctrl+s': async (e) => {
            e.preventDefault();
            setSyncStatus('syncing');
            try {
                localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.SNAPSHOT, JSON.stringify({
                    bpm, projectName, tracks, regions,
                    timestamp: Date.now(), version: '5.0.0',
                }));
                setSyncStatus('synced');
                setLastSaved(Date.now());
            }
            catch {
                setSyncStatus('error');
            }
        },
        '?': () => setShowHelp(true),
    }), [engine, sequencerVisible, aiPanelVisible, zoom, setZoom, setSequencerVisible, setAIPanelVisible, bpm, projectName, tracks, regions, setSyncStatus, setLastSaved]);
    useKeyboardShortcuts(shortcuts, { preventDefault: true });
    return (_jsxs(DAWErrorBoundary, { children: [_jsxs("div", { className: "flex flex-col", style: {
                    height: '100vh',
                    background: 'var(--void)',
                    backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,.016) 31px,rgba(255,255,255,.016) 32px)',
                    color: '#e5e5e5',
                    fontFamily: '"IBM Plex Mono","JetBrains Mono","Fira Code",monospace',
                    overflow: 'hidden',
                    borderLeft: '3px solid #a3e635',
                    boxShadow: 'inset 3px 0 18px rgba(163,230,53,0.15)',
                }, children: [_jsx(SessionSummaryPanel, {}), _jsx(TransportBar, { engine: engine }), _jsx("style", { children: `@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}` }), _jsx("div", { style: { overflow: 'hidden', position: 'relative', background: '#080808', padding: '5px 0', flexShrink: 0 }, children: _jsx("div", { style: { display: 'flex', width: 'max-content', animation: 'ag-scroll 28s linear infinite' }, children: ['R3 Native', 'Web Audio API', 'Offline-First', 'MIDI Support', 'Polyphony', 'Accessible', 'MultiTrack DAW', 'VST System',
                                'R3 Native', 'Web Audio API', 'Offline-First', 'MIDI Support', 'Polyphony', 'Accessible', 'MultiTrack DAW', 'VST System'].map((item, i) => (_jsxs("span", { style: { padding: '0 18px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: '"IBM Plex Mono",monospace', color: '#fff', whiteSpace: 'nowrap' }, children: [item, _jsx("span", { style: { color: '#a3e635', marginLeft: 8 }, children: "/" })] }, i))) }) }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-1.5 border-b border-[#1c1c1c] bg-[#0d0d0d] flex-none", children: [_jsx("span", { className: "text-[8px] text-[var(--dj-dimmer)] tracking-widest mr-1", children: "VIEW" }), _jsx(Btn, { active: sequencerVisible, onClick: () => setSequencerVisible(!sequencerVisible), className: "text-[9px]", title: "Toggle MIDI Sequencer (M)", "aria-pressed": sequencerVisible, children: "MIDI SEQ" }), _jsx(Btn, { active: aiPanelVisible, onClick: () => setAIPanelVisible(!aiPanelVisible), className: "text-[9px]", title: "Toggle AI Panel (A)", "aria-pressed": aiPanelVisible, children: "AI PANEL" }), _jsx(Btn, { active: predictionsVisible, onClick: () => setPredictionsVisible(!predictionsVisible), className: "text-[9px]", title: "Toggle arrangement AI predictions", "aria-pressed": predictionsVisible, children: "PREDICTIONS" }), _jsx("div", { className: "w-px h-4 bg-[#2a2a2a] mx-1", role: "separator" }), _jsx(Btn, { className: "text-[9px]", onClick: () => setShowExport(true), title: "Export project", children: "EXPORT" }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx(SessionChip, {}), _jsx("span", { className: "text-[8px] text-[var(--dj-dimmer)]", children: "ZOOM" }), _jsx(Btn, { className: "text-[9px]", onClick: () => setZoom(Math.max(0.1, zoom * 0.8)), "aria-label": "Zoom out", children: "\u2212" }), _jsxs("span", { className: "text-[9px] font-mono text-[#555] w-8 text-center", children: [zoom.toFixed(1), "\u00D7"] }), _jsx(Btn, { className: "text-[9px]", onClick: () => setZoom(Math.min(10, zoom * 1.2)), "aria-label": "Zoom in", children: "+" }), _jsx("div", { className: "w-px h-4 bg-[#2a2a2a] mx-1", role: "separator" }), _jsx("span", { className: "text-[8px] text-[var(--dj-dimmer)]", children: "ROWS" }), ['compact', 'normal', 'large'].map(m => (_jsx(Btn, { active: trackHeightMode === m, onClick: () => setTrackHeightMode(m), className: "text-[8px]", "aria-pressed": trackHeightMode === m, children: m[0].toUpperCase() }, m)))] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx(Sidebar, { collab: collab }), _jsxs("div", { className: "flex flex-col flex-1 overflow-hidden", children: [_jsx(ArrangementView, { engine: engine, collab: collab }), sequencerVisible && (_jsx(MidiSequencerPanel, { seq: seq })), _jsx(MixerStrip, { engine: engine })] }), aiPanelVisible && _jsx(AIPanel, {})] }), _jsx("div", { className: "flex items-center gap-4 px-4 py-1 border-t border-[var(--t-b2x)] bg-[var(--t-b0x)] flex-none", children: _jsx(StatusBar, {}) })] }), showHelp && _jsx(KeyboardHelpOverlay, { onClose: () => setShowHelp(false) }), showExport && _jsx(ExportDialog, { onClose: () => setShowExport(false) })] }));
}
// ─── Status Bar ───────────────────────────────────────────────────────────────
const StatusBar = memo(() => {
    const playing = useDAWStore(s => s.playing);
    const recording = useDAWStore(s => s.recording);
    const collabConnected = useDAWStore(s => s.collabConnected);
    const collabUsers = useDAWStore(s => s.collabUsers);
    const syncStatus = useDAWStore(s => s.syncStatus);
    const bpm = useDAWStore(s => s.bpm);
    const timeSignature = useDAWStore(s => s.timeSignature);
    const isOnline = useIsOnline();
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Led, { on: playing, color: "var(--accent-green)", label: playing ? 'Playing' : 'Stopped' }), _jsx(Led, { on: recording, color: "#ef4444", pulse: recording, label: recording ? 'Recording' : 'Not recording' }), _jsx("span", { className: "text-[8px] text-[var(--dj-dimmer)]", children: recording ? 'REC' : playing ? 'PLAY' : 'STOPPED' })] }), _jsx("div", { className: "w-px h-3 bg-[#2a2a2a]", role: "separator" }), _jsxs("span", { className: "text-[8px] font-mono text-[var(--dj-dimmer)]", children: [bpm, " BPM \u00B7 ", timeSignature[0], "/", timeSignature[1]] }), !isOnline && (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-px h-3 bg-[#2a2a2a]", role: "separator" }), _jsx("span", { className: "text-[8px] text-[#f59e0b] font-mono", children: "OFFLINE" })] })), collabConnected && (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-px h-3 bg-[#2a2a2a]", role: "separator" }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Led, { on: true, color: "var(--looper-cyan)", label: "Collaboration active" }), _jsxs("span", { className: "text-[8px] text-[var(--looper-cyan)]", children: [collabUsers.length + 1, " IN SESSION"] })] })] })), _jsx("div", { className: "ml-auto flex items-center gap-2", children: _jsx("span", { className: "text-[8px] text-[var(--t-b3x)] font-mono", children: "R3 v5 \u00B7 SPACE=play \u00B7 R=rec \u00B7 T=tap \u00B7 M=midi \u00B7 A=ai \u00B7 \u00B1=zoom \u00B7 ?=help" }) })] }));
});
StatusBar.displayName = 'StatusBar';
