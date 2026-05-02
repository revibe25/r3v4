import { MSL } from './MSL';
import { LDE } from './LDE';

export interface GainComputerConfig {
  targetDb: number;
  maxGainDb: number;
  minGainDb: number;
  kneeWidthDb: number;
}

export class GainComputer {
  private config: GainComputerConfig;
  private currentGainDb = 0;
  private lde: LDE;
  constructor(config: GainComputerConfig, sampleRate = 48000) {
    this.config = config;
    this.lde = new LDE(sampleRate, 'hybrid');
  }
  setTargetDb(db: number) { this.config.targetDb = db; }
  reset() { this.currentGainDb = 0; this.lde.reset(); }

  apply(block: Float32Array): Float32Array {
    // 1. Compute level
    const detectedDb = this.lde.process(block);
    const deviation = this.config.targetDb - detectedDb;
    let gainDb = deviation;
    // 2. Soft-knee
    const knee = this.config.kneeWidthDb;
    if (Math.abs(deviation) < knee / 2) {
      gainDb = deviation * (Math.abs(deviation) / (knee/2));
    }
    gainDb = Math.max(this.config.minGainDb, Math.min(this.config.maxGainDb, gainDb));
    this.currentGainDb = gainDb;

    // 3. dB→linear, apply
    const gainLin = MSL.dbToLinear(gainDb);
    const out = new Float32Array(block.length);
    for (let i = 0; i < block.length; ++i) out[i] = block[i] * gainLin;
    return out;
  }
}