export class BeatDetector {
  constructor(signal) {
    this.signal = signal;
    this.history = [];
    this.threshold = 140;
  }

  update() {
    const e = this.signal.energy();

    this.history.push(e);
    if (this.history.length > 30) this.history.shift();

    const avg =
      this.history.reduce((a, b) => a + b, 0) / this.history.length;

    return e > avg * 1.35;
  }
}
