import sys
path = "client/src/features/loopstation/LoopStation505.tsx"
src = open(path).read()
OLD = (
    "            MIDI IN\n"
    "          </button>\n"
    "          <span>{monoOn ? '\u2295 MONO'"
)
NEW = (
    "            MIDI IN\n"
    "          </button>\n"
    "          <button\n"
    "            onClick={toggleMidiClock}\n"
    "            disabled={!isReady}\n"
    "            title={midiSync ? 'Disable MIDI clock output' : 'Enable MIDI clock output'}\n"
    "            style={{\n"
    "              marginLeft: 4,\n"
    "              background: midiSync ? T.teal : T.b3,\n"
    "              color:      midiSync ? T.bg0  : T.t3,\n"
    "              border:     `1px solid ${midiSync ? T.teal : T.b4}`,\n"
    "              borderRadius: 3,\n"
    "              fontSize: 9,\n"
    "              padding: '2px 6px',\n"
    "              cursor: isReady ? 'pointer' : 'not-allowed',\n"
    "              letterSpacing: '0.1em',\n"
    "              fontFamily: 'IBM Plex Mono, monospace',\n"
    "              transition: 'all 0.15s',\n"
    "            }}\n"
    "          >\n"
    "            {midiSync ? 'CLK OUT \u25cf' : 'CLK OUT \u25cb'}\n"
    "          </button>\n"
    "          <span>{monoOn ? '\u2295 MONO'"
)
count = src.count(OLD)
if count != 1:
    sys.exit(f"ERROR: anchor matched {count} times")
open(path, "w").write(src.replace(OLD, NEW, 1))
print("UI button patched.")
