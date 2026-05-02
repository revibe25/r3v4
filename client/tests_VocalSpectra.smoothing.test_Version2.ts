import { describe, it, expect } from 'vitest';
import { VocalSpectra } from '../DSP/Core';

// A square wave "automation" applied to, e.g., correction
describe('VocalSpectra: Parameter Smoothing', () => {
  it('should apply smoothing to rapid parameter modulation', () => {
    const vs = new VocalSpectra();
    const blockSize = 128;
    vs.prepare(48000, blockSize, { channelCount:1, channelMask:['L'], upmixRule:'none', downmixRule:'mix' });

    let input = new Float32Array(blockSize);
    // Arbitrary non-zero data
    for (let i=0; i<blockSize; ++i) input[i] = 0.2*Math.sin(i*0.05);

    // Simulate square wave automation of 'correction' parameter
    let prevOut = 0;
    let discontinuityDetected = false;
    for (let block = 0; block < 50; ++block) {
      const val = block % 2 === 0 ? 0 : 100;
      const params: Record<string, Float32Array> = {
        correction: new Float32Array([val]),
        eqBand1Gain: new Float32Array([0]),
        gainTarget: new Float32Array([-18]),
        deessThreshold: new Float32Array([0]),
      };
      const inputBlock = [ [ input ] ], outputBlock = [ [ new Float32Array(blockSize) ] ];
      vs.processBlock(inputBlock, outputBlock, params);

      // Change in output should be smooth—not sudden step
      for (let i=1; i<blockSize; ++i) {
        const delta = outputBlock[0][0][i] - outputBlock[0][0][i-1];
        if (Math.abs(delta - prevOut) > 0.5) discontinuityDetected = true;
        prevOut = outputBlock[0][0][i];
      }
    }
    expect(discontinuityDetected).toBe(false); // Fails if smoothing isn't applied
  });
});