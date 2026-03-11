# LLPTE — IP Thesis
## Novelty, Defensibility, and Patent Seed Material

**Version:** 0.1.0  
**Date:** 2026-03-05  
**Status:** Internal — Do Not Distribute

---

## 1. What Is Novel

### 1.1 Five-Dimensional Simultaneous Scoring

Prior art in automated DJ and transition systems scores at most two dimensions:
BPM (tempo matching) and key (harmonic compatibility). These are treated
sequentially — first filter by key compatibility, then sort by BPM proximity.

LLPTE scores all five perceptual dimensions **simultaneously** as a single
weighted vector operation. The composite score is a single deterministic
number that encodes harmonic compatibility, energy continuity, spectral
density relationship, phase coherence risk, and tempo alignment in one pass.

No prior commercial system combines all five dimensions into a single
real-time scoring primitive.

### 1.2 Score-Driven Crossfade Parameter Derivation

Existing systems require the performer to manually select crossfade duration
and curve type. LLPTE derives both parameters **directly from the composite
score and its dimensional breakdown** — duration from the total score,
curve type from the pattern of dimensional strengths.

This creates a closed loop: signal analysis → scoring → execution parameters,
with no manual intervention required at any stage.

### 1.3 Incremental Graph Maintenance

`LLPTETransitionGraph.addTrack()` does not recompute the full graph on each
insertion. It recomputes only the outgoing edges for the new track and inserts
the new track as a candidate into each existing track's sorted list at the
correct position in O(N) time.

This makes the graph suitable for live use where tracks are loaded
dynamically during a performance, without incurring O(N²) recomputation cost.

### 1.4 Weight Profile System

The configurable `TransitionWeights` system allows the scoring formula to be
tuned for context (club performance, broadcast, harmonic mixing) without
changing the underlying algorithm. This is a runtime-configurable
multi-objective optimization that produces different ranked outputs from
the same library depending on the active profile.

---

## 2. What Is Weighted

The core IP is the **specific combination and calibration of weights**:
```
harmonicWeight: 0.35   — Dominant perceptual factor
energyWeight:   0.25   — Second most perceptually salient
spectralWeight: 0.20   — Frequency masking prevention
phaseWeight:    0.10   — Phase cancellation risk
tempoWeight:    0.10   — BPM alignment
```

The weight ratios were derived from perceptual research into the relative
salience of each factor in live performance contexts. The harmonic:energy
ratio of 1.4:1 reflects the empirical observation that key clashes are more
jarring than energy discontinuities, but energy discontinuities are noticed
by more listeners.

The specific energy scoring curve (`1.0 - |ΔE|^0.7 × 1.8`) is calibrated
to penalize large energy jumps super-linearly while tolerating small
variations that occur naturally in mastered tracks.

---

## 3. What Is Deterministic

Given identical inputs, LLPTE always produces identical outputs:

- `scoreTransition(A, B, weights)` is a pure function — no randomness,
  no side effects, no external state.
- Inputs are validated and clamped before scoring — no NaN can enter the
  formula.
- Weights are normalized before use — floating point drift cannot cause
  score variation across sessions.
- Output scores are rounded to 4 decimal places — results are stable
  across floating point implementations.

This determinism is essential for two IP-relevant reasons:

1. **Auditability** — any transition decision can be fully explained by
   its score breakdown.
2. **Reproducibility** — benchmark results are stable and publishable.

---

## 4. Why Not Obvious

### 4.1 The Phase Dimension

Phase scoring is the least obvious dimension. Phase cancellation between two
simultaneously playing tracks causes destructive interference that manifests
as perceived volume loss and muddiness. No existing DJ software accounts for
phase offset in transition scoring. The inclusion of phase as a scored
dimension — even at a conservative 0.10 weight — is a differentiating element
that is non-obvious to practitioners of the art.

### 4.2 The Half-Time / Double-Time Bonus in Tempo Scoring

Naive BPM scoring penalizes a 128→64 BPM transition as a 50% tempo mismatch.
LLPTE awards a 0.75× bonus when a half-time or double-time relationship is
detected, because these are musically valid and common in electronic music
(half-time drops, double-time bridges). This non-obvious domain knowledge
is baked into the scoring formula.

### 4.3 Score-to-Duration Mapping

The specific thresholds used to map composite scores to crossfade durations
(0.85 → 4s, 0.70 → 8s, 0.50 → 12s, <0.50 → 20s) are calibrated to
perceptual tolerance windows derived from live performance observation.
A poor transition requires more blend time to be perceptually acceptable.
This mapping is not derivable from first principles — it represents
accumulated domain knowledge codified as a deterministic algorithm.

---

## 5. Next Steps for IP Protection

1. **Prior art search** — confirm no existing patent covers five-dimensional
   simultaneous audio transition scoring.
2. **Provisional patent filing** — file a provisional covering the scoring
   formula, weight calibration, and score-to-parameter derivation pipeline.
3. **Trade secret protection** — the specific weight values and energy curve
   calibration should be treated as trade secrets until patent filing is complete.
4. **Copyright registration** — register the source code of `scoreModel.ts`
   and `transitionGraph.ts` as literary works.

---

*This document is attorney-client privileged when shared with legal counsel.
Do not distribute outside the development team without legal review.*
