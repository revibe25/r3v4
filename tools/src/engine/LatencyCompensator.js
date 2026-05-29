export class LatencyCompensator {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.offset = 0;
  }

  // crude but effective calibration loop
  calibrate() {
    const start = this.ctx.currentTime;

    return new Promise((resolve) => {
      setTimeout(() => {
        const end = this.ctx.currentTime;
        this.offset = end - start;
        resolve(this.offset);
      }, 50);
    });
  }

  time() {
    return this.ctx.currentTime - this.offset;
  }
}
