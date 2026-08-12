import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--accent-purple) (violet)
// Reason: AI clip suggestion indicator — LLPTE inference result on clip
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { FileAudio, Music } from 'lucide-react';
// PATCH-M12: Validate clip data on mount
const validateClip = (clip) => {
    if (!clip.id || typeof clip.id !== 'string')
        return { valid: false, error: 'Invalid clip id' };
    if (typeof clip.startTime !== 'number' || clip.startTime < 0)
        return { valid: false, error: 'Invalid startTime' };
    if (typeof clip.duration !== 'number' || clip.duration <= 0)
        return { valid: false, error: 'Invalid duration' };
    return { valid: true };
};
export const ClipBlock = ({ clip, isSelected, pixelsPerSecond = 100, onStartDrag, onStartResize, onClick, showWaveform = false, }) => {
    // PATCH-M12: Null-guard on callback invocations
    const handleMouseDown = useCallback((e) => {
        e.stopPropagation();
        if (onClick)
            onClick(clip.id);
        if (onStartDrag)
            onStartDrag(clip.id, e.clientX);
    }, [clip.id, onClick, onStartDrag]);
    const handleResizeMouseDown = useCallback((e) => {
        e.stopPropagation();
        if (onStartResize) {
            onStartResize(clip.id, e.clientX);
        }
    }, [clip.id, onStartResize]);
    // PATCH-M13: Keyboard handler for accessibility
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (onClick)
                onClick(clip.id);
        }
    }, [clip.id, onClick]);
    // PATCH-M16: Input validation
    const validation = validateClip(clip);
    if (!validation.valid) {
        console.error('[ClipBlock] Invalid clip:', validation.error, clip);
        return (_jsx("div", { className: "absolute h-14 rounded bg-red-500/20 border border-red-500/50", style: { left: `${clip.startTime * pixelsPerSecond}px`, width: `${50}px` }, title: `Invalid clip: ${validation.error}`, role: "alert", children: _jsx("span", { className: "text-xs text-red-400 p-1", children: "ERROR" }) }));
    }
    const width = clip.duration * pixelsPerSecond;
    const left = clip.startTime * pixelsPerSecond;
    const defaultColor = clip.type === 'midi' ? 'var(--track-indigo)' : 'var(--accent-purple)';
    const selectedColor = clip.type === 'midi' ? 'var(--looper-blue)' : 'var(--accent-violet-soft)';
    return (_jsxs("div", { className: "absolute h-14 rounded cursor-move transition-all select-none overflow-hidden group", style: {
            left: `${left}px`,
            width: `${width}px`,
            backgroundColor: clip.color || (isSelected ? selectedColor : defaultColor),
            border: isSelected ? '2px solid var(--accent-blue)' : '2px solid rgba(255,255,255,0.2)',
            boxShadow: isSelected ? '0 0 0 1px rgba(96, 165, 250, 0.5)' : 'none'
        }, onMouseDown: handleMouseDown, onKeyDown: handleKeyDown, role: "button", tabIndex: 0, "aria-label": `Clip: ${clip.name || clip.id} (${clip.duration.toFixed(2)}s) ${isSelected ? '(selected)' : ''}`, "aria-selected": isSelected, children: [_jsxs("div", { className: "p-2 flex items-center gap-2 h-full", children: [clip.type === 'midi' ? (_jsx(Music, { className: "w-3 h-3 text-foreground/70 flex-shrink-0", "aria-hidden": "true" })) : (_jsx(FileAudio, { className: "w-3 h-3 text-foreground/70 flex-shrink-0", "aria-hidden": "true" })), _jsx("div", { className: "text-xs text-foreground font-medium truncate flex-1", children: clip.name || clip.id })] }), _jsxs("div", { className: "absolute bottom-1 right-2 text-xs text-foreground/60 pointer-events-none", children: [clip.duration.toFixed(2), "s"] }), onStartResize && (_jsx("div", { className: "absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-white/30 hover:bg-white/60 transition-colors", onMouseDown: handleResizeMouseDown, role: "button", tabIndex: -1, "aria-label": `Resize clip ${clip.id}`, title: "Drag to resize" })), showWaveform && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 h-6 opacity-30", children: _jsx("svg", { width: "100%", height: "100%", className: "opacity-50", "aria-hidden": "true", children: _jsx("rect", { x: "0", y: "40%", width: "100%", height: "20%", fill: "currentColor", className: "text-foreground" }) }) }))] }));
};
export default ClipBlock;
