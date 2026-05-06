import { useMIDIDevices, type MIDIMessage } from "@/hooks/useMIDIDevices";
import { useState, useCallback } from "react";
import { Usb, Activity } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", danger: "#ff3b3b",
  font: "monospace",
} as const;

export function MIDIDevicePanel() {
  const [lastMsg, setLastMsg] = useState<MIDIMessage | null>(null);
  const [msgCount, setMsgCount] = useState(0);

  const handleMessage = useCallback((msg: MIDIMessage) => {
    setLastMsg(msg);
    setMsgCount(c => c + 1);
  }, []);

  const { supported, inputs, activeIds, enable, disable, enableAll, disableAll, error } =
    useMIDIDevices(handleMessage);

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`,
      fontFamily: T.font, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <Usb size={11} color={T.accent} />
        <span style={{ fontSize: 8, letterSpacing: ".2em", color: T.dim,
          textTransform: "uppercase", flex: 1 }}>MIDI Devices</span>
        {inputs.length > 0 && (
          <button
            onClick={() => activeIds.size > 0 ? disableAll() : enableAll()}
            style={{ height: 18, padding: "0 8px", fontSize: 7, fontFamily: T.font,
              background: activeIds.size > 0 ? T.accent : "transparent",
              border: `1px solid ${activeIds.size > 0 ? T.accent : T.border}`,
              color: activeIds.size > 0 ? "#000" : T.dim, cursor: "pointer" }}>
            {activeIds.size > 0 ? "Disable All" : "Enable All"}
          </button>
        )}
      </div>

      {!supported && (
        <p style={{ fontSize: 9, color: T.danger }}>
          Web MIDI API not supported in this browser. Use Chrome or Edge.
        </p>
      )}
      {error && <p style={{ fontSize: 9, color: T.danger }}>{error}</p>}

      {supported && inputs.length === 0 && !error && (
        <p style={{ fontSize: 9, color: T.dim }}>
          No MIDI devices detected. Connect a device and refresh.
        </p>
      )}

      {inputs.map(device => {
        const active = activeIds.has(device.id);
        return (
          <div key={device.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 0", borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: active ? T.accent : T.border, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.text }}>{device.name}</div>
              {device.manufacturer && (
                <div style={{ fontSize: 7, color: T.dim }}>{device.manufacturer}</div>
              )}
            </div>
            <button
              onClick={() => active ? disable(device.id) : enable(device.id)}
              style={{ height: 18, padding: "0 10px", fontSize: 7, fontFamily: T.font,
                background: active ? T.accent : "transparent",
                border: `1px solid ${active ? T.accent : T.border}`,
                color: active ? "#000" : T.dim, cursor: "pointer" }}>
              {active ? "ON" : "OFF"}
            </button>
          </div>
        );
      })}

      {lastMsg && (
        <div style={{ marginTop: 8, padding: "6px 8px", background: T.bg,
          border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4,
            marginBottom: 3 }}>
            <Activity size={8} color={T.accent} />
            <span style={{ fontSize: 7, color: T.accent, letterSpacing: ".1em" }}>
              LAST MSG #{msgCount}
            </span>
          </div>
          <div style={{ fontSize: 8, color: T.dim, fontVariantNumeric: "tabular-nums" }}>
            {lastMsg.type.toUpperCase()}
            {lastMsg.note     !== undefined && ` · note=${lastMsg.note}`}
            {lastMsg.velocity !== undefined && ` · vel=${lastMsg.velocity}`}
            {lastMsg.controller !== undefined && ` · cc=${lastMsg.controller} val=${lastMsg.value}`}
            {lastMsg.bend     !== undefined && ` · bend=${lastMsg.bend}`}
            {` · ch=${lastMsg.channel + 1}`}
          </div>
        </div>
      )}
    </div>
  );
}
