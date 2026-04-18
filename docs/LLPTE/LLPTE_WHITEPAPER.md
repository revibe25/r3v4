# LLPTE — Low-Latency Predictive Transition Engine
## Technical Whitepaper  v0.1.0

**Author:** R3  
**Date:** 2026-03-05  
**Status:** Draft — Internal / Pre-License  
**Repository:** `packages/llpte-*`

---

## 1. Problem Definition

Modern DJ and live performance software treats track transitions as a
binary operation: the performer selects two tracks, adjusts tempo manually,
and applies a crossfade. The decision of *which* track to play next — and
*how* to transition into it — remains entirely manual.

This creates three failure modes in professional contexts:

1. **Harmonic clashing** — two tracks played together in incompatible keys
   produce audible dissonance that cannot be corrected in real time.

2. **Energy discontinuity** — an abrupt shift in energy level breaks crowd
   momentum and is the most commonly cited error in live performance critique.

3. **Spectral masking** — two tracks with similar spectral centroids played
   simultaneously cause frequency-range competition, degrading mix clarity.

Existing tools address at most one of these dimensions. BPM sync tools address
tempo only. Key detection tools flag harmonic compatibility but provide no
ranked recommendation. No production system scores all five perceptual
dimensions simultaneously and returns a ranked, actionable transition plan
within the real-time budget of a live performance.

LLPTE solves this.

---

## 2. Transition Modeling

LLPTE models each loaded track as a `TrackSignal` — a five-dimensional
feature vector derived from audio analysis:
```
TrackSignal {
  bpm:              number        // Beats per minute
  key:              string        // Camelot wheel notation (e.g. "8A")
  energy:           number        // Normalized RMS energy [0.0–1.0]
  spectralCentroid: number        // Frequency center of mass (Hz)
  rmsLoudness:      number        // Perceived loudness [0.0–1.0]
  phaseOffset?:     number        // Phase offset in radians (optional)
}
```

A transition from track A to track B is modeled as a vector distance problem
across five independently weighted dimensions. The composite score predicts
perceptual transition quality before the transition is executed.

---

## 3. Weighted Graph Architecture

### 3.1 Scoring Formula
```
Score(A→B) = Σ(wᵢ × dimensionScoreᵢ(A, B))

Where:
  w₁ = harmonicWeight   (default 0.35)
  w₂ = energyWeight     (default 0.25)
  w₃ = spectralWeight   (default 0.20)
  w₄ = phaseWeight      (default 0.10)
  w₅ = tempoWeight      (default 0.10)
```

Weights sum to 1.0 and are auto-normalized at scoring time, ensuring
deterministic output regardless of rounding drift.

### 3.2 Dimension Scoring Functions

**Harmonic (w=0.35)**
Uses the Camelot wheel compatibility map. Same key scores 1.0; adjacent
wheel positions score 0.75; wheel-adjacent numerically score 0.4;
incompatible keys score 0.1. Missing key data returns a conservative 0.3.

**Energy (w=0.25)**
Penalizes energy delta using an exponential curve:
`score = max(0, 1.0 - |ΔE|^0.7 × 1.8)`
This penalizes large jumps super-linearly, matching the perceptual reality
that energy discontinuities become increasingly disruptive as they grow.

**Spectral (w=0.20)**
Computes relative centroid distance:
`score = max(0, 1.0 - (|ΔC| / max(Ca, Cb)) × 1.5)`
Tracks with similar frequency profiles score highly; those with large
spectral distance are penalized to prevent frequency masking clashes.

**Phase (w=0.10)**
Computes normalized phase delta on the unit circle:
`score = max(0, 1.0 - min(Δφ, 2π−Δφ) / π)`
Scores 1.0 for phase-aligned tracks; 0.0 for fully opposed. Absent phase
data returns 0.5 (neutral).

**Tempo (w=0.10)**
Scores BPM ratio directly, with a bonus for half-time/double-time
relationships (×0.75 multiplier), as these are musically valid transitions
even across large BPM gaps.

