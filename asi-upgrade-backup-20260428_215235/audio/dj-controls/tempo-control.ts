// Stub for tempo-control
export class TempoControl {
  bpm: number = 120;
  setBpm(bpm: number): void { this.bpm = bpm; }
  getBpm(): number { return this.bpm; }
  dispose(): void {}
}
export default TempoControl;
