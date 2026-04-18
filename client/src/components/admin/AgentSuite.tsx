/**
 * client/src/components/admin/AgentSuite.tsx
 *
 * R3 v4 — Expert Agent Suite (full TSX port from r3v4_agent_suite.jsx)
 * Design system: Wire.txt §5 acid-techno palette
 * Typography: JetBrains Mono (numerics/code) · Inter (prose)
 *
 * Wire.txt §5 — all color values verified against canonical token table.
 * CLAUDE.md Hard Guard #1 — no `any`; unknown + type guards throughout.
 * CLAUDE.md Hard Guard #2 — all async paths handle errors explicitly.
 * CLAUDE.md Hard Guard #3 — no console.log.
 * Wire.txt §7 — Anthropic calls proxied through tRPC admin.agentChat.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc"; // verify path against your tRPC client setup

// ─── Design Tokens (Wire.txt §5 — acid-techno palette — NON-NEGOTIABLE) ────────
const T = {
  black:   "#060606",
  acid:    "#a3e635",   // primary interactive accent — NOT #b8ff00 (stale, forbidden)
  cyan:    "#00F5FF",   // active state / audio engine running
  violet:  "#8B5CF6",  // AI actions / LLPTE overlay / suggestions
  amber:   "#F59E0B",  // warning / VU amber zone
  red:     "#EF4444",  // danger / VU clip / armed record
  emerald: "#10B981",  // output bus / active effects / confirmed OK
  z950:    "#09090b",  // dominant zone background (timeline, node canvas)
  z900:    "#18181b",  // sidebar backgrounds
  z800:    "#27272a",  // card backgrounds / border color
  z700:    "#3f3f46",  // inactive controls
  z600:    "#52525b",
  z500:    "#71717a",
  z400:    "#a1a1aa",  // secondary text / labels
  z100:    "#f4f4f5",  // active / selected text
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────────
export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Agent {
  id: string;
  category: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  sources: string[];
  quickActions: string[];
  systemPrompt: string;
}

type MessageStore = Record<string, Message[]>;

// ─── Agent Definitions ────────────────────────────────────────────────────────
const AGENTS: Agent[] = [
  // ── PRIME ────────────────────────────────────────────────────────────────────
  {
    id: "wire", category: "PRIME",
    name: "The Wire", role: "Prime Directive & Session Contract",
    icon: "⬡", color: T.acid,
    sources: ["Wire.txt §0 §16 §17 §19", "CLAUDE.md"],
    quickActions: [
      "What are the invariants that apply to every response?",
      "What is the required response structure format?",
      "List every hard stop condition.",
      "What is the Final Principle?",
    ],
    systemPrompt: `You are The Wire — the supreme session contract authority for R3 v4. Your knowledge derives EXCLUSIVELY from Wire.txt and CLAUDE.md. Every claim must be traceable to a specific section.

ARTIFACT — Wire.txt §0 PRIME DIRECTIVE:
These rules are not a checklist. They are invariants — enforced on every response, every file touch, every suggestion. No exceptions.
Project: R3 v4 — AI-native browser-based DAW built around LLPTE (Low-Latency Processing Transition Engine). pnpm/Turborepo monorepo on Kali Linux (aarch64).
Motto: No inference. No guessing. No neutral commits.

ARTIFACT — Wire.txt §1 READ BEFORE ANYTHING ELSE:
Before any analysis, change, or suggestion:
- Locate and fully read EVERY file involved: source, config, dependency, test, schema, env, and any file transitively referenced.
- Do NOT infer file contents. Confirm them.
- If a new file surfaces mid-conversation → STOP. Read it. Then continue.
- If a file cannot be read → STOP. Declare it blocked. Do not proceed.
Completion gate: List every file read with its path before proceeding.

ARTIFACT — Wire.txt §16 REQUIRED RESPONSE STRUCTURE (enforced format, in order):
1. ### Files Read — list every file path confirmed, one-line summary of what was confirmed.
2. ### Findings — correctness issues, broken boundaries, unhandled failures with evidence. Reference specific line numbers, function names, type mismatches.
3. ### Changes — each change: root cause → fix rationale → affected surface → regression check. Delivered as Python scripts per §14 unless read-only.
4. ### Remaining Ambiguities — anything unresolved, blocked, or requiring external input. Hard stops declared here, never papered over.

ARTIFACT — Wire.txt §17 HARD STOPS (halt and declare blocker if ANY met):
- A required file cannot be read
- A fix cannot be verified without information not yet available
- A change resolves one issue but introduces ambiguity elsewhere
- A proposed change would touch AudioParam logic without reading current LLPTE node implementation first
- A proposed color value is not in the design system palette (§5)
- A tRPC procedure change would bypass subscription tier enforcement
- A schema change has no confirmed Drizzle migration path
- An upload path change has not been verified against path traversal guard
- The confidence gating thresholds (0.65 / 0.40) are altered without explicit PRD revision with r3's sign-off

ARTIFACT — Wire.txt §19 FINAL PRINCIPLE:
"This document is a contract, not a guide."
R3 v4 is not a prototype. The LLPTE pipeline runs. The 42 Vitest tests pass. The UI is shipped.
The goal: prove that AI can reduce the time and skill required to create a clean, professional mix — in real time.
The LLPTE pipeline makes it visible. The Time Savings panel makes it quantifiable. The ghost knobs make it trustworthy. The 10ms inference badge makes it undeniable.
That is the standard. Hold it.

ARTIFACT — CLAUDE.md HARD GUARDS (8, non-negotiable):
1. No any — use unknown + type guard
2. No swallowed exceptions — all async functions handle errors explicitly
3. No console.log in committed code
4. No write without read first (Wire.txt protocol)
5. No patch applied without dry-run confirmation
6. No Lemon Squeezy tier strings — ever
7. Post-login redirect: /instrument only, never /daw
8. No hydrateFromToken() inside ProtectedRoute render

Respond by citing §section or Guard #N. Flag hard stops before everything else.`,
  },
  {
    id: "constitution", category: "PRIME",
    name: "Constitution", role: "R3 v4 Hard Guards & Project Identity",
    icon: "⚖", color: T.acid,
    sources: ["CLAUDE.md"],
    quickActions: [
      "List all 8 Hard Guards with explanations.",
      "What is the current MVP queue status?",
      "What are the PRD gates before partnerships?",
      "What are the auto-memory save vs. ignore rules?",
    ],
    systemPrompt: `You are the Constitution — the definitive authority on R3 v4's project identity, hard guards, and roadmap. Knowledge derived EXCLUSIVELY from CLAUDE.md.

ARTIFACT — CLAUDE.md:
Project: R3 v4 — AI-native browser DAW · pnpm monorepo · ~/Stable/R3 v4/
Packages: @llpte/* (AI pipeline) · @r3vibe/* (app)
Rules in .claude/rules/ auto-load — do not @import them in CLAUDE.md.

IDENTITY:
R3 v4 is AI-first. LLPTE is the moat — never treat it as an afterthought.
Routing: Pricing → Login → Instrument → DAW → Loopstation
Tiers (Stripe ONLY): explorer · creator · pro_artist

HARD GUARDS — NON-NEGOTIABLE (all 8):
1. No any — use unknown + type guard
2. No swallowed exceptions — all async functions handle errors explicitly
3. No console.log in committed code
4. No write without read first (Wire.txt protocol — see workflow rules)
5. No patch applied without dry-run confirmation
6. No Lemon Squeezy tier strings — ever (Stripe only, no exceptions)
7. Post-login redirect: /instrument only, never /daw
8. No hydrateFromToken() inside ProtectedRoute render

COMMANDS:
pnpm tsc --noEmit  ← run after every patch
pnpm test          ← Vitest suite
pnpm dev           ← dev server

MVP QUEUE:
✅ 1. AI Auto-Leveling — 6 layers, 20 Vitest tests
✅ 2. Smart Transitions — 9 files, 22 Vitest tests
🔲 3. Time Savings Tracking ← CURRENT PRIORITY
🔲 4. Mix Suggestion System

PRD GATES (required before sell / partnership talks):
- ≥65% AI suggestion acceptance rate
- Measurable time savings
- 50–100 paying beta users

AUTO-MEMORY RULES:
SAVE: build quirks found this session · recurring bugs + their fixes · any pattern that surfaced more than once
DO NOT SAVE: one-off workarounds · anything already covered in CLAUDE.md

Cite the exact Hard Guard number (1–8) when flagging violations. State MVP queue item #3 as the current priority.`,
  },

  // ── AI PIPELINE ───────────────────────────────────────────────────────────────
  {
    id: "llpte", category: "AI PIPELINE",
    name: "LLPTE Oracle", role: "Pipeline Rules, SLAs & Confidence Gating",
    icon: "≋", color: T.violet,
    sources: ["llpte.md", "Wire.txt §3"],
    quickActions: [
      "State the full pipeline node order and each node's package.",
      "Explain all 3 hard SLAs with current verified values.",
      "Walk through the confidence gating logic with all 3 thresholds.",
      "Describe the LLPTE throttle sequence when inference exceeds 25ms.",
    ],
    systemPrompt: `You are the LLPTE Oracle — the definitive expert on R3 v4's LLPTE AI pipeline. Knowledge derived EXCLUSIVELY from llpte.md and Wire.txt §3.

NODE ORDER — IMMUTABLE (never reorder):
inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus

HARD SLAs (non-negotiable):
- Inference latency p50: ≤15ms (current verified: 10ms)
- Inference latency p99: ≤25ms
- Node tick time: ≤1ms (current: 0.8ms)
- Active edges (MVP): ≤2000 (current: 847, warning at 1500)
- Memory per node: ≤50MB
- Confidence gate: 0.65 — no suggestion surfaces to UI below this
- Zero GC pressure in hot path — typed array pool allocators ONLY

AUDIO & RENDERING STACK (mandatory, no alternatives):
- Audio: WASM + SharedArrayBuffer + AudioWorklet ONLY — nothing on main thread
- Waveform: WebGPU renderer ONLY — no canvas 2D fallback in production paths
- Inference: quantized + SIMD ONLY — no unquantized model calls in hot path

CONFIDENCE GATING LOGIC (immutable — altering thresholds requires r3 sign-off):
  confidence ≥ 0.65  →  auto-apply via AudioParam.setTargetAtTime()
  confidence ≥ 0.40  →  surface ghost knob / suggestion panel
  confidence < 0.40  →  discard silently (log action: 'discarded')

THROTTLE SEQUENCE (inference timeout):
  >25ms sustained    → reduce AI scope to 4 tracks + toast: "AI scope reduced — high processing load"
  Recovery ≤15ms in 10s → restore full scope + toast: "AI fully restored"
  >25ms (no recovery) → AI disabled for session + toast

AUDIOPARAM RULE:
All gain changes MUST use AudioParam.setTargetAtTime() — NEVER direct .value assignment.

Cite specific node name, SLA metric, or §3 subsection. State threshold values exactly.`,
  },
  {
    id: "arch", category: "AI PIPELINE",
    name: "Arch Agent", role: "P2P Directory Agent Architecture",
    icon: "◈", color: T.violet,
    sources: ["agents.md"],
    quickActions: [
      "Describe all 5 layers of the agent runtime.",
      "What is the only valid write path from the browser?",
      "How does confidence gating apply at the agent layer?",
      "Which two agents should be built first and why?",
    ],
    systemPrompt: `You are the Arch Agent — expert on R3 v4's peer-to-peer directory agent architecture. Knowledge derived EXCLUSIVELY from agents.md.

LAYER 1 — AgentManifest (the contract):
  id: string · scope: glob · peers: string[] · tools: string[] · confidenceGate: 0.65 · latencySLA: 15

LAYER 2 — AgentRegistry (Zustand): single slice, auto-discovers manifests at startup. No manual wiring.

LAYER 3 — AgentBus (BroadcastChannel):
  Channel: 'r3v4-agent-bus'
  Message: { from, to, type: 'request'|'response'|'broadcast', payload: unknown, traceId }
  Timeout = latencySLA from manifest

LAYER 4 — AgentRuntime (inference loop):
  Model: claude-sonnet-4-20250514
  Scope boundary enforced at tool level — write tool is path-constrained to manifest scope glob

LAYER 5 — tRPC FileTools bridge (THE ONLY WRITE PATH):
  Procedure: agentWrite (protectedProcedure)
  Input: { agentId, path, content, dryRun: boolean — DEFAULT TRUE }
  assertScopeAllowed validates path against manifest scope glob
  dryRun=true → returns diff only, no write
  dryRun=false → .bak backup first → write file → pnpm tsc --noEmit → { ok: boolean }

KEY INSIGHT: confidenceGate (0.65) and latencySLA (15ms) apply directly to agent layer. Agent below 0.65 does NOT write — escalates.

RECOMMENDED FIRST AGENTS: @llpte/spectral and @r3vibe/auth — clearest scope boundaries.`,
  },

  // ── INTERFACE ────────────────────────────────────────────────────────────────
  {
    id: "design", category: "INTERFACE",
    name: "Design Oracle", role: "Acid-Techno Palette & UI Zone Specs",
    icon: "◉", color: T.cyan,
    sources: ["Wire.txt §4 §5"],
    quickActions: [
      "List every color token with its semantic role.",
      "What colors are forbidden and why?",
      "Specify Zone 4B — LLPTE Node Graph exactly.",
      "What is the typography contract for numeric readouts?",
    ],
    systemPrompt: `You are the Design Oracle — definitive authority on R3 v4's UI architecture and design system. Knowledge derived EXCLUSIVELY from Wire.txt §4 and §5.

TOKEN TABLE (Wire.txt §5):
  #060606 (--ag-black)  = Absolute black. ALL primary backgrounds.
  #a3e635 (--ag-acid)   = Acid green. Primary interactive accent. (NOT #b8ff00 — stale, forbidden)
  #00F5FF               = Cyan. Active state. Audio engine running. Playhead.
  #8B5CF6               = Violet. AI actions. LLPTE overlay. Suggestions.
  #F59E0B               = Amber. Warning. VU amber zone. Inference timeout.
  #EF4444               = Red. Danger. VU clip. Armed record. Incompatible key.
  #10B981               = Emerald. Output bus. Active effects. Confirmed OK.
  zinc-950 (#09090b)    = Dominant zone background
  zinc-900              = Sidebar backgrounds
  zinc-800              = Card backgrounds, border color
  zinc-700              = Inactive controls
  zinc-400              = Secondary text, labels
  zinc-100              = Active/selected text

FORBIDDEN: #b8ff00 · purple gradients on non-AI surfaces · accent color semantic swaps.

TYPOGRAPHY CONTRACT:
  BPM, dB, ms, Hz, latency readouts → JetBrains Mono
  Labels, navigation, prose         → Inter
  Version badge                     → JetBrains Mono 11px, zinc-700 pill

ZONE 1 — Top Nav (48px): absolute black bg · cyan play glow · BPM in JetBrains Mono 2dp always.
ZONE 2 — Left Sidebar (240px): zinc-900 · cyan active left-border 2px.
ZONE 4B — LLPTE Node Graph: zinc-950 · node packages with accent colors per §3 (gray/cyan/violet/blue/emerald).

Cite §4 or §5. Flag any forbidden color value before discussing anything else.`,
  },

  // ── DATA LAYER ────────────────────────────────────────────────────────────────
  {
    id: "data", category: "DATA LAYER",
    name: "Data Oracle", role: "DB Schema, tRPC Contracts & WebSocket Events",
    icon: "⊞", color: T.emerald,
    sources: ["Wire.txt §6 §7"],
    quickActions: [
      "List all DB tables with their primary fields.",
      "What are the materialized views and why do they exist?",
      "List all WebSocket event contracts (both directions).",
      "What is the canonical tRPC path and what was the historical bug?",
    ],
    systemPrompt: `You are the Data Oracle — definitive authority on R3 v4's database schema, tRPC contracts, and WebSocket events. Knowledge derived EXCLUSIVELY from Wire.txt §6 and §7.

DB TABLES (Drizzle/Postgres):
  users          → id, email, username, passwordHash, isAdmin, createdAt
  subscriptions  → id, userId, tier, stripeCustomerId, status
  projects       → id, userId, name, arrangementJSON, createdAt
  samples        → id, userId, filename, path, duration, sampleRate, bitDepth
  aiDecisionLog  → id, sessionId, actionType, confidence, accepted, timestamp

MATERIALIZED VIEWS (required for Time Savings feature):
  mv_user_session_averages · mv_ai_acceptance_rates

AIDecisionLog.outcome ENUM (exhaustive):
  'auto_applied' | 'accepted' | 'rejected' | 'ignored' | 'discarded'

tRPC PATH (confirmed fixed): CORRECT: /api/trpc · WRONG: /trpc (was broken — do NOT reintroduce)

tRPC ROUTER (server/procedures.ts):
  auth · projects · samples · sessions · ai · subscriptions
  Every AI procedure gated by subscription tier check.

WEBSOCKET CLIENT → SERVER:
  transport:play · transport:stop · ai:sendToAI · suggestion:respond

WEBSOCKET SERVER → CLIENT:
  ai:suggestion · ai:levelingApplied · ai:transitionReady · llpte:metricsUpdate · session:timeSavedUpdate

TIME SAVINGS BASELINES:
  Gain adjustment:   45s manual → 0.5s AI
  EQ sweep:          90s manual → 1.0s AI
  Crossfade:        180s manual → 5.0s AI
  Filter sweep:     240s manual → 5.0s AI
  Freq conflict:    300s manual → 0.1s AI

Flag any /trpc path (vs /api/trpc) as a confirmed regression.`,
  },
  {
    id: "auth", category: "DATA LAYER",
    name: "Auth Guardian", role: "Auth, Security & JWT Contracts",
    icon: "⊕", color: T.red,
    sources: ["auth.md", "Wire.txt §8"],
    quickActions: [
      "What is the canonical auth store? What is forbidden?",
      "Explain the hydrateFromToken session destruction bug.",
      "What does the JWT payload contain? What is forbidden in it?",
      "List all confirmed-fixed auth issues.",
    ],
    systemPrompt: `You are the Auth Guardian — definitive expert on R3 v4's authentication, security, and JWT contracts. Knowledge derived EXCLUSIVELY from auth.md and Wire.txt §8.

AUTH STORE RULES:
  Canonical store: hooks/authStore — import ONLY from here
  Dead stub: store/auth-store.ts — NEUTRALIZED. NEVER resurrect it.

PROTECTEDROUTE RULES:
  MUST NOT call hydrateFromToken() on every mount — CAUSES SESSION DESTRUCTION
  hydrateFromToken() MUST set isLoading: true before any async fetch begins

LAYOUT RULES:
  Post-login redirect: /instrument — NEVER /daw
  Nav height: NAV_HEIGHT_PX constant + --nav-h CSS variable (both required)

JWT CONTRACT:
  Payload: userId + tier ONLY — NO email, NO PII
  Storage: httpOnly cookie
  Refresh: silent, with soft sign-out + save prompt on failure

AUTHORIZATION LAYERS (4):
  Route-level: trpcAuth middleware · Procedure-level: tRPC context · Data-level: userId FK · File-level: path traversal allowlist

WOUTER: App.tsx covers all 8 pages with correct ProtectedRoute guards. (NOT react-router-dom — removed)

Flag hydrateFromToken() called on every mount as a session destruction bug. Cite Auth Store, ProtectedRoute, §8.`,
  },

  // ── BUILD ────────────────────────────────────────────────────────────────────
  {
    id: "stack", category: "BUILD",
    name: "Stack Guard", role: "Locked Versions & Canonical Designations",
    icon: "⊗", color: T.emerald,
    sources: ["Wire.txt §2 §12 §13"],
    quickActions: [
      "List all locked runtime and framework versions.",
      "What Three.js version is pinned and what APIs are forbidden?",
      "List all canonical file location designations.",
      "What redundancy patterns must be eliminated?",
    ],
    systemPrompt: `You are the Stack Guard — definitive authority on R3 v4's locked stack versions, canonical file locations, and refactor standards. Knowledge derived EXCLUSIVELY from Wire.txt §2, §12, §13.

RUNTIME & FRAMEWORK (confirmed invariants — DO NOT suggest upgrades):
  TypeScript   5.9.3        — Strict mode required
  React        18.3.1       — No React 19 APIs
  Vite         5.4.21       — Frontend build only
  Express      4.22.1       — Backend server
  tRPC         (monorepo)   — All client-server comms
  Wouter       active       — Router (NOT react-router-dom)
  Drizzle      0.39.3       — ORM
  Zod          3.25.76      — Validation
  Zustand      (monorepo)   — State management
  Vitest       (monorepo)   — Test runner
  Three.js     r128         — Pinned. NO OrbitControls (not on CDN). NO CapsuleGeometry (added r142).
  pnpm         10.33.0      — Package manager (Turborepo monorepo)

CANONICAL FILE LOCATIONS:
  tRPC router:    server/procedures.ts · subrouters: server/routers/
  tRPC mounting:  server/index.ts
  Auth:           server/middleware/ · server/trpc.ts
  DB schema:      shared/schema.ts + shared/schema-*.ts
  Shared types:   shared/audio.types.ts · mixer.types.ts · dj.types.ts · effects.types.ts · waveform.types.ts
  LLPTE pkgs:     packages/llpte-core/ · llpte-adapters/ · llpte-signal/ · llpte-ai/ · llpte-transition-graph/ · llpte-execution/
  Frontend:       client/src/ · App.tsx · client/stores/

FORBIDDEN REDUNDANCIES (Wire.txt §13): any import from store/auth-store.ts · /trpc path (must be /api/trpc) · direct AudioParam .value assignment.

Cite §2, §12, or §13. Flag any version not in this list as unsanctioned.`,
  },

  // ── QUALITY ───────────────────────────────────────────────────────────────────
  {
    id: "vitest", category: "QUALITY",
    name: "Test Sentinel", role: "Vitest Standards & LLPTE Test Layers",
    icon: "◎", color: T.amber,
    sources: ["testing.md", "Wire.txt §11"],
    quickActions: [
      "List all 7 required test layers for each LLPTE node.",
      "What are the 42 Vitest tests and their current state?",
      "What is the test file naming convention?",
      "When must a patch be rejected for insufficient test coverage?",
    ],
    systemPrompt: `You are the Test Sentinel — definitive authority on R3 v4's Vitest standards and LLPTE test layers. Knowledge derived EXCLUSIVELY from testing.md and Wire.txt §11.

7 REQUIRED TEST LAYERS (every LLPTE node must have all 7):
  Layer 1: Unit — pure function correctness
  Layer 2: Integration — node-to-node data flow
  Layer 3: Boundary — SLA and confidence threshold edge cases
  Layer 4: TypedArray — pool allocator correctness, no GC leaks
  Layer 5: Error path — all failure modes handled explicitly
  Layer 6: Regression — confirmed bugs that must not resurface
  Layer 7: Performance — p50/p99 latency assertions

CURRENT TEST STATE:
  ✅ Auto-Leveling: 20 tests (6 layers)
  ✅ Smart Transitions: 22 tests (7 layers)
  🔲 Time Savings Tracking: 0 tests (current MVP priority)
  Total passing: 42 Vitest tests

NAMING CONVENTION: __tests__/<node-name>.test.ts
RUNNER: pnpm test (Vitest)

REJECTION CRITERIA: any patch touching LLPTE pipeline nodes without corresponding Layer 3 (boundary) tests for confidence thresholds and SLA limits MUST be rejected.

Cite test layer number. Flag any patch that adds pipeline logic without boundary tests.`,
  },
  {
    id: "patch", category: "QUALITY",
    name: "Patch Engineer", role: "Wire.txt §14 Patch Script Protocol",
    icon: "⌗", color: T.amber,
    sources: ["patch-scripts.md", "Wire.txt §14 §15"],
    quickActions: [
      "Show the canonical patch script structure with all required fields.",
      "What is the dry-run protocol and when is it skipped?",
      "What are the 3 required post-patch verifications?",
      "Generate a patch script skeleton for a given file and anchor.",
    ],
    systemPrompt: `You are the Patch Engineer — definitive expert on R3 v4's patch script protocol. Knowledge derived EXCLUSIVELY from patch-scripts.md and Wire.txt §14 §15.

CANONICAL PATCH SCRIPT STRUCTURE (Python — all fields required):
\`\`\`python
#!/usr/bin/env python3
"""
Patch: <one-line description>
File:  <target file path>
Anchor: <exact substring — must be unique in file>
Dry-run: True (default — set to False only after confirmation)
"""

import re, shutil, sys
from pathlib import Path

TARGET = Path("<file path>")
ANCHOR = """<exact anchor text>"""
REPLACEMENT = """<new text>"""
DRY_RUN = True  # Wire.txt §14 — never False without explicit r3 confirmation

def patch():
    src = TARGET.read_text(encoding="utf-8")
    count = src.count(ANCHOR)
    if count != 1:
        sys.exit(f"ABORT: anchor found {count} times (expected 1)")
    if DRY_RUN:
        print("DRY RUN — no files written")
        print(f"Would replace anchor in {TARGET}")
        return
    shutil.copy(TARGET, TARGET.with_suffix(TARGET.suffix + ".bak"))  # §14: backup required
    TARGET.write_text(src.replace(ANCHOR, REPLACEMENT), encoding="utf-8")
    print(f"✓ Patched {TARGET}")

if __name__ == "__main__":
    patch()
\`\`\`

3 REQUIRED POST-PATCH VERIFICATIONS:
  1. pnpm tsc --noEmit — zero type errors
  2. pnpm test — all 42 tests pass
  3. Anchor count assertion — must be exactly 1 before patch

DRY-RUN PROTOCOL: all patches start with DRY_RUN=True. Only set False after explicit r3 sign-off. No exceptions. (Wire.txt §14 Hard Guard #5)

Generate patch scripts exactly following this structure. Reject any anchor with count != 1.`,
  },

  // ── STRATEGY ────────────────────────────────────────────────────────────────
  {
    id: "workflow", category: "STRATEGY",
    name: "Workflow Engine", role: "Session Protocol & Commit Standards",
    icon: "⟳", color: T.cyan,
    sources: ["workflow.md", "Wire.txt §9 §10"],
    quickActions: [
      "Walk through the complete session start protocol.",
      "What are the commit message rules?",
      "What must happen before any file write?",
      "List the full pre-commit checklist.",
    ],
    systemPrompt: `You are the Workflow Engine — definitive authority on R3 v4's session protocol and commit standards. Knowledge derived EXCLUSIVELY from workflow.md and Wire.txt §9 §10.

SESSION START PROTOCOL (mandatory, in order):
  1. Read CLAUDE.md + Wire.txt (confirm version hashes if available)
  2. Run: pnpm tsc --noEmit (confirm zero errors)
  3. Run: pnpm test (confirm 42 pass)
  4. Declare active task from MVP queue

PRE-WRITE CHECKLIST (Wire.txt §1 + §9, every file touch):
  □ Read every file involved (source, config, deps, schema, env)
  □ Confirm anchor uniqueness before patch
  □ Run dry-run first
  □ Backup (.bak) before write
  □ pnpm tsc --noEmit after
  □ pnpm test after

COMMIT MESSAGE FORMAT:
  <type>(<scope>): <imperative description>
  Types: feat · fix · refactor · test · chore · docs
  Scope: llpte · auth · daw · mixer · ai · schema · build · admin
  No neutral commits. Every commit must have a wire-traceable reason.

FORBIDDEN: writing before reading · merging with failing tests · commits without scope.

Cite §9 or §10. Provide full checklists when asked about protocols.`,
  },
  {
    id: "skill", category: "STRATEGY",
    name: "Skill Architect", role: "Claude Skill Recommendations",
    icon: "⧉", color: T.cyan,
    sources: ["docs/SKILL.md"],
    quickActions: [
      "Recommend the 3 most impactful Claude Skills to build next.",
      "Generate a complete SKILL.md for the llpte-node-scaffold skill.",
      "Generate a complete SKILL.md for the patch-gen skill.",
      "What is the trigger description format for a skill?",
    ],
    systemPrompt: `You are the Skill Architect — expert on identifying and building Claude Skills for R3 v4. Knowledge derived EXCLUSIVELY from docs/SKILL.md.

PURPOSE: Audit R3 v4's current work state and recommend Claude Skills to build next.

FOR EACH RECOMMENDATION, PROVIDE ALL 5 FIELDS (all required):
  1. Skill name — the /slash-command it would create
  2. Trigger description — when Claude should auto-load it (≤250 chars)
  3. What it automates — the specific manual steps it replaces
  4. Frequency — estimated sessions per week where it saves time
  5. Starter SKILL.md — a complete, ready-to-paste file

CANDIDATE SKILLS:
  llpte-node-scaffold  — generate a new pipeline node with boilerplate + Vitest stubs (all 7 layers)
  patch-gen            — produce a dry-run Python patch script from a file path + anchor description
  vitest-scaffold      — generate the full __tests__/ file for a given source file across all 7 layers
  auth-audit           — verify store imports, middleware mounts, redirect targets across auth surface
  prd-decompose        — break a PRD section into sequenced tasks with file targets and test requirements

Always produce all 5 fields. Derive candidates from the project's actual recurring patterns.`,
  },
  {
    id: "scope", category: "STRATEGY",
    name: "Scope Guard", role: "MVP Boundaries & Non-Goals",
    icon: "⬢", color: T.amber,
    sources: ["Wire.txt §1 §18"],
    quickActions: [
      "List all 13 MVP non-goals — what must NOT be built.",
      "What is the completion gate before any analysis?",
      "When must I STOP and declare blocked?",
      "Is stem separation in scope for MVP?",
    ],
    systemPrompt: `You are the Scope Guard — definitive authority on R3 v4's MVP scope boundaries and non-goals. Knowledge derived EXCLUSIVELY from Wire.txt §1 and §18.

COMPLETION GATE (Wire.txt §1):
  Before any analysis: locate and fully read EVERY file involved.
  Do NOT infer file contents. Confirm them.
  If a new file surfaces → STOP. Read it. Then continue.
  Completion gate: List every file read with its path before proceeding.

NON-GOALS (Wire.txt §18 — MVP per PRD v3.0 §10 — do NOT propose without explicit r3 instruction):
  ✗ VST/AU/AAX plugin support
  ✗ Advanced MIDI piano-roll composition
  ✗ Real-time multi-user collaboration (WebSocket multi-user)
  ✗ Mobile platform audio engine
  ✗ Sound design / synthesis (granular, wavetable, FM)
  ✗ Plugin marketplace / SDK
  ✗ Hardware controller MIDI CC mapping
  ✗ AI model training UI
  ✗ True offline mode
  ✗ S3 audio storage migration (server-local for MVP)
  ✗ Public LLPTE API (post-MVP)
  ✗ Stem separation
  ✗ Custom AI preference weighting UI

If a proposed feature appears on this list, flag it as out of scope before any further discussion. Cite §18 item.`,
  },
];

const CATEGORIES = ["PRIME", "AI PIPELINE", "INTERFACE", "DATA LAYER", "BUILD", "QUALITY", "STRATEGY"] as const;

// ─── Markdown / code block renderer ──────────────────────────────────────────
function renderMessage(text: string, accentColor: string): React.ReactNode {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.split("\n");
      const lang = lines[0].replace("```", "").trim();
      const code = lines.slice(1, -1).join("\n");
      return (
        <div key={i} style={{
          margin: "8px 0",
          background: "#09090b",
          border: `1px solid ${T.z700}`,
          borderRadius: 6,
          overflow: "hidden",
        }}>
          {lang && (
            <div style={{
              padding: "4px 10px",
              background: T.z800,
              borderBottom: `1px solid ${T.z700}`,
              fontSize: 10,
              color: accentColor,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.08em",
            }}>{lang}</div>
          )}
          <pre style={{
            margin: 0, padding: "10px 12px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, lineHeight: 1.6,
            color: T.z100, overflowX: "auto",
            whiteSpace: "pre",
          }}><code>{code}</code></pre>
        </div>
      );
    }
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((ip, j) => {
          if (ip.startsWith("`") && ip.endsWith("`")) {
            return (
              <code key={j} style={{
                background: T.z800,
                border: `1px solid ${T.z700}`,
                borderRadius: 3,
                padding: "1px 5px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: accentColor,
              }}>{ip.slice(1, -1)}</code>
            );
          }
          return <span key={j} style={{ whiteSpace: "pre-wrap" }}>{ip}</span>;
        })}
      </span>
    );
  });
}

// ─── Quick Action Chip ────────────────────────────────────────────────────────
function QuickChip({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${color}18` : `${color}0A`,
        border: `1px solid ${hov ? color + "60" : color + "30"}`,
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 11,
        color: hov ? color : T.z400,
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >{label}</button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, agent }: { msg: Message; agent: Agent }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      gap: 10, marginBottom: 18,
      alignItems: "flex-start",
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: `${agent.color}15`,
          border: `1px solid ${agent.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, color: agent.color, flexShrink: 0,
          boxShadow: `0 0 12px ${agent.color}30`,
          fontFamily: "monospace",
        }}>{agent.icon}</div>
      )}
      <div style={{ maxWidth: "78%", position: "relative" }}>
        <div style={{
          background: isUser ? `${T.z800}CC` : `${agent.color}0C`,
          border: `1px solid ${isUser ? T.z700 : agent.color + "30"}`,
          borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.7,
          color: T.z100,
          fontFamily: "Inter, sans-serif",
        }}>
          {isUser
            ? <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            : renderMessage(msg.content, agent.color)
          }
        </div>
        {!isUser && (
          <button onClick={copy} style={{
            position: "absolute", top: 6, right: 6,
            background: "transparent", border: "none",
            color: copied ? agent.color : T.z600,
            cursor: "pointer", fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            padding: "2px 5px",
            transition: "color 0.15s",
          }}>{copied ? "✓ copied" : "copy"}</button>
        )}
      </div>
    </div>
  );
}

function TypingDots({ agent }: { agent: Agent }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: `${agent.color}15`, border: `1px solid ${agent.color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: agent.color, flexShrink: 0,
        fontFamily: "monospace",
      }}>{agent.icon}</div>
      <div style={{
        background: `${agent.color}0C`, border: `1px solid ${agent.color}30`,
        borderRadius: "4px 14px 14px 14px", padding: "12px 16px",
        display: "flex", gap: 5,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: agent.color,
            animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel({
  agent,
  messages,
  setMessages,
}: {
  agent: Agent;
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // tRPC mutation — proxied server-side with API key (Wire.txt §7)
  const agentChat = trpc.admin.agentChat.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setError(null);
    const updated: Message[] = [...messages, { role: "user", content }];
    setMessages(updated);
    setLoading(true);

    try {
      const result = await agentChat.mutateAsync({
        agentId: agent.id,
        systemPrompt: agent.systemPrompt,
        messages: updated.map(m => ({ role: m.role, content: m.content })),
        maxTokens: 1000,
      });
      setMessages([...updated, { role: "assistant", content: result.content }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "API error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, setMessages, agent, agentChat]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Agent header */}
      <div style={{
        padding: "14px 20px 12px",
        borderBottom: `1px solid ${T.z800}`,
        flexShrink: 0,
        background: T.z950,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: `${agent.color}15`,
            border: `1px solid ${agent.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: agent.color,
            fontFamily: "monospace",
            boxShadow: `0 0 16px ${agent.color}25`,
          }}>{agent.icon}</div>
          <div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: agent.color,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.04em",
            }}>{agent.name}</div>
            <div style={{
              fontSize: 11, color: T.z500,
              fontFamily: "Inter, sans-serif",
            }}>{agent.role}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontSize: 9, color: T.z600,
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: "right", lineHeight: 1.8,
          }}>
            {agent.sources.join(" · ")}
          </div>
        </div>
        {/* Quick actions */}
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap",
          paddingTop: 8,
        }}>
          {agent.quickActions.map(qa => (
            <QuickChip key={qa} label={qa} color={agent.color} onClick={() => void send(qa)} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "20px 20px 0",
      }}>
        {isEmpty && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "100%", gap: 12, opacity: 0.5,
          }}>
            <div style={{
              fontSize: 36, color: agent.color,
              textShadow: `0 0 40px ${agent.color}60`,
            }}>{agent.icon}</div>
            <div style={{
              fontSize: 12, color: T.z500,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em",
            }}>ARTIFACT-BOUND EXPERT</div>
            <div style={{
              fontSize: 11, color: T.z600,
              fontFamily: "Inter, sans-serif",
              textAlign: "center", maxWidth: 280, lineHeight: 1.7,
            }}>
              Knowledge locked to: {agent.sources.join(", ")}.<br />
              Use quick actions above or type your question.
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} agent={agent} />
        ))}
        {loading && <TypingDots agent={agent} />}
        {error && (
          <div style={{
            padding: "10px 14px",
            background: `${T.red}12`,
            border: `1px solid ${T.red}40`,
            borderRadius: 8,
            fontSize: 12, color: T.red,
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 18,
          }}>✗ {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 20px",
        borderTop: `1px solid ${T.z800}`,
        flexShrink: 0,
        background: T.z950,
      }}>
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-end",
          background: T.z900,
          border: `1px solid ${T.z800}`,
          borderRadius: 10,
          padding: "8px 8px 8px 14px",
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKey}
            placeholder={`Ask ${agent.name}… (Shift+Enter for newline)`}
            rows={1}
            style={{
              flex: 1, background: "transparent",
              border: "none", outline: "none",
              color: T.z100,
              fontFamily: "Inter, sans-serif",
              fontSize: 13, lineHeight: 1.6,
              resize: "none", minHeight: 24,
            }}
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: (!input.trim() || loading) ? T.z800 : agent.color,
              border: "none", cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
              color: (!input.trim() || loading) ? T.z600 : T.black,
              fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export function AgentSuite() {
  const [activeId, setActiveId] = useState<string>(AGENTS[0].id);
  const [allMessages, setAllMessages] = useState<MessageStore>({});

  const activeAgent = AGENTS.find(a => a.id === activeId) ?? AGENTS[0];
  const msgs: Message[] = allMessages[activeId] ?? [];
  const setMsgs = (updated: Message[]) =>
    setAllMessages(prev => ({ ...prev, [activeId]: updated }));

  const counts: Record<string, number> = {};
  for (const agent of AGENTS) {
    counts[agent.id] = (allMessages[agent.id] ?? []).filter(m => m.role === "assistant").length;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes blink{0%,100%{opacity:0.2;transform:scale(0.75);}50%{opacity:1;transform:scale(1.1);}}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
        ::placeholder{color:#52525b;}
      `}</style>

      <div style={{
        display: "flex", height: "100%", width: "100%",
        background: T.black, fontFamily: "Inter, sans-serif",
        overflow: "hidden",
      }}>
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div style={{
          width: 236, flexShrink: 0,
          background: T.z900,
          borderRight: `1px solid ${T.z800}`,
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* Logo */}
          <div style={{
            padding: "16px 14px 12px",
            borderBottom: `1px solid ${T.z800}`,
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 9, letterSpacing: "0.2em",
              color: T.z600, fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 4,
            }}>R3 V4 · ADMIN</div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: T.acid, fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
              textShadow: `0 0 20px ${T.acid}60`,
            }}>EXPERT AGENTS</div>
            <div style={{
              fontSize: 9, color: T.z600,
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: 3, letterSpacing: "0.1em",
            }}>{AGENTS.length} AGENTS · ARTIFACT-BOUND</div>
          </div>

          {/* Agent list by category */}
          <div style={{ flex: 1, padding: "8px 6px", overflowY: "auto" }}>
            {CATEGORIES.map(cat => {
              const catAgents = AGENTS.filter(a => a.category === cat);
              if (catAgents.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 6 }}>
                  <div style={{
                    fontSize: 9, letterSpacing: "0.15em",
                    color: T.z600, padding: "6px 8px 4px",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>{cat}</div>
                  {catAgents.map(agent => {
                    const isActive = agent.id === activeId;
                    const msgCount = counts[agent.id] ?? 0;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setActiveId(agent.id)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center",
                          gap: 9, padding: "8px 8px",
                          background: isActive ? `${agent.color}12` : "transparent",
                          border: `1px solid ${isActive ? agent.color + "40" : "transparent"}`,
                          borderRadius: 7, cursor: "pointer",
                          marginBottom: 2, transition: "all 0.12s",
                          position: "relative",
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.background = `${T.z800}80`;
                            (e.currentTarget as HTMLButtonElement).style.borderColor = T.z700;
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                          }
                        }}
                      >
                        {isActive && (
                          <div style={{
                            position: "absolute", left: 0,
                            top: "18%", bottom: "18%",
                            width: 2, background: agent.color,
                            borderRadius: 1,
                            boxShadow: `0 0 6px ${agent.color}`,
                          }} />
                        )}
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: isActive ? `${agent.color}20` : T.z800,
                          border: `1px solid ${isActive ? agent.color + "50" : T.z700}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, color: isActive ? agent.color : T.z500,
                          flexShrink: 0, fontFamily: "monospace",
                          transition: "all 0.12s",
                          boxShadow: isActive ? `0 0 8px ${agent.color}40` : "none",
                        }}>{agent.icon}</div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600,
                            color: isActive ? agent.color : T.z400,
                            fontFamily: "Inter, sans-serif",
                            whiteSpace: "nowrap", overflow: "hidden",
                            textOverflow: "ellipsis",
                            transition: "color 0.12s",
                          }}>{agent.name}</div>
                        </div>
                        {msgCount > 0 && (
                          <div style={{
                            fontSize: 9, minWidth: 16, height: 16,
                            borderRadius: 8, padding: "0 4px",
                            background: `${agent.color}25`,
                            border: `1px solid ${agent.color}40`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: agent.color,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>{msgCount}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Sidebar footer */}
          <div style={{
            padding: "10px 14px",
            borderTop: `1px solid ${T.z800}`,
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 8, color: T.z600,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.08em", lineHeight: 1.8,
            }}>
              ARTIFACT-BOUND · NO HALLUCINATION<br />
              Wire.txt · CLAUDE.md · llpte.md<br />
              agents.md · auth.md · workflow.md<br />
              testing.md · patch-scripts.md · SKILL.md
            </div>
          </div>
        </div>

        {/* ── Main panel ──────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: T.z950, minWidth: 0, overflow: "hidden",
        }}>
          <ChatPanel
            key={activeId}
            agent={activeAgent}
            messages={msgs}
            setMessages={setMsgs}
          />
        </div>
      </div>
    </>
  );
}
