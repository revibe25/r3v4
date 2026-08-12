// client/src/audio/mixer/master-bus.ts
import { getAudioContext } from "../core/audio-context";
import { smoothParam } from "../../utils/audio-utils";
export class MasterBus {
    constructor() {
        this.context = getAudioContext();
        this.gainNode = this.context.createGain();
        this.gainNode.gain.setTargetAtTime(1, this.context.currentTime, 0.015);
        this.gainNode.connect(this.context.destination);
    }
    setVolume(value) {
        smoothParam(this.gainNode.gain, value, this.context.currentTime);
    }
}
let _masterBus = null;
export function getMasterBus() {
    if (!_masterBus)
        _masterBus = new MasterBus();
    return _masterBus;
}
