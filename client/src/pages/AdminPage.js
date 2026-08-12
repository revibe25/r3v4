import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber)
// Reason: Admin warning state — file should migrate to pages/admin/AdminPage.tsx
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
/**
 * client/src/pages/AdminPage.tsx
 * R3 v4 — Remote Admin Monitor
 * Acid-techno hardware panel. Polls /api/admin/stats every 5s.
 * Server gates this endpoint to ADMIN_EMAIL only.
 */
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../hooks/authStore';
const T = {
    bg: 'var(--void)', surface: '#0d0d0d', border: '#1c1c1c',
    acid: '#a3e635',
    amber: 'var(--status-warn)', cyan: 'var(--looper-cyan)', red: '#ef4444',
    green: 'var(--accent-green)', dim: 'var(--dj-dim)', muted: 'var(--dj-muted)', text: '#e5e5e5',
    font: '"IBM Plex Mono", "JetBrains Mono", monospace',
};
function formatUptime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function Led({ on, color = T.acid }) {
    return _jsx("span", { style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: on ? color : 'var(--t-b2x)', border: `1px solid ${on ? color : '#2a2a2a'}`,
            boxShadow: on ? `0 0 6px ${color}88` : 'none', flexShrink: 0 } });
}
function Tile({ label, value, unit = '', accent = T.acid, sub }) {
    return (_jsxs("div", { style: { background: T.surface, border: `1px solid ${T.border}`,
            borderTop: `2px solid ${accent}`, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }, children: [_jsx("span", { style: { fontSize: 8, letterSpacing: '0.2em', color: T.muted }, children: label }), _jsxs("span", { style: { fontSize: 22, color: accent, fontFamily: T.font, lineHeight: 1 }, children: [value, _jsx("span", { style: { fontSize: 11, color: T.dim, marginLeft: 3 }, children: unit })] }), sub && _jsx("span", { style: { fontSize: 9, color: T.dim, letterSpacing: '0.1em' }, children: sub })] }));
}
function Section({ label }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 10px' }, children: [_jsx("span", { style: { fontSize: 8, letterSpacing: '0.25em', color: T.dim }, children: label }), _jsx("div", { style: { flex: 1, height: 1, background: T.border } })] }));
}
export default function AdminPage() {
    const token = useAuthStore(s => s.token);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);
    const [lastPoll, setLastPoll] = useState('');
    const [pollCount, setPollCount] = useState(0);
    const poll = useCallback(async () => {
        if (!token)
            return;
        try {
            const res = await fetch('/api/admin/stats', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setError(d.error ?? `HTTP ${res.status}`);
                return;
            }
            setStats(await res.json());
            setError(null);
            setLastPoll(new Date().toLocaleTimeString());
            setPollCount(c => c + 1);
        }
        catch {
            setError('Network error');
        }
    }, [token]);
    useEffect(() => { poll(); const id = setInterval(poll, 5000); return () => clearInterval(id); }, [poll]);
    _jsx("header", { className: "ag-header", children: _jsx("div", { className: "ag-header-top", children: _jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", "data-testid": "text-title", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "NATIVE"] }), _jsx("div", { className: "ag-wordmark-sub", children: "Admin \u00B7 System Settings" })] }) }) });
    const dbOk = stats?.db.status === 'ok';
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100vh',
            background: T.bg,
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,.016) 31px,rgba(255,255,255,.016) 32px)',
            color: T.text, fontFamily: T.font, overflow: 'hidden',
            borderLeft: '3px solid #a3e635', boxShadow: 'inset 3px 0 18px rgba(163,230,53,0.15)' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }, children: [_jsxs("div", { style: { display: 'flex', gap: 5 }, children: [_jsx(Led, { on: true, color: T.green }), _jsx(Led, { on: !!stats }), _jsx(Led, { on: !!error, color: T.red })] }), _jsx("span", { style: { fontSize: 9, letterSpacing: '0.25em', color: T.dim, flex: 1 }, children: "R3 v4 \u2014 REMOTE MONITOR" }), _jsxs("span", { style: { fontSize: 8, color: T.dim, letterSpacing: '0.1em' }, children: [lastPoll ? `LAST SYNC  ${lastPoll}` : 'CONNECTING…', " \u00B7 POLL #", pollCount] })] }), _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: '16px 20px' }, children: [error && (_jsxs("div", { style: { padding: '10px 14px', marginBottom: 16, background: '#ef444411',
                            border: '1px solid #ef444433', fontSize: 10, color: T.red, letterSpacing: '0.1em' }, children: ["\u2717  ", error.toUpperCase()] })), stats ? (_jsxs(_Fragment, { children: [_jsx(Section, { label: "SERVER" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: [_jsx(Tile, { label: "UPTIME", value: formatUptime(stats.uptime), accent: T.acid }), _jsx(Tile, { label: "ENVIRONMENT", value: stats.env.toUpperCase(), accent: T.dim }), _jsx(Tile, { label: "NODE", value: stats.nodeVersion, accent: T.dim })] }), _jsx(Section, { label: "MEMORY" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: [_jsx(Tile, { label: "RSS", value: stats.memory.rss, unit: "MB", accent: T.acid }), _jsx(Tile, { label: "HEAP USED", value: stats.memory.heapUsed, unit: "MB", accent: T.cyan, sub: `of ${stats.memory.heapTotal} MB total` }), _jsx(Tile, { label: "HEAP FREE", value: stats.memory.heapTotal - stats.memory.heapUsed, unit: "MB", accent: T.dim })] }), _jsx(Section, { label: "DATABASE" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: [_jsx(Tile, { label: "STATUS", value: stats.db.status.toUpperCase(), accent: dbOk ? T.green : T.red }), _jsx(Tile, { label: "PING", value: stats.db.latencyMs, unit: "ms", accent: stats.db.latencyMs < 20 ? T.green : stats.db.latencyMs < 100 ? T.amber : T.red })] }), _jsx(Section, { label: "WEBSOCKET COLLAB" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: [_jsx(Tile, { label: "ROOMS", value: stats.collab.roomCount, accent: T.cyan }), _jsx(Tile, { label: "CONNECTIONS", value: stats.collab.totalUsers, accent: T.cyan })] }), stats.collab.rooms.length > 0 && (_jsxs("div", { style: { marginTop: 8, background: T.surface, border: `1px solid ${T.border}`, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 8, letterSpacing: '0.15em', color: T.dim, marginBottom: 8 }, children: "ACTIVE ROOMS" }), stats.collab.rooms.map(r => (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between',
                                            padding: '4px 0', borderBottom: `1px solid ${T.border}`, fontSize: 10 }, children: [_jsx("span", { style: { color: T.muted }, children: r.id }), _jsxs("span", { style: { color: T.cyan }, children: [r.users, " user", r.users !== 1 ? 's' : ''] })] }, r.id)))] })), _jsxs("div", { style: { marginTop: 20, fontSize: 8, color: T.dim, letterSpacing: '0.15em', textAlign: 'right' }, children: ["SERVER TIME  ", new Date(stats.ts).toLocaleString()] })] })) : !error && (_jsx("div", { style: { color: T.dim, fontSize: 10, letterSpacing: '0.2em', marginTop: 40, textAlign: 'center' }, children: "INITIALISING\u2026" }))] })] }));
}
