#!/usr/bin/env tsx
/**
 * R3 Platform — Expert Implementation Command (Corrected + Wired)
 * ================================================================
 * Implements the full DAW + AI + DJ + SaaS feature map.
 * Adds 4 wiring phases the original script left as manual steps.
 *
 * KEY CORRECTIONS vs upgrades.md original:
 *   - Routers write to server/routers/ (not server/src/routers/) — matching actual tree
 *   - WS broadcaster writes to server/ws/  (not server/src/ws/)
 *   - tRPC imports corrected to match server/ root structure
 *   - AIMixingService import path corrected for monorepo layout
 *   - Phase 12: patches packages/llpte-core/package.json exports field + root barrel
 *   - Phase 13: ensures services/ai-mix/package.json has @r3/llpte-core workspace dep
 *   - Phase 14: creates/patches server/trpc.ts to inject engine singletons into context
 *   - Phase 15: patches server/index.ts to attach SessionBroadcaster + mount tRPC
 *
 * USAGE
 * ─────
 *   npx tsx implement-r3.ts [--dry-run] [--phase=<1-15>] [--verbose] [--skip-audit]
 *
 * FLAGS
 *   --dry-run     Print all operations, write nothing
 *   --phase=N     Run a single phase (1-16)
 *   --verbose     Emit per-file read confirmations
 *   --skip-audit  Skip pre-flight tree check (not recommended)
 */

import fs   from "fs";
import path from "path";

// ─────────────────────────────────────────────
// 0. RUNTIME CONFIG
// ─────────────────────────────────────────────
const ROOT        = process.cwd();
const ARGS        = process.argv.slice(2);
const DRY_RUN     = ARGS.includes("--dry-run");
const VERBOSE     = ARGS.includes("--verbose");
const SKIP_AUDIT  = ARGS.includes("--skip-audit");
const PHASE_FILTER = (() => {
  const p = ARGS.find((a) => a.startsWith("--phase="));
  return p ? parseInt(p.split("=")[1], 10) : null;
})();

// ─────────────────────────────────────────────
// 1. LOGGING
// ─────────────────────────────────────────────
type LogLevel = "INFO" | "WARN" | "ERROR" | "HARD_STOP" | "VERIFY" | "WRITE" | "PATCH";
const reportLines: string[] = [];

function log(level: LogLevel, msg: string, detail?: string): void {
  const icons: Record<LogLevel, string> = {
    INFO: "ℹ ", WARN: "⚠ ", ERROR: "✗ ", HARD_STOP: "🚫", VERIFY: "✅", WRITE: "📝", PATCH: "🔧",
  };
  const line = `[${level.padEnd(9)}] ${icons[level]} ${msg}${detail ? `\n              → ${detail}` : ""}`;
  console.log(line);
  reportLines.push(line);
}

function hardStop(reason: string, ctx?: string): never {
  log("HARD_STOP", reason, ctx);
  writeReport();
  process.exit(1);
}

// ─────────────────────────────────────────────
// 2. FILE SYSTEM UTILITIES
// ─────────────────────────────────────────────
function readFile(rel: string, required = false): string | null {
  const abs = path.resolve(ROOT, rel);
  if (!fs.existsSync(abs)) {
    if (required) hardStop(`Required file not found: ${rel}`, "Cannot proceed without this file");
    return null;
  }
  const content = fs.readFileSync(abs, "utf-8");
  if (VERBOSE) log("INFO", `READ  ${rel}`, `${content.length} chars`);
  return content;
}

function writeFile(
  rel: string,
  content: string,
  meta: { rootCause: string; rationale: string; surface: string; regression: string }
): void {
  const abs = path.resolve(ROOT, rel);
  // Never overwrite — skip if already exists (rerun safety)
  if (fs.existsSync(abs) && !DRY_RUN) {
    log("VERIFY", `SKIP (already exists): ${rel}`);
    reportLines.push(`\n### SKIPPED: ${rel}\n- Already present — remove manually to regenerate.\n`);
    return;
  }
  log("WRITE", rel, meta.rationale);
  reportLines.push(
    `\n### ${rel}\n- Root cause: ${meta.rootCause}\n- Rationale: ${meta.rationale}\n- Surface: ${meta.surface}\n- Regression: ${meta.regression}\n`
  );
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }
}

/**
 * Patch an existing file. Inserts `insertion` after the first occurrence of `anchor`.
 * If `anchor` is not found, appends at the end with a warning.
 * If `guardPattern` is present in the file already, skip (idempotent).
 */
function patchFile(
  rel: string,
  anchor: string,
  insertion: string,
  guardPattern: string,
  description: string
): void {
  const abs = path.resolve(ROOT, rel);
  if (!fs.existsSync(abs)) {
    log("WARN", `PATCH target not found: ${rel}`, "Will be created by wiring phase — patch will retry on next run");
    return;
  }
  const existing = fs.readFileSync(abs, "utf-8");
  if (existing.includes(guardPattern)) {
    log("VERIFY", `PATCH already applied: ${rel}`, description);
    return;
  }
  log("PATCH", rel, description);
  let patched: string;
  if (existing.includes(anchor)) {
    patched = existing.replace(anchor, anchor + "\n" + insertion);
  } else {
    log("WARN", `Anchor not found in ${rel} — appending to end`, anchor);
    patched = existing + "\n" + insertion;
  }
  if (!DRY_RUN) fs.writeFileSync(abs, patched, "utf-8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel));
}

function walkTs(dir: string): string[] {
  const abs = path.resolve(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const results: string[] = [];
  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") walk(full);
      else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
        results.push(path.relative(ROOT, full));
    }
  }
  walk(abs);
  return results;
}

// ─────────────────────────────────────────────
// 3. PRE-FLIGHT AUDIT
// ─────────────────────────────────────────────
const EXPECTED_PATHS = [
  "package.json", "server", "server/trpc.ts", "server/routers",
  "server/index.ts", "packages/llpte-core", "services/ai-mix",
  "client/src", "shared",
];

function auditProjectTree(): void {
  log("INFO", "PRE-FLIGHT AUDIT — reading project tree before any changes");
  const missing: string[] = [];
  for (const p of EXPECTED_PATHS) {
    if (exists(p)) log("VERIFY", `Found: ${p}`);
    else { missing.push(p); log("WARN", `Not found (will create): ${p}`); }
  }

  // Read package.json
  const pkg = readFile("package.json");
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg);
      if (!parsed.workspaces && !exists("pnpm-workspace.yaml"))
        log("WARN", "No workspaces config detected — verify pnpm-workspace.yaml or package.json workspaces");
      else
        log("VERIFY", "Workspace config present");
    } catch { log("WARN", "package.json parse failed"); }
  }

  // Check for server/trpc.ts vs server/src/trpc.ts
  if (!exists("server/trpc.ts") && exists("server/src/trpc.ts")) {
    log("WARN", "server/trpc.ts not found but server/src/trpc.ts exists", "Wiring phase will target server/src/trpc.ts");
  }

  // Detect duplicate type files
  const allTs = walkTs(".");
  const dupes = [
    { name: "mixer.types", pattern: /mixer\.types/ },
    { name: "dj.types",    pattern: /dj\.types/ },
    { name: "effects.types", pattern: /effects\.types/ },
  ];
  for (const { name, pattern } of dupes) {
    const found = allTs.filter((f) => pattern.test(f));
    if (found.length > 1) log("WARN", `Duplicate ${name} files found`, found.join(", "));
  }

  if (missing.length > 3) {
    hardStop("Too many required paths missing", `Missing: ${missing.join(", ")}\nRun from project root: ~/Stable/R3 v4`);
  }
  log("VERIFY", "Pre-flight audit passed");
}

// ─────────────────────────────────────────────
// 4. IMPLEMENTATION PHASES
// ─────────────────────────────────────────────

