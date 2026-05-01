// @ts-nocheck
// FILE: client/src/audio/fx/delay.ts
import { FXNodeBase } from './fx-nodebase';
import { smoothParam } from '../../utils/audio-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DelayMode = 'mono' | 'stereo' | 'ping-pong';

export type DelaySync =
  | 'off'
  | '1/1'  | '1/2'  | '1/4'  | '1/8'  | '1/16'
  | '1/2d' | '1/4d' | '1/8d'                      // dotted
  | '1/4t' | '1/8t' | '1/16t';                    // triplet

export interface DelayParams {
  /** Delay time in seconds (ignored when sync !== 'off') */
  time?:       number;
  /** Tempo-sync division */
  sync?:       DelaySync;
  /** BPM used when sync is active */
  bpm?:        number;
  /** Feedback amount 0–0.98 */
  feedback?:   number;
  /** High-pass filter cutoff on the feedback path (Hz) */
  hpCutoff?:   number;
  /** Low-pass filter cutoff on the feedback path (Hz) */
  lpCutoff?:   number;
  /** Wet/dry mix 0–1 */
  mix?:        number;
  /** Mono / stereo / ping-pong */
  mode?:       DelayMode;
  /** Ping-pong spread — L/R offset in seconds (ping-pong mode only) */
  spread?:     number;
}

export type DelayPreset = keyof typeof PRESETS;

// ─── Sync division → seconds ─────────────────────────────────────────────────

const DIVISION_MULTIPLIERS: Record<Exclude<DelaySync, 'off'>, number> = {
  '1/1':  4,
  '1/2':  2,    '1/2d':  3,
  '1/4':  1,    '1/4d':  1.5,  '1/4t':  2 / 3,
  '1/8':  0.5,  '1/8d':  0.75, '1/8t':  1 / 3,
  '1/16': 0.25,                 '1/16t': 1 / 6,
};

