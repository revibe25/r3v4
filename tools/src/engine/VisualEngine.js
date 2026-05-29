export class VisualEngine {
  constructor(timeline, signal) {
    this.timeline = timeline;
    this.signal = signal;
  }

  frame() {
    return {
      time: this.timeline.time(),
      phase: this.timeline.phase(),
      sub: this.timeline.subPhase(8),
      energy: this.signal.energy()
    };
  }
}
