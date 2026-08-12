import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * pages/multi-track-panel/components/vst-panel-modal.tsx
 * VST plugin panel for a specific track.
 * Props: trackId, trackName, onClose.
 */
import { Link } from 'wouter';
const AG = {
    panel: '#0d0d0d',
    border: '#1c1c1c',
    acid: '#a3e635',
    soft: 'var(--text-dim)',
    dim: 'var(--neutral-700)',
    white: 'var(--daw-fg)',
};
export function VSTPanelModal({ trackId, trackName, onClose }) {
    return (_jsx("div", { style: {
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
        }, children: _jsxs("div", { style: {
                background: AG.panel, border: `1px solid ${AG.border}`,
                width: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
                fontFamily: 'IBM Plex Mono, monospace',
            }, children: [_jsxs("div", { style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderBottom: `1px solid ${AG.border}`,
                        background: `linear-gradient(90deg, rgba(163,230,53,.04), transparent)`,
                    }, children: [_jsxs("span", { style: { fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: AG.acid }, children: ["VST \u2014 ", trackName ?? trackId] }), _jsx("button", { onClick: onClose, style: { background: 'none', border: 'none', color: AG.soft, cursor: 'pointer', fontSize: 14 }, children: "\u2715" })] }), _jsxs("div", { style: { padding: '32px 24px', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 28, marginBottom: 12 }, children: "\u26A1" }), _jsxs("p", { style: { fontSize: 11, color: AG.soft, lineHeight: 1.7, margin: 0 }, children: ["VST plugin management for", _jsx("br", {}), _jsx("span", { style: { color: AG.acid }, children: trackName ?? trackId })] }), _jsxs("p", { style: { fontSize: 10, color: AG.dim, marginTop: 12 }, children: ["Visit", ' ', _jsx(Link, { href: "/vst", style: { color: AG.acid, textDecoration: 'none' }, children: "/vst" }), ' ', "to load and configure plugins."] })] }), _jsx("div", { style: { padding: '10px 16px', borderTop: `1px solid ${AG.border}`, display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { onClick: onClose, style: {
                            background: 'transparent', border: `1px solid ${AG.border}`,
                            color: AG.soft, cursor: 'pointer', padding: '4px 14px',
                            fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                            fontFamily: 'IBM Plex Mono, monospace',
                        }, children: "Close" }) })] }) }));
}
