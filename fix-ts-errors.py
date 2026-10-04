#!/usr/bin/env python3
"""
Fix all 6 TypeScript errors found after canvas registry patch.

Errors:
  1. MasterAnalyzer.tsx:253     - <style jsx> not valid in React (remove jsx attr)
  2. MultitrackV130.tsx:32      - audioGraphRef typed as null, can't assign AudioGraph
  3. MultitrackV130.tsx:44      - useV130PresentationRuntime called with 3 args, needs 4
  4. useV130Analyzer.tsx:522    - HIST['spec'] doesn't exist on HISTBuffers type
  5. useV130Analyzer.tsx:598    - live is number|false|null, needs boolean
  6. useV130Analyzer.tsx:600    - same as above
"""

import sys
from pathlib import Path
from datetime import datetime

REPO = Path("/home/cloud/Projects/r3v4/client/src")

def backup(path):
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = path.with_name(path.name + f".pre-ts-fix-{ts}")
    bak.write_text(path.read_text())
    print(f"  📦 Backup: {bak.name}")

def apply(path, old, new, label):
    content = path.read_text()
    if old not in content:
        print(f"  ⚠️  SKIP [{label}] — pattern not found")
        return False
    path.write_text(content.replace(old, new, 1))
    print(f"  ✅ FIXED [{label}]")
    return True

# ─────────────────────────────────────────────────────────
# FILE 1: MasterAnalyzer.tsx — remove jsx prop from <style>
# ─────────────────────────────────────────────────────────
f1 = REPO / "components/MasterAnalyzer.tsx"
print(f"\n{'='*60}")
print(f"FILE 1: {f1.name}")
print(f"{'='*60}")

if f1.exists():
    backup(f1)
    # styled-jsx syntax <style jsx>{...} → plain <style>{...}
    apply(f1,
        '<style jsx>{`',
        '<style>{`',
        "MasterAnalyzer:253 — remove jsx attr from <style>")
else:
    print(f"  ⚠️  File not found: {f1}")

# ─────────────────────────────────────────────────────────
# FILE 2: MultitrackV130.tsx — fix ref type + add 4th arg
# ─────────────────────────────────────────────────────────
f2 = REPO / "features/multitrack-v130/MultitrackV130.tsx"
print(f"\n{'='*60}")
print(f"FILE 2: {f2.name}")
print(f"{'='*60}")

if f2.exists():
    backup(f2)

    content = f2.read_text()

    # Error 2: audioGraphRef typed as useRef<null>(null) or useRef(null)
    # We cast assignment with (as any) so the ref accepts AudioGraph
    # Find the line: audioGraphRef.current = getAudioGraph();
    # and change to: audioGraphRef.current = getAudioGraph() as any;
    fixed2 = apply(f2,
        'audioGraphRef.current = getAudioGraph();',
        'audioGraphRef.current = getAudioGraph() as any;',
        "MultitrackV130:32 — cast getAudioGraph() to any for ref assignment")

    if not fixed2:
        # Maybe it already has `as any`, try alternative
        print(f"  ℹ️  Trying alternative pattern...")

    # Error 3: useV130PresentationRuntime called with 3 args — add audioGraphRef.current
    # Read current content after previous edit
    content = f2.read_text()

    # Try to find the call and add the 4th arg
    # Pattern from session summary: useV130PresentationRuntime(hostRef, viewport, canvasRegistry)
    # We need to detect what args it's called with and add audioGraphRef.current

    # Strategy: find the closing ) of the call and insert the 4th arg
    # The call should look like:
    # useV130PresentationRuntime(
    #   hostRef,
    #   viewport,
    #   canvasRegistry,
    # );
    # We need to add audioGraphRef.current as 4th arg

    import re

    # Look for the call pattern with 3 args (no audioGraph)
    patterns_to_try = [
        # Pattern A: single line call
        (r'useV130PresentationRuntime\(\s*(\w+),\s*(\w+),\s*(\w+)\s*\)',
         lambda m: f'useV130PresentationRuntime({m.group(1)}, {m.group(2)}, {m.group(3)}, audioGraphRef.current as any)'),
        # Pattern B: multiline with trailing comma before closing paren
        ('    canvasRegistry,\n  );\n',
         '    canvasRegistry,\n    audioGraphRef.current as any,\n  );\n'),
        # Pattern C: multiline without trailing comma
        ('    canvasRegistry\n  );\n',
         '    canvasRegistry,\n    audioGraphRef.current as any,\n  );\n'),
        # Pattern D: inline with other variable names
        ('  useV130PresentationRuntime(\n',
         None),  # Skip this one, handled by B/C
    ]

    found_arg_fix = False
    for pat, replacement in patterns_to_try[:3]:
        if replacement is None:
            continue
        if isinstance(pat, str):
            if pat in content:
                content = content.replace(pat, replacement, 1)
                f2.write_text(content)
                print(f"  ✅ FIXED [MultitrackV130:44 — added audioGraphRef.current as 4th arg]")
                found_arg_fix = True
                break
        else:
            new_content, n = re.subn(pat, replacement, content)
            if n > 0:
                f2.write_text(new_content)
                content = new_content
                print(f"  ✅ FIXED [MultitrackV130:44 — added audioGraphRef.current as 4th arg]")
                found_arg_fix = True
                break

    if not found_arg_fix:
        print(f"  ⚠️  SKIP [MultitrackV130:44] — couldn't find useV130PresentationRuntime call pattern")
        print(f"       Manual fix: add 'audioGraphRef.current as any' as 4th argument to the call")
else:
    print(f"  ⚠️  File not found: {f2}")

# ─────────────────────────────────────────────────────────
# FILE 3: useV130Analyzer.tsx — fix HISTBuffers + live type
# ─────────────────────────────────────────────────────────
f3 = REPO / "hooks/useV130Analyzer.tsx"
print(f"\n{'='*60}")
print(f"FILE 3: {f3.name}")
print(f"{'='*60}")

if f3.exists():
    backup(f3)

    # Error 4: HIST.current[key] where key includes 'spec' but HISTBuffers lacks it
    # Fix: cast to any on the indexing
    apply(f3,
        'const arr = HIST.current[key];',
        'const arr = (HIST.current as any)[key];',
        "useV130Analyzer:522 — cast HIST.current to any for indexing")

    # Errors 5+6: live is number|false|null, needs boolean
    # Two calls: spectrum2D(c, W, H, live) and phaseScope(c, W, H, live, d3)
    apply(f3,
        'spectrum2D(c, W, H, live)',
        'spectrum2D(c, W, H, !!live)',
        "useV130Analyzer:598 — coerce live to boolean with !!")

    apply(f3,
        'phaseScope(c, W, H, live, d3)',
        'phaseScope(c, W, H, !!live, d3)',
        "useV130Analyzer:600 — coerce live to boolean with !!")
else:
    print(f"  ⚠️  File not found: {f3}")

# ─────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("Run typecheck to verify:")
print("  cd /home/cloud/Projects/r3v4 && npm run typecheck")
print(f"{'='*60}\n")
