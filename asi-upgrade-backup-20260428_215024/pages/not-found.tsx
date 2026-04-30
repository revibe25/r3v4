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
  background: #060606;
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
  color: #444; flex: 1;
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
  color: #f0f0f0; margin-bottom: 8px;
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
  color: #f0f0f0; background: transparent; border: 1px solid #1c1c1c;
  padding: 7px 14px; cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.r3-404-btn:hover { background: #a3e635; border-color: #a3e635; color: #060606; }
.r3-404-btn-primary {
  background: rgba(163,230,53,0.06); border-color: rgba(163,230,53,0.3); color: #a3e635;
}
.r3-404-btn-primary:hover { background: #a3e635; border-color: #a3e635; color: #060606; }

.r3-404-footer {
  padding: 10px 18px; border-top: 1px solid #1c1c1c; background: #080808;
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
  return (
    <>
      <style>{STYLES}</style>
      <div className="r3-404-shell">
        <div className="r3-404-glow" />
        <div className="r3-404-panel">
          <div className="r3-404-sweep" aria-hidden="true" />

          {/* Header strip */}
          <div className="r3-404-header">
            <div className="r3-404-led-on"  />
            <div className="r3-404-led-off" />
            <div className="r3-404-led-off" />
            <span className="r3-404-header-label">R3 v4 — ROUTE ERROR</span>
            <span style={{ fontSize: 8, letterSpacing: '0.1em', color: '#2a2a2a' }}>ERR_404</span>
          </div>

          {/* Body */}
          <div className="r3-404-body">
            <div className="r3-404-code" aria-hidden="true">404</div>
            <div className="r3-404-code-hint">Page not found</div>
            <div className="r3-404-title">Route Does Not Exist</div>
            <div className="r3-404-desc">
              The path you requested isn't registered in this session.<br />
              Check the URL or navigate to a known route below.
            </div>
            <div className="r3-404-divider" />
            <div className="r3-404-nav">
              <a href="/instrument" className="r3-404-btn r3-404-btn-primary">🎹 Instrument</a>
              <a href="/daw"        className="r3-404-btn">🎚 Studio</a>
              <a href="/pricing"    className="r3-404-btn">← Pricing</a>
            </div>
          </div>

          {/* Footer */}
          <div className="r3-404-footer">
            <span className="r3-404-footer-text">Web Audio API · R3 v4</span>
            <span className="r3-404-footer-text">
              <span style={{ color: '#a3e635', marginRight: 6 }}>■</span>LLPTE ONLINE
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
