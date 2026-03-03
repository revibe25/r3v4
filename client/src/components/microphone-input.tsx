// client/src/components/microphone-input.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
type EQPreset = "flat" | "voice" | "live" | "bright";

interface AudioStats {
  currentDb: number;
  peakDb: number;
  averageDb: number;
  frequency: string;
}

interface MicrophoneInputProps {
  onAudioData?: (data: Float32Array) => void;
  onMidiMessage?: (message: MIDIMessageEvent) => void;
}

interface EQPresetConfig {
  label: string;
  low: number;
  mid: number;
  high: number;
}

interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  isMuted: boolean;
  width?: number;
  height?: number;
}

interface SpectrumVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  width?: number;
  height?: number;
}

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label: string;
  sublabel?: string;
}

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  label: string;
  displayValue: string;
  size?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const EQ_PRESETS: Record<EQPreset, EQPresetConfig> = {
  flat: { label: "Flat", low: 0, mid: 0, high: 0 },
  voice: { label: "Voice", low: -3, mid: 3, high: 2 },
  live: { label: "Live", low: 2, mid: 1, high: 3 },
  bright: { label: "Bright", low: -2, mid: 0, high: 5 },
};
const BAR_COUNT = 48;
const DB_HISTORY_LENGTH = 120;

// ─── Utility Helpers ────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function dbToNorm(db: number): number {
  return clamp((db + 60) * (100 / 60), 0, 100);
}
// Acid techno design tokens
const ACID = "#b8ff00";
const MIC_BLACK = "#000000";
const MIC_SURFACE = "#0c0c0c";
const MIC_SURFACE2 = "#111111";
const MIC_BORDER = "#222222";

function getLevelColor(pct: number): string {
  if (pct > 90) return "#ff2200";
  if (pct > 75) return "#ffaa00";
  return ACID;
}

// ─── Waveform Visualizer ────────────────────────────────────────────────────
function WaveformVisualizer({ analyserNode, isActive, isMuted, width = 280, height = 64 }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!analyserNode || !isActive) {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(100,116,139,0.2)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }
    const bufLen = analyserNode.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    const draw = () => {
      analyserNode.getByteTimeDomainData(dataArr);
      ctx.clearRect(0, 0, width, height);
      ctx.shadowColor = isMuted ? "#ff2200" : "#b8ff00";
      ctx.shadowBlur = 4;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isMuted ? "rgba(255,34,0,0.8)" : "rgba(184,255,0,0.85)";
      ctx.beginPath();
      const sliceWidth = width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = dataArr[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [analyserNode, isActive, isMuted, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height }} />;
}

// ─── Spectrum Visualizer ────────────────────────────────────────────────────
function SpectrumVisualizer({ analyserNode, isActive, width = 280, height = 48 }: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!analyserNode || !isActive) { ctx.clearRect(0, 0, width, height); return; }
    const bufLen = analyserNode.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    const draw = () => {
      analyserNode.getByteFrequencyData(dataArr);
      ctx.clearRect(0, 0, width, height);
      const bars = 64;
      const barW = width / bars - 1;
      const step = Math.floor(bufLen / bars);
      for (let i = 0; i < bars; i++) {
        const val = dataArr[i * step] / 255;
        const barH = val * height;
        const hue = 160 - val * 120;
        ctx.fillStyle = `rgba(184,255,0,${0.3 + val * 0.7})`;
        ctx.fillRect(i * (barW + 1), height - barH, barW, barH);
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [analyserNode, isActive, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height }} />;
}

// ─── Toggle Switch — Industrial ─────────────────────────────────────────────
function Toggle({ checked, onChange, disabled = false, label, sublabel }: ToggleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", opacity: disabled ? 0.35 : 1 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
        {sublabel && <div style={{ fontSize: 9, color: "#444", marginTop: 1, letterSpacing: 0.5 }}>{sublabel}</div>}
      </div>
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => { if (!disabled) onChange(!checked); }}
        onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onChange(!checked); } }}
        style={{
          width: 36, height: 16, borderRadius: 0, padding: 2, cursor: disabled ? "not-allowed" : "pointer",
          backgroundColor: checked ? ACID : MIC_SURFACE2,
          border: `1px solid ${checked ? ACID : MIC_BORDER}`,
          transition: "background-color 0.15s, border-color 0.15s",
          display: "flex", alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: 0,
          backgroundColor: checked ? MIC_BLACK : "#444",
          transform: checked ? "translateX(18px)" : "translateX(0)", transition: "transform 0.15s",
        }} />
      </div>
    </div>
  );
}

