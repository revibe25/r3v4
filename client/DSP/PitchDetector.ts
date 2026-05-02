export class PitchDetector {
  constructor(sampleRate: number, blockSize: number) {}
  detect(block: Float32Array): { freq: number, confidence: number } {
    // YIN/autocorr stub; return middle C for demo
    return { freq: 261.63, confidence: 1.0 };
  }
  correct(
    input: Float32Array, 
    pitchResult: { freq: number, confidence: number },
    correctionPercent: number
    // ...other params
  ): Float32Array {
    // Placeholder: pass-through the input (null test should pass)
    return input;
  }
  getLatencySamples() { return 0; }
  reset() {}
}