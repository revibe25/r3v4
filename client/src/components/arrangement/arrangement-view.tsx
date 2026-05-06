import { useRef, useEffect, useState, useCallback } from "react";
import type { ArrangementTrack, ArrangementMarker, Region } from "../../../../shared/arrangement.types";
import { DEFAULT_TRACK_COLORS } from "../../../../shared/arrangement.types";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0",
  grid: "rgba(255,255,255,0.04)", font: "monospace",
} as const;

const HEADER_W = 160;
const RULER_H  = 28;
const TRACK_H  = 56;
const PX_PER_BAR = 80;

export interface ArrangementViewProps {
  tracks?: ArrangementTrack[];
  markers?: ArrangementMarker[];
  playhead?: number;
  loopStart?: number;
  loopEnd?: number;
  loopEnabled?: boolean;
  totalBars?: number;
  onPlayheadChange?: (bar: number) => void;
  onTrackSelect?: (id: string) => void;
  selectedTrackId?: string;
}

function drawRuler(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scroll: number, bars: number, pxPerBar: number,
) {
  ctx.fillStyle = T.panel;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); ctx.stroke();

  ctx.font = `8px ${T.font}`;
  ctx.fillStyle = T.dim;
  const startBar = Math.floor(scroll / pxPerBar);
  const endBar   = Math.ceil((scroll + w) / pxPerBar);
  for (let bar = startBar; bar <= Math.min(endBar, bars); bar++) {
    const x = bar * pxPerBar - scroll;
    ctx.strokeStyle = bar % 4 === 0 ? T.dim : T.border;
    ctx.lineWidth = bar % 4 === 0 ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(x, h * 0.5); ctx.lineTo(x, h); ctx.stroke();
    if (bar % 4 === 0) {
      ctx.fillStyle = T.text;
      ctx.fillText(String(bar + 1), x + 3, h - 6);
    }
  }
}

function drawTracks(
  ctx: CanvasRenderingContext2D,
  tracks: ArrangementTrack[],
  scroll: number, scrollY: number,
  w: number, pxPerBar: number,
  selectedId: string | undefined,
) {
  tracks.forEach((track, ti) => {
    const y = ti * TRACK_H - scrollY;
    if (y + TRACK_H < 0 || y > ctx.canvas.height) return;

    // track background
    ctx.fillStyle = selectedId === track.id
      ? "rgba(184,255,0,0.04)" : (ti % 2 === 0 ? T.bg : T.panel);
    ctx.fillRect(0, y, w, TRACK_H);
    // bottom border
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y + TRACK_H - 0.5);
    ctx.lineTo(w, y + TRACK_H - 0.5); ctx.stroke();

    // regions
    track.regions.forEach(region => {
      const rx   = region.startBar * pxPerBar - scroll;
      const rw   = region.length * pxPerBar;
      const ry   = y + 4;
      const rh   = TRACK_H - 8;
      if (rx + rw < 0 || rx > w) return;

      // region background
      ctx.fillStyle = track.muted
        ? "rgba(100,100,100,0.2)"
        : `${track.color}22`;
      ctx.fillRect(rx, ry, rw, rh);
      // region border
      ctx.strokeStyle = track.muted ? T.dim : track.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      // region label
      ctx.fillStyle = track.muted ? T.dim : track.color;
      ctx.font = `7px ${T.font}`;
      ctx.fillText(region.name.slice(0, 12), rx + 4, ry + 11);
      // waveform placeholder
      ctx.strokeStyle = `${track.color}44`;
      ctx.lineWidth = 0.5;
      const mid = ry + rh / 2;
      for (let px = rx + 4; px < rx + rw - 4; px += 3) {
        const amp = (Math.sin(px * 0.3) * 0.4 + Math.random() * 0.3) * (rh * 0.35);
        ctx.beginPath(); ctx.moveTo(px, mid - amp); ctx.lineTo(px, mid + amp); ctx.stroke();
      }
    });

    // grid lines
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 0.5;
    const startB = Math.floor(scroll / pxPerBar);
    const endB   = Math.ceil((scroll + w) / pxPerBar);
    for (let b = startB; b <= endB; b++) {
      const x = b * pxPerBar - scroll;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + TRACK_H); ctx.stroke();
    }
  });
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D, h: number,
  playhead: number, scroll: number, pxPerBar: number,
) {
  const x = playhead * pxPerBar - scroll;
  if (x < 0 || x > ctx.canvas.width) return;
  ctx.strokeStyle = T.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  // triangle
  ctx.fillStyle = T.accent;
  ctx.beginPath(); ctx.moveTo(x - 5, 0); ctx.lineTo(x + 5, 0);
  ctx.lineTo(x, 8); ctx.closePath(); ctx.fill();
}

