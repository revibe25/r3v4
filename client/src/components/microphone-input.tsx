// client/src/components/microphone-input.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACID       = "#a3e635";
const RED        = "var(--signal-clip)";
const AMBER      = "var(--signal-warn)";
const BLK        = "var(--dj-black)";
const SURF       = "var(--dj-surface)";
const SURF2      = "var(--dj-surface2)";
const SURF3      = "var(--dj-surface3)";
const BORDER     = "var(--dj-border)";
const BORDER2    = "#2a2a2a";
const DIM        = "var(--dj-dim)";
const DIMMER     = "var(--dj-dimmer)";
const _MUTED      = "var(--dj-muted)";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActiveTab   = "signal" | "process" | "record" | "route";
type ScopeMode   = "wave" | "spectrum" | "phase";
type EQPresetKey = "flat" | "voice" | "broadcast" | "presence" | "air" | "podcast";

export interface RecordedClip {
  id: string; name: string; blob: Blob; url: string;
  duration: number; sizeKb: number; timestamp: number; peakDb: number;
  wavePreview: number[]; // 120 normalised amplitude samples
}

interface EQBand {
  id: string; label: string;
  type: BiquadFilterType; frequency: number; gain: number; q: number;
}

interface GateCfg   { threshold: number; attack: number; release: number; hold: number; enabled: boolean; }
interface CompCfg   { threshold: number; ratio: number; attack: number; release: number; knee: number; makeup: number; enabled: boolean; }

interface AudioStats {
  currentDb: number; peakDb: number; avgDb: number; lufs: number;
  leftDb: number; rightDb: number;
  note: string; cents: number; frequency: string;
  gr: number; gateOpen: boolean;
}

export interface MicrophoneInputProps {
  onAudioData?:     (data: Float32Array) => void;
  onMidiMessage?:   (message: MIDIMessageEvent) => void;
  onClipRecorded?:  (clip: RecordedClip) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NOTE_NAMES    = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BAR_COUNT     = 64;
const DB_HIST_LEN   = 180;
const LUFS_WIN      = 30; // 3s at 100ms ticks
const PREVIEW_BINS  = 120;
const EQ_PRESETS: Record<EQPresetKey, { label: string; bands: number[] }> = {
  flat:      { label: "Flat",      bands: [0, 0, 0, 0, 0] },
  voice:     { label: "Voice",     bands: [-2, 0, 3, 2, 1] },
  broadcast: { label: "Broadcast", bands: [-4, -1, 2, 3, 2] },
  presence:  { label: "Presence",  bands: [0, 0, 1, 5, 3] },
  air:       { label: "Air",       bands: [0, 0, 0, 2, 7] },
  podcast:   { label: "Podcast",   bands: [-6, -2, 3, 2, 0] },
};
const DEFAULT_EQ_BANDS: EQBand[] = [
  { id: "sub",   label: "SUB",    type: "lowshelf",  frequency: 80,   gain: 0, q: 0.7 },
  { id: "low",   label: "LOW",    type: "peaking",   frequency: 200,  gain: 0, q: 1.0 },
  { id: "mid",   label: "MID",    type: "peaking",   frequency: 1000, gain: 0, q: 1.0 },
  { id: "himid", label: "HI-MID", type: "peaking",   frequency: 4000, gain: 0, q: 1.0 },
  { id: "air",   label: "AIR",    type: "highshelf", frequency: 12000,gain: 0, q: 0.7 },
];
const DEFAULT_GATE: GateCfg  = { threshold: -50, attack: 5, release: 100, hold: 50, enabled: false };
const DEFAULT_COMP: CompCfg  = { threshold: -18, ratio: 4, attack: 10, release: 150, knee: 6, makeup: 0, enabled: false };
const EMPTY_STATS: AudioStats = { currentDb: -60, peakDb: -60, avgDb: -60, lufs: -70, leftDb: -60, rightDb: -60, note: "—", cents: 0, frequency: "—", gr: 0, gateOpen: false };

// ─── Utilities ────────────────────────────────────────────────────────────────
const clamp   = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dbNorm  = (db: number) => clamp((db + 60) * (100 / 60), 0, 100);
const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2,"0")}:${(s % 60).toFixed(0).padStart(2,"0")}`;
const fmtSize = (kb: number) => kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb/1024).toFixed(1)} MB`;

function levelColor(pct: number): string {
  if (pct > 90) return RED;
  if (pct > 75) return AMBER;
  return ACID;
}

/** Autocorrelation pitch detection — returns Hz or null */
function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  let r1 = 0, r2 = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < 0.2) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < 0.2) { r2 = SIZE - i; break; } }
  const trimmed = buf.slice(r1, r2);
  const N = trimmed.length;
  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    let s = 0;
    for (let i = 0; i < N - lag; i++) s += trimmed[i] * trimmed[i + lag];
    c[lag] = s;
  }
  let d = 0;
  while (d < N && c[d] > c[d + 1]) d++;
  let maxVal = -Infinity, maxPos = -1;
  for (let i = d; i < N; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }
  if (maxPos < 1 || maxVal < c[0] * 0.5) return null;
  const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1] ?? 0;
  const interp = maxPos + (x3 - x1) / (2 * (2 * x2 - x1 - x3));
  return sampleRate / interp;
}

function freqToNote(hz: number): { note: string; octave: number; cents: number } {
  const semitones = 12 * Math.log2(hz / 440) + 69;
  const midi = Math.round(semitones);
  const cents = Math.round((semitones - midi) * 100);
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { note, octave, cents };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 32, border: "none", background: active ? SURF3 : "transparent",
      color: active ? ACID : DIM, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
      cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
      borderBottom: `2px solid ${active ? ACID : "transparent"}`,
      transition: "all 0.15s",
    }}>{label}</button>
  );
}

