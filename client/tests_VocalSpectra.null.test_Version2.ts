import { describe, it, expect } from 'vitest';
import { VocalSpectra } from '../DSP/Core';

// Helper: Generates a sine or arbitrary signal
function makeSignal(len: number, freq = 440, sampleRate = 48000) {
  const buf = new Float32Array(len);
  for (let i = 0; i < len; ++i) buf[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.1;
  return buf;
}

describe('VocalSpectra: Null Test', () => {
  it('should output bit-identical audio with neutral/bypass parameters', () => {
    const blockSize = 128, nBlocks = 16;
    const vs = new VocalSpectra();
    vs.prepare(48000, blockSize, { channelCount:1, channelMask:['L'], upmixRule:'none', downmixRule:'mix' });

    // Neutral params: set all by hand or use a helper
    const parameters: Record<string, Float32Array> = {
      correction: new Float32Array([0]),
      eqBand1Gain: new Float32Array([0]),
      gainTarget: new Float32Array([-18]), // Doesn't affect if levels match
      deessThreshold: new Float32Array([0]),
      // ...all others as 0/bypass per Parameters.ts
    };
    
    for (let bi = 0; bi < nBlocks; ++bi) {
      const inputBlock = [ [ makeSignal(blockSize) ] ]; // mono input
      const outBlock = [ [ new Float32Array(blockSize) ] ];
      vs.processBlock(inputBlock, outBlock, parameters);

      // Allow float32 ±1 LSB
      for (let s = 0; s < blockSize; ++s) {
        expect(Math.abs(inputBlock[0][0][s] - outBlock[0][0][s])).toBeLessThanOrEqual(1e-7);
      }
    }
  });
});