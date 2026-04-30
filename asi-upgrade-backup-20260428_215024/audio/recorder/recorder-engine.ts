// client/src/audio/recorder/recorder-engine.ts

import { getAudioContext } from "../core/audio-context";
import { encodeWav } from "./wav-encoder";

export class RecorderEngine {
  private context: AudioContext;
  private node?: AudioWorkletNode;
  private buffers: Float32Array[] = [];

  constructor() {
    this.context = getAudioContext();
  }

  async init() {
    await this.context.audioWorklet.addModule(
      new URL("./recorder-worklet.ts", import.meta.url)
    );

    this.node = new AudioWorkletNode(
      this.context,
      "recorder-worklet"
    );

    this.node.port.onmessage = (event) => {
      if (event.data?.type === "data") {
        this.buffers = event.data.buffer;
      }
    };
  }

  connect(source: AudioNode) {
    if (!this.node) return;
    source.connect(this.node);
  }

  start() {
    if (!this.node) return;
    this.buffers = [];
    this.node.port.postMessage("start");
  }

  stop(): Blob {
    if (!this.node) {
      throw new Error("Recorder not initialized");
    }

    this.node.port.postMessage("stop");

    return encodeWav(this.buffers, this.context.sampleRate);
  }
}

let _recorderEngine: RecorderEngine | null = null;
export function getRecorderEngine(): RecorderEngine {
  if (!_recorderEngine) _recorderEngine = new RecorderEngine();
  return _recorderEngine;
}

