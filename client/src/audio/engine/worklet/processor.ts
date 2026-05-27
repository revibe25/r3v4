/// <reference path="../../worklets/audio-worklet.d.ts" />
// ── AudioWorklet global stubs (not in standard webworker lib) ──────────────

// client/src/audio/engine/worklet/processor.ts

class LLPTEProcessor extends AudioWorkletProcessor {
  energy = 0;

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) return true;

    const inputChannel = input[0];
    const outputChannel = output[0];

    let sum = 0;

    for (let i = 0; i < inputChannel.length; i++) {
      const sample = inputChannel[i];

      // === LLPTE PIPELINE (minimal real DSP entry point) ===
      const processed = sample; // placeholder for nodes later

      outputChannel[i] = processed;

      sum += Math.abs(sample);
    }

    this.energy = inputChannel.length ? sum / inputChannel.length : 0;

    // send to main thread (VIL)
    this.port.postMessage({
      type: 'analysis',
      energy: this.energy,
      time: currentTime,
    });

    return true;
  }
}

registerProcessor('llpte-processor', LLPTEProcessor);