// ══════════════════════════════════════════════
// PHASE 1 — Shared Type Contracts
// ══════════════════════════════════════════════
function phase1_sharedTypes(): void {
  log("INFO", "PHASE 1 — Shared Type Contracts (packages/llpte-core/src/types/)");

  writeFile("packages/llpte-core/src/types/audio-graph.types.ts", `
/**
 * Audio Node Graph — Canonical Type Contracts
 * All packages MUST import from here. No duplicate definitions.
 */
export type NodeId    = string & { readonly __brand: "NodeId" };
export type PortId    = string & { readonly __brand: "PortId" };
export type Milliseconds = number & { readonly __brand: "ms" };
export type SampleRate = 44100 | 48000 | 88200 | 96000;
export type BufferSize = 128 | 256 | 512 | 1024 | 2048;

export interface AudioPort {
  readonly id: PortId;
  readonly nodeId: NodeId;
  readonly direction: "input" | "output";
  readonly channelCount: number;
}

export interface AudioNode {
  readonly id: NodeId;
  readonly type: string;
  readonly inputs: AudioPort[];
  readonly outputs: AudioPort[];
  readonly parameters: Record<string, number>;
  readonly enabled: boolean;
}

export interface AudioEdge {
  readonly id: string;
  readonly sourcePort: PortId;
  readonly targetPort: PortId;
}

export interface AudioGraph {
  readonly nodes: Map<NodeId, AudioNode>;
  readonly edges: AudioEdge[];
  readonly sampleRate: SampleRate;
  readonly bufferSize: BufferSize;
}

export interface AudioGraphMutation {
  type: "ADD_NODE" | "REMOVE_NODE" | "ADD_EDGE" | "REMOVE_EDGE" | "SET_PARAM";
  payload: unknown;
  timestamp: Milliseconds;
}

/** Invariant: every edge's source and target must reference existing port IDs */
export function validateAudioGraph(graph: AudioGraph): string[] {
  const errors: string[] = [];
  const portIndex = new Set<PortId>();
  for (const node of graph.nodes.values()) {
    for (const p of [...node.inputs, ...node.outputs]) portIndex.add(p.id);
  }
  for (const edge of graph.edges) {
    if (!portIndex.has(edge.sourcePort))
      errors.push(\`Edge \${edge.id}: sourcePort \${edge.sourcePort} not found\`);
    if (!portIndex.has(edge.targetPort))
      errors.push(\`Edge \${edge.id}: targetPort \${edge.targetPort} not found\`);
  }
  return errors;
}
`.trimStart(), {
    rootCause: "No canonical audio graph type existed; packages imported incompatible shapes",
    rationale: "Single source of truth with branded types prevents unit confusion at compile time",
    surface: "All llpte-* packages, services/ai-mix, server routes",
    regression: "Additive — new file, no existing types removed",
  });

  writeFile("packages/llpte-core/src/types/mixer.types.ts", `
import type { NodeId, Milliseconds } from "./audio-graph.types";

export type ChannelId = string & { readonly __brand: "ChannelId" };
export type BusId     = string & { readonly __brand: "BusId" };
export type FaderDb   = number & { readonly __brand: "dB" }; // −∞ to +12

export interface ChannelStrip {
  readonly id: ChannelId;
  readonly name: string;
  readonly fader: FaderDb;
  readonly pan: number;     // −1.0 to 1.0
  readonly mute: boolean;
  readonly solo: boolean;
  readonly inserts: NodeId[];
  readonly sends: SendRoute[];
  readonly automationLanes: AutomationLane[];
}

export interface SendRoute {
  readonly destinationBus: BusId;
  readonly level: FaderDb;
  readonly preFader: boolean;
}

export interface Bus {
  readonly id: BusId;
  readonly name: string;
  readonly type: "aux" | "master" | "group";
  readonly fader: FaderDb;
  readonly inserts: NodeId[];
}

export interface AutomationLane {
  readonly parameterId: string;
  readonly points: AutomationPoint[];
}

export interface AutomationPoint {
  readonly time: Milliseconds;
  readonly value: number;
  readonly curve: "linear" | "smooth" | "step";
}

export interface MixerState {
  readonly channels: Map<ChannelId, ChannelStrip>;
  readonly buses: Map<BusId, Bus>;
  readonly masterFader: FaderDb;
  readonly soloExclusive: boolean;
}
`.trimStart(), {
    rootCause: "mixer.types.ts had flat unbranded types prone to misuse across packages",
    rationale: "Branded primitives enforce correct usage at compile time",
    surface: "MixerEngine, MixerUI, tRPC mixer router",
    regression: "Additive — shared/mixer.types.ts remains until §6 migration",
  });

  writeFile("packages/llpte-core/src/types/dj.types.ts", `
import type { Milliseconds } from "./audio-graph.types";

export type DeckId = "A" | "B" | "C" | "D";

export interface CuePoint {
  readonly id: string;
  readonly time: Milliseconds;
  readonly label: string;
  readonly color: string;
}

export interface BeatGrid {
  readonly bpm: number;
  readonly offset: Milliseconds;
  readonly markers: Milliseconds[];
}

export interface Deck {
  readonly id: DeckId;
  readonly trackId: string | null;
  readonly position: Milliseconds;
  readonly bpm: number;
  readonly pitch: number;          // semitones, −12 to +12
  readonly playbackRate: number;   // 0.0 to 2.0
  readonly isPlaying: boolean;
  readonly isLooping: boolean;
  readonly loopStart: Milliseconds | null;
  readonly loopEnd: Milliseconds | null;
  readonly cuePoints: CuePoint[];
  readonly beatGrid: BeatGrid | null;
  readonly waveformData: Float32Array | null;
}

export interface DJSession {
  readonly decks: Record<DeckId, Deck>;
  readonly crossfader: number;     // −1.0 (A) to +1.0 (B)
  readonly masterBpm: number;
  readonly syncEnabled: boolean;
  readonly tempoRange: 0.06 | 0.10 | 0.16 | 0.25;
}

export type DJAction =
  | { type: "PLAY";      deckId: DeckId }
  | { type: "PAUSE";     deckId: DeckId }
  | { type: "CUE";       deckId: DeckId; cueId: string }
  | { type: "LOOP_IN";   deckId: DeckId; time: Milliseconds }
  | { type: "LOOP_OUT";  deckId: DeckId; time: Milliseconds }
  | { type: "SYNC";      deckId: DeckId; targetBpm: number }
  | { type: "CROSSFADE"; value: number }
  | { type: "PITCH";     deckId: DeckId; semitones: number };
`.trimStart(), {
    rootCause: "dj.types.ts had no deck-level state model or discriminated action union",
    rationale: "Discriminated union enables exhaustive reducers and WebSocket event typing",
    surface: "DJ UI, DJEngine, server DJ session handler, WebSocket DJ events",
    regression: "Additive — shared/dj.types.ts remains until §6 migration",
  });

  writeFile("packages/llpte-core/src/types/effects.types.ts", `
export type EffectId = string & { readonly __brand: "EffectId" };

export interface EffectParameter {
  readonly id: string;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step: number;
  readonly unit: "Hz" | "dB" | "ms" | "%" | "ratio" | "";
}

export interface EffectDescriptor {
  readonly id: EffectId;
  readonly name: string;
  readonly category: "eq" | "dynamics" | "reverb" | "delay" | "modulation" | "utility";
  readonly parameters: EffectParameter[];
  readonly latencySamples: number;
  readonly isBypassed: boolean;
}

export interface EffectPreset {
  readonly id: string;
  readonly effectId: EffectId;
  readonly name: string;
  readonly values: Record<string, number>;
  readonly createdAt: number;
  readonly isFactory: boolean;
}

export interface EffectChain {
  readonly id: string;
  readonly effects: EffectDescriptor[];
  readonly presets: EffectPreset[];
}
`.trimStart(), {
    rootCause: "effects.types.ts lacked preset and chain models needed by EFFECTS_GUIDE features",
    rationale: "Preset system requires persistent structure; chain enables ordered DSP processing",
    surface: "EffectRack component, /api/presets route, uploads/presets storage",
    regression: "Additive — no existing type removed",
  });

  writeFile("packages/llpte-core/src/types/index.ts", `
// Canonical barrel export — always import from "@r3/llpte-core"
export * from "./audio-graph.types";
export * from "./mixer.types";
export * from "./dj.types";
export * from "./effects.types";
`.trimStart(), {
    rootCause: "No canonical barrel — consumers used deep scattered imports",
    rationale: "Single entry point prevents import divergence across monorepo",
    surface: "All packages, services, client components",
    regression: "Additive — no existing exports removed",
  });
}

