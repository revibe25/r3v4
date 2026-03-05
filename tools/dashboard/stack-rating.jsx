import { useState } from "react";

const categories = [
  {
    name: "Frontend Core",
    score: 95,
    grade: "S",
    color: "#00D4FF",
    items: [
      { name: "React 18 + TypeScript", note: "Solid. Strict typing across components and hooks.", tag: "excellent" },
      { name: "Vite 5", note: "Best-in-class dev server. HMR, rollup bundler, worklet support via custom config.", tag: "excellent" },
      { name: "Tailwind CSS + shadcn/ui", note: "Strong pairing. shadcn gives you unstyled Radix primitives with full control.", tag: "excellent" },
      { name: "Radix UI primitives", note: "Accessible, composable. Right choice for a pro audio tool.", tag: "excellent" },
      { name: "Wouter", note: "Lightweight client router. Fine for SPA. Upgrade to TanStack Router if routing grows.", tag: "good" },
    ]
  },
  {
    name: "Audio Engine",
    score: 92,
    grade: "S",
    color: "#FF6B35",
    items: [
      { name: "Tone.js", note: "Best high-level Web Audio framework. Sequencing, synths, effects all covered.", tag: "excellent" },
      { name: "standardized-audio-context", note: "Smart — polyfills AudioContext across browsers. Essential for pro audio.", tag: "excellent" },
      { name: "AudioWorklet pipeline", note: "tsconfig.worklet.json + build-worklets.js shows real DSP architecture. Impressive.", tag: "excellent" },
      { name: "lamejs / audiobuffer-to-wav", note: "MP3 encode + WAV export. Good. Consider AudioEncoder API for modern browsers.", tag: "good" },
      { name: "jazz-midi / jzz / webmidi", note: "Three MIDI libraries is redundant. Pick WebMIDI API + jzz polyfill, drop the rest.", tag: "warn" },
    ]
  },
  {
    name: "3D / Visual Engine",
    score: 88,
    grade: "A",
    color: "#A855F7",
    items: [
      { name: "Three.js + @react-three/fiber", note: "Best React 3D stack. R3F gives you declarative scene graphs.", tag: "excellent" },
      { name: "@react-three/drei", note: "Essential R3F helpers. OrbitControls, Text, Environment etc.", tag: "excellent" },
      { name: "postprocessing + n8ao", note: "Serious post-FX pipeline. SSAO, bloom, tone mapping. Very pro.", tag: "excellent" },
      { name: "maath", note: "R3F math helpers. Good companion to drei.", tag: "good" },
      { name: "Framer Motion", note: "Good for UI animations but overlaps with R3F for 3D motion. Keep separate concerns.", tag: "good" },
    ]
  },
  {
    name: "State Management",
    score: 72,
    grade: "B",
    color: "#22C55E",
    items: [
      { name: "Zustand", note: "Right call for audio/UI state. Minimal re-renders, simple API.", tag: "excellent" },
      { name: "Redux + ReduxToolkit + redux-thunk", note: "Full Redux alongside Zustand is architectural confusion. Pick one pattern.", tag: "warn" },
      { name: "Immer", note: "Immutable state helpers. Good if you're committed to Redux.", tag: "good" },
      { name: "reselect", note: "Memoized selectors. Only valuable if Redux is your primary store.", tag: "neutral" },
      { name: "React Hook Form + Zod", note: "Correct. Best form + validation combo available.", tag: "excellent" },
    ]
  },
  {
    name: "Backend & Infra",
    score: 78,
    grade: "B+",
    color: "#F59E0B",
    items: [
      { name: "Node.js / TypeScript server", note: "Consistent language across full stack. Good for sharing types via /shared.", tag: "excellent" },
      { name: "Python AI services (ai_mix.py, main.py)", note: "Smart split — Python owns ML/audio analysis, Node owns API routing.", tag: "excellent" },
      { name: "Drizzle ORM + migrations", note: "Lightweight, type-safe, SQL-first. Good modern choice over Prisma.", tag: "excellent" },
      { name: "Docker + nginx + docker-compose", note: "Production-ready infra. nginx as reverse proxy is correct.", tag: "excellent" },
      { name: "No API layer defined", note: "No tRPC, REST spec, or GraphQL schema visible. Type safety stops at the server boundary.", tag: "warn" },
    ]
  },
  {
    name: "Project Architecture",
    score: 68,
    grade: "B-",
    color: "#EC4899",
    items: [
      { name: "/shared types package", note: "Smart. Shared schema between client and server prevents drift.", tag: "excellent" },
      { name: "tsconfig.worklet.json", note: "Dedicated TS config for AudioWorklets. Shows real DSP architecture thinking.", tag: "excellent" },
      { name: "Workspace config vs client isolation", note: "Root workspaces caused npm hoisting bugs. client/ should be self-contained.", tag: "warn" },
      { name: "Duplicate config files", note: "/config, /client, and root all have vite.config / tailwind. Single source of truth needed.", tag: "warn" },
      { name: "node_modules at both root and client", note: "Unclear dependency boundary. Decide: monorepo (own it fully) or standalone client.", tag: "warn" },
    ]
  },
];

const tagStyle = {
  excellent: { bg: "#052e16", color: "#4ade80", label: "✓ solid" },
  good:      { bg: "#0c1a2e", color: "#60a5fa", label: "↑ good" },
  warn:      { bg: "#2d1a00", color: "#fb923c", label: "⚠ review" },
  neutral:   { bg: "#1a1a2e", color: "#a78bfa", label: "~ ok" },
};

