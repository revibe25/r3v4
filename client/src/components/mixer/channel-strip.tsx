import { useState, useCallback, useRef } from "react";

const T = {
  bg: "#0a0a0a", panel: "#0d0d0d", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", mute: "#ffb300",
  solo: "#00e5ff", danger: "#ff3b3b", text: "#f0f0f0", font: "monospace",
} as const;

export interface ChannelStripProps {
  id: string;
  name?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  soloed?: boolean;
  armed?: boolean;
  color?: string;
  meter?: number;
  peak?: number;
  inserts?: string[];
  isMaster?: boolean;
  onVolumeChange?: (id: string, v: number) => void;
  onPanChange?: (id: string, v: number) => void;
  onMuteToggle?: (id: string) => void;
  onSoloToggle?: (id: string) => void;
  onArmToggle?: (id: string) => void;
  onNameChange?: (id: string, name: string) => void;
}

function VUMeter({ level = 0, peak = 0, height = 160 }: {
  level?: number; peak?: number; height?: number;
}) {
  const filled = Math.max(0, Math.min(1, level));
  const peakY = Math.max(0, Math.min(1, peak));
  const segCount = Math.round(height / 4);
  return (
    <div style={{
      width: 8, height, display: "flex", flexDirection: "column-reverse",
      gap: 1, flexShrink: 0,
    }}>
      {Array.from({ length: segCount }).map((_, i) => {
        const norm = i / segCount;
        const lit = norm < filled;
        const color = norm > 0.85 ? "#ff3b3b" : norm > 0.7 ? "#ffb300" : T.accent;
        const isPeak = Math.abs(norm - peakY) < 1 / segCount;
        return (
          <div key={i} style={{
            flex: 1, background: lit ? color : (isPeak ? "#ff6b6b" : T.border),
            minHeight: 2,
          }} />
        );
      })}
    </div>
  );
}

export function ChannelStrip({
  id, name = "CH", volume = 0.8, pan = 0, muted = false,
  soloed = false, armed = false, color = T.accent, meter = 0, peak = 0,
  inserts = [], isMaster = false,
  onVolumeChange, onPanChange, onMuteToggle, onSoloToggle, onArmToggle, onNameChange,
}: ChannelStripProps) {
  const [localVol, setLocalVol] = useState(volume);
  const [localPan, setLocalPan] = useState(pan);
  const [editing, setEditing] = useState(false);
  const [localName, setLocalName] = useState(name);

  const handleVol = useCallback((v: number) => {
    setLocalVol(v); onVolumeChange?.(id, v);
  }, [id, onVolumeChange]);

  const handlePan = useCallback((v: number) => {
    setLocalPan(v); onPanChange?.(id, v);
  }, [id, onPanChange]);

  const panLabel = localPan === 0 ? "C"
    : localPan < 0 ? `L${Math.round(Math.abs(localPan) * 100)}`
    : `R${Math.round(localPan * 100)}`;

  return (
    <div style={{
      width: 64, background: T.bg,
      border: `1px solid ${isMaster ? T.solo : T.border}`,
      borderTop: `2px solid ${isMaster ? T.solo : color}`,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "6px 4px", gap: 4, flexShrink: 0, fontFamily: T.font,
      opacity: muted ? 0.5 : 1,
    }}>
      {/* Name */}
      {editing ? (
        <input
          autoFocus value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={() => { setEditing(false); onNameChange?.(id, localName); }}
          onKeyDown={e => { if (e.key === "Enter") { setEditing(false); onNameChange?.(id, localName); } }}
          style={{
            width: "100%", background: T.panel, border: `1px solid ${T.accent}`,
            color: T.text, fontFamily: T.font, fontSize: 7, textAlign: "center",
            padding: "2px 0",
          }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          title="Click to rename"
          style={{
            width: "100%", fontSize: 7, letterSpacing: ".1em", color: T.dim,
            textAlign: "center", overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", cursor: "text", textTransform: "uppercase",
          }}
        >
          {localName}
        </div>
      )}

      {/* Inserts */}
      {inserts.slice(0, 3).map((ins, i) => (
        <div key={i} style={{
          width: "100%", fontSize: 6, background: T.panel,
          border: `1px solid ${T.border}`, color: T.dim,
          padding: "1px 3px", textAlign: "center", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {ins}
        </div>
      ))}

      {/* Meter */}
      <VUMeter level={meter} peak={peak} height={100} />

      {/* Volume fader */}
      <div style={{ position: "relative", height: 80, width: 16, display: "flex", justifyContent: "center" }}>
        <input
          type="range" min={0} max={1} step={0.001}
          value={localVol}
          onChange={e => handleVol(parseFloat(e.target.value))}
          style={{
            writingMode: "vertical-lr" as const, direction: "rtl",
            WebkitAppearance: "slider-vertical",
            width: 16, height: 80, accentColor: isMaster ? T.solo : T.accent, cursor: "pointer",
          } as React.CSSProperties}
          aria-label={`${name} volume`}
        />
      </div>
      <span style={{ fontSize: 7, color: T.dim, fontVariantNumeric: "tabular-nums" }}>
        {Math.round(localVol * 100)}
      </span>

      {/* Pan */}
      <input
        type="range" min={-1} max={1} step={0.01}
        value={localPan}
        onChange={e => handlePan(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: T.accent, cursor: "pointer" }}
        aria-label={`${name} pan`}
      />
      <span style={{ fontSize: 7, color: T.dim }}>{panLabel}</span>

      {/* M / S / Arm */}
      <div style={{ display: "flex", gap: 2, width: "100%" }}>
        <button
          onClick={() => onMuteToggle?.(id)}
          style={{
            flex: 1, height: 16, fontSize: 7, fontFamily: T.font,
            background: muted ? T.mute : "transparent",
            border: `1px solid ${muted ? T.mute : T.border}`,
            color: muted ? "#000" : T.dim, cursor: "pointer",
          }}
          title="Mute"
        >M</button>
        <button
          onClick={() => onSoloToggle?.(id)}
          style={{
            flex: 1, height: 16, fontSize: 7, fontFamily: T.font,
            background: soloed ? T.solo : "transparent",
            border: `1px solid ${soloed ? T.solo : T.border}`,
            color: soloed ? "#000" : T.dim, cursor: "pointer",
          }}
          title="Solo"
        >S</button>
        {!isMaster && (
          <button
            onClick={() => onArmToggle?.(id)}
            style={{
              flex: 1, height: 16, fontSize: 7, fontFamily: T.font,
              background: armed ? T.danger : "transparent",
              border: `1px solid ${armed ? T.danger : T.border}`,
              color: armed ? "#fff" : T.dim, cursor: "pointer",
            }}
            title="Arm for recording"
          >R</button>
        )}
      </div>
    </div>
  );
}
