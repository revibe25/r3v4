# R3 v4 — AI Mixing Engine (LLPTE)

## Overview

R3 v4's AI mixing is powered by the **Low-Latency Processing Transition Engine
(LLPTE)** — a proprietary, real-time AI pipeline implemented as six TypeScript
packages inside the pnpm monorepo. This is R3's core architectural moat.

LLPTE is not a sidecar service. It runs natively in the TypeScript backend with
sub-15ms inference latency on consumer hardware, with confirmed p50 of **10ms**.

---

## Pipeline Architecture

```
inputRouter
    │  normalises multi-track audio into pipeline format
    ▼
spectralAnalyzer
    │  FFT · RMS · LUFS · true peak per frame
    ▼
aiMixEngine
    │  inference engine — produces gain/EQ decisions with confidence scores
    ▼
transitionGraph
    │  precomputes + executes transition curves · 847 active edges
    ▼
outputBus
    │  final signal delivery + monitoring
```

All five nodes run in-process. No Python. No HTTP round-trips. No sidecar.

---

## Monorepo Packages

| Package | Role |
|---|---|
| `llpte-adapters` | `inputRouter` — normalises audio format, routes into pipeline |
| `llpte-signal` | `spectralAnalyzer` — FFT, RMS, LUFS, true peak measurement |
| `llpte-ai` | `aiMixEngine` — heuristic confidence scoring, gain/EQ decisions |
| `llpte-transition-graph` | `transitionGraph` — Camelot wheel scoring, transition curves |
| `llpte-execution` | `outputBus` — final signal delivery |
| `llpte-core` | Pipeline orchestration, node registration, tick loop |

---

## Performance Envelope

| Metric | Limit | Current |
|---|---|---|
| Inference latency p50 | ≤15ms | **10ms** |
| Inference latency p99 | ≤25ms | TBD |
| Node tick time | ≤1ms | **0.8ms** |
| Active edges (MVP) | ≤2000 | **847** |
| Pipeline uptime | 99.9% per session | Auto-restart on breach |

---

## Confidence Gating (CLAUDE.md §LLPTE Contract)

Every AI decision passes through three gates before reaching the user:

```
confidence ≥ 0.65  →  auto_applied via AudioParam.setTargetAtTime()
confidence ≥ 0.40  →  ghost knob suggestion only (user accepts/rejects)
confidence < 0.40  →  discarded silently, logged to aiDecisionLog
```

This ensures the AI only acts autonomously when it is highly confident,
and surfaces suggestions when confidence is moderate. Every decision —
including discards — is logged for acceptance rate tracking.

---

## Decision Logging

Every AI action is written to the `aiDecisionLog` PostgreSQL table
(migration `0005_overjoyed_gambit.sql`, 11 columns):

```
id · sessionId · nodeId · actionType · trackId ·
inputConfidence · displayedConfidence · decision ·
outcome · latencyMs · timestamp
```

The `outcome` field is updated when the user accepts or rejects a
suggestion via `updateAIDecisionOutcome`. This creates the data flywheel
for future model calibration and powers the acceptance rate metric
displayed in `SessionSummaryPanel`.

**Implementation:** `server/services/session-metrics.service.ts`
- `logAIDecision()` — fire-and-forget insert, never blocks response
- `updateAIDecisionOutcome()` — called when client reports user action

**Wired in:** `server/routers/aiMix.router.ts`

---

## UI Surface

### Ghost Knobs
Translucent violet overlays on mixer strips show where the AI wants to move
a parameter. The user can accept, override, or ignore.

### Confidence Badge
Each AI suggestion displays a confidence percentage on the AI MIX track header.
The `inference 10ms` badge on the LLPTE Core node updates every 100ms live.

### Transition Graph Tooltip
Hovering the `transitionGraph` node reveals:
```
llpte-transition-graph v1.2
847 active edges
last tick 0.8ms
```

### SessionSummaryPanel
On session end, displays:
- Time saved vs manual baseline
- Total AI actions taken
- Accepted / auto-applied / rejected counts
- Exportable PNG for sharing

---

## Supported Action Types

| actionType | Description |
|---|---|
| `gain_adjust` | Per-track gain change |
| `eq_suggest` | EQ band boost/cut recommendation |
| `transition_generate` | Crossfade / key-match / filter sweep |
| `conflict_flag` | Frequency masking detection |

---

## Transition Types

| Type | Mechanism | Best For |
|---|---|---|
| Crossfade (linear) | Equal-power gain crossfade | Same-key tracks |
| Crossfade (S-curve) | Sigmoidal gain curve | Energy preservation |
| Filter Sweep | LPF close → HPF open on incoming | High-energy drops |
| Reverb Tail | Outgoing reverb extended, incoming fades in | Atmospheric sections |
| Beat Drop Alignment | Transition delayed to nearest downbeat | Drop-centric sets |
| Echo Freeze | Outgoing pitch-locked, incoming crossfades | Dramatic transitions |
| Key-Match Crossfade | Camelot wheel harmonic scoring | Maximum harmonic quality |

---

## Competitive Position

The LLPTE is **architectural, not cosmetic**. Competitors cannot add this as a
feature flag to existing DAWs — it requires the entire pipeline to be built
around confidence-gated, inspectable, real-time inference from the ground up.

Ableton Live, Traktor Pro, and Rekordbox have zero native AI mixing. R3 ships
at 10ms inference — the best professional AI inference pipelines hit 15ms.

---

## Test Coverage

42+ Vitest cases across LLPTE packages:
- 20 tests — AI Auto-Leveling (6 layers)
- 22 tests — Smart Transitions (9 files, Camelot scoring)

---

*See also: AUDIO_ARCHITECTURE.md · CLAUDE.md §LLPTE Pipeline Contract*
*Last updated: 2026-04-12*
