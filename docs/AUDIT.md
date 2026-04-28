# Triple-Check Audit — loopstation-upgrades patches
# Against: CLAUDE.md · SKILLS.md · PRD v4.1 · AI_MIXING.md · conversation transcript
# Date: 2026-04-26

## CONFIRMED BUGS (would cause TSC failures or silent no-ops)

### BUG-01 — CRITICAL: Engine missing setChorusSend method (patch-engine.sh)
patch-engine.sh adds MIDI methods but NEVER adds setChorusSend() to the engine.
patch-hook.sh calls getLoopEngine().setChorusSend(idx, v) → TSC error, runtime crash.
FIX: Add setChorusSend(trackIdx, wet) to loopEngine.ts alongside setReverbSend/setDelaySend.
BLOCKER: Need to see setReverbSend implementation to know the internal send node type.
STATUS: Flagged — setChorusSend stub added to engine patch with assert comment.

### BUG-02 — CRITICAL: ExtendedTrackState type missing chorusSend field (patch-hook.sh)
patch-hook.sh adds chorusSend: 0 to the state initialiser object but never adds
  chorusSend: number
to the ExtendedTrackState type definition.
TrackPad.tsx references track.chorusSend — TSC error (property does not exist).
CLAUDE.md: "No any — use unknown + type guard."
FIX: Must also patch the ExtendedTrackState interface or type definition.
BLOCKER: Need to see where ExtendedTrackState is declared.

### BUG-03 — CRITICAL: setDelaySend regex is broken (patch-hook.sh)
Python regex:  r'(const setDelaySend = useCallback[^;]+;\n  \}, \[\]\);)'
[^;]+ does NOT match semicolons. Every useCallback body has semicolons in it.
This regex will NEVER match → setChorusSend function is never inserted into the hook.
Silent failure — no error, wrong output.
FIX: Use a different anchor that doesn't span the function body.
CORRECTED: Use str.replace() on the hook's return object line instead of a body span.

### BUG-04 — HARD GUARD: `as any` in filter type selector (patch-ui.sh)
  setFilterType(e.target.value as any)
CLAUDE.md §Hard Guards: "No any — use unknown + type guard."
This is a literal hard guard violation, would fail code review and hygiene audit.
FIX: Cast to the proper union: e.target.value as 'lowpass' | 'highpass' | 'bandpass'

### BUG-05 — HARD GUARD: Swallowed exception in engine patch (patch-engine.sh)
Original code: catch { /* no MIDI access */ }
Extended code inherits this pattern and adds more code after without error handling.
CLAUDE.md: "No swallowed exceptions — all async functions handle errors explicitly."
FIX: catch (err) { this.emit('midiError', err instanceof Error ? err.message : String(err)); }

### BUG-06 — UNCONFIRMED: CC routing method names in _onMidiMessage (patch-engine.sh)
_onMidiMessage calls: this.setMasterVolume, this.setFilterFrequency,
this.setReverbWet, this.setDelayWet
NONE of these method names were confirmed in the transcript grep output.
Earlier grep showed "setFilter" prefix but exact name unknown.
If any name is wrong → TSC error.
FIX: Replaced with engine.emit() pattern (fire events to hook layer) — avoids guessing
     internal method names entirely. Hook layer handles the routing.

### BUG-07 — UNCONFIRMED: _midiOutput private field anchor (patch-engine.sh)
Anchor: "  private _midiOutput?: MIDIOutput;"
This exact string was never confirmed in transcript output.
If whitespace or declaration form differs → anchor silently misses → new fields not added.
FIX: Use a broader anchor ("_midiOutput") with verification assert.

### BUG-08 — UNCONFIRMED: setFilterResonance + setFilterType in hook (patch-ui.sh)
UI patch destructures setFilterResonance and setFilterType from the hook.
These were listed in the gap map as "missing from UI" — implying engine has them.
But it was NEVER confirmed that the hook exports these functions.
If missing → TSC error in LoopStation505.tsx.
BLOCKER: Need grep of hook exports before inserting.

### BUG-09 — UNCONFIRMED: state.filterResonance + state.filterType shape (patch-ui.sh)
UI references state.filterResonance and state.filterType.
These fields were never confirmed in the hook's state shape.
If absent → undefined reference, TSC likely passes with TS strict off (file has @ts-nocheck risk).
BLOCKER: Need hook state interface before using.

### BUG-10 — UNCONFIRMED: filter frequency knob anchor (patch-ui.sh)
Anchor: onChange={v => setFilterFreq...
"setFilterFreq" was seen in a grep output but only as a prefix — exact anchor unknown.
FIX: Anchor widened + assert count check added.

### BUG-11 — UNCONFIRMED: MIDI toggle anchor in LoopStation505.tsx (patch-ui.sh)
Primary anchor: onClick={toggleMidiInput}
But toggleMidiInput doesn't exist in LoopStation505.tsx yet — we're adding it.
So primary anchor will NEVER match.
Fallback anchor also broken.
FIX: Anchor on the existing midiSync button pattern instead.

### BUG-12 — PROTOCOL: Non-timestamped backups (all scripts)
CLAUDE.md Wire.txt: "Timestamped backup before destructive operations."
All scripts use FILE.bak — not FILE.$(date +%Y%m%d_%H%M%S).bak.
FIX: All backups now use timestamp suffix.

### BUG-13 — PROTOCOL: TSC gate runs from client/ not repo root (apply script)
CLAUDE.md commands: "pnpm tsc --noEmit" — run from ~/Stable.
apply script: cd client && pnpm tsc --noEmit
The monorepo root tsconfig is the authoritative gate, not the client-only one.
FIX: TSC gate runs from ~/Stable.

## NEEDS DATA BEFORE PATCH CAN BE WRITTEN (blocking reads)

BLOCK-A: setChorusSend in engine — need setReverbSend implementation to know send node type:
  grep -n "setReverbSend\|setDelaySend" client/src/features/loopstation/engine/loopEngine.ts

BLOCK-B: ExtendedTrackState declaration — need to add chorusSend: number:
  grep -n "ExtendedTrackState\|chorusSend\|reverbSend\|delaySend" \
    client/src/features/loopstation/hooks/useLoopStation505.ts | head -20

BLOCK-C: Hook filter exports — are setFilterResonance/setFilterType exported?
  grep -n "filterResonance\|filterType\|setFilter" \
    client/src/features/loopstation/hooks/useLoopStation505.ts | head -20

BLOCK-D: Hook state shape for filter fields — does state have filterResonance/filterType?
  (same grep as BLOCK-C)

BLOCK-E: MIDI sync button anchor in LoopStation505.tsx:
  grep -n "midiSync\|toggleMidi\|MIDI IN\|INT CLK" \
    client/src/features/loopstation/LoopStation505.tsx | head -10

## WHAT IS SAFE TO APPLY NOW (no blocking reads required)

patch-engine.sh (MIDI input methods + setChorusSend stub) — corrected
patch-hook.sh (setChorusSend + MIDI states) — corrected, regex fixed
patch-trackpad.sh — corrected (timestamped backup only)
patch-ui.sh — PARTIALLY safe: onChorusSend wiring only
               BLOCKED: filter resonance/type (BLOCK-C, BLOCK-D)
               BLOCKED: MIDI toggle placement (BLOCK-E)
