// client/src/audio/indicators/meter-node.ts

import type { MeterData } from "../../../../shared/audio.types";
import { getAudioContext } from "../core/audio-context";

export class MeterNode {
  readonly id: string;
  readonly analyser: AnalyserNode;

  private buffer: Float32Array;

  constructor(id: string) {
    this.id = id;

    const _context = getAudioContext();

    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.buffer = new Float32Array(this.analyser.fftSize) as unknown as Float32Array<ArrayBuffer>;
  }

  connect(source: AudioNode) {
    source.connect(this.analyser);
  }

  disconnect() {
    this.analyser.disconnect();
  }

  getMeterData(): MeterData {
    this.analyser.getFloatTimeDomainData(this.buffer as Float32Array<ArrayBuffer>);

    let _sum = 0;
    let _peak = 0;

    for (let _i = 0; i < this.buffer.length; i++) {
      const _v = this.buffer[i];
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }

    const _rms = Math.sqrt(sum / this.buffer.length);

    return { rms, peak };
  }
}
