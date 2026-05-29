export class EventEngine {
  constructor(timeline) {
    this.timeline = timeline;
    this.lastBeat = -1;
  }

  update(onBeat) {
    const beat = this.timeline.beatIndex();

    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      onBeat?.(beat);
    }
  }
}
