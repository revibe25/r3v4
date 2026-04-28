#!/usr/bin/env bash
# patch-hook-fix.sh
# Fixes the hook patch failure using exact anchors from live output.
# Run from ~/Stable

set -euo pipefail
FILE="client/src/features/loopstation/hooks/useLoopStation505.ts"

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found"; exit 1; }

TS=$(date +%Y%m%d_%H%M%S)
cp "$FILE" "${FILE}.${TS}.bak"
echo "Backup → ${FILE}.${TS}.bak"

python3 - <<'PYEOF'
import sys, re

path = "client/src/features/loopstation/hooks/useLoopStation505.ts"
src  = open(path).read()

# ── 1. Add chorusSend to ExtendedTrackState type ─────────────────────────────
# Live output shows:  "  delaySend:     number;"  (variable whitespace)
# Use regex to match regardless of spacing.

if "chorusSend" in src:
    print("INFO: chorusSend already present — skipping type + state patches")
else:
    # Regex: match "delaySend" followed by spaces/tabs and "number;" in the type block
    # Replace with same line + chorusSend line using same spacing style
    match = re.search(r'(  delaySend:\s+number;)', src)
    if not match:
        print("ERROR: delaySend type field not found with any spacing — manual fix required")
        print("  Check: grep -n 'delaySend' client/src/features/loopstation/hooks/useLoopStation505.ts")
        sys.exit(1)

    original_line = match.group(1)
    # Preserve the spacing pattern from the original delaySend line
    spacing_match = re.match(r'  delaySend:(\s+)number;', original_line)
    spacing = spacing_match.group(1) if spacing_match else "     "
    chorus_line = f"  chorusSend:{spacing}number;"

    src = src.replace(original_line, original_line + "\n" + chorus_line, 1)
    assert "chorusSend" in src, "ASSERTION FAILED: chorusSend type not inserted"
    print(f"✓ Added to ExtendedTrackState: {chorus_line!r}")

    # ── 2. Add chorusSend to state initialiser ────────────────────────────────
    # Live output line 85: "    delaySend:     0,"  (variable whitespace)
    init_match = re.search(r'(    delaySend:\s+0,)', src)
    if not init_match:
        print("WARNING: delaySend initialiser not found — add 'chorusSend: 0,' manually next to delaySend: 0")
    else:
        original_init = init_match.group(1)
        # Preserve spacing
        init_spacing_match = re.match(r'    delaySend:(\s+)0,', original_init)
        init_spacing = init_spacing_match.group(1) if init_spacing_match else "     "
        chorus_init = f"    chorusSend:{init_spacing}0,"
        src = src.replace(original_init, original_init + "\n" + chorus_init, 1)
        print(f"✓ Added to state initialiser: {chorus_init!r}")

# ── 3. Add setChorusSend function ─────────────────────────────────────────────
# Uses idxFromId() — confirmed in hook output (setReverbSend uses idxFromId)
# Uses getLoopEngine().setChorusSend() — confirmed in engine (line 1216)

if "setChorusSend" in src:
    print("INFO: setChorusSend already in hook — skipping")
else:
    CHORUS_FN = '''
  const setChorusSend = useCallback((trackId: string, amount: number) => {
    getLoopEngine().setChorusSend(idxFromId(trackId), amount);
    setState(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId ? { ...t, chorusSend: amount } : t
      ),
    }));
  }, []);

'''
    # Insert before the return statement
    return_idx = src.find("\n  return {")
    if return_idx == -1:
        return_idx = src.find("\n  return(")
    if return_idx == -1:
        print("ERROR: return statement not found — cannot insert setChorusSend")
        sys.exit(1)
    src = src[:return_idx] + "\n" + CHORUS_FN + src[return_idx:]
    assert "setChorusSend" in src
    print("✓ setChorusSend function inserted")

# ── 4. Add MIDI state + handlers ─────────────────────────────────────────────
# CONFIRMED from live output:
#   - selectMidiInput(index: number) — takes index, not name
#   - getMidiInputs() returns string[] (port names)
#   - setMidiInputEnabled(enabled) confirmed at line 962
#   - setMidiClockOutput(enabled) confirmed at line 879

if "midiClockEnabled" in src:
    print("INFO: midiClockEnabled already in hook — skipping MIDI state patches")
else:
    MIDI_STATE = '''
  // ── MIDI clock output ─────────────────────────────────────────────────────
  const [midiClockEnabled, setMidiClockEnabled] = useState(false);
  const toggleMidiClock = useCallback(() => {
    setMidiClockEnabled(prev => {
      const next = !prev;
      getLoopEngine().setMidiClockOutput(next);
      return next;
    });
  }, []);

  // ── MIDI input ────────────────────────────────────────────────────────────
  const [midiInputEnabled, setMidiInputEnabled_state] = useState(false);
  const [midiInputs, setMidiInputs] = useState<string[]>([]);

  const toggleMidiInput = useCallback(() => {
    setMidiInputEnabled_state(prev => {
      const next = !prev;
      getLoopEngine().setMidiInputEnabled(next);
      if (next) {
        setMidiInputs(getLoopEngine().getMidiInputs());
      }
      return next;
    });
  }, []);

  // selectMidiInput takes an index (confirmed: engine signature is index: number)
  const selectMidiInputByIndex = useCallback((index: number) => {
    getLoopEngine().selectMidiInput(index);
  }, []);

'''
    return_idx = src.find("\n  return {")
    if return_idx == -1:
        return_idx = src.find("\n  return(")
    if return_idx == -1:
        print("ERROR: return statement not found for MIDI state insertion")
        sys.exit(1)
    src = src[:return_idx] + "\n" + MIDI_STATE + src[return_idx:]
    print("✓ MIDI state + handlers inserted")

# ── 5. Export everything from return object ───────────────────────────────────
# Anchor on setDelaySend confirmed at line 662
EXPORTS_TO_ADD = [
    ("setDelaySend,", "setDelaySend,\n    setChorusSend,"),
    ("setDelaySend,\n    setChorusSend,", None),  # idempotency check
]

if "setChorusSend," not in src:
    if "    setDelaySend," in src:
        src = src.replace("    setDelaySend,", "    setDelaySend,\n    setChorusSend,", 1)
        print("✓ setChorusSend added to return object")
    else:
        print("WARNING: setDelaySend not found in return object — add setChorusSend manually")

MIDI_EXPORTS = "    midiClockEnabled,\n    toggleMidiClock,\n    midiInputEnabled: midiInputEnabled_state,\n    midiInputs,\n    toggleMidiInput,\n    selectMidiInputByIndex,"
if "midiClockEnabled," not in src:
    # Anchor on recordNextTrack (confirmed in transcript)
    if "    recordNextTrack," in src:
        src = src.replace("    recordNextTrack,", "    recordNextTrack,\n" + MIDI_EXPORTS, 1)
        print("✓ MIDI exports added to return object")
    else:
        print("WARNING: recordNextTrack not found — add MIDI exports to return object manually")

# ── Write ─────────────────────────────────────────────────────────────────────
open(path, "w").write(src)
print(f"\nuseLoopStation505.ts updated ✓")
PYEOF

echo ""
echo "=== Verify ==="
grep -n "chorusSend\|midiClockEnabled\|midiInputEnabled\|toggleMidiClock\|toggleMidiInput" "$FILE" | head -20

echo ""
echo "=== TSC gate ==="
cd ~/Stable && pnpm tsc --noEmit 2>&1 | head -40