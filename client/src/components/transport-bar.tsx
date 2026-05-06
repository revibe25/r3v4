import { useState, useCallback, useEffect } from "react";
import { Play, Square, Circle, SkipBack, Repeat, Mic, Music2 } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", accentDim: "rgba(184,255,0,0.12)",
  text: "#f0f0f0", dim: "#555", danger: "#ff3b3b", font: "monospace",
} as const;

export interface TransportState {
  playing: boolean;
  recording: boolean;
  looping: boolean;
  metronome: boolean;
  bpm: number;
  bar: number;
  beat: number;
  tick: number;
  timeSignature: { numerator: number; denominator: number };
}

export interface TransportBarProps {
  state?: Partial<TransportState>;
  onPlay?: () => void;
  onStop?: () => void;
  onRecord?: () => void;
  onReturnToZero?: () => void;
  onLoopToggle?: () => void;
  onMetronomeToggle?: () => void;
  onBpmChange?: (bpm: number) => void;
  onTimeSignatureChange?: (n: number, d: number) => void;
}

const DEFAULT_STATE: TransportState = {
  playing: false, recording: false, looping: false, metronome: false,
  bpm: 120, bar: 1, beat: 1, tick: 0,
  timeSignature: { numerator: 4, denominator: 4 },
};

function Btn({
  icon, active = false, danger = false, onClick, title,
}: {
  icon: React.ReactNode; active?: boolean; danger?: boolean;
  onClick?: () => void; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, display: "flex", alignItems: "center",
        justifyContent: "center", background: active
          ? (danger ? T.danger : T.accentDim)
          : "transparent",
        border: `1px solid ${active ? (danger ? T.danger : T.accent) : T.border}`,
        color: active ? (danger ? T.danger : T.accent) : T.dim,
        cursor: "pointer", flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

export function TransportBar({
  state: externalState,
  onPlay, onStop, onRecord, onReturnToZero,
  onLoopToggle, onMetronomeToggle, onBpmChange, onTimeSignatureChange,
}: TransportBarProps) {
  const [internal, setInternal] = useState<TransportState>(DEFAULT_STATE);
  const s = { ...internal, ...externalState };

  const toggle = (k: keyof TransportState) =>
    setInternal(prev => ({ ...prev, [k]: !prev[k as keyof typeof prev] }));

  const handlePlay = useCallback(() => {
    if (!externalState) setInternal(prev => ({ ...prev, playing: !prev.playing }));
    onPlay?.();
  }, [externalState, onPlay]);

  const handleStop = useCallback(() => {
    if (!externalState) setInternal(prev => ({ ...prev, playing: false, recording: false }));
    onStop?.();
  }, [externalState, onStop]);

  const handleRecord = useCallback(() => {
    if (!externalState) toggle("recording");
    onRecord?.();
  }, [externalState, onRecord]);

  const handleBpm = useCallback((v: number) => {
    const clamped = Math.max(20, Math.min(999, v));
    if (!externalState) setInternal(prev => ({ ...prev, bpm: clamped }));
    onBpmChange?.(clamped);
  }, [externalState, onBpmChange]);

  return (
    <div style={{
      height: 48, display: "flex", alignItems: "center", gap: 6,
      padding: "0 12px", background: T.bg,
      borderBottom: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      <Btn icon={<SkipBack size={13} />} onClick={() => { onReturnToZero?.(); }} title="Return to zero" />

      <Btn
        icon={s.playing ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        active={s.playing} onClick={s.playing ? handleStop : handlePlay}
        title={s.playing ? "Stop" : "Play"}
      />
      <Btn icon={<Square size={13} fill="currentColor" />} onClick={handleStop} title="Stop" />
      <Btn icon={<Circle size={13} fill="currentColor" />} active={s.recording}
        danger={s.recording} onClick={handleRecord} title="Record" />

      <div style={{ width: 1, height: 24, background: T.border, margin: "0 4px" }} />

      <Btn icon={<Repeat size={13} />} active={s.looping}
        onClick={() => { toggle("looping"); onLoopToggle?.(); }} title="Loop" />
      <Btn icon={<Music2 size={13} />} active={s.metronome}
        onClick={() => { toggle("metronome"); onMetronomeToggle?.(); }} title="Metronome" />

      <div style={{ width: 1, height: 24, background: T.border, margin: "0 4px" }} />

      {/* Position display */}
      <div style={{
        fontFamily: T.font, fontSize: 11, color: T.accent,
        letterSpacing: ".06em", display: "flex", gap: 2, alignItems: "baseline",
        minWidth: 100,
      }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {String(s.bar).padStart(4, "0")}
        </span>
        <span style={{ color: T.dim, fontSize: 8 }}>:</span>
        <span>{s.beat}</span>
        <span style={{ color: T.dim, fontSize: 8 }}>:</span>
        <span>{String(s.tick).padStart(3, "0")}</span>
      </div>

      <div style={{ width: 1, height: 24, background: T.border, margin: "0 4px" }} />

      {/* BPM */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 7, letterSpacing: ".15em", color: T.dim, fontFamily: T.font }}>
          BPM
        </span>
        <input
          type="number" min={20} max={999} step={0.1}
          value={s.bpm}
          onChange={e => handleBpm(parseFloat(e.target.value))}
          style={{
            width: 54, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 11,
            padding: "2px 4px", textAlign: "center",
          }}
        />
      </div>

      {/* Time Signature */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <input
          type="number" min={1} max={16}
          value={s.timeSignature.numerator}
          onChange={e => onTimeSignatureChange?.(
            parseInt(e.target.value), s.timeSignature.denominator)}
          style={{
            width: 28, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 10,
            padding: "2px 2px", textAlign: "center",
          }}
        />
        <span style={{ color: T.dim, fontFamily: T.font, fontSize: 10 }}>/</span>
        <input
          type="number" min={1} max={16}
          value={s.timeSignature.denominator}
          onChange={e => onTimeSignatureChange?.(
            s.timeSignature.numerator, parseInt(e.target.value))}
          style={{
            width: 28, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 10,
            padding: "2px 2px", textAlign: "center",
          }}
        />
      </div>
    </div>
  );
}
