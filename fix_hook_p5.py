#!/usr/bin/env python3
"""
fix_hook_p5.py — adds midiInputEnabled, midiInputs, toggleMidiInput
to the useLoopStation505 return object.
2026-04-25
"""
import sys, shutil
from pathlib import Path

HOOK = Path.home() / "Stable/client/src/features/loopstation/hooks/useLoopStation505.ts"

ANCHOR = "    midiSync,\n"
INSERT = "    midiInputEnabled,\n    midiInputs,\n    toggleMidiInput,\n"

content = HOOK.read_text(encoding="utf-8")
count = content.count(ANCHOR)
if count != 1:
    print(f"✗ Anchor found {count}× (expected 1). Aborting.")
    sys.exit(1)

bak = HOOK.with_suffix(HOOK.suffix + ".bak.p5fix")
shutil.copy2(HOOK, bak)
print(f"✓ Backup → {bak.name}")

HOOK.write_text(content.replace(ANCHOR, ANCHOR + INSERT, 1), encoding="utf-8")
print("✓ Exports added to return object")
print("Next: cd ~/Stable/client && pnpm tsc --noEmit")
