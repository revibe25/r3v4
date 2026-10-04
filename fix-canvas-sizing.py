#!/usr/bin/env python3
"""
Fix canvas registry sizing — always read from DOM, never cache small values.

Problem: Canvas.w and Canvas.h are locked to 44x22 from initial registration.
Solution: In sizeCanvases(), read current clientWidth/clientHeight from DOM.
"""

from pathlib import Path
from datetime import datetime

FILE = Path("/home/cloud/Projects/r3v4/client/src/features/multitrack-v130/renderers/v130-canvas-registry.ts")

def backup():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = FILE.with_name(FILE.name + f".pre-size-fix-{ts}")
    bak.write_text(FILE.read_text())
    print(f"📦 Backup: {bak.name}")

def apply_fix():
    content = FILE.read_text()
    
    # In sizeCanvases(), update surface.w and surface.h from DOM before using them
    old_method = '''  sizeCanvases(
    scale: number,
  ): void {
    for (const surface of ['''

    new_method = '''  sizeCanvases(
    scale: number,
  ): void {
    for (const surface of ['''

    # Find the actual sizeCanvases method and the loop inside it
    # We need to add: update w and h from DOM before scaling
    
    # Strategy: find the part where it calls this.backing() and update w/h just before
    old_backing_call = '''    this.backing(
      surface,
      scale,
    );'''

    new_backing_call = '''    // Update dimensions from current DOM layout (in case layout changed)
    surface.w = Math.max(1, Math.round(surface.el.clientWidth));
    surface.h = Math.max(1, Math.round(surface.el.clientHeight));

    this.backing(
      surface,
      scale,
    );'''

    if old_backing_call not in content:
        print("❌ Could not find backing call")
        return False

    new_content = content.replace(old_backing_call, new_backing_call, 1)
    FILE.write_text(new_content)
    print("✅ Updated sizeCanvases() to read current DOM dimensions")
    return True

def verify():
    content = FILE.read_text()
    checks = [
        ('surface.w = Math.max(1, Math.round(surface.el.clientWidth))' in content,
         "✅ Reading clientWidth from DOM"),
        ('surface.h = Math.max(1, Math.round(surface.el.clientHeight))' in content,
         "✅ Reading clientHeight from DOM"),
    ]
    for passed, msg in checks:
        print(msg if passed else msg.replace("✅", "❌"))
    return all(p for p, _ in checks)

print("="*70)
print("Fix Canvas Registry Sizing — Read Current DOM Dimensions")
print("="*70)
print()

backup()
if apply_fix():
    print()
    if verify():
        print()
        print("="*70)
        print("✅ Fix applied!")
        print()
        print("Now:")
        print("  npm run typecheck")
        print("  # Hard refresh: Ctrl+Shift+R")
        print("  # Canvas should now be 300x150 instead of 44x22!")
        print("="*70)
    else:
        print("\n⚠️  Verification failed")
else:
    print("\n❌ Fix failed")
