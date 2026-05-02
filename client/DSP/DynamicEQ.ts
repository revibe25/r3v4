export class DynamicEQ {
  constructor(sampleRate: number, blockSize: number) {}
  process(input: Float32Array, parameters: Record<string, Float32Array>, spectrum: Float32Array): Float32Array {
    // Placeholder: no-op
    return input;
  }
  getLatencySamples() { return 0; }
  reset() {}
}