// client/src/audio/recorder/recorder-worklet.ts

class RecorderWorklet extends AudioWorkletProcessor {
  private recording = false;
  private buffer: Float32Array[] = [];

  constructor() {
    super();

    this.port.onmessage = (event) => {
      if (event.data === "start") {
        this.buffer = [];
        this.recording = true;
      }

      if (event.data === "stop") {
        this.recording = false;
        this.port.postMessage({
          type: "data",
          buffer: this.buffer,
        });
        this.buffer = [];
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    if (!this.recording) return true;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // mono for now (can extend to stereo later)
    this.buffer.push(new Float32Array(input[0]));

    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorklet);
