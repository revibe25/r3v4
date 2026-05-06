import { useState } from "react";
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
