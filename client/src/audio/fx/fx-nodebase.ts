// client/src/audio/fx/fx-node-base.ts

import { getAudioContext } from "../core/audio-context";

export abstract class FXNodeBase implements FXNode {
  readonly id: string;
  readonly context: AudioContext;

  readonly input: GainNode;
  readonly output: GainNode;

  protected readonly wetGain: GainNode;
  protected readonly dryGain: GainNode;

  bypassed = false;
  get isBypassed(): boolean { return this.bypassed; }

  constructor(id: string) {
    this.id = id;
    this.context = getAudioContext();

    this.input = this.context.createGain();
    this.output = this.context.createGain();

    this.wetGain = this.context.createGain();
    this.dryGain = this.context.createGain();

    // defaults
    this.wetGain.gain.setTargetAtTime(1, this.context.currentTime, 0.015);
    this.dryGain.gain.setTargetAtTime(0, this.context.currentTime, 0.015);

    // dry path
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // wet path (implemented by subclasses)
    this.connectEffect();
  }

  /**
   * Subclasses must wire:
   * input -> effect nodes -> wetGain -> output
   */
  protected abstract connectEffect(): void;

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  setBypass(bypass: boolean) {
    if (this.bypassed === bypass) return;

    const _now = this.context.currentTime;
    const _fadeTime = 0.01;

    this.wetGain.gain.cancelScheduledValues(now);
    this.dryGain.gain.cancelScheduledValues(now);

    if (bypass) {
      this.wetGain.gain.setTargetAtTime(0, now, fadeTime);
      this.dryGain.gain.setTargetAtTime(1, now, fadeTime);
    } else {
      this.wetGain.gain.setTargetAtTime(1, now, fadeTime);
      this.dryGain.gain.setTargetAtTime(0, now, fadeTime);
    }

    this.bypassed = bypass;
  }

  dispose(): void {}
  bypass(_enabled: boolean): void {}
  setWetDry(_wet: number, _dry?: number): void {}
  setParam(_name: string, _value: number): void {}
  getParam(_name: string): number { return 0; }
  getParams(): Record<string, number> { return {}; }

}