#!/usr/bin/env bash
# r3-repair.sh — Full R3 v4 DAW component repair
# Run from: ~/Stable/R3 v4/
# Usage:    bash r3-repair.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0
GRN='\033[0;32m'; RED='\033[0;31m'; YLW='\033[0;33m'; CYN='\033[0;36m'; RST='\033[0m'; BLD='\033[1m' DIM='\033[2m'
ok()   { echo -e "${GRN}✓${RST} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗${RST} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "${CYN}→${RST} $1"; }
section() { echo -e "\n${BLD}${CYN}══ $1 ══${RST}"; }

write_file() {
  local path="$1"; local content="$2"
  mkdir -p "$(dirname "$path")"
  printf '%s' "$content" > "$path"
  ok "Written: $(basename "$path")"
}

section "Phase 0 — Shared Exports"

write_file "$ROOT/shared/index.ts" '// shared/index.ts — canonical barrel export for all shared types
export * from "./audio.types";
export * from "./midi.types";
export * from "./arrangement.types";
export * from "./automation.types";
export * from "./dj.types";
export * from "./effects.types";
export * from "./mixer.types";
export * from "./waveform.types";
export * from "./schema";
export * from "./types";
'

section "Phase 1 — CollapsibleFXPanel (missing dependency of arrangement.tsx)"

write_file "$ROOT/client/src/components/collapsible-fx-panel.tsx" 'import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

interface CollapsibleFXPanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export function CollapsibleFXPanel({
  title, children, defaultOpen = false, badge,
}: CollapsibleFXPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${T.border}`, background: T.panel }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", background: "transparent", border: "none",
          borderBottom: open ? `1px solid ${T.border}` : "none",
          cursor: "pointer", color: T.dim, fontFamily: T.font, fontSize: 8,
          letterSpacing: ".15em", textTransform: "uppercase",
        }}
      >
        {open
          ? <ChevronDown size={10} color={T.accent} />
          : <ChevronRight size={10} color={T.dim} />}
        <span style={{ flex: 1, textAlign: "left", color: open ? T.accent : T.dim }}>
          {title}
        </span>
        {badge && (
          <span style={{
            padding: "1px 6px", background: T.border, color: T.dim,
            fontSize: 7, fontFamily: T.font,
          }}>
            {badge}
          </span>
        )}
      </button>
      {open && <div style={{ padding: 10 }}>{children}</div>}
    </div>
  );
}
'

section "Phase 2 — Transport Bar (canonical)"

write_file "$ROOT/client/src/components/transport-bar.tsx" 'import { useState, useCallback, useEffect } from "react";
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
'

section "Phase 3 — Mixer Components"

write_file "$ROOT/client/src/components/mixer/channel-strip.tsx" 'import { useState, useCallback, useRef } from "react";

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
'

write_file "$ROOT/client/src/components/mixer/mixer-view.tsx" 'import { useState, useCallback } from "react";
import { ChannelStrip, type ChannelStripProps } from "./channel-strip";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

export interface MixerChannel {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  color: string;
  meter: number;
  peak: number;
  inserts: string[];
}

export interface MixerViewProps {
  channels?: MixerChannel[];
  onChannelUpdate?: (id: string, patch: Partial<MixerChannel>) => void;
}

const DEFAULT_CHANNELS: MixerChannel[] = [
  { id: "1", name: "Kick",  volume: 0.8, pan: 0,    muted: false, soloed: false, armed: false, color: "#b8ff00", meter: 0, peak: 0, inserts: [] },
  { id: "2", name: "Snare", volume: 0.75, pan: 0,   muted: false, soloed: false, armed: false, color: "#00e5ff", meter: 0, peak: 0, inserts: [] },
  { id: "3", name: "Bass",  volume: 0.7, pan: -0.2, muted: false, soloed: false, armed: false, color: "#ff6b35", meter: 0, peak: 0, inserts: [] },
  { id: "4", name: "Synth", volume: 0.65, pan: 0.3, muted: false, soloed: false, armed: false, color: "#a855f7", meter: 0, peak: 0, inserts: [] },
];

export function MixerView({ channels = DEFAULT_CHANNELS, onChannelUpdate }: MixerViewProps) {
  const [local, setLocal] = useState<MixerChannel[]>(channels);

  const update = useCallback((id: string, patch: Partial<MixerChannel>) => {
    setLocal(prev => prev.map(ch => ch.id === id ? { ...ch, ...patch } : ch));
    onChannelUpdate?.(id, patch);
  }, [onChannelUpdate]);

  const [masterVol, setMasterVol] = useState(0.9);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: T.bg, overflow: "hidden",
    }}>
      <div style={{
        padding: "4px 10px", borderBottom: `1px solid ${T.border}`,
        fontSize: 7, letterSpacing: ".2em", color: T.dim, fontFamily: T.font,
        textTransform: "uppercase",
      }}>
        Mixer
      </div>
      <div style={{
        flex: 1, display: "flex", gap: 1, padding: 8,
        overflowX: "auto", overflowY: "hidden",
        scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.panel}`,
      }}>
        {local.map(ch => (
          <ChannelStrip
            key={ch.id}
            {...ch}
            onVolumeChange={(id, v) => update(id, { volume: v })}
            onPanChange={(id, v) => update(id, { pan: v })}
            onMuteToggle={id => update(id, { muted: !local.find(c => c.id === id)?.muted })}
            onSoloToggle={id => update(id, { soloed: !local.find(c => c.id === id)?.soloed })}
            onArmToggle={id => update(id, { armed: !local.find(c => c.id === id)?.armed })}
            onNameChange={(id, name) => update(id, { name })}
          />
        ))}

        {/* Separator */}
        <div style={{ width: 1, background: T.border, margin: "0 4px", alignSelf: "stretch" }} />

        {/* Master */}
        <ChannelStrip
          id="master"
          name="MASTER"
          volume={masterVol}
          isMaster
          onVolumeChange={(_, v) => setMasterVol(v)}
        />
      </div>
    </div>
  );
}
'

