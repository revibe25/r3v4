/**
 * client/src/pages/vst.tsx
 * VST Plugin Browser — R3 v4
 *
 * Acid-grid shell consistent with master template.
 * NOTE: This route (/vst) is currently unregistered in App.tsx.
 * VSTBrowser is embedded in InstrumentPage (/instrument).
 * This file is retained for standalone VST management access.
 * To activate: add <Route path="/vst"> in App.tsx.
 */

import { useState } from 'react';
import { VSTBrowser } from '@/components/vst-browser';
import type { VSTPluginInfo } from '@/audio/fx/vst-scanner';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.r3-vst-shell {
  height: calc(100vh - var(--nav-h, 0px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #060606;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,.010) 3px, rgba(255,255,255,.010) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,.013) 31px, rgba(255,255,255,.013) 32px);
  font-family: 'IBM Plex Mono', monospace;
  color: #f0f0f0;
}

.r3-vst-header {
  border-bottom: 3px solid #1c1c1c;
  background: #0a0a0a;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 4px 24px rgba(0,0,0,.6);
}
.r3-vst-header::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0; width: 3px;
  background: #a3e635;
  box-shadow: 0 0 18px #a3e635, 0 0 40px rgba(163,230,53,.3);
}
.r3-vst-header-top {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #1c1c1c;
}
.r3-vst-wordmark-block {
  padding: 12px 24px 10px;
  border-right: 1px solid #1c1c1c;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 200px;
}
.r3-vst-wordmark {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: -0.02em;
  color: #f0f0f0;
  line-height: 1;
}
.r3-vst-slash { color: #a3e635; margin: 0 4px; font-size: 32px; text-shadow: 0 0 12px #a3e635; }
.r3-vst-sub { font-size: 8px; letter-spacing: .35em; text-transform: uppercase; color: #f0f0f0; margin-top: 5px; }
.r3-vst-controls {
  flex: 1; padding: 8px 16px;
  display: flex; align-items: center; justify-content: flex-end; gap: 6px;
}
.r3-vst-nav-btn {
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  background: transparent; border: 1px solid #1c1c1c; padding: 6px 12px;
  color: #f0f0f0; cursor: pointer; transition: all .1s;
  text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
}
.r3-vst-nav-btn:hover { background: #a3e635; border-color: #a3e635; color: #060606; }

.r3-vst-ticker {
  padding: 4px 0; background: #0a0a0a; overflow: hidden; position: relative;
}
.r3-vst-ticker::before,.r3-vst-ticker::after {
  content:'';position:absolute;top:0;bottom:0;width:40px;z-index:2;
}
.r3-vst-ticker::before { left:0;background:linear-gradient(90deg,#0a0a0a,transparent); }
.r3-vst-ticker::after  { right:0;background:linear-gradient(-90deg,#0a0a0a,transparent); }
.r3-vst-ticker-inner { display:flex;width:max-content;animation:r3-vst-scroll 28s linear infinite; }
@keyframes r3-vst-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
.r3-vst-ticker-item { font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:#f0f0f0;padding:0 20px;white-space:nowrap;display:flex;align-items:center;gap:10px; }
.r3-vst-sep { color:#a3e635;font-size:11px; }

.r3-vst-content { flex: 1; overflow: auto; padding: 1rem; }

.r3-vst-footer {
  border-top: 3px solid #1c1c1c; background: #0a0a0a;
  padding: 8px 20px; display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0;
}
.r3-vst-footer-text { font-size: 8px; letter-spacing: .2em; text-transform: uppercase; color: #f0f0f0; }
.r3-vst-ver { background: rgba(163,230,53,.08); border: 1px solid rgba(163,230,53,.2); padding: 2px 8px; font-size: 8px; letter-spacing: .2em; color: rgba(163,230,53,.5); }
`;

const TICKER = ['VST Browser','Plugin Discovery','FX Chain','Audio Processing','Web Audio API',
  'R3 Native','LLPTE Pipeline','IBM Plex Mono'];

export default function VSTPage() {
  const [selectedPlugin, setSelectedPlugin] = useState<VSTPluginInfo | null>(null);

  return (
    <>
      <style>{STYLES}</style>
      <div className="r3-vst-shell">

        <header className="r3-vst-header">
          <div className="r3-vst-header-top">
            <div className="r3-vst-wordmark-block">
              <div className="r3-vst-wordmark">
                R3<span className="r3-vst-slash">/</span>VST
              </div>
              <div className="r3-vst-sub">Plugin Browser · FX Chain</div>
            </div>
            <div className="r3-vst-controls">
              {selectedPlugin && (
                <span style={{ fontSize: 9, letterSpacing: '.15em', color: '#a3e635', marginRight: 8 }}>
                  ● {selectedPlugin.name}
                </span>
              )}
              <a href="/instrument" className="r3-vst-nav-btn">🎹 Instrument</a>
              <a href="/daw"        className="r3-vst-nav-btn">🎚 Studio</a>
            </div>
          </div>
          <div className="r3-vst-ticker">
            <div className="r3-vst-ticker-inner">
              {[...TICKER, ...TICKER].map((item, i) => (
                <span key={i} className="r3-vst-ticker-item">
                  {item}<span className="r3-vst-sep">/</span>
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="r3-vst-content">
          <VSTBrowser
            onPluginSelect={setSelectedPlugin}
            channelId="master"
            showFXChain={true}
          />
        </div>

        <footer className="r3-vst-footer">
          <div className="r3-vst-footer-text">Web Audio API · VST3 / CLAP</div>
          <span className="r3-vst-ver">v4.0</span>
        </footer>

      </div>
    </>
  );
}