function Knob({ value, min = 0, max = 100, onChange, disabled = false, label, fmt, size = 56 }:
  { value: number; min?: number; max?: number; onChange: (v: number) => void;
    disabled?: boolean; label: string; fmt: string; size?: number }) {
  const drag = useRef(false), startY = useRef(0), startV = useRef(0);
  const pct = (value - min) / (max - min);
  const angle = pct * 270 - 135;
  const cx = size / 2, cy = size / 2 + 2, r = size / 2 - 5;
  const sa = -225 * (Math.PI / 180);
  const ea = (-225 + pct * 270) * (Math.PI / 180);
  const [x1, y1] = [cx + r * Math.cos(sa), cy + r * Math.sin(sa)];
  const [x2, y2] = [cx + r * Math.cos(ea), cy + r * Math.sin(ea)];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width={size} height={size + 4} style={{ cursor: disabled ? "not-allowed" : "ns-resize", opacity: disabled ? 0.3 : 1, touchAction: "none" }}
        onPointerDown={e => { if (disabled) return; drag.current = true; startY.current = e.clientY; startV.current = value; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (!drag.current) return; const d = startY.current - e.clientY; onChange(clamp(Math.round(startV.current + (d / 160) * (max - min)), min, max)); }}
        onPointerUp={() => { drag.current = false; }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={SURF2} strokeWidth={3} strokeDasharray="2 3" />
        {pct > 0.01 && <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2}`} fill="none" stroke={pct > 0.88 ? AMBER : ACID} strokeWidth={3} strokeLinecap="butt" />}
        <circle cx={cx} cy={cy} r={r - 9} fill={SURF} stroke={BORDER} strokeWidth={1} />
        <line x1={cx} y1={cy - r + 13} x2={cx} y2={cy - r + 21} stroke={ACID} strokeWidth={2} strokeLinecap="square" transform={`rotate(${angle},${cx},${cy})`} />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 700, color: ACID, fontFamily: "inherit", letterSpacing: 1 }}>{fmt}</span>
      <span style={{ fontSize: 7, color: DIM, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{label}</span>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange, disabled = false }:
  { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", opacity: disabled ? 0.3 : 1 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--daw-sub)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: DIM, marginTop: 1, letterSpacing: 0.5 }}>{sub}</div>}
      </div>
      <div role="switch" aria-checked={checked} tabIndex={0}
        onClick={() => { if (!disabled) onChange(!checked); }}
        onKeyDown={e => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onChange(!checked); } }}
        style={{ width: 36, height: 16, padding: 2, cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
          background: checked ? ACID : SURF2, border: `1px solid ${checked ? ACID : BORDER}`, transition: "all 0.15s", display: "flex", alignItems: "center" }}>
        <div style={{ width: 10, height: 10, background: checked ? BLK : DIM, transform: checked ? "translateX(18px)" : "translateX(0)", transition: "transform 0.15s" }} />
      </div>
    </div>
  );
}

// ── Scope: Waveform ──
function WaveScope({ node, active, muted, w = 560, h = 72 }:
  { node: AnalyserNode | null; active: boolean; muted: boolean; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const af  = useRef<number | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    if (!node || !active) {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(100,116,139,0.15)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      return;
    }
    const buf = new Uint8Array(node.frequencyBinCount);
    const draw = () => {
      node.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, w, h);
      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
      [h*0.25,h*0.5,h*0.75].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); });
      // Waveform glow
      ctx.shadowColor = muted ? RED : ACID; ctx.shadowBlur = 6;
      ctx.strokeStyle = muted ? "rgba(255,34,0,0.9)" : "rgba(184,255,0,0.9)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = w / buf.length;
      for (let i = 0; i < buf.length; i++) {
        const y = ((buf[i] / 128) - 1) * (h * 0.45) + h / 2;
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      af.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (af.current) cancelAnimationFrame(af.current); };
  }, [node, active, muted, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ width: "100%", height: h, display: "block" }} />;
}

// ── Scope: Spectrum with peak hold ──
function SpectrumScope({ node, active, w = 560, h = 72 }:
  { node: AnalyserNode | null; active: boolean; w?: number; h?: number }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const af   = useRef<number | null>(null);
  const peak = useRef<number[]>([]);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    if (!node || !active) { ctx.clearRect(0, 0, w, h); return; }
    const BARS = 80;
    peak.current = Array(BARS).fill(0);
    const buf = new Uint8Array(node.frequencyBinCount);
    const step = Math.floor(buf.length / BARS);
    const barW = w / BARS - 1;
    const draw = () => {
      node.getByteFrequencyData(buf);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < BARS; i++) {
        let avg = 0;
        for (let j = 0; j < step; j++) avg += buf[i * step + j];
        const val = (avg / step) / 255;
        const bh = val * h;
        const x = i * (barW + 1);
        // Bar
        const g = ctx.createLinearGradient(0, h, 0, h - bh);
        g.addColorStop(0, `rgba(184,255,0,${0.4 + val * 0.5})`);
        g.addColorStop(1, `rgba(184,255,0,${0.1 + val * 0.3})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, h - bh, barW, bh);
        // Peak hold
        if (val > peak.current[i]) peak.current[i] = val;
        else peak.current[i] = Math.max(0, peak.current[i] - 0.002);
        if (peak.current[i] > 0.01) {
          ctx.fillStyle = peak.current[i] > 0.85 ? RED : ACID;
          ctx.fillRect(x, h - peak.current[i] * h - 1, barW, 2);
        }
      }
      af.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (af.current) cancelAnimationFrame(af.current); };
  }, [node, active, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ width: "100%", height: h, display: "block" }} />;
}

// ── Scope: Phase / Lissajous ──
function PhaseScope({ left, right, active, w = 560, h = 100 }:
  { left: AnalyserNode | null; right: AnalyserNode | null; active: boolean; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const af  = useRef<number | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    if (!left || !active) { ctx.clearRect(0, 0, w, h); return; }
    const size = left.frequencyBinCount;
    const lBuf = new Uint8Array(size);
    const rBuf = new Uint8Array(right ? size : size);
    const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.44;
    const draw = () => {
      left.getByteTimeDomainData(lBuf);
      if (right) right.getByteTimeDomainData(rBuf); else rBuf.set(lBuf);
      ctx.clearRect(0, 0, w, h);
      // Axes
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      // Plot
      ctx.strokeStyle = "rgba(184,255,0,0.5)"; ctx.lineWidth = 1;
      ctx.shadowColor = ACID; ctx.shadowBlur = 3;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(size / 256));
      for (let i = 0; i < size; i += step) {
        const x = cx + ((lBuf[i] - 128) / 128) * scale;
        const y = cy - ((rBuf[i] - 128) / 128) * scale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      af.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (af.current) cancelAnimationFrame(af.current); };
  }, [left, right, active, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ width: "100%", height: h, display: "block" }} />;
}

// ── EQ Frequency Response Curve ──
function EQCurve({ bands, nodes, w = 560, h = 100 }:
  { bands: EQBand[]; nodes: BiquadFilterNode[]; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    if (!nodes.length) return;
    const POINTS = w;
    const freqs = new Float32Array(POINTS);
    const FMIN = 20, FMAX = 20000;
    for (let i = 0; i < POINTS; i++) freqs[i] = FMIN * Math.pow(FMAX / FMIN, i / POINTS);
    const combined = new Float32Array(POINTS).fill(0);
    nodes.forEach((n, _idx) => {
      if (!n) return;
      const mag = new Float32Array(POINTS);
      const phase = new Float32Array(POINTS);
      try { n.getFrequencyResponse(freqs, mag, phase); } catch { return; }
      for (let i = 0; i < POINTS; i++) combined[i] += 20 * Math.log10(Math.max(mag[i], 1e-5));
    });
    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
    [-12,-6,0,6,12].forEach(db => {
      const y = h / 2 - (db / 20) * (h * 0.4);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    });
    // 0dB line
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
    // Curve fill
    const path = new Path2D();
    for (let i = 0; i < POINTS; i++) {
      const y = clamp(h / 2 - (combined[i] / 20) * (h * 0.4), 0, h);
      i === 0 ? path.moveTo(i, y) : path.lineTo(i, y);
    }
    const fillPath = new Path2D(path);
    fillPath.lineTo(w, h); fillPath.lineTo(0, h); fillPath.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(184,255,0,0.2)");
    grad.addColorStop(1, "rgba(184,255,0,0)");
    ctx.fillStyle = grad; ctx.fill(fillPath);
    ctx.strokeStyle = ACID; ctx.lineWidth = 1.5;
    ctx.shadowColor = ACID; ctx.shadowBlur = 4;
    ctx.stroke(path); ctx.shadowBlur = 0;
    // Freq labels
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "8px monospace";
    [100,500,1000,5000,10000].forEach(f => {
      const x = (Math.log10(f / FMIN) / Math.log10(FMAX / FMIN)) * w;
      ctx.fillText(f >= 1000 ? `${f/1000}k` : `${f}`, x - 8, h - 2);
    });
  }, [bands, nodes, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ width: "100%", height: h, display: "block" }} />;
}

// ── Clip Waveform Mini Preview ──
function ClipPreview({ data, w = 120, h = 28 }: { data: number[]; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const barW = w / data.length;
    data.forEach((v, i) => {
      const bh = v * h * 0.9;
      ctx.fillStyle = `rgba(184,255,0,${0.4 + v * 0.5})`;
      ctx.fillRect(i * barW, (h - bh) / 2, Math.max(1, barW - 0.5), bh);
    });
  }, [data, w, h]);
  return <canvas ref={ref} width={w} height={h} style={{ width: w, height: h, display: "block", flexShrink: 0 }} />;
}

