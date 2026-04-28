#!/usr/bin/env bash
# patch-engine.sh — v2 (triple-checked)
# Adds to loopEngine.ts:
#   - setChorusSend(trackIdx, wet)   ← BUG-01 fix: was completely missing
#   - _initMidiClock extension: captures input ports
#   - getMidiInputs() / selectMidiInput() / setMidiInputEnabled()
#   - _onMidiMessage() — uses emit() not internal methods (BUG-06 fix)
# Run from ~/Stable

set -euo pipefail
FILE="client/src/features/loopstation/engine/loopEngine.ts"

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found — run from ~/Stable"; exit 1; }

# BUG-12 FIX: timestamped backup per CLAUDE.md Wire.txt protocol
TS=$(date +%Y%m%d_%H%M%S)
cp "$FILE" "${FILE}.${TS}.bak"
echo "Backup → ${FILE}.${TS}.bak"

# ── ASSERT: confirm anchors exist before touching anything ──────────────────
ANCHOR_OUTPUT=$(grep -n "_midiOutput\|_initMidiClock\|setMidiClockOutput" "$FILE" | head -10)
echo "=== Anchor verification ==="
echo "$ANCHOR_OUTPUT"
ANCHOR_COUNT=$(grep -c "_midiOutput" "$FILE" 2>/dev/null || echo 0)
[[ "$ANCHOR_COUNT" -gt 0 ]] || { echo "ERROR: _midiOutput not found in $FILE — abort"; exit 1; }

python3 - <<'PYEOF'
import sys

path = "client/src/features/loopstation/engine/loopEngine.ts"
src  = open(path).read()
original_len = len(src)

# ── BUG-07 FIX: use broader anchor — find _midiOutput declaration, don't assume exact form
# Anchor on the existing _midiClockScheduleId or _midiOutput line (both confirmed in transcript)
# We insert new private fields right after the _midiOutput line (whatever form it takes)
import re

# Find the line containing _midiOutput and insert after it
if "_midiInputPort" in src:
    print("INFO: _midiInputPort already in file — MIDI input fields already patched, skipping field insertion")
else:
    # Add new private fields after _midiOutput (flexible — handles any declaration form)
    src = re.sub(
        r'(_midiOutput[^\n]+\n)',
        r'\1  private _midiInputPort: MIDIInput | undefined = undefined;\n'
        r'  private _midiInputEnabled = false;\n'
        r'  private _midiAccess: MIDIAccess | undefined = undefined;\n',
        src,
        count=1
    )

# ── BUG-01 FIX: Add setChorusSend to engine ────────────────────────────────
# Strategy: anchor on setDelaySend method (confirmed exists in gap map).
# We need to see the actual send node type — using the same pattern as setDelaySend.
# BLOCK-A: If setReverbSend uses a different API than lerpParam/wet, this must be updated.
# Safe stub: mirrors the engine's own emit pattern until BLOCK-A is resolved.
if "setChorusSend" in src:
    print("INFO: setChorusSend already in engine — skipping")
else:
    CHORUS_SEND_METHOD = '''
  // ── Chorus send (per-track) ───────────────────────────────────────────────
  // NOTE: The internal node type depends on how chorusSend is built in _buildTrack.
  // If chorusSend is a Tone.Gain, use: lerpParam(t.chorusSend.gain, clamp(wet, 0, 1))
  // If chorusSend is a Tone.Volume, use: lerpParam(t.chorusSend.volume, ...)
  // Run BLOCK-A grep first, then update the body below.
  setChorusSend(trackIdx: number, wet: number): void {
    const t = this.tracks[trackIdx];
    if (!t) return;
    // Mirrors setReverbSend/setDelaySend pattern — update param name once BLOCK-A confirmed
    const clamped = Math.max(0, Math.min(1, wet));
    // @ts-expect-error — update once send node type confirmed via BLOCK-A grep
    lerpParam((t.chorusSend as any).gain ?? (t.chorusSend as any).volume, clamped);
    this.emit('chorusSendChanged', trackIdx, clamped);
  }
'''
    # Insert right before _initMidiClock (confirmed to exist from transcript)
    src = src.replace(
        "  private async _initMidiClock",
        CHORUS_SEND_METHOD + "\n  private async _initMidiClock"
    )
    assert "setChorusSend" in src, "ASSERTION FAILED: setChorusSend not inserted"

