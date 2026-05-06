import { useRef, useEffect, useState, useCallback } from "react";
import type { MidiNote } from "../../../../shared/midi.types";
import { midiNoteToName, MIDI_PPQ } from "../../../../shared/midi.types";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0",
  white: "#1a1a1a", black: "#0d0d0d",
  grid: "rgba(255,255,255,0.04)", font: "monospace",
} as const;

const KEY_W     = 44;
const NOTE_H    = 12;
const RULER_H   = 20;
const TOTAL_KEYS = 88;
const START_NOTE = 21; // A0

function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitch % 12);
}

function drawPianoKeys(
  ctx: CanvasRenderingContext2D, h: number, scrollY: number,
) {
  ctx.fillStyle = T.panel;
  ctx.fillRect(0, 0, KEY_W, h);
  for (let i = 0; i < TOTAL_KEYS; i++) {
    const pitch = START_NOTE + TOTAL_KEYS - 1 - i;
    const y = i * NOTE_H - scrollY;
    if (y + NOTE_H < 0 || y > h) continue;
    const black = isBlackKey(pitch);
    ctx.fillStyle = black ? T.black : T.white;
    ctx.fillRect(0, y, black ? KEY_W * 0.65 : KEY_W, NOTE_H - 1);
    if (!black && pitch % 12 === 0) {
      ctx.fillStyle = T.dim;
      ctx.font = `6px ${T.font}`;
      ctx.fillText(midiNoteToName(pitch), KEY_W * 0.68, y + NOTE_H - 3);
    }
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0.5, y + 0.5, (black ? KEY_W * 0.65 : KEY_W) - 1, NOTE_H - 1.5);
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scrollX: number, scrollY: number, ppq: number, pxPerBeat: number,
) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < TOTAL_KEYS; i++) {
    const pitch = START_NOTE + TOTAL_KEYS - 1 - i;
    const y = i * NOTE_H - scrollY;
    if (y + NOTE_H < 0 || y > h) continue;
    if (isBlackKey(pitch)) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, y, w, NOTE_H);
    }
    if (pitch % 12 === 0) {
      ctx.strokeStyle = "rgba(184,255,0,0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    } else {
      ctx.strokeStyle = T.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, y + NOTE_H - 0.5);
      ctx.lineTo(w, y + NOTE_H - 0.5); ctx.stroke();
    }
  }
  const startBeat = Math.floor(scrollX / pxPerBeat);
  const endBeat   = Math.ceil((scrollX + w) / pxPerBeat) + 1;
  for (let b = startBeat; b <= endBeat; b++) {
    const x = b * pxPerBeat - scrollX;
    ctx.strokeStyle = b % 4 === 0 ? T.dim : T.grid;
    ctx.lineWidth   = b % 4 === 0 ? 0.75 : 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
}

function drawNotes(
  ctx: CanvasRenderingContext2D, notes: MidiNote[],
  scrollX: number, scrollY: number,
  ppq: number, pxPerBeat: number,
) {
  const pxPerTick = pxPerBeat / ppq;
  for (const note of notes) {
    const row = START_NOTE + TOTAL_KEYS - 1 - note.pitch;
    const y   = row * NOTE_H - scrollY;
    const x   = note.startTick * pxPerTick - scrollX;
    const w   = Math.max(4, note.duration * pxPerTick);
    if (y + NOTE_H < 0 || y > ctx.canvas.height) continue;
    if (x + w < 0 || x > ctx.canvas.width) continue;
    const alpha = 0.4 + (note.velocity / 127) * 0.6;
    ctx.fillStyle = `rgba(184,255,0,${alpha})`;
    ctx.fillRect(x + 1, y + 1, w - 2, NOTE_H - 2);
    ctx.strokeStyle = T.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, NOTE_H - 1);
  }
}

export interface PianoRollProps {
  notes?: MidiNote[];
  ppq?: number;
  beatsPerBar?: number;
  totalBeats?: number;
  playhead?: number;
  onNotesChange?: (notes: MidiNote[]) => void;
}

let _noteId = 0;

