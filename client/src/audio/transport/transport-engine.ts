// client/src/audio/transport/transport-engine.ts

import * as Tone from "tone";
import { resumeAudioContext } from "../core/audio-context";
import { getRecorderEngine } from "../recorder/recorder-engine";
import { AutomationEngine } from "../automation/automation-engine";

export class TransportEngine {
  private automation?: AutomationEngine;
  private recording = false;

  constructor() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = 120;
  }

  attachAutomation(engine: AutomationEngine) {
    this.automation = engine;
  }

  async play() {
    await resumeAudioContext();

    if (Tone.Transport.state !== "started") {
      Tone.Transport.start("+0.01");
    }
  }

  stop() {
    if (Tone.Transport.state !== "stopped") {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }

    if (this.recording) {
      getRecorderEngine().stop();
      this.recording = false;
    }
  }

  async record() {
    await resumeAudioContext();

    if (Tone.Transport.state !== "started") {
      getRecorderEngine().start();
      this.recording = true;
      Tone.Transport.start("+0.01");
    }
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.setValueAtTime(
      bpm,
      Tone.now()
    );
  }

  setLoop(enabled: boolean, start = 0, end = 0) {
    Tone.Transport.loop = enabled;
    Tone.Transport.loopStart = start;
    Tone.Transport.loopEnd = end;
  }

  get positionSeconds(): number {
    return Tone.Transport.seconds;
  }

  get isPlaying(): boolean {
    return Tone.Transport.state === "started";
  }

  get isRecording(): boolean {
    return this.recording;
  }
}

let _transportEngine: TransportEngine | null = null;
export function getTransportEngine(): TransportEngine {
  if (!_transportEngine) _transportEngine = new TransportEngine();
  return _transportEngine;
}

// backward-compat named export (lazy-evaluated)
export const transportEngine = new Proxy({} as TransportEngine, {
  get(_t, prop) {
    return (getTransportEngine() as any)[prop];
  }
});

