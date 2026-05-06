import { useState } from "react";
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
