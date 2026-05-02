import { MSL } from './MSL';

export class LDE {
  private ms = 0;               // mean square (RMS)
  private peak = 0;
  private lastDb = 0;
  private releaseRate: number;

  constructor(private sampleRate: number, private mode: 'rms' | 'peak' | 'hybrid' = 'hybrid') {
    this.releaseRate = Math.exp(-1 / (sampleRate * 0.1));  // Release over 100ms default
  }

  process(block: Float32Array): number {
    let blockRms = 0;
    let blockPeak = 0;
    for (let i = 0; i < block.length; ++i) {
      const x = block[i];
      blockRms += x * x;
      blockPeak = Math.max(blockPeak, Math.abs(x));
    }
    blockRms = Math.sqrt(blockRms / block.length + MSL.EPSILON);
    blockPeak = Math.max(blockPeak, this.peak * this.releaseRate);

    this.ms = this.mode !== 'peak'
      ? this.ms * this.releaseRate + (1 - this.releaseRate) * blockRms * blockRms
      : this.ms;
    this.peak = blockPeak;

    const rmsDb = MSL.linearToDb(blockRms);
    const peakDb = MSL.linearToDb(blockPeak);
    this.lastDb = (this.mode === 'hybrid')
      ? Math.max(rmsDb, peakDb - 6.0)
      : this.mode === 'peak'
        ? peakDb
        : rmsDb;
    return this.lastDb;
  }

  reset() {
    this.ms = this.peak = this.lastDb = 0;
  }
}