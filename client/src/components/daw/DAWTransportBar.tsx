import { useCallback } from "react";
import { Play, Square, Circle, SkipBack, Repeat, Music2, Settings } from "lucide-react";
import { useDAWStore, useTransport, useIsDirty } from "@/state/dawStore";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0",
  danger: "#ff3b3b", warn: "#ffb300", font: "monospace",
} as const;

function Btn({ icon, active = false, danger = false, disabled = false, onClick, title }: {
  icon: React.ReactNode; active?: boolean; danger?: boolean;
  disabled?: boolean; onClick?: () => void; title?: string;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
      background: active ? (danger ? "rgba(255,59,59,0.15)" : "rgba(184,255,0,0.1)") : "transparent",
      border: `1px solid ${active ? (danger ? T.danger : T.accent) : T.border}`,
      color: active ? (danger ? T.danger : T.accent) : disabled ? "#333" : T.dim,
      cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
      transition: "all 0.08s",
    }}>
      {icon}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 26, background: T.border, margin: "0 4px", flexShrink: 0 }} />;
}

function PositionDisplay() {
  const { currentBar, currentBeat, currentTick } = useTransport();
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 2,
      fontFamily: T.font, minWidth: 110, flexShrink: 0,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: T.accent, fontVariantNumeric: "tabular-nums",
        textShadow: "0 0 12px rgba(184,255,0,0.4)", letterSpacing: ".02em" }}>
        {String(currentBar).padStart(4, "0")}
      </span>
      <span style={{ fontSize: 11, color: T.dim }}>:</span>
      <span style={{ fontSize: 14, color: T.text, fontVariantNumeric: "tabular-nums" }}>{currentBeat}</span>
      <span style={{ fontSize: 11, color: T.dim }}>:</span>
      <span style={{ fontSize: 11, color: T.dim, fontVariantNumeric: "tabular-nums" }}>
        {String(currentTick).padStart(3, "0")}
      </span>
    </div>
  );
}

export function DAWTransportBar({ onOpenPrefs }: { onOpenPrefs?: () => void }) {
  const { isPlaying, isRecording, isLooping, metronomeOn, tempo, timeSignature } = useTransport();
  const { play, stop, pause, toggleRecord, toggleLoop, toggleMetronome, setTempo, seekTo, setTimeSignature } = useDAWStore();
  const isDirty = useIsDirty();

  const handlePlay = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  return (
    <div style={{
      height: 50, display: "flex", alignItems: "center", gap: 4,
      padding: "0 12px", background: T.bg,
      borderBottom: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      {/* Transport controls */}
      <Btn icon={<SkipBack size={13} />} onClick={() => seekTo(1)} title="Return to start (Home)" />
      <Btn
        icon={isPlaying
          ? <Square size={14} fill="currentColor" />
          : <Play size={14} fill="currentColor" />}
        active={isPlaying}
        onClick={handlePlay}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      />
      <Btn icon={<Square size={14} fill="currentColor" />} onClick={stop} title="Stop (.)"/>
      <Btn
        icon={<Circle size={14} fill={isRecording ? "currentColor" : "none"} />}
        active={isRecording} danger
        onClick={toggleRecord}
        title="Record (Ctrl+R)"
      />

      <Divider />

      {/* Loop + Metronome */}
      <Btn icon={<Repeat size={13} />} active={isLooping}    onClick={toggleLoop}      title="Loop (L)" />
      <Btn icon={<Music2 size={13} />} active={metronomeOn}  onClick={toggleMetronome} title="Metronome (M)" />

      <Divider />

      {/* Position */}
      <PositionDisplay />

      <Divider />

      {/* BPM */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 7, letterSpacing: ".15em", color: T.dim, fontFamily: T.font }}>BPM</span>
        <input type="number" min={20} max={999} step={0.5} value={tempo}
          onChange={e => setTempo(parseFloat(e.target.value) || 120)}
          style={{
            width: 58, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 13, fontWeight: 700,
            padding: "3px 4px", textAlign: "center",
          }}
        />
      </div>

      {/* Time sig */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <input type="number" min={1} max={16} value={timeSignature.numerator}
          onChange={e => setTimeSignature(parseInt(e.target.value) || 4, timeSignature.denominator)}
          style={{ width: 26, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 11, textAlign: "center", padding: "2px 1px" }} />
        <span style={{ color: T.dim, fontSize: 13, fontFamily: T.font }}>/</span>
        <input type="number" min={1} max={16} value={timeSignature.denominator}
          onChange={e => setTimeSignature(timeSignature.numerator, parseInt(e.target.value) || 4)}
          style={{ width: 26, background: T.panel, border: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 11, textAlign: "center", padding: "2px 1px" }} />
      </div>

      {/* Spacer + dirty indicator + prefs */}
      <div style={{ flex: 1 }} />
      {isDirty && (
        <div style={{ fontSize: 7, letterSpacing: ".1em", color: T.warn,
          fontFamily: T.font, textTransform: "uppercase" }}>
          ● unsaved
        </div>
      )}
      {onOpenPrefs && (
        <button onClick={onOpenPrefs} style={{ background: "none", border: "none",
          color: T.dim, cursor: "pointer", padding: "4px 6px", display: "flex" }}>
          <Settings size={13} />
        </button>
      )}
    </div>
  );
}
