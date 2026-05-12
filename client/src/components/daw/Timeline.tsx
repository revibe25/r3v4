import { useRef, useEffect, useState, useCallback } from "react";
import {
  useDAWStore, useView, useTransport, useTracks, useMarkers, useSelection,
  type SnapValue,
} from "@/state/dawStore";
import type { ArrangementTrack, Region } from "../../../../shared/arrangement.types";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c", accent: "#b8ff00",
  dim: "#444", text: "#f0f0f0", grid: "rgba(255,255,255,0.03)",
  loop: "rgba(184,255,0,0.06)", font: "monospace",
} as const;

const HEADER_W = 168;
const RULER_H  = 28;
const TRACK_H  = 64;
const MIN_REGION_W = 4;

// ── Snap helper ───────────────────────────────────────────────────────────────
const SNAP_MAP: Record<SnapValue, number> = {
  "1": 1, "1/2": 0.5, "1/4": 0.25, "1/8": 0.125,
  "1/16": 0.0625, "1/32": 0.03125, "off": 0,
};

function snapBar(bar: number, snap: SnapValue): number {
  const s = SNAP_MAP[snap];
  if (!s) return bar;
  return Math.round(bar / s) * s;
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────
function drawRuler(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scrollX: number, pxPerBar: number, tempo: number,
  loopStart: number, loopEnd: number, isLooping: boolean,
) {
  ctx.fillStyle = T.panel;
  ctx.fillRect(0, 0, w, h);

  // Loop region
  if (isLooping) {
    ctx.fillStyle = T.loop;
    ctx.fillRect(loopStart * pxPerBar - scrollX, 0, (loopEnd - loopStart) * pxPerBar, h);
  }

  const firstBar = Math.floor(scrollX / pxPerBar);
  const lastBar  = Math.ceil((scrollX + w) / pxPerBar) + 1;

  for (let bar = firstBar; bar <= lastBar; bar++) {
    const x = bar * pxPerBar - scrollX;
    const isMajor = bar % 4 === 0;
    ctx.strokeStyle = isMajor ? T.dim : T.border;
    ctx.lineWidth   = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 0 : h * 0.55);
    ctx.lineTo(x, h);
    ctx.stroke();
    if (isMajor) {
      ctx.fillStyle = T.text;
      ctx.font = `700 9px ${T.font}`;
      ctx.fillText(String(bar + 1), x + 3, h - 5);
    }
  }

  ctx.strokeStyle = T.border;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); ctx.stroke();
}

function drawTracks(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  tracks: ArrangementTrack[], selectedIds: string[],
  scrollX: number, scrollY: number, pxPerBar: number,
  selectedTrackId: string | null,
) {
  ctx.clearRect(0, 0, w, h);

  tracks.forEach((track, ti) => {
    const y = ti * TRACK_H - scrollY;
    if (y + TRACK_H < 0 || y > h) return;

    // Track background
    ctx.fillStyle = selectedTrackId === track.id
      ? "rgba(184,255,0,0.03)" : ti % 2 === 0 ? T.bg : "#070707";
    ctx.fillRect(0, y, w, TRACK_H);

    // Grid lines
    const fb = Math.floor(scrollX / pxPerBar);
    const lb = Math.ceil((scrollX + w) / pxPerBar) + 1;
    for (let b = fb; b <= lb; b++) {
      const x = b * pxPerBar - scrollX;
      ctx.strokeStyle = b % 4 === 0 ? "rgba(255,255,255,0.04)" : T.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + TRACK_H); ctx.stroke();
    }

    // Track bottom border
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y + TRACK_H - 0.5); ctx.lineTo(w, y + TRACK_H - 0.5); ctx.stroke();

    // Regions
    track.regions.forEach(region => {
      const rx = region.startBar * pxPerBar - scrollX;
      const rw = Math.max(MIN_REGION_W, region.length * pxPerBar);
      const ry = y + 3;
      const rh = TRACK_H - 6;
      if (rx + rw < 0 || rx > w) return;

      const isSelected = selectedIds.includes(region.id);
      const alpha = track.muted ? 0.3 : 1;

      // Region fill
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isSelected ? `${track.color}33` : `${track.color}18`;
      ctx.fillRect(rx, ry, rw, rh);

      // Region border
      ctx.strokeStyle = isSelected ? track.color : `${track.color}88`;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);

      // Waveform lines (visual noise simulation)
      ctx.strokeStyle = `${track.color}55`;
      ctx.lineWidth = 0.5;
      const mid = ry + rh / 2;
      const seed = region.id.charCodeAt(0);
      for (let px = rx + 4; px < rx + rw - 4; px += 2) {
        const amp = Math.abs(Math.sin(px * 0.47 + seed) * 0.6 + Math.sin(px * 0.13) * 0.3) * rh * 0.38;
        ctx.beginPath(); ctx.moveTo(px, mid - amp); ctx.lineTo(px, mid + amp); ctx.stroke();
      }

      // Region label
      ctx.fillStyle = isSelected ? track.color : `${track.color}cc`;
      ctx.font = `600 8px ${T.font}`;
      ctx.fillText(region.name.slice(0, 16), rx + 5, ry + 11);
      ctx.globalAlpha = 1;
    });
  });
}

