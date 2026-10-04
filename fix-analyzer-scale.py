#!/usr/bin/env python3
"""
Fix analyzer canvas (#cvA, #cvM) to use FULL resolution, not scaled by viewport.

Problem: backing() scales canvas by (devicePixelRatio * viewport.scale)
         viewport.scale ≈ 0.15, so canvas becomes 44x22 instead of 300x150

Solution: For analyzer canvases, use scale=1.0 instead of viewport.scale
          This makes them always render at full DOM resolution.
"""

from pathlib import Path
from datetime import datetime

FILE = Path("/home/cloud/Projects/r3v4/client/src/features/multitrack-v130/renderers/v130-canvas-registry.ts")

def backup():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = FILE.with_name(FILE.name + f".pre-analyzer-scale-{ts}")
    bak.write_text(FILE.read_text())
    print(f"📦 Backup: {bak.name}")

def apply_fix():
    content = FILE.read_text()
    
    # In sizeCanvases(), pass scale=1.0 for analyzer canvases (#cvA, #cvM)
    # instead of the viewport.scale which is much smaller
    
    old_loop = '''  sizeCanvases(
    scale: number,
  ): void {
    for (const surface of [
      ...this.surfaces,
    ]) {
      if (
        !surface.el.isConnected
      ) {
        this.surfaces.delete(
          surface,
        );
        continue;
      }

      // Update dimensions from current DOM layout (in case layout changed)
      surface.w = Math.max(1, Math.round(surface.el.clientWidth));
      surface.h = Math.max(1, Math.round(surface.el.clientHeight));

      this.backing(
        surface,
        scale,
      );
    }
  }'''

    new_loop = '''  sizeCanvases(
    scale: number,
  ): void {
    for (const surface of [
      ...this.surfaces,
    ]) {
      if (
        !surface.el.isConnected
      ) {
        this.surfaces.delete(
          surface,
        );
        continue;
      }

      // Update dimensions from current DOM layout (in case layout changed)
      surface.w = Math.max(1, Math.round(surface.el.clientWidth));
      surface.h = Math.max(1, Math.round(surface.el.clientHeight));

      // Analyzer canvases (#cvA, #cvM) should render at full DOM resolution
      // not scaled by viewport.scale (which can be very small like 0.15)
      const canvasScale = surface.el.id === 'cvA' || surface.el.id === 'cvM' ? 1.0 : scale;

      this.backing(
        surface,
        canvasScale,
      );
    }
  }'''

    if old_loop not in content:
        print("❌ Could not find sizeCanvases loop")
        return False

    new_content = content.replace(old_loop, new_loop, 1)
    FILE.write_text(new_content)
    print("✅ Analyzer canvases will use scale=1.0 (full resolution)")
    return True

def verify():
    content = FILE.read_text()
    checks = [
        ("surface.el.id === 'cvA'" in content, "✅ Checking for cvA canvas"),
        ("surface.el.id === 'cvM'" in content, "✅ Checking for cvM canvas"),
        ("const canvasScale = surface.el.id === 'cvA' || surface.el.id === 'cvM' ? 1.0 : scale" in content,
         "✅ Using full scale for analyzer, viewport scale for others"),
    ]
    for passed, msg in checks:
        print(msg if passed else msg.replace("✅", "❌"))
    return all(p for p, _ in checks)

print("="*70)
print("Fix Analyzer Canvas Scaling — Use Full Resolution Always")
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
        print("  # Analyzer canvas should now be 300x150!")
        print("="*70)
    else:
        print("\n⚠️  Verification failed")
else:
    print("\n❌ Fix failed")