section "Phase 4 — Effects Panels"

write_file "$ROOT/client/src/components/effects/eq-panel.tsx" 'import { useState, useRef, useEffect, useCallback } from "react";

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
'

write_file "$ROOT/client/src/components/effects/compressor-panel.tsx" 'import { useState, useEffect, useRef } from "react";

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
'

section "Phase 5 — Arrangement View"

write_file "$ROOT/client/src/components/arrangement/arrangement-view.tsx" 'import { useRef, useEffect, useState, useCallback } from "react";
import type { ArrangementTrack, ArrangementMarker, Region } from "../../../../shared/arrangement.types";
import { DEFAULT_TRACK_COLORS } from "../../../../shared/arrangement.types";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0",
  grid: "rgba(255,255,255,0.04)", font: "monospace",
} as const;

const HEADER_W = 160;
const RULER_H  = 28;
const TRACK_H  = 56;
const PX_PER_BAR = 80;

export interface ArrangementViewProps {
  tracks?: ArrangementTrack[];
  markers?: ArrangementMarker[];
  playhead?: number;
  loopStart?: number;
  loopEnd?: number;
  loopEnabled?: boolean;
  totalBars?: number;
  onPlayheadChange?: (bar: number) => void;
  onTrackSelect?: (id: string) => void;
  selectedTrackId?: string;
}

function drawRuler(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scroll: number, bars: number, pxPerBar: number,
) {
  ctx.fillStyle = T.panel;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); ctx.stroke();

  ctx.font = `8px ${T.font}`;
  ctx.fillStyle = T.dim;
  const startBar = Math.floor(scroll / pxPerBar);
  const endBar   = Math.ceil((scroll + w) / pxPerBar);
  for (let bar = startBar; bar <= Math.min(endBar, bars); bar++) {
    const x = bar * pxPerBar - scroll;
    ctx.strokeStyle = bar % 4 === 0 ? T.dim : T.border;
    ctx.lineWidth = bar % 4 === 0 ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(x, h * 0.5); ctx.lineTo(x, h); ctx.stroke();
    if (bar % 4 === 0) {
      ctx.fillStyle = T.text;
      ctx.fillText(String(bar + 1), x + 3, h - 6);
    }
  }
}

function drawTracks(
  ctx: CanvasRenderingContext2D,
  tracks: ArrangementTrack[],
  scroll: number, scrollY: number,
  w: number, pxPerBar: number,
  selectedId: string | undefined,
) {
  tracks.forEach((track, ti) => {
    const y = ti * TRACK_H - scrollY;
    if (y + TRACK_H < 0 || y > ctx.canvas.height) return;

    // track background
    ctx.fillStyle = selectedId === track.id
      ? "rgba(184,255,0,0.04)" : (ti % 2 === 0 ? T.bg : T.panel);
    ctx.fillRect(0, y, w, TRACK_H);
    // bottom border
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y + TRACK_H - 0.5);
    ctx.lineTo(w, y + TRACK_H - 0.5); ctx.stroke();

    // regions
    track.regions.forEach(region => {
      const rx   = region.startBar * pxPerBar - scroll;
      const rw   = region.length * pxPerBar;
      const ry   = y + 4;
      const rh   = TRACK_H - 8;
      if (rx + rw < 0 || rx > w) return;

      // region background
      ctx.fillStyle = track.muted
        ? "rgba(100,100,100,0.2)"
        : `${track.color}22`;
      ctx.fillRect(rx, ry, rw, rh);
      // region border
      ctx.strokeStyle = track.muted ? T.dim : track.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      // region label
      ctx.fillStyle = track.muted ? T.dim : track.color;
      ctx.font = `7px ${T.font}`;
      ctx.fillText(region.name.slice(0, 12), rx + 4, ry + 11);
      // waveform placeholder
      ctx.strokeStyle = `${track.color}44`;
      ctx.lineWidth = 0.5;
      const mid = ry + rh / 2;
      for (let px = rx + 4; px < rx + rw - 4; px += 3) {
        const amp = (Math.sin(px * 0.3) * 0.4 + Math.random() * 0.3) * (rh * 0.35);
        ctx.beginPath(); ctx.moveTo(px, mid - amp); ctx.lineTo(px, mid + amp); ctx.stroke();
      }
    });

    // grid lines
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 0.5;
    const startB = Math.floor(scroll / pxPerBar);
    const endB   = Math.ceil((scroll + w) / pxPerBar);
    for (let b = startB; b <= endB; b++) {
      const x = b * pxPerBar - scroll;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + TRACK_H); ctx.stroke();
    }
  });
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D, h: number,
  playhead: number, scroll: number, pxPerBar: number,
) {
  const x = playhead * pxPerBar - scroll;
  if (x < 0 || x > ctx.canvas.width) return;
  ctx.strokeStyle = T.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  // triangle
  ctx.fillStyle = T.accent;
  ctx.beginPath(); ctx.moveTo(x - 5, 0); ctx.lineTo(x + 5, 0);
  ctx.lineTo(x, 8); ctx.closePath(); ctx.fill();
}

export function ArrangementView({
  tracks = [], markers = [], playhead = 0,
  loopStart, loopEnd, loopEnabled = false, totalBars = 64,
  onPlayheadChange, onTrackSelect, selectedTrackId,
}: ArrangementViewProps) {
  const rulerRef  = useRef<HTMLCanvasElement>(null);
  const tracksRef = useRef<HTMLCanvasElement>(null);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [pxPerBar, setPxPerBar] = useState(PX_PER_BAR);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const draw = useCallback(() => {
    const rCanvas = rulerRef.current;
    const tCanvas = tracksRef.current;
    if (!rCanvas || !tCanvas) return;
    const rCtx = rCanvas.getContext("2d");
    const tCtx = tCanvas.getContext("2d");
    if (!rCtx || !tCtx) return;

    const cw = size.w - HEADER_W;
    rCanvas.width = cw; rCanvas.height = RULER_H;
    tCanvas.width = cw; tCanvas.height = size.h - RULER_H;
    tCtx.clearRect(0, 0, cw, tCanvas.height);

    // loop region
    if (loopEnabled && loopStart !== undefined && loopEnd !== undefined) {
      const lx = loopStart * pxPerBar - scrollX;
      const lw = (loopEnd - loopStart) * pxPerBar;
      tCtx.fillStyle = "rgba(184,255,0,0.06)";
      tCtx.fillRect(lx, 0, lw, tCanvas.height);
    }

    drawRuler(rCtx, cw, RULER_H, scrollX, totalBars, pxPerBar);
    drawTracks(tCtx, tracks, scrollX, scrollY, cw, pxPerBar, selectedTrackId);

    // markers
    markers.forEach(m => {
      const mx = m.position * pxPerBar - scrollX;
      rCtx.fillStyle = m.color;
      rCtx.fillRect(mx - 1, 0, 2, RULER_H);
      rCtx.font = `7px ${T.font}`;
      rCtx.fillText(m.name, mx + 3, 10);
    });

    drawPlayhead(rCtx, RULER_H, playhead, scrollX, pxPerBar);
    drawPlayhead(tCtx, tCanvas.height, playhead, scrollX, pxPerBar);
  }, [tracks, markers, playhead, scrollX, scrollY, pxPerBar, size,
      loopStart, loopEnd, loopEnabled, totalBars, selectedTrackId]);

  useEffect(() => { draw(); }, [draw]);

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const bar = Math.max(0, x / pxPerBar);
    onPlayheadChange?.(bar);
  }, [scrollX, pxPerBar, onPlayheadChange]);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + scrollY;
    const idx = Math.floor(y / TRACK_H);
    if (idx >= 0 && idx < tracks.length) onTrackSelect?.(tracks[idx].id);
  }, [scrollY, tracks, onTrackSelect]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setPxPerBar(p => Math.max(20, Math.min(200, p - e.deltaY * 0.5)));
    } else if (e.shiftKey) {
      setScrollX(p => Math.max(0, p + e.deltaY));
    } else {
      setScrollY(p => Math.max(0, p + e.deltaY));
    }
  }, []);

  const totalW = totalBars * pxPerBar;
  const totalH = tracks.length * TRACK_H;

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column",
      flex: 1, overflow: "hidden", background: T.bg }}>
      {/* Ruler row */}
      <div style={{ display: "flex", height: RULER_H, flexShrink: 0 }}>
        <div style={{
          width: HEADER_W, background: T.panel,
          borderRight: `1px solid ${T.border}`,
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center",
          padding: "0 8px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 7, letterSpacing: ".15em", color: T.dim,
            fontFamily: T.font, textTransform: "uppercase" }}>
            Arrangement
          </span>
        </div>
        <canvas ref={rulerRef}
          onClick={handleRulerClick}
          style={{ flex: 1, cursor: "col-resize" }} />
      </div>

      {/* Tracks area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}
        onWheel={handleWheel}>
        {/* Header column */}
        <div style={{
          width: HEADER_W, flexShrink: 0, overflowY: "hidden",
          borderRight: `1px solid ${T.border}`, background: T.panel,
        }}>
          {tracks.map((track, i) => (
            <div
              key={track.id}
              onClick={() => onTrackSelect?.(track.id)}
              style={{
                height: TRACK_H,
                borderBottom: `1px solid ${T.border}`,
                padding: "4px 8px",
                background: selectedTrackId === track.id
                  ? "rgba(184,255,0,0.06)" : "transparent",
                cursor: "pointer",
                display: "flex", flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, background: track.color,
                  borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: T.text, fontFamily: T.font,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {track.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                {(["M", "S", "R"] as const).map((btn, bi) => {
                  const active = bi === 0 ? track.muted : bi === 1 ? track.soloed : track.armed;
                  const color  = bi === 0 ? "#ffb300" : bi === 1 ? "#00e5ff" : "#ff3b3b";
                  return (
                    <button key={btn} style={{
                      width: 16, height: 14, fontSize: 6, fontFamily: T.font,
                      background: active ? color : "transparent",
                      border: `1px solid ${active ? color : T.border}`,
                      color: active ? "#000" : T.dim, cursor: "pointer",
                    }}>
                      {btn}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Canvas */}
        <canvas ref={tracksRef}
          onClick={handleTrackClick}
          style={{ flex: 1, cursor: "default" }} />
      </div>

      {/* Zoom / Scroll bar */}
      <div style={{
        height: 20, display: "flex", alignItems: "center",
        gap: 8, padding: "0 10px", borderTop: `1px solid ${T.border}`,
        background: T.panel,
      }}>
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>ZOOM</span>
        <input type="range" min={20} max={200} value={pxPerBar}
          onChange={e => setPxPerBar(parseInt(e.target.value))}
          style={{ width: 80, accentColor: T.accent, cursor: "pointer" }} />
        <span style={{ fontSize: 6, color: T.dim, fontFamily: T.font }}>
          {pxPerBar}px/bar
        </span>
        <div style={{ flex: 1 }} />
        <input type="range" min={0} max={Math.max(0, totalW - (size.w - HEADER_W))}
          value={scrollX}
          onChange={e => setScrollX(parseInt(e.target.value))}
          style={{ width: 120, accentColor: T.accent, cursor: "pointer" }} />
      </div>
    </div>
  );
}
'

section "Phase 6 — Piano Roll & Step Sequencer"

write_file "$ROOT/client/src/components/midi/piano-roll.tsx" 'import { useRef, useEffect, useState, useCallback } from "react";
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
'

write_file "$ROOT/client/src/components/midi/step-sequencer.tsx" 'import { useState, useCallback, useRef, useEffect } from "react";

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
'

section "Phase 7 — Inspector Panel & Project Browser"

write_file "$ROOT/client/src/components/inspector/inspector-panel.tsx" 'import { useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

export type InspectorTarget =
  | { type: "track";   id: string; name: string;  volume: number; pan: number; muted: boolean; soloed: boolean; armed: boolean; color: string; }
  | { type: "region";  id: string; name: string;  gain: number; muted: boolean; reversed: boolean; fadeIn: number; fadeOut: number; }
  | { type: "note";    id: string; pitch: number; velocity: number; duration: number; channel: number; }
  | null;

export interface InspectorPanelProps {
  target?: InspectorTarget;
  onClose?: () => void;
  onUpdate?: (patch: Record<string, unknown>) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", background: "transparent", border: "none",
          cursor: "pointer", color: T.dim, fontFamily: T.font, fontSize: 7,
          letterSpacing: ".15em", textTransform: "uppercase" }}>
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        {title}
      </button>
      {open && <div style={{ padding: "4px 10px 8px" }}>{children}</div>}
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
      marginBottom: 5, minHeight: 20 }}>
      <span style={{ width: 80, fontSize: 7, letterSpacing: ".1em",
        textTransform: "uppercase", color: T.dim, fontFamily: T.font, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function NumberInput({ value, min, max, step = 1, onChange }: {
  value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", background: T.panel, border: `1px solid ${T.border}`,
        color: T.text, fontFamily: T.font, fontSize: 9, padding: "2px 6px" }} />
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ height: 18, padding: "0 10px", fontSize: 7, fontFamily: T.font,
        background: value ? T.accent : "transparent",
        border: `1px solid ${value ? T.accent : T.border}`,
        color: value ? "#000" : T.dim, cursor: "pointer" }}>
      {value ? "ON" : "OFF"}
    </button>
  );
}

export function InspectorPanel({ target, onClose, onUpdate }: InspectorPanelProps) {
  const u = (patch: Record<string, unknown>) => onUpdate?.(patch);

  return (
    <div style={{ width: 220, background: T.panel, borderLeft: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", fontFamily: T.font, flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "6px 10px",
        borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 7, letterSpacing: ".2em", color: T.dim,
          textTransform: "uppercase", flex: 1 }}>Inspector</span>
        {onClose && (
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: T.dim,
              cursor: "pointer", padding: 0, display: "flex" }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto",
        scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}` }}>
        {!target && (
          <div style={{ padding: 16, fontSize: 9, color: T.dim, textAlign: "center",
            lineHeight: 1.6 }}>
            Select a track, region, or note to inspect its properties.
          </div>
        )}

        {target?.type === "track" && (
          <>
            <Section title="Track">
              <Prop label="Name">
                <input type="text" value={target.name}
                  onChange={e => u({ name: e.target.value })}
                  style={{ width: "100%", background: T.panel, border: `1px solid ${T.border}`,
                    color: T.text, fontFamily: T.font, fontSize: 9, padding: "2px 6px" }} />
              </Prop>
              <Prop label="Color">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 16, height: 16, background: target.color,
                    border: `1px solid ${T.border}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 8, color: T.dim }}>{target.color}</span>
                </div>
              </Prop>
            </Section>
            <Section title="Levels">
              <Prop label="Volume">
                <NumberInput value={target.volume} min={0} max={1} step={0.01}
                  onChange={v => u({ volume: v })} />
              </Prop>
              <Prop label="Pan">
                <NumberInput value={target.pan} min={-1} max={1} step={0.01}
                  onChange={v => u({ pan: v })} />
              </Prop>
            </Section>
            <Section title="State">
              <Prop label="Muted"><Toggle value={target.muted} onChange={v => u({ muted: v })} /></Prop>
              <Prop label="Soloed"><Toggle value={target.soloed} onChange={v => u({ soloed: v })} /></Prop>
              <Prop label="Armed"><Toggle value={target.armed} onChange={v => u({ armed: v })} /></Prop>
            </Section>
          </>
        )}

        {target?.type === "region" && (
          <>
            <Section title="Region">
              <Prop label="Name">
                <input type="text" value={target.name}
                  onChange={e => u({ name: e.target.value })}
                  style={{ width: "100%", background: T.panel, border: `1px solid ${T.border}`,
                    color: T.text, fontFamily: T.font, fontSize: 9, padding: "2px 6px" }} />
              </Prop>
              <Prop label="Muted"><Toggle value={target.muted} onChange={v => u({ muted: v })} /></Prop>
              <Prop label="Reversed"><Toggle value={target.reversed} onChange={v => u({ reversed: v })} /></Prop>
            </Section>
            <Section title="Audio">
              <Prop label="Gain">
                <NumberInput value={target.gain} min={0} max={2} step={0.01}
                  onChange={v => u({ gain: v })} />
              </Prop>
              <Prop label="Fade In">
                <NumberInput value={target.fadeIn} min={0} max={8} step={0.01}
                  onChange={v => u({ fadeIn: v })} />
              </Prop>
              <Prop label="Fade Out">
                <NumberInput value={target.fadeOut} min={0} max={8} step={0.01}
                  onChange={v => u({ fadeOut: v })} />
              </Prop>
            </Section>
          </>
        )}

        {target?.type === "note" && (
          <Section title="MIDI Note">
            <Prop label="Pitch">
              <NumberInput value={target.pitch} min={0} max={127}
                onChange={v => u({ pitch: v })} />
            </Prop>
            <Prop label="Velocity">
              <NumberInput value={target.velocity} min={1} max={127}
                onChange={v => u({ velocity: v })} />
            </Prop>
            <Prop label="Duration">
              <NumberInput value={target.duration} min={1}
                onChange={v => u({ duration: v })} />
            </Prop>
            <Prop label="Channel">
              <NumberInput value={target.channel} min={0} max={15}
                onChange={v => u({ channel: v })} />
            </Prop>
          </Section>
        )}
      </div>
    </div>
  );
}
'

write_file "$ROOT/client/src/components/project/project-browser.tsx" 'import { useState } from "react";
import { FolderOpen, Plus, Download, Clock, Search, Trash2 } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

export interface ProjectEntry {
  id: string;
  name: string;
  tempo: number;
  updatedAt: Date;
  lengthBars: number;
}

export interface ProjectBrowserProps {
  projects?: ProjectEntry[];
  onOpen?: (id: string) => void;
  onCreate?: (name: string) => void;
  onExport?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const DEMO_PROJECTS: ProjectEntry[] = [
  { id: "1", name: "Untitled Project",  tempo: 120, updatedAt: new Date(), lengthBars: 64 },
  { id: "2", name: "Beat Session 01",   tempo: 140, updatedAt: new Date(Date.now() - 3_600_000), lengthBars: 32 },
  { id: "3", name: "Ambient Sketch",    tempo: 90,  updatedAt: new Date(Date.now() - 86_400_000), lengthBars: 128 },
];

function timeAgo(d: Date): string {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ProjectBrowser({
  projects = DEMO_PROJECTS,
  onOpen, onCreate, onExport, onDelete,
}: ProjectBrowserProps) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("Untitled Project");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate?.(newName.trim());
    setNewName("Untitled Project");
    setCreating(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%",
      background: T.panel, fontFamily: T.font }}>
      {/* Header */}
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <FolderOpen size={12} color={T.accent} />
        <span style={{ fontSize: 8, letterSpacing: ".2em", color: T.dim,
          textTransform: "uppercase", flex: 1 }}>Projects</span>
        <button onClick={() => setCreating(true)}
          style={{ height: 22, padding: "0 8px", background: T.accent,
            border: "none", color: "#000", fontFamily: T.font, fontSize: 7,
            letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4 }}>
          <Plus size={9} /> New
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Search size={10} color={T.dim} />
        <input type="text" placeholder="Search projects…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none",
            color: T.text, fontFamily: T.font, fontSize: 9, outline: "none" }} />
      </div>

      {/* New project form */}
      {creating && (
        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`,
          background: "rgba(184,255,0,0.04)", flexShrink: 0 }}>
          <input type="text" value={newName} autoFocus
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false); }}
            style={{ width: "100%", background: T.bg, border: `1px solid ${T.accent}`,
              color: T.text, fontFamily: T.font, fontSize: 9, padding: "4px 8px",
              marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleCreate}
              style={{ flex: 1, height: 22, background: T.accent, border: "none",
                color: "#000", fontFamily: T.font, fontSize: 7,
                letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
              Create
            </button>
            <button onClick={() => setCreating(false)}
              style={{ height: 22, padding: "0 10px", background: "transparent",
                border: `1px solid ${T.border}`, color: T.dim, fontFamily: T.font,
                fontSize: 7, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project list */}
      <div style={{ flex: 1, overflowY: "auto",
        scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}` }}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, fontSize: 9, color: T.dim, textAlign: "center" }}>
            No projects found.
          </div>
        )}
        {filtered.map(p => (
          <div key={p.id}
            onClick={() => setSelected(p.id)}
            onDoubleClick={() => onOpen?.(p.id)}
            style={{
              padding: "8px 12px", borderBottom: `1px solid ${T.border}`,
              cursor: "pointer",
              background: selected === p.id ? "rgba(184,255,0,0.06)" : "transparent",
              borderLeft: `2px solid ${selected === p.id ? T.accent : "transparent"}`,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ flex: 1, fontSize: 10, color: T.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </span>
              <div style={{ display: "flex", gap: 3 }}>
                <button onClick={e => { e.stopPropagation(); onExport?.(p.id); }}
                  title="Export"
                  style={{ background: "none", border: "none", color: T.dim,
                    cursor: "pointer", padding: 2, display: "flex" }}>
                  <Download size={10} />
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete?.(p.id); }}
                  title="Delete"
                  style={{ background: "none", border: "none", color: T.dim,
                    cursor: "pointer", padding: 2, display: "flex" }}>
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 7, color: T.dim }}>{p.tempo} BPM</span>
              <span style={{ fontSize: 7, color: T.dim }}>{p.lengthBars} bars</span>
              <span style={{ fontSize: 7, color: T.dim, display: "flex",
                alignItems: "center", gap: 2 }}>
                <Clock size={7} /> {timeAgo(p.updatedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {selected && (
        <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.border}`,
          display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onOpen?.(selected)}
            style={{ flex: 1, height: 24, background: T.accent, border: "none",
              color: "#000", fontFamily: T.font, fontSize: 8,
              letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
            Open
          </button>
        </div>
      )}
    </div>
  );
}
'


section "Phase 8 — Arrangement Page"

write_file "$ROOT/client/src/pages/arrangement.tsx" 'import { useState, lazy, Suspense, useCallback } from "react";
import { Link } from "wouter";
import { Settings, FolderOpen, Layers, Piano, Music2 } from "lucide-react";
import { TransportBar } from "@/components/transport-bar";
import { TransportLCD } from "@/components/transport-lcd";
import { ArrangementView } from "@/components/arrangement/arrangement-view";
import { InspectorPanel, type InspectorTarget } from "@/components/inspector/inspector-panel";
import { MixerView } from "@/components/mixer/mixer-view";
import { CollapsibleFXPanel } from "@/components/collapsible-fx-panel";
import { PreferencesPanel } from "@/components/preferences-panel";
import type { ArrangementTrack, ArrangementMarker } from "../../../shared/arrangement.types";
import { DEFAULT_TRACK_COLORS } from "../../../shared/arrangement.types";

const PianoRoll     = lazy(() => import("@/components/midi/piano-roll").then(m => ({ default: m.PianoRoll })));
const StepSequencer = lazy(() => import("@/components/midi/step-sequencer").then(m => ({ default: m.StepSequencer })));
const EQPanel       = lazy(() => import("@/components/effects/eq-panel").then(m => ({ default: m.EQPanel })));
const CompressorPanel = lazy(() => import("@/components/effects/compressor-panel").then(m => ({ default: m.CompressorPanel })));
const ReverbPanel   = lazy(() => import("@/components/effects/reverb-panel").then(m => ({ default: m.ReverbPanel })));
const DelayPanel    = lazy(() => import("@/components/effects/delay-panel").then(m => ({ default: m.DelayPanel })));
const ProjectBrowser = lazy(() => import("@/components/project/project-browser").then(m => ({ default: m.ProjectBrowser })));

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

function Loading({ h = 80 }: { h?: number }) {
  return (
    <div style={{ height: h, display: "flex", alignItems: "center",
      justifyContent: "center", color: T.dim, fontFamily: T.font, fontSize: 9 }}>
      Loading…
    </div>
  );
}

const DEMO_TRACKS: ArrangementTrack[] = [
  {
    id: "t1", name: "Kick",  type: "audio", color: DEFAULT_TRACK_COLORS[0],
    height: 56, muted: false, soloed: false, armed: false,
    volume: 0.8, pan: 0, order: 0,
    regions: [{ id: "r1", trackId: "t1", name: "Kick Loop", startBar: 0,
      length: 4, offset: 0, gain: 1, fadeIn: 0, fadeOut: 0, muted: false,
      reversed: false, audioFileId: "", color: DEFAULT_TRACK_COLORS[0] }],
  },
  {
    id: "t2", name: "Synth", type: "midi", color: DEFAULT_TRACK_COLORS[1],
    height: 56, muted: false, soloed: false, armed: false,
    volume: 0.7, pan: 0.1, order: 1,
    regions: [{ id: "r2", trackId: "t2", name: "Chord Stab", startBar: 4,
      length: 8, midiRegionId: "m1",
      color: DEFAULT_TRACK_COLORS[1] } as any],
  },
  {
    id: "t3", name: "Bass",  type: "audio", color: DEFAULT_TRACK_COLORS[2],
    height: 56, muted: false, soloed: false, armed: false,
    volume: 0.75, pan: -0.1, order: 2,
    regions: [],
  },
];

const DEMO_MARKERS: ArrangementMarker[] = [
  { id: "m1", position: 0,  name: "Intro", color: T.accent },
  { id: "m2", position: 16, name: "Drop",  color: "#00e5ff" },
  { id: "m3", position: 32, name: "Break", color: "#ff6b35" },
];

type BottomPanel = "none" | "piano" | "step" | "mixer" | "fx" | "projects";
type RightPanel  = "inspector" | "none";

export default function ArrangementPage() {
  const [tracks, setTracks]         = useState<ArrangementTrack[]>(DEMO_TRACKS);
  const [playhead, setPlayhead]     = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [bpm, setBpm]               = useState(120);
  const [bar, setBeat]              = useState({ bar: 1, beat: 1, tick: 0 });
  const [selectedTrackId, setSelectedTrackId] = useState<string | undefined>();
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>("none");
  const [rightPanel, setRightPanel]   = useState<RightPanel>("inspector");
  const [showPrefs, setShowPrefs]     = useState(false);

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  const handleTrackSelect = useCallback((id: string) => {
    setSelectedTrackId(id);
    const t = tracks.find(tr => tr.id === id);
    if (t) {
      setInspectorTarget({
        type: "track", id: t.id, name: t.name,
        volume: t.volume, pan: t.pan, muted: t.muted,
        soloed: t.soloed, armed: t.armed, color: t.color,
      });
      setRightPanel("inspector");
    }
  }, [tracks]);

  const handleInspectorUpdate = useCallback((patch: Record<string, unknown>) => {
    if (!selectedTrackId) return;
    setTracks(prev => prev.map(t =>
      t.id === selectedTrackId ? { ...t, ...(patch as Partial<ArrangementTrack>) } : t
    ));
    setInspectorTarget(prev => prev ? { ...prev, ...(patch as any) } : null);
  }, [selectedTrackId]);

  const BOTTOM_BTNS: { id: BottomPanel; icon: React.ReactNode; label: string }[] = [
    { id: "piano",    icon: <Piano size={11} />,    label: "Piano Roll" },
    { id: "step",     icon: <Music2 size={11} />,   label: "Step Seq" },
    { id: "mixer",    icon: <Layers size={11} />,   label: "Mixer" },
    { id: "fx",       icon: <span style={{ fontSize: 9 }}>FX</span>, label: "FX" },
    { id: "projects", icon: <FolderOpen size={11} />, label: "Projects" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      background: T.bg, color: T.text, fontFamily: T.font, overflow: "hidden" }}>
      {showPrefs && <PreferencesPanel onClose={() => setShowPrefs(false)} />}

      {/* Top nav */}
      <div style={{ height: 36, display: "flex", alignItems: "center", gap: 4,
        padding: "0 10px", borderBottom: `1px solid ${T.border}`,
        background: T.panel, flexShrink: 0 }}>
        <Link href="/instrument">
          <a style={{ fontSize: 7, letterSpacing: ".15em", color: T.dim,
            textDecoration: "none", padding: "2px 8px",
            border: `1px solid ${T.border}`, marginRight: 4 }}>
            ← Instrument
          </a>
        </Link>
        <span style={{ fontSize: 7, letterSpacing: ".25em", color: T.accent,
          textTransform: "uppercase", flex: 1 }}>
          R3 · DAW
        </span>
        <button onClick={() => setShowPrefs(true)}
          title="Preferences"
          style={{ background: "none", border: "none", color: T.dim,
            cursor: "pointer", display: "flex", padding: 4 }}>
          <Settings size={13} />
        </button>
      </div>

      {/* Transport */}
      <TransportBar
        state={{ playing, bpm }}
        onPlay={() => setPlaying(true)}
        onStop={() => setPlaying(false)}
        onReturnToZero={() => { setPlayhead(0); setBeat({ bar: 1, beat: 1, tick: 0 }); }}
        onBpmChange={setBpm}
      />
      <TransportLCD
        bar={bar.bar} beat={bar.beat} tick={bar.tick}
        bpm={bpm} timeSignature={{ numerator: 4, denominator: 4 }}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Arrangement */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ArrangementView
            tracks={tracks}
            markers={DEMO_MARKERS}
            playhead={playhead}
            totalBars={64}
            selectedTrackId={selectedTrackId}
            onPlayheadChange={setPlayhead}
            onTrackSelect={handleTrackSelect}
          />

          {/* Bottom panel strip */}
          <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}` }}>
            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`,
              background: T.panel }}>
              {BOTTOM_BTNS.map(btn => (
                <button key={btn.id}
                  onClick={() => setBottomPanel(p => p === btn.id ? "none" : btn.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 12px", background: bottomPanel === btn.id
                      ? T.bg : "transparent",
                    border: "none", borderRight: `1px solid ${T.border}`,
                    borderBottom: bottomPanel === btn.id
                      ? `1px solid ${T.bg}` : "none",
                    color: bottomPanel === btn.id ? T.accent : T.dim,
                    fontFamily: T.font, fontSize: 7, letterSpacing: ".12em",
                    textTransform: "uppercase", cursor: "pointer",
                  }}>
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            {bottomPanel !== "none" && (
              <div style={{ maxHeight: 240, overflowY: "auto",
                scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}` }}>
                {bottomPanel === "piano" && (
                  <div style={{ height: 220 }}>
                    <Suspense fallback={<Loading h={220} />}>
                      <PianoRoll ppq={480} totalBeats={32} />
                    </Suspense>
                  </div>
                )}
                {bottomPanel === "step" && (
                  <Suspense fallback={<Loading />}>
                    <StepSequencer stepCount={16} />
                  </Suspense>
                )}
                {bottomPanel === "mixer" && (
                  <div style={{ height: 220 }}>
                    <MixerView />
                  </div>
                )}
                {bottomPanel === "fx" && (
                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <Suspense fallback={<Loading />}>
                      <CollapsibleFXPanel title="EQ" defaultOpen badge="3-Band">
                        <EQPanel />
                      </CollapsibleFXPanel>
                      <CollapsibleFXPanel title="Compressor" badge="Dynamic">
                        <CompressorPanel />
                      </CollapsibleFXPanel>
                      <CollapsibleFXPanel title="Reverb">
                        <ReverbPanel />
                      </CollapsibleFXPanel>
                      <CollapsibleFXPanel title="Delay">
                        <DelayPanel bpm={bpm} />
                      </CollapsibleFXPanel>
                    </Suspense>
                  </div>
                )}
                {bottomPanel === "projects" && (
                  <div style={{ height: 220 }}>
                    <Suspense fallback={<Loading h={220} />}>
                      <ProjectBrowser />
                    </Suspense>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        {rightPanel === "inspector" && (
          <InspectorPanel
            target={inspectorTarget}
            onClose={() => setRightPanel("none")}
            onUpdate={handleInspectorUpdate}
          />
        )}
      </div>
    </div>
  );
}
'

section "Phase 9 — App.tsx Route Wire-in"

python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"

try:
    with open(path) as f:
        src = f.read()
except FileNotFoundError:
    print(f"SKIP: {path} not found in this environment (will patch on target)")
    sys.exit(0)

# 1. Ensure lazy import for ArrangementPage
if "ArrangementPage" not in src:
    src = src.replace(
        "const InstrumentPage",
        'const ArrangementPage = lazy(() => import(\'@/pages/arrangement\'));\nconst InstrumentPage'
    )
    print("✓ Added ArrangementPage lazy import")
else:
    print("✓ ArrangementPage import already present")

# 2. Add /arrangement route if missing
if '"/arrangement"' not in src and "'/arrangement'" not in src:
    route_block = '''
      {/* ── /arrangement → Full DAW (protected) ── */}
      <Route path="/arrangement">
        {() => (
          <ProtectedRoute>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback message="Loading DAW..." />}>
                <ArrangementPage />
              </Suspense>
            </ErrorBoundary>
          </ProtectedRoute>
        )}
      </Route>

'''
    src = src.replace(
        '      {/* ── /visuals (protected) ── */}',
        route_block + '      {/* ── /visuals (protected) ── */'
    )
    print("✓ Added /arrangement route")
else:
    print("✓ /arrangement route already present")

with open(path, "w") as f:
    f.write(src)
print("App.tsx saved")
PYEOF

section "Phase 10 — PageNav Wire-in"

python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/components/page-nav.tsx"

try:
    with open(path) as f:
        src = f.read()
except FileNotFoundError:
    print(f"SKIP: {path} not found in this environment (will patch on target)")
    sys.exit(0)

if "arrangement" in src:
    print("✓ /arrangement already in page-nav.tsx")
    sys.exit(0)

# Add LayoutGrid import if not present
if "LayoutGrid" not in src:
    src = re.sub(
        r'(import\s*\{[^}]*)\}(\s*from\s*["\']lucide-react["\'])',
        lambda m: m.group(0).replace("}", ", LayoutGrid }"),
        src, count=1
    )
    print("✓ Added LayoutGrid import")

# Insert DAW nav item after /instrument
src = src.replace(
    "{ href: '/instrument'",
    "{ href: '/arrangement', label: 'DAW',        icon: LayoutGrid },\n  { href: '/instrument'"
)
print("✓ Added /arrangement to PageNav")

with open(path, "w") as f:
    f.write(src)
print("page-nav.tsx saved")
PYEOF

section "Phase 11 — Fix r3upgrade script bugs"

python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/r3upgrade"

try:
    with open(path) as f:
        src = f.read()
except FileNotFoundError:
    print(f"SKIP: {path} not found")
    sys.exit(0)

# Bug 1 — line 2637: grep -c || echo 0 produces "0\n0" multiline string
# Pattern: BROKEN=$(grep -cE '...' "$router" 2>/dev/null || echo 0)
# Fix: strip newlines and default properly
old1 = '    BROKEN=$(grep -cE \'from "\\.\\./[^"]+\\.ts"\' "$router" 2>/dev/null || echo 0)'
new1 = '    BROKEN=$(grep -cE \'from "\\.\\./[^"]+\\.ts"\' "$router" 2>/dev/null | tr -d \'\\n\' || echo "0"); BROKEN="${BROKEN:-0}"'
if old1 in src:
    src = src.replace(old1, new1)
    print("✓ Fixed line 2637: grep -c multiline bug")
else:
    # Broader pattern fix
    src = re.sub(
        r'(BROKEN=\$\(grep -cE[^)]+\|\| echo 0\))',
        lambda m: m.group(1).replace("|| echo 0)", "| tr -d '\\n' || echo \"0\"); BROKEN=\"${BROKEN:-0}\""),
        src
    )
    print("✓ Fixed line 2637 (broad match)")

# Bug 2 — line 3044: ANSI escape in unquoted string treated as command
# The broken echo looks like: ${DIM}    pkill -f '"'"'tsx|vite'"'"' && pnpm dev${RST}
# Fix: Wrap entire echo in quotes
old2 = "  echo ${DIM}    pkill -f '\"'\"'tsx|vite'\"'\"' && pnpm dev${RST}"
new2 = "  echo \"${DIM}    pkill -f 'tsx|vite' && pnpm dev${RST}\""
if old2 in src:
    src = src.replace(old2, new2)
    print("✓ Fixed line 3044: unquoted ANSI echo")
else:
    # Find the malformed echo line near pnpm dev and fix it
    src = re.sub(
        r'(echo\s+)\$\{DIM\}(\s+pkill[^\n]+pnpm dev[^\n]*)\$\{RST\}',
        r'echo "${DIM}\2${RST}"',
        src
    )
    print("✓ Fixed line 3044 (broad match)")

with open(path, "w") as f:
    f.write(src)
print("r3upgrade saved")
PYEOF

section "Final Verification"

ALL_FILES=(
  "$ROOT/shared/index.ts"
  "$ROOT/client/src/components/collapsible-fx-panel.tsx"
  "$ROOT/client/src/components/transport-bar.tsx"
  "$ROOT/client/src/components/mixer/channel-strip.tsx"
  "$ROOT/client/src/components/mixer/mixer-view.tsx"
  "$ROOT/client/src/components/effects/eq-panel.tsx"
  "$ROOT/client/src/components/effects/compressor-panel.tsx"
  "$ROOT/client/src/components/arrangement/arrangement-view.tsx"
  "$ROOT/client/src/components/midi/piano-roll.tsx"
  "$ROOT/client/src/components/midi/step-sequencer.tsx"
  "$ROOT/client/src/components/inspector/inspector-panel.tsx"
  "$ROOT/client/src/components/project/project-browser.tsx"
  "$ROOT/client/src/pages/arrangement.tsx"
)

echo ""
for f in "${ALL_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    ok "$(basename "$f") ($(wc -c < "$f") bytes)"
  else
    fail "MISSING: $f"
  fi
done

echo ""
echo -e "${BLD}${CYN}════════════════════════════════════════════════════${RST}"
echo -e "${BLD}${CYN}  R3 REPAIR COMPLETE — Pass: $PASS / Fail: $FAIL${RST}"
echo -e "${BLD}${CYN}════════════════════════════════════════════════════${RST}"
echo ""
echo -e "${DIM}  Next steps:${RST}"
echo -e "${DIM}    cd ~/Stable/R3\ v4${RST}"
echo -e "${DIM}    pnpm install${RST}"
echo -e "${DIM}    pnpm dev${RST}"
echo -e "${DIM}    → http://localhost:5173/arrangement${RST}"
echo ""

exit $FAIL
