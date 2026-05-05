#!/usr/bin/env python3
"""
r3_patch6_gesture.py — WIRE Protocol
One-shot fix for PATCH 6: AudioEngine gesture guard in multi-track-panel.tsx.

Replaces the bare engine.initialize() useEffect (which violates browser autoplay
policy and has an undeclared `engine` reference in its cleanup) with a
gesture-guarded version that also merges the existing cleanup logic.

Run from ~/Stable:
  python3 r3_patch6_gesture.py

Verify after:
  pnpm tsc --noEmit
  grep -n 'console.error\\|engine.initialize' client/src/components/multi-track-panel.tsx
"""

import re
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
TS = datetime.now().strftime("%Y%m%d_%H%M%S")

TARGET_CANDIDATES = [
    "client/src/components/multi-track-panel.tsx",
    "client/src/components/daw/multi-track-panel.tsx",
]

# Exact anchor — confirmed from live file inspection (lines 937-945).
# The original has a bug: `engine` in cleanup is undeclared (_engine was declared).
OLD_EFFECT = (
    "  useEffect(() => {\n"
    "    const _engine = audioEngineRef.current;\n"
    "    engine.initialize().catch(console.error);\n"
    "    return () => {\n"
    "      if (typeof engine.cleanup === 'function') engine.cleanup();\n"
    "      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);\n"
    "    };\n"
    "  }, []);"
)

# Replacement: gesture guard + merged cleanup.
# Fixes: (1) autoplay policy violation, (2) console.error → logger.error per PRD §8.1,
#        (3) undeclared `engine` in cleanup → audioEngineRef.current.
NEW_EFFECT = """\
  // Defer AudioEngine init until first user gesture (autoplay policy).
  useEffect(() => {
    const handler = () => {
      if (audioEngineRef.current) {
        // PRD §8.1: logger.error instead of console.error.
        // Verify import: import { logger } from '@/lib/logger'
        audioEngineRef.current.initialize().catch((err) => {
          logger.error({ err }, 'AudioEngine initialization failed');
        });
      }
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      // Merged from original cleanup — fixed undeclared `engine` → audioEngineRef.current
      if (typeof audioEngineRef.current?.cleanup === 'function') audioEngineRef.current.cleanup();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);"""


def main() -> None:
    print("R3v4 — PATCH 6 Gesture Guard (WIRE Protocol)")
    print(f"Root: {ROOT}")

    if not (ROOT / "client").exists():
        print("[ABORT] Not in repo root — run from ~/Stable")
        return

    # Find target file
    p = None
    for c in TARGET_CANDIDATES:
        candidate = ROOT / c
        if candidate.exists():
            p = candidate
            break
    if not p:
        print(f"[ABORT] multi-track-panel.tsx not found in candidates:\n  " +
              "\n  ".join(TARGET_CANDIDATES))
        return

    print(f"Target: {p}")

    text = p.read_text(encoding="utf-8")

    # Pre-check: is it already patched?
    if "audioEngineRef.current.initialize().catch" in text:
        print("[SKIP] Gesture guard already applied — nothing to do.")
        return

    # Exact match
    if OLD_EFFECT in text:
        count = text.count(OLD_EFFECT)
        assert count == 1, f"[ABORT] Anchor appears {count} times — expected exactly 1"

        bak = p.with_suffix(f".tsx.bak-{TS}")
        shutil.copy2(p, bak)
        print(f"[BACKUP] {bak}")

        text = text.replace(OLD_EFFECT, NEW_EFFECT, 1)
        p.write_text(text, encoding="utf-8")
        print(f"[WRITTEN] {p}")
        print("[REPLACE] Bare initialize() useEffect → gesture-guarded version")
        print()
        print("Next steps:")
        print("  1. Verify logger import path in the file:")
        print(f"     grep -n 'logger' {p}")
        print("  2. Run: pnpm tsc --noEmit")
        print("  3. grep -n 'console.error' client/src/components/multi-track-panel.tsx")
        return

    # Regex fallback
    pattern = re.compile(
        r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*'
        r'const\s+_?engine\s*=\s*audioEngineRef\.current\s*;\s*'
        r'engine\.initialize\s*\(\s*\)\.catch\s*\(\s*console\.error\s*\)\s*;\s*'
        r'(?:return\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*;\s*)?'
        r'\}\s*,\s*\[\s*\]\s*\)\s*;',
        re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(text)
    if m:
        bak = p.with_suffix(f".tsx.bak-{TS}")
        shutil.copy2(p, bak)
        print(f"[BACKUP] {bak}")
        text = text[: m.start()] + NEW_EFFECT + text[m.end():]
        p.write_text(text, encoding="utf-8")
        print(f"[WRITTEN] {p}")
        print("[REPLACE] via regex fallback")
        return

    # Neither matched — print diagnostic
    print("[WARN] Neither exact nor regex anchor matched.")
    print("The useEffect shape may have changed. Actual file context:")
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        if "engine.initialize" in line or "audioEngineRef" in line:
            start = max(0, i - 4)
            end = min(len(lines), i + 6)
            print(f"\n  --- context around line {i} ---")
            for j in range(start, end):
                print(f"  {j+1:4d}: {lines[j]}")
            break


if __name__ == "__main__":
    main()