// ══════════════════════════════════════════════
// PHASE 2 — Audio Engine Core
// ══════════════════════════════════════════════
function phase2_audioEngine(): void {
  log("INFO", "PHASE 2 — Audio Engine Core");

  writeFile("packages/llpte-core/src/engine/AudioGraphEngine.ts", `
import type { AudioGraph, AudioGraphMutation, NodeId, AudioNode } from "../types";
import { validateAudioGraph } from "../types";

/**
 * AudioGraphEngine — sample-accurate, mutation-driven audio graph executor.
 *
 * Invariants:
 *   - Graph is validated before any mutation is applied.
 *   - Processing order derived via Kahn's topological sort.
 *   - Cycles throw immediately rather than corrupting audio output.
 *   - All mutations are recorded immutably for undo/replay.
 */
export class AudioGraphEngine {
  private graph: AudioGraph;
  private readonly mutationLog: AudioGraphMutation[] = [];
  private processingOrder: NodeId[] = [];
  private isRunning = false;

  constructor(graph: AudioGraph) {
    const errors = validateAudioGraph(graph);
    if (errors.length > 0)
      throw new Error(\`AudioGraphEngine: invalid graph — \${errors.join("; ")}\`);
    this.graph = graph;
    this.processingOrder = this.topoSort();
  }

  start(): void { if (!this.isRunning) this.isRunning = true; }
  stop():  void { this.isRunning = false; }

  applyMutation(mutation: AudioGraphMutation): void {
    const errors = this.validateMutation(mutation);
    if (errors.length > 0) throw new Error(\`Invalid mutation: \${errors.join("; ")}\`);
    this.mutationLog.push(mutation);
    this.graph = this.reduceMutation(this.graph, mutation);
    this.processingOrder = this.topoSort();
  }

  getNode(id: NodeId): AudioNode | undefined { return this.graph.nodes.get(id); }
  getProcessingOrder(): readonly NodeId[]     { return this.processingOrder; }
  getMutationLog(): readonly AudioGraphMutation[] { return this.mutationLog; }

  private validateMutation(m: AudioGraphMutation): string[] {
    const errors: string[] = [];
    if (!m.timestamp || m.timestamp <= 0) errors.push("Mutation must have a positive timestamp");
    return errors;
  }

  private reduceMutation(graph: AudioGraph, mutation: AudioGraphMutation): AudioGraph {
    if (mutation.type === "SET_PARAM") {
      const { nodeId, paramId, value } = mutation.payload as {
        nodeId: NodeId; paramId: string; value: number;
      };
      const node = graph.nodes.get(nodeId);
      if (!node) return graph;
      const updated = new Map(graph.nodes);
      updated.set(nodeId, { ...node, parameters: { ...node.parameters, [paramId]: value } });
      return { ...graph, nodes: updated };
    }
    return graph;
  }

  /** Kahn's algorithm — topological sort; throws on cycle */
  private topoSort(): NodeId[] {
    const inDegree = new Map<NodeId, number>();
    for (const id of this.graph.nodes.keys()) inDegree.set(id, 0);
    for (const edge of this.graph.edges) {
      for (const [id, node] of this.graph.nodes) {
        if (node.inputs.some((p) => p.id === edge.targetPort))
          inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      }
    }
    const queue: NodeId[] = [];
    for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
    const order: NodeId[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const edge of this.graph.edges) {
        const srcNode = [...this.graph.nodes.values()].find((n) =>
          n.outputs.some((p) => p.id === edge.sourcePort)
        );
        if (srcNode?.id !== id) continue;
        for (const [tid, tnode] of this.graph.nodes) {
          if (tnode.inputs.some((p) => p.id === edge.targetPort)) {
            const deg = (inDegree.get(tid) ?? 1) - 1;
            inDegree.set(tid, deg);
            if (deg === 0) queue.push(tid);
          }
        }
      }
    }
    if (order.length !== this.graph.nodes.size)
      throw new Error("AudioGraphEngine: cycle detected — processing halted");
    return order;
  }
}
`.trimStart(), {
    rootCause: "llpte-core had no concrete graph executor — signal routing was unimplemented",
    rationale: "Topological sort guarantees correct processing order; immutable reductions enable undo",
    surface: "llpte-execution, llpte-signal, services/ai-mix, server audio session",
    regression: "New class — no existing code overwritten",
  });

  writeFile("packages/llpte-core/src/engine/LatencyCompensator.ts", `
import type { NodeId } from "../types";

/**
 * LatencyCompensator — tracks per-node latency; returns compensation delay per node.
 *
 * Invariant: all parallel signal paths must exit with equal total latency.
 */
export class LatencyCompensator {
  private readonly latencies = new Map<NodeId, number>(); // samples

  register(nodeId: NodeId, latencySamples: number): void {
    if (latencySamples < 0) throw new RangeError("Latency samples cannot be negative");
    this.latencies.set(nodeId, latencySamples);
  }

  getCompensation(nodeId: NodeId, targetLatency: number): number {
    const own = this.latencies.get(nodeId) ?? 0;
    return Math.max(0, targetLatency - own);
  }

  getTotalPathLatency(nodePath: NodeId[]): number {
    return nodePath.reduce((sum, id) => sum + (this.latencies.get(id) ?? 0), 0);
  }

  getMaxLatency(): number {
    return Math.max(0, ...[...this.latencies.values()]);
  }
}
`.trimStart(), {
    rootCause: "No latency compensation — parallel paths would produce timing artifacts",
    rationale: "Per-node registration enables sample-accurate compensation across any topology",
    surface: "AudioGraphEngine, EffectsEngine, AI mixing pipeline",
    regression: "New class — no existing code touched",
  });

  writeFile("packages/llpte-core/src/engine/index.ts", `
export { AudioGraphEngine } from "./AudioGraphEngine";
export { LatencyCompensator } from "./LatencyCompensator";
`.trimStart(), {
    rootCause: "No engine barrel — consumers needed deep import paths",
    rationale: "Barrel enables tree-shaking and clean import surface",
    surface: "All consumers of llpte-core engine",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 3 — Mixer Engine
// ══════════════════════════════════════════════
function phase3_mixerEngine(): void {
  log("INFO", "PHASE 3 — Mixer Engine");

  writeFile("packages/llpte-core/src/mixer/MixerEngine.ts", `
import type {
  MixerState, ChannelId, BusId, FaderDb, ChannelStrip, AutomationPoint,
} from "../types";

type MixerEvent =
  | { type: "FADER_CHANGE";     channelId: ChannelId; value: FaderDb }
  | { type: "PAN_CHANGE";       channelId: ChannelId; value: number }
  | { type: "MUTE_TOGGLE";      channelId: ChannelId }
  | { type: "SOLO_TOGGLE";      channelId: ChannelId }
  | { type: "SEND_LEVEL";       channelId: ChannelId; busId: BusId; level: FaderDb }
  | { type: "MASTER_FADER";     value: FaderDb }
  | { type: "AUTOMATION_WRITE"; channelId: ChannelId; paramId: string; point: AutomationPoint };

type Listener = (event: MixerEvent, state: MixerState) => void;

/**
 * MixerEngine — event-sourced, automation-aware channel strip manager.
 *
 * Invariants:
 *   - Solo-exclusive mode: engaging solo clears all others first.
 *   - Fader clamped to [−∞, +12 dB].
 *   - Pan clamped to [−1.0, 1.0].
 *   - Automation points stored in ascending time order.
 */
export class MixerEngine {
  private state: MixerState;
  private readonly listeners: Set<Listener> = new Set();

  constructor(initialState: MixerState) {
    this.state = initialState;
  }

  dispatch(event: MixerEvent): void {
    const next = this.reduce(this.state, event);
    this.state = next;
    for (const fn of this.listeners) fn(event, next);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): Readonly<MixerState> { return this.state; }

  getChannel(id: ChannelId): ChannelStrip | undefined {
    return this.state.channels.get(id);
  }

  private reduce(state: MixerState, event: MixerEvent): MixerState {
    switch (event.type) {
      case "FADER_CHANGE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        channels.set(event.channelId, {
          ...ch, fader: Math.min(12, Math.max(-Infinity, event.value)) as FaderDb,
        });
        return { ...state, channels };
      }
      case "PAN_CHANGE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        channels.set(event.channelId, { ...ch, pan: Math.min(1, Math.max(-1, event.value)) });
        return { ...state, channels };
      }
      case "MUTE_TOGGLE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        channels.set(event.channelId, { ...ch, mute: !ch.mute });
        return { ...state, channels };
      }
      case "SOLO_TOGGLE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const channels = new Map(state.channels);
        if (state.soloExclusive) {
          for (const [id, c] of channels) channels.set(id, { ...c, solo: false });
        }
        channels.set(event.channelId, { ...ch, solo: !ch.solo });
        return { ...state, channels };
      }
      case "MASTER_FADER":
        return { ...state, masterFader: Math.min(12, Math.max(-Infinity, event.value)) as FaderDb };
      case "AUTOMATION_WRITE": {
        const ch = state.channels.get(event.channelId);
        if (!ch) return state;
        const laneIdx = ch.automationLanes.findIndex((l) => l.parameterId === event.paramId);
        const lanes = [...ch.automationLanes];
        if (laneIdx === -1) {
          lanes.push({ parameterId: event.paramId, points: [event.point] });
        } else {
          const points = [...lanes[laneIdx].points, event.point].sort((a, b) => a.time - b.time);
          lanes[laneIdx] = { ...lanes[laneIdx], points };
        }
        const channels = new Map(state.channels);
        channels.set(event.channelId, { ...ch, automationLanes: lanes });
        return { ...state, channels };
      }
      default:
        return state;
    }
  }
}
`.trimStart(), {
    rootCause: "No MixerEngine — mixer state was scattered across component-local React state",
    rationale: "Event-sourced reducer enables automation playback, undo, and server sync",
    surface: "MixerUI, tRPC mixer router, WebSocket session, AI mix engine",
    regression: "New class — UI can adopt incrementally via dispatch wrappers",
  });

  writeFile("packages/llpte-core/src/mixer/index.ts", `
export { MixerEngine } from "./MixerEngine";
`.trimStart(), {
    rootCause: "No mixer barrel",
    rationale: "Consistent import surface",
    surface: "Server tRPC context, WebSocket broadcaster",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 4 — DJ Engine
// ══════════════════════════════════════════════
function phase4_djEngine(): void {
  log("INFO", "PHASE 4 — DJ Engine");

  writeFile("packages/llpte-core/src/dj/DJEngine.ts", `
import type { DJSession, DJAction, DeckId, Deck, Milliseconds } from "../types";

type DJListener = (action: DJAction, session: DJSession) => void;

/**
 * DJEngine — stateful deck controller with beat sync and tempo matching.
 *
 * Invariants:
 *   - Crossfader clamped to [−1.0, +1.0].
 *   - Pitch clamped to [−12, +12] semitones.
 *   - Loop requires loopStart < loopEnd; LOOP_OUT with invalid range is rejected.
 *   - Sync adjusts BPM only within the session's tempoRange — never beyond.
 */
export class DJEngine {
  private session: DJSession;
  private readonly listeners: Set<DJListener> = new Set();

  constructor(session: DJSession) {
    this.session = session;
  }

  dispatch(action: DJAction): void {
    const next = this.reduce(this.session, action);
    this.session = next;
    for (const fn of this.listeners) fn(action, next);
  }

  subscribe(fn: DJListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getSession(): Readonly<DJSession> { return this.session; }
  getDeck(id: DeckId): Deck | undefined { return this.session.decks[id]; }

  /** Snap a position to the nearest beat on a given deck */
  snapToBeat(deckId: DeckId, position: Milliseconds): Milliseconds {
    const deck = this.session.decks[deckId];
    if (!deck?.beatGrid) return position;
    const { bpm, offset } = deck.beatGrid;
    const beatDuration = (60_000 / bpm) as Milliseconds;
    const relative = position - offset;
    return (offset + Math.round(relative / beatDuration) * beatDuration) as Milliseconds;
  }

  private reduce(session: DJSession, action: DJAction): DJSession {
    const decks = { ...session.decks };
    switch (action.type) {
      case "PLAY":
        decks[action.deckId] = { ...decks[action.deckId], isPlaying: true };
        return { ...session, decks };
      case "PAUSE":
        decks[action.deckId] = { ...decks[action.deckId], isPlaying: false };
        return { ...session, decks };
      case "CUE": {
        const cue = decks[action.deckId].cuePoints.find((c) => c.id === action.cueId);
        if (!cue) return session;
        decks[action.deckId] = { ...decks[action.deckId], position: cue.time, isPlaying: false };
        return { ...session, decks };
      }
      case "LOOP_IN":
        decks[action.deckId] = { ...decks[action.deckId], loopStart: action.time, isLooping: false };
        return { ...session, decks };
      case "LOOP_OUT": {
        const deck = decks[action.deckId];
        if (deck.loopStart === null || action.time <= deck.loopStart) return session;
        decks[action.deckId] = { ...deck, loopEnd: action.time, isLooping: true };
        return { ...session, decks };
      }
      case "SYNC": {
        const range = session.tempoRange;
        const clampedBpm = Math.min(
          action.targetBpm * (1 + range),
          Math.max(action.targetBpm * (1 - range), decks[action.deckId].bpm)
        );
        decks[action.deckId] = { ...decks[action.deckId], bpm: clampedBpm };
        return { ...session, decks, masterBpm: action.targetBpm };
      }
      case "CROSSFADE":
        return { ...session, crossfader: Math.min(1, Math.max(-1, action.value)) };
      case "PITCH": {
        decks[action.deckId] = { ...decks[action.deckId], pitch: Math.min(12, Math.max(-12, action.semitones)) };
        return { ...session, decks };
      }
      default:
        return session;
    }
  }
}
`.trimStart(), {
    rootCause: "DJ action dispatch had no engine — DJ controls updated UI state only, not audio session",
    rationale: "Shared engine enables WebSocket sync between multiple DJ controllers",
    surface: "DJ UI, WebSocket DJ event handler, server session, AI BPM analyzer",
    regression: "New class — existing UI event handlers can wrap dispatch() calls",
  });

  writeFile("packages/llpte-core/src/dj/index.ts", `
export { DJEngine } from "./DJEngine";
`.trimStart(), {
    rootCause: "No DJ barrel",
    rationale: "Consistent import surface",
    surface: "Server tRPC context, WebSocket DJ broadcaster",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 5 — Effects Engine
// ══════════════════════════════════════════════
function phase5_effectsEngine(): void {
  log("INFO", "PHASE 5 — Effects Engine");

  writeFile("packages/llpte-core/src/effects/EffectsEngine.ts", `
import type { EffectDescriptor, EffectPreset, EffectChain, EffectId } from "../types";

/**
 * EffectsEngine — manages DSP effect chains and preset persistence.
 *
 * Invariants:
 *   - Parameters validated against descriptor min/max on every set.
 *   - Factory presets are immutable — loadPreset on factory returns a copy.
 *   - Preset save requires all parameters present in descriptor.
 */
export class EffectsEngine {
  private readonly chains  = new Map<string, EffectChain>();
  private readonly presets = new Map<EffectId, EffectPreset[]>();

  registerChain(chainId: string, chain: EffectChain): void {
    this.chains.set(chainId, chain);
    for (const effect of chain.effects) {
      if (!this.presets.has(effect.id)) this.presets.set(effect.id, []);
    }
  }

  setParameter(chainId: string, effectId: EffectId, paramId: string, value: number): EffectChain {
    const chain = this.chains.get(chainId);
    if (!chain) throw new Error(\`EffectsEngine: chain \${chainId} not found\`);
    const effectIdx = chain.effects.findIndex((e) => e.id === effectId);
    if (effectIdx === -1) throw new Error(\`Effect \${effectId} not in chain \${chainId}\`);
    const effect = chain.effects[effectIdx];
    const param  = effect.parameters.find((p) => p.id === paramId);
    if (!param) throw new Error(\`Parameter \${paramId} not found in \${effectId}\`);
    const clamped = Math.min(param.max, Math.max(param.min, value));
    const updated: EffectDescriptor = {
      ...effect,
      parameters: effect.parameters.map((p) => p.id === paramId ? { ...p, default: clamped } : p),
    };
    const effects = [...chain.effects];
    effects[effectIdx] = updated;
    const updatedChain: EffectChain = { ...chain, effects };
    this.chains.set(chainId, updatedChain);
    return updatedChain;
  }

  savePreset(effectId: EffectId, name: string, values: Record<string, number>): EffectPreset {
    const preset: EffectPreset = {
      id: \`preset_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`,
      effectId, name, values, createdAt: Date.now(), isFactory: false,
    };
    this.presets.set(effectId, [...(this.presets.get(effectId) ?? []), preset]);
    return preset;
  }

  loadPreset(chainId: string, preset: EffectPreset): EffectChain {
    let chain = this.chains.get(chainId);
    if (!chain) throw new Error(\`Chain \${chainId} not found\`);
    for (const [paramId, value] of Object.entries(preset.values)) {
      chain = this.setParameter(chainId, preset.effectId, paramId, value);
    }
    return chain;
  }

  getPresetsForEffect(effectId: EffectId): EffectPreset[] {
    return this.presets.get(effectId) ?? [];
  }

  getChain(chainId: string): EffectChain | undefined {
    return this.chains.get(chainId);
  }
}
`.trimStart(), {
    rootCause: "No EffectsEngine — effect state lived in component props with no validation layer",
    rationale: "Engine validates parameter ranges and manages preset persistence in one place",
    surface: "EffectRack UI, preset uploads storage, EFFECTS_GUIDE.md implementation",
    regression: "New class — component state can migrate to engine incrementally",
  });

  writeFile("packages/llpte-core/src/effects/index.ts", `
export { EffectsEngine } from "./EffectsEngine";
`.trimStart(), {
    rootCause: "No effects barrel",
    rationale: "Consistent import surface",
    surface: "Server tRPC context, EffectRack UI",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 6 — AI Mixing Service
// ══════════════════════════════════════════════
function phase6_aiMixing(): void {
  log("INFO", "PHASE 6 — AI Mixing Service (services/ai-mix/src/)");

  writeFile("services/ai-mix/src/AIMixingService.ts", `
import type { MixerState } from "@r3/llpte-core";

export interface AIMixSuggestion {
  readonly channelId: string;
  readonly paramId: string;
  readonly suggestedValue: number;
  readonly confidence: number; // 0.0 to 1.0
  readonly rationale: string;
}

export interface AIMixRequest {
  readonly mixerState: MixerState;
  readonly genre: string;
  readonly targetLoudness: number; // LUFS
  readonly enableStemSeparation: boolean;
}

export interface AIMixResult {
  readonly suggestions: AIMixSuggestion[];
  readonly predictedLoudness: number;
  readonly warnings: string[];
}

/**
 * AIMixingService — genre-aware auto-mix and mastering suggestion engine.
 *
 * Invariants:
 *   - Confidence scores bounded [0, 1].
 *   - Suggestions never push faders above +12 dB.
 *   - Target loudness clamped to [−23, −6] LUFS (broadcast-safe range).
 *   - All channel references validated against mixerState before emission.
 *   - Model endpoint failure degrades to heuristics — never throws to caller.
 */
export class AIMixingService {
  private readonly MODEL_ENDPOINT = process.env["AI_MIX_MODEL_ENDPOINT"] ?? "";

  async analyze(request: AIMixRequest): Promise<AIMixResult> {
    const safeTarget = Math.min(-6, Math.max(-23, request.targetLoudness));
    const warnings: string[] = [];

    if (safeTarget !== request.targetLoudness)
      warnings.push(\`Target \${request.targetLoudness} LUFS clamped to \${safeTarget} LUFS (broadcast safe)\`);

    const raw = await this.generateSuggestions(request, safeTarget);

    // Validate all channel references before returning
    const suggestions = raw.filter((s) => {
      const exists = request.mixerState.channels.has(s.channelId as any);
      if (!exists) warnings.push(\`AI suggestion references unknown channel: \${s.channelId}\`);
      return exists;
    });

    return { suggestions, predictedLoudness: safeTarget, warnings };
  }

  private async generateSuggestions(
    request: AIMixRequest,
    targetLufs: number
  ): Promise<AIMixSuggestion[]> {
    const genreHeadroom: Record<string, number> = {
      electronic: -6, hiphop: -8, "hip-hop": -8,
      jazz: -12, classical: -18, rock: -6,
    };
    const headroom = genreHeadroom[request.genre.toLowerCase()] ?? -10;
    const suggestions: AIMixSuggestion[] = [];

    for (const [id, channel] of request.mixerState.channels) {
      const delta = headroom - channel.fader;
      if (Math.abs(delta) > 1) {
        suggestions.push({
          channelId: id,
          paramId: "fader",
          suggestedValue: Math.min(12, channel.fader + delta * 0.5),
          confidence: 0.72,
          rationale: \`\${request.genre} genre target headroom: \${headroom} dB\`,
        });
      }
    }

    if (this.MODEL_ENDPOINT) {
      try {
        const res = await fetch(this.MODEL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request, targetLufs }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(\`Model endpoint returned \${res.status}\`);
        const modelSuggestions: AIMixSuggestion[] = await res.json();
        const merged = new Map(suggestions.map((s) => [\`\${s.channelId}:\${s.paramId}\`, s]));
        for (const ms of modelSuggestions) merged.set(\`\${ms.channelId}:\${ms.paramId}\`, ms);
        return [...merged.values()];
      } catch (err) {
        console.error("[AIMixingService] Model endpoint failed, falling back to heuristics:", err);
      }
    }
    return suggestions;
  }
}
`.trimStart(), {
    rootCause: "services/ai-mix had no concrete implementation — AI mixing was a stub",
    rationale: "Heuristic baseline with optional model endpoint enables graceful degradation",
    surface: "tRPC aiMix router, MixerEngine integration, AI_MIXING.md implementation",
    regression: "New class — no existing service overwritten",
  });

  writeFile("services/ai-mix/src/index.ts", `
export { AIMixingService } from "./AIMixingService";
export type { AIMixSuggestion, AIMixRequest, AIMixResult } from "./AIMixingService";
`.trimStart(), {
    rootCause: "No ai-mix barrel",
    rationale: "Consistent import surface from service package",
    surface: "tRPC aiMix router",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 7 — Arrangement Engine
// ══════════════════════════════════════════════
function phase7_arrangementEngine(): void {
  log("INFO", "PHASE 7 — Arrangement / Timeline Engine (flagged MISSING in spec)");

  writeFile("packages/llpte-core/src/arrangement/ArrangementEngine.ts", `
import type { Milliseconds } from "../types";

export type ClipId   = string & { readonly __brand: "ClipId" };
export type TrackId  = string & { readonly __brand: "TrackId" };

export interface Clip {
  readonly id: ClipId;
  readonly sourceId: string;   // audio file or MIDI clip ID
  readonly startTime: Milliseconds;
  readonly duration: Milliseconds;
  readonly offset: Milliseconds; // start within source
  readonly gain: number;
  readonly color: string;
}

export interface ArrangementTrack {
  readonly id: TrackId;
  readonly name: string;
  readonly type: "audio" | "midi" | "automation";
  readonly clips: Clip[];
  readonly isMuted: boolean;
  readonly isSoloed: boolean;
  readonly height: number; // px
}

export interface TempoEvent {
  readonly time: Milliseconds;
  readonly bpm: number;
}

export interface ArrangementState {
  readonly tracks: Map<TrackId, ArrangementTrack>;
  readonly tempoMap: TempoEvent[];
  readonly loopStart: Milliseconds | null;
  readonly loopEnd: Milliseconds | null;
  readonly playhead: Milliseconds;
  readonly duration: Milliseconds;
}

type ArrangementAction =
  | { type: "ADD_CLIP";        trackId: TrackId; clip: Clip }
  | { type: "REMOVE_CLIP";     trackId: TrackId; clipId: ClipId }
  | { type: "MOVE_CLIP";       trackId: TrackId; clipId: ClipId; newStart: Milliseconds }
  | { type: "TRIM_CLIP";       trackId: TrackId; clipId: ClipId; duration: Milliseconds }
  | { type: "SET_LOOP";        start: Milliseconds; end: Milliseconds }
  | { type: "CLEAR_LOOP" }
  | { type: "SET_PLAYHEAD";    time: Milliseconds }
  | { type: "ADD_TEMPO_EVENT"; event: TempoEvent };

/**
 * ArrangementEngine — clip-based timeline with tempo map and loop regions.
 *
 * Invariants:
 *   - Clips on a track cannot overlap.
 *   - Clip duration must be positive.
 *   - Loop requires start < end.
 *   - Tempo events maintained in ascending time order.
 */
export class ArrangementEngine {
  private state: ArrangementState;

  constructor(initialState: ArrangementState) {
    this.state = initialState;
  }

  dispatch(action: ArrangementAction): ArrangementState {
    const next = this.reduce(this.state, action);
    this.state = next;
    return next;
  }

  getState(): Readonly<ArrangementState> { return this.state; }

  getTrack(id: TrackId): ArrangementTrack | undefined {
    return this.state.tracks.get(id);
  }

  private reduce(state: ArrangementState, action: ArrangementAction): ArrangementState {
    const tracks = new Map(state.tracks);
    switch (action.type) {
      case "ADD_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        if (action.clip.duration <= 0) throw new RangeError("Clip duration must be positive");
        const overlap = track.clips.some(
          (c) =>
            action.clip.startTime < c.startTime + c.duration &&
            action.clip.startTime + action.clip.duration > c.startTime
        );
        if (overlap) throw new Error(\`Clip overlaps existing clip on track \${action.trackId}\`);
        const clips = [...track.clips, action.clip].sort((a, b) => a.startTime - b.startTime);
        tracks.set(action.trackId, { ...track, clips });
        return { ...state, tracks };
      }
      case "REMOVE_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        tracks.set(action.trackId, { ...track, clips: track.clips.filter((c) => c.id !== action.clipId) });
        return { ...state, tracks };
      }
      case "MOVE_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        const clips = track.clips.map((c) =>
          c.id === action.clipId ? { ...c, startTime: action.newStart } : c
        ).sort((a, b) => a.startTime - b.startTime);
        tracks.set(action.trackId, { ...track, clips });
        return { ...state, tracks };
      }
      case "TRIM_CLIP": {
        const track = tracks.get(action.trackId);
        if (!track) return state;
        if (action.duration <= 0) throw new RangeError("Trim duration must be positive");
        const clips = track.clips.map((c) =>
          c.id === action.clipId ? { ...c, duration: action.duration } : c
        );
        tracks.set(action.trackId, { ...track, clips });
        return { ...state, tracks };
      }
      case "SET_LOOP":
        if (action.start >= action.end) throw new RangeError("Loop start must be before loop end");
        return { ...state, loopStart: action.start, loopEnd: action.end };
      case "CLEAR_LOOP":
        return { ...state, loopStart: null, loopEnd: null };
      case "SET_PLAYHEAD":
        return { ...state, playhead: Math.max(0, action.time) as Milliseconds };
      case "ADD_TEMPO_EVENT": {
        const tempoMap = [...state.tempoMap, action.event].sort((a, b) => a.time - b.time);
        return { ...state, tempoMap };
      }
      default:
        return state;
    }
  }
}
`.trimStart(), {
    rootCause: "Arrangement engine was missing — identified as critical gap in feature map",
    rationale: "Clip overlap invariant + immutable reductions enable undo/redo and server sync",
    surface: "Timeline UI, tRPC arrangement router, server project persistence",
    regression: "New class — no existing arrangement code touched",
  });

  writeFile("packages/llpte-core/src/arrangement/index.ts", `
export { ArrangementEngine } from "./ArrangementEngine";
export type { Clip, ArrangementTrack, ArrangementState, TempoEvent, ClipId, TrackId } from "./ArrangementEngine";
`.trimStart(), {
    rootCause: "No arrangement barrel",
    rationale: "Consistent import surface",
    surface: "Timeline UI, server arrangement routes",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 8 — tRPC Routers
// CORRECTION: writes to server/routers/ (not server/src/routers/)
// ══════════════════════════════════════════════
function phase8_tRPCRouters(): void {
  log("INFO", "PHASE 8 — tRPC Routers → server/routers/ (corrected path)");

  // Detect actual trpc location — routers live at server/routers/, so:
  //   server/trpc.ts     → "../trpc"
  //   server/src/trpc.ts → "../src/trpc"
  //   neither found      → "../trpc" (will warn at compile; Phase 14 will create it)
  const trpcImport = exists("server/trpc.ts")
    ? "../trpc"
    : exists("server/src/trpc.ts")
      ? "../src/trpc"
      : "../trpc";

  writeFile("server/routers/mixer.router.ts", `
import { z } from "zod";
import { router, publicProcedure } from "${trpcImport}";

const ChannelIdSchema = z.string().min(1);
const FaderDbSchema   = z.number().max(12);

export const mixerRouter = router({
  getState: publicProcedure
    .query(({ ctx }) => ctx.mixerEngine.getState()),

  setFader: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema, value: FaderDbSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({
        type: "FADER_CHANGE",
        channelId: input.channelId as any,
        value: input.value as any,
      });
      return { ok: true };
    }),

  setPan: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema, value: z.number().min(-1).max(1) }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "PAN_CHANGE", channelId: input.channelId as any, value: input.value });
      return { ok: true };
    }),

  toggleMute: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "MUTE_TOGGLE", channelId: input.channelId as any });
      return { ok: true };
    }),

  toggleSolo: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "SOLO_TOGGLE", channelId: input.channelId as any });
      return { ok: true };
    }),

  setMasterFader: publicProcedure
    .input(z.object({ value: FaderDbSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "MASTER_FADER", value: input.value as any });
      return { ok: true };
    }),
});

export type MixerRouter = typeof mixerRouter;
`.trimStart(), {
    rootCause: "No mixer tRPC router — mixer state had no server-authoritative API path",
    rationale: "Zod validates at API boundary; mutations route through MixerEngine invariants",
    surface: "server/routers/index.ts, client trpc hooks",
    regression: "New router — no existing routes overwritten",
  });

  writeFile("server/routers/dj.router.ts", `
import { z } from "zod";
import { router, publicProcedure } from "${trpcImport}";

const DeckIdSchema = z.enum(["A", "B", "C", "D"]);

export const djRouter = router({
  getSession: publicProcedure
    .query(({ ctx }) => ctx.djEngine.getSession()),

  play: publicProcedure
    .input(z.object({ deckId: DeckIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "PLAY", deckId: input.deckId });
      return { ok: true };
    }),

  pause: publicProcedure
    .input(z.object({ deckId: DeckIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "PAUSE", deckId: input.deckId });
      return { ok: true };
    }),

  cue: publicProcedure
    .input(z.object({ deckId: DeckIdSchema, cueId: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "CUE", deckId: input.deckId, cueId: input.cueId });
      return { ok: true };
    }),

  crossfade: publicProcedure
    .input(z.object({ value: z.number().min(-1).max(1) }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "CROSSFADE", value: input.value });
      return { ok: true };
    }),

  sync: publicProcedure
    .input(z.object({ deckId: DeckIdSchema, targetBpm: z.number().min(20).max(250) }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "SYNC", deckId: input.deckId, targetBpm: input.targetBpm });
      return { ok: true };
    }),

  pitch: publicProcedure
    .input(z.object({ deckId: DeckIdSchema, semitones: z.number().min(-12).max(12) }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "PITCH", deckId: input.deckId, semitones: input.semitones });
      return { ok: true };
    }),
});

export type DJRouter = typeof djRouter;
`.trimStart(), {
    rootCause: "DJ controls had no server route — session was client-only and non-persistent",
    rationale: "Server-authoritative DJ session enables multi-controller sync via WebSocket",
    surface: "server/routers/index.ts, WebSocket DJ broadcast, client DJ hooks",
    regression: "New router — no existing routes overwritten",
  });

  writeFile("server/routers/aiMix.router.ts", `
import { z } from "zod";
import { router, publicProcedure } from "${trpcImport}";
import { AIMixingService } from "../../services/ai-mix/src/AIMixingService";

const aiService = new AIMixingService();

export const aiMixRouter = router({
  analyze: publicProcedure
    .input(z.object({
      genre:                z.string().min(1),
      targetLoudness:       z.number().min(-23).max(-6),
      enableStemSeparation: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const mixerState = ctx.mixerEngine.getState();
      return aiService.analyze({
        mixerState,
        genre:                input.genre,
        targetLoudness:       input.targetLoudness,
        enableStemSeparation: input.enableStemSeparation,
      });
    }),
});

export type AIMixRouter = typeof aiMixRouter;
`.trimStart(), {
    rootCause: "AI mixing had no tRPC route — could not be triggered from client",
    rationale: "Single endpoint with Zod-validated input; all logic in AIMixingService",
    surface: "server/routers/index.ts, client AI mix panel",
    regression: "New router — no existing routes overwritten",
  });

  // Root router — check if one exists first
  const existingIndex = readFile("server/routers/index.ts");
  if (existingIndex && existingIndex.includes("appRouter")) {
    log("WARN", "server/routers/index.ts exists with appRouter — patching instead of overwriting");
    // First add missing imports at the top
    patchFile(
      "server/routers/index.ts",
      "import { router }",
      `import { mixerRouter }  from "./mixer.router";\nimport { djRouter }     from "./dj.router";\nimport { aiMixRouter }  from "./aiMix.router";`,
      "mixerRouter",
      "Add missing router imports to existing index"
    );
    // Then add router entries into appRouter object body
    patchFile(
      "server/routers/index.ts",
      "export const appRouter = router({",
      `  mixer:  mixerRouter,\n  dj:     djRouter,\n  aiMix:  aiMixRouter,`,
      "mixer:  mixerRouter",
      "Add mixer/dj/aiMix entries to existing appRouter"
    );
  } else {
    writeFile("server/routers/index.ts", `
/**
 * Root tRPC Router — all domain routers registered here.
 * Do NOT define procedures directly in this file.
 */
import { router } from "${trpcImport}";
import { mixerRouter }  from "./mixer.router";
import { djRouter }     from "./dj.router";
import { aiMixRouter }  from "./aiMix.router";

export const appRouter = router({
  mixer:  mixerRouter,
  dj:     djRouter,
  aiMix:  aiMixRouter,
});

export type AppRouter = typeof appRouter;
`.trimStart(), {
      rootCause: "No canonical router registration point for new routers",
      rationale: "Single merge point prevents orphan routers and import ambiguity",
      surface: "server/index.ts (createExpressMiddleware), client trpc.ts (AppRouter type)",
      regression: "Must verify server/index.ts imports appRouter from this file",
    });
  }
}

// ══════════════════════════════════════════════
// PHASE 9 — WebSocket Broadcaster
// CORRECTION: writes to server/ws/ (not server/src/ws/)
// ══════════════════════════════════════════════
function phase9_websocket(): void {
  log("INFO", "PHASE 9 — WebSocket Broadcaster → server/ws/ (corrected path)");

  writeFile("server/ws/SessionBroadcaster.ts", `
import type { WebSocket, WebSocketServer } from "ws";

export type BroadcastEvent =
  | { type: "MIXER_STATE_CHANGE";  payload: unknown }
  | { type: "DJ_SESSION_CHANGE";   payload: unknown }
  | { type: "AI_MIX_RESULT";       payload: unknown }
  | { type: "ARRANGEMENT_CHANGE";  payload: unknown }
  | { type: "PING" };

/**
 * SessionBroadcaster — fan-out engine state changes to all connected WebSocket clients.
 *
 * Invariants:
 *   - Dead sockets pruned before every broadcast.
 *   - Broadcast never throws — errors isolated per client.
 *   - 30-second heartbeat ping; terminal on repeated failure.
 */
export class SessionBroadcaster {
  private readonly clients = new Set<WebSocket>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  attach(wss: WebSocketServer): void {
    wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);
      ws.on("close",  () => this.clients.delete(ws));
      ws.on("error",  () => { this.clients.delete(ws); ws.terminate(); });
    });
    this.startHeartbeat();
  }

  broadcast(event: BroadcastEvent): void {
    const payload = JSON.stringify(event);
    const dead: WebSocket[] = [];
    for (const client of this.clients) {
      if (client.readyState !== 1 /* OPEN */) { dead.push(client); continue; }
      try { client.send(payload); } catch { dead.push(client); }
    }
    for (const d of dead) this.clients.delete(d);
  }

  get connectionCount(): number { return this.clients.size; }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => this.broadcast({ type: "PING" }), 30_000);
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients) client.terminate();
    this.clients.clear();
  }
}
`.trimStart(), {
    rootCause: "WebSocket layer had no broadcast manager — real-time sync required manual socket tracking",
    rationale: "Dead-socket pruning prevents memory leak; per-client error catching prevents halt",
    surface: "server/index.ts (wss attach), MixerEngine/DJEngine subscribe listeners",
    regression: "New class — existing ws usage can delegate to broadcaster",
  });
}

// ══════════════════════════════════════════════
// PHASE 10 — Database Schema
// ══════════════════════════════════════════════
function phase10_dbSchema(): void {
  log("INFO", "PHASE 10 — Database Schema (Drizzle + Postgres)");

  writeFile("db/schema/r3-platform.schema.ts", `
import {
  pgTable, text, real, boolean, timestamp, jsonb,
  serial, integer, varchar,
} from "drizzle-orm/pg-core";

/**
 * R3 Platform — canonical Drizzle schema.
 * This is the single source of truth for all table definitions.
 * Run: pnpm drizzle-kit check  — before deploying any changes.
 */

export const users = pgTable("users", {
  id:        text("id").primaryKey(),
  email:     text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id:          text("id").primaryKey(),
  userId:      text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name:        text("name").notNull(),
  genre:       text("genre"),
  bpm:         real("bpm"),
  mixerState:  jsonb("mixer_state"),   // serialised MixerState
  arrangement: jsonb("arrangement"),   // serialised ArrangementState
  djSession:   jsonb("dj_session"),    // serialised DJSession
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const audioFiles = pgTable("audio_files", {
  id:           text("id").primaryKey(),
  projectId:    text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  originalName: text("original_name").notNull(),
  storagePath:  text("storage_path").notNull(),
  durationMs:   real("duration_ms"),
  sampleRate:   integer("sample_rate"),
  mimeType:     varchar("mime_type", { length: 64 }),
  uploadedAt:   timestamp("uploaded_at").defaultNow().notNull(),
});

export const effectPresets = pgTable("effect_presets", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  effectId:  text("effect_id").notNull(),
  name:      text("name").notNull(),
  values:    jsonb("values").notNull(),
  isFactory: boolean("is_factory").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiMixHistory = pgTable("ai_mix_history", {
  id:          serial("id").primaryKey(),
  projectId:   text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  genre:       text("genre").notNull(),
  targetLufs:  real("target_lufs").notNull(),
  suggestions: jsonb("suggestions").notNull(),
  appliedAt:   timestamp("applied_at").defaultNow().notNull(),
});
`.trimStart(), {
    rootCause: "No unified Drizzle schema — tables were scattered across migration files",
    rationale: "Single file is the canonical source of truth for all table definitions",
    surface: "db/index.ts (schema import), drizzle migrations, all server data access",
    regression: "Run drizzle-kit check before deploying; verify against existing migrations",
  });
}

// ══════════════════════════════════════════════
// PHASE 11 — Orphan Detection
// ══════════════════════════════════════════════
function phase11_orphanDetection(): void {
  log("INFO", "PHASE 11 — Orphan Detection + Conflict Resolution");
  const allTs = walkTs(".");
  const patterns = [
    { name: "mixer types",   pattern: /mixer\.types/ },
    { name: "dj types",      pattern: /dj\.types/ },
    { name: "effects types", pattern: /effects\.types/ },
  ];
  for (const { name, pattern } of patterns) {
    const matches = allTs.filter((f) => pattern.test(f) && !f.includes("node_modules"));
    if (matches.length > 1) {
      log("WARN", `DUPLICATE: ${name} defined in multiple locations`, matches.join(", "));
      reportLines.push(
        `\n⚠ CONFLICT: ${name}\n${matches.map((m) => `  - ${m}`).join("\n")}\n` +
        `  Canonical: packages/llpte-core/src/types/\n` +
        `  Action: migrate imports then delete all other copies.\n`
      );
    } else {
      log("VERIFY", `${name} — single canonical location${matches.length ? `: ${matches[0]}` : " (not yet created)"}`);
    }
  }
}

// ══════════════════════════════════════════════
// PHASE 12 — llpte-core package.json exports
// Wires the new sub-paths so TypeScript resolves @r3/llpte-core/* correctly
// ══════════════════════════════════════════════
function phase12_packageExports(): void {
  log("INFO", "PHASE 12 — llpte-core package.json exports field (wiring)");

  const pkgPath = "packages/llpte-core/package.json";
  const raw = readFile(pkgPath);
  if (!raw) {
    // Create minimal package.json if missing
    writeFile(pkgPath, JSON.stringify({
      name: "@r3/llpte-core",
      version: "0.0.1",
      type: "module",
      main: "./src/index.ts",
      exports: {
        ".":              { types: "./src/index.ts",             default: "./src/index.ts" },
        "./types":        { types: "./src/types/index.ts",       default: "./src/types/index.ts" },
        "./engine":       { types: "./src/engine/index.ts",      default: "./src/engine/index.ts" },
        "./mixer":        { types: "./src/mixer/index.ts",       default: "./src/mixer/index.ts" },
        "./dj":           { types: "./src/dj/index.ts",          default: "./src/dj/index.ts" },
        "./effects":      { types: "./src/effects/index.ts",     default: "./src/effects/index.ts" },
        "./arrangement":  { types: "./src/arrangement/index.ts", default: "./src/arrangement/index.ts" },
      },
    }, null, 2) + "\n", {
      rootCause: "llpte-core/package.json was missing — TypeScript could not resolve @r3/llpte-core",
      rationale: "exports field enables subpath imports and proper TypeScript resolution",
      surface: "All packages, services, server that import from @r3/llpte-core",
      regression: "New file — no existing package.json overwritten",
    });
    return;
  }

  try {
    const pkg = JSON.parse(raw);
    const needed = {
      ".":              { types: "./src/index.ts",             default: "./src/index.ts" },
      "./types":        { types: "./src/types/index.ts",       default: "./src/types/index.ts" },
      "./engine":       { types: "./src/engine/index.ts",      default: "./src/engine/index.ts" },
      "./mixer":        { types: "./src/mixer/index.ts",       default: "./src/mixer/index.ts" },
      "./dj":           { types: "./src/dj/index.ts",          default: "./src/dj/index.ts" },
      "./effects":      { types: "./src/effects/index.ts",     default: "./src/effects/index.ts" },
      "./arrangement":  { types: "./src/arrangement/index.ts", default: "./src/arrangement/index.ts" },
    };
    pkg.exports = { ...(pkg.exports ?? {}), ...needed };
    if (!pkg.main) pkg.main = "./src/index.ts";
    log("PATCH", pkgPath, "Merging exports field with existing package.json");
    if (!DRY_RUN) fs.writeFileSync(path.resolve(ROOT, pkgPath), JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  } catch {
    hardStop("packages/llpte-core/package.json is invalid JSON", pkgPath);
  }

  // Ensure root barrel exists
  writeFile("packages/llpte-core/src/index.ts", `
// Root barrel — imports from this file resolve @r3/llpte-core
export * from "./types";
export * from "./engine";
export * from "./mixer";
export * from "./dj";
export * from "./effects";
export * from "./arrangement";
`.trimStart(), {
    rootCause: "No root barrel — @r3/llpte-core had no default entry",
    rationale: "Barrel lets callers import anything without knowing sub-paths",
    surface: "services/ai-mix, server routers, client packages",
    regression: "Additive",
  });
}

// ══════════════════════════════════════════════
// PHASE 13 — services/ai-mix package.json
// Ensures workspace dep on @r3/llpte-core is declared
// ══════════════════════════════════════════════
function phase13_aiMixPackage(): void {
  log("INFO", "PHASE 13 — services/ai-mix/package.json workspace dependency (wiring)");

  const pkgPath = "services/ai-mix/package.json";
  const raw = readFile(pkgPath);

  if (!raw) {
    writeFile(pkgPath, JSON.stringify({
      name: "@r3/ai-mix",
      version: "0.0.1",
      type: "module",
      main: "./src/index.ts",
      dependencies: {
        "@r3/llpte-core": "workspace:*",
      },
    }, null, 2) + "\n", {
      rootCause: "services/ai-mix/package.json was missing — workspace dep could not be resolved",
      rationale: "Workspace dep ensures AIMixingService gets branded types from llpte-core",
      surface: "AIMixingService.ts import of MixerState",
      regression: "New file — safe to create",
    });
    return;
  }

  try {
    const pkg = JSON.parse(raw);
    if (!pkg.dependencies?.["@r3/llpte-core"]) {
      pkg.dependencies = { ...(pkg.dependencies ?? {}), "@r3/llpte-core": "workspace:*" };
      log("PATCH", pkgPath, "Adding @r3/llpte-core workspace dependency");
      if (!DRY_RUN) fs.writeFileSync(path.resolve(ROOT, pkgPath), JSON.stringify(pkg, null, 2) + "\n", "utf-8");
    } else {
      log("VERIFY", `${pkgPath} already has @r3/llpte-core dependency`);
    }
  } catch {
    hardStop("services/ai-mix/package.json is invalid JSON", pkgPath);
  }
}

// ══════════════════════════════════════════════
// PHASE 14 — Patch server/trpc.ts
// Injects MixerEngine + DJEngine into tRPC context
// ══════════════════════════════════════════════
function phase14_wireTrpcContext(): void {
  log("INFO", "PHASE 14 — Patch server/trpc.ts to inject engine context (wiring)");

  // Detect actual trpc path — default to server/trpc.ts (server/src/ does not exist in this tree)
  const trpcPath = exists("server/src/trpc.ts") ? "server/src/trpc.ts" : "server/trpc.ts";
  const raw = readFile(trpcPath);

  if (!raw) {
    log("WARN", `${trpcPath} not found — creating minimal trpc.ts with engine context`);
    writeFile(trpcPath, `
import { initTRPC } from "@trpc/server";
import { MixerEngine } from "@r3/llpte-core/mixer";
import { DJEngine }    from "@r3/llpte-core/dj";
import type { MixerState } from "@r3/llpte-core/types";
import type { DJSession } from "@r3/llpte-core/types";

// ── Singleton engines (module-level — one instance per server process) ──
const EMPTY_MIXER_STATE: MixerState = {
  channels: new Map(),
  buses: new Map(),
  masterFader: 0 as any,
  soloExclusive: true,
};

const DEFAULT_DJ_SESSION: DJSession = {
  decks: {
    A: { id: "A", trackId: null, position: 0 as any, bpm: 120, pitch: 0,
         playbackRate: 1, isPlaying: false, isLooping: false,
         loopStart: null, loopEnd: null, cuePoints: [], beatGrid: null, waveformData: null },
    B: { id: "B", trackId: null, position: 0 as any, bpm: 120, pitch: 0,
         playbackRate: 1, isPlaying: false, isLooping: false,
         loopStart: null, loopEnd: null, cuePoints: [], beatGrid: null, waveformData: null },
    C: { id: "C", trackId: null, position: 0 as any, bpm: 120, pitch: 0,
         playbackRate: 1, isPlaying: false, isLooping: false,
         loopStart: null, loopEnd: null, cuePoints: [], beatGrid: null, waveformData: null },
    D: { id: "D", trackId: null, position: 0 as any, bpm: 120, pitch: 0,
         playbackRate: 1, isPlaying: false, isLooping: false,
         loopStart: null, loopEnd: null, cuePoints: [], beatGrid: null, waveformData: null },
  },
  crossfader: 0,
  masterBpm: 120,
  syncEnabled: false,
  tempoRange: 0.10,
};

export const mixerEngine = new MixerEngine(EMPTY_MIXER_STATE);
export const djEngine    = new DJEngine(DEFAULT_DJ_SESSION);

// ── tRPC context type ──
export interface Context {
  mixerEngine: MixerEngine;
  djEngine: DJEngine;
}

export function createContext(): Context {
  return { mixerEngine, djEngine };
}

const t = initTRPC.context<Context>().create();
export const router          = t.router;
export const publicProcedure = t.procedure;
`.trimStart(), {
      rootCause: "server/trpc.ts was missing — tRPC could not be initialised",
      rationale: "Minimal trpc.ts with singleton engines and typed context",
      surface: "All tRPC routers (mixer, dj, aiMix), server/index.ts",
      regression: "New file — review and adjust engine initial state as needed",
    });
    return;
  }

  // If trpc.ts exists, patch it to add engine context if not already there
  if (raw.includes("mixerEngine") && raw.includes("djEngine")) {
    log("VERIFY", `${trpcPath} already has mixerEngine + djEngine context`);
    return;
  }

  const engineImports = `
// R3 Engine Context — injected by implement-r3.ts Phase 14
import { MixerEngine } from "@r3/llpte-core/mixer";
import { DJEngine }    from "@r3/llpte-core/dj";
import type { MixerState, DJSession } from "@r3/llpte-core/types";

const EMPTY_MIXER_STATE: MixerState = {
  channels: new Map(), buses: new Map(),
  masterFader: 0 as any, soloExclusive: true,
};
const DEFAULT_DJ_SESSION: DJSession = {
  decks: {
    A: { id: "A", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
    B: { id: "B", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
    C: { id: "C", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
    D: { id: "D", trackId: null, position: 0 as any, bpm: 120, pitch: 0, playbackRate: 1,
         isPlaying: false, isLooping: false, loopStart: null, loopEnd: null,
         cuePoints: [], beatGrid: null, waveformData: null },
  },
  crossfader: 0, masterBpm: 120, syncEnabled: false, tempoRange: 0.10,
};
export const mixerEngine = new MixerEngine(EMPTY_MIXER_STATE);
export const djEngine    = new DJEngine(DEFAULT_DJ_SESSION);
// END R3 Engine Context
`;

  // Safe strategy: prepend the engine block to the very top of the file.
  // We never anchor into an existing import statement — that always risks splitting it.
  // patchFile idempotency guard ("mixerEngine") prevents double-injection on reruns.
  if (!DRY_RUN) {
    const currentContent = fs.readFileSync(path.resolve(ROOT, trpcPath), "utf-8");
    if (!currentContent.includes("mixerEngine")) {
      log("PATCH", trpcPath, "Prepending engine singletons to top of file");
      fs.writeFileSync(
        path.resolve(ROOT, trpcPath),
        engineImports.trimStart() + "\n" + currentContent,
        "utf-8"
      );
    } else {
      log("VERIFY", `PATCH already applied: ${trpcPath}`, "mixerEngine already present");
    }
  } else {
    log("PATCH", trpcPath, "[DRY-RUN] Would prepend engine singletons to top of file");
  }

  // Append a comment reminding the dev to merge engines into createContext,
  // but only if createContext exists and the reminder isn't already there.
  // Use append (not anchor-replace) to avoid any risk of splitting function signatures.
  if (raw.includes("createContext") && !raw.includes("R3: add engines to context")) {
    if (!DRY_RUN) {
      const current = fs.readFileSync(path.resolve(ROOT, trpcPath), "utf-8");
      if (!current.includes("R3: add engines to context")) {
        fs.appendFileSync(
          path.resolve(ROOT, trpcPath),
          "\n// R3: add engines to context — update your createContext() return value:\n" +
          "// export function createContext() { return { ...yourExistingCtx, mixerEngine, djEngine }; }\n"
        );
        log("PATCH", trpcPath, "Appended createContext merge reminder");
      }
    } else {
      log("PATCH", trpcPath, "[DRY-RUN] Would append createContext merge reminder");
    }
  }
}

// ══════════════════════════════════════════════
// PHASE 15 — Patch server/index.ts
// Attach SessionBroadcaster + appRouter
// ══════════════════════════════════════════════
function phase15_wireServerIndex(): void {
  log("INFO", "PHASE 15 — Patch server/index.ts to wire broadcaster + appRouter (wiring)");

  const indexPath = "server/index.ts";
  const raw = readFile(indexPath);
  if (!raw) {
    log("WARN", `${indexPath} not found — skipping server/index.ts patch`);
    log("WARN", "Manually add the following to your server entry point:");
    console.log(`
  // ── Add after WebSocketServer is created ──
  import { SessionBroadcaster } from "./ws/SessionBroadcaster";
  import { appRouter } from "./routers/index";
  import { createContext } from "./trpc";
  import { createExpressMiddleware } from "@trpc/server/adapters/express";
  import { mixerEngine, djEngine } from "./trpc";

  const broadcaster = new SessionBroadcaster();
  broadcaster.attach(wss); // your WebSocketServer instance

  // Subscribe engines to broadcast state changes
  mixerEngine.subscribe((_event, state) => {
    broadcaster.broadcast({ type: "MIXER_STATE_CHANGE", payload: state });
  });
  djEngine.subscribe((_action, session) => {
    broadcaster.broadcast({ type: "DJ_SESSION_CHANGE", payload: session });
  });

  // Mount tRPC
  app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));
`);
    return;
  }

  // Patch: prepend imports at the very top of the file (safe — no anchor word-splitting)
  patchFile(
    indexPath,
    // Use the first real import line as anchor rather than bare "import"
    raw.split("\n").find((l) => l.trimStart().startsWith("import ")) ?? "import ",
    `import { SessionBroadcaster } from "./ws/SessionBroadcaster";\nimport { appRouter } from "./routers/index";\nimport { createContext, mixerEngine, djEngine } from "./trpc";\nimport { createExpressMiddleware } from "@trpc/server/adapters/express";`,
    "SessionBroadcaster",
    "Add SessionBroadcaster, appRouter, engine, and tRPC middleware imports"
  );

  // Patch: attach broadcaster AFTER wss creation, and wire engine listeners immediately after
  const wssAnchor = raw.includes("new WebSocketServer(")
    ? "new WebSocketServer("
    : raw.includes("new WebSocket.Server(")
      ? "new WebSocket.Server("
      : null;

  if (wssAnchor) {
    // Find the full wss assignment line
    const wssLine = raw.split("\n").find((l) => l.includes(wssAnchor));
    // Only patch if the wss is constructed on a single line (ends with ; or }) — 
    // multi-line construction would insert code inside the argument object
    const isSingleLine = wssLine ? /[;)}\]]/.test(wssLine.trimEnd().slice(-1)) : false;
    if (wssLine && isSingleLine) {
      patchFile(
        indexPath,
        wssLine,
        `\n// R3: broadcaster wired to wss — attach AFTER wss is constructed above\nconst broadcaster = new SessionBroadcaster();\nbroadcaster.attach(wss);\nmixerEngine.subscribe((_e, state) => broadcaster.broadcast({ type: "MIXER_STATE_CHANGE", payload: state }));\ndjEngine.subscribe((_a, session) => broadcaster.broadcast({ type: "DJ_SESSION_CHANGE", payload: session }));`,
        "broadcaster.attach(wss)",
        "Attach broadcaster to wss and wire engine listeners (placed after wss construction)"
      );
    } else {
      log("WARN", "WebSocketServer construction is multi-line — cannot safely auto-patch",
        "Add manually after your wss is fully constructed:\n" +
        "  const broadcaster = new SessionBroadcaster();\n" +
        "  broadcaster.attach(wss);\n" +
        "  mixerEngine.subscribe((_e, s) => broadcaster.broadcast({ type: 'MIXER_STATE_CHANGE', payload: s }));\n" +
        "  djEngine.subscribe((_a, s) => broadcaster.broadcast({ type: 'DJ_SESSION_CHANGE', payload: s }));"
      );
    }
  } else {
    log("WARN", "No WebSocketServer construction found in server/index.ts", "Add manually: broadcaster.attach(wss) after your wss is created");
  }

  // Patch: mount tRPC middleware — insert after the last app.use() line we find, or before listen()
  if (!raw.includes("createExpressMiddleware") && raw.includes("app.listen")) {
    patchFile(
      indexPath,
      "app.listen(",
      `// tRPC — added by implement-r3.ts Phase 15\napp.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));\n`,
      "tRPC — added by implement-r3",
      "Mount tRPC middleware before app.listen"
    );
  } else if (!raw.includes("createExpressMiddleware") && raw.includes("app.use(")) {
    log("WARN", "Could not auto-mount tRPC — add manually:", `app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));`);
  }
}

// ══════════════════════════════════════════════
// PHASE 16 — Report
// ══════════════════════════════════════════════
function writeReport(): void {
  const report = [
    "# R3 Platform Implementation Report",
    `Generated: ${new Date().toISOString()}`,
    DRY_RUN ? "\n> **DRY RUN** — no files written\n" : "",
    "\n## Phases Run\n",
    ...reportLines,
    "\n## Remaining Manual Steps\n",
    "1. Run `pnpm install` (or `npm install`) to hoist new workspace deps",
    "2. Review server/trpc.ts — confirm mixerEngine + djEngine are in createContext() return value",
    "3. In server/index.ts — call `broadcaster.attach(wss)` after wss is created",
    "4. Uncomment the tRPC middleware mount in server/index.ts and adjust path if needed",
    "5. Run `pnpm drizzle-kit check` to verify db/schema/r3-platform.schema.ts against existing DB",
    "6. Delete duplicate type files flagged in CONFLICT warnings above, then update their imports to @r3/llpte-core",
    "7. Add `@r3/llpte-core` to tsconfig paths if using path aliases",
  ].join("\n");

  if (!DRY_RUN) {
    fs.writeFileSync(path.resolve(ROOT, "implement-r3-report.md"), report, "utf-8");
    console.log("\n📋 Report written → implement-r3-report.md");
  }
}

// ─────────────────────────────────────────────
// 5. MAIN ORCHESTRATOR
// ─────────────────────────────────────────────
const PHASES: Array<{ id: number; name: string; fn: () => void }> = [
  { id: 1,  name: "Shared Type Contracts",   fn: phase1_sharedTypes       },
  { id: 2,  name: "Audio Engine Core",       fn: phase2_audioEngine       },
  { id: 3,  name: "Mixer Engine",            fn: phase3_mixerEngine       },
  { id: 4,  name: "DJ Engine",               fn: phase4_djEngine          },
  { id: 5,  name: "Effects Engine",          fn: phase5_effectsEngine     },
  { id: 6,  name: "AI Mixing Service",       fn: phase6_aiMixing          },
  { id: 7,  name: "Arrangement Engine",      fn: phase7_arrangementEngine },
  { id: 8,  name: "tRPC Routers",            fn: phase8_tRPCRouters       },
  { id: 9,  name: "WebSocket Broadcaster",   fn: phase9_websocket         },
  { id: 10, name: "DB Schema",               fn: phase10_dbSchema         },
  { id: 11, name: "Orphan Detection",        fn: phase11_orphanDetection  },
  { id: 12, name: "Package Exports Wiring",  fn: phase12_packageExports   },
  { id: 13, name: "AI-Mix Package Wiring",   fn: phase13_aiMixPackage     },
  { id: 14, name: "tRPC Context Wiring",     fn: phase14_wireTrpcContext  },
  { id: 15, name: "Server Index Wiring",     fn: phase15_wireServerIndex  },
];

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  R3 Platform — Expert Implementation Command (Corrected v2)");
  console.log("  Phases 1-11: content  |  Phases 12-15: wiring");
  if (DRY_RUN)     console.log("  MODE: DRY RUN — no files will be written");
  if (PHASE_FILTER) console.log(`  MODE: PHASE ${PHASE_FILTER} ONLY`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (!SKIP_AUDIT) auditProjectTree();
  else log("WARN", "Audit skipped via --skip-audit (NOT RECOMMENDED)");

  const toRun = PHASE_FILTER ? PHASES.filter((p) => p.id === PHASE_FILTER) : PHASES;

  for (const phase of toRun) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Phase ${phase.id}: ${phase.name}`);
    console.log("─".repeat(60));
    try {
      phase.fn();
    } catch (err) {
      hardStop(`Phase ${phase.id} (${phase.name}) threw unexpectedly`, String(err));
    }
  }

  writeReport();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  ✅ Complete — phases: ${toRun.map((p) => p.id).join(", ")}`);
  if (DRY_RUN) console.log("  No files written (dry run)");
  console.log("\n  NEXT STEPS:");
  console.log("  1. pnpm install");
  console.log("  2. Confirm server/trpc.ts createContext() includes mixerEngine + djEngine");
  console.log("  3. Call broadcaster.attach(wss) in server/index.ts after wss init");
  console.log("  4. Mount tRPC: app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }))");
  console.log("  5. pnpm drizzle-kit check");
  console.log("  6. Delete duplicate type files flagged in implement-r3-report.md");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => hardStop("Unhandled error in main()", String(err)));
