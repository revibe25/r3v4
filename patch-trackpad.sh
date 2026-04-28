#!/usr/bin/env bash
# patch-trackpad.sh — v2 (triple-checked)
# Adds onChorusSend prop + CHO SendStrip to TrackPad.tsx
# Fixes: BUG-04 (no as any used here — TrackPad is type-safe)
#        BUG-12 (timestamped backup)
# Run from ~/Stable

set -euo pipefail
FILE="client/src/features/loopstation/components/TrackPad.tsx"

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found — run from ~/Stable"; exit 1; }

# BUG-12 FIX: timestamped backup
TS=$(date +%Y%m%d_%H%M%S)
cp "$FILE" "${FILE}.${TS}.bak"
echo "Backup → ${FILE}.${TS}.bak"

# Assert anchors exist before touching anything
echo "=== Anchor verification ==="
grep -n "onDelaySend\|delaySend\|SendStrip\|DLY" "$FILE" | head -10
echo "==="

DELAYPROP_COUNT=$(grep -c "onDelaySend: (id: string, v: number) => void;" "$FILE" 2>/dev/null || echo 0)
[[ "$DELAYPROP_COUNT" -eq 1 ]] || {
    echo "ERROR: onDelaySend prop anchor count = $DELAYPROP_COUNT (expected 1) — abort"
    exit 1
}

DLY_STRIP_COUNT=$(grep -c 'label="DLY"' "$FILE" 2>/dev/null || echo 0)
[[ "$DLY_STRIP_COUNT" -ge 1 ]] || {
    echo "ERROR: DLY SendStrip anchor not found — abort"
    exit 1
}

python3 - <<'PYEOF'
import sys

path = "client/src/features/loopstation/components/TrackPad.tsx"
src  = open(path).read()

if "onChorusSend" in src:
    print("INFO: onChorusSend already in TrackPad.tsx — nothing to do")
    sys.exit(0)

# 1. Add to Props interface (after onDelaySend)
PROP_ANCHOR = "  onDelaySend: (id: string, v: number) => void;"
assert PROP_ANCHOR in src, f"Anchor not found: {PROP_ANCHOR!r}"
src = src.replace(
    PROP_ANCHOR,
    PROP_ANCHOR + "\n  onChorusSend: (id: string, v: number) => void;"
)

# 2. Add to destructure — anchor on the confirmed line from transcript
# transcript line 310: "onHarmonyChange, onReverbSend, onDelaySend,"
DESTRUCT_ANCHOR = "onHarmonyChange, onReverbSend, onDelaySend,"
assert DESTRUCT_ANCHOR in src, f"Anchor not found: {DESTRUCT_ANCHOR!r}"
src = src.replace(
    DESTRUCT_ANCHOR,
    "onHarmonyChange, onReverbSend, onDelaySend, onChorusSend,"
)

# 3. Add CHO SendStrip after DLY
# Anchor uses the pattern confirmed in transcript (lines 540-541)
# BUG-04 note: no `as any` used anywhere in this file
DLY_ANCHOR = 'label="DLY"'
dly_idx = src.find(DLY_ANCHOR)
assert dly_idx != -1, "DLY SendStrip not found"

# Find the closing /> of the DLY SendStrip
close_idx = src.find("/>", dly_idx)
assert close_idx != -1, "DLY SendStrip closing /> not found"
close_idx += 2  # include the />

CHO_STRIP = (
    "\n        <SendStrip"
    ' label="CHO"'
    " value={track.chorusSend ?? 0}"
    ' color="#a855f7"'
    " onChange={v => onChorusSend(track.id, v)}"
    " />"
)
src = src[:close_idx] + CHO_STRIP + src[close_idx:]

assert "onChorusSend" in src
assert 'label="CHO"' in src
open(path, "w").write(src)
print("TrackPad.tsx patched ✓")
PYEOF

echo ""
echo "=== Verify ==="
grep -n "onChorusSend\|CHO" "$FILE" | head -8
