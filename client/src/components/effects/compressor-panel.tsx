import { useState, useEffect, useRef } from "react";

const T = {
  bg: "#0a0a0a", border: "#1c1c1c", accent: "#b8ff00",
  dim: "#555", text: "#f0f0f0", danger: "#ff3b3b", font: "monospace",
} as const;

export interface CompressorSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
  makeupGain: number;
  enabled: boolean;
}

export interface CompressorPanelProps {
  settings?: CompressorSettings;
  onChange?: (s: CompressorSettings) => void;
  gainReduction?: number;
}

const DEFAULT: CompressorSettings = {
  threshold: -18, ratio: 4, attack: 10, release: 80,
  knee: 6, makeupGain: 0, enabled: true,
};

function Row({
  label, value, min, max, step, unit, onChange, disabled,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
      <span style={{
        width: 72, fontSize: 7, letterSpacing: ".12em", textTransform: "uppercase",
        color: T.dim, fontFamily: T.font, flexShrink: 0,
      }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: T.accent, cursor: disabled ? "not-allowed" : "pointer" }} />
      <span style={{
        width: 52, fontSize: 8, color: T.text, fontFamily: T.font,
        textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums",
      }}>
        {value.toFixed(step < 1 ? 1 : 0)}{unit}
      </span>
    </div>
  );
}

function GRMeter({ gr = 0, height = 60 }: { gr?: number; height?: number }) {
  const filled = Math.min(1, Math.abs(gr) / 30);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 6, letterSpacing: ".15em", color: T.dim,
        fontFamily: T.font, textTransform: "uppercase" }}>GR</span>
      <div style={{
        width: 12, height, background: T.border,
        position: "relative", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: `${filled * 100}%`,
          background: filled > 0.7 ? T.danger : filled > 0.4 ? "#ffb300" : T.accent,
        }} />
      </div>
      <span style={{
        fontSize: 6, color: T.dim, fontFamily: T.font,
        fontVariantNumeric: "tabular-nums",
      }}>
        {gr > 0 ? `-${gr.toFixed(1)}` : "0"}
      </span>
    </div>
  );
}

export function CompressorPanel({
  settings = DEFAULT, onChange, gainReduction = 0,
}: CompressorPanelProps) {
  const [s, setS] = useState<CompressorSettings>(settings);
  const [simGR, setSimGR] = useState(0);
  const grRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate GR meter movement for demo
  useEffect(() => {
    if (!s.enabled) { setSimGR(0); return; }
    grRef.current = setInterval(() => {
      setSimGR(prev => {
        const target = gainReduction || (Math.random() > 0.6 ? Math.random() * 8 : 0);
        return prev + (target - prev) * 0.15;
      });
    }, 50);
    return () => { if (grRef.current) clearInterval(grRef.current); };
  }, [s.enabled, gainReduction]);

  const u = (k: keyof CompressorSettings) => (v: number) => {
    const n = { ...s, [k]: v }; setS(n); onChange?.(n);
  };

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "4px 8px",
        borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 7, letterSpacing: ".2em", color: T.dim,
          textTransform: "uppercase", flex: 1 }}>Compressor</span>
        <button onClick={() => { const n = { ...s, enabled: !s.enabled }; setS(n); onChange?.(n); }}
          style={{ height: 16, padding: "0 8px", fontSize: 6,
            background: s.enabled ? T.accent : "transparent",
            border: `1px solid ${s.enabled ? T.accent : T.dim}`,
            color: s.enabled ? "#000" : T.dim, fontFamily: T.font, cursor: "pointer" }}>
          {s.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: 8,
        opacity: s.enabled ? 1 : 0.5, pointerEvents: s.enabled ? "auto" : "none" }}>
        {/* Controls */}
        <div style={{ flex: 1 }}>
          <Row label="Threshold" value={s.threshold} min={-60} max={0}   step={0.5} unit="dB" onChange={u("threshold")} />
          <Row label="Ratio"     value={s.ratio}     min={1}   max={20}  step={0.5} unit=":1" onChange={u("ratio")} />
          <Row label="Knee"      value={s.knee}      min={0}   max={12}  step={0.5} unit="dB" onChange={u("knee")} />
          <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
          <Row label="Attack"    value={s.attack}    min={0.1} max={200} step={0.1} unit="ms" onChange={u("attack")} />
          <Row label="Release"   value={s.release}   min={1}   max={1000} step={1}  unit="ms" onChange={u("release")} />
          <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
          <Row label="Makeup"    value={s.makeupGain} min={0}  max={24}  step={0.5} unit="dB" onChange={u("makeupGain")} />
        </div>
        {/* GR Meter */}
        <GRMeter gr={simGR} height={120} />
      </div>
    </div>
  );
}
