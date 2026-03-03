// client/src/audio/mixer/master-bus.ts

import { getAudioContext } from "../core/audio-context";
import { smoothParam } from "../../utils/audio-utils";

export class MasterBus {
  readonly context: AudioContext;
  readonly gainNode: GainNode;

  constructor() {
    this.context = getAudioContext();
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1;

    this.gainNode.connect(this.context.destination);
  }

  setVolume(value: number) {
    smoothParam(
      this.gainNode.gain,
      value,
      this.context.currentTime
    );
  }
}

export const masterBus = new MasterBus();
