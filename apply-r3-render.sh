#!/bin/bash
set -e
cd ~/Stable

# Backup original
cp client/src/pages/instrument.tsx client/src/pages/instrument.tsx.bak

# Find and replace the entire return statement
# This is complex due to size, so we'll use Python for precision
python3 << 'PYTHON_EOF'
import re

with open('client/src/pages/instrument.tsx', 'r') as f:
    content = f.read()

# Find the line "  return (" and replace everything up to the closing of instrument.tsx return
old_pattern = r'  return \(\s*<>\s*<style>\{STYLES\}</style>'
new_render = '''  return (
    <div className="r3-instrument-body" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        :root {
          --r3-base: #080808;
          --r3-panel: #0c0c0c;
          --r3-elevated: #101010;
          --r3-input: #121212;
          --r3-hover: #151515;
          --r3-border1: #171717;
          --r3-border2: #1d1d1d;
          --r3-border3: #272727;
          --r3-border4: #353535;
          --r3-text1: #f5f5f5;
          --r3-text2: #c7c7c7;
          --r3-text3: #858585;
          --r3-text4: #646464;
          --r3-text5: #4d4d4d;
          --r3-accent: #c8ff00;
          --r3-accent2: #a3e635;
          --r3-warn: #ffaa00;
          --r3-danger: #ff4444;
          --r3-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --r3-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
          --r3-focus: 0 0 0 2px #080808, 0 0 0 3px rgba(200, 255, 0, 0.75);
          --r3-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; -webkit-font-smoothing: antialiased; }
        body, .r3-instrument-body { font-family: var(--r3-sans); background: var(--r3-base); color: var(--r3-text2); }
        button { font: inherit; }
        button:focus-visible { outline: none; box-shadow: var(--r3-focus); }
        ::selection { background: rgba(200, 255, 0, 0.18); color: #fff; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #292929; border-radius: 4px; }
        ::placeholder { color: #555; }
        .nav { display: flex; align-items: center; gap: 2px; min-height: 40px; padding: 5px 10px; background: #0b0b0b; border-bottom: 1px solid var(--r3-border1); position: sticky; top: 0; z-index: 50; }
        .tab { position: relative; padding: 7px 13px; font-size: 10px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; color: #5d5d5d; border: 1px solid transparent; border-radius: 4px; cursor: pointer; transition: .14s; display: flex; align-items: center; gap: 6px; background: transparent; white-space: nowrap; }
        .tab:hover { color: #aaa; background: #111; }
        .tab.on { background: #171712; color: var(--r3-accent); border-color: #2b2b1d; box-shadow: inset 0 0 0 1px rgba(200, 255, 0, 0.04), 0 0 14px rgba(200, 255, 0, 0.025); }
        .tab.on::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: -6px; height: 1px; background: var(--r3-accent); box-shadow: 0 0 8px rgba(200, 255, 0, 0.45); }
        .badge { padding: 5px 10px; font-size: 9px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; border-radius: 4px; cursor: pointer; white-space: nowrap; }
        .badge.grn { background: var(--r3-accent); color: #090900; border: 1px solid var(--r3-accent); }
        .head { display: grid; grid-template-columns: minmax(340px, 1.1fr) auto minmax(240px, 1fr) auto; align-items: center; gap: 18px; padding: 11px 16px; background: linear-gradient(180deg, #0e0e0e, #080808); border-bottom: 1px solid var(--r3-border1); }
        .brand { display: flex; align-items: center; gap: 15px; min-width: 0; }
        .logo { font-size: 27px; font-weight: 800; letter-spacing: -.035em; color: #fff; line-height: 1; }
        .logo em { color: var(--r3-accent); font-style: normal; }
        .sub { font-size: 8.5px; color: #565656; letter-spacing: .18em; text-transform: uppercase; margin-top: 4px; }
        .live { display: flex; flex-direction: column; gap: 3px; padding: 6px 11px; background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 5px; min-width: 158px; }
        .lrow { display: flex; align-items: center; gap: 7px; font-size: 10px; }
        .ldot { width: 5px; height: 5px; background: var(--r3-accent); border-radius: 50%; box-shadow: 0 0 6px rgba(200, 255, 0, 0.5); animation: pulse 1.8s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.85); } }
        .bpmwrap { display: flex; align-items: center; gap: 11px; }
        .bpmlbl { font-size: 8.5px; color: #555; letter-spacing: .12em; text-align: center; }
        .bpmval { font-family: var(--r3-mono); font-size: 43px; font-weight: 600; color: var(--r3-accent); text-shadow: 0 0 28px rgba(200, 255, 0, 0.22); line-height: 0.9; letter-spacing: -.04em; min-width: 90px; text-align: center; font-variant-numeric: tabular-nums; }
        .tap { padding: 6px 12px; background: #141414; border: 1px solid #2a2a2a; color: #777; font-size: 9px; font-weight: 750; letter-spacing: .12em; border-radius: 3px; cursor: pointer; }
        .tap:hover { border-color: var(--r3-accent); color: var(--r3-accent); }
        .tap:active { transform: translateY(1px); }
        .marquee { display: flex; gap: 18px; padding: 5px 16px; background: #080808; border-bottom: 1px solid var(--r3-border1); font-size: 8.5px; color: #454545; letter-spacing: .14em; text-transform: uppercase; overflow: auto; white-space: nowrap; }
        .marquee .on { color: var(--r3-accent); }
        .marquee .sep { color: #303030; }
        .trans { display: flex; align-items: center; gap: 10px; padding: 7px 16px; background: #0a0a0a; border-bottom: 1px solid var(--r3-border1); }
        .main { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 1px; background: var(--r3-border1); min-height: 520px; flex: 1; overflow: hidden; }
        .left { background: var(--r3-panel); padding: 10px; overflow-y: auto; }
        .right { display: flex; flex-direction: column; gap: 1px; background: var(--r3-border1); overflow-y: auto; }
        .box { border: 1px solid var(--r3-border2); border-radius: 7px; overflow: hidden; margin-bottom: 8px; background: #0a0a0a; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
        .bhead { display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: var(--r3-elevated); border-bottom: 1px solid var(--r3-border2); }
        .btitle { display: flex; align-items: center; gap: 7px; font-size: 10.5px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; color: var(--r3-accent); }
        .bbody { padding: 14px; }
        .pads-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
        .pad { aspect-ratio: 1; background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #555; transition: all .12s; }
        .pad:hover { border-color: var(--r3-accent); background: #141414; }
        .pad.active { background: var(--r3-accent); color: #000; border-color: var(--r3-accent); box-shadow: 0 0 12px rgba(200, 255, 0, 0.4); }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <button className="tab on">🎛 INSTRUMENT</button>
        <button className="tab">📊 STUDIO</button>
        <button className="tab">🔁 LOOP</button>
        <button className="tab">🎚 MULTISTRACK</button>
        <button className="tab">👥 COLLAB</button>
        <button className="tab">🎚 MIXER</button>
        <button className="tab">✨ VFX</button>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: '10px', color: '#555', fontWeight: 650 }}>PRO_ARTIST</span>
        <span style={{ fontSize: '10px', color: '#555', fontWeight: 650 }}>🌙 DARK</span>
      </nav>

      {/* HEADER */}
      <header className="head">
        <div className="brand">
          <div>
            <div className="logo">R3<em>/</em>NATIVE</div>
            <div className="sub">INSTRUMENT · VIRTUAL VSTS</div>
          </div>
        </div>
        <div className="live">
          <div className="lrow">
            <span className="ldot"></span>
            <span style={{ color: 'var(--r3-accent)' }}>LIVE</span>
          </div>
          <div className="lrow">ERNESTO · R3VIBE</div>
        </div>
        <div className="bpmwrap">
          <div style={{ textAlign: 'center' }}>
            <div className="bpmlbl">BPM</div>
            <div className="bpmval">{state?.bpm || 120}</div>
          </div>
          <button className="tap" onClick={handleTapTempo}>TAP</button>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="marquee">
        <span className="on">/ INDEXEEDS /</span>
        <span className="sep">•</span>
        <span>MOBILE-FRIENDLY</span>
        <span className="sep">•</span>
        <span>R3 NATIVE</span>
        <span className="sep">•</span>
        <span>DESIGNED BY ERNESTO</span>
        <span className="sep">•</span>
        <span>POLYPHONY /</span>
        <span className="sep">•</span>
        <span>WEB AUDIO API</span>
        <span className="sep">•</span>
        <span>OFFLINE-FIRST</span>
        <span className="sep">•</span>
        <span>MIDI SUPPORT</span>
        <span className="sep">•</span>
        <span>ACCESSIBLE</span>
      </div>

      {/* MAIN GRID */}
      <div className="main">
        {/* LEFT: Pads */}
        <div className="left">
          <div className="box">
            <div className="bhead">
              <div className="btitle">🥁 DRUM PADS</div>
            </div>
            <div className="bbody">
              <div className="pads-grid">
                {Array.from({ length: 16 }).map((_, i) => (
                  <button
                    key={i}
                    className={`pad ${state?.pads?.[i]?.isActive ? 'active' : ''}`}
                    onClick={() => triggerPad(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div className="right">
          <div className="box" style={{ margin: '10px' }}>
            <div className="bhead">
              <div className="btitle">⚙️ CONTROL</div>
            </div>
            <div className="bbody">
              <div style={{ fontSize: '10px', color: 'var(--r3-text3)' }}>
                BPM: {state?.bpm || 120}
                <br/>
                <button 
                  onClick={() => setBpm(Math.min(999, (state?.bpm || 120) + 1))}
                  style={{ padding: '4px 8px', marginTop: '8px', fontSize: '9px', background: 'var(--r3-elevated)', border: '1px solid var(--r3-border1)', color: 'var(--r3-text2)', borderRadius: '3px', cursor: 'pointer' }}
                >
                  +
                </button>
                <button 
                  onClick={() => setBpm(Math.max(20, (state?.bpm || 120) - 1))}
                  style={{ padding: '4px 8px', marginLeft: '4px', marginTop: '8px', fontSize: '9px', background: 'var(--r3-elevated)', border: '1px solid var(--r3-border1)', color: 'var(--r3-text2)', borderRadius: '3px', cursor: 'pointer' }}
                >
                  −
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>'''

# Do the replacement
content = re.sub(old_pattern, new_render, content, count=1)

with open('client/src/pages/instrument.tsx', 'w') as f:
    f.write(content)

print("✅ Render replaced")
PYTHON_EOF

# Verify TypeScript compile
pnpm build 2>&1 | grep "error TS" || echo "✅ Build clean"

# Start dev server
echo "🚀 Starting dev server..."
pnpm dev
