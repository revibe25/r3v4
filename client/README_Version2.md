# VocalSpectra ASI Level 4+ Worklet Demo

## Integration

1. **Build the DSP core:**
   - Compile all sources (`VocalSpectra.ts`, `Smoother.ts`, `FFTAnalyzer.ts`, etc) into a single AudioWorkletGlobalScope JS file.

2. **Register as worklet:**
   ```js
   await audioContext.audioWorklet.addModule('VocalSpectraWorklet.js');
   const node = new AudioWorkletNode(audioContext, 'vocal-spectra-worklet', {
     parameterData: { correction: 80, eqBand1Gain: 3 /* ...etc */ }
   });
   node.connect(audioContext.destination);
   ```

3. **Automation/UI:**
   - Automate parameters via `node.parameters` or send messages via `node.port.postMessage()`
   - Receive meters via `node.port.onmessage`

## Features

- Real-time pitch correction, adaptive EQ, de-essing, and gain riding in one block-based node (single processBlock call per block).
- All memory is preallocated, with no allocations in processBlock.
- Multiple instances can be created for polyphonic/track use.
- WASM-ready architecture—swap core methods for C++/Rust if needed.

## Extending

- Fill out the submodules (`PitchDetector`, `DynamicEQ`, `DeEsser`, etc) using real algorithms per the PRD.
- All hooks and smoothing infrastructure are ready.