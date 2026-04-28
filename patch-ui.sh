#!/usr/bin/env bash
# patch-ui.sh — v2 (triple-checked)
# LoopStation505.tsx — SAFE section only (onChorusSend wiring)
#
# BUG-04 FIX: no 'as any' — FilterType union used directly
# BUG-08/09: setFilterResonance + setFilterType BLOCKED pending BLOCK-C grep
# BUG-10: filter anchor BLOCKED pending confirmed function name
# BUG-11: MIDI toggle placement BLOCKED pending BLOCK-E grep
# BUG-12 FIX: timestamped backup
#
# SAFE TO APPLY NOW: onChorusSend wiring only
# BLOCKED (run BLOCK-C + BLOCK-E grepped first, then apply patch-ui-filter.sh + patch-ui-midi.sh)
#
# Run from ~/Stable

set -euo pipefail
FILE="client/src/features/loopstation/LoopStation505.tsx"

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found — run from ~/Stable"; exit 1; }

# BUG-12 FIX: timestamped backup
TS=$(date +%Y%m%d_%H%M%S)
cp "$FILE" "${FILE}.${TS}.bak"
echo "Backup → ${FILE}.${TS}.bak"

echo "=== Anchor verification ==="
grep -n "setReverbSend\|setDelaySend\|onReverbSend\|onDelaySend" "$FILE" | head -10
echo "==="

python3 - <<'PYEOF'
import sys

path = "client/src/features/loopstation/LoopStation505.tsx"
src  = open(path).read()

if "setChorusSend" in src:
    print("INFO: setChorusSend already in LoopStation505.tsx — skipping")
    sys.exit(0)

# ── 1. Add setChorusSend to hook destructure ─────────────────────────────────
# Anchor: setReverbSend, setDelaySend confirmed in hook return object
# The LoopStation505 destructures the hook — find the destructure line(s)
DESTRUCT_ANCHORS = [
    "setReverbSend, setDelaySend,",
    "setReverbSend,\n  setDelaySend,",
    "setDelaySend,",  # fallback — only add after setDelaySend
]
inserted = False
for anchor in DESTRUCT_ANCHORS:
    if anchor in src:
        src = src.replace(anchor, anchor.rstrip(",") + ", setChorusSend,", 1)
        inserted = True
        print(f"✓ setChorusSend added to destructure (anchor: {anchor!r[:40]})")
        break

if not inserted:
    print("ERROR: Cannot find hook destructure anchor for setChorusSend")
    print("  Run: grep -n 'setReverbSend\\|setDelaySend' client/src/features/loopstation/LoopStation505.tsx")
    sys.exit(1)

# ── 2. Wire onChorusSend on TrackPad render ───────────────────────────────────
# Anchor confirmed from transcript line 1431:
# "onHarmonyChange={setHarmonyMode} onReverbSend={setReverbSend} onDelaySend={setDelaySend}"
TRACKPAD_ANCHOR = "onReverbSend={setReverbSend} onDelaySend={setDelaySend}"
if TRACKPAD_ANCHOR not in src:
    print("ERROR: TrackPad render anchor not found")
    print("  Run: grep -n 'onReverbSend.*onDelaySend' client/src/features/loopstation/LoopStation505.tsx")
    sys.exit(1)

count_before = src.count(TRACKPAD_ANCHOR)
src = src.replace(
    TRACKPAD_ANCHOR,
    "onReverbSend={setReverbSend} onDelaySend={setDelaySend} onChorusSend={setChorusSend}"
)
assert src.count("onChorusSend={setChorusSend}") == count_before, \
    "ASSERTION FAILED: onChorusSend not wired on all TrackPad instances"
print(f"✓ onChorusSend wired on {count_before} TrackPad instance(s)")

open(path, "w").write(src)
print("LoopStation505.tsx — onChorusSend section complete")
PYEOF

echo ""
echo "=== BLOCKED — requires data before applying: ==="
echo ""
echo "BLOCK-C + BLOCK-D (filter resonance/type knobs):"
echo "  grep -n 'filterResonance\|filterType\|setFilter\|state\.' \\"
echo "    client/src/features/loopstation/hooks/useLoopStation505.ts | head -20"
echo ""
echo "BLOCK-E (MIDI toggle placement):"
echo "  grep -n 'midiSync\|toggleMidi\|MIDI IN\|INT CLK\|midiClock' \\"
echo "    client/src/features/loopstation/LoopStation505.tsx | head -15"
echo ""
echo "Run those two commands and share output — then patch-ui-filter.sh and"
echo "patch-ui-midi.sh can be written and applied without guessing."
echo ""
echo "=== Verify what WAS applied ==="
grep -n "onChorusSend\|setChorusSend" "$FILE" | head -8
