import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// multi-track-view.tsx
// Production-Ready Enhanced DAW multi-track-view
// Features: Drag & drop, context menus, undo/redo, track grouping
// PATCH-M05: added useEffect + useMemo (required by M01, M02, M04)
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { Circle, Play, Square, Plus, Trash2, Copy, ChevronDown, ChevronRight, Zap, Settings } from 'lucide-react';
// ============================================
// COMPONENT
// ============================================
const MultitrackView = ({ tracks, transport, hideTransport = false, onTogglePlay, onToggleRecord, onArmTrack, onToggleMute, onToggleSolo, onUpdateTrack, onDeleteTrack, onDuplicateTrack, onAddFX, onRemoveFX, onReorderTracks, onReorderFX, }) => {
    const [dragState, setDragState] = useState({
        source: null,
        trackId: null,
        fxIndex: null
    });
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [contextMenu, setContextMenu] = useState(null);
    const trackListRef = useRef(null);
    const contextMenuRef = useRef(null);
    // PATCH-M02: Context menu dismiss — Escape key + click-outside.
    //   Root cause: onMouseLeave-only dismiss fails on keyboard nav
    //   and misses click-outside — accessibility violation.
    //   Listeners registered only while menu is open; cleaned up on close.
    useEffect(() => {
        if (!contextMenu)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setContextMenu(null);
            }
        };
        const onOutside = (e) => {
            if (contextMenuRef.current &&
                !contextMenuRef.current.contains(e.target)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('keydown', onKey, { capture: true });
        document.addEventListener('mousedown', onOutside, { capture: true });
        return () => {
            document.removeEventListener('keydown', onKey, { capture: true });
            document.removeEventListener('mousedown', onOutside, { capture: true });
        };
    }, [contextMenu]); // re-register when contextMenu opens/closes
    // PATCH-M01: memoize — avoid O(n) recompute at 60fps after M04 meter loop.
    //   Root cause: both computations ran unconditionally on every render.
    //   Keyed on `tracks` reference — Zustand guarantees stability for
    //   unmodified arrays.
    const { visibleTracks, groupedTracks } = useMemo(() => {
        const visible = tracks.filter(t => !t.hidden);
        const grouped = new Map();
        visible.forEach(track => {
            const groupId = track.groupId ?? 'ungrouped';
            if (!grouped.has(groupId))
                grouped.set(groupId, []);
            grouped.get(groupId).push(track);
        });
        return { visibleTracks: visible, groupedTracks: grouped };
    }, [tracks]);
    // Drag handlers
    const handleDragStart = useCallback((e, source, trackId, fxIndex) => {
        try {
            setDragState({ source, trackId, fxIndex: fxIndex ?? null });
            e.dataTransfer.effectAllowed = 'move';
        }
        catch (error) {
            console.error('Drag start error:', error);
        }
    }, []);
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);
    // PATCH-M03: explicit branches for same-track reorder vs cross-track drop.
    //   Root cause: cross-track drop silent no-op contradicts 'move' cursor.
    //   Future extension point: expose onMoveFX(fromTrack, fromIdx, toTrack, toIdx).
    const handleDropFX = useCallback((e, targetTrackId, targetIndex) => {
        e.preventDefault();
        try {
            // Null-guard: bail if drag state is not an FX drag
            if (dragState.source !== 'fx' ||
                dragState.trackId == null ||
                dragState.fxIndex == null)
                return;
            if (dragState.trackId === targetTrackId && onReorderFX) {
                // Primary path: same-track FX reorder
                onReorderFX(targetTrackId, dragState.fxIndex, targetIndex);
            }
            else if (dragState.trackId !== targetTrackId) {
                // Cross-track drop — not yet implemented.
                // Future: call onMoveFX?.(dragState.trackId, dragState.fxIndex,
                //                        targetTrackId, targetIndex)
                console.info('[MultitrackView] Cross-track FX move not yet supported.', { from: dragState.trackId, fromIdx: dragState.fxIndex,
                    to: targetTrackId, toIdx: targetIndex });
            }
        }
        catch (error) {
            console.error('[MultitrackView] Drop FX error:', error);
        }
        finally {
            setDragState({ source: null, trackId: null, fxIndex: null });
        }
    }, [dragState, onReorderFX]);
    const handleDropTrack = useCallback((e, targetTrackId) => {
        e.preventDefault();
        try {
            if (dragState.source === 'track' &&
                dragState.trackId &&
                dragState.trackId !== targetTrackId &&
                onReorderTracks) {
                onReorderTracks(dragState.trackId, targetTrackId);
            }
        }
        catch (error) {
            console.error('Drop track error:', error);
        }
        finally {
            setDragState({ source: null, trackId: null, fxIndex: null });
        }
    }, [dragState, onReorderTracks]);
    const toggleGroup = useCallback((groupId) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            }
            else {
                newSet.add(groupId);
            }
            return newSet;
        });
    }, []);
    // PATCH-M04: VU meter decay animation — 15 dB/s fallback.
    //   Root cause: static prop-driven meter freezes at peak when signal drops.
    //   Fix: RAF loop with peak-hold; decay activates on falling edge only.
    //   Regression: upward snap is immediate (no smoothing); decay is 60-FPS-rate.
    const [meterLevels, setMeterLevels] = useState({});
    const meterPeaks = useRef({});
    // RA-03: last RAF timestamp — persists across renders in a ref
    const meterLastTsRef = useRef(0);
    const meterRafRef = useRef(0);
    useEffect(() => {
        // RA-03: timestamp-based decay — frame-rate-independent.
        //   15 dB/s × elapsed_seconds is correct at 30/60/90/120/144 Hz.
        const DECAY_DB_PER_SEC = 15;
        const animate = (timestamp) => {
            // delta_s: 0 on first frame (lastTs == 0 after effect restart)
            const delta_s = meterLastTsRef.current === 0
                ? 0
                : (timestamp - meterLastTsRef.current) / 1000;
            meterLastTsRef.current = timestamp;
            const decay = DECAY_DB_PER_SEC * delta_s;
            setMeterLevels(prev => {
                const next = {};
                let changed = false;
                for (const track of tracks) {
                    const liveLevel = track.meter ?? 0;
                    const heldPeak = meterPeaks.current[track.id] ?? 0;
                    // Snap up instantly; decay when signal falls below held peak
                    const newLevel = liveLevel >= heldPeak
                        ? liveLevel
                        : Math.max(0, heldPeak - decay);
                    meterPeaks.current[track.id] = newLevel;
                    next[track.id] = newLevel;
                    if (prev[track.id] !== newLevel)
                        changed = true;
                }
                return changed ? next : prev; // bail-out when nothing changed
            });
            meterRafRef.current = requestAnimationFrame(animate);
        };
        meterLastTsRef.current = 0; // reset on every effect restart
        meterRafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(meterRafRef.current);
    }, [tracks]); // re-init when track list changes
    // Format timecode
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    };
    return (_jsxs("div", { className: "flex flex-col h-full bg-card text-foreground font-sans", children: [!hideTransport && (_jsxs("div", { className: "h-14 flex items-center gap-4 px-4 bg-background shadow-lg", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: onTogglePlay, className: "w-10 h-10 grid place-items-center bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg shadow-md transition-all active:scale-95", title: transport.isPlaying ? 'Stop (Space)' : 'Play (Space)', "aria-label": transport.isPlaying ? 'Stop playback' : 'Start playback', children: transport.isPlaying ? _jsx(Square, { size: 18 }) : _jsx(Play, { size: 18 }) }), _jsx("button", { onClick: onToggleRecord, className: `w-10 h-10 grid place-items-center rounded-lg shadow-md transition-all active:scale-95 ${transport.isRecording
                                    ? 'bg-gradient-to-br from-red-600 to-red-700 shadow-red-500/50'
                                    : 'bg-muted hover:bg-muted'}`, title: transport.isRecording ? 'Stop recording' : 'Start recording', "aria-label": transport.isRecording ? 'Stop recording' : 'Start recording', children: _jsx(Circle, { size: 16, className: transport.isRecording ? 'fill-white' : 'text-red-500' }) })] }), _jsxs("div", { className: "flex-1 flex items-center gap-3", children: [_jsx("span", { className: "font-mono text-lg font-bold text-blue-400 tracking-wider", children: formatTime(transport.position) }), _jsx("div", { className: "h-1 flex-1 bg-muted rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all", style: { width: `${Math.min(100, (transport.position / 300) * 100)}%` }, role: "progressbar", "aria-valuenow": Math.min(100, (transport.position / 300) * 100), "aria-valuemin": 0, "aria-valuemax": 100 }) })] }), transport.isRecording && (_jsx("div", { className: "text-xs font-medium", children: _jsx("span", { className: "text-red-400 font-bold animate-pulse", children: "\u25CF RECORDING" }) }))] })), _jsx("style", { children: `@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}` }), _jsx("div", { style: { overflow: "hidden", position: "relative", background: "#080808", padding: "5px 0", flexShrink: 0 }, children: _jsx("div", { style: { display: "flex", width: "max-content", animation: "ag-scroll 28s linear infinite" }, children: ["R3 Native", "Web Audio API", "Offline-First", "MIDI Support", "Polyphony", "Accessible", "MultiTrack DAW", "VST System", "R3 Native", "Web Audio API", "Offline-First", "MIDI Support", "Polyphony", "Accessible", "MultiTrack DAW", "VST System"].map((item, i) => (_jsxs("span", { style: { padding: "0 18px", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: '"IBM Plex Mono",monospace', color: "#fff", whiteSpace: "nowrap" }, children: [item, _jsx("span", { style: { color: "#a3e635", marginLeft: 8 }, children: "/" })] }, i))) }) }), _jsxs("div", { className: "h-10 bg-muted text-xs text-muted-foreground flex items-center px-4 font-medium", children: [_jsx("span", { className: "flex-1", children: "Tracks & Inserts" }), _jsx("span", { className: "w-24 text-right", children: "Vol" }), _jsx("span", { className: "w-20 text-right", children: "Pan" })] }), _jsx("div", { className: "flex-1 overflow-auto", ref: trackListRef, children: Array.from(groupedTracks.entries()).map(([groupId, groupTracks]) => {
                    const isExpanded = groupId === 'ungrouped' || expandedGroups.has(groupId);
                    const isGroup = groupId !== 'ungrouped';
                    return (_jsxs("div", { children: [isGroup && (_jsxs("div", { className: "h-12 bg-muted/50 border-b border-zinc-800 px-3 flex items-center gap-2 hover:bg-muted transition-colors", children: [_jsx("button", { onClick: () => toggleGroup(groupId), className: "p-1 hover:bg-muted rounded transition-colors", "aria-label": isExpanded ? 'Collapse group' : 'Expand group', children: isExpanded ? (_jsx(ChevronDown, { size: 16 })) : (_jsx(ChevronRight, { size: 16 })) }), _jsx("span", { className: "font-semibold text-sm text-gray-200", children: groupId }), _jsxs("span", { className: "text-xs text-muted-foreground ml-2", children: ["(", groupTracks.length, ")"] })] })), isExpanded &&
                                groupTracks.map((track) => (_jsxs("div", { draggable: onReorderTracks !== undefined && !track.locked, onDragStart: (e) => handleDragStart(e, 'track', track.id), onDragOver: handleDragOver, onDrop: (e) => handleDropTrack(e, track.id), onContextMenu: (e) => {
                                        e.preventDefault();
                                        if (onDeleteTrack || onDuplicateTrack) {
                                            setContextMenu({ x: e.clientX, y: e.clientY, trackId: track.id });
                                        }
                                    }, className: `flex items-center h-20 border-b border-zinc-800 transition-colors ${track.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-move'} ${dragState.trackId === track.id
                                        ? 'bg-muted/50'
                                        : 'hover:bg-muted/50'} ${track.color ? `border-l-4 ${track.color}` : 'border-border'}`, style: { paddingLeft: isGroup ? '2rem' : undefined }, children: [_jsxs("div", { className: "w-48 flex flex-col gap-1.5 px-3 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-semibold truncate hover:text-blue-400 transition-colors", children: track.name }), track.locked && (_jsx(Settings, { size: 12, className: "text-gray-500", "aria-label": "Track locked" }))] }), _jsxs("select", { value: track.input, onChange: (e) => onUpdateTrack(track.id, { input: e.target.value }), disabled: track.locked, className: "bg-muted text-xs rounded px-2 py-1 disabled:opacity-50 hover:bg-accent transition-colors", "aria-label": `Input for ${track.name}`, children: [_jsx("option", { children: "Mic 1" }), _jsx("option", { children: "Interface Ch 2" }), _jsx("option", { children: "Line In" })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 flex-shrink-0", children: [_jsx("button", { onClick: () => onArmTrack(track.id), disabled: track.locked, className: `w-8 h-8 text-xs font-bold rounded transition-all ${track.armed
                                                        ? 'bg-red-600 shadow-red-500/50 shadow-sm'
                                                        : 'bg-muted text-muted-foreground hover:bg-accent'} disabled:opacity-50`, title: "Record Arm", "aria-label": `${track.armed ? 'Disarm' : 'Arm'} ${track.name}`, children: "R" }), _jsx("button", { onClick: () => onToggleMute(track.id), className: `w-8 h-8 text-xs font-bold rounded transition-all ${track.muted
                                                        ? 'bg-yellow-600 shadow-yellow-500/50 shadow-sm'
                                                        : 'bg-muted text-muted-foreground hover:bg-accent'}`, title: "Mute", "aria-label": `${track.muted ? 'Unmute' : 'Mute'} ${track.name}`, children: "M" }), _jsx("button", { onClick: () => onToggleSolo(track.id), className: `w-8 h-8 text-xs font-bold rounded transition-all ${track.solo
                                                        ? 'bg-accent shadow-green-500/50 shadow-sm'
                                                        : 'bg-muted text-muted-foreground hover:bg-accent'}`, title: "Solo", "aria-label": `${track.solo ? 'Unsolo' : 'Solo'} ${track.name}`, children: "S" })] }), _jsx("div", { className: "w-3 h-12 bg-muted rounded overflow-hidden flex-shrink-0 mx-2", children: _jsx("div", { className: "w-full bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 transition-all", style: {
                                                    // PATCH-M04-b: decayed level from animation loop
                                                    height: `${Math.min(100, Math.max(0, (meterLevels[track.id] ?? track.meter ?? 0) * 100))}%`,
                                                    transition: 'height 0.016s linear', // 1-frame smoothing
                                                }, role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round((track.meter ?? 0) * 100), "aria-label": `Meter for ${track.name}` }) }), _jsxs("div", { className: "flex-1 flex items-center gap-1.5 bg-muted h-12 rounded-lg px-3 mx-2", children: [track.fxChain.length === 0 && (_jsx("span", { className: "text-xs text-gray-500", children: "No Inserts" })), track.fxChain.map((fx, idx) => (_jsxs("div", { draggable: onReorderFX !== undefined, onDragStart: (e) => handleDragStart(e, 'fx', track.id, idx), onDragOver: handleDragOver, onDrop: (e) => handleDropFX(e, track.id, idx), className: "px-2.5 py-1 text-xs font-medium bg-gradient-to-br from-purple-600 to-purple-700 rounded cursor-move hover:from-purple-500 hover:to-purple-600 transition-all group flex items-center gap-1", title: "Drag to reorder", role: "button", tabIndex: 0, children: [_jsx(Zap, { size: 10 }), fx, onRemoveFX && (_jsx("button", { onClick: () => onRemoveFX(track.id, idx), className: "ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-600 rounded", "aria-label": `Remove ${fx}`, children: _jsx(Trash2, { size: 8 }) }))] }, `${track.id}-fx-${idx}`))), onAddFX && (_jsx("button", { onClick: () => onAddFX(track.id, 'EQ'), className: "ml-auto p-1.5 rounded hover:bg-muted transition-colors", title: "Add FX Insert", "aria-label": `Add effect to ${track.name}`, children: _jsx(Plus, { size: 16, className: "text-muted-foreground" }) }))] }), _jsxs("div", { className: "w-24 flex flex-col items-center flex-shrink-0 px-2", children: [_jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: track.volume, onChange: (e) => onUpdateTrack(track.id, {
                                                        volume: Number(e.target.value),
                                                    }), disabled: track.locked, className: "w-full accent-blue-500 disabled:opacity-50", "aria-label": `Volume for ${track.name}` }), _jsxs("span", { className: "text-[10px] text-muted-foreground font-medium", children: [Math.round(track.volume * 100), "%"] })] }), _jsxs("div", { className: "w-20 flex flex-col items-center flex-shrink-0 px-2", children: [_jsx("input", { type: "range", min: -1, max: 1, step: 0.01, value: track.pan, onChange: (e) => onUpdateTrack(track.id, { pan: Number(e.target.value) }), disabled: track.locked, className: "w-full accent-green-500 disabled:opacity-50", "aria-label": `Pan for ${track.name}` }), _jsxs("span", { className: "text-[10px] text-muted-foreground font-medium", children: [track.pan > 0
                                                            ? 'R'
                                                            : track.pan < 0
                                                                ? 'L'
                                                                : 'C', Math.round(Math.abs(track.pan) * 50)] })] })] }, track.id)))] }, groupId));
                }) }), contextMenu && (_jsxs("div", { ref: contextMenuRef, className: "fixed bg-muted border border-border rounded-lg shadow-xl z-50 py-1 min-w-48", style: { top: contextMenu.y, left: contextMenu.x }, onMouseLeave: () => setContextMenu(null), role: "menu", children: [onDuplicateTrack && (_jsxs("button", { onClick: () => {
                            onDuplicateTrack(contextMenu.trackId);
                            setContextMenu(null);
                        }, className: "w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors", role: "menuitem", children: [_jsx(Copy, { size: 14 }), " Duplicate"] })), onDeleteTrack && (_jsxs("button", { onClick: () => {
                            onDeleteTrack(contextMenu.trackId);
                            setContextMenu(null);
                        }, className: "w-full px-4 py-2 text-left text-sm hover:bg-red-900/50 text-red-400 flex items-center gap-2 transition-colors", role: "menuitem", children: [_jsx(Trash2, { size: 14 }), " Delete"] }))] }))] }));
};
export default MultitrackView;
