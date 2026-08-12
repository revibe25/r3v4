import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const AG = {
    black: 'var(--void)',
    panel: '#0d0d0d',
    border: '#1c1c1c',
    acid: '#a3e635',
    soft: 'var(--text-dim)',
    white: 'var(--daw-fg)',
};
const row = {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '6px 0',
    borderBottom: `1px solid ${AG.border}`,
};
const label = {
    fontSize: 10, letterSpacing: '.15em',
    textTransform: 'uppercase', color: AG.soft,
    fontFamily: 'IBM Plex Mono, monospace',
};
const select = {
    background: AG.black, border: `1px solid ${AG.border}`,
    color: AG.white, fontSize: 10, padding: '2px 6px',
    fontFamily: 'IBM Plex Mono, monospace', borderRadius: 0,
};
export function PreferencesModal({ preferences, onUpdate, onClose }) {
    return (_jsx("div", { style: {
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
        }, children: _jsxs("div", { style: {
                background: AG.panel, border: `1px solid ${AG.border}`,
                width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
                fontFamily: 'IBM Plex Mono, monospace',
            }, children: [_jsxs("div", { style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderBottom: `1px solid ${AG.border}`,
                        background: `linear-gradient(90deg, rgba(163,230,53,.04), transparent)`,
                    }, children: [_jsx("span", { style: { fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: AG.acid }, children: "Preferences" }), _jsx("button", { onClick: onClose, style: { background: 'none', border: 'none', color: AG.soft, cursor: 'pointer', fontSize: 14 }, children: "\u2715" })] }), _jsxs("div", { style: { padding: '8px 16px' }, children: [_jsxs("div", { style: row, children: [_jsx("span", { style: label, children: "Sample Rate" }), _jsx("select", { style: select, value: preferences.sampleRate, onChange: e => onUpdate({ sampleRate: Number(e.target.value) }), children: [44100, 48000, 96000].map(r => _jsxs("option", { value: r, children: [r / 1000, "kHz"] }, r)) })] }), _jsxs("div", { style: row, children: [_jsx("span", { style: label, children: "Buffer Size" }), _jsx("select", { style: select, value: preferences.bufferSize, onChange: e => onUpdate({ bufferSize: Number(e.target.value) }), children: [128, 256, 512, 1024, 2048].map(b => _jsxs("option", { value: b, children: [b, " smp"] }, b)) })] }), _jsxs("div", { style: row, children: [_jsx("span", { style: label, children: "View Mode" }), _jsx("select", { style: select, value: preferences.viewMode, onChange: e => onUpdate({ viewMode: e.target.value }), children: ['mixer', 'timeline', 'split'].map(m => (_jsx("option", { value: m, children: m }, m))) })] }), _jsxs("div", { style: row, children: [_jsx("span", { style: label, children: "Time Format" }), _jsx("select", { style: select, value: preferences.timeFormat, onChange: e => onUpdate({ timeFormat: e.target.value }), children: ['bars', 'time', 'frames'].map(f => _jsx("option", { value: f, children: f }, f)) })] }), _jsxs("div", { style: { ...row, borderBottom: 'none' }, children: [_jsx("span", { style: label, children: "CPU Meter" }), _jsx("input", { type: "checkbox", checked: preferences.showCpuMeter, onChange: e => onUpdate({ showCpuMeter: e.target.checked }), style: { accentColor: AG.acid, width: 14, height: 14 } })] }), _jsxs("div", { style: { ...row, borderBottom: 'none' }, children: [_jsx("span", { style: label, children: "Auto Save" }), _jsx("input", { type: "checkbox", checked: preferences.autoSave, onChange: e => onUpdate({ autoSave: e.target.checked }), style: { accentColor: AG.acid, width: 14, height: 14 } })] })] }), _jsx("div", { style: { padding: '10px 16px', borderTop: `1px solid ${AG.border}`, display: 'flex', justifyContent: 'flex-end' }, children: _jsx("button", { onClick: onClose, style: {
                            background: 'transparent', border: `1px solid ${AG.border}`,
                            color: AG.soft, cursor: 'pointer', padding: '4px 14px',
                            fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                            fontFamily: 'IBM Plex Mono, monospace',
                        }, onMouseEnter: e => {
                            e.target.style.borderColor = AG.acid;
                            e.target.style.color = AG.acid;
                        }, onMouseLeave: e => {
                            e.target.style.borderColor = AG.border;
                            e.target.style.color = AG.soft;
                        }, children: "Close" }) })] }) }));
}