function drawPlayhead(ctx: CanvasRenderingContext2D, h: number, bar: number, scrollX: number, pxPerBar: number) {
  const x = bar * pxPerBar - scrollX;
  if (x < -2 || x > ctx.canvas.width + 2) return;
  ctx.strokeStyle = T.accent;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = T.accent;
  ctx.shadowBlur  = 6;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = T.accent;
  ctx.beginPath(); ctx.moveTo(x - 5, 0); ctx.lineTo(x + 5, 0); ctx.lineTo(x, 7); ctx.closePath(); ctx.fill();
}

// ── Main component ────────────────────────────────────────────────────────────

interface DragState {
  type:     "region" | "playhead" | "resize";
  regionId: string;
  trackId:  string;
  startMouseX: number;
  startBar:    number;
  originalBar: number;
  originalLen: number;
}

export function Timeline() {
  const tracks      = useTracks();
  const { isPlaying, isLooping, currentBar, loopStart, loopEnd, tempo, timeSignature } = useTransport();
  const { pxPerBar, scrollX, scrollY, snap, tool, showAutomation } = useView();
  const { trackId: selectedTrackId, regionIds: selectedRegionIds } = useSelection();
  const markers     = useMarkers();
  const store       = useDAWStore();

  const rulerRef    = useRef<HTMLCanvasElement>(null);
  const tracksRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const dragRef = useRef<DragState | null>(null);

  // Track container size
  useEffect(() => {
    const obs = new ResizeObserver(e => {
      if (e[0]) setSize({ w: e[0].contentRect.width, h: e[0].contentRect.height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const gridW = size.w - HEADER_W;
  const gridH = size.h - RULER_H;

  // Draw
  useEffect(() => {
    const rc = rulerRef.current;
    const tc = tracksRef.current;
    if (!rc || !tc) return;
    rc.width = gridW; rc.height = RULER_H;
    tc.width = gridW; tc.height = gridH;
    const rCtx = rc.getContext("2d");
    const tCtx = tc.getContext("2d");
    if (!rCtx || !tCtx) return;

    drawRuler(rCtx, gridW, RULER_H, scrollX, pxPerBar, tempo, loopStart, loopEnd, isLooping);
    drawTracks(tCtx, gridW, gridH, tracks, selectedRegionIds, scrollX, scrollY, pxPerBar, selectedTrackId);

    // Markers on ruler
    markers.forEach(m => {
      const x = m.position * pxPerBar - scrollX;
      if (x < 0 || x > gridW) return;
      rCtx.fillStyle = m.color;
      rCtx.fillRect(x - 1, 0, 2, RULER_H);
      rCtx.font = `7px ${T.font}`;
      rCtx.fillStyle = m.color;
      rCtx.fillText(m.name.slice(0, 8), x + 3, 10);
    });

    drawPlayhead(rCtx, RULER_H, currentBar - 1, scrollX, pxPerBar);
    drawPlayhead(tCtx, gridH,   currentBar - 1, scrollX, pxPerBar);
  }, [tracks, selectedRegionIds, selectedTrackId, markers, currentBar,
      scrollX, scrollY, pxPerBar, size, gridW, gridH,
      isLooping, loopStart, loopEnd, tempo]);

  // ── Interaction helpers ────────────────────────────────────────────────────
  const xToBar = useCallback((clientX: number, canvasRect: DOMRect) => {
    return (clientX - canvasRect.left + scrollX) / pxPerBar;
  }, [scrollX, pxPerBar]);

  const yToTrack = useCallback((clientY: number, canvasRect: DOMRect): ArrangementTrack | null => {
    const y = clientY - canvasRect.top + scrollY;
    const idx = Math.floor(y / TRACK_H);
    return tracks[idx] ?? null;
  }, [tracks, scrollY]);

  const regionAtPoint = useCallback((bar: number, track: ArrangementTrack): Region | null => {
    return track.regions.find(r => bar >= r.startBar && bar <= r.startBar + r.length) ?? null;
  }, []);

  // ── Ruler click → seek ─────────────────────────────────────────────────────
  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const bar = snapBar(xToBar(e.clientX, e.currentTarget.getBoundingClientRect()), snap);
    store.seekTo(Math.max(1, bar));
  }, [xToBar, snap, store]);

  // ── Track canvas interaction ───────────────────────────────────────────────
  const handleTrackMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const bar   = xToBar(e.clientX, rect);
    const track = yToTrack(e.clientY, rect);
    if (!track) return;

    store.selectTrack(track.id);

    if (tool === "select") {
      const region = regionAtPoint(bar, track);
      if (region) {
        store.selectRegions([region.id]);
        dragRef.current = {
          type: "region", regionId: region.id, trackId: track.id,
          startMouseX: e.clientX, startBar: region.startBar,
          originalBar: region.startBar, originalLen: region.length,
        };
      } else {
        store.selectRegions([]);
      }
    } else if (tool === "draw") {
      const snapped = snapBar(bar, snap);
      store.addRegion(track.id, {
        trackId: track.id,
        name: `${track.name} ${track.regions.length + 1}`,
        startBar: snapped,
        length: SNAP_MAP[snap] || 1,
        muted: false, reversed: false,
        gain: 1, fadeIn: 0, fadeOut: 0,
        offset: 0, audioFileId: "", color: track.color,
      } as any);
    } else if (tool === "erase") {
      const region = regionAtPoint(bar, track);
      if (region) store.removeRegion(track.id, region.id);
    } else if (tool === "cut") {
      const region = regionAtPoint(bar, track);
      if (region) store.splitRegion(region.id, snapBar(bar, snap));
    }
  }, [tool, xToBar, yToTrack, regionAtPoint, snap, store]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.type !== "region") return;
    const tc = tracksRef.current;
    if (!tc) return;
    const rect  = tc.getBoundingClientRect();
    const delta = (e.clientX - drag.startMouseX) / pxPerBar;
    const newBar = snapBar(drag.originalBar + delta, snap);
    const track  = yToTrack(e.clientY, rect);
    if (newBar >= 0) {
      store.moveRegion(drag.regionId, track?.id ?? drag.trackId, Math.max(0, newBar));
    }
  }, [pxPerBar, snap, yToTrack, store]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup",   handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup",   handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Wheel → scroll / zoom ──────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      store.setZoom(pxPerBar * (e.deltaY < 0 ? 1.15 : 0.87));
    } else if (e.shiftKey) {
      store.setScroll(scrollX + e.deltaY * 1.5, scrollY);
    } else {
      store.setScroll(scrollX, scrollY + e.deltaY);
    }
  }, [pxPerBar, scrollX, scrollY, store]);

  // ── Track header ───────────────────────────────────────────────────────────
  const TrackHeader = ({ track }: { track: ArrangementTrack }) => {
    const ch = useDAWStore(s => s.mixer[track.id]);
    if (!ch) return null;
    return (
      <div onClick={() => store.selectTrack(track.id)} style={{
        height: TRACK_H, borderBottom: `1px solid ${T.border}`,
        padding: "4px 8px", cursor: "pointer", display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        background: selectedTrackId === track.id ? "rgba(184,255,0,0.04)" : "transparent",
        borderLeft: `2px solid ${selectedTrackId === track.id ? track.color : "transparent"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, background: track.color, borderRadius: "50%", flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: T.text, fontFamily: T.font, flex: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {(["M","S","R"] as const).map((lbl, i) => {
            const active  = i === 0 ? ch.muted : i === 1 ? ch.soloed : ch.armed;
            const color   = i === 0 ? "#ffb300" : i === 1 ? "#00e5ff" : "#ff4444";
            const onClick = i === 0
              ? () => store.toggleMute(track.id)
              : i === 1 ? () => store.toggleSolo(track.id)
              : () => store.toggleArm(track.id);
            return (
              <button key={lbl} onClick={e => { e.stopPropagation(); onClick(); }} style={{
                width: 18, height: 14, fontSize: 6, fontFamily: T.font,
                background: active ? color : "transparent",
                border: `1px solid ${active ? color : T.border}`,
                color: active ? "#000" : T.dim, cursor: "pointer",
              }}>{lbl}</button>
            );
          })}
        </div>
      </div>
    );
  };

  const cursorMap: Record<string, string> = {
    select: "default", draw: "crosshair", erase: "not-allowed", cut: "col-resize", fade: "ew-resize",
  };

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column",
      flex: 1, overflow: "hidden", background: T.bg }}>

      {/* Ruler row */}
      <div style={{ display: "flex", height: RULER_H, flexShrink: 0 }}>
        <div style={{ width: HEADER_W, background: T.panel,
          borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", padding: "0 10px", flexShrink: 0 }}>
          <span style={{ fontSize: 7, letterSpacing: ".15em", color: T.dim,
            fontFamily: T.font, textTransform: "uppercase" }}>Timeline</span>
        </div>
        <canvas ref={rulerRef} onMouseDown={handleRulerMouseDown}
          style={{ flex: 1, cursor: "col-resize" }} />
      </div>

      {/* Tracks row */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }} onWheel={handleWheel}>
        {/* Header column */}
        <div style={{ width: HEADER_W, flexShrink: 0, overflowY: "hidden",
          borderRight: `1px solid ${T.border}`, background: T.panel }}>
          {tracks.map(t => <TrackHeader key={t.id} track={t} />)}
          {/* Add track button */}
          <div style={{ height: 36, display: "flex", alignItems: "center",
            padding: "0 8px", gap: 4 }}>
            {(["audio","midi","bus"] as const).map(type => (
              <button key={type} onClick={() => store.addTrack(type)} style={{
                height: 20, padding: "0 7px", fontSize: 6, fontFamily: T.font,
                background: "transparent", border: `1px solid ${T.border}`,
                color: T.dim, cursor: "pointer", letterSpacing: ".1em",
                textTransform: "uppercase",
              }}>+{type[0].toUpperCase()}</button>
            ))}
          </div>
        </div>
        {/* Canvas */}
        <canvas ref={tracksRef}
          onMouseDown={handleTrackMouseDown}
          style={{ flex: 1, cursor: cursorMap[tool] ?? "default" }} />
      </div>

      {/* Bottom scroll/zoom bar */}
      <div style={{ height: 20, display: "flex", alignItems: "center", gap: 8,
        padding: "0 10px", borderTop: `1px solid ${T.border}`, background: T.panel, flexShrink: 0 }}>
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>ZOOM</span>
        <input type="range" min={20} max={400} value={pxPerBar}
          onChange={e => store.setZoom(parseInt(e.target.value))}
          style={{ width: 72, accentColor: T.accent, cursor: "pointer" }} />
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>{pxPerBar}px/bar</span>
        <div style={{ flex: 1 }} />
        <input type="range" min={0} max={Math.max(0, tracks.length * TRACK_H - gridH)}
          value={scrollY}
          onChange={e => store.setScroll(scrollX, parseInt(e.target.value))}
          style={{ width: 60, accentColor: T.accent, cursor: "pointer" }} />
      </div>
    </div>
  );
}
