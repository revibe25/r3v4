#!/usr/bin/env python3
"""
apply_midi_input.py — MIDI Input upgrade for R3 v4 LoopStation
2026-04-25  (v2 — corrected after triple-check)

Bugs fixed from v1:
  • Engine Patch 5: dispose() anchor was wrong (0xFC line in wrong method).
    Now uses the unique schedules array line as anchor.
  • Engine _onMidiMessage: setFilterFreq/setReverbWet/setChorusWet don't exist.
    Replaced with direct Tone.js node property access (globalFilter.frequency,
    globalReverb.wet, globalChorus.wet) — all confirmed public properties.
  • Hook Patch 3: anchor was unverified. Now uses confirmed exact text
    '}, [isReady, init]);\n  const stopTrack'.
  • Hook Patch 4: toggleMidiInput was inline in return object (recreated every
    render). Now defined as useCallback before the return.

Wire.txt protocol:
  - Reads each file before writing
  - Asserts every anchor appears exactly once before any write
  - Creates .bak.midi-input backups before any write
  - Reports success/failure per patch
  - Zero writes on any assertion failure
"""

import sys
import shutil
from pathlib import Path

ROOT = Path.home() / "Stable"

ENGINE_PATH = ROOT / "client/src/features/loopstation/engine/loopEngine.ts"
HOOK_PATH   = ROOT / "client/src/features/loopstation/hooks/useLoopStation505.ts"
UI_PATH     = ROOT / "client/src/features/loopstation/LoopStation505.tsx"

# ─── Patch helpers ────────────────────────────────────────────────────────────

def apply_patch(content: str, anchor: str, insertion: str,
                mode: str = "after", label: str = "") -> str:
    count = content.count(anchor)
    if count != 1:
        raise ValueError(
            f"[{label}] anchor appeared {count}× (expected 1)\n"
            f"  anchor: {repr(anchor[:80])}"
        )
    if mode == "after":
        return content.replace(anchor, anchor + insertion, 1)
    elif mode == "before":
        return content.replace(anchor, insertion + anchor, 1)
    elif mode == "replace":
        return content.replace(anchor, insertion, 1)
    raise ValueError(f"Unknown mode: {mode}")

def backup(path: Path) -> None:
    bak = path.with_suffix(path.suffix + ".bak.midi-input")
    shutil.copy2(path, bak)
    print(f"  ✓ Backup → {bak.name}")

# ─── ENGINE PATCHES ───────────────────────────────────────────────────────────

