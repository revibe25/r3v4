export class SignalEngine {
  constructor(analyser) {
    this.analyser = analyser;
    this.raw = new Uint8Array(analyser.frequencyBinCount);
    this.smooth = new Float32Array(this.raw.length);
  }

  update() {
    this.analyser.getByteFrequencyData(this.raw);

    const alpha = 0.18;

    for (let i = 0; i < this.raw.length; i++) {
      this.smooth[i] += (this.raw[i] - this.smooth[i]) * alpha;
    }
  }

  energy() {
    let sum = 0;

    for (let i = 0; i < this.smooth.length; i++) {
      sum += Math.log1p(this.smooth[i]);
    }

    return sum / this.smooth.length;
  }
}
