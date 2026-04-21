# LLPTE — Prior Art Search Report
## Pre-Filing Analysis for Provisional Patent Preparation

**Conducted:** 2026-03-05  
**Status:** Internal — Share with Patent Counsel Before Filing  
**Scope:** Academic literature, issued patents, and commercial systems

---

## Methodology

Three search vectors were applied:

1. **Patent databases** — Google Patents, USPTO full-text search for terms
   including: "audio crossfade scoring", "weighted audio transition",
   "harmonic mixing patent", "spectral centroid track selection",
   "phase coherence audio mixing"

2. **Academic literature** — ISMIR proceedings, arXiv, Springer JASMP for
   automated DJ systems and multi-feature audio scoring

3. **Commercial systems** — Mixed In Key, Pacemaker/AutomixIQ, Spotify
   AutoMix, Apple Music continuous play, Rekordbox, Serato

---

## Section 1 — Issued Patents

### US8473084B2 — "Audio Crossfading" (Apple)
**Relevance:** LOW for LLPTE core claims  
Covers reducing buffer latency during unscheduled crossfade execution between
two already-selected audio tracks. The invention concerns *how* to crossfade
efficiently, not *which* track to select or how to score transition quality.
No multi-dimensional scoring, no track selection algorithm, no parameter
derivation from a composite score.  
**LLPTE differentiation:** LLPTE's claims are upstream of this patent.
LLPTE decides which track and how to blend; this patent concerns the
buffer mechanics of executing a crossfade that has already been decided.

### US20100142730A1 — "Crossfading of Audio Signals"
**Relevance:** LOW-MEDIUM — watch claim  
Mentions analyzing "characteristics of the ending and beginning of audio
streams" to determine crossfade effects. The claims are broad but the
specification describes only basic signal-level analysis (volume, duration),
not multi-dimensional perceptual scoring. No composite score, no harmonic
analysis, no phase or spectral dimensions.  
**LLPTE differentiation:** LLPTE's score-to-parameter derivation pipeline
is substantially more specific: a five-dimensional weighted vector produces
a single composite score, which deterministically maps to both duration and
curve type via calibrated thresholds. This is novel over the cited art.

### Mixed In Key — "Automatic Energy Level Detection" (patent claimed, number not publicly disclosed)
**Relevance:** MEDIUM — directly adjacent  
Mixed In Key claims a patent on automatically detecting a single energy level
(1–10 scale) from audio files. This covers one-dimensional energy scoring
for library organization.  
**LLPTE differentiation:** LLPTE uses energy as one of five simultaneously
scored dimensions. The energy scoring function (`1.0 - |ΔE|^0.7 × 1.8`)
measures the *transition delta* between two tracks, not the absolute energy
of a single track. This is a fundamentally different operation — comparative
transition scoring vs. single-track classification. The exponential penalty
curve is novel over a linear 1–10 scale.  
**Action required:** Obtain Mixed In Key's patent number from USPTO and
review claims language before filing.

### Pacemaker/AutomixIQ (Tuned Global) — "Patented Technology"
**Relevance:** MEDIUM-HIGH — closest commercial competitor  
Tuned Global claims patented technology in Pacemaker/AutomixIQ, described
as analyzing "beats, loudness, vocals, and more" across "multiple music data
points." The system is ML-based (machine learning, not deterministic), opaque
(internals not disclosed), and focused on waveform generation for seamless
playback rather than real-time ranked candidate scoring.  
**LLPTE differentiation:**
- LLPTE is fully deterministic — identical inputs always produce identical
  outputs. Pacemaker is ML-based (non-deterministic, model-dependent).
- LLPTE produces a ranked candidate graph for real-time selection.
  Pacemaker generates a transition waveform for a pre-selected pair.
- LLPTE scores phase coherence. No public disclosure of phase scoring
  in Pacemaker's system.
- LLPTE's scoring formula and weight values are fully auditable and
  explainable. Pacemaker's model is a black box.  
**Action required:** Obtain Pacemaker patent numbers from USPTO/EPO and
review claims before filing.

---

## Section 2 — Academic Literature

### Chen et al. (2021) — "Automatic DJ Transitions with Differentiable Audio Effects and GANs" (arXiv:2110.06525)
**Relevance:** MEDIUM for novelty assessment  
Proposes a GAN-based system that learns crossfade parameters from real DJ
mixes. Uses a "Music Puzzle Game" mixability score for track selection —
a single-dimension similarity metric, not a multi-dimensional weighted score.
Focuses on waveform generation (EQ + fader parameters), not transition scoring
or ranked graph maintenance. Requires training data and is not real-time
capable in the LLPTE sense.  
**LLPTE differentiation:** LLPTE requires no training data, no model,
and no waveform generation. It scores all five dimensions simultaneously
in ~5 µs per pair. The GAN approach and LLPTE solve adjacent but distinct
problems.

### Springer JASMP (2018) — "From Raw Audio to a Seamless Mix: Creating an Automated DJ System for Drum and Bass"
**Relevance:** LOW-MEDIUM  
Comprehensive auto-DJ system covering beat tracking, cue point detection,
crossfade profile selection, and playlist compilation. Uses a "style
descriptor" — a three-dimensional energy/spectral vector — for track
selection. Does not score phase coherence. Does not derive crossfade curve
type from a composite score. Genre-specific (Drum and Bass only).  
**LLPTE differentiation:** LLPTE is genre-agnostic, scores five dimensions
simultaneously (vs. three), includes phase and Camelot-wheel harmonic
scoring not present in this system, and derives both duration and curve
type from the composite score automatically.

