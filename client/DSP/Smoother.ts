export class Smoother {
  private smoothed: number;
  private g: number;
  constructor(
    sampleRate: number,
    private timeMs: number,
    defaultValue: number,
  ) {
    this.smoothed = defaultValue;
    this.g = 1 - Math.exp(-1 / (sampleRate * (this.timeMs / 1000)));
  }

  update(target: number) {
    this.smoothed += this.g * (target - this.smoothed);
    return this.smoothed;
  }

  get value(): number { return this.smoothed; }
  reset(val: number) { this.smoothed = val; }
}