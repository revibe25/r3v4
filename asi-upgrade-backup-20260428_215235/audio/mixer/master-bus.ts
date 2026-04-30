// client/src/audio/mixer/master-bus.ts

import { getAudioContext } from "../core/audio-context";
import { smoothParam } from "../../utils/audio-utils";

export class MasterBus {
  readonly context: AudioContext;
  readonly gainNode: GainNode;

  constructor() {
    this.context = getAudioContext();
    this.gainNode = this.context.createGain();
    this.gainNode.gain.setTargetAtTime(1, this.context.currentTime, 0.015);

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

let _masterBus: MasterBus | null = null;
export function getMasterBus(): MasterBus {
  if (!_masterBus) _masterBus = new MasterBus();
  return _masterBus;
}

