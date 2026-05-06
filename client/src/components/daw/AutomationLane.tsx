import { useRef, useEffect, useCallback, useState } from "react";
import { useDAWStore, useView, useTransport } from "@/state/dawStore";
import type { AutomationLane as Lane } from "../../../../shared/automation.types";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

const POINT_R = 5;

interface AutomationLaneProps {
  trackId: string;
  lane:    Lane;
  height?: number;
}

export function AutomationLane({ trackId, lane, height = 60 }: AutomationLaneProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const { pxPerBar, scrollX } = useView();
  const { tempo, timeSignature } = useTransport();
  const store      = useDAWStore();
  const [dragging, setDragging] = useState<string | null>(null);

  // Coordinate helpers
  const pxPerTick   = pxPerBar / (tempo / 60 * 480);  // approximate
  const posToX = useCallback((pos: number) => pos * pxPerTick - scrollX, [pxPerTick, scrollX]);
  const valToY = useCallback((val: number) => height - val * height, [height]);
  const xToPos = useCallback((x: number) => (x + scrollX) / pxPerTick, [scrollX, pxPerTick]);
  const yToVal = useCallback((y: number) => Math.max(0, Math.min(1, 1 - y / height)), [height]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = T.panel;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 0dB / centre line
    const midY = valToY(lane.defaultValue ?? 0.8);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(canvas.width, midY); ctx.stroke();
    ctx.setLineDash([]);

    if (lane.points.length === 0) return;
    const sorted = [...lane.points].sort((a, b) => a.position - b.position);

    // Line
    ctx.strokeStyle = T.accent;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    sorted.forEach((pt, i) => {
      const x = posToX(pt.position);
      const y = valToY(pt.value);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    // Extend to edges
    const first = sorted[0];
    const last  = sorted[sorted.length - 1];
    ctx.moveTo(0, valToY(first.value));
    ctx.lineTo(posToX(first.position), valToY(first.value));
    ctx.moveTo(posToX(last.position), valToY(last.value));
    ctx.lineTo(canvas.width, valToY(last.value));
    ctx.stroke();

    // Points
    sorted.forEach(pt => {
      const x = posToX(pt.position);
      const y = valToY(pt.value);
      ctx.fillStyle   = dragging === pt.id ? "#fff" : T.accent;
      ctx.strokeStyle = "#000";
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.arc(x, y, POINT_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }, [lane.points, posToX, valToY, dragging, lane.defaultValue]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if near existing point
    const sorted = [...lane.points].sort((a, b) => a.position - b.position);
    for (const pt of sorted) {
      const px = posToX(pt.position);
      const py = valToY(pt.value);
      if (Math.abs(x - px) <= POINT_R + 2 && Math.abs(y - py) <= POINT_R + 2) {
        if (e.altKey) store.removeAutomationPoint(trackId, lane.id, pt.id);
        return;
      }
    }

    // Add new point
    store.addAutomationPoint(trackId, lane.id, {
      position: Math.round(xToPos(x)),
      value:    yToVal(y),
      curve:    "linear",
    });
  }, [lane.points, posToX, valToY, xToPos, yToVal, trackId, lane.id, store]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const pt of lane.points) {
      const px = posToX(pt.position);
      const py = valToY(pt.value);
      if (Math.abs(x - px) <= POINT_R + 2 && Math.abs(y - py) <= POINT_R + 2) {
        setDragging(pt.id);
        return;
      }
    }
  }, [lane.points, posToX, valToY]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    store.updateAutomationPoint(trackId, lane.id, dragging, {
      position: Math.round(xToPos(e.clientX - rect.left)),
      value:    yToVal(e.clientY - rect.top),
    });
  }, [dragging, xToPos, yToVal, trackId, lane.id, store]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  return (
    <div style={{ background: T.panel, borderTop: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", padding: "2px 6px",
        borderBottom: `1px solid ${T.border}`, gap: 6 }}>
        <span style={{ fontSize: 7, color: T.accent, fontFamily: T.font,
          letterSpacing: ".1em", textTransform: "uppercase" }}>
          ↓ {lane.parameterName}
        </span>
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>
          Click to add · Alt+click to remove
        </span>
      </div>
      <canvas ref={canvasRef}
        width={600} height={height}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ display: "block", width: "100%", height, cursor: "crosshair" }}
      />
    </div>
  );
}
