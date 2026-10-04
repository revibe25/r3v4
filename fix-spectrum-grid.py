#!/usr/bin/env python3
"""
Split drawSpectrumVisualization to draw background grid unconditionally,
and only draw spectrum bars when telemetry exists.

This allows the Master Analyzer to show the dB scale grid even when the
audio engine is offline.
"""

from pathlib import Path
from datetime import datetime

FILE = Path("/home/cloud/Projects/r3v4/client/src/features/multitrack-v130/renderers/useV130PresentationRuntime.ts")

def backup():
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = FILE.with_name(FILE.name + f".pre-spectrum-split-{ts}")
    bak.write_text(FILE.read_text())
    print(f"📦 Backup: {bak.name}")

def apply_fix():
    content = FILE.read_text()
    
    # Split the original function into two
    old_function = '''function drawSpectrumVisualization(
  target: V130CanvasSurface,
  telemetry: AnalysisTelemetry,
): void {
  const { ctx, w, h } = target;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  if (!telemetry.spectrum || telemetry.spectrum.length === 0) {
    return;
  }

  const spectrum = telemetry.spectrum;
  const binCount = spectrum.length;

  // Draw grid
  for (let i = 0; i < 7; i++) {
    const y = 8 + (i / 6) * Math.max(10, h - 18);
    ctx.strokeStyle = '#122027';
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (let i = 0; i < 9; i++) {
    const x = 18 + (i / 8) * Math.max(1, w - 24);
    ctx.strokeStyle = '#0e181d';
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, h - 6);
    ctx.stroke();
  }

  // Draw spectrum bars (logarithmic frequency scaling)
  ctx.fillStyle = '#2ee6f2';
  const barWidth = Math.max(1, (w - 24) / 32);

  for (let i = 0; i < 32; i++) {
    const binIndex = Math.floor((i / 32) * binCount);
    const level = Math.min(1, spectrum[binIndex] / 255);
    const barHeight = level * (h - 18);
    const x = 18 + i * barWidth;
    const y = h - 6 - barHeight;

    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }

  // Draw frequency labels
  ctx.fillStyle = '#7f98a1';
  ctx.font = '9px system-ui';
  for (const [i, label] of ['50', '100', '200', '500', '1k', '2k', '5k', '10k'].entries()) {
    ctx.fillText(label, 22 + (i / 7) * Math.max(1, w - 42), h - 3);
  }
}'''

    new_function = '''// Draw spectrum background grid (always)
function drawSpectrumBackground(
  target: V130CanvasSurface,
): void {
  const { ctx, w, h } = target;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  // Draw grid
  for (let i = 0; i < 7; i++) {
    const y = 8 + (i / 6) * Math.max(10, h - 18);
    ctx.strokeStyle = '#122027';
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (let i = 0; i < 9; i++) {
    const x = 18 + (i / 8) * Math.max(1, w - 24);
    ctx.strokeStyle = '#0e181d';
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, h - 6);
    ctx.stroke();
  }

  // Draw frequency labels
  ctx.fillStyle = '#7f98a1';
  ctx.font = '9px system-ui';
  for (const [i, label] of ['50', '100', '200', '500', '1k', '2k', '5k', '10k'].entries()) {
    ctx.fillText(label, 22 + (i / 7) * Math.max(1, w - 42), h - 3);
  }
}

// Draw spectrum bars (only when data available)
function drawSpectrumBars(
  target: V130CanvasSurface,
  telemetry: AnalysisTelemetry,
): void {
  const { ctx, w, h } = target;

  if (!telemetry.spectrum || telemetry.spectrum.length === 0) {
    return;
  }

  const spectrum = telemetry.spectrum;
  const binCount = spectrum.length;

  ctx.fillStyle = '#2ee6f2';
  const barWidth = Math.max(1, (w - 24) / 32);

  for (let i = 0; i < 32; i++) {
    const binIndex = Math.floor((i / 32) * binCount);
    const level = Math.min(1, spectrum[binIndex] / 255);
    const barHeight = level * (h - 18);
    const x = 18 + i * barWidth;
    const y = h - 6 - barHeight;

    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}

function drawSpectrumVisualization(
  target: V130CanvasSurface,
  telemetry: AnalysisTelemetry,
): void {
  drawSpectrumBackground(target);
  drawSpectrumBars(target, telemetry);
}'''

    if old_function not in content:
        print("❌ Could not find drawSpectrumVisualization function")
        return False

    new_content = content.replace(old_function, new_function, 1)
    FILE.write_text(new_content)
    print("✅ Split drawSpectrumVisualization into background + bars")
    return True

def verify():
    content = FILE.read_text()
    checks = [
        ('drawSpectrumBackground' in content, "✅ drawSpectrumBackground created"),
        ('drawSpectrumBars' in content, "✅ drawSpectrumBars created"),
        ('ctx.clearRect(0, 0, w, h);' in content, "✅ Clear rect preserved"),
    ]
    for passed, msg in checks:
        print(msg if passed else msg.replace("✅", "❌"))
    return all(p for p, _ in checks)

print("="*70)
print("Split Spectrum Visualization — Draw Grid Unconditionally")
print("="*70)
print()

backup()
if apply_fix() and verify():
    print()
    print("="*70)
    print("✅ Fix applied!")
    print()
    print("Now run:")
    print("  npm run typecheck")
    print("  # Hard refresh browser: Ctrl+Shift+R")
    print("  # Navigate to /multitrack")
    print("  # Master Analyzer grid should now show even offline!")
    print("="*70)
else:
    print("\n❌ Fix failed")
