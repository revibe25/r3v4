import { useDAWStore, useView, type EditTool, type SnapValue } from "@/state/dawStore";
import { MousePointer2, Pencil, Eraser, Scissors, Waves,
         ZoomIn, ZoomOut, Layers, Piano, Activity, SlidersHorizontal } from "lucide-react";

const T = {
  bg: "#060606", panel: "#0a0a0a", border: "#1c1c1c",
  accent: "#b8ff00", dim: "#555", text: "#f0f0f0", font: "monospace",
} as const;

const TOOLS: { id: EditTool; icon: React.ReactNode; title: string; key: string }[] = [
  { id: "select", icon: <MousePointer2 size={12} />, title: "Select (V)",    key: "V" },
  { id: "draw",   icon: <Pencil        size={12} />, title: "Draw (D)",      key: "D" },
  { id: "erase",  icon: <Eraser        size={12} />, title: "Erase (E)",     key: "E" },
  { id: "cut",    icon: <Scissors      size={12} />, title: "Cut / Split (C)", key: "C" },
  { id: "fade",   icon: <Waves         size={12} />, title: "Fade (F)",      key: "F" },
];

const SNAPS: SnapValue[] = ["1", "1/2", "1/4", "1/8", "1/16", "1/32", "off"];

function ToolBtn({ active, onClick, children, title }: {
  active: boolean; onClick: () => void; children: React.ReactNode; title: string;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
      background: active ? "rgba(184,255,0,0.12)" : "transparent",
      border: `1px solid ${active ? T.accent : T.border}`,
      color: active ? T.accent : T.dim,
      cursor: "pointer", flexShrink: 0,
      transition: "all 0.08s",
    }}>{children}</button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 22, background: T.border, margin: "0 4px", flexShrink: 0 }} />;
}

export function DAWToolbar() {
  const { tool, snap, pxPerBar, showMixer, showInspector, showPianoRoll, showAutomation } = useView();
  const store = useDAWStore();

  return (
    <div style={{
      height: 40, display: "flex", alignItems: "center", gap: 3,
      padding: "0 10px", background: T.panel,
      borderBottom: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      {/* Edit tools */}
      {TOOLS.map(t => (
        <ToolBtn key={t.id} active={tool === t.id} title={t.title}
          onClick={() => store.setTool(t.id)}>
          {t.icon}
        </ToolBtn>
      ))}

      <Sep />

      {/* Snap */}
      <span style={{ fontSize: 7, color: T.dim, fontFamily: T.font, letterSpacing: ".1em", flexShrink: 0 }}>
        SNAP
      </span>
      <select value={snap} onChange={e => store.setSnap(e.target.value as SnapValue)}
        style={{ height: 22, background: T.bg, border: `1px solid ${T.border}`,
          color: T.text, fontFamily: T.font, fontSize: 9, padding: "0 4px", cursor: "pointer" }}>
        {SNAPS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <Sep />

      {/* Zoom */}
      <ToolBtn active={false} title="Zoom In (+)" onClick={() => store.zoomIn()}>
        <ZoomIn size={12} />
      </ToolBtn>
      <ToolBtn active={false} title="Zoom Out (-)" onClick={() => store.zoomOut()}>
        <ZoomOut size={12} />
      </ToolBtn>
      <span style={{ fontSize: 8, color: T.dim, fontFamily: T.font,
        minWidth: 40, textAlign: "center" }}>{pxPerBar}px</span>

      <Sep />

      {/* Panel toggles */}
      <ToolBtn active={showMixer}      title="Toggle Mixer (Tab)"       onClick={() => store.togglePanel("mixer")}>
        <Layers size={12} />
      </ToolBtn>
      <ToolBtn active={showPianoRoll}  title="Toggle Piano Roll (P)"    onClick={() => store.togglePanel("piano")}>
        <Piano size={12} />
      </ToolBtn>
      <ToolBtn active={showAutomation} title="Toggle Automation (A)"    onClick={() => store.togglePanel("automation")}>
        <Activity size={12} />
      </ToolBtn>
      <ToolBtn active={showInspector}  title="Toggle Inspector (I)"     onClick={() => store.togglePanel("inspector")}>
        <SlidersHorizontal size={12} />
      </ToolBtn>
    </div>
  );
}
