import sys

HOOK = "client/src/features/loopstation/hooks/useLoopStation505.ts"
COMP = "client/src/features/loopstation/LoopStation505.tsx"

# ── 1. Hook return ────────────────────────────────────────────────────────────
src = open(HOOK).read()
OLD = "    toggleMidiClock,\n    scenes,"
NEW = "    toggleMidiClock,\n    selectMidiInputByIndex,\n    scenes,"
count = src.count(OLD)
if count != 1:
    sys.exit(f"ERROR: hook return anchor matched {count} times")
open(HOOK, "w").write(src.replace(OLD, NEW, 1))
print("Hook return patched.")

# ── 2. Component destructure ──────────────────────────────────────────────────
src = open(COMP).read()
OLD = "    midiInputEnabled, midiInputs, toggleMidiInput, toggleMidiClock,"
NEW = "    midiInputEnabled, midiInputs, toggleMidiInput, toggleMidiClock, selectMidiInputByIndex,"
count = src.count(OLD)
if count != 1:
    sys.exit(f"ERROR: destructure anchor matched {count} times")
src = src.replace(OLD, NEW, 1)

# ── 3. UI — port selector after CLK OUT button, only when >1 input ────────────
OLD_UI = (
    "            {midiSync ? 'CLK OUT \u25cf' : 'CLK OUT \u25cb'}\n"
    "          </button>\n"
    "          <span>{monoOn ? '\u2295 MONO'"
)
NEW_UI = (
    "            {midiSync ? 'CLK OUT \u25cf' : 'CLK OUT \u25cb'}\n"
    "          </button>\n"
    "          {midiInputs.length > 1 && (\n"
    "            <select\n"
    "              value={midiInputs[0]}\n"
    "              onChange={e => selectMidiInputByIndex(midiInputs.indexOf(e.target.value))}\n"
    "              disabled={!midiInputEnabled}\n"
    "              style={{\n"
    "                marginLeft: 4,\n"
    "                background: T.b3,\n"
    "                color: T.t3,\n"
    "                border: `1px solid ${T.b4}`,\n"
    "                borderRadius: 3,\n"
    "                fontSize: 7,\n"
    "                padding: '2px 4px',\n"
    "                fontFamily: 'IBM Plex Mono,monospace',\n"
    "                letterSpacing: '.08em',\n"
    "                cursor: midiInputEnabled ? 'pointer' : 'not-allowed',\n"
    "              }}\n"
    "            >\n"
    "              {midiInputs.map((name, i) => (\n"
    "                <option key={i} value={name}>{name}</option>\n"
    "              ))}\n"
    "            </select>\n"
    "          )}\n"
    "          <span>{monoOn ? '\u2295 MONO'"
)
count = src.count(OLD_UI)
if count != 1:
    sys.exit(f"ERROR: UI anchor matched {count} times")
open(COMP, "w").write(src.replace(OLD_UI, NEW_UI, 1))
print("UI port selector patched.")
