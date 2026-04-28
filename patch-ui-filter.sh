#!/usr/bin/env bash
# patch-ui-filter.sh
# Adds a standalone RESO knob after the existing FILTER FXKnob in LoopStation505.tsx.
# Anchor: exact text of line 1329 (confirmed from live grep output).
# Does NOT touch filterType — filterType is not in hook state, cannot be safely added.
# Run from ~/Stable AFTER patch-ui-chorus.sh

set -euo pipefail
FILE="client/src/features/loopstation/LoopStation505.tsx"

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found"; exit 1; }

TS=$(date +%Y%m%d_%H%M%S)
cp "$FILE" "${FILE}.${TS}.bak"
echo "Backup → ${FILE}.${TS}.bak"

# Assert: FILTER knob line exists before touching anything
FILTER_KNOB_LINE='<FXKnob label="FILTER" value={fv}'
FILTER_COUNT=$(grep -c "$FILTER_KNOB_LINE" "$FILE" 2>/dev/null || echo 0)
[[ "$FILTER_COUNT" -eq 1 ]] || {
    echo "ERROR: FILTER FXKnob anchor count = $FILTER_COUNT (expected 1) — abort"
    exit 1
}

# Assert: fx.filterResonance is accessible (fx destructured from hook at line 930)
FX_COUNT=$(grep -c "fx," "$FILE" 2>/dev/null || echo 0)
[[ "$FX_COUNT" -ge 1 ]] || {
    echo "WARNING: 'fx,' not found in LoopStation505.tsx — filterResonance may not be in scope"
}

if grep -q 'label="RESO"' "$FILE"; then
    echo "INFO: RESO knob already present — nothing to do"
    exit 0
fi

python3 - <<'PYEOF'
import sys

path = "client/src/features/loopstation/LoopStation505.tsx"
src  = open(path).read()
original_len = len(src)

# Exact anchor from live output line 1329:
# <FXKnob label="FILTER" value={fv}   color={T.acid}   size="md"
#   onChange={v => { setFV(v); setFilter(v * 18000 + 200, v * 8 + 0.5); }} />
FILTER_ANCHOR = '<FXKnob label="FILTER" value={fv}'
assert FILTER_ANCHOR in src, f"Anchor not found: {FILTER_ANCHOR}"

# Find the full FXKnob element by locating the /> that closes the FILTER knob
anchor_idx = src.find(FILTER_ANCHOR)
close_idx   = src.find("/>", anchor_idx)
assert close_idx != -1, "FILTER FXKnob closing /> not found"
close_idx += 2  # include />

# RESO knob:
# - value: normalises fx.filterResonance from [0.5, 8.5] → [0, 1]
#   (matches the coupling range used by the FILTER knob: v * 8 + 0.5)
# - onChange: keeps current frequency via fv, sets new resonance in same range
# - No `as any` — all values are numbers, no type issues
RESO_KNOB = (
    "\n                  "
    '<FXKnob label="RESO"'
    "  value={Math.min(1, Math.max(0, (fx.filterResonance - 0.5) / 8))}"
    "  color={T.acid}"
    '  size="md"'
    "  onChange={v => setFilter(fv * 18000 + 200, v * 8 + 0.5)}"
    " />"
)

src = src[:close_idx] + RESO_KNOB + src[close_idx:]

assert 'label="RESO"' in src, "ASSERTION FAILED: RESO knob not inserted"
assert len(src) > original_len, "ASSERTION FAILED: file got shorter"
open(path, "w").write(src)
print(f"LoopStation505.tsx — RESO knob added (+{len(src) - original_len} chars)")
PYEOF

echo ""
echo "=== Verify ==="
grep -n 'label="FILTER"\|label="RESO"' "$FILE"

echo ""
echo "=== TSC gate ==="
pnpm tsc --noEmit 2>&1 | head -30

echo ""
echo "=== STILL BLOCKED — MIDI clock output toggle ==="
echo "Need surrounding JSX context around line 1603:"
echo "  sed -n '1595,1635p' client/src/features/loopstation/LoopStation505.tsx"