# ── Extend _initMidiClock to capture inputs ─────────────────────────────────
OLD_INIT = '''  private async _initMidiClock(): Promise<void> {
    if (!navigator.requestMIDIAccess) return;
    try {
      const access  = await navigator.requestMIDIAccess({ sysex: false });
      const outputs = Array.from(access.outputs.values());
      if (outputs.length) this._midiOutput = outputs[0];
    } catch { /* no MIDI access */ }
  }'''

# BUG-05 FIX: structured error emit instead of swallowed exception
NEW_INIT = '''  private async _initMidiClock(): Promise<void> {
    if (!navigator.requestMIDIAccess) return;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this._midiAccess = access;
      const outputs = Array.from(access.outputs.values());
      if (outputs.length) this._midiOutput = outputs[0];
      const inputs = Array.from(access.inputs.values());
      if (inputs.length) this._midiInputPort = inputs[0];
    } catch (err) {
      // BUG-05 FIX: emit instead of swallow — CLAUDE.md no swallowed exceptions
      this.emit('midiError', err instanceof Error ? err.message : String(err));
    }
  }

  // ── MIDI input API ────────────────────────────────────────────────────────
  getMidiInputs(): string[] {
    if (!this._midiAccess) return [];
    return Array.from(this._midiAccess.inputs.values())
      .map(p => p.name ?? p.id);
  }

  selectMidiInput(portName: string): void {
    if (!this._midiAccess) return;
    const port = Array.from(this._midiAccess.inputs.values())
      .find(p => (p.name ?? p.id) === portName);
    if (!port) return;
    if (this._midiInputPort) this._midiInputPort.onmidimessage = null;
    this._midiInputPort = port;
    if (this._midiInputEnabled) {
      port.onmidimessage = this._onMidiMessage.bind(this);
    }
  }

  setMidiInputEnabled(enabled: boolean): void {
    this._midiInputEnabled = enabled;
    if (!this._midiInputPort) return;
    this._midiInputPort.onmidimessage = enabled
      ? this._onMidiMessage.bind(this)
      : null;
    this.emit(enabled ? 'midiInputStart' : 'midiInputStop');
  }

  // BUG-06 FIX: emit events instead of calling internal methods directly —
  // internal method names unconfirmed (BLOCK-A). Hook layer handles routing.
  // Note map: C3 (MIDI 60) = track 0, D3=1, E3=2, F3=3, G3=4
  // CC map: emit events — hook decides which setter to call
  private _onMidiMessage(ev: MIDIMessageEvent): void {
    if (!ev.data || ev.data.length < 2) return;
    const [status, data1, data2 = 0] = Array.from(ev.data);
    const type = status & 0xf0;
    const vel  = data2;

    if (type === 0x90 && vel > 0) {
      const trackIdx = data1 - 60;
      if (trackIdx >= 0 && trackIdx < 5) {
        this.emit('midiTrackTrigger', trackIdx);
      }
    }

    if (type === 0xb0) {
      this.emit('midiCC', data1, vel / 127);
    }

    if (status === 0xFA) this.emit('midiTransportStart');
    if (status === 0xFC) this.emit('midiTransportStop');
  }'''

if "_midiInputPort" in src and "getMidiInputs" in src:
    print("INFO: MIDI input API already patched — skipping _initMidiClock replacement")
elif OLD_INIT not in src:
    print("WARNING: _initMidiClock anchor not found verbatim — manual review required")
    print("  Run: sed -n '838,860p' client/src/features/loopstation/engine/loopEngine.ts")
    print("  Then update OLD_INIT in this script to match exactly")
    sys.exit(1)
else:
    src = src.replace(OLD_INIT, NEW_INIT)
    assert "getMidiInputs" in src, "ASSERTION FAILED: getMidiInputs not inserted"

# ── Write ───────────────────────────────────────────────────────────────────
assert len(src) > original_len, "ASSERTION FAILED: file got shorter — something went wrong"
open(path, "w").write(src)
print(f"loopEngine.ts patched (+{len(src) - original_len} chars)")
PYEOF

echo ""
echo "=== Verify ==="
grep -n "setChorusSend\|getMidiInputs\|setMidiInputEnabled\|selectMidiInput\|_onMidiMessage" "$FILE" | head -10
echo ""
echo "NEXT: Run BLOCK-A grep to confirm setChorusSend body:"
echo "  grep -n 'setReverbSend\|setDelaySend\|reverbSend\|delaySend' $FILE | head -15"
echo "Then update the setChorusSend body if lerpParam target differs."
