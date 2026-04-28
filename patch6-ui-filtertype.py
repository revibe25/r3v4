import sys
path = "client/src/features/loopstation/LoopStation505.tsx"
src = open(path).read()

OLD = (
    "                  <FXKnob label=\"RESO\"  value={Math.min(1, Math.max(0, (fx.filterResonance - 0.5) / 8))}  color={T.acid}  size=\"md\"  onChange={v => setFilter(fv * 18000 + 200, v * 8 + 0.5)} />\n"
    "                  <FXKnob label=\"DELAY\""
)
NEW = (
    "                  <FXKnob label=\"RESO\"  value={Math.min(1, Math.max(0, (fx.filterResonance - 0.5) / 8))}  color={T.acid}  size=\"md\"  onChange={v => setFilter(fv * 18000 + 200, v * 8 + 0.5)} />\n"
    "                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>\n"
    "                    <span style={{ fontSize: 7, letterSpacing: '.1em', color: T.t5, fontFamily: 'IBM Plex Mono,monospace' }}>TYPE</span>\n"
    "                    <div style={{ display: 'flex', gap: 2 }}>\n"
    "                      {(['lowpass','highpass','bandpass','notch'] as BiquadFilterType[]).map(t => (\n"
    "                        <button key={t} onClick={() => setFilterType(t)} style={{\n"
    "                          background: fx.filterType === t ? T.acid : T.b3,\n"
    "                          color:      fx.filterType === t ? T.bg0  : T.t4,\n"
    "                          border:     `1px solid ${fx.filterType === t ? T.acid : T.b4}`,\n"
    "                          borderRadius: 3, fontSize: 7, padding: '2px 4px',\n"
    "                          cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace',\n"
    "                          letterSpacing: '.08em', transition: 'all 0.15s',\n"
    "                        }}>\n"
    "                          {t === 'lowpass' ? 'LP' : t === 'highpass' ? 'HP' : t === 'bandpass' ? 'BP' : 'NOTCH'}\n"
    "                        </button>\n"
    "                      ))}\n"
    "                    </div>\n"
    "                  </div>\n"
    "                  <FXKnob label=\"DELAY\""
)

count = src.count(OLD)
if count != 1:
    sys.exit(f"ERROR: anchor matched {count} times")
open(path, "w").write(src.replace(OLD, NEW, 1))
print("Filter type selector patched.")