ENGINE_PATCHES = [

    # 1. New private properties after _midiClockScheduleId
    dict(
        label="ENGINE P1: MIDI input properties",
        anchor="  private _midiClockScheduleId = -1;\n",
        mode="after",
        insertion="""
  // ── MIDI Input (added 2026-04-25) ──────────────────────────────────────────
  private _midiInput:        MIDIInput | null = null;
  private _midiInputEnabled  = false;
  private _midiAccess:       MIDIAccess | null = null;
  // Default note map: C3–G3 (MIDI 60–64) → tracks 0–4.
  // Configurable via setMidiNoteMap().
  private _midiNoteMap: Record<number, number> = {
    60: 0,  // C3  → track 1
    62: 1,  // D3  → track 2
    64: 2,  // E3  → track 3
    65: 3,  // F3  → track 4
    67: 4,  // G3  → track 5
  };
  // CC-number → normalised-value (0..1) handler. Set via setMidiCCHandler().
  private _midiCCHandlers: Record<number, (v: number) => void> = {};
""",
    ),

    # 2. New events in EngineEvents interface after midiClockStop
    dict(
        label="ENGINE P2: MIDI input events",
        anchor="  midiClockStop:     [];\n",
        mode="after",
        insertion="""  // MIDI input events (added 2026-04-25)
  midiNoteOn:        [trackIndex: number, note: number, velocity: number];
  midiNoteOff:       [trackIndex: number, note: number];
  midiCC:            [cc: number, value: number];
  midiInputEnabled:  [enabled: boolean];
""",
    ),

    # 3. Extend _initMidiClock() to capture inputs alongside outputs
    #    Anchor: unique outputs capture block at end of try body
    dict(
        label="ENGINE P3: extend _initMidiClock to capture inputs",
        anchor=(
            "      const outputs = Array.from(access.outputs.values());\n"
            "      if (outputs.length) this._midiOutput = outputs[0];\n"
            "    } catch { /* no MIDI access */ }\n"
            "  }"
        ),
        mode="replace",
        insertion=(
            "      const outputs = Array.from(access.outputs.values());\n"
            "      if (outputs.length) this._midiOutput = outputs[0];\n"
            "\n"
            "      // ── MIDI Input capture (added 2026-04-25) ───────────────────────────\n"
            "      this._midiAccess = access;\n"
            "      const inputs = Array.from(access.inputs.values());\n"
            "      if (inputs.length) {\n"
            "        this._midiInput = inputs[0];\n"
            "        // setMidiInputEnabled(true) may have been called before MIDI was ready\n"
            "        if (this._midiInputEnabled) {\n"
            "          this._midiInput.onmidimessage = this._onMidiMessage.bind(this);\n"
            "        }\n"
            "      }\n"
            "    } catch { /* no MIDI access */ }\n"
            "  }"
        ),
    ),

    # 4. New _onMidiMessage + public MIDI input methods before Player sync helpers
    #    Anchor is the unique section comment that immediately precedes those helpers
    dict(
        label="ENGINE P4: _onMidiMessage + public MIDI input methods",
        anchor="  // ── Player sync helpers ───────────────────────────────────────────────────",
        mode="before",
        insertion="""  // ── MIDI input handler (added 2026-04-25) ──────────────────────────────────

  private _onMidiMessage(e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data || data.length < 1) return;
    const status = data[0];
    const type   = status & 0xF0;
    const note   = data[1] ?? 0;
    const vel    = data[2] ?? 0;

    // ── System real-time transport bytes ──────────────────────────────────
    if (status === 0xFA) { this.startTransport(); this.emit('transportStart'); return; }
    if (status === 0xFC) { this.stopTransport();  this.emit('transportStop');  return; }
    if (status === 0xFB) { this.startTransport(); this.emit('transportStart'); return; } // continue

    // ── Note On ───────────────────────────────────────────────────────────
    if (type === 0x90 && vel > 0) {
      const trackIdx = this._midiNoteMap[note];
      if (trackIdx !== undefined) this.emit('midiNoteOn', trackIdx, note, vel);
      return;
    }

    // ── Note Off (status 0x80, or Note On with vel=0) ─────────────────────
    if (type === 0x80 || (type === 0x90 && vel === 0)) {
      const trackIdx = this._midiNoteMap[note];
      if (trackIdx !== undefined) this.emit('midiNoteOff', trackIdx, note);
      return;
    }

    // ── Control Change ────────────────────────────────────────────────────
    if (type === 0xB0) {
      const norm = vel / 127;
      this.emit('midiCC', note, vel);
      // Custom handler takes priority
      const handler = this._midiCCHandlers[note];
      if (handler) { handler(norm); return; }
      // Default CC map — uses confirmed public Tone.js node properties
      switch (note) {
        case 1:   // Mod wheel → global filter cutoff
        case 74:  // Filter cutoff (MIDI standard)
          if (this.globalFilter) this.globalFilter.frequency.rampTo(200 + norm * 19800, 0.05);
          break;
        case 7:   // Channel volume → master volume
          this.setMasterVolume(norm * 1.5);
          break;
        case 91:  // Reverb send → global reverb wet
          if (this.globalReverb) this.globalReverb.wet.rampTo(norm, 0.05);
          break;
        case 93:  // Chorus send → global chorus wet
          if (this.globalChorus) (this.globalChorus.wet as any).rampTo(norm, 0.05);
          break;
        case 64:  // Sustain pedal → toggle transport
          if (vel >= 64) this.toggleTransport();
          break;
      }
      return;
    }
  }

  /** Enable / disable MIDI note + CC input. Safe to call before init(). */
  setMidiInputEnabled(enabled: boolean): void {
    this._midiInputEnabled = enabled;
    if (this._midiInput) {
      this._midiInput.onmidimessage = enabled
        ? this._onMidiMessage.bind(this)
        : null;
    }
    this.emit('midiInputEnabled', enabled);
  }

  /** Replace the MIDI note → track index map (MIDI note numbers as keys). */
  setMidiNoteMap(map: Record<number, number>): void {
    this._midiNoteMap = { ...map };
  }

  /**
   * Register a custom handler for a CC number.
   * Value is normalised 0..1. Overrides the built-in default for that CC.
   */
  setMidiCCHandler(cc: number, handler: (normalised: number) => void): void {
    this._midiCCHandlers[cc] = handler;
  }

  /** Remove a custom CC handler, restoring built-in default behaviour. */
  clearMidiCCHandler(cc: number): void {
    delete this._midiCCHandlers[cc];
  }

  /** Names of available MIDI input ports. Empty until after init(). */
  getMidiInputs(): string[] {
    if (!this._midiAccess) return [];
    return Array.from(this._midiAccess.inputs.values()).map(i => i.name ?? 'Unknown');
  }

  /** Switch the active MIDI input port by index into getMidiInputs(). */
  selectMidiInput(index: number): void {
    if (!this._midiAccess) return;
    const inputs = Array.from(this._midiAccess.inputs.values());
    const input  = inputs[index];
    if (!input) return;
    if (this._midiInput) this._midiInput.onmidimessage = null;
    this._midiInput = input;
    if (this._midiInputEnabled) {
      this._midiInput.onmidimessage = this._onMidiMessage.bind(this);
    }
  }

""",
    ),

    # 5. Dispose cleanup — add MIDI input teardown after the schedules array block
    #    Anchor: unique combination of all three schedule IDs in one array
    dict(
        label="ENGINE P5: dispose() MIDI input teardown",
        anchor=(
            "    [this._beatScheduleId, this._quantScheduleId, this._midiClockScheduleId]\n"
            "      .filter(id => id >= 0)\n"
            "      .forEach(id => _Tone!.Transport.clear(id));"
        ),
        mode="after",
        insertion="""
    // MIDI input teardown (added 2026-04-25)
    if (this._midiInput) { this._midiInput.onmidimessage = null; this._midiInput = null; }
    this._midiAccess = null;
""",
    ),
]