// ── Tuner Display ──
function Tuner({ note, octave, cents, active }: { note: string; octave: number; cents: number; active: boolean }) {
  const inTune = Math.abs(cents) < 5;
  const needleAngle = clamp(cents * 1.2, -70, 70);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 4 }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: DIM, letterSpacing: 3, textTransform: "uppercase" }}>CHROMATIC TUNER</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: active ? (inTune ? ACID : AMBER) : DIMMER, fontFamily: "inherit", letterSpacing: -1, lineHeight: 1 }}>{active ? note : "—"}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: active ? (inTune ? ACID : AMBER) : DIMMER }}>{active ? octave : ""}</span>
      </div>
      {/* Needle meter */}
      <div style={{ position: "relative", width: 140, height: 28 }}>
        <svg width={140} height={28} style={{ overflow: "visible" }}>
          {/* Scale marks */}
          {[-50,-25,0,25,50].map(v => {
            const x = 70 + v * 1.2;
            return <line key={v} x1={x} y1={20} x2={x} y2={v === 0 ? 8 : 14} stroke={v === 0 ? "rgba(255,255,255,0.3)" : BORDER2} strokeWidth={v === 0 ? 2 : 1} />;
          })}
          {/* Needle */}
          <line x1={70} y1={26} x2={70 + Math.sin(needleAngle * Math.PI / 180) * 22} y2={26 - Math.cos(needleAngle * Math.PI / 180) * 22}
            stroke={active ? (inTune ? ACID : AMBER) : DIM} strokeWidth={2} strokeLinecap="round"
            style={{ transition: "all 0.1s" }} />
          <circle cx={70} cy={26} r={3} fill={active ? (inTune ? ACID : AMBER) : DIM} />
        </svg>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: active ? (inTune ? ACID : AMBER) : DIM, letterSpacing: 2 }}>
        {active ? (inTune ? "● IN TUNE" : `${cents > 0 ? "+" : ""}${cents}¢`) : "—"}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MicrophoneInput({ onAudioData, onMidiMessage, onClipRecorded }: MicrophoneInputProps) {

  // ── UI State ──────────────────────────────────────────────────────────────
  const [tab,        setTab]        = useState<ActiveTab>("signal");
  const [scopeMode,  setScopeMode]  = useState<ScopeMode>("wave");
  const [isActive,   setIsActive]   = useState(false);
  const [isMuted,    setIsMuted]    = useState(false);
  const [isRec,      setIsRec]      = useState(false);
  const [recTime,    setRecTime]    = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [_advOpen,    _setAdvOpen]    = useState(false);
  const [error,      setError]      = useState("");
  const [warning,    setWarning]    = useState("");

  // ── Device ────────────────────────────────────────────────────────────────
  const [devices,   setDevices]   = useState<MediaDeviceInfo[]>([]);
  const [selDevice, setSelDevice] = useState<string | undefined>();

  // ── Gain ──────────────────────────────────────────────────────────────────
  const [inputGain, setInputGain] = useState(100);

  // ── EQ ────────────────────────────────────────────────────────────────────
  const [eqBands,  setEqBands]  = useState<EQBand[]>(DEFAULT_EQ_BANDS);
  const [eqEnable, setEqEnable] = useState(false);

  // ── Gate / Compressor ─────────────────────────────────────────────────────
  const [gate,     setGate]     = useState<GateCfg>(DEFAULT_GATE);
  const [comp,     setComp]     = useState<CompCfg>(DEFAULT_COMP);

  // ── Browser constraints ───────────────────────────────────────────────────
  const [noiseSupp,  setNoiseSupp]  = useState(true);
  const [echoCxl,    setEchoCxl]    = useState(true);
  const [autoGain,   setAutoGain]   = useState(false);

  // ── MIDI ──────────────────────────────────────────────────────────────────
  const [midiOn,     setMidiOn]     = useState(false);
  const [midiStatus, setMidiStatus] = useState("Disabled");

  // ── Recording ─────────────────────────────────────────────────────────────
  const [clips,      setClips]      = useState<RecordedClip[]>([]);
  const [autoSplit,  setAutoSplit]  = useState(false);
  const [splitSilDb, setSplitSilDb] = useState(-45);
  const [splitSilMs, setSplitSilMs] = useState(1500);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats,      setStats]      = useState<AudioStats>(EMPTY_STATS);
  const [levelL,     setLevelL]     = useState(0);
  const [levelR,     setLevelR]     = useState(0);
  const [peakNorm,   setPeakNorm]   = useState(0);

  // ── Audio Refs ────────────────────────────────────────────────────────────
  const ctxRef       = useRef<AudioContext | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const sourceRef    = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef      = useRef<GainNode | null>(null);
  const gateGainRef  = useRef<GainNode | null>(null);
  const eqNodesRef   = useRef<BiquadFilterNode[]>([]);
  const compRef      = useRef<DynamicsCompressorNode | null>(null);
  const waveAnRef    = useRef<AnalyserNode | null>(null);
  const freqAnRef    = useRef<AnalyserNode | null>(null);
  const leftAnRef    = useRef<AnalyserNode | null>(null);
  const rightAnRef   = useRef<AnalyserNode | null>(null);
  const splitRef     = useRef<ChannelSplitterNode | null>(null);
  const monGainRef   = useRef<GainNode | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const lastNodeRef  = useRef<AudioNode | null>(null);
  const animRef      = useRef<number | null>(null);
  const peakTORef    = useRef<number | null>(null);

  // ── Recording Refs ────────────────────────────────────────────────────────
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const recStartRef      = useRef<number>(0);
  const recTimerRef      = useRef<number | null>(null);
  const silenceTimerRef  = useRef<number | null>(null);
  const recPeakRef       = useRef<number>(-60);
  const previewBufRef    = useRef<number[]>([]);
  const previewTimerRef  = useRef<number | null>(null);

  // ── Stats Refs ────────────────────────────────────────────────────────────
  const dbHistRef    = useRef<number[]>([]);
  const lufsHistRef  = useRef<number[]>([]);
  const midiRef      = useRef<MIDIAccess | null>(null);

  // ── Gate State Machine Refs ────────────────────────────────────────────────
  const gateStateRef = useRef<"open" | "hold" | "closed">("closed");
  const gateHoldRef  = useRef<number | null>(null);

  // ─── Device Enumeration ──────────────────────────────────────────────────
  useEffect(() => {
    const scan = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const ins = all.filter(d => d.kind === "audioinput" && d.deviceId);
        setDevices(ins);
        if (ins.length && !selDevice) setSelDevice(ins[0].deviceId);
        if (!ins.length) setWarning("No audio input detected.");
      } catch { setWarning("Cannot enumerate audio devices."); }
    };
    scan();
    navigator.mediaDevices.addEventListener("devicechange", scan);
    return () => navigator.mediaDevices.removeEventListener("devicechange", scan);
  }, []);

  // ─── MIDI ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!midiOn) { setMidiStatus("Disabled"); return; }
    navigator.requestMIDIAccess?.({ sysex: false }).then(access => {
      midiRef.current = access;
      const ins = Array.from(access.inputs.values());
      if (!ins.length) { setMidiStatus("No devices found"); return; }
      setMidiStatus(`${ins.length} device${ins.length > 1 ? "s" : ""} connected`);
      ins.forEach(i => { i.onmidimessage = ev => onMidiMessage?.(ev); });
      access.onstatechange = () => setMidiStatus(`${Array.from(access.inputs.values()).length} device(s)`);
    }).catch(() => setMidiStatus("Access denied"));
    return () => { midiRef.current && Array.from(midiRef.current.inputs.values()).forEach(i => { i.onmidimessage = null; }); };
  }, [midiOn, onMidiMessage]);

  // ─── Level Metering + Pitch + LUFS + Gate ───────────────────────────────
  useEffect(() => {
    if (!isActive || !waveAnRef.current) return;
    const wAn  = waveAnRef.current;
    const fAn  = freqAnRef.current;
    const lAn  = leftAnRef.current;
    const rAn  = rightAnRef.current;
    const gRef = gateGainRef.current;
    const cRef = compRef.current;

    const wBuf  = new Float32Array(wAn.frequencyBinCount);
    const wBufU = new Uint8Array(wAn.frequencyBinCount);
    const _fBufU = fAn ? new Uint8Array(fAn.frequencyBinCount) : null;
    const lBuf  = lAn ? new Uint8Array(lAn.frequencyBinCount) : null;
    const rBuf  = rAn ? new Uint8Array(rAn.frequencyBinCount) : null;

    let lufsTickRef = { val: 0 };

    const tick = () => {
      wAn.getFloatTimeDomainData(wBuf);
      wAn.getByteTimeDomainData(wBufU);

      // RMS + dB
      let sum = 0;
      for (let i = 0; i < wBuf.length; i++) sum += wBuf[i] * wBuf[i];
      const rms = Math.sqrt(sum / wBuf.length);
      const db  = 20 * Math.log10(Math.max(rms, 1e-5));
      const norm = dbNorm(db);

      // History
      const dh = dbHistRef.current;
      dh.push(db); if (dh.length > DB_HIST_LEN) dh.shift();
      const avg = dh.reduce((a,b) => a+b,0) / dh.length;
      const pk  = Math.max(...dh);

      // LUFS (simplified: RMS energy rolling window)
      lufsTickRef.val++;
      if (lufsTickRef.val % 6 === 0) { // ~10/s at 60fps
        lufsHistRef.current.push(rms);
        if (lufsHistRef.current.length > LUFS_WIN) lufsHistRef.current.shift();
      }
      const lufsRms = lufsHistRef.current.length
        ? Math.sqrt(lufsHistRef.current.reduce((a,b) => a+b*b,0) / lufsHistRef.current.length)
        : 1e-5;
      const lufs = 20 * Math.log10(Math.max(lufsRms, 1e-5)) - 0.7;

      // Pitch detection
      let note = "—", cents = 0, frequency = "—";
      if (rms > 0.008) {
        const hz = detectPitch(wBuf, ctxRef.current!.sampleRate);
        if (hz && hz > 60 && hz < 2000) {
          frequency = `${Math.round(hz)} Hz`;
          const r = freqToNote(hz);
          note = `${r.note}${r.octave}`; cents = r.cents;
        }
      }

      // L/R meters
      let leftDb = -60, rightDb = -60;
      if (lBuf && lAn) {
        lAn.getByteTimeDomainData(lBuf);
        let ls = 0; for (let i = 0; i < lBuf.length; i++) { const n = (lBuf[i]-128)/128; ls += n*n; }
        leftDb = 20 * Math.log10(Math.max(Math.sqrt(ls/lBuf.length), 1e-5));
      }
      if (rBuf && rAn) {
        rAn.getByteTimeDomainData(rBuf);
        let rs = 0; for (let i = 0; i < rBuf.length; i++) { const n = (rBuf[i]-128)/128; rs += n*n; }
        rightDb = 20 * Math.log10(Math.max(Math.sqrt(rs/rBuf.length), 1e-5));
      }

      // Gate
      let gateOpen = true;
      if (gRef && gate.enabled) {
        if (db > gate.threshold) {
          if (gateStateRef.current !== "open") {
            gateStateRef.current = "open";
            if (gateHoldRef.current) clearTimeout(gateHoldRef.current);
            gRef.gain.setTargetAtTime(1, ctxRef.current!.currentTime, gate.attack / 1000 * 0.3);
          }
        } else {
          if (gateStateRef.current === "open") {
            gateStateRef.current = "hold";
            gateHoldRef.current = window.setTimeout(() => {
              gateStateRef.current = "closed";
              gRef.gain.setTargetAtTime(0, ctxRef.current!.currentTime, gate.release / 1000 * 0.3);
            }, gate.hold);
          }
          gateOpen = gateStateRef.current !== "closed";
        }
      }

      // Compressor GR
      const gr = cRef && comp.enabled ? Math.abs(cRef.reduction) : 0;

      setStats({ currentDb: Math.round(db*10)/10, peakDb: Math.round(pk*10)/10,
        avgDb: Math.round(avg*10)/10, lufs: Math.round(lufs*10)/10,
        leftDb: Math.round(leftDb*10)/10, rightDb: Math.round(rightDb*10)/10,
        note, cents, frequency, gr: Math.round(gr*10)/10, gateOpen });
      setLevelL(dbNorm(leftDb || db));
      setLevelR(dbNorm(rightDb || db));
      if (norm > peakNorm) {
        setPeakNorm(norm);
        if (peakTORef.current) clearTimeout(peakTORef.current);
        peakTORef.current = window.setTimeout(() => setPeakNorm(0), 2500);
      }

      // Recording peak tracking
      if (isRec && db > recPeakRef.current) recPeakRef.current = db;

      // Auto-split silence detection
      if (isRec && autoSplit && gRef) {
        if (db < splitSilDb) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              stopRecording(); setTimeout(startRecording, 50);
            }, splitSilMs);
          }
        } else {
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        }
      }

      onAudioData && (() => {
        const out = new Float32Array(wBuf.length);
        for (let i = 0; i < wBuf.length; i++) out[i] = wBuf[i];
        onAudioData(out);
      })();

      animRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (peakTORef.current) clearTimeout(peakTORef.current);
      if (gateHoldRef.current) clearTimeout(gateHoldRef.current);
    };
  }, [isActive, gate, comp, isRec, autoSplit, splitSilDb, splitSilMs, peakNorm, onAudioData]);

  // ─── Build Audio Graph ───────────────────────────────────────────────────
  const buildGraph = useCallback(async () => {
    const ctx = ctxRef.current!;
    if (ctx.state === "suspended") await ctx.resume();
    const stream = streamRef.current!;

    const source = ctx.createMediaStreamSource(stream);
    const gainNode = ctx.createGain(); gainNode.gain.value = (inputGain / 100) * 3;
    const gateGain = ctx.createGain(); gateGain.gain.value = 1;

    // EQ filters
    const filters = DEFAULT_EQ_BANDS.map((b, i) => {
      const f = ctx.createBiquadFilter();
      f.type = b.type; f.frequency.value = b.frequency;
      f.gain.value = eqBands[i]?.gain ?? 0;
      f.Q.value = b.q;
      return f;
    });

    // Compressor
    const compNode = ctx.createDynamicsCompressor();
    compNode.threshold.value = comp.threshold;
    compNode.ratio.value     = comp.ratio;
    compNode.attack.value    = comp.attack / 1000;
    compNode.release.value   = comp.release / 1000;
    compNode.knee.value      = comp.knee;

    // Analysers
    const waveAn = ctx.createAnalyser(); waveAn.fftSize = 4096; waveAn.smoothingTimeConstant = 0.8;
    const freqAn = ctx.createAnalyser(); freqAn.fftSize = 2048; freqAn.smoothingTimeConstant = 0.85;
    const splitter = ctx.createChannelSplitter(2);
    const leftAn  = ctx.createAnalyser(); leftAn.fftSize = 1024;
    const rightAn = ctx.createAnalyser(); rightAn.fftSize = 1024;
    const monGain = ctx.createGain(); monGain.gain.value = monitoring && !isMuted ? 1 : 0;
    const streamDest = ctx.createMediaStreamDestination();

    // Wire: source → gain → [eq filters] → gateGain → [compressor] → waveAn → freqAn → splitter → L/R analysers → monGain → dest + streamDest
    let last: AudioNode = source;
    last.connect(gainNode); last = gainNode;
    if (eqEnable) { filters.forEach(f => { last.connect(f); last = f; }); }
    last.connect(gateGain); last = gateGain;
    if (comp.enabled) { last.connect(compNode); last = compNode; }
    last.connect(waveAn);
    last.connect(freqAn);
    last.connect(splitter);
    splitter.connect(leftAn, 0);
    splitter.connect(rightAn, 1);
    last.connect(monGain);
    monGain.connect(ctx.destination);
    last.connect(streamDest);
    lastNodeRef.current = last;

    sourceRef.current = source; gainRef.current = gainNode; gateGainRef.current = gateGain;
    eqNodesRef.current = filters; compRef.current = compNode;
    waveAnRef.current = waveAn; freqAnRef.current = freqAn;
    leftAnRef.current = leftAn; rightAnRef.current = rightAn;
    splitRef.current = splitter; monGainRef.current = monGain;
    streamDestRef.current = streamDest;
  }, [inputGain, eqBands, eqEnable, comp, monitoring, isMuted]);

  // ─── Start Microphone ────────────────────────────────────────────────────
  const startMicrophone = useCallback(async () => {
    try {
      setError(""); setWarning("");
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...(selDevice ? { deviceId: { exact: selDevice } } : {}), echoCancellation: echoCxl, noiseSuppression: noiseSupp, autoGainControl: autoGain, channelCount: 2 },
      });
      streamRef.current = stream;
      await buildGraph();
      setIsActive(true);
      gateStateRef.current = "closed";
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError")  setError("Microphone permission denied.");
      else if (e.name === "NotFoundError") setError("No microphone found.");
      else if (e.name === "NotReadableError") setError("Microphone in use by another app.");
      else setError(`Error: ${e.message}`);
    }
  }, [selDevice, echoCxl, noiseSupp, autoGain, buildGraph]);

  // ─── Stop Microphone ─────────────────────────────────────────────────────
  const stopMicrophone = useCallback(() => {
    if (isRec) stopRecording();
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    [sourceRef, gainRef, gateGainRef, compRef, waveAnRef, freqAnRef, leftAnRef, rightAnRef, monGainRef].forEach(r => {
      if (r.current) { try { r.current.disconnect(); } catch {} r.current = null; }
    });
    eqNodesRef.current.forEach(f => { try { f.disconnect(); } catch {} });
    eqNodesRef.current = [];
    setIsActive(false); setLevelL(0); setLevelR(0); setPeakNorm(0);
    dbHistRef.current = []; lufsHistRef.current = [];
    setStats(EMPTY_STATS);
  }, [isRec]);

  // ─── Recording ───────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamDestRef.current || isRec) return;
    const dest = streamDestRef.current;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "audio/webm";
    const rec = new MediaRecorder(dest.stream, { mimeType });
    chunksRef.current = []; recPeakRef.current = -60; previewBufRef.current = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const dur  = (Date.now() - recStartRef.current) / 1000;
      const clip: RecordedClip = {
        id: `clip-${Date.now()}`, name: `Take ${Date.now().toString().slice(-5)}`,
        blob, url: URL.createObjectURL(blob),
        duration: dur, sizeKb: blob.size / 1024,
        timestamp: Date.now(), peakDb: recPeakRef.current,
        wavePreview: [...previewBufRef.current],
      };
      setClips(prev => [clip, ...prev]);
      onClipRecorded?.(clip);
    };
    recStartRef.current = Date.now();
    rec.start(100);
    recorderRef.current = rec;
    setIsRec(true);
    setRecTime(0);
    recTimerRef.current = window.setInterval(() => setRecTime(t => t + 1), 1000);
    // Preview waveform sampling
    previewTimerRef.current = window.setInterval(() => {
      if (!waveAnRef.current) return;
      const buf = new Uint8Array(waveAnRef.current.frequencyBinCount);
      waveAnRef.current.getByteTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) { const n = (buf[i]-128)/128; s += n*n; }
      previewBufRef.current.push(Math.sqrt(s / buf.length));
      if (previewBufRef.current.length > PREVIEW_BINS) previewBufRef.current.shift();
    }, 100);
  }, [isRec, onClipRecorded]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || !isRec) return;
    try { recorderRef.current.stop(); } catch {}
    recorderRef.current = null;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (previewTimerRef.current) { clearInterval(previewTimerRef.current); previewTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setIsRec(false);
  }, [isRec]);

  const deleteClip = (id: string) => setClips(prev => {
    const c = prev.find(x => x.id === id);
    if (c) URL.revokeObjectURL(c.url);
    return prev.filter(x => x.id !== id);
  });

  const downloadClip = (c: RecordedClip) => {
    const a = document.createElement("a"); a.href = c.url;
    a.download = `${c.name.replace(/\s+/g,"_")}.webm`; a.click();
  };

  // ─── Live Gain Control ───────────────────────────────────────────────────
  const handleGain = useCallback((v: number) => {
    setInputGain(v);
    if (gainRef.current) gainRef.current.gain.value = (v / 100) * 3;
  }, []);

  // ─── Monitoring Toggle ───────────────────────────────────────────────────
  const toggleMonitor = useCallback(() => {
    const next = !monitoring; setMonitoring(next);
    if (monGainRef.current) monGainRef.current.gain.value = next && !isMuted ? 1 : 0;
  }, [monitoring, isMuted]);

  const toggleMute = useCallback(() => {
    const next = !isMuted; setIsMuted(next);
    if (monGainRef.current) monGainRef.current.gain.value = !next && monitoring ? 1 : 0;
  }, [isMuted, monitoring]);

  // ─── EQ Band Update ──────────────────────────────────────────────────────
  const updateEQBand = useCallback((idx: number, gain: number) => {
    setEqBands(prev => prev.map((b, i) => i === idx ? { ...b, gain } : b));
    const node = eqNodesRef.current[idx];
    if (node) node.gain.value = gain;
  }, []);

  const applyEQPreset = useCallback((key: EQPresetKey) => {
    const gains = EQ_PRESETS[key].bands;
    setEqBands(prev => prev.map((b, i) => ({ ...b, gain: gains[i] ?? 0 })));
    eqNodesRef.current.forEach((n, i) => { if (n) n.gain.value = gains[i] ?? 0; });
  }, []);

  // ─── Compressor Live Update ───────────────────────────────────────────────
  const updateComp = useCallback((patch: Partial<CompCfg>) => {
    setComp(prev => {
      const next = { ...prev, ...patch };
      if (compRef.current) {
        if (patch.threshold !== undefined) compRef.current.threshold.value = patch.threshold;
        if (patch.ratio !== undefined)     compRef.current.ratio.value = patch.ratio;
        if (patch.attack !== undefined)    compRef.current.attack.value = patch.attack / 1000;
        if (patch.release !== undefined)   compRef.current.release.value = patch.release / 1000;
        if (patch.knee !== undefined)      compRef.current.knee.value = patch.knee;
      }
      return next;
    });
  }, []);

  // ─── Restart on constraint changes ───────────────────────────────────────
  useEffect(() => {
    if (isActive) { stopMicrophone(); setTimeout(startMicrophone, 150); }
  }, [noiseSupp, echoCxl, autoGain]);

  // ─── Keyboard Shortcuts (panel-scoped only) ───────────────────────────────
  // Bound to the root div via onKeyDown — NOT window — so Space/R/M only fire
  // when the mic panel itself (or a child) holds focus. This prevents collision
  // with the instrument page's global Space→play() and Ctrl+R→record() bindings.
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (["INPUT","TEXTAREA","SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
    if (e.key === " ") { e.preventDefault(); isActive ? stopMicrophone() : startMicrophone(); }
    if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
      if (isActive) { isRec ? stopRecording() : startRecording(); }
    }
    if (e.key === "m" || e.key === "M") { if (isActive) toggleMute(); }
  }, [isActive, isRec, startMicrophone, stopMicrophone, startRecording, stopRecording, toggleMute]);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopMicrophone();
    ctxRef.current?.close();
    clips.forEach(c => URL.revokeObjectURL(c.url));
  }, []);

  const status = useMemo(() => {
    if (isRec)              return { color: RED,   label: `REC ${fmtTime(recTime)}`, pulse: true };
    if (isActive && isMuted) return { color: RED,   label: "MUTED", pulse: false };
    if (isActive && monitoring) return { color: ACID, label: "MONITORING", pulse: true };
    if (isActive)           return { color: ACID,  label: "ACTIVE", pulse: true };
    return                         { color: DIM,   label: "STANDBY", pulse: false };
  }, [isActive, isMuted, monitoring, isRec, recTime]);

  // ─── Dual Level Meter ──────────────────────────────────────────────────────
  const DualMeter = ({ label, pct, peak }: { label: string; pct: number; peak: number }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 7, color: DIM, letterSpacing: 2, marginBottom: 3, textAlign: "center" }}>{label}</div>
      <div style={{ height: 120, background: SURF, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column-reverse", padding: "2px 3px", gap: 1, overflow: "hidden" }}>
        {Array.from({ length: 24 }).map((_, i) => {
          const segPct = (i / 24) * 100;
          const active = segPct <= pct;
          const isPeak = segPct <= peak && segPct > pct;
          return <div key={i} style={{ flex: 1, background: active ? levelColor(segPct) : isPeak ? AMBER : "var(--t-b2x)", transition: "background 0.05s" }} />;
        })}
      </div>
    </div>
  );

  // ─── GR Meter ─────────────────────────────────────────────────────────────
  const GRMeter = ({ gr }: { gr: number }) => {
    const grPct = clamp((gr / 20) * 100, 0, 100);
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 7, color: DIM, letterSpacing: 2, marginBottom: 3, textAlign: "center" }}>GR</div>
        <div style={{ height: 120, background: SURF, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", padding: "2px 3px", gap: 1, overflow: "hidden" }}>
          {Array.from({ length: 24 }).map((_, i) => {
            const segPct = ((23 - i) / 24) * 100;
            return <div key={i} style={{ flex: 1, background: segPct <= grPct ? (grPct > 60 ? RED : AMBER) : "var(--t-b2x)", transition: "background 0.06s" }} />;
          })}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace" }}>
      <style>{`
        @keyframes mic-pulse { 0%,100%{opacity:1}50%{opacity:0.35} }
        .mic-root select option { background:var(--dj-surface); color:#a3e635; }
        .mic-root * { box-sizing:border-box; }
        .mic-root button:focus-visible { outline:1px solid ${ACID}; outline-offset:1px; }
        .clip-row:hover { background:rgba(184,255,0,0.03) !important; }
      `}</style>

      <div className="mic-root" tabIndex={-1} onKeyDown={handlePanelKeyDown} style={{ width: "100%", maxWidth: "100%", background: BLK, overflow: "hidden", outline: "none" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: SURF, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 24, height: 24, background: isActive && !isMuted ? (isRec ? RED : ACID) : isMuted ? RED : "var(--t-b2x)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isActive ? BLK : DIM} strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--white)", letterSpacing: 3, textTransform: "uppercase" }}>MICROPHONE INPUT</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <div style={{ width: 4, height: 4, background: status.color, animation: status.pulse ? "mic-pulse 1.5s infinite" : "none" }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: status.color, letterSpacing: 2 }}>{status.label}</span>
              </div>
            </div>
          </div>
          {/* Stats strip */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {isActive && (
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { v: `${stats.currentDb} dB`, l: "NOW" },
                  { v: `${stats.lufs} L`,       l: "LUFS" },
                  { v: stats.note,              l: "NOTE" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: ACID, letterSpacing: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 7, color: DIM, letterSpacing: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Controls */}
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={toggleMute} disabled={!isActive} title="M — Mute" style={{ width: 28, height: 28, border: `1px solid ${isMuted ? RED : BORDER}`, background: isMuted ? "rgba(255,34,0,0.15)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isActive ? 1 : 0.35 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isMuted ? RED : DIM} strokeWidth="2">
                  {isMuted ? <><path d="M2 2l20 20"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></>
                    : <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></>}
                </svg>
              </button>
              {isActive && (
                <button onClick={isRec ? stopRecording : startRecording} title="R — Record" style={{ width: 28, height: 28, border: `1px solid ${isRec ? RED : BORDER}`, background: isRec ? "rgba(255,34,0,0.2)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={isRec ? RED : DIM} stroke={isRec ? RED : DIM} strokeWidth="1">
                    {isRec ? <rect x="4" y="4" width="16" height="16" /> : <circle cx="12" cy="12" r="7"/>}
                  </svg>
                </button>
              )}
              <button onClick={isActive ? stopMicrophone : startMicrophone} title="Space — ARM/STOP" style={{ height: 28, padding: "0 12px", border: "none", background: isActive ? RED : ACID, color: BLK, fontSize: 9, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                {isActive ? "■ STOP" : "● ARM"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div style={{ margin: "8px 12px", padding: "7px 10px", background: "rgba(255,34,0,0.07)", border: "1px solid rgba(255,34,0,0.25)", fontSize: 10, color: "var(--accent-orange)", letterSpacing: 0.5 }}>⚠ {error}</div>
        )}
        {warning && !error && (
          <div style={{ margin: "8px 12px", padding: "7px 10px", background: "rgba(255,170,0,0.05)", border: "1px solid rgba(255,170,0,0.2)", fontSize: 10, color: "var(--accent-yellow)", letterSpacing: 0.5 }}>⚠ {warning}</div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: SURF }}>
          {(["signal","process","record","route"] as ActiveTab[]).map(t => (
            <Tab key={t} label={t.toUpperCase()} active={tab === t} onClick={() => setTab(t)} />
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: SIGNAL
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "signal" && (
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Scope mode selector */}
            <div style={{ display: "flex", gap: 3 }}>
              {(["wave","spectrum","phase"] as ScopeMode[]).map(m => (
                <button key={m} onClick={() => setScopeMode(m)} style={{ flex: 1, height: 24, border: `1px solid ${scopeMode === m ? ACID : BORDER}`, background: scopeMode === m ? "rgba(184,255,0,0.08)" : "transparent", color: scopeMode === m ? ACID : DIM, fontSize: 8, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                  {m === "wave" ? "WAVEFORM" : m === "spectrum" ? "SPECTRUM" : "PHASE"}
                </button>
              ))}
            </div>

            {/* Scope canvas */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {scopeMode === "wave"     && <WaveScope     node={waveAnRef.current} active={isActive} muted={isMuted} h={80} />}
              {scopeMode === "spectrum" && <SpectrumScope  node={freqAnRef.current} active={isActive} h={80} />}
              {scopeMode === "phase"    && <PhaseScope     left={leftAnRef.current} right={rightAnRef.current} active={isActive} h={100} />}
            </div>

            {/* Level meters + tuner row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Dual meters */}
              <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: SURF, border: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <DualMeter label="L" pct={levelL} peak={peakNorm} />
                <DualMeter label="R" pct={levelR} peak={peakNorm} />
                <GRMeter gr={stats.gr} />
              </div>

              {/* Tuner */}
              <div style={{ flex: "1 1 120px", minWidth: 0, background: SURF, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Tuner note={stats.note.replace(/\d/g,"")} octave={parseInt(stats.note.replace(/\D/g,"")) || 4} cents={stats.cents} active={isActive && stats.note !== "—"} />
              </div>

              {/* Stats panel */}
              <div style={{ flex: "1 1 110px", minWidth: 0, display: "flex", flexDirection: "column", gap: 1, background: SURF, border: `1px solid ${BORDER}`, padding: "8px 10px" }}>
                {[
                  { l: "NOW",  v: `${stats.currentDb} dB`, c: ACID },
                  { l: "PEAK", v: `${stats.peakDb} dB`,    c: stats.peakDb > -6 ? RED : AMBER },
                  { l: "AVG",  v: `${stats.avgDb} dB`,     c: "var(--daw-sub)" },
                  { l: "LUFS", v: `${stats.lufs}`,         c: stats.lufs > -14 ? AMBER : "var(--daw-sub)" },
                  { l: "FREQ", v: stats.frequency,         c: DIM },
                  { l: "GATE", v: stats.gateOpen ? "OPEN" : "CLOSED", c: stats.gateOpen ? ACID : DIM },
                ].map((s,i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: DIM, letterSpacing: 2 }}>{s.l}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: s.c, fontFamily: "inherit" }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Horizontal level meter bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: DIM, letterSpacing: 2 }}>INPUT LEVEL</span>
                <span style={{ fontSize: 9, color: levelL > 90 ? RED : levelL > 75 ? AMBER : ACID, fontFamily: "inherit", fontWeight: 700 }}>{isActive ? `${stats.currentDb} dB` : "— dB"}</span>
              </div>
              <div style={{ height: 20, background: SURF, border: `1px solid ${BORDER}`, display: "flex", gap: 1, padding: "2px 3px", position: "relative" }}>
                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                  const p = (i / BAR_COUNT) * 100;
                  return <div key={i} style={{ flex: 1, background: p <= levelL ? levelColor(p) : p <= peakNorm && p > levelL ? "var(--accent-orange)" : "var(--t-b2x)", transition: "background 0.06s" }} />;
                })}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5px", pointerEvents: "none" }}>
                  {["-60","-30","-12","-6","0 dB"].map(l => <span key={l} style={{ fontSize: 7, color: "var(--dj-dimmer)", fontFamily: "inherit" }}>{l}</span>)}
                </div>
              </div>
            </div>

            {/* Gain knob + Monitor */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: SURF, border: `1px solid ${BORDER}` }}>
              <Knob value={inputGain} min={0} max={300} onChange={handleGain} disabled={!isActive} label="Input Gain" fmt={`${inputGain}%`} size={60} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={toggleMonitor} disabled={!isActive} style={{ height: 32, padding: "0 14px", border: `1px solid ${monitoring ? ACID : BORDER}`, background: monitoring ? ACID : "transparent", color: monitoring ? BLK : DIM, fontSize: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 2, opacity: isActive ? 1 : 0.35 }}>
                  ◄ MONITOR
                </button>
              </div>
              <div style={{ textAlign: "right", fontSize: 8, color: DIM, letterSpacing: 1 }}>
                <div>{ctxRef.current ? `${ctxRef.current.sampleRate} Hz` : "—"}</div>
                <div style={{ color: DIMMER }}>{ctxRef.current ? `${((ctxRef.current.baseLatency ?? 0) * 1000).toFixed(1)} ms` : "—"}</div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PROCESS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "process" && (
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Parametric EQ */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: eqEnable ? ACID : DIM, letterSpacing: 3, textTransform: "uppercase" }}>Parametric EQ</span>
                <Toggle label="" checked={eqEnable} onChange={v => { setEqEnable(v); }} />
              </div>
              {/* Frequency response curve */}
              <div style={{ background: SURF2, border: `1px solid ${BORDER}`, marginBottom: 8, opacity: eqEnable ? 1 : 0.3 }}>
                <EQCurve bands={eqBands} nodes={eqNodesRef.current} h={88} />
              </div>
              {/* EQ Band knobs */}
              <div style={{ display: "flex", justifyContent: "space-around", opacity: eqEnable ? 1 : 0.4 }}>
                {eqBands.map((b, i) => (
                  <Knob key={b.id} value={b.gain} min={-15} max={15} onChange={v => updateEQBand(i, v)}
                    disabled={!eqEnable} label={b.label} fmt={`${b.gain > 0 ? "+" : ""}${b.gain}dB`} size={52} />
                ))}
              </div>
              {/* EQ Presets */}
              <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                {(Object.entries(EQ_PRESETS) as [EQPresetKey, typeof EQ_PRESETS[EQPresetKey]][]).map(([k, p]) => (
                  <button key={k} onClick={() => applyEQPreset(k)} disabled={!eqEnable}
                    style={{ flex: 1, height: 26, border: `1px solid ${BORDER}`, background: "transparent", color: eqEnable ? "var(--text-dim)" : DIM, fontSize: 7, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Noise Gate */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: gate.enabled ? ACID : DIM, letterSpacing: 3, textTransform: "uppercase" }}>Noise Gate</span>
                  <div style={{ width: 8, height: 8, background: isActive && gate.enabled ? (stats.gateOpen ? ACID : RED) : DIMMER }} />
                </div>
                <Toggle label="" checked={gate.enabled} onChange={v => setGate(prev => ({ ...prev, enabled: v }))} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", opacity: gate.enabled ? 1 : 0.35 }}>
                <Knob value={gate.threshold} min={-80} max={0} onChange={v => setGate(p => ({ ...p, threshold: v }))}
                  disabled={!gate.enabled} label="Thresh" fmt={`${gate.threshold} dB`} size={52} />
                <Knob value={gate.attack} min={1} max={200} onChange={v => setGate(p => ({ ...p, attack: v }))}
                  disabled={!gate.enabled} label="Attack" fmt={`${gate.attack} ms`} size={52} />
                <Knob value={gate.release} min={10} max={2000} onChange={v => setGate(p => ({ ...p, release: v }))}
                  disabled={!gate.enabled} label="Release" fmt={`${gate.release} ms`} size={52} />
                <Knob value={gate.hold} min={0} max={500} onChange={v => setGate(p => ({ ...p, hold: v }))}
                  disabled={!gate.enabled} label="Hold" fmt={`${gate.hold} ms`} size={52} />
              </div>
            </div>

            {/* Compressor */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: comp.enabled ? ACID : DIM, letterSpacing: 3, textTransform: "uppercase" }}>Compressor</span>
                  {comp.enabled && isActive && <span style={{ fontSize: 8, color: AMBER, letterSpacing: 1 }}>GR: -{stats.gr} dB</span>}
                </div>
                <Toggle label="" checked={comp.enabled} onChange={v => updateComp({ enabled: v })} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-around", opacity: comp.enabled ? 1 : 0.35 }}>
                <Knob value={comp.threshold} min={-60} max={0} onChange={v => updateComp({ threshold: v })}
                  disabled={!comp.enabled} label="Thresh" fmt={`${comp.threshold} dB`} size={52} />
                <Knob value={comp.ratio} min={1} max={20} onChange={v => updateComp({ ratio: v })}
                  disabled={!comp.enabled} label="Ratio" fmt={`${comp.ratio}:1`} size={52} />
                <Knob value={comp.attack} min={1} max={300} onChange={v => updateComp({ attack: v })}
                  disabled={!comp.enabled} label="Attack" fmt={`${comp.attack} ms`} size={52} />
                <Knob value={comp.release} min={10} max={2000} onChange={v => updateComp({ release: v })}
                  disabled={!comp.enabled} label="Release" fmt={`${comp.release} ms`} size={52} />
                <Knob value={comp.knee} min={0} max={40} onChange={v => updateComp({ knee: v })}
                  disabled={!comp.enabled} label="Knee" fmt={`${comp.knee} dB`} size={52} />
              </div>
            </div>

            {/* Browser DSP constraints */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Browser DSP (restarts mic)</div>
              <Toggle label="Noise Suppression"  sub="Background noise reduction"  checked={noiseSupp}  onChange={setNoiseSupp}  disabled={false} />
              <Toggle label="Echo Cancellation"  sub="Feedback loop prevention"    checked={echoCxl}   onChange={setEchoCxl}   disabled={false} />
              <Toggle label="Auto Gain Control"  sub="Automatic level normalisation" checked={autoGain} onChange={setAutoGain}  disabled={false} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: RECORD
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "record" && (
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Record controls */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <button onClick={isRec ? stopRecording : startRecording} disabled={!isActive}
                  style={{ height: 40, padding: "0 20px", border: "none", background: isRec ? RED : isActive ? ACID : DIM, color: BLK, fontSize: 10, fontWeight: 700, cursor: isActive ? "pointer" : "not-allowed", fontFamily: "inherit", letterSpacing: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill={BLK} stroke={BLK} strokeWidth="1">
                    {isRec ? <rect x="4" y="4" width="16" height="16"/> : <circle cx="12" cy="12" r="8"/>}
                  </svg>
                  {isRec ? `■ STOP  ${fmtTime(recTime)}` : "● RECORD"}
                </button>
                <div style={{ fontSize: 9, color: DIM, letterSpacing: 1 }}>
                  <div>{clips.length} clip{clips.length !== 1 ? "s" : ""}</div>
                  <div style={{ color: DIMMER }}>{fmtTime(clips.reduce((a,c) => a+c.duration, 0))} total</div>
                </div>
              </div>
              <Toggle label="Auto-Split on Silence" sub="Create new clip when silence detected" checked={autoSplit} onChange={setAutoSplit} />
              {autoSplit && (
                <div style={{ display: "flex", gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                  <Knob value={splitSilDb} min={-80} max={-20} onChange={setSplitSilDb} disabled={false} label="Sil. Thresh" fmt={`${splitSilDb} dB`} size={48} />
                  <Knob value={splitSilMs} min={200} max={5000} onChange={setSplitSilMs} disabled={false} label="Sil. Time" fmt={`${(splitSilMs/1000).toFixed(1)} s`} size={48} />
                </div>
              )}
            </div>

            {/* Clip list */}
            <div style={{ border: `1px solid ${BORDER}` }}>
              <div style={{ padding: "8px 12px", background: SURF, borderBottom: `1px solid ${BORDER}`, fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: 3, textTransform: "uppercase" }}>Recorded Clips</div>
              {clips.length === 0 && (
                <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 9, color: DIMMER, letterSpacing: 1 }}>No clips yet. ARM the mic and hit RECORD.</div>
              )}
              {clips.map(c => (
                <div key={c.id} className="clip-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
                  <ClipPreview data={c.wavePreview.length > 0 ? c.wavePreview : Array(PREVIEW_BINS).fill(0.1)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--daw-ghost)", letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 8, color: DIM, marginTop: 2, display: "flex", gap: 8 }}>
                      <span>{fmtTime(c.duration)}</span>
                      <span>{fmtSize(c.sizeKb)}</span>
                      <span style={{ color: c.peakDb > -6 ? RED : AMBER }}>{c.peakDb.toFixed(1)} dB pk</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <button style={{ width: 28, height: 28, border: `1px solid ${BORDER}`, background: "transparent", color: DIM, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </button>
                    </a>
                    <button onClick={() => downloadClip(c)} style={{ width: 28, height: 28, border: `1px solid ${BORDER}`, background: "transparent", color: DIM, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V3"/><path d="M7 10l5 5 5-5"/><path d="M3 20h18"/></svg>
                    </button>
                    <button onClick={() => deleteClip(c.id)} style={{ width: 28, height: 28, border: `1px solid rgba(255,34,0,0.2)`, background: "transparent", color: "rgba(255,34,0,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: ROUTE
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "route" && (
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Device */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <label style={{ fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: 3, display: "block", marginBottom: 6, textTransform: "uppercase" }}>Input Device</label>
              <select value={selDevice || ""} onChange={e => { setSelDevice(e.target.value); if (isActive) { stopMicrophone(); setTimeout(startMicrophone, 150); } }} disabled={isActive}
                style={{ width: "100%", height: 34, padding: "0 10px", background: SURF2, border: `1px solid ${BORDER}`, color: isActive ? DIM : "var(--daw-sub)", fontSize: 10, fontFamily: "inherit", cursor: isActive ? "not-allowed" : "pointer", appearance: "none", outline: "none", opacity: isActive ? 0.5 : 1 }}>
                {devices.length === 0 && <option value="">No devices found</option>}
                {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,8)}`}</option>)}
              </select>
              {isActive && <div style={{ fontSize: 8, color: DIM, marginTop: 4, letterSpacing: 0.5 }}>Stop microphone to change device.</div>}
            </div>

            {/* MIDI */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: midiOn ? ACID : DIM, letterSpacing: 3, textTransform: "uppercase" }}>MIDI Control</div>
                  <div style={{ fontSize: 9, color: DIM, marginTop: 2 }}>{midiStatus}</div>
                </div>
                <Toggle label="" checked={midiOn} onChange={setMidiOn} />
              </div>
            </div>

            {/* Session info */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Session Info</div>
              {[
                { l: "Sample Rate",   v: ctxRef.current ? `${ctxRef.current.sampleRate} Hz` : "—" },
                { l: "Base Latency",  v: ctxRef.current ? `${((ctxRef.current.baseLatency ?? 0)*1000).toFixed(2)} ms` : "—" },
                { l: "Output Latency", v: ctxRef.current ? `${((ctxRef.current.outputLatency ?? 0)*1000).toFixed(2)} ms` : "—" },
                { l: "Clips Recorded", v: `${clips.length}` },
                { l: "Total Duration", v: fmtTime(clips.reduce((a,c) => a+c.duration,0)) },
                { l: "Total Size",     v: fmtSize(clips.reduce((a,c) => a+c.sizeKb,0)) },
              ].map((s,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 8, color: DIM, letterSpacing: 1 }}>{s.l}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--daw-ghost)", fontFamily: "inherit" }}>{s.v}</span>
                </div>
              ))}
            </div>

            {/* Keyboard shortcuts */}
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, padding: "10px 12px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: DIM, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Keyboard Shortcuts</div>
              {[["Space","ARM / STOP microphone"],["R","Start / stop recording"],["M","Mute / unmute"]].map(([k,d],i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "3px 0" }}>
                  <code style={{ fontSize: 9, fontWeight: 700, color: ACID, background: SURF2, border: `1px solid ${BORDER}`, padding: "1px 6px", fontFamily: "inherit" }}>{k}</code>
                  <span style={{ fontSize: 9, color: DIM, letterSpacing: 0.5 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: "5px 12px", borderTop: `1px solid ${BORDER}`, background: SURF, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 7, color: DIMMER, letterSpacing: 2, textTransform: "uppercase" }}>R3 · AUDIO INPUT · v4</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {eqEnable  && <span style={{ fontSize: 7, color: ACID,  letterSpacing: 1 }}>EQ</span>}
            {gate.enabled && <span style={{ fontSize: 7, color: ACID, letterSpacing: 1 }}>GATE</span>}
            {comp.enabled && <span style={{ fontSize: 7, color: ACID, letterSpacing: 1 }}>COMP</span>}
            <span style={{ fontSize: 7, color: isActive ? ACID : DIMMER, letterSpacing: 2 }}>{isActive ? "RUNNING" : "IDLE"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MicrophoneInput };