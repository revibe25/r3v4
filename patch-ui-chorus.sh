#!/usr/bin/env bash
# patch-ui-chorus.sh
# Wires onChorusSend into LoopStation505.tsx ONLY.
# Filter resonance and MIDI clock toggle are in separate scripts (blocked pending grepped outputs).
# f-string syntax fixed (BUG-04: {anchor!r[:40]} is invalid Python < 3.12)
# Run from ~/Stable

set -euo pipefail
FILE="client/src/features/loopstation/LoopStation505.tsx"

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found"; exit 1; }

TS=$(date +%Y%m%d_%H%M%S)
cp "$FILE" "${FILE}.${TS}.bak"
echo "Backup → ${FILE}.${TS}.bak"

# Assert both anchors exist before touching anything
echo "=== Anchor check ==="
grep -n "setReverbSend, setDelaySend\|onReverbSend={setReverbSend} onDelaySend={setDelaySend}" "$FILE"
echo "==="

ANCHOR1_COUNT=$(grep -c "setReverbSend, setDelaySend," "$FILE" 2>/dev/null || echo 0)
ANCHOR2_COUNT=$(grep -c "onReverbSend={setReverbSend} onDelaySend={setDelaySend}" "$FILE" 2>/dev/null || echo 0)

[[ "$ANCHOR1_COUNT" -ge 1 ]] || { echo "ERROR: destructure anchor not found — abort"; exit 1; }
[[ "$ANCHOR2_COUNT" -ge 1 ]] || { echo "ERROR: TrackPad render anchor not found — abort"; exit 1; }

if grep -q "setChorusSend" "$FILE"; then
    echo "INFO: setChorusSend already in LoopStation505.tsx — nothing to do"
    exit 0
fi

python3 - <<'PYEOF'
import sys

path = "client/src/features/loopstation/LoopStation505.tsx"
src  = open(path).read()
original_len = len(src)

# ── 1. Add setChorusSend to hook destructure ─────────────────────────────────
# Confirmed anchor from live output line 939:
#   "    setHarmonyMode, setReverbSend, setDelaySend, setMasterVolume,"
# "setReverbSend, setDelaySend," is a unique substring of that line.
DESTRUCT_ANCHOR = "setReverbSend, setDelaySend,"
assert DESTRUCT_ANCHOR in src, f"Anchor not found: {DESTRUCT_ANCHOR}"
src = src.replace(
    DESTRUCT_ANCHOR,
    "setReverbSend, setDelaySend, setChorusSend,",
    1   # first occurrence only
)

# ── 2. Wire onChorusSend on TrackPad render ───────────────────────────────────
# Confirmed anchor from live output line 1431:
#   "onHarmonyChange={setHarmonyMode} onReverbSend={setReverbSend} onDelaySend={setDelaySend}"
RENDER_ANCHOR = "onReverbSend={setReverbSend} onDelaySend={setDelaySend}"
count = src.count(RENDER_ANCHOR)
assert count >= 1, f"Render anchor not found: {RENDER_ANCHOR}"
src = src.replace(
    RENDER_ANCHOR,
    "onReverbSend={setReverbSend} onDelaySend={setDelaySend} onChorusSend={setChorusSend}"
)
# f-string fix: no !r[:N] slice — use variable instead
wired_count = src.count("onChorusSend={setChorusSend}")
anchor_short = RENDER_ANCHOR[:50]
print(f"Wired onChorusSend on {wired_count} TrackPad instance(s) (anchor: '{anchor_short}')")

assert "setChorusSend" in src
assert len(src) > original_len, "File got shorter — something went wrong"
open(path, "w").write(src)
print("LoopStation505.tsx — onChorusSend complete")
PYEOF

echo ""
echo "=== Verify ==="
grep -n "setChorusSend\|onChorusSend" "$FILE"

echo ""
echo "=== TSC gate ==="
pnpm tsc --noEmit 2>&1 | head -30

echo ""
echo "=== STILL BLOCKED — paste output of these two grepped commands ==="
echo ""
echo "1. Filter knob placement:"
echo "   grep -n 'setFilter\|filterFreq\|FXKnob\|FILTER\|globalFilter' \\"
echo "     client/src/features/loopstation/LoopStation505.tsx | head -25"
echo ""
echo "2. MIDI clock toggle placement (INT CLK context):"
echo "   grep -n 'INT CLK\|INT CLOCK\|midiSync\|toggleMidiClock' \\"
echo "     client/src/features/loopstation/LoopStation505.tsx | head -15"
echo ""
echo "Note: filterType not in hook state — filter TYPE selector is blocked"
echo "      pending hook work. Filter RESONANCE knob is feasible once grep above lands."
echo "Note: MIDI IN button already exists in UI (lines 1605-1624) — no duplicate needed."
