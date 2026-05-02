export class FFTAnalyzer {
  private blockSize: number;
  constructor(blockSize: number) {
    this.blockSize = blockSize;
    // Usually: allocate Float32Array for input, window, output spectrum (mag)
  }
  analyze(input: Float32Array): Float32Array {
    // Stub — in production use libraries (e.g. KissFFT) or WebAudio FFT
    // Return spectrum: Float32Array, length = blockSize/2 (real-valued mag)
    // For now, return zeros for shape/safety.
    return new Float32Array(this.blockSize / 2);
  }
  reset() {/* ... */}
}