import { useState, useRef, useEffect, useCallback } from "react";

const T = {
  bg: "#0a0a0a", border: "#1c1c1c", accent: "#b8ff00",
  dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

export interface EQBand {
  freq: number;
  gain: number;
  q: number;
  type: "lowshelf" | "peaking" | "highshelf";
  enabled: boolean;
}

export interface EQSettings {
  bands: [EQBand, EQBand, EQBand];
  enabled: boolean;
}

export interface EQPanelProps {
  settings?: EQSettings;
  onChange?: (s: EQSettings) => void;
}

const DEFAULT_SETTINGS: EQSettings = {
  enabled: true,
  bands: [
    { freq: 100,  gain: 0, q: 0.7, type: "lowshelf",  enabled: true },
    { freq: 1000, gain: 0, q: 1.0, type: "peaking",    enabled: true },
    { freq: 8000, gain: 0, q: 0.7, type: "highshelf",  enabled: true },
  ],
};

const BAND_COLORS = [T.accent, "#00e5ff", "#ff6b35"] as const;
const LABELS = ["Low", "Mid", "High"] as const;

function drawCurve(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  bands: EQBand[],
) {
  ctx.clearRect(0, 0, w, h);
  // Grid
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x * w, 0); ctx.lineTo(x * w, h); ctx.stroke();
  });
  [0.25, 0.5, 0.75].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y * h); ctx.lineTo(w, y * h); ctx.stroke();
  });
  // 0dB line
  ctx.strokeStyle = T.dim; ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  ctx.setLineDash([]);

  // Combined curve
  ctx.strokeStyle = T.accent; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = 0; px < w; px++) {
    const freq = 20 * Math.pow(10, (px / w) * Math.log10(20000 / 20));
    let totalGain = 0;
    for (const band of bands) {
      if (!band.enabled) continue;
      const f = band.freq;
      const g = band.gain;
      const q = band.q;
      const omega = freq / f;
      let response = 0;
      if (band.type === "peaking") {
        const denom = omega * omega - 1;
        const num = g / q * omega;
        response = Math.atan2(num, denom) * g / Math.PI * 2;
        response = g / (1 + (q * (freq / f - f / freq)) ** 2 + 0.001);
        response = g * (1 - Math.min(1, Math.abs(Math.log(freq / f) * q)));
      } else if (band.type === "lowshelf") {
        response = g * (1 / (1 + (freq / f) ** 2));
      } else {
        response = g * (1 / (1 + (f / freq) ** 2));
      }
      totalGain += response;
    }
    const y = h / 2 - (totalGain / 18) * (h / 2);
    if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
  }
  ctx.stroke();
}

function BandControl({
  band, index, color, label, onChange,
}: {
  band: EQBand; index: number; color: string; label: string;
  onChange: (b: EQBand) => void;
}) {
  const u = (k: keyof EQBand) => (v: number | boolean | string) =>
    onChange({ ...band, [k]: v });
  return (
    <div style={{ flex: 1, padding: "0 6px", borderLeft: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, background: color, borderRadius: "50%" }} />
        <span style={{ fontSize: 7, letterSpacing: ".15em", color, fontFamily: T.font,
          textTransform: "uppercase" }}>{label}</span>
        <button
          onClick={() => u("enabled")(!band.enabled)}
          style={{
            marginLeft: "auto", height: 14, padding: "0 6px", fontSize: 6,
            background: band.enabled ? color : "transparent",
            border: `1px solid ${band.enabled ? color : T.dim}`,
            color: band.enabled ? "#000" : T.dim, fontFamily: T.font, cursor: "pointer",
          }}
        >{band.enabled ? "ON" : "OFF"}</button>
      </div>
      {(["freq", "gain", "q"] as const).map(k => {
        const cfg = {
          freq: { min: 20,   max: 20000, step: 1,    label: "Freq",  unit: "Hz", log: true },
          gain: { min: -18,  max: 18,    step: 0.1,  label: "Gain",  unit: "dB", log: false },
          q:    { min: 0.1,  max: 10,    step: 0.1,  label: "Q",     unit: "",   log: false },
        }[k];
        return (
          <div key={k} style={{ marginBottom: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
              <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font,
                letterSpacing: ".1em", textTransform: "uppercase" }}>{cfg.label}</span>
              <span style={{ fontSize: 6, color: T.text, fontFamily: T.font,
                fontVariantNumeric: "tabular-nums" }}>
                {k === "freq" ? (band[k] >= 1000
                  ? `${(band[k] / 1000).toFixed(1)}k`
                  : `${band[k]}`) + cfg.unit
                  : `${band[k].toFixed(1)}${cfg.unit}`}
              </span>
            </div>
            <input type="range"
              min={cfg.min} max={cfg.max} step={cfg.step}
              value={band[k] as number}
              onChange={e => (u(k) as (v: number) => void)(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: color, cursor: "pointer" }}
              disabled={!band.enabled}
            />
          </div>
        );
      })}
    </div>
  );
}

export function EQPanel({ settings = DEFAULT_SETTINGS, onChange }: EQPanelProps) {
  const [s, setS] = useState<EQSettings>(settings);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const update = useCallback((bands: [EQBand, EQBand, EQBand]) => {
    const next = { ...s, bands };
    setS(next);
    onChange?.(next);
  }, [s, onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCurve(ctx, canvas.width, canvas.height, s.bands);
  }, [s.bands]);

  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.font }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "4px 8px",
        borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 7, letterSpacing: ".2em", color: T.dim,
          textTransform: "uppercase", flex: 1 }}>EQ — 3 Band Parametric</span>
        <button onClick={() => { const n = { ...s, enabled: !s.enabled }; setS(n); onChange?.(n); }}
          style={{ height: 16, padding: "0 8px", fontSize: 6, background: s.enabled ? T.accent : "transparent",
            border: `1px solid ${s.enabled ? T.accent : T.dim}`,
            color: s.enabled ? "#000" : T.dim, fontFamily: T.font, cursor: "pointer" }}>
          {s.enabled ? "ON" : "OFF"}
        </button>
      </div>
      {/* Canvas */}
      <canvas ref={canvasRef} width={320} height={80}
        style={{ display: "block", width: "100%", height: 80, opacity: s.enabled ? 1 : 0.4 }} />
      {/* Band controls */}
      <div style={{ display: "flex", padding: 8, opacity: s.enabled ? 1 : 0.5,
        pointerEvents: s.enabled ? "auto" : "none" }}>
        {s.bands.map((band, i) => (
          <BandControl key={i} band={band} index={i}
            color={BAND_COLORS[i]} label={LABELS[i]}
            onChange={b => {
              const next = [...s.bands] as [EQBand, EQBand, EQBand];
              next[i] = b; update(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}