// ─── Knob Control — Industrial ──────────────────────────────────────────────
function Knob({ value, min = 0, max = 300, onChange, disabled = false, label, displayValue, size = 64 }: KnobProps) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const pct = (value - min) / (max - min);
  const angle = pct * 270 - 135;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const sa = -225 * (Math.PI / 180);
  const ea = (-225 + pct * 270) * (Math.PI / 180);
  const ax1 = cx + r * Math.cos(sa);
  const ay1 = cy + r * Math.sin(sa) + 2;
  const ax2 = cx + r * Math.cos(ea);
  const ay2 = cy + r * Math.sin(ea) + 2;
  const la = pct * 270 > 180 ? 1 : 0;

  const onPD = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    dragging.current = true; startY.current = e.clientY; startVal.current = value;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPM = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const delta = startY.current - e.clientY;
    onChange(Math.round(clamp(startVal.current + (delta / 150) * (max - min), min, max)));
  };
  const onPU = () => { dragging.current = false; };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size + 4} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU}
        style={{ cursor: disabled ? "not-allowed" : "grab", touchAction: "none", opacity: disabled ? 0.35 : 1 }}>
        {/* Track ring */}
        <circle cx={cx} cy={cy + 2} r={r} fill="none" stroke={MIC_SURFACE2} strokeWidth={3}
          strokeDasharray="2 3" />
        {/* Active arc */}
        {pct > 0.01 && (
          <path d={`M ${ax1} ${ay1} A ${r} ${r} 0 ${la} 1 ${ax2} ${ay2}`} fill="none"
            stroke={pct > 0.85 ? "#ffaa00" : ACID} strokeWidth={3} strokeLinecap="butt" />
        )}
        {/* Knob body — industrial flat */}
        <circle cx={cx} cy={cy + 2} r={r - 8} fill={MIC_SURFACE} stroke={MIC_BORDER} strokeWidth={1} />
        {/* Indicator line */}
        <line x1={cx} y1={cy + 2 - r + 12} x2={cx} y2={cy + 2 - r + 20}
          stroke={ACID} strokeWidth={2} strokeLinecap="square" transform={`rotate(${angle}, ${cx}, ${cy + 2})`} />
      </svg>
      <div style={{ fontSize: 10, fontWeight: 700, color: ACID, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1 }}>{displayValue}</div>
      <div style={{ fontSize: 8, color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{label}</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function MicrophoneInput({ onAudioData, onMidiMessage }: MicrophoneInputProps) {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(undefined);
  const [inputGain, setInputGain] = useState(100);
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(false);
  const [compressorEnabled, setCompressorEnabled] = useState(false);
  const [eqPreset, setEqPreset] = useState<EQPreset>("flat");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [midiStatus, setMidiStatus] = useState("(disabled)");
  const [autoSplit, setAutoSplit] = useState(false);
  const [longRecordingMode, setLongRecordingMode] = useState(false);
  const [audioStats, setAudioStats] = useState<AudioStats>({ currentDb: -60, peakDb: -60, averageDb: -60, frequency: "—" });

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqAnalyserRef = useRef<AnalyserNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const eqRef = useRef<BiquadFilterNode[]>([]);
  const lastNodeRef = useRef<AudioNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const peakTimeoutRef = useRef<number | null>(null);
  const dbHistoryRef = useRef<number[]>([]);
  const midiAccessRef = useRef<MIDIAccess | null>(null);

  // ── Device Enumeration ──
  useEffect(() => {
    const getDevices = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const inputs = list.filter((d) => d.kind === "audioinput" && d.deviceId);
        setDevices(inputs);
        if (inputs.length && !selectedDevice) setSelectedDevice(inputs[0].deviceId);
        if (!inputs.length) setWarning("No microphone detected. Connect one to get started.");
      } catch { setWarning("Unable to detect audio devices."); }
    };
    getDevices();
    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", getDevices);
  }, []);

  // ── MIDI ──
  useEffect(() => {
    if (!midiEnabled) return;
    const setupMIDI = async () => {
      try {
        const access = await navigator.requestMIDIAccess({ sysex: false });
        midiAccessRef.current = access;
        const inputs = Array.from(access.inputs.values());
        if (!inputs.length) { setMidiStatus("No MIDI devices"); setWarning("Connect a MIDI device"); return; }
        setMidiStatus(`Connected: ${inputs.length} device(s)`); setWarning("");
        inputs.forEach((inp) => { inp.onmidimessage = (ev) => { if (onMidiMessage) onMidiMessage(ev); }; });
        access.onstatechange = () => { setMidiStatus(`Connected: ${Array.from(access.inputs.values()).length} device(s)`); };
      } catch { setMidiStatus("MIDI access denied"); setWarning("MIDI not supported or denied"); }
    };
    setupMIDI();
    return () => { if (midiAccessRef.current) Array.from(midiAccessRef.current.inputs.values()).forEach((i) => { i.onmidimessage = null; }); };
  }, [midiEnabled, onMidiMessage]);

  // ── Dominant Freq ──
  const getDominantFreq = useCallback((dataArray: Uint8Array): string => {
    if (!audioContextRef.current) return "—";
    let max = 0, maxIdx = 0;
    for (let i = 2; i < dataArray.length; i++) { if (dataArray[i] > max) { max = dataArray[i]; maxIdx = i; } }
    if (max < 20) return "—";
    const freq = (maxIdx * audioContextRef.current.sampleRate / 2) / dataArray.length;
    return freq > 20 ? `${Math.round(freq)} Hz` : "—";
  }, []);

  // ── Level Metering ──
  useEffect(() => {
    if (!isActive || !analyserRef.current || !freqAnalyserRef.current) return;
    const an = analyserRef.current;
    const fan = freqAnalyserRef.current;
    const update = () => {
      const buf = new Uint8Array(an.frequencyBinCount);
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const n = (buf[i] - 128) / 128; sum += n * n; }
      const rms = Math.sqrt(sum / buf.length);
      const db = 20 * Math.log10(Math.max(rms, 1e-5));
      const norm = dbToNorm(db);
      setLevel(norm);
      const hist = dbHistoryRef.current;
      hist.push(db); if (hist.length > DB_HISTORY_LENGTH) hist.shift();
      const avgDb = hist.reduce((a, b) => a + b, 0) / hist.length;
      const pkDb = Math.max(...hist);
      const fb = new Uint8Array(fan.frequencyBinCount);
      fan.getByteFrequencyData(fb);
      setAudioStats({ currentDb: Math.round(db * 10) / 10, peakDb: Math.round(pkDb * 10) / 10, averageDb: Math.round(avgDb * 10) / 10, frequency: getDominantFreq(fb) });
      if (norm > peakLevel) { setPeakLevel(norm); if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current); peakTimeoutRef.current = window.setTimeout(() => setPeakLevel(0), 2500); }
      if (onAudioData) { const fa = new Float32Array(buf.length); for (let i = 0; i < buf.length; i++) fa[i] = (buf[i] - 128) / 128; onAudioData(fa); }
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); if (peakTimeoutRef.current) clearTimeout(peakTimeoutRef.current); };
  }, [isActive, peakLevel, getDominantFreq, onAudioData]);

  // ── EQ Creation ──
  const createEQ = useCallback((ctx: AudioContext, preset: EQPreset): BiquadFilterNode[] => {
    const p = EQ_PRESETS[preset] || EQ_PRESETS.flat;
    const low = ctx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 200; low.gain.value = p.low;
    const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 1; mid.gain.value = p.mid;
    const high = ctx.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 3000; high.gain.value = p.high;
    return [low, mid, high];
  }, []);

  // ── Start ──
  const startMicrophone = useCallback(async () => {
    try {
      setError(""); setWarning("");
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
      const constraints: MediaStreamConstraints = { audio: { ...(selectedDevice ? { deviceId: { exact: selectedDevice } } : {}), echoCancellation, noiseSuppression, autoGainControl } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput" && d.deviceId));
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain(); gain.gain.value = (inputGain / 100) * 3;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
      const freqAn = ctx.createAnalyser(); freqAn.fftSize = 512;
      let last: AudioNode = source; source.connect(gain); last = gain;
      if (eqPreset !== "flat") { const filters = createEQ(ctx, eqPreset); eqRef.current = filters; filters.forEach((f) => { last.connect(f); last = f; }); }
      if (compressorEnabled) { const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.knee.value = 30; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25; last.connect(comp); last = comp; compressorRef.current = comp; }
      last.connect(analyser); last.connect(freqAn); lastNodeRef.current = last;
      if (monitoring) last.connect(ctx.destination);
      sourceRef.current = source; gainNodeRef.current = gain; analyserRef.current = analyser; freqAnalyserRef.current = freqAn;
      setIsActive(true);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") setError("Microphone permission denied. Please allow access in your browser settings.");
        else if (err.name === "NotFoundError") setError("No microphone found. Please connect one and try again.");
        else if (err.name === "NotReadableError") setError("Microphone is in use by another application.");
        else setError(`Microphone error: ${err.message}`);
      } else { setError("An unexpected error occurred. Please refresh and try again."); }
    }
  }, [selectedDevice, echoCancellation, noiseSuppression, autoGainControl, inputGain, eqPreset, compressorEnabled, monitoring, createEQ]);

  // ── Stop ──
  const stopMicrophone = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    [sourceRef, gainNodeRef, analyserRef, freqAnalyserRef, compressorRef].forEach((ref) => { if (ref.current) { try { ref.current.disconnect(); } catch {} ref.current = null; } });
    eqRef.current.forEach((f) => { try { f.disconnect(); } catch {} }); eqRef.current = [];
    lastNodeRef.current = null; setIsActive(false); setLevel(0); setPeakLevel(0);
    dbHistoryRef.current = []; setAudioStats({ currentDb: -60, peakDb: -60, averageDb: -60, frequency: "—" });
  }, []);

  const handleGainChange = useCallback((val: number) => { setInputGain(val); if (gainNodeRef.current) gainNodeRef.current.gain.value = (val / 100) * 3; }, []);

  const toggleMonitoring = useCallback(() => {
    if (!lastNodeRef.current || !audioContextRef.current) return;
    const next = !monitoring; setMonitoring(next);
    if (next && !isMuted) { try { lastNodeRef.current.connect(audioContextRef.current.destination); } catch {} }
    else { try { lastNodeRef.current.disconnect(audioContextRef.current.destination); } catch {} }
  }, [monitoring, isMuted]);

  const toggleMute = useCallback(() => {
    if (!lastNodeRef.current || !audioContextRef.current) return;
    const next = !isMuted; setIsMuted(next);
    if (next) { try { lastNodeRef.current.disconnect(audioContextRef.current.destination); } catch {} }
    else if (monitoring) { try { lastNodeRef.current.connect(audioContextRef.current.destination); } catch {} }
  }, [isMuted, monitoring]);

  const copyStats = useCallback(() => {
    const txt = `Audio Stats\nCurrent: ${audioStats.currentDb} dB\nPeak: ${audioStats.peakDb} dB\nAvg: ${audioStats.averageDb} dB\nFreq: ${audioStats.frequency}`;
    navigator.clipboard.writeText(txt); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000);
  }, [audioStats]);

  useEffect(() => { if (isActive) { stopMicrophone(); setTimeout(startMicrophone, 120); } }, [noiseSuppression, echoCancellation, autoGainControl, compressorEnabled, eqPreset]);
  useEffect(() => { return () => { stopMicrophone(); if (audioContextRef.current) audioContextRef.current.close(); }; }, []);

  const handleDeviceSwitch = useCallback((id: string) => { setSelectedDevice(id); if (isActive) { stopMicrophone(); setTimeout(startMicrophone, 120); } }, [isActive, stopMicrophone, startMicrophone]);

  const status = useMemo(() => {
    if (isActive && isMuted) return { color: "#ff2200", label: "MUTED" };
    if (isActive && monitoring) return { color: ACID, label: "MONITORING" };
    if (isActive) return { color: ACID, label: "ACTIVE" };
    return { color: "#333", label: "STANDBY" };
  }, [isActive, isMuted, monitoring]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}>
      <style>{`
        @keyframes mic-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .mic-panel select option { background: #0c0c0c; color: #b8ff00; }
        .mic-panel * { box-sizing: border-box; }
      `}</style>

      <div className="mic-panel" style={{
        width: "100%", maxWidth: 420,
        position: "relative",
        borderRadius: 0,
        border: `1px solid ${MIC_BORDER}`,
        background: MIC_BLACK,
        boxShadow: "none",
        overflow: "hidden",
      }}>

        {/* ── Header bar ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${MIC_BORDER}`, background: MIC_SURFACE }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: isActive && !isMuted ? ACID : isMuted ? "#ff2200" : "#222",
              color: MIC_BLACK,
              flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isActive ? MIC_BLACK : "#666"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, margin: 0, color: "#fff", lineHeight: 1, letterSpacing: 2, textTransform: "uppercase" }}>MICROPHONE INPUT</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <div style={{ width: 4, height: 4, borderRadius: 0, backgroundColor: status.color, animation: isActive ? "mic-pulse 1.5s infinite" : "none" }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: status.color, letterSpacing: 2 }}>{status.label}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={toggleMute} disabled={!isActive} style={{ width: 28, height: 28, borderRadius: 0, border: `1px solid ${isMuted ? "#ff2200" : MIC_BORDER}`, background: isMuted ? "rgba(255,34,0,0.2)" : "transparent", cursor: isActive ? "pointer" : "not-allowed", opacity: isActive ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isMuted
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff2200" strokeWidth="2" strokeLinecap="round"><path d="M2 2l20 20"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              }
            </button>
            <button onClick={isActive ? stopMicrophone : startMicrophone} style={{ height: 28, borderRadius: 0, border: "none", padding: "0 12px", fontWeight: 700, fontSize: 9, letterSpacing: 2, cursor: "pointer", fontFamily: "inherit", background: isActive ? "#ff2200" : ACID, color: MIC_BLACK, textTransform: "uppercase" }}>
              {isActive ? "■ STOP" : "● ARM"}
            </button>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div style={{ margin: "10px 12px 0", padding: "8px 12px", borderRadius: 0, background: "rgba(255,34,0,0.08)", border: "1px solid rgba(255,34,0,0.3)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff2200" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <span style={{ fontSize: 10, color: "#ff6644", lineHeight: 1.5, letterSpacing: 0.5 }}>{error}</span>
          </div>
        )}
        {warning && !error && (
          <div style={{ margin: "10px 12px 0", padding: "8px 12px", borderRadius: 0, background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.2)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffaa00" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <span style={{ fontSize: 10, color: "#ffcc44", lineHeight: 1.5, letterSpacing: 0.5 }}>{warning}</span>
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ padding: "10px 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Waveform + Spectrum */}
          <div style={{ background: MIC_SURFACE, padding: "8px 10px", border: `1px solid ${MIC_BORDER}` }}>
            <WaveformVisualizer analyserNode={analyserRef.current} isActive={isActive} isMuted={isMuted} height={48} />
            {showSpectrum && <div style={{ marginTop: 6, borderTop: `1px solid ${MIC_BORDER}`, paddingTop: 6 }}><SpectrumVisualizer analyserNode={freqAnalyserRef.current} isActive={isActive} height={36} /></div>}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button onClick={() => setShowSpectrum(!showSpectrum)} style={{ background: "none", border: "none", color: "#444", fontSize: 8, cursor: "pointer", fontFamily: "inherit", padding: "2px 8px", letterSpacing: 1, textTransform: "uppercase" }}>
                {showSpectrum ? "▲ HIDE SPECTRUM" : "▼ SPECTRUM"}
              </button>
            </div>
          </div>

          {/* Level Meter — segmented acid bars */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>INPUT LEVEL</span>
              <span style={{ fontSize: 9, fontFamily: "inherit", fontWeight: 700, color: level > 90 ? "#ff2200" : level > 70 ? "#ffaa00" : ACID }}>{isActive ? `${audioStats.currentDb} dB` : "— dB"}</span>
            </div>
            <div style={{ height: 24, background: MIC_SURFACE, border: `1px solid ${MIC_BORDER}`, overflow: "hidden", display: "flex", gap: 1.5, padding: "3px 4px", position: "relative" }}>
              {Array.from({ length: BAR_COUNT }).map((_, i) => {
                const barPct = (i / BAR_COUNT) * 100;
                const active = barPct <= level;
                const peak = barPct <= peakLevel && barPct > level;
                return <div key={i} style={{ flex: 1, transition: "background-color 0.06s", background: active ? getLevelColor(barPct) : peak ? "#ff6600" : "#1a1a1a" }} />;
              })}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px", pointerEvents: "none" }}>
                <span style={{ fontSize: 7, color: "#333", fontFamily: "inherit" }}>-60</span>
                <span style={{ fontSize: 7, color: "#333", fontFamily: "inherit" }}>-30</span>
                <span style={{ fontSize: 7, color: "#333", fontFamily: "inherit" }}>0 dB</span>
              </div>
            </div>
          </div>

          {/* Device Select */}
          <div>
            <label style={{ fontSize: 8, fontWeight: 700, color: "#555", letterSpacing: 2, display: "block", marginBottom: 5, textTransform: "uppercase" }}>INPUT DEVICE</label>
            <select value={selectedDevice || ""} onChange={(e) => handleDeviceSwitch(e.target.value)} disabled={isActive}
              style={{ width: "100%", height: 34, borderRadius: 0, padding: "0 10px", background: MIC_SURFACE, border: `1px solid ${MIC_BORDER}`, color: isActive ? "#444" : "#aaa", fontSize: 10, fontFamily: "inherit", cursor: isActive ? "not-allowed" : "pointer", outline: "none", opacity: isActive ? 0.5 : 1, appearance: "none" as const }}>
              {devices.length === 0 && <option value="">No devices available</option>}
              {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>)}
            </select>
          </div>

          {/* Knob */}
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
            <Knob value={inputGain} min={0} max={300} onChange={handleGainChange} disabled={!isActive} label="Gain" displayValue={`${inputGain}%`} size={68} />
          </div>

          {/* Monitor & Copy */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={toggleMonitoring} disabled={!isActive} style={{ height: 34, borderRadius: 0, border: `1px solid ${monitoring ? ACID : MIC_BORDER}`, background: monitoring ? ACID : "transparent", color: monitoring ? MIC_BLACK : "#555", fontSize: 9, fontWeight: 700, cursor: isActive ? "pointer" : "not-allowed", opacity: isActive ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              {monitoring ? "MONITORING" : "MONITOR"}
            </button>
            <button onClick={copyStats} disabled={!isActive} style={{ height: 34, borderRadius: 0, border: `1px solid ${copyFeedback ? ACID : MIC_BORDER}`, background: copyFeedback ? ACID : "transparent", color: copyFeedback ? MIC_BLACK : "#555", fontSize: 9, fontWeight: 700, cursor: isActive ? "pointer" : "not-allowed", opacity: isActive ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase" }}>
              {copyFeedback
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="0"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              }
              {copyFeedback ? "COPIED" : "COPY STATS"}
            </button>
          </div>

          {/* Stats Panel */}
          {isActive && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, border: `1px solid ${MIC_BORDER}`, overflow: "hidden" }}>
              {[
                { label: "CURRENT", value: `${audioStats.currentDb}`, unit: "dB", color: ACID },
                { label: "PEAK", value: `${audioStats.peakDb}`, unit: "dB", color: audioStats.peakDb > -6 ? "#ff2200" : "#ffaa00" },
                { label: "AVG", value: `${audioStats.averageDb}`, unit: "dB", color: "#aaa" },
                { label: "FREQ", value: audioStats.frequency, unit: "", color: "#888" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "8px 6px", textAlign: "center", background: MIC_SURFACE, borderRight: i < 3 ? `1px solid ${MIC_BORDER}` : "none" }}>
                  <div style={{ fontSize: 7, fontWeight: 700, color: "#444", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>{s.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "inherit", color: s.color }}>
                    {s.value}{s.unit && <span style={{ fontSize: 8, color: "#333", marginLeft: 2 }}>{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Advanced Settings */}
          <div style={{ border: `1px solid ${MIC_BORDER}`, overflow: "hidden" }}>
            <button onClick={() => setAdvancedOpen(!advancedOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: MIC_SURFACE, border: "none", color: "#555", cursor: "pointer", fontSize: 9, fontWeight: 700, fontFamily: "inherit", letterSpacing: 2, textTransform: "uppercase" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                ADVANCED
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: advancedOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {advancedOpen && (
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ padding: "10px 12px", background: MIC_SURFACE, border: `1px solid ${MIC_BORDER}` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#444", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>AUDIO PROCESSING</div>
                  <Toggle label="Noise Suppression" sublabel="Reduce background noise" checked={noiseSuppression} onChange={setNoiseSuppression} disabled={isActive} />
                  <Toggle label="Echo Cancellation" sublabel="Prevent feedback loops" checked={echoCancellation} onChange={setEchoCancellation} disabled={isActive} />
                  <Toggle label="Auto Gain Control" sublabel="Normalize input levels" checked={autoGainControl} onChange={setAutoGainControl} disabled={isActive} />
                  <div style={{ height: 1, background: MIC_BORDER, margin: "6px 0" }} />
                  <Toggle label="Dynamic Compressor" sublabel="Limit peak volume" checked={compressorEnabled} onChange={setCompressorEnabled} />
                </div>
                <div style={{ padding: "10px 12px", background: MIC_SURFACE, border: `1px solid ${MIC_BORDER}` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#444", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>EQ PRESET</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    {(Object.entries(EQ_PRESETS) as [EQPreset, EQPresetConfig][]).map(([key, preset]) => (
                      <button key={key} onClick={() => setEqPreset(key)} style={{ height: 30, borderRadius: 0, border: `1px solid ${eqPreset === key ? ACID : MIC_BORDER}`, background: eqPreset === key ? ACID : "transparent", color: eqPreset === key ? MIC_BLACK : "#555", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase" }}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", background: MIC_SURFACE, border: `1px solid ${MIC_BORDER}` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#444", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>RECORDING OPTIONS</div>
                  <Toggle label="Auto-Split" sublabel="Split recording on silence" checked={autoSplit} onChange={setAutoSplit} />
                  <Toggle label="Long Recording Mode" sublabel="Optimized for extended sessions" checked={longRecordingMode} onChange={setLongRecordingMode} />
                </div>
                <div style={{ padding: "10px 12px", background: MIC_SURFACE, border: `1px solid ${MIC_BORDER}` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "#444", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>MIDI</div>
                  <Toggle label="MIDI Control" sublabel={midiStatus} checked={midiEnabled} onChange={setMidiEnabled} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "6px 12px", borderTop: `1px solid ${MIC_BORDER}`, display: "flex", justifyContent: "center", background: MIC_SURFACE }}>
          <span style={{ fontSize: 8, color: "#333", fontFamily: "inherit", letterSpacing: 2, textTransform: "uppercase" }}>
            AUDIO ENGINE · {audioContextRef.current ? `${audioContextRef.current.sampleRate} Hz` : "48000 Hz"} · {isActive ? "RUNNING" : "IDLE"}
          </span>
        </div>
      </div>
    </div>
  );
}

export { MicrophoneInput };