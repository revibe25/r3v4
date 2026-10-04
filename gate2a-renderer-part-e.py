#!/usr/bin/env python3
"""
GATE 2A STAGE 2 — Part E: Renderer syncDom & Effect Hook
Updates DOM sync to consume telemetry, replaces effect initialization and frame drawing.
"""
from pathlib import Path
import sys

NEW_SYNCD OM = """function syncDom(
  root: HTMLElement,
  telemetry: Readonly<AnalysisTelemetry>,
): void {
  const state =
    useDAWStore.getState();

  root
    .querySelectorAll<HTMLElement>('.trow')
    .forEach((row) => {
      const i =
        Number(row.dataset.i ?? -1);
      const track =
        state.tracks[i];

      if (!track) {
        return;
      }

      row.classList.toggle(
        'sel',
        track.id === state.selectedTrackId,
      );

      row.classList.toggle(
        'mute',
        track.mute,
      );

      row.classList.toggle(
        'solo',
        track.solo,
      );

      const arm =
        row.querySelector<HTMLElement>('.r');

      arm?.classList.toggle(
        'on',
        track.armed,
      );

      const meter =
        row.querySelector<HTMLElement>('.hm i');

      if (meter) {
        meter.style.transform =
          `scaleX(${Math.max(0.03, Math.min(1, track.gain))})`;
      }
    });

  root
    .querySelectorAll<HTMLElement>('.strip')
    .forEach((strip) => {
      const i =
        Number(strip.dataset.i ?? -1);

      const track =
        state.tracks[i];

      if (!track) {
        return;
      }

      strip.classList.toggle(
        'sel',
        track.id === state.selectedTrackId,
      );

      const meter =
        strip.querySelector<HTMLElement>('.vmet i');

      if (meter) {
        meter.style.transform =
          `scaleY(${Math.max(0.03, Math.min(1, track.gain))})`;
      }

      const fader =
        strip.querySelector<HTMLElement>('.fader i');

      if (fader) {
        fader.style.transform =
          `scaleY(${Math.max(0.03, Math.min(1, track.gain))})`;
      }
    });

  const saved =
    root.querySelector('#pSaved');

  if (saved) {
    saved.textContent =
      state.lastSavedAt
        ? new Date(state.lastSavedAt).toLocaleTimeString()
        : 'never';
  }

  const setReadout = (
    selector: string,
    value: string,
  ) => {
    const el = root.querySelector<HTMLElement>(selector);
    if (el) {
      el.textContent = value;
    }
  };

  if (!telemetry.active) {
    setReadout('#mOut', '—');
    setReadout('#sL', '—');
    setReadout('#sT', '—');
    setReadout('#sR', '—');
    setReadout('#sP', '—');
    setReadout('#sW', '—');
    setReadout('#sG', '—');
    setReadout('#mGR', '—');
    return;
  }

  const masterPeakDb =
    Math.max(
      telemetry.peakDbL,
      telemetry.peakDbR,
    );

  setReadout('#mOut', formatDb(masterPeakDb));
  setReadout('#sL', formatLufs(telemetry.integratedLufs));
  setReadout('#sT', formatDb(telemetry.truePeakDb));
  setReadout('#sR', formatDb(telemetry.rmsDb));
  setReadout('#sP', formatCorrelation(telemetry.correlation));
  setReadout('#sW', formatWidth(telemetry.stereoWidth));
  setReadout('#sG', formatDb(telemetry.gainReductionDb));
  setReadout('#mGR', formatDb(telemetry.gainReductionDb));
}"""

DRAWER_FUNCTIONS = """function drawAnalyzer(
  target: V130CanvasSurface,
  telemetry: Readonly<AnalysisTelemetry>,
  view: string,
  lufsHistory: number[],
  rmsHistory: number[],
  widthHistory: number[],
): void {
  const { ctx, w, h } = target;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  drawTelemetryGrid(target);

  switch (view) {
    case 'lufs':
      if (telemetry.active) {
        drawRealScalar(
          target,
          telemetry.momentaryLufs,
          -60,
          0,
          'MOMENTARY LUFS',
          lufsHistory,
        );
      }
      break;

    case 'phase':
      drawRealPhase(target, telemetry);
      break;

    case 'wid':
      if (telemetry.active) {
        drawRealScalar(
          target,
          telemetry.stereoWidth,
          0,
          200,
          'STEREO WIDTH %',
          widthHistory,
        );
      }
      break;

    case 'rms':
      if (telemetry.active) {
        drawRealScalar(
          target,
          telemetry.rmsDb,
          -72,
          0,
          'RMS dBFS',
          rmsHistory,
        );
      }
      break;

    case 'spec':
    default:
      drawRealSpectrum(target, telemetry);
      break;
  }

  ctx.fillStyle = '#7f98a1';
  ctx.font = '8px system-ui';

  if (view === 'spec') {
    ctx.fillText(
      telemetry.active ? 'LIVE SPECTRUM' : 'ANALYZER INACTIVE',
      20,
      13,
    );
  } else if (!telemetry.active) {
    ctx.fillText('ANALYZER INACTIVE', 20, 13);
  }
}

function drawMasterMeter(
  target: V130CanvasSurface,
  telemetry: Readonly<AnalysisTelemetry>,
): void {
  const { ctx, w, h } = target;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  const inset = 10;
  const gap = 7;
  const barWidth = Math.max(
    7,
    (w - inset * 2 - gap) / 2,
  );

  const y0 = h - 8;
  const available = Math.max(12, h - 16);

  const drawBar = (
    x: number,
    db: number,
    label: string,
  ) => {
    const level =
      telemetry.active
        ? Math.max(
            0,
            Math.min(1, (db + 60) / 60),
          )
        : 0;

    const y1 =
      y0 - level * available;

    const grad =
      ctx.createLinearGradient(
        0,
        y0,
        0,
        Math.max(8, y1),
      );

    grad.addColorStop(0, '#2ee6f2');
    grad.addColorStop(0.7, '#a4f422');
    grad.addColorStop(1, '#ff6257');

    ctx.fillStyle = grad;
    ctx.fillRect(
      x,
      Math.max(8, y1),
      barWidth,
      y0 - Math.max(8, y1),
    );

    ctx.strokeStyle = '#24343b';
    ctx.strokeRect(
      x - 1,
      8.5,
      barWidth + 2,
      Math.max(12, h - 17),
    );

    ctx.fillStyle = '#7f98a1';
    ctx.font = '8px system-ui';
    ctx.fillText(label, x, 8);
    ctx.fillText(
      telemetry.active ? db.toFixed(1) : '—',
      x,
      h - 1,
    );
  };

  drawBar(inset, telemetry.peakDbL, 'L');
  drawBar(inset + barWidth + gap, telemetry.peakDbR, 'R');

  ctx.strokeStyle = '#24343b';

  for (let i = 0; i <= 6; i++) {
    const y =
      10 +
      (i / 6) * Math.max(1, h - 20);

    ctx.fillRect(
      4,
      y,
      4,
      1,
    );
  }
}"""

EFFECT_INIT = """    ensureRoutingPane(root);
    ensureAnalysisTabs(root);
    ensureDspEditor(root);

    const lufsHistory: number[] = [];
    const rmsHistory: number[] = [];
    const widthHistory: number[] = [];

    syncDom(
      root,
      getV130AnalysisTelemetry(),
    );

    let raf = 0;
    let disposed = false;

    const frame = () => {"""

FRAME_DRAWS = """      const telemetry =
        getV130AnalysisTelemetry();

      if (analyzerSurface) {
        drawAnalyzer(
          analyzerSurface,
          telemetry,
          activeAnalysisTab(root),
          lufsHistory,
          rmsHistory,
          widthHistory,
        );
      }

      if (meterSurface) {
        drawMasterMeter(
          meterSurface,
          telemetry,
        );
      }

      syncDom(
        root,
        telemetry,
      );"""


def patch_syncd om(source: str) -> str:
    """Replace syncDom function signature and implementation."""
    
    old_start = "function syncDom(\n  root: HTMLElement,\n): void {"
    
    if old_start not in source:
        raise ValueError("syncDom anchor not found")
    
    # Find the old function body
    idx = source.find(old_start)
    next_func_idx = source.find("\nfunction ", idx + 1)
    
    if next_func_idx == -1:
        next_func_idx = source.find("\n// ─── ", idx + 1)
    
    if next_func_idx == -1:
        raise ValueError("Could not locate end of syncDom function")
    
    before = source[:idx]
    after = source[next_func_idx:]
    
    return before + NEW_SYNCD OM + after


def patch_drawers(source: str) -> str:
    """Replace drawAnalyzer and add drawMasterMeter."""
    
    old_start = "function drawAnalyzer("
    next_func_marker = "\nfunction ensureModes("
    
    if old_start not in source or next_func_marker not in source:
        raise ValueError("Drawer function anchor not found")
    
    idx = source.find(old_start)
    end_idx = source.find(next_func_marker, idx)
    
    before = source[:idx]
    after = source[end_idx:]
    
    return before + DRAWER_FUNCTIONS + after


def patch_effect_init(source: str) -> str:
    """Update effect hook initialization with telemetry history."""
    
    old_anchor = """    ensureRoutingPane(root);
    ensureAnalysisTabs(root);
    ensureDspEditor(root);
    syncDom(root);

    let raf = 0;
    let disposed = false;

    const frame = () => {"""
    
    if old_anchor not in source:
        raise ValueError("Effect initialization anchor not found")
    
    return source.replace(old_anchor, EFFECT_INIT, 1)


def patch_frame_draws(source: str) -> str:
    """Update frame drawing to use real telemetry."""
    
    old_anchor = """      if (analyzerSurface) {
        drawAnalyzer(
          analyzerSurface,
          state,
        );
      }

      if (meterSurface) {
        drawMasterMeter(
          meterSurface,
          state,
        );
      }

      syncDom(root);"""
    
    if old_anchor not in source:
        raise ValueError("Frame drawing anchor not found")
    
    return source.replace(old_anchor, FRAME_DRAWS, 1)


def main():
    if len(sys.argv) < 2:
        print("Usage: gate2a-renderer-part-e.py <path-to-useV130PresentationRuntime.ts>")
        sys.exit(1)
    
    renderer_path = Path(sys.argv[1])
    source = renderer_path.read_text(encoding="utf-8")
    
    print("[1/4] Patching syncDom signature and implementation...", flush=True)
    source = patch_syncd om(source)
    
    print("[2/4] Patching drawer functions...", flush=True)
    source = patch_drawers(source)
    
    print("[3/4] Patching effect hook initialization...", flush=True)
    source = patch_effect_init(source)
    
    print("[4/4] Patching frame drawing logic...", flush=True)
    source = patch_frame_draws(source)
    
    renderer_path.write_text(source, encoding="utf-8")
    print(f"✓ Patched: {renderer_path}")


if __name__ == "__main__":
    main()