function syncToSeconds(division: Exclude<DelaySync, 'off'>, bpm: number): number {
  const _beatsPerSec = bpm / 60;
  return DIVISION_MULTIPLIERS[division] / beatsPerSec;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

const _PRESETS = {
  /** Subtle room-filling slap */
  slap: {
    time: 0.08, sync: 'off', feedback: 0.15, mix: 0.25,
    hpCutoff: 200, lpCutoff: 8000, mode: 'mono',
  },
  /** Classic quarter-note tape delay */
  tape: {
    time: 0.5, sync: '1/4', feedback: 0.45, mix: 0.35,
    hpCutoff: 120, lpCutoff: 5000, mode: 'stereo', spread: 0.015,
  },
  /** Ambient wash */
  wash: {
    time: 0.75, sync: '1/2d', feedback: 0.72, mix: 0.5,
    hpCutoff: 80, lpCutoff: 3500, mode: 'stereo', spread: 0.04,
  },
  /** Rhythmic ping-pong */
  pingPong: {
    time: 0.25, sync: '1/8', feedback: 0.55, mix: 0.4,
    hpCutoff: 150, lpCutoff: 7000, mode: 'ping-pong', spread: 0.02,
  },
  /** Very short doubler */
  doubler: {
    time: 0.018, sync: 'off', feedback: 0, mix: 0.5,
    hpCutoff: 20, lpCutoff: 20000, mode: 'stereo', spread: 0.022,
  },
} as const satisfies Record<string, DelayParams>;

// ─── Delay ────────────────────────────────────────────────────────────────────

export class Delay extends FXNodeBase {
  // Primary delay line
  private delayL: DelayNode;
  private delayR: DelayNode;   // only used in stereo/ping-pong modes
  private feedback: GainNode;

  // Tone-shaping on the feedback path
  private fbHP: BiquadFilterNode;
  private fbLP: BiquadFilterNode;

  // Stereo merger/splitter for ping-pong routing
  private splitter: ChannelSplitterNode;
  private merger:   ChannelMergerNode;

  // Current params (source of truth for getParams / toJSON)
  private _params: Required<DelayParams> = {
    time:     0.25,
    sync:     'off',
    bpm:      120,
    feedback: 0.35,
    hpCutoff: 20,
    lpCutoff: 20000,
    mix:      0.35,
    mode:     'mono',
    spread:   0.02,
  };

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor(id: string, initialParams?: DelayParams) {
    super(id);

    this.delayL   = this.context.createDelay(4.0);
    this.delayR   = this.context.createDelay(4.0);
    this.feedback = this.context.createGain();
    this.fbHP     = this.context.createBiquadFilter();
    this.fbLP     = this.context.createBiquadFilter();
    this.splitter = this.context.createChannelSplitter(2);
    this.merger   = this.context.createChannelMerger(2);

    this.fbHP.type            = 'highpass';
    this.fbLP.type            = 'lowpass';

    // Apply defaults then any caller overrides
    this.setParams({ ...this._params, ...initialParams });
  }

  // ─── Routing ─────────────────────────────────────────────────────────────────

  protected connectEffect(): void {
    this.rebuildGraph();
  }

  /**
   * Tear down and reconstruct the internal graph whenever mode changes.
   * Mono:      input → delayL → feedback(HP→LP) ↺ → wetGain → output
   * Stereo:    L/R split → delayL + delayR(+spread) → merge → wetGain → output
   * Ping-pong: L→R→L cross-feed with spread offset
   */
  private rebuildGraph(): void {
    // Disconnect everything cleanly
    for (const node of [
      this.delayL, this.delayR, this.feedback,
      this.fbHP, this.fbLP, this.splitter, this.merger,
    ]) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }

    const { mode, spread } = this._params;

    switch (mode) {
      case 'mono': {
        // input → delayL → HP → LP → feedback → delayL (loop)
        //                  └──────────────────→ wetGain → output
        this.input.connect(this.delayL);
        this.delayL.connect(this.fbHP);
        this.fbHP.connect(this.fbLP);
        this.fbLP.connect(this.feedback);
        this.feedback.connect(this.delayL);
        this.delayL.connect(this.wetGain);
        break;
      }

      case 'stereo': {
        // Split → delayL / delayR(offset by spread) → merge → wetGain
        this.input.connect(this.splitter);
        this.splitter.connect(this.delayL, 0);
        this.splitter.connect(this.delayR, 1);

        // Apply spread to right channel
        const _baseTime = this.resolvedTime;
        this.delayL.delayTime.value = baseTime;
        this.delayR.delayTime.value = Math.min(4, baseTime + spread);

        this.delayL.connect(this.merger, 0, 0);
        this.delayR.connect(this.merger, 0, 1);
        this.merger.connect(this.fbHP);
        this.fbHP.connect(this.fbLP);
        this.fbLP.connect(this.feedback);
        this.feedback.connect(this.delayL);
        this.feedback.connect(this.delayR);
        this.merger.connect(this.wetGain);
        break;
      }

      case 'ping-pong': {
        // L only enters delayL; delayL output cross-feeds into delayR; vice-versa
        this.input.connect(this.splitter);
        this.splitter.connect(this.delayL, 0);

        const _baseTime = this.resolvedTime;
        this.delayL.delayTime.value = baseTime;
        this.delayR.delayTime.value = Math.min(4, baseTime + spread);

        this.delayL.connect(this.fbHP);
        this.fbHP.connect(this.fbLP);
        this.fbLP.connect(this.feedback);
        // Cross-feed: L→R, R→L
        this.feedback.connect(this.delayR);
        this.delayR.connect(this.feedback);

        this.delayL.connect(this.merger, 0, 0);
        this.delayR.connect(this.merger, 0, 1);
        this.merger.connect(this.wetGain);
        break;
      }
    }

    this.wetGain.connect(this.output);
  }

  // ─── Bulk param update ────────────────────────────────────────────────────────

  setParams(params: DelayParams): void {
    const _prev = { ...this._params };
    this._params = { ...this._params, ...params };

    const _now = this.context.currentTime;
    const _modeChanged = params.mode !== undefined && params.mode !== prev.mode;

    // Rebuild the graph if mode changed
    if (modeChanged) {
      this.rebuildGraph();
    }

    // Time
    if (params.time !== undefined || params.sync !== undefined || params.bpm !== undefined) {
      const _t = this.resolvedTime;
      smoothParam(this.delayL.delayTime, t, now);
      smoothParam(
        this.delayR.delayTime,
        Math.min(4, t + this._params.spread),
        now,
      );
    }

    if (params.feedback !== undefined) {
      smoothParam(this.feedback.gain, clamp(params.feedback, 0, 0.98), now);
    }

    if (params.hpCutoff !== undefined) {
      smoothParam(this.fbHP.frequency, clamp(params.hpCutoff, 20, 20000), now);
    }

    if (params.lpCutoff !== undefined) {
      smoothParam(this.fbLP.frequency, clamp(params.lpCutoff, 20, 20000), now);
    }

    if (params.mix !== undefined) {
      this.setMix(clamp(params.mix, 0, 1));
    }

    if (params.spread !== undefined && !modeChanged) {
      const _t = this.resolvedTime;
      smoothParam(
        this.delayR.delayTime,
        Math.min(4, t + this._params.spread),
        now,
      );
    }
  }

  // ─── Individual setters ───────────────────────────────────────────────────────

  /** Set delay time in seconds (disables sync). */
  setTime(seconds: number): void {
    this._params.time = Math.max(0, Math.min(4, seconds));
    this._params.sync = 'off';
    const _t = this.resolvedTime;
    smoothParam(this.delayL.delayTime, t, this.context.currentTime);
    smoothParam(this.delayR.delayTime, Math.min(4, t + this._params.spread), this.context.currentTime);
  }

  /** Sync delay time to a tempo division. */
  setSyncDivision(division: DelaySync, bpm?: number): void {
    this._params.sync = division;
    if (bpm !== undefined) this._params.bpm = bpm;
    const _t = this.resolvedTime;
    smoothParam(this.delayL.delayTime, t, this.context.currentTime);
    smoothParam(this.delayR.delayTime, Math.min(4, t + this._params.spread), this.context.currentTime);
  }

  /** Update BPM when the project tempo changes. */
  setBPM(bpm: number): void {
    this._params.bpm = bpm;
    if (this._params.sync !== 'off') {
      const _t = this.resolvedTime;
      smoothParam(this.delayL.delayTime, t, this.context.currentTime);
      smoothParam(this.delayR.delayTime, Math.min(4, t + this._params.spread), this.context.currentTime);
    }
  }

  /** Feedback amount 0–0.98. Values ≥ 1 would cause runaway feedback. */
  setFeedback(value: number): void {
    this._params.feedback = clamp(value, 0, 0.98);
    smoothParam(this.feedback.gain, this._params.feedback, this.context.currentTime);
  }

  /** High-pass cutoff on the feedback path (Hz). */
  setHPCutoff(hz: number): void {
    this._params.hpCutoff = clamp(hz, 20, 20000);
    smoothParam(this.fbHP.frequency, this._params.hpCutoff, this.context.currentTime);
  }

  /** Low-pass cutoff on the feedback path (Hz) — simulates tape degradation. */
  setLPCutoff(hz: number): void {
    this._params.lpCutoff = clamp(hz, 20, 20000);
    smoothParam(this.fbLP.frequency, this._params.lpCutoff, this.context.currentTime);
  }

  /** Wet/dry mix 0–1. */
  setMix(value: number): void {
    this._params.mix = clamp(value, 0, 1);
    super.setWetDry(this._params.mix);
  }

  /** Switch routing mode. Triggers a full graph rebuild. */
  setMode(mode: DelayMode): void {
    if (mode === this._params.mode) return;
    this._params.mode = mode;
    this.rebuildGraph();
  }

  /** L/R spread in seconds (stereo & ping-pong modes). */
  setSpread(seconds: number): void {
    this._params.spread = Math.max(0, seconds);
    const _t = this.resolvedTime;
    smoothParam(
      this.delayR.delayTime,
      Math.min(4, t + this._params.spread),
      this.context.currentTime,
    );
  }

  // ─── Presets ─────────────────────────────────────────────────────────────────

  applyPreset(name: DelayPreset): void {
    this.setParams(PRESETS[name] as DelayParams);
  }

  static get presets(): DelayPreset[] {
    return Object.keys(PRESETS) as DelayPreset[];
  }

  // ─── Introspection ────────────────────────────────────────────────────────────

  getParams(): Readonly<Required<DelayParams>> {
    return { ...this._params };
  }

  /** Resolved delay time in seconds (accounts for sync mode). */
  get resolvedTime(): number {
    if (this._params.sync === 'off') return this._params.time;
    return syncToSeconds(this._params.sync as Exclude<DelaySync, 'off'>, this._params.bpm);
  }

  toJSON() {
    return {
      id:     this.id,
      type:   'delay',
      params: this.getParams(),
      resolvedTime: this.resolvedTime,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  dispose(): void {
    for (const node of [
      this.delayL, this.delayR, this.feedback,
      this.fbHP, this.fbLP, this.splitter, this.merger,
    ]) {
      try { node.disconnect(); } catch { /* ok */ }
    }
    super.dispose();
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}