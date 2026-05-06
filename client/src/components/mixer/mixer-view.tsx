import { useState, useCallback } from "react";
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