export function PianoRoll({
  notes: externalNotes,
  ppq = MIDI_PPQ,
  beatsPerBar = 4,
  totalBeats = 32,
  playhead = 0,
  onNotesChange,
}: PianoRollProps) {
  const keysRef     = useRef<HTMLCanvasElement>(null);
  const gridRef     = useRef<HTMLCanvasElement>(null);
  const [scrollX, setScrollX]   = useState(0);
  const [scrollY, setScrollY]   = useState(TOTAL_KEYS * NOTE_H / 2 - 200);
  const [pxPerBeat, setPxPerBeat] = useState(60);
  const [notes, setNotes]       = useState<MidiNote[]>(externalNotes ?? []);
  const [tool, setTool]         = useState<"draw" | "select" | "erase">("draw");
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });

  useEffect(() => {
    const obs = new ResizeObserver(e => {
      if (e[0]) setSize({ w: e[0].contentRect.width, h: e[0].contentRect.height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const gridW = size.w - KEY_W;
  const gridH = size.h - RULER_H;

  useEffect(() => {
    const kc = keysRef.current;
    const gc = gridRef.current;
    if (!kc || !gc) return;
    const kCtx = kc.getContext("2d");
    const gCtx = gc.getContext("2d");
    if (!kCtx || !gCtx) return;
    kc.width = KEY_W; kc.height = gridH;
    gc.width = gridW; gc.height = gridH;
    drawPianoKeys(kCtx, gridH, scrollY);
    drawGrid(gCtx, gridW, gridH, scrollX, scrollY, ppq, pxPerBeat);
    drawNotes(gCtx, notes, scrollX, scrollY, ppq, pxPerBeat);
    // playhead
    const ph = playhead * ppq * pxPerBeat / ppq - scrollX;
    if (ph >= 0 && ph <= gridW) {
      gCtx.strokeStyle = T.accent;
      gCtx.lineWidth = 1.5;
      gCtx.beginPath(); gCtx.moveTo(ph, 0); gCtx.lineTo(ph, gridH); gCtx.stroke();
    }
  }, [notes, scrollX, scrollY, pxPerBeat, ppq, size, playhead, gridW, gridH]);

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top  + scrollY;
    const row   = Math.floor(y / NOTE_H);
    const pitch = START_NOTE + TOTAL_KEYS - 1 - row;
    if (pitch < 0 || pitch > 127) return;
    const pxPerTick = pxPerBeat / ppq;
    const tick = Math.floor(x / pxPerTick);
    const snapTick = Math.round(tick / (ppq / 4)) * (ppq / 4);
    if (tool === "draw") {
      const note: MidiNote = {
        id: `n${_noteId++}`, pitch, velocity: 100,
        startTick: snapTick, duration: ppq / 4, channel: 0,
      };
      const next = [...notes, note];
      setNotes(next); onNotesChange?.(next);
    } else if (tool === "erase") {
      const next = notes.filter(n => {
        const nx = n.startTick * pxPerTick;
        const nr = (START_NOTE + TOTAL_KEYS - 1 - n.pitch) * NOTE_H;
        return !(x >= nx && x <= nx + n.duration * pxPerTick && y >= nr && y <= nr + NOTE_H);
      });
      setNotes(next); onNotesChange?.(next);
    }
  }, [notes, scrollX, scrollY, pxPerBeat, ppq, tool, onNotesChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setPxPerBeat(p => Math.max(20, Math.min(200, p - e.deltaY)));
    } else if (e.shiftKey) {
      setScrollX(p => Math.max(0, p + e.deltaY));
    } else {
      setScrollY(p => Math.max(0, Math.min(TOTAL_KEYS * NOTE_H - gridH, p + e.deltaY)));
    }
  }, [gridH]);

  const TOOLS = [
    { id: "draw" as const,   label: "✏" },
    { id: "select" as const, label: "⬚" },
    { id: "erase" as const,  label: "⌫" },
  ];

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column",
      flex: 1, overflow: "hidden", background: T.bg, fontFamily: T.font }}>
      {/* Toolbar */}
      <div style={{ height: RULER_H, display: "flex", alignItems: "center",
        gap: 4, padding: "0 8px", borderBottom: `1px solid ${T.border}`,
        background: T.panel, flexShrink: 0 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)}
            style={{
              height: 18, padding: "0 8px", fontSize: 9,
              background: tool === t.id ? T.accent : "transparent",
              border: `1px solid ${tool === t.id ? T.accent : T.border}`,
              color: tool === t.id ? "#000" : T.dim, cursor: "pointer", fontFamily: T.font,
            }}>
            {t.label}
          </button>
        ))}
        <div style={{ width: 1, height: 14, background: T.border, margin: "0 4px" }} />
        <span style={{ fontSize: 6, color: T.dim }}>ZOOM</span>
        <input type="range" min={20} max={200} value={pxPerBeat}
          onChange={e => setPxPerBeat(parseInt(e.target.value))}
          style={{ width: 60, accentColor: T.accent, cursor: "pointer" }} />
        <span style={{ fontSize: 6, color: T.dim }}>{notes.length} notes</span>
      </div>
      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <canvas ref={keysRef} style={{ flexShrink: 0 }} />
        <canvas ref={gridRef} onClick={handleGridClick}
          onWheel={handleWheel} style={{ flex: 1, cursor:
            tool === "draw" ? "crosshair" : tool === "erase" ? "not-allowed" : "default" }} />
      </div>
    </div>
  );
}
