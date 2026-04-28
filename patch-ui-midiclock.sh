#!/usr/bin/env bash
set -euo pipefail
TARGET="client/src/features/loopstation/LoopStation505.tsx"

# ── 1. Backup ────────────────────────────────────────────────────────────────
cp "$TARGET" "${TARGET}.bak"
echo "Backup: ${TARGET}.bak"

# ── 2. Verify toggleMidiClock is reachable ───────────────────────────────────
if ! grep -q 'toggleMidiClock' "$TARGET"; then
  echo "ERROR: toggleMidiClock not found in file — add it to the hook destructure first" >&2
  exit 1
fi

# ── 3. Apply patch via Python (exact indentation from sed output) ─────────────
python3 - "$TARGET" <<'PYEOF'
import sys

path = sys.argv[1]
src = open(path).read()

# Anchor uses '⊕ MONO' to make it maximally unique — 3 lines, no ambiguity
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
    print(f"ERROR: anchor matched {count} times — aborting", file=sys.stderr)
    sys.exit(1)

open(path, "w").write(src.replace(OLD, NEW, 1))
print("Patch applied.")
PYEOF

# ── 4. TSC gate ──────────────────────────────────────────────────────────────
echo "Running tsc..."
npx tsc --noEmit && echo "✅ Type-check passed" || {
  echo "❌ Type error — restoring backup"
  cp "${TARGET}.bak" "$TARGET"
  exit 1
}
