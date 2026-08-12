import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * client/src/pages/not-found.tsx
 * R3 v4 — 404 Not Found
 *
 * Acid-grid aesthetic, consistent with instrument.tsx master template.
 * IBM Plex Mono + Syne display. --ag-* CSS variables. Lime #a3e635 accent.
 */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.r3-404-shell {
  height: calc(100vh - var(--nav-h, 0px));
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--void);
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,.010) 3px, rgba(255,255,255,.010) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,.013) 31px, rgba(255,255,255,.013) 32px);
  font-family: 'IBM Plex Mono', monospace;
  position: relative;
  overflow: hidden;
}

.r3-404-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse at center, rgba(163,230,53,0.04) 0%, transparent 70%);
  pointer-events: none;
}

.r3-404-panel {
  position: relative;
  z-index: 1;
  width: min(480px, calc(100vw - 40px));
  background: #0d0d0d;
  border: 1px solid #1c1c1c;
  border-top: 3px solid #a3e635;
  box-shadow: 0 0 60px rgba(0,0,0,.8), 0 0 0 1px #1c1c1c;
  overflow: hidden;
}

.r3-404-header {
  padding: 10px 18px;
  border-bottom: 1px solid #1c1c1c;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.r3-404-led-on  { width:7px;height:7px;border-radius:50%;background:#a3e635;box-shadow:0 0 6px #a3e635; }
.r3-404-led-off { width:7px;height:7px;border-radius:50%;background:#1c1c1c;border:1px solid #2a2a2a; }

.r3-404-header-label {
  font-size: 8px; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--dj-dim); flex: 1;
}

.r3-404-body { padding: 32px 28px 28px; }

.r3-404-code {
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: clamp(72px, 14vw, 110px); letter-spacing: -0.04em;
  color: transparent; -webkit-text-stroke: 1px rgba(163,230,53,0.15);
  line-height: 1; user-select: none; margin-bottom: 6px;
}

.r3-404-code-hint {
  font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase;
  color: #a3e635; margin-bottom: 16px;
  display: flex; align-items: center; gap: 8px;
}
.r3-404-code-hint::after {
  content: ''; flex: 1; height: 1px; background: rgba(163,230,53,0.2);
}

.r3-404-title {
  font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase;
  color: var(--daw-fg); margin-bottom: 8px;
}

.r3-404-desc {
  font-size: 10px; letter-spacing: 0.08em; color: #555;
  line-height: 1.8; margin-bottom: 28px;
}

.r3-404-divider { height: 1px; background: #1c1c1c; margin-bottom: 20px; }

.r3-404-nav { display: flex; gap: 8px; flex-wrap: wrap; }

.r3-404-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'IBM Plex Mono', monospace; font-size: 9px;
  letter-spacing: 0.16em; text-transform: uppercase; text-decoration: none;
  color: var(--daw-fg); background: transparent; border: 1px solid #1c1c1c;
  padding: 7px 14px; cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.r3-404-btn:hover { background: #a3e635; border-color: #a3e635; color: var(--void); }
.r3-404-btn-primary {
  background: rgba(163,230,53,0.06); border-color: rgba(163,230,53,0.3); color: #a3e635;
}
.r3-404-btn-primary:hover { background: #a3e635; border-color: #a3e635; color: var(--void); }

.r3-404-footer {
  padding: 10px 18px; border-top: 1px solid #1c1c1c; background: var(--t-b0x);
  display: flex; justify-content: space-between; align-items: center;
}
.r3-404-footer-text { font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: #2a2a2a; }

@keyframes r3-404-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
.r3-404-sweep {
  position: absolute; top: 0; left: 0; width: 30%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(163,230,53,0.012), transparent);
  animation: r3-404-sweep 7s ease-in-out infinite; pointer-events: none;
}
`;
export default function NotFound() {
    return (_jsxs(_Fragment, { children: [_jsx("header", { className: "ag-header", children: _jsx("div", { className: "ag-header-top", children: _jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", "data-testid": "text-title", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "NATIVE"] }), _jsx("div", { className: "ag-wordmark-sub", children: "404 \u00B7 Not Found" })] }) }) }), _jsxs(_Fragment, { children: [_jsx("style", { children: STYLES }), _jsxs("div", { className: "r3-404-shell", children: [_jsx("div", { className: "r3-404-glow" }), _jsxs("div", { className: "r3-404-panel", children: [_jsx("div", { className: "r3-404-sweep", "aria-hidden": "true" }), _jsxs("div", { className: "r3-404-header", children: [_jsx("div", { className: "r3-404-led-on" }), _jsx("div", { className: "r3-404-led-off" }), _jsx("div", { className: "r3-404-led-off" }), _jsx("span", { className: "r3-404-header-label", children: "R3 v4 \u2014 ROUTE ERROR" }), _jsx("span", { style: { fontSize: 8, letterSpacing: '0.1em', color: '#2a2a2a' }, children: "ERR_404" })] }), _jsxs("div", { className: "r3-404-body", children: [_jsx("div", { className: "r3-404-code", "aria-hidden": "true", children: "404" }), _jsx("div", { className: "r3-404-code-hint", children: "Page not found" }), _jsx("div", { className: "r3-404-title", children: "Route Does Not Exist" }), _jsxs("div", { className: "r3-404-desc", children: ["The path you requested isn't registered in this session.", _jsx("br", {}), "Check the URL or navigate to a known route below."] }), _jsx("div", { className: "r3-404-divider" }), _jsxs("div", { className: "r3-404-nav", children: [_jsx("a", { href: "/instrument", className: "r3-404-btn r3-404-btn-primary", children: "\uD83C\uDFB9 Instrument" }), _jsx("a", { href: "/daw", className: "r3-404-btn", children: "\uD83C\uDF9A Studio" }), _jsx("a", { href: "/pricing", className: "r3-404-btn", children: "\u2190 Pricing" })] })] }), _jsxs("div", { className: "r3-404-footer", children: [_jsx("span", { className: "r3-404-footer-text", children: "Web Audio API \u00B7 R3 v4" }), _jsxs("span", { className: "r3-404-footer-text", children: [_jsx("span", { style: { color: '#a3e635', marginRight: 6 }, children: "\u25A0" }), "LLPTE ONLINE"] })] })] })] })] })] }));
}