### 3.3 Graph Structure

`LLPTETransitionGraph` maintains a live directed weighted graph where:

- Each node is a `TrackSignal` keyed by stable track ID
- Each edge is a `TransitionCandidate` with full score + breakdown
- Edges are sorted descending by score at insertion time
- `getBestNext(fromId)` returns O(1) — the top candidate is always at index 0
- `addTrack()` incrementally updates only affected edges (O(N) not O(N²))

The graph is fully serializable and deserializable for persistence across
sessions.

---

## 4. Execution Layer

When a transition candidate is selected, LLPTE maps the composite score
to concrete crossfade parameters:

### 4.1 Crossfade Duration

| Score Range | Duration | Rationale |
|-------------|---------|-----------|
| ≥ 0.85      | 4,000 ms | Excellent match — tight blend is safe |
| ≥ 0.70      | 8,000 ms | Good match — standard blend |
| ≥ 0.50      | 12,000 ms | Average — longer blend masks differences |
| < 0.50      | 20,000 ms | Poor match — maximum blend time required |

### 4.2 Crossfade Curve Selection

| Condition | Curve | Rationale |
|-----------|-------|-----------|
| energy > 0.8 | equal-power | Preserves loudness through transition |
| harmonic > 0.8 AND energy > 0.6 | s-curve | Smooth blend for well-matched tracks |
| spectral < 0.4 | logarithmic | Compensates for spectral imbalance |
| default | linear | Neutral fallback |

---

## 5. Performance Metrics

All measurements taken on Linux x86_64, Node.js via `tsx`.  
Full methodology: `packages/llpte-core/benchmarks/latency.ts`

| Operation | Mean | p99 | Real-Time Budget | Margin |
|-----------|------|-----|-----------------|--------|
| Single pair scoring | 0.0050 ms | 0.0308 ms | 1 ms | **200×** |
| Rank 1,000-track library | 1.5528 ms | 4.5818 ms | 50 ms | **32×** |
| End-to-end (score → params) | 0.0217 ms | 0.0672 ms | 10 ms | **460×** |

The engine operates at a computational cost measured in microseconds. This
leaves the overwhelming majority of the real-time frame budget available
for audio processing, UI rendering, and network I/O.

Weight profile switching (harmonic, energetic, broadcast) introduces no
measurable overhead — all profiles score within 2.1 µs mean.

---

## 6. Integration Path

LLPTE is designed as a drop-in intelligence layer for any audio host:
```typescript
import { LLPTETransitionGraph } from '@llpte/llpte-transition-graph';
import { analyzeAudio }         from '@llpte/llpte-signal';
import { executeCrossfade }     from '@llpte/llpte-execution';

const graph = new LLPTETransitionGraph();

// On track load:
const signal = await analyzeAudio(audioBuffer);
graph.addTrack(trackId, signal);

// On transition request:
const candidate = graph.getBestNext(currentTrackId);
await executeCrossfade(candidate, audioContext, gainNodes);
```

The public API surface is intentionally minimal. Consumers never touch
scoring internals — the graph, scorer, and executor are fully encapsulated.

Adapter packages (`@llpte/llpte-adapters`) provide environment bridges for
Web Audio API, with VST and mobile adapters following the same interface
contract.

---

## 7. Licensing Model

LLPTE is structured for dual licensing:

**Open Core** — The signal analysis and graph structure are available under
a permissive license for individual and research use.

**Commercial License** — The weighted scoring model, weight profiles, and
execution layer are proprietary. Commercial use in production performance
systems, broadcast infrastructure, or embedded hardware requires a
commercial license agreement.

The IP thesis (`docs/LLPTE/IP_THESIS.md`) documents the novel elements
of the scoring system in detail.

---

*This document is a living technical reference. Sections 3–5 are considered
stable. Sections 6–7 are subject to revision as the licensing model matures.*
