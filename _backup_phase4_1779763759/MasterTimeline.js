export class MasterTimeline {
  constructor(audioCtx, bpm = 120) {
    this.ctx = audioCtx;
    this.setBPM(bpm);
  }

  setBPM(bpm) {
    this.bpm = bpm;
    this.beat = 60 / bpm;
  }

  time() {
    return this.ctx.currentTime;
  }

  phase() {
    return (this.time() / this.beat) % 1;
  }

  beatIndex() {
    return Math.floor(this.time() / this.beat);
  }

  subPhase(div = 4) {
    return (this.phase() * div) % 1;
  }

  nextBeat() {
    return Math.ceil(this.time() / this.beat) * this.beat;
  }
}