export function ArrangementView({
  tracks = [], markers = [], playhead = 0,
  loopStart, loopEnd, loopEnabled = false, totalBars = 64,
  onPlayheadChange, onTrackSelect, selectedTrackId,
}: ArrangementViewProps) {
  const rulerRef  = useRef<HTMLCanvasElement>(null);
  const tracksRef = useRef<HTMLCanvasElement>(null);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [pxPerBar, setPxPerBar] = useState(PX_PER_BAR);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const draw = useCallback(() => {
    const rCanvas = rulerRef.current;
    const tCanvas = tracksRef.current;
    if (!rCanvas || !tCanvas) return;
    const rCtx = rCanvas.getContext("2d");
    const tCtx = tCanvas.getContext("2d");
    if (!rCtx || !tCtx) return;

    const cw = size.w - HEADER_W;
    rCanvas.width = cw; rCanvas.height = RULER_H;
    tCanvas.width = cw; tCanvas.height = size.h - RULER_H;
    tCtx.clearRect(0, 0, cw, tCanvas.height);

    // loop region
    if (loopEnabled && loopStart !== undefined && loopEnd !== undefined) {
      const lx = loopStart * pxPerBar - scrollX;
      const lw = (loopEnd - loopStart) * pxPerBar;
      tCtx.fillStyle = "rgba(184,255,0,0.06)";
      tCtx.fillRect(lx, 0, lw, tCanvas.height);
    }

    drawRuler(rCtx, cw, RULER_H, scrollX, totalBars, pxPerBar);
    drawTracks(tCtx, tracks, scrollX, scrollY, cw, pxPerBar, selectedTrackId);

    // markers
    markers.forEach(m => {
      const mx = m.position * pxPerBar - scrollX;
      rCtx.fillStyle = m.color;
      rCtx.fillRect(mx - 1, 0, 2, RULER_H);
      rCtx.font = `7px ${T.font}`;
      rCtx.fillText(m.name, mx + 3, 10);
    });

    drawPlayhead(rCtx, RULER_H, playhead, scrollX, pxPerBar);
    drawPlayhead(tCtx, tCanvas.height, playhead, scrollX, pxPerBar);
  }, [tracks, markers, playhead, scrollX, scrollY, pxPerBar, size,
      loopStart, loopEnd, loopEnabled, totalBars, selectedTrackId]);

  useEffect(() => { draw(); }, [draw]);

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const bar = Math.max(0, x / pxPerBar);
    onPlayheadChange?.(bar);
  }, [scrollX, pxPerBar, onPlayheadChange]);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + scrollY;
    const idx = Math.floor(y / TRACK_H);
    if (idx >= 0 && idx < tracks.length) onTrackSelect?.(tracks[idx].id);
  }, [scrollY, tracks, onTrackSelect]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setPxPerBar(p => Math.max(20, Math.min(200, p - e.deltaY * 0.5)));
    } else if (e.shiftKey) {
      setScrollX(p => Math.max(0, p + e.deltaY));
    } else {
      setScrollY(p => Math.max(0, p + e.deltaY));
    }
  }, []);

  const totalW = totalBars * pxPerBar;
  const totalH = tracks.length * TRACK_H;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column",
      flex: 1, overflow: "hidden", background: T.bg }}>
      {/* Ruler row */}
      <div style={{ display: "flex", height: RULER_H, flexShrink: 0 }}>
        <div style={{
          width: HEADER_W, background: T.panel,
          borderRight: `1px solid ${T.border}`,
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center",
          padding: "0 8px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 7, letterSpacing: ".15em", color: T.dim,
            fontFamily: T.font, textTransform: "uppercase" }}>
            Arrangement
          </span>
        </div>
        <canvas ref={rulerRef}
          onClick={handleRulerClick}
          style={{ flex: 1, cursor: "col-resize" }} />
      </div>

      {/* Tracks area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}
        onWheel={handleWheel}>
        {/* Header column */}
        <div style={{
          width: HEADER_W, flexShrink: 0, overflowY: "hidden",
          borderRight: `1px solid ${T.border}`, background: T.panel,
        }}>
          {tracks.map((track, i) => (
            <div
              key={track.id}
              onClick={() => onTrackSelect?.(track.id)}
              style={{
                height: TRACK_H,
                borderBottom: `1px solid ${T.border}`,
                padding: "4px 8px",
                background: selectedTrackId === track.id
                  ? "rgba(184,255,0,0.06)" : "transparent",
                cursor: "pointer",
                display: "flex", flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, background: track.color,
                  borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: T.text, fontFamily: T.font,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                {(["M", "S", "R"] as const).map((btn, bi) => {
                  const active = bi === 0 ? track.muted : bi === 1 ? track.soloed : track.armed;
                  const color  = bi === 0 ? "#ffb300" : bi === 1 ? "#00e5ff" : "#ff3b3b";
                  return (
                    <button key={btn} style={{
                      width: 16, height: 14, fontSize: 6, fontFamily: T.font,
                      background: active ? color : "transparent",
                      border: `1px solid ${active ? color : T.border}`,
                      color: active ? "#000" : T.dim, cursor: "pointer",
                    }}>
                      {btn}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Canvas */}
        <canvas ref={tracksRef}
          onClick={handleTrackClick}
          style={{ flex: 1, cursor: "default" }} />
      </div>

      {/* Zoom / Scroll bar */}
      <div style={{
        height: 20, display: "flex", alignItems: "center",
        gap: 8, padding: "0 10px", borderTop: `1px solid ${T.border}`,
        background: T.panel,
      }}>
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>ZOOM</span>
        <input type="range" min={20} max={200} value={pxPerBar}
          onChange={e => setPxPerBar(parseInt(e.target.value))}
          style={{ width: 80, accentColor: T.accent, cursor: "pointer" }} />
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>
          {pxPerBar}px/bar
        </span>
        <div style={{ flex: 1 }} />
        <input type="range" min={0} max={Math.max(0, totalW - (size.w - HEADER_W))}
          value={scrollX}
          onChange={e => setScrollX(parseInt(e.target.value))}
          style={{ width: 120, accentColor: T.accent, cursor: "pointer" }} />
      </div>
    </div>
  );
}
