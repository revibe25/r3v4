// client/src/audio/transport/transport-engine.ts
import * as Tone from "tone";
import { resumeAudioContext } from "../core/audio-context";
import { getRecorderEngine } from "../recorder/recorder-engine";
export class TransportEngine {
    constructor() {
        this.recording = false;
        Tone.Transport.stop();
        Tone.Transport.position = 0;
        Tone.Transport.bpm.value = 120;
    }
    attachAutomation(engine) {
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
    setBpm(bpm) {
        Tone.Transport.bpm.setValueAtTime(bpm, Tone.now());
    }
    setLoop(enabled, start = 0, end = 0) {
        Tone.Transport.loop = enabled;
        Tone.Transport.loopStart = start;
        Tone.Transport.loopEnd = end;
    }
    get positionSeconds() {
        return Tone.Transport.seconds;
    }
    get isPlaying() {
        return Tone.Transport.state === "started";
    }
    get isRecording() {
        return this.recording;
    }
}
let _transportEngineInstance = null;
export function getTransportEngine() {
    if (!_transportEngineInstance)
        _transportEngineInstance = new TransportEngine();
    return _transportEngineInstance;
}
// backward-compat named export (lazy-evaluated)
export const transportEngine = new Proxy({}, {
    get(_t, prop) {
        return getTransportEngine()[prop];
    }
});
