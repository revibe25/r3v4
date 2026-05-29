import { MasterTimeline } from "./MasterTimeline";
import { SignalEngine } from "./SignalEngine";
import { EventEngine } from "./EventEngine";
import { VisualEngine } from "./VisualEngine";
import { LatencyCompensator } from "./LatencyCompensator";
import { BeatDetector } from "./BeatDetector";
import { FrameStore } from "./FrameStore";

export function initEngine(audioCtx, analyser) {
  const timeline = new MasterTimeline(audioCtx, 120);
  const signal = new SignalEngine(analyser);
  const events = new EventEngine(timeline);
  const visual = new VisualEngine(timeline, signal);

  const latency = new LatencyCompensator(audioCtx);
  const beat = new BeatDetector(signal);

  const store = new FrameStore();

  function loop() {
    signal.update();

    const beatHit = beat.update();

    events.update(() => {});

    const frame = visual.frame();

    store.write({
      ...frame,
      beatHit,
      latency: latency.offset
    });

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return { timeline, signal, events, visual, latency, beat, store };
}
