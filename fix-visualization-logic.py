#!/usr/bin/env python3
"""
Fix the frame loop to draw background grid ALWAYS, not just when telemetry exists.

Current (WRONG):
  if (analyzerSurface && telemetry) {
    drawSpectrumBackground(...)  // Hidden when offline!
    drawSpectrumBars(...)
  }

Correct (FIX):
  if (analyzerSurface) {
    drawSpectrumBackground(...)  // Always visible
  }
  if (analyzerSurface && telemetry) {
    drawSpectrumBars(...)        // Only with data
  }
"""

from pathlib import Path
from datetime import datetime

FILE = Path("/home/cloud/Projects/r3v4/client/src/features/multitrack-v130/renderers/useV130PresentationRuntime.ts")

def backup():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = FILE.with_name(FILE.name + f".pre-vis-logic-{ts}")
    bak.write_text(FILE.read_text())
    print(f"📦 Backup: {bak.name}")

def apply_fix():
    content = FILE.read_text()

    # The block that needs fixing (lines ~1937-1982)
    # We need to split it so background always draws
    
    old_block = '''      // ════════════════════════════════════════════════════════════════════════════════
      // ✨ STAGE 4A/4B: Update history buffers and draw active visualization
      // ════════════════════════════════════════════════════════════════════════════════
      if (analyzerSurface && telemetry) {
        // Update history buffers
        rmsBuffer.push(telemetry.rmsDb);
        lufsBuffer.push(telemetry.integratedLufs);
        correlationBuffer.push(telemetry.correlation);

        // Get active tab
        const activeTabButton = root.querySelector<HTMLElement>('#aTabs button[aria-pressed="true"]');
        const activeTab = activeTabButton?.dataset.k || 'spec';

        // Draw appropriate visualization based on active tab
        switch (activeTab) {
          case 'spec':
            drawSpectrumVisualization(analyzerSurface, telemetry);
            break;
          case 'lufs':
            drawLufsVisualization(analyzerSurface, lufsBuffer);
            break;
          case 'phase':
            drawPhaseVisualization(analyzerSurface, correlationBuffer);
            break;
          case 'wid':
            drawStereoVisualization(analyzerSurface, telemetry.stereoWidth);
            break;
          case 'rms':
            drawRmsVisualization(analyzerSurface, rmsBuffer);
            break;
          default:
            drawSpectrumVisualization(analyzerSurface, telemetry);
        }
      }'''

    new_block = '''      // ════════════════════════════════════════════════════════════════════════════════
      // ✨ STAGE 4A/4B: Draw background grid ALWAYS (even offline)
      // ════════════════════════════════════════════════════════════════════════════════
      if (analyzerSurface) {
        // Always draw background + grid (visible even without audio)
        drawSpectrumBackground(analyzerSurface);
      }

      // ════════════════════════════════════════════════════════════════════════════════
      // ✨ STAGE 4A/4B: Update history buffers and draw live data
      // ════════════════════════════════════════════════════════════════════════════════
      if (analyzerSurface && telemetry) {
        // Update history buffers
        rmsBuffer.push(telemetry.rmsDb);
        lufsBuffer.push(telemetry.integratedLufs);
        correlationBuffer.push(telemetry.correlation);

        // Get active tab
        const activeTabButton = root.querySelector<HTMLElement>('#aTabs button[aria-pressed="true"]');
        const activeTab = activeTabButton?.dataset.k || 'spec';

        // Draw appropriate visualization based on active tab
        switch (activeTab) {
          case 'spec':
            drawSpectrumBars(analyzerSurface, telemetry);  // Changed to only draw bars
            break;
          case 'lufs':
            drawLufsVisualization(analyzerSurface, lufsBuffer);
            break;
          case 'phase':
            drawPhaseVisualization(analyzerSurface, correlationBuffer);
            break;
          case 'wid':
            drawStereoVisualization(analyzerSurface, telemetry.stereoWidth);
            break;
          case 'rms':
            drawRmsVisualization(analyzerSurface, rmsBuffer);
            break;
          default:
            drawSpectrumBars(analyzerSurface, telemetry);  // Changed to only draw bars
        }
      }'''

    if old_block not in content:
        print("❌ Could not find the visualization block")
        print("\nTrying to find it...")
        if 'drawSpectrumBackground(analyzerSurface)' in content:
            print("⚠️  Background is already being called separately")
            print("    The fix may already be partially applied")
            return False
        return False

    new_content = content.replace(old_block, new_block, 1)
    FILE.write_text(new_content)
    print("✅ Split visualization: background always draws, bars only with telemetry")
    return True

def verify():
    content = FILE.read_text()
    checks = [
        ('if (analyzerSurface)' in content and 'drawSpectrumBackground(analyzerSurface)' in content,
         "✅ drawSpectrumBackground() called unconditionally"),
        ('drawSpectrumBars(analyzerSurface, telemetry)' in content,
         "✅ drawSpectrumBars() called only with telemetry"),
        ('if (analyzerSurface && telemetry)' in content,
         "✅ Telemetry visualizations guarded by telemetry check"),
    ]
    
    for passed, msg in checks:
        print(msg if passed else msg.replace("✅", "❌"))
    
    return all(p for p, _ in checks)

print("="*70)
print("Fix Visualization Logic — Always Draw Background Grid")
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
        print("  # Master Analyzer grid should show immediately!")
        print("="*70)
    else:
        print("\n⚠️  Verification failed")
else:
    print("\n❌ Fix failed — could not find the code block")