const gradeColor = { "S": "#00D4FF", "A": "#a855f7", "B+": "#22c55e", "B": "#22c55e", "B-": "#f59e0b" };

function ScoreBar({ score, color }) {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{
        width: `${score}%`, height: "100%", background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: 4, transition: "width 1s ease",
        boxShadow: `0 0 8px ${color}66`
      }} />
    </div>
  );
}

export default function StackRating() {
  const [active, setActive] = useState(0);

  const overall = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length);
  const cat = categories[active];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: "32px 24px", boxSizing: "border-box"
    }}>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ color: "#666", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
              R3 v4 · Stack Assessment
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>
              Project Stack <span style={{ color: "#00D4FF" }}>Rating</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>OVERALL</div>
            <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: overall >= 85 ? "#00D4FF" : overall >= 75 ? "#a855f7" : "#f59e0b" }}>
              {overall}
              <span style={{ fontSize: 20, color: "#555" }}>/100</span>
            </div>
          </div>
        </div>

        {/* Overall bar */}
        <div style={{ marginBottom: 32 }}>
          <ScoreBar score={overall} color="#00D4FF" />
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {categories.map((c, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              background: active === i ? c.color + "22" : "#111",
              border: `1px solid ${active === i ? c.color : "#333"}`,
              color: active === i ? c.color : "#888",
              borderRadius: 6, padding: "7px 14px", cursor: "pointer",
              fontSize: 12, fontFamily: "inherit", fontWeight: active === i ? 700 : 400,
              transition: "all 0.2s",
              boxShadow: active === i ? `0 0 12px ${c.color}33` : "none"
            }}>
              {c.name}
              <span style={{
                marginLeft: 8,
                background: active === i ? c.color : "#2a2a2a",
                color: active === i ? "#000" : "#666",
                borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 900
              }}>
                {c.grade}
              </span>
            </button>
          ))}
        </div>

        {/* Active category panel */}
        <div style={{
          background: "#111", border: `1px solid ${cat.color}33`,
          borderRadius: 12, padding: 24, marginBottom: 24,
          boxShadow: `0 0 32px ${cat.color}11`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ color: cat.color, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                Category
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{cat.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: gradeColor[cat.grade] || cat.color, lineHeight: 1 }}>
                {cat.grade}
              </div>
              <div style={{ color: "#555", fontSize: 12 }}>{cat.score}/100</div>
            </div>
          </div>
          <ScoreBar score={cat.score} color={cat.color} />

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {cat.items.map((item, i) => {
              const t = tagStyle[item.tag];
              return (
                <div key={i} style={{
                  background: "#161616", border: "1px solid #222",
                  borderRadius: 8, padding: "14px 16px",
                  borderLeft: `3px solid ${t.color}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5" }}>{item.name}</span>
                    <span style={{
                      background: t.bg, color: t.color, borderRadius: 4,
                      padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                      border: `1px solid ${t.color}44`
                    }}>
                      {t.label}
                    </span>
                  </div>
                  <div style={{ color: "#888", fontSize: 12, lineHeight: 1.6 }}>{item.note}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary scorecard */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {categories.map((c, i) => (
            <div key={i} onClick={() => setActive(i)} style={{
              background: "#111", border: `1px solid ${active === i ? c.color + "66" : "#222"}`,
              borderRadius: 8, padding: 16, cursor: "pointer", transition: "all 0.2s",
            }}>
              <div style={{ color: "#666", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                {c.name}
              </div>
              <ScoreBar score={c.score} color={c.color} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ color: "#555", fontSize: 11 }}>{c.score}/100</span>
                <span style={{ color: gradeColor[c.grade] || c.color, fontSize: 13, fontWeight: 900 }}>{c.grade}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Verdict */}
        <div style={{
          background: "#111", border: "1px solid #333", borderRadius: 12,
          padding: 24, borderTop: "3px solid #00D4FF"
        }}>
          <div style={{ color: "#00D4FF", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
            Verdict
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#ccc" }}>
            <span style={{ color: "#fff", fontWeight: 700 }}>This is a serious, well-chosen stack for a pro audio DAW.</span>
            {" "}The audio engine is genuinely impressive — AudioWorklets with a dedicated tsconfig, Tone.js, standardized-audio-context, and a real post-FX pipeline shows architectural intent beyond typical web apps.
          </div>
          <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.8, color: "#ccc" }}>
            The two areas that will bite you:{" "}
            <span style={{ color: "#fb923c" }}>state management confusion</span> (Zustand and Redux coexisting without clear ownership) and{" "}
            <span style={{ color: "#fb923c" }}>monorepo structure inconsistency</span> (configs duplicated across root/client/config/, workspace hoisting actively fighting you).
            Neither is a stack problem — both are structural decisions that just need to be made once.
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Consolidate state", detail: "Zustand for audio & UI  |  remove Redux or invert" },
              { label: "Own the monorepo", detail: "Full nx/turborepo structure  OR  standalone client/" },
              { label: "Define API boundary", detail: "tRPC or typed REST between Node ↔ client" },
            ].map((a, i) => (
              <div key={i} style={{
                background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
                padding: "10px 14px", flex: "1 1 220px"
              }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>→ {a.label}</div>
                <div style={{ color: "#666", fontSize: 11 }}>{a.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, color: "#333", fontSize: 11, letterSpacing: 2 }}>
          R3 v4  ·  STACK ASSESSMENT  ·  MARCH 2026
        </div>
      </div>
    </div>
  );
}
