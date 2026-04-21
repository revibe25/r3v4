# LLPTE — Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Host Application                         │
│           (DJ App / DAW / Streaming / Hardware)              │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    @llpte/llpte-adapters                      │
│          WebAudio  │  VST  │  MIDI  │  Mobile SDK            │
└──────┬─────────────┴───────────────────────────┬─────────────┘
       │                                         │
┌──────▼───────────────┐     ┌───────────────────▼────────────┐
│  @llpte/llpte-signal  │     │  @llpte/llpte-transition-graph │
│                       │     │                                │
│  analyzeAudio()       │──▶  │  LLPTETransitionGraph          │
│  BPM (stub→Essentia)  │     │  scoreTransition()             │
│  Key (stub→Essentia)  │     │  rankTransitions()             │
│  Energy               │     │  getBestNext() → O(1)          │
│  SpectralCentroid     │     │  5-dim weighted score          │
│  RMS Loudness         │     │  Camelot wheel harmonic        │
└───────────────────────┘     └──────────────┬─────────────────┘
                                             │
                              ┌──────────────▼─────────────────┐
                              │  @llpte/llpte-execution         │
                              │                                 │
                              │  executeCrossfade()             │
                              │  4 curve types                  │
                              │  AudioContext scheduler         │
                              │  < 10ms scheduling target       │
                              └──────────────┬─────────────────┘
                                             │
                              ┌──────────────▼─────────────────┐
                              │  @llpte/llpte-core              │
                              │  Constants │ PERFORMANCE_TARGETS│
                              └──────────────┬─────────────────┘
                                             │
                              ┌──────────────▼─────────────────┐
                              │  @llpte/llpte-ai                │
                              │  HTTP adapter → server/ai_mix.py│
                              └─────────────────────────────────┘

Existing (untouched):
  client/    ──▶  Reference implementation UI
  server/    ──▶  API + transport layer + ai_mix.py
  shared/    ──▶  Shared types (drizzle schema, domain types)
```
