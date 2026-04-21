---
paths:
  - "packages/llpte/**"
  - "**/inputRouter*"
  - "**/spectralAnalyzer*"
  - "**/aiMix*"
  - "**/transitionGraph*"
  - "**/outputBus*"
---

# LLPTE Pipeline Rules

## Node Order — Never Reorder
inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus

## Hard SLAs
- Inference latency: ≤15ms ceiling — non-negotiable
- Confidence gate: 0.65 — no suggestion surfaces to UI below this
- Zero GC pressure in hot path — typed array pool allocators only

## Audio & Rendering
- Audio: WASM + SharedArrayBuffer + AudioWorklet only — nothing on main thread
- Waveform: WebGPU renderer — no canvas 2D fallback in production paths
- Inference: quantized + SIMD — no unquantized model calls in the hot path

## Module Resolution
- `.ts` sources resolve before `.js` artifacts in `shared/`
- `resolve.extensions` order in `vite.config.ts` is intentional — do not modify