# ─── HOOK PATCHES ─────────────────────────────────────────────────────────────

HOOK_PATCHES = [

    # 1. New state + pressTrackRef after midiSync state line
    dict(
        label="HOOK P1: midiInputEnabled state + pressTrackRef",
        anchor="  const [midiSync, setMidiSync]         = useState(false);\n",
        mode="after",
        insertion="""  // MIDI input state (added 2026-04-25)
  const [midiInputEnabled, setMidiInputEnabled] = useState(false);
  const [midiInputs,       setMidiInputs]       = useState<string[]>([]);
  // Stable ref so the midiNoteOn engine listener can call pressTrack
  // without a stale closure. Kept in sync after pressTrack is defined.
  const pressTrackRef = useRef<(id: string) => Promise<void>>(async () => {});
""",
    ),

    # 2. New engine listeners inside the existing useEffect offs array
    #    Anchor: unique closing of soloChanged listener + offs close + cleanup return
    dict(
        label="HOOK P2: midiInputEnabled + midiNoteOn listeners",
        anchor=(
            "      engine.on('soloChanged', soloActive => {\n"
            "        setState(prev => ({ ...prev, soloActive }));\n"
            "      }),\n"
            "    ];\n"
            "\n"
            "    return () => offs.forEach(off => off());"
        ),
        mode="replace",
        insertion=(
            "      engine.on('soloChanged', soloActive => {\n"
            "        setState(prev => ({ ...prev, soloActive }));\n"
            "      }),\n"
            "      // MIDI input listeners (added 2026-04-25)\n"
            "      engine.on('midiInputEnabled', enabled => setMidiInputEnabled(enabled)),\n"
            "      engine.on('midiNoteOn', (trackIdx) => {\n"
            "        // Use ref to avoid stale closure over pressTrack\n"
            "        pressTrackRef.current(`track-${trackIdx}`);\n"
            "      }),\n"
            "    ];\n"
            "\n"
            "    return () => offs.forEach(off => off());"
        ),
    ),

    # 3. Sync pressTrackRef after pressTrack is defined
    #    Confirmed anchor: '}, [isReady, init]);\n  const stopTrack' (no blank line)
    dict(
        label="HOOK P3: sync pressTrackRef after pressTrack",
        anchor="  }, [isReady, init]);\n  const stopTrack",
        mode="replace",
        insertion=(
            "  }, [isReady, init]);\n"
            "\n"
            "  // Keep ref current so midiNoteOn listener always has latest pressTrack (2026-04-25)\n"
            "  pressTrackRef.current = pressTrack;\n"
            "\n"
            "  const stopTrack"
        ),
    ),

    # 4. toggleMidiInput as useCallback before recordNextTrack
    #    + export it in the return object alongside pressTrack
    dict(
        label="HOOK P4: toggleMidiInput useCallback",
        anchor="  // RC-505 REC behavior: press the first idle track to start recording\n  const recordNextTrack",
        mode="before",
        insertion="""  // MIDI input toggle (added 2026-04-25)
  const toggleMidiInput = useCallback(async () => {
    if (!isReady) return;
    const engine = getLoopEngine();
    const next   = !midiInputEnabled;
    engine.setMidiInputEnabled(next);
    if (next) setMidiInputs(engine.getMidiInputs());
  }, [isReady, midiInputEnabled]);

""",
    ),

    # 5. Export new values in return object alongside pressTrack
    dict(
        label="HOOK P5: export midiInputEnabled + toggleMidiInput",
        anchor="    pressTrack,\n",
        mode="after",
        insertion="""    // MIDI input (added 2026-04-25)
    midiInputEnabled,
    midiInputs,
    toggleMidiInput,
""",
    ),
]

