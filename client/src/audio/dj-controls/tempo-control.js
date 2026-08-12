// Stub for tempo-control
export class TempoControl {
    constructor() {
        this.bpm = 120;
    }
    setBpm(bpm) { this.bpm = bpm; }
    getBpm() { return this.bpm; }
    dispose() { }
}
export default TempoControl;