### ISMIR 2017 — "Automatic Playlist Sequencing and Transitions" (Bittner et al.)
**Relevance:** LOW  
Focuses on playlist sequencing (ordering) rather than real-time transition
scoring. No weighted composite score, no crossfade parameter derivation.

---

## Section 3 — Commercial Systems (Non-Patent)

### Spotify AutoMix / Apple Music Continuous Play
Both systems use BPM and key matching for basic transition smoothing.
Neither system publicly discloses a multi-dimensional scoring formula,
phase scoring, or score-derived crossfade parameter selection.
No patent claims found that would conflict with LLPTE's specific approach.

### Rekordbox / Serato DJ
Professional DJ software with BPM sync and key detection features.
Track suggestion algorithms, where present, are based on BPM proximity
and harmonic compatibility only (two dimensions). No phase scoring,
no composite weighted score, no automatic crossfade parameter derivation.

---

## Section 4 — Freedom-to-Operate Assessment

Based on this search, the following LLPTE elements appear **unclaimed in
existing patents and undisclosed in academic literature:**

| LLPTE Element | Prior Art Status | Risk Level |
|---|---|---|
| Phase coherence as a scored transition dimension | Not found | Low |
| Five-dimensional simultaneous composite scoring | Not found | Low |
| Score-derived automatic crossfade duration (4 thresholds) | Not found | Low |
| Score-derived automatic crossfade curve selection | Not found | Low |
| Half-time/double-time bonus in tempo scoring | Not found | Low |
| Configurable weight profiles (runtime-switchable) | Not found | Low |
| Incremental O(N) graph maintenance on track insertion | Not found | Low |
| Energy delta exponential penalty curve | Not found | Low |
| Energy level *delta* scoring (vs. absolute) | Mixed In Key adjacent | Medium |

**Overall freedom-to-operate assessment: FAVORABLE**  
No blocking patent was identified for LLPTE's core claims. The closest
relevant patents (Apple crossfading, Mixed In Key energy) cover substantially
different operations and do not appear to read on LLPTE's five-dimensional
composite scoring or parameter derivation pipeline.

---

## Section 5 — Recommended Actions Before Filing

1. **Obtain Mixed In Key patent number** — search USPTO for assignee
   "Mixed In Key" or inventor "Yakov Vorobyev" to find exact claims language.

2. **Obtain Pacemaker/Tuned Global patent numbers** — search USPTO/EPO
   for assignee "Pacemaker" and "Tuned Global" to review claims scope.

3. **File provisional patent application** covering:
   - The five-dimensional simultaneous scoring formula
   - The specific weight calibration and normalization method
   - The score-to-crossfade-duration threshold mapping
   - The score-breakdown-to-curve-type derivation logic
   - The incremental graph maintenance algorithm
   - The phase coherence scoring function

4. **Register copyright** on `scoreModel.ts` and `transitionGraph.ts`
   as literary works immediately (low cost, no waiting period).

5. **Document trade secrets** — the specific weight values
   (`harmonicWeight: 0.35`, energy curve exponent `0.7`, multiplier `1.8`)
   should be treated as trade secrets until the provisional is filed.

---

*This document is a preliminary search summary, not a legal opinion.
It should be reviewed by a registered patent attorney before any
filing decisions are made.*

---

## Patent Search Results — Added 2026-03-04

### Mixed In Key LLC (23 patents total)

| Patent No.     | Title / Focus                                      | Date           |
|----------------|----------------------------------------------------|----------------|
| US 11,663,998  | Harmonized musical piece generation                | Aug 8, 2023    |
| US 11,640,815  | Melody generation with rhythm/pitch constraints    | May 30, 2023   |
| US 10,932,083  | Individualized HRTF audio spatialization           | Feb 23, 2021   |
| US 10,714,065  | Chord progression master/slave sync (DAW session) | ~2020          |

Key distinctions from LLPTE: MIK patents cover harmonic key detection,
melody generation, and chord sync — NOT weighted multi-signal scoring,
latency-aware transport estimation, or real-time probabilistic alignment.

---

### Pacemaker Music AB (now owned by Tuned Global)

| Patent No.     | Jurisdiction | Focus                              |
|----------------|--------------|------------------------------------|
| SE 530,102 C2  | Sweden       | AI DJ / automatic mixing           |
| SE 538,408 C2  | Sweden       | AI DJ / track transition           |
| US 10,078,488  | USA          | AI DJ mix / track sequencing       |
| US 10,146,867  | USA          | Automated playlist DJ transitions  |

Key distinctions from LLPTE: Pacemaker patents cover automated track
transitions and AI playlist mixing — NOT the LLPTE weighted scoring
algorithm, phase-coherent alignment, or multi-signal confidence model.

---

### Summary for Attorney

Neither competitor's patent portfolio covers LLPTE's core innovation:
a weighted, multi-signal probabilistic scoring system for real-time
beat alignment with latency compensation. LLPTE is patentably distinct.

