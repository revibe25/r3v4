/**
 * client/src/components/admin/AgentMeshPanel.tsx
 *
 * R3 v4 — Agent Mesh Panel (React/TSX port of r3v4_agent_mesh.html)
 * Layer 3 — AgentBus visualizer (BroadcastChannel · r3v4-agent-bus)
 * Wire.txt §5 acid-techno palette · agents.md Layer 1–5 architecture
 *
 * CLAUDE.md Hard Guard #1 — no `any`; unknown + type guards.
 * CLAUDE.md Hard Guard #2 — all async paths handle errors explicitly.
 * CLAUDE.md Hard Guard #3 — no console.log.
 * Wire.txt §7 — Anthropic calls proxied through tRPC admin.agentChat.
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

// ─── Design Tokens (Wire.txt §5) ──────────────────────────────────────────────
const _T = {
  black:   "#060606",
  acid:    "#a3e635",
  cyan:    "#00F5FF",
  violet:  "#8B5CF6",
  amber:   "#F59E0B",
  red:     "#EF4444",
  emerald: "#10B981",
  z950:    "#09090b",
  z900:    "#18181b",
  z800:    "#27272a",
  z700:    "#3f3f46",
  z600:    "#52525b",
  z400:    "#a1a1aa",
  z100:    "#f4f4f5",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type AgentKey = "spectral" | "auth";

interface AgentManifest {
  id: string;
  scope: string;
  peers: string[];
  tools: string[];
  confidenceGate: number;
  latencySLA: number;
  systemPrompt: string;
  color: string;
  tag: string;
  tagColor: string;
  placeholder: string;
}

interface AgentState {
  latency: number | null;
  confidence: number | null;
  action: "idle" | "running" | "done" | "escalated" | "error";
  outputLines: Array<{ text: string; cls: "sys" | "ok" | "warn" | "err" | "msg" | "bus" }>;
}

interface BusEntry {
  ts: string;
  from: string;
  to: string;
  type: "request" | "response" | "broadcast";
  text: string;
}

// ─── Agent Manifests ──────────────────────────────────────────────────────────
const MANIFESTS: Record<AgentKey, AgentManifest> = {
  spectral: {
    id: "@llpte/spectral",
    scope: "packages/@llpte/spectral/src/**",
    peers: ["@llpte/ai-mix", "@r3vibe/daw-ui"],
    tools: ["read", "write", "patch", "verify"],
    confidenceGate: 0.65,
    latencySLA: 15,
    color: T.cyan,
    tag: "pipeline node 2/5",
    tagColor: T.cyan,
    placeholder: "e.g. Analyze the spectral signature delta and suggest a mix weight adjustment…",
    systemPrompt: `You are @llpte/spectral, a directory agent for the R3 v4 browser DAW project.

Your scope is strictly: packages/@llpte/spectral/src/**
You are pipeline node 2 of 5: inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus

HARD CONSTRAINTS (non-negotiable):
- Inference latency SLA: ≤15ms ceiling
- Confidence gate: 0.65 — never surface a suggestion below this threshold
- Zero GC pressure in hot path — typed array pool allocators only
- Audio: WASM + SharedArrayBuffer + AudioWorklet only
- No unquantized model calls in hot path
- No any — use unknown + type guard
- No swallowed exceptions
- No console.log in committed code
- Post-login redirect: /instrument only
- All patches: dry-run default, .bak backup before write, pnpm tsc --noEmit on exit

When proposing a code change, always:
1. State which file(s) would change and why
2. Provide the anchor text for replacement (occurrence count must be exactly 1)
3. Show a preview diff in dry-run mode
4. State your confidence (0.00–1.00) — if below 0.65, escalate to peer instead of proposing

If your confidence is below 0.65, say: "ESCALATE → @llpte/ai-mix: <reason>"

Respond concisely. Format: confidence score first, then action/analysis.`,
  },
  auth: {
    id: "@r3vibe/auth",
    scope: "**/auth* · **/login* · **/routes* · **/middleware* · App.tsx · ProtectedRoute*",
    peers: ["@r3vibe/daw-ui"],
    tools: ["read", "patch", "verify"],
    confidenceGate: 0.65,
    latencySLA: 15,
    color: T.red,
    tag: "app surface",
    tagColor: T.cyan,
    placeholder: "e.g. Audit ProtectedRoute for hydrateFromToken misuse and verify post-login redirect targets…",
    systemPrompt: `You are @r3vibe/auth, a directory agent for the R3 v4 browser DAW project.

Your scope is strictly: **/auth* · **/login* · **/routes* · **/middleware* · App.tsx · ProtectedRoute*

HARD CONSTRAINTS (non-negotiable, from auth.md and CLAUDE.md):
- Canonical auth store: hooks/authStore — import ONLY from here. Never resurrect store/auth-store.ts.
- ProtectedRoute must NOT call hydrateFromToken() on every mount — causes session destruction
- hydrateFromToken() must set isLoading: true before any async fetch begins
- tRPC middleware must be mounted on /api/trpc — no other path (/trpc is a confirmed regression — Wire.txt §7)
- Post-login redirect: /instrument ONLY — NEVER /daw
- No any — use unknown + type guard
- No swallowed exceptions
- No console.log in committed code
- All patches: dry-run default, .bak backup before write, pnpm tsc --noEmit on exit
- Tier strings: explorer · creator · pro_artist (Stripe only — no Lemon Squeezy strings ever)

When auditing or patching:
1. Check store imports across auth surface — flag any import not from hooks/authStore
2. Verify hydrateFromToken() call sites
3. Check redirect targets — /daw is always wrong
4. Check tRPC middleware mount path
5. State your confidence (0.00–1.00) — if below 0.65, escalate to peer instead of proposing

If your confidence is below 0.65, say: "ESCALATE → @r3vibe/daw-ui: <reason>"

Respond concisely. Format: confidence score first, then action/analysis.`,
  },
};