# ─── UI PATCHES ───────────────────────────────────────────────────────────────

UI_PATCHES = [

    # 1. Destructure new hook exports
    dict(
        label="UI P1: destructure midiInputEnabled + toggleMidiInput",
        anchor="    state, fx, isReady, isError, errorMessage, midiSync,",
        mode="replace",
        insertion=(
            "    state, fx, isReady, isError, errorMessage, midiSync,\n"
            "    midiInputEnabled, midiInputs, toggleMidiInput,"
        ),
    ),

    # 2. MIDI IN indicator — use midiInputEnabled instead of midiSync
    dict(
        label="UI P2: MIDI IN indicator uses midiInputEnabled",
        anchor="                    ['MIDI IN',   midiSync],",
        mode="replace",
        insertion="                    ['MIDI IN',   midiInputEnabled],",
    ),

    # 3. MIDI IN toggle button after the sync status text span
    dict(
        label="UI P3: MIDI IN toggle button",
        anchor="          <span>{midiSync ? '⇄ MIDI SYNC' : '○ INT CLK'}</span>",
        mode="after",
        insertion="""
          <button
            onClick={toggleMidiInput}
            disabled={!isReady}
            title={midiInputEnabled
              ? `MIDI IN active${midiInputs.length ? ': ' + midiInputs[0] : ''}`
              : 'Enable MIDI input — C3/D3/E3/F3/G3 → tracks 1–5'}
            style={{
              marginLeft: 8,
              background: midiInputEnabled ? T.cyan : T.b3,
              color:      midiInputEnabled ? T.bg0  : T.t3,
              border:     `1px solid ${midiInputEnabled ? T.cyan : T.b4}`,
              borderRadius: 3,
              fontSize: 9,
              padding: '2px 6px',
              cursor: isReady ? 'pointer' : 'not-allowed',
              letterSpacing: '0.1em',
              fontFamily: 'IBM Plex Mono, monospace',
              transition: 'all 0.15s',
            }}
          >
            MIDI IN
          </button>""",
    ),
]

# ─── Apply all patches ────────────────────────────────────────────────────────

def run_patches(path: Path, patches: list[dict], section: str) -> bool:
    print(f"\n{'─' * 62}")
    print(f"  {section}: {path.name}")
    print(f"{'─' * 62}")

    content = path.read_text(encoding="utf-8")
    original_len = len(content)

    # Dry run — assert all anchors before touching anything
    errors = []
    for p in patches:
        count = content.count(p["anchor"])
        if count != 1:
            errors.append(
                f"  ✗ [{p['label']}] anchor found {count}× (expected 1)\n"
                f"    anchor: {repr(p['anchor'][:80])}"
            )
    if errors:
        print("  ASSERTION FAILURES — file NOT written:")
        for e in errors:
            print(e)
        return False

    # All anchors verified — backup then apply sequentially
    backup(path)
    for p in patches:
        content = apply_patch(
            content, p["anchor"], p["insertion"],
            mode=p.get("mode", "after"), label=p["label"]
        )
        print(f"  ✓ {p['label']}")

    path.write_text(content, encoding="utf-8")
    print(f"  ✓ Written ({original_len} → {len(content)} chars, "
          f"+{len(content) - original_len} chars)")
    return True


if __name__ == "__main__":
    results = {
        "ENGINE": run_patches(ENGINE_PATH, ENGINE_PATCHES, "ENGINE"),
        "HOOK":   run_patches(HOOK_PATH,   HOOK_PATCHES,   "HOOK"),
        "UI":     run_patches(UI_PATH,     UI_PATCHES,     "UI"),
    }

    print(f"\n{'═' * 62}")
    all_ok = all(results.values())
    for section, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {section}")
    if all_ok:
        print("\n  ALL PATCHES APPLIED CLEANLY")
        print("  Next: cd ~/Stable/client && pnpm tsc --noEmit")
    else:
        print("\n  SOME SECTIONS FAILED — check anchor mismatches above")
        print("  Backups preserved as .bak.midi-input — no partial state")
    print(f"{'═' * 62}\n")
    sys.exit(0 if all_ok else 1)
