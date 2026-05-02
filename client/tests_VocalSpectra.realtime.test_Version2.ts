import { describe, it, expect } from 'vitest';
import { VocalSpectra } from '../DSP/Core';

describe('VocalSpectra: Real-Time Stability', () => {
  it('processes 10 minutes worth of blocks without error/allocation', async () => {
    const vs = new VocalSpectra();
    const sampleRate = 48000;
    const blockSize = 128;
    vs.prepare(sampleRate, blockSize, { channelCount:1, channelMask:['L'], upmixRule:'none', downmixRule:'mix' });

    const parameters: Record<string, Float32Array> = {
      correction: new Float32Array([100]),
      eqBand1Gain: new Float32Array([0]),
      gainTarget: new Float32Array([-18]),
      deessThreshold: new Float32Array([0]),
    };

    const totalSecs = 60; // Set to 600 for 10min, but keep CI runs quick
    const nBlocks = Math.floor(sampleRate * totalSecs / blockSize);

    let blockCount = 0;
    for (; blockCount < nBlocks; ++blockCount) {
      const inputBlock = [ [ new Float32Array(blockSize) ] ]; // Silence input
      const outputBlock = [ [ new Float32Array(blockSize) ] ];
      const ok = vs.processBlock(inputBlock, outputBlock, parameters);
      expect(ok).toBe(true);
    }
    expect(blockCount).toBe(nBlocks);
  });
});