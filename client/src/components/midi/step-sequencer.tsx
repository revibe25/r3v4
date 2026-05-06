import { useState, useCallback, useRef, useEffect } from "react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

export interface Step {
  active: boolean;
  velocity: number;
  pitch: number;
}

export interface SequencerRow {
  id: string;
  name: string;
  steps: Step[];
  color: string;
  muted: boolean;
}

export interface StepSequencerProps {
  rows?: SequencerRow[];
  stepCount?: number;
  currentStep?: number;
  playing?: boolean;
  bpm?: number;
  onRowsChange?: (rows: SequencerRow[]) => void;
  onStepChange?: (step: number) => void;
}

const DRUM_DEFAULTS = [
  { id: "kick",  name: "Kick",  color: "#b8ff00", pitch: 36 },
  { id: "snare", name: "Snare", color: "#00e5ff", pitch: 38 },
  { id: "hihat", name: "Hi-Hat",color: "#ff6b35", pitch: 42 },
  { id: "perc",  name: "Perc",  color: "#a855f7", pitch: 46 },
] as const;

function makeRow(id: string, name: string, color: string, pitch: number, steps: number): SequencerRow {
  return {
    id, name, color, muted: false,
    steps: Array.from({ length: steps }, () => ({ active: false, velocity: 100, pitch })),
  };
}

function StepButton({
  step, index, color, currentStep, groupOf,
  onClick,
}: {
  step: Step; index: number; color: string; currentStep: number;
  groupOf: number; onClick: () => void;
}) {
  const isCurrent = index === currentStep;
  const groupBg   = Math.floor(index / groupOf) % 2 === 0
    ? "rgba(255,255,255,0.02)" : "transparent";
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, flexShrink: 0,
        background: step.active
          ? (isCurrent ? "#fff" : color)
          : (isCurrent ? "rgba(255,255,255,0.15)" : groupBg),
        border: `1px solid ${step.active ? color : T.border}`,
        cursor: "pointer",
        outline: isCurrent ? `1px solid ${T.accent}` : "none",
        outlineOffset: "1px",
        opacity: step.active ? 0.85 + (step.velocity / 127) * 0.15 : 1,
        transition: "background 0.05s",
      }}
    />
  );
}

export function StepSequencer({
  rows: externalRows,
  stepCount = 16,
  currentStep: externalStep,
  playing: externalPlaying,
  bpm: externalBpm = 120,
  onRowsChange,
  onStepChange,
}: StepSequencerProps) {
  const [rows, setRows] = useState<SequencerRow[]>(
    externalRows ?? DRUM_DEFAULTS.map(d => makeRow(d.id, d.name, d.color, d.pitch, stepCount))
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(externalBpm);
  const [steps, setSteps] = useState(stepCount);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPlaying = externalPlaying ?? playing;
  const step = externalStep ?? currentStep;

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const ms = (60 / bpm / 4) * 1000;
    intervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        const next = (prev + 1) % steps;
        onStepChange?.(next);
        return next;
      });
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, bpm, steps, onStepChange]);

  const toggleStep = useCallback((rowIdx: number, stepIdx: number) => {
    setRows(prev => {
      const next = prev.map((row, ri) => {
        if (ri !== rowIdx) return row;
        return {
          ...row,
          steps: row.steps.map((s, si) =>
            si !== stepIdx ? s : { ...s, active: !s.active }
          ),
        };
      });
      onRowsChange?.(next);
      return next;
    });
  }, [onRowsChange]);

  const toggleMute = useCallback((rowIdx: number) => {
    setRows(prev => {
      const next = prev.map((row, ri) =>
        ri !== rowIdx ? row : { ...row, muted: !row.muted }
      );
      onRowsChange?.(next);
      return next;
    });
  }, [onRowsChange]);

  const clearRow = useCallback((rowIdx: number) => {
    setRows(prev => {
      const next = prev.map((row, ri) =>
        ri !== rowIdx ? row : {
          ...row,
          steps: row.steps.map(s => ({ ...s, active: false })),
        }
      );
      onRowsChange?.(next);
      return next;
    });
  }, [onRowsChange]);

  const STEP_COUNTS = [8, 16, 32] as const;

  return (
    <div style={{ background: T.bg, fontFamily: T.font, padding: 8 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <button
          onClick={() => setPlaying(p => !p)}
          style={{
            height: 24, padding: "0 14px", fontSize: 9, fontFamily: T.font,
            background: isPlaying ? T.accent : "transparent",
            border: `1px solid ${isPlaying ? T.accent : T.border}`,
            color: isPlaying ? "#000" : T.dim, cursor: "pointer",
          }}
        >{isPlaying ? "■ Stop" : "▶ Play"}</button>
        <button
          onClick={() => setCurrentStep(0)}
          style={{
            height: 24, padding: "0 10px", fontSize: 9, fontFamily: T.font,
            background: "transparent", border: `1px solid ${T.border}`,
            color: T.dim, cursor: "pointer",
          }}
        >Reset</button>
        <div style={{ width: 1, height: 16, background: T.border, margin: "0 2px" }} />
        <span style={{ fontSize: 7, color: T.dim }}>BPM</span>
        <input type="number" min={20} max={300} value={bpm}
          onChange={e => setBpm(parseInt(e.target.value))}
          style={{ width: 48, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 10, padding: "2px 4px",
            textAlign: "center" }} />
        <div style={{ width: 1, height: 16, background: T.border, margin: "0 2px" }} />
        <span style={{ fontSize: 7, color: T.dim }}>STEPS</span>
        {STEP_COUNTS.map(n => (
          <button key={n} onClick={() => setSteps(n)}
            style={{
              height: 20, padding: "0 8px", fontSize: 8, fontFamily: T.font,
              background: steps === n ? T.accent : "transparent",
              border: `1px solid ${steps === n ? T.accent : T.border}`,
              color: steps === n ? "#000" : T.dim, cursor: "pointer",
            }}>{n}</button>
        ))}
      </div>

      {/* Step number header */}
      <div style={{ display: "flex", gap: 2, marginBottom: 4, paddingLeft: 90 }}>
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} style={{
            width: 28, textAlign: "center", fontSize: 6, color: i === step ? T.accent : T.dim,
            fontVariantNumeric: "tabular-nums",
          }}>
            {i % 4 === 0 ? i + 1 : "·"}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, ri) => (
        <div key={row.id} style={{ display: "flex", alignItems: "center",
          gap: 2, marginBottom: 3 }}>
          {/* Row header */}
          <div style={{ width: 56, display: "flex", flexDirection: "column",
            alignItems: "flex-start", flexShrink: 0 }}>
            <span style={{ fontSize: 8, color: row.muted ? T.dim : T.text, letterSpacing: ".05em" }}>
              {row.name}
            </span>
          </div>
          <button
            onClick={() => toggleMute(ri)}
            style={{
              width: 18, height: 18, fontSize: 7, fontFamily: T.font,
              background: row.muted ? "#ffb300" : "transparent",
              border: `1px solid ${row.muted ? "#ffb300" : T.border}`,
              color: row.muted ? "#000" : T.dim, cursor: "pointer", flexShrink: 0,
            }}
          >M</button>
          <button
            onClick={() => clearRow(ri)}
            style={{
              width: 18, height: 18, fontSize: 7, fontFamily: T.font,
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.dim, cursor: "pointer", flexShrink: 0,
            }}
          >✕</button>
          {/* Steps */}
          {row.steps.slice(0, steps).map((s, si) => (
            <StepButton
              key={si} step={s} index={si} color={row.color}
              currentStep={isPlaying ? step : -1}
              groupOf={4}
              onClick={() => toggleStep(ri, si)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