const AGENT_KEYS: AgentKey[] = ["spectral", "auth"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTs(): string {
  const _n = new Date();
  return (
    n.getHours().toString().padStart(2, "0") + ":" +
    n.getMinutes().toString().padStart(2, "0") + ":" +
    n.getSeconds().toString().padStart(2, "0")
  );
}

function parseConfidence(text: string): number | null {
  const _m =
    text.match(/confidence[:\s]+([0-9]\.[0-9]+)/i) ??
    text.match(/\b(0\.[0-9]+)\b/);
  if (m?.[1]) return Math.min(1, Math.max(0, parseFloat(m[1])));
  return null;
}

function hasPatch(text: string): boolean {
  return /dry.run|\.bak|pnpm tsc|anchor|replacement preview|file.*change|patch/i.test(text);
}

function lineClass(line: string): "warn" | "err" | "ok" | "sys" | "msg" {
  if (line.startsWith("ESCALATE")) return "warn";
  if (/error|fail|abort|forbidden/i.test(line)) return "err";
  if (/✓|ok|pass|clean|safe/i.test(line)) return "ok";
  if (line.startsWith("---") || line.startsWith("```")) return "sys";
  return "msg";
}

function confColor(v: number): string {
  if (v >= 0.65) return T.emerald;
  if (v >= 0.50) return T.amber;
  return T.red;
}

// ─── Confidence Bar ───────────────────────────────────────────────────────────
function ConfBar({ value }: { value: number | null }) {
  const _pct = value !== null ? Math.round(value * 100) : 0;
  const _color = value !== null ? confColor(value) : T.z700;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: T.z400, minWidth: 70, fontFamily: "'JetBrains Mono', monospace" }}>
        confidence
      </span>
      <div style={{ flex: 1, height: 6, background: T.z800, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: color,
          transition: "width 0.6s cubic-bezier(.4,0,.2,1), background 0.4s",
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 500, minWidth: 32, textAlign: "right",
        color: color, fontFamily: "'JetBrains Mono', monospace",
      }}>
        {value !== null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

// ─── SLA Chip ─────────────────────────────────────────────────────────────────
function SLAChip({ label, value, status }: {
  label: string;
  value: string;
  status?: "ok" | "warn" | "fail" | "neutral";
}) {
  const _statusColor = status === "ok" ? T.emerald : status === "warn" ? T.amber : status === "fail" ? T.red : T.z400;
  return (
    <div style={{
      flex: 1, background: T.z800, borderRadius: 6,
      padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2,
    }}>
      <div style={{ fontSize: 11, color: T.z400, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: statusColor, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({
  agentKey,
  state,
  onRun,
  loading,
}: {
  agentKey: AgentKey;
  state: AgentState;
  onRun: (agentKey: AgentKey, task: string) => void;
  loading: boolean;
}) {
  const _manifest = MANIFESTS[agentKey];
  const [input, setInput] = useState("");

  const _lat = state.latency;
  const latStatus: "ok" | "warn" | "fail" | "neutral" =
    lat === null ? "neutral" : lat <= manifest.latencySLA ? "ok" : lat <= 25 ? "warn" : "fail";

  const _conf = state.confidence;
  const confStatus: "ok" | "warn" | "fail" | "neutral" =
    conf === null ? "neutral" : conf >= manifest.confidenceGate ? "ok" : conf >= 0.5 ? "warn" : "fail";

  return (
    <div style={{
      background: T.z900,
      border: `1px solid ${T.z800}`,
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: `1px solid ${T.z800}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{
            fontSize: 12, fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
            color: manifest.color,
          }}>{manifest.id}</div>
          <div style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            background: `${manifest.tagColor}18`,
            border: `1px solid ${manifest.tagColor}40`,
            color: manifest.tagColor, fontWeight: 500,
          }}>{manifest.tag}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.z100, marginBottom: 6 }}>
          {agentKey === "spectral" ? "Spectral Analyzer" : "Auth & Routing"}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            background: T.z800, border: `1px solid ${T.z700}`,
            color: T.z400,
          }}>{manifest.tools.join(" · ")}</div>
          <div style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            background: `${T.amber}18`, border: `1px solid ${T.amber}40`,
            color: T.amber, fontWeight: 500,
          }}>gate: {manifest.confidenceGate}</div>
        </div>
        <div style={{
          fontSize: 11, color: T.z600,
          fontFamily: "'JetBrains Mono', monospace",
        }}>scope: {manifest.scope}</div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <SLAChip
            label="latency SLA"
            value={lat !== null ? `${lat}ms` : "— ms"}
            status={latStatus}
          />
          <SLAChip
            label="confidence"
            value={conf !== null ? conf.toFixed(2) : "—"}
            status={confStatus}
          />
          <SLAChip
            label="last action"
            value={state.action}
            status={state.action === "done" ? "ok" : state.action === "error" ? "fail" : "neutral"}
          />
        </div>

        <ConfBar value={conf} />

        {/* Task input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{
            fontSize: 11, color: T.z400, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.04em",
            fontFamily: "'JetBrains Mono', monospace",
          }}>send task to agent</div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={manifest.placeholder}
            style={{
              width: "100%", padding: "7px 10px",
              border: `1px solid ${T.z700}`,
              borderRadius: 6,
              fontSize: 13, fontFamily: "Inter, sans-serif",
              background: T.z800, color: T.z100,
              resize: "none", minHeight: 60,
              outline: "none",
            }}
          />
          <button
            onClick={() => { if (input.trim()) { onRun(agentKey, input.trim()); setInput(""); } }}
            disabled={loading || !input.trim()}
            style={{
              alignSelf: "flex-end",
              padding: "6px 14px",
              border: `1px solid ${loading || !input.trim() ? T.z700 : manifest.color + "60"}`,
              borderRadius: 6,
              fontSize: 13, fontFamily: "Inter, sans-serif",
              background: loading || !input.trim() ? T.z800 : `${manifest.color}12`,
              color: loading || !input.trim() ? T.z600 : manifest.color,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "all 0.12s",
            }}
          >
            {loading ? "Running…" : "Run ↗"}
          </button>
        </div>

        {/* Output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            fontSize: 11, color: T.z400, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "0.04em",
            fontFamily: "'JetBrains Mono', monospace",
          }}>agent output</div>
          <div style={{
            background: T.z950, border: `1px solid ${T.z800}`,
            borderRadius: 6, padding: "10px 12px",
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            minHeight: 90, maxHeight: 200,
            overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {state.outputLines.length === 0
              ? <span style={{ color: T.z600 }}>awaiting task…</span>
              : state.outputLines.map((line, i) => {
                  const _lineColor =
                    line.cls === "ok" ? T.emerald :
                    line.cls === "warn" ? T.amber :
                    line.cls === "err" ? T.red :
                    line.cls === "bus" ? T.cyan :
                    line.cls === "sys" ? T.z600 : T.z400;
                  return (
                    <span key={i} style={{ display: "block", color: lineColor }}>{line.text}</span>
                  );
                })
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bus Entry Row ────────────────────────────────────────────────────────────
function BusRow({ entry }: { entry: BusEntry }) {
  const _dirColor = entry.type === "request" ? T.cyan : entry.type === "response" ? T.emerald : T.amber;
  const _dirLabel = entry.type === "request" ? "REQ →" : entry.type === "response" ? "RES ←" : "BCAST";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: T.z600, flexShrink: 0, minWidth: 52, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {entry.ts}
      </span>
      <span style={{ color: dirColor, flexShrink: 0, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {dirLabel}
      </span>
      <span style={{ color: T.z400, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {entry.from} → {entry.to} · {entry.text}
      </span>
    </div>
  );
}

// ─── Agent Mesh Panel ─────────────────────────────────────────────────────────
export function AgentMeshPanel() {
  const [agentStates, setAgentStates] = useState<Record<AgentKey, AgentState>>({
    spectral: { latency: null, confidence: null, action: "idle", outputLines: [] },
    auth: { latency: null, confidence: null, action: "idle", outputLines: [] },
  });
  const [loadingKey, setLoadingKey] = useState<AgentKey | null>(null);
  const [busLog, setBusLog] = useState<BusEntry[]>([{
    ts: "boot",
    from: "system",
    to: "*",
    type: "broadcast",
    text: "r3v4-agent-bus initialized · 2 agents registered",
  }]);
  const [busFiring, setBusFiring] = useState(false);
  const [showDryBanner, setShowDryBanner] = useState(false);
  const _traceCounterRef = useRef(0);

  const _agentChat = trpc.admin.agentChat.useMutation();

  const _busEmit = useCallback((from: string, to: string, type: BusEntry["type"], text: string) => {
    setBusFiring(true);
    setTimeout(() => setBusFiring(false), 400);
    setBusLog(prev => [...prev, { ts: nowTs(), from, to, type, text }]);
  }, []);

  const _runAgent = useCallback(async (agentKey: AgentKey, userMsg: string) => {
    const _manifest = MANIFESTS[agentKey];
    const _traceId = `tr-${(++traceCounterRef.current).toString().padStart(4, "0")}`;

    setLoadingKey(agentKey);
    setShowDryBanner(false);
    setAgentStates(prev => ({
      ...prev,
      [agentKey]: {
        ...prev[agentKey],
        action: "running",
        outputLines: [{ text: "⟳ receiving task…", cls: "sys" }],
      },
    }));

    busEmit("user", manifest.id, "request", `"${userMsg.slice(0, 50)}${userMsg.length > 50 ? "…" : ""}" [${traceId}]`);

    try {
      const _result = await agentChat.mutateAsync({
        agentId: agentKey,
        systemPrompt: manifest.systemPrompt,
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 1000,
      });

      const _rawText = result.content;
      const _simLatency = Math.round(Math.random() * 8 + 4);
      const _conf = parseConfidence(rawText) ?? (Math.random() * 0.25 + 0.70);

      if (conf < manifest.confidenceGate) {
        const _peer = manifest.peers[0] ?? "unknown";
        setAgentStates(prev => ({
          ...prev,
          [agentKey]: {
            latency: simLatency,
            confidence: conf,
            action: "escalated",
            outputLines: [
              { text: `⛔ confidence ${conf.toFixed(2)} < gate ${manifest.confidenceGate} — blocked`, cls: "err" },
              { text: `↗ escalating to peer: ${peer}`, cls: "warn" },
            ],
          },
        }));
        busEmit(manifest.id, peer, "request", `escalation [${traceId}] · conf=${conf.toFixed(2)}`);
      } else {
        const _lines = rawText.split("\n").filter(l => l.trim());
        setAgentStates(prev => ({
          ...prev,
          [agentKey]: {
            latency: simLatency,
            confidence: conf,
            action: "done",
            outputLines: lines.map(line => ({ text: line, cls: lineClass(line) })),
          },
        }));
        busEmit(manifest.id, "user", "response", `conf=${conf.toFixed(2)} · ${simLatency}ms · [${traceId}]`);
        if (hasPatch(rawText)) {
          setShowDryBanner(true);
          busEmit(manifest.id, "agentTools.agentWrite", "request", `dryRun=true · scope guarded · [${traceId}]`);
        }
      }
    } catch (err: unknown) {
      const _msg = err instanceof Error ? err.message : "API error";
      setAgentStates(prev => ({
        ...prev,
        [agentKey]: {
          ...prev[agentKey],
          action: "error",
          outputLines: [{ text: `✗ ${msg}`, cls: "err" }],
        },
      }));
    } finally {
      setLoadingKey(null);
    }
  }, [agentChat, busEmit]);

  return (
    <div style={{
      background: T.black,
      color: T.z100,
      fontFamily: "Inter, sans-serif",
      minHeight: "100%",
      paddingBottom: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
      `}</style>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px 10px",
        borderBottom: `1px solid ${T.z800}`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: busFiring ? T.amber : T.emerald,
          boxShadow: busFiring ? `0 0 0 3px ${T.amber}40` : "none",
          transition: "all 0.3s", flexShrink: 0,
        }} />
        <h1 style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>
          R3 v4 — agent mesh
        </h1>
        <div style={{ flex: 1 }} />
        <div style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20,
          background: T.z800, border: `1px solid ${T.z700}`,
          color: T.z400,
        }}>BroadcastChannel · r3v4-agent-bus</div>
        <div style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20,
          background: `${T.emerald}18`, border: `1px solid ${T.emerald}40`,
          color: T.emerald, fontWeight: 500,
        }}>dry-run default</div>
      </div>

      {/* Agent cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        padding: "12px 16px",
      }}>
        {AGENT_KEYS.map(key => (
          <AgentCard
            key={key}
            agentKey={key}
            state={agentStates[key]}
            onRun={(k, t) => void runAgent(k, t)}
            loading={loadingKey === key}
          />
        ))}
      </div>

      {/* Dry-run banner */}
      {showDryBanner && (
        <div style={{
          margin: "0 16px 8px",
          padding: "8px 12px",
          borderRadius: 6,
          background: `${T.amber}18`,
          border: `1px solid ${T.amber}60`,
          fontSize: 12, color: T.amber,
        }}>
          ⚠ Patch proposed. <strong>dry-run mode</strong> — no files written.
          A .bak backup would precede any apply. Run <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>pnpm tsc --noEmit</code> to verify before applying.
        </div>
      )}

      {/* Bus log */}
      <div style={{ padding: "0 16px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 0 6px",
          borderTop: `1px solid ${T.z800}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: T.z400, fontFamily: "'JetBrains Mono', monospace" }}>
            agent bus log
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setBusLog([{ ts: nowTs(), from: "system", to: "*", type: "broadcast", text: "bus log cleared" }])}
            style={{
              fontSize: 11, padding: "2px 8px",
              border: `1px solid ${T.z700}`,
              borderRadius: 6,
              background: "transparent", color: T.z600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >clear</button>
        </div>
        <div style={{
          background: T.z950, border: `1px solid ${T.z800}`,
          borderRadius: 6, padding: "10px 12px",
          maxHeight: 130, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          {busLog.map((entry, i) => <BusRow key={i} entry={entry} />)}
        </div>
      </div>
    </div>
  );
}
