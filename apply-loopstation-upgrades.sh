#!/usr/bin/env bash
# apply-loopstation-upgrades.sh — v2 (triple-checked)
# BUG-13 FIX: TSC runs from ~/Stable (repo root), not from client/
# Run from ~/Stable

set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME/Stable")"
cd "$REPO_ROOT"
echo "Working dir: $(pwd)"

PATCHES_DIR="$(cd "$(dirname "$0")" && pwd)"

run_patch() {
    local script="$1"
    echo ""
    echo "════════════════════════════════════════"
    echo "  Applying: $(basename "$script")"
    echo "════════════════════════════════════════"
    bash "$PATCHES_DIR/$script"
}

# Phase 1: Engine methods (must come before hook — hook calls engine)
run_patch patch-engine.sh

# Phase 2: Hook state + functions
run_patch patch-hook.sh

# Phase 3: TrackPad component
run_patch patch-trackpad.sh

# Phase 4: LoopStation505 wiring (onChorusSend only — filter/MIDI blocked)
run_patch patch-ui.sh

echo ""
echo "════════════════════════════════════════"
echo "  TSC gate — running from repo root (BUG-13 fix)"
echo "════════════════════════════════════════"
# BUG-13 FIX: run from repo root, not from client/
pnpm tsc --noEmit 2>&1 | head -60

echo ""
echo "════════════════════════════════════════"
echo "  Status"
echo "════════════════════════════════════════"
echo "✅ Chorus send (CHO knob per track) — applied"
echo "⏸  Filter resonance + type — BLOCKED (BLOCK-C + BLOCK-D grep needed)"
echo "⏸  MIDI clock toggle — BLOCKED (BLOCK-E grep needed)"
echo "⏸  MIDI input port selector — BLOCKED (BLOCK-E grep needed)"
echo ""
echo "BLOCK-C + BLOCK-D (run from ~/Stable):"
echo "  grep -n 'filterResonance\|filterType\|setFilter' \\"
echo "    client/src/features/loopstation/hooks/useLoopStation505.ts | head -20"
echo ""
echo "BLOCK-E:"
echo "  grep -n 'midiSync\|toggleMidi\|MIDI IN\|midiClock\|INT CLK' \\"
echo "    client/src/features/loopstation/LoopStation505.tsx | head -15"
echo ""
echo "BLOCK-A (update setChorusSend body in engine after seeing this):"
echo "  grep -n 'setReverbSend\|setDelaySend\|reverbSend\|delaySend' \\"
echo "    client/src/features/loopstation/engine/loopEngine.ts | head -15"
echo ""
echo "BLOCK-B (confirm ExtendedTrackState has chorusSend after patch):"
echo "  grep -n 'ExtendedTrackState\|chorusSend' \\"
echo "    client/src/features/loopstation/hooks/useLoopStation505.ts | head -10"
echo ""
echo "TSC must be zero before sharing any of those outputs."
