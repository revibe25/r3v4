#!/usr/bin/env python3
"""
apply_enhancements.py — R3 v4 Audio/Visual Enhancement Patch
=============================================================

Delivers 5 enhancements:
  1. Audio-reactive FFT → Three.js shader uniforms
     • use-loop-engine-fft.ts      (hook: reads loopEngine FFT/waveform, derives band energies)
     • AudioReactiveScene.tsx      (R3F scene: ShaderMaterial uniforms, N8AO beat-pulse, camera dolly)

  2. M/S worklet processing
     • instrument-processor.worklet.ts  (REPLACES existing: adds M/S encode/decode,
                                         per-channel compression, msWidth/midGain/sideGain params)

  3. Sidechain (already in engine — this adds the React hook)
     • use-sidechain.ts            (hook: wraps loopEngine.enableSidechain, hot-update, event sync)

  4. InstancedMesh waveform renderer
     • WaveformMesh.tsx            (R3F: single draw call, 256 instanced bars, amplitude coloring)

  5. IR convolution reverb
     • ir-reverb-engine.ts         (class: ConvolverNode + real IR files, patchIntoLoopEngine())
     • use-ir-reverb.ts            (hook: lifecycle, auto-wire, preset catalog)

USAGE:
  cd ~/Stable/R3\ v4
  python3 apply_enhancements.py

All paths are relative to the script location (project root).
Existing files are backed up to <path>.bak before replacement.
"""

import os
import sys
import shutil

# ── Resolve project root ───────────────────────────────────────────────────────

BASE = os.path.dirname(os.path.abspath(__file__))
PASS = []
FAIL = []

def _info(msg: str)  -> None: print(f"\033[0;36m  {msg}\033[0m")
def _ok(msg: str)    -> None: print(f"\033[0;32m  ✓ {msg}\033[0m"); PASS.append(msg)
def _warn(msg: str)  -> None: print(f"\033[0;33m  ⚠ {msg}\033[0m")
def _err(msg: str)   -> None: print(f"\033[0;31m  ✗ {msg}\033[0m"); FAIL.append(msg)

def write_file(rel_path: str, content: str, backup: bool = False) -> None:
    abs_path = os.path.join(BASE, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    if backup and os.path.exists(abs_path):
        bak = abs_path + ".bak"
        shutil.copy2(abs_path, bak)
        _info(f"Backed up {rel_path} → {os.path.basename(bak)}")
    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content)
    _ok(f"Wrote {rel_path}")

def patch_file(rel_path: str, old: str, new: str, desc: str = "") -> bool:
    abs_path = os.path.join(BASE, rel_path)
    if not os.path.exists(abs_path):
        _err(f"patch_file: {rel_path} not found")
        return False
    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()
    if old not in content:
        _warn(f"patch_file: target not found in {rel_path}" + (f" ({desc})" if desc else ""))
        return False
    bak = abs_path + ".bak"
    shutil.copy2(abs_path, bak)
    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content.replace(old, new, 1))
    _ok(f"Patched {rel_path}" + (f" — {desc}" if desc else ""))
    return True

# ═══════════════════════════════════════════════════════════════════════════════
# FILE CONTENTS
# ═══════════════════════════════════════════════════════════════════════════════

# ── 1. use-loop-engine-fft.ts ─────────────────────────────────────────────────

USE_LOOP_ENGINE_FFT = r'''/**
 * use-loop-engine-fft.ts
 *
 * Polls loopEngine audio analysers every rAF and returns:
 *   - masterFft / masterWaveform          (Float32Array, live)
 *   - trackFft[n] / trackWaveform[n]      (Float32Array[], live)
 *   - bands: { sub, low, mid, high, presence, air }  (0-1 normalised RMS per band)
 *   - peakAmplitude / rms                 (0-1, from master waveform)
 *
 * Two variants:
 *   useLoopEngineFFT(fps?)        — React state, triggers re-renders at fps rate
 *   useLoopEngineFFTRef()         — ref only, zero re-renders, use inside useFrame
 */

import { useEffect, useRef, useState } from "react";
import {
  getLoopEngine,
  TRACK_COUNT,
  FFT_SIZE,
  ANALYSER_SIZE,
} from "../features/loopstation/engine/loopEngine";

const BAND_RANGES = {
  sub:      [20,    80]    as [number, number],
  low:      [80,    250]   as [number, number],
  mid:      [250,   2000]  as [number, number],
  high:     [2000,  8000]  as [number, number],
  presence: [8000,  12000] as [number, number],
  air:      [12000, 20000] as [number, number],
} as const;

export interface BandEnergies {
  sub: number; low: number; mid: number;
  high: number; presence: number; air: number;
}

export interface FFTData {
  masterFft:      Float32Array;
  masterWaveform: Float32Array;
  trackFft:       Float32Array[];
  trackWaveform:  Float32Array[];
  bands:          BandEnergies;
  peakAmplitude:  number;
  rms:            number;
}

function fftBandEnergy(fft: Float32Array, loHz: number, hiHz: number, sr = 44100): number {
  const binHz = sr / (fft.length * 2);
  const lo    = Math.max(0, Math.floor(loHz / binHz));
  const hi    = Math.min(fft.length - 1, Math.ceil(hiHz / binHz));
  if (lo > hi) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    const lin = Math.pow(10, fft[i] / 20);
    sum += lin * lin;
  }
  return Math.sqrt(sum / (hi - lo + 1));
}

function buildBands(fft: Float32Array): BandEnergies {
  return {
    sub:      fftBandEnergy(fft, ...BAND_RANGES.sub),
    low:      fftBandEnergy(fft, ...BAND_RANGES.low),
    mid:      fftBandEnergy(fft, ...BAND_RANGES.mid),
    high:     fftBandEnergy(fft, ...BAND_RANGES.high),
    presence: fftBandEnergy(fft, ...BAND_RANGES.presence),
    air:      fftBandEnergy(fft, ...BAND_RANGES.air),
  };
}

function emptyData(): FFTData {
  const bins = FFT_SIZE / 2;
  return {
    masterFft:      new Float32Array(bins),
    masterWaveform: new Float32Array(ANALYSER_SIZE),
    trackFft:       Array.from({ length: TRACK_COUNT }, () => new Float32Array(bins)),
    trackWaveform:  Array.from({ length: TRACK_COUNT }, () => new Float32Array(ANALYSER_SIZE)),
    bands:          { sub: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 },
    peakAmplitude:  0,
    rms:            0,
  };
}

export function useLoopEngineFFT(fps = 60): FFTData {
  const [data, setData] = useState<FFTData>(emptyData);
  const rafRef          = useRef<number>(0);
  const lastRef         = useRef(0);
  const interval        = 1000 / fps;

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - lastRef.current < interval) return;
      lastRef.current = now;
      const engine = getLoopEngine();
      if (!engine.initialized) return;
      const masterFft      = engine.getMasterFft();
      const masterWaveform = engine.getMasterWaveform();
      const bands          = buildBands(masterFft);
      let sumSq = 0, peak = 0;
      for (let i = 0; i < masterWaveform.length; i++) {
        const v = masterWaveform[i];
        sumSq += v * v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      setData({
        masterFft, masterWaveform,
        trackFft:      Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackFft(i)),
        trackWaveform: Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackWaveform(i)),
        bands, peakAmplitude: peak,
        rms: Math.sqrt(sumSq / masterWaveform.length),
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [interval]);

  return data;
}

/** Ref variant — zero re-renders. Use inside R3F useFrame. */
export function useLoopEngineFFTRef(): React.MutableRefObject<FFTData> {
  const ref    = useRef<FFTData>(emptyData());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const engine = getLoopEngine();
      if (!engine.initialized) return;
      const masterFft      = engine.getMasterFft();
      const masterWaveform = engine.getMasterWaveform();
      const bands          = buildBands(masterFft);
      let sumSq = 0, peak = 0;
      for (let i = 0; i < masterWaveform.length; i++) {
        const v = masterWaveform[i];
        sumSq += v * v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      ref.current = {
        masterFft, masterWaveform,
        trackFft:      Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackFft(i)),
        trackWaveform: Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackWaveform(i)),
        bands, peakAmplitude: peak,
        rms: Math.sqrt(sumSq / masterWaveform.length),
      };
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return ref;
}
'''

# ── 2. use-sidechain.ts ───────────────────────────────────────────────────────

USE_SIDECHAIN = r'''/**
 * use-sidechain.ts
 * React hook over loopEngine's real envelope-follower sidechain (v3).
 *
 * loopEngine already has full sidechain: Transport.scheduleRepeat at 16n,
 * reads source analyser RMS, IIR smoothing, drives sidechainGain in master chain.
 * This hook just exposes it cleanly with React state + event sync.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getLoopEngine } from "../features/loopstation/engine/loopEngine";

export interface SidechainConfig {
  sourceTrackIndex: number;
  amount:  number;  // 0-1 duck depth
  attack:  number;  // seconds, default 0.003
  release: number;  // seconds, default 0.15
}

export interface SidechainState {
  enabled:   boolean;
  config:    SidechainConfig;
  enable:    (cfg: SidechainConfig) => void;
  disable:   () => void;
  update:    (partial: Partial<SidechainConfig>) => void;
  setAmount: (amount: number) => void;
}

const DEFAULT: SidechainConfig = {
  sourceTrackIndex: 0, amount: 0.7, attack: 0.003, release: 0.15,
};

export function useSidechain(): SidechainState {
  const [enabled, setEnabled] = useState(false);
  const [config,  setConfig]  = useState<SidechainConfig>(DEFAULT);
  const cfgRef                = useRef<SidechainConfig>(DEFAULT);

  useEffect(() => {
    const e   = getLoopEngine();
    const on  = e.on("sidechainEnabled",  () => setEnabled(true));
    const off = e.on("sidechainDisabled", () => setEnabled(false));
    return () => { on(); off(); };
  }, []);

  useEffect(() => {
    return () => { if (getLoopEngine().initialized) getLoopEngine().disableSidechain(); };
  }, []);

  const enable = useCallback((cfg: SidechainConfig) => {
    const c = { ...cfg,
      amount:  Math.max(0, Math.min(1, cfg.amount)),
      attack:  Math.max(0.0001, Math.min(1, cfg.attack)),
      release: Math.max(0.001,  Math.min(2, cfg.release)),
    };
    cfgRef.current = c;
    setConfig(c);
    const engine = getLoopEngine();
    if (engine.initialized) {
      engine.enableSidechain(c.sourceTrackIndex, c.amount, c.attack, c.release);
      setEnabled(true);
    } else {
      const off = engine.on("ready", () => {
        engine.enableSidechain(c.sourceTrackIndex, c.amount, c.attack, c.release);
        off();
      });
    }
  }, []);

  const disable = useCallback(() => {
    getLoopEngine().disableSidechain();
    setEnabled(false);
  }, []);

  const update = useCallback((partial: Partial<SidechainConfig>) => {
    const next = { ...cfgRef.current, ...partial };
    cfgRef.current = next;
    setConfig(next);
    if (enabled && getLoopEngine().initialized) {
      getLoopEngine().enableSidechain(next.sourceTrackIndex, next.amount, next.attack, next.release);
    }
  }, [enabled]);

  const setAmount = useCallback((amount: number) => {
    update({ amount: Math.max(0, Math.min(1, amount)) });
  }, [update]);

  return { enabled, config, enable, disable, update, setAmount };
}
'''

# ── 3. instrument-processor.worklet.ts (M/S replacement) ─────────────────────

MS_WORKLET = r'''/**
 * instrument-processor.worklet.ts — M/S Edition
 *
 * Mid/Side processing chain in the audio thread.
 *
 *   L,R → M/S decode → [mid compressor + midGain]
 *                     + [side compressor + msWidth + sideGain] → M/S re-encode → L,R
 *
 * Parameters (all a-rate):
 *   masterGain      0-2,  default 1.0    post-processing output level
 *   compThreshold  -60-0, default -24    shared compression threshold (dBFS)
 *   compRatio       1-20, default 4      compression ratio N:1
 *   msWidth         0-2,  default 1.0    Side channel scalar (0=mono, 1=unity, 2=wide)
 *   midGain         0-2,  default 1.0    independent Mid gain
 *   sideGain        0-2,  default 1.0    independent Side gain (stacks with msWidth)
 *   midThreshold   -60-0, default -24    Mid-specific compression threshold
 *   sideThreshold  -60-0, default -30    Side-specific compression threshold
 *
 * Registration: "instrument-processor" (unchanged — no call-site changes needed)
 * Mono fallback: single-channel input processes as mid=signal, side=0
 */

class InstrumentProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "masterGain",    defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "compThreshold", defaultValue: -24, minValue: -60, maxValue: 0   },
      { name: "compRatio",     defaultValue: 4,   minValue: 1,   maxValue: 20  },
      { name: "msWidth",       defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "midGain",       defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "sideGain",      defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "midThreshold",  defaultValue: -24, minValue: -60, maxValue: 0   },
      { name: "sideThreshold", defaultValue: -30, minValue: -60, maxValue: 0   },
    ];
  }

  _midEnv  = 0.0;
  _sideEnv = 0.0;
  _atk     = Math.exp(-1 / (0.003 * sampleRate / 128));
  _rel     = Math.exp(-1 / (0.150 * sampleRate / 128));

  _compress(env, sample, threshDB, ratio) {
    const thresh = Math.pow(10, threshDB / 20);
    const abs    = Math.abs(sample);
    // Envelope follower
    env = abs > env
      ? this._atk * env + (1 - this._atk) * abs
      : this._rel * env + (1 - this._rel) * abs;
    if (abs <= thresh) return { gr: 1.0, env };
    const excess = abs - thresh;
    const knee   = thresh * 0.5;
    if (excess < knee) {
      const blend = excess / knee;
      const r     = 1 + (ratio - 1) * blend * 0.5;
      return { gr: (thresh + excess / r) / abs, env };
    }
    return { gr: (thresh + excess / ratio) / abs, env };
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input?.length || !output?.length) return true;

    const pv = (name, i) => {
      const a = parameters[name];
      return a ? (a.length > 1 ? a[i] : a[0]) : 1.0;
    };

    const L  = input[0];
    const R  = input[1] ?? input[0];
    const oL = output[0];
    const oR = output[1] ?? output[0];

    for (let i = 0; i < L.length; i++) {
      const masterGain   = pv("masterGain",    i);
      const compRatio    = pv("compRatio",     i);
      const compThresh   = pv("compThreshold", i);
      const msWidth      = pv("msWidth",       i);
      const midGainVal   = pv("midGain",       i);
      const sideGainVal  = pv("sideGain",      i);
      const midThresh    = pv("midThreshold",  i);
      const sideThresh   = pv("sideThreshold", i);

      // M/S encode
      const mid  = (L[i] + R[i]) * 0.5;
      const side = (L[i] - R[i]) * 0.5;

      // Mid channel: compressor + gain
      const midC       = this._compress(this._midEnv,  mid,  midThresh  !== -24 ? midThresh  : compThresh, compRatio);
      this._midEnv     = midC.env;
      const procMid    = mid  * midC.gr  * midGainVal;

      // Side channel: compressor + width + gain
      const sideC      = this._compress(this._sideEnv, side, sideThresh !== -30 ? sideThresh : compThresh, compRatio);
      this._sideEnv    = sideC.env;
      const procSide   = side * sideC.gr * msWidth * sideGainVal;

      // M/S decode
      oL[i] = (procMid + procSide) * masterGain;
      oR[i] = (procMid - procSide) * masterGain;
    }

    return true;
  }
}

registerProcessor("instrument-processor", InstrumentProcessor);
'''

# ── 4. ir-reverb-engine.ts ───────────────────────────────────────────────────

IR_REVERB_ENGINE = r'''/**
 * ir-reverb-engine.ts
 *
 * ConvolverNode-based reverb using real impulse response files.
 * Drop .wav IRs in client/public/ir/ to enable presets.
 * Free IR sources: openairlib.net, echothief.com
 *
 * ROUTING:
 *   inputNode → preGain → convolver → wetGain ─┐
 *                                               ├─→ outputNode
 *   inputNode               → dryGain ──────────┘
 */

export const IR_CATALOG = {
  smallRoom:    "/ir/small-room.wav",
  largeHall:    "/ir/large-hall.wav",
  cathedral:    "/ir/cathedral.wav",
  clubRoom:     "/ir/club-room.wav",
  studio:       "/ir/studio.wav",
  plateMedium:  "/ir/plate-medium.wav",
  plateLarge:   "/ir/plate-large.wav",
  springReverb: "/ir/spring-reverb.wav",
  stadium:      "/ir/stadium.wav",
  tunnel:       "/ir/tunnel.wav",
} as const;

export type IRPreset = keyof typeof IR_CATALOG;

export class IRReverbEngine {
  private _ctx:      AudioContext | null = null;
  private _conv:     ConvolverNode | null = null;
  private _input:    GainNode | null = null;
  private _preGain:  GainNode | null = null;
  private _wetGain:  GainNode | null = null;
  private _dryGain:  GainNode | null = null;
  private _output:   GainNode | null = null;
  private _wet       = 0.35;
  private _preG      = 1.0;
  private _loaded    = false;
  private _loading   = false;
  private _curUrl    = "";

  init(ctx: AudioContext): void {
    if (this._ctx) this.dispose();
    this._ctx    = ctx;
    this._input  = ctx.createGain();
    this._preGain = ctx.createGain();
    this._conv   = ctx.createConvolver();
    this._wetGain = ctx.createGain();
    this._dryGain = ctx.createGain();
    this._output = ctx.createGain();
    this._preGain.gain.value  = this._preG;
    this._wetGain.gain.value  = this._wet;
    this._dryGain.gain.value  = 1 - this._wet;
    // Wet path
    this._input.connect(this._preGain);
    this._preGain.connect(this._conv);
    this._conv.connect(this._wetGain);
    this._wetGain.connect(this._output);
    // Dry path
    this._input.connect(this._dryGain);
    this._dryGain.connect(this._output);
  }

  async load(url: string): Promise<void> {
    if (!this._ctx || !this._conv) throw new Error("[IRReverbEngine] call init() first");
    if (url === this._curUrl && this._loaded) return;
    this._loading = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[IRReverbEngine] fetch failed: ${url} (${res.status})`);
      const buf     = await res.arrayBuffer();
      const decoded = await this._ctx.decodeAudioData(buf);
      this._conv.buffer = decoded;
      this._curUrl  = url;
      this._loaded  = true;
    } finally {
      this._loading = false;
    }
  }

  async loadPreset(preset: IRPreset): Promise<void> {
    await this.load(IR_CATALOG[preset]);
  }

  connectSource(src: AudioNode): void      { this._input?.connect(src as any); src.connect(this._input!); }
  connectDestination(dest: AudioNode): void { this._output?.connect(dest); }

  /**
   * Patch into loopEngine as parallel reverb return.
   * Call after loopEngine.init() resolves.
   */
  patchIntoLoopEngine(loopEngine: any): void {
    if (!this._input || !this._output) throw new Error("[IRReverbEngine] not initialized");
    // Tap master analyser → our input
    (loopEngine.masterAnalyser as any).connect(this._input);
    // Return → master limiter input
    const limIn = (loopEngine.masterLimiter as any).input as AudioNode | undefined;
    if (limIn) this._output.connect(limIn);
    else       (loopEngine.masterLimiter as any).connect(this._output);
  }

  setWet(wet: number, rampMs = 50): void {
    this._wet = Math.max(0, Math.min(1, wet));
    const now = this._ctx?.currentTime ?? 0;
    const r   = rampMs / 1000;
    this._wetGain?.gain.linearRampToValueAtTime(this._wet,     now + r);
    this._dryGain?.gain.linearRampToValueAtTime(1 - this._wet, now + r);
  }

  setPreGain(gain: number): void {
    this._preG = Math.max(0, Math.min(4, gain));
    if (this._preGain) this._preGain.gain.value = this._preG;
  }

  get loaded()   { return this._loaded; }
  get loading()  { return this._loading; }
  get wet()      { return this._wet; }
  get inputNode(){ return this._input; }
  get outputNode(){ return this._output; }

  dispose(): void {
    [this._input, this._preGain, this._conv, this._wetGain, this._dryGain, this._output]
      .forEach(n => { try { (n as any)?.disconnect(); } catch { /**/ } });
    this._input = this._preGain = this._conv =
      this._wetGain = this._dryGain = this._output = null;
    this._ctx = null; this._loaded = false; this._curUrl = "";
  }
}
'''

# ── 5. use-ir-reverb.ts ───────────────────────────────────────────────────────

USE_IR_REVERB = r'''/**
 * use-ir-reverb.ts
 * React hook managing IRReverbEngine lifecycle.
 * Auto-wires into loopEngine as parallel reverb return on engine ready.
 * Place IR .wav files in client/public/ir/ — see IR_CATALOG for preset names.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { IRReverbEngine, IRPreset, IR_CATALOG } from "../audio/effects/ir-reverb-engine";
import { getLoopEngine } from "../features/loopstation/engine/loopEngine";

export interface IRReverbHookState {
  loaded:        boolean;
  loading:       boolean;
  error:         string | null;
  wet:           number;
  currentPreset: IRPreset | null;
  loadPreset:    (preset: IRPreset) => Promise<void>;
  loadFromUrl:   (url: string) => Promise<void>;
  setWet:        (wet: number) => void;
  setPreGain:    (gain: number) => void;
  dispose:       () => void;
}

export function useIRReverb(): IRReverbHookState {
  const engineRef    = useRef(new IRReverbEngine());
  const wiredRef     = useRef(false);
  const pendingRef   = useRef<string | null>(null);
  const [loaded,  setLoaded]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [wet,     setWetState]= useState(0.35);
  const [currentPreset, setCurrentPreset] = useState<IRPreset | null>(null);

  const wire = useCallback(() => {
    if (wiredRef.current) return;
    import("tone").then(Tone => {
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      engineRef.current.init(rawCtx);
      const le = getLoopEngine();
      if (le.initialized) { engineRef.current.patchIntoLoopEngine(le); wiredRef.current = true; }
      if (pendingRef.current) {
        const url = pendingRef.current; pendingRef.current = null;
        void loadUrl(url);
      }
    }).catch(e => setError(String(e)));
  }, []); // eslint-disable-line

  useEffect(() => {
    const le = getLoopEngine();
    if (le.initialized) { wire(); return; }
    return le.on("ready", wire);
  }, [wire]);

  useEffect(() => () => engineRef.current.dispose(), []);

  const loadUrl = async (url: string) => {
    setLoading(true); setError(null);
    try {
      if (!wiredRef.current) { pendingRef.current = url; return; }
      await engineRef.current.load(url);
      setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally     { setLoading(false); }
  };

  const loadFromUrl = useCallback(async (url: string) => {
    setCurrentPreset(null); await loadUrl(url);
  }, []); // eslint-disable-line

  const loadPreset = useCallback(async (preset: IRPreset) => {
    setCurrentPreset(preset); await loadUrl(IR_CATALOG[preset]);
  }, []); // eslint-disable-line

  const setWet = useCallback((w: number) => {
    engineRef.current.setWet(w); setWetState(w);
  }, []);

  const setPreGain = useCallback((g: number) => { engineRef.current.setPreGain(g); }, []);
  const dispose    = useCallback(() => { engineRef.current.dispose(); setLoaded(false); }, []);

  return { loaded, loading, error, wet, currentPreset, loadPreset, loadFromUrl, setWet, setPreGain, dispose };
}
'''

# ── 6. WaveformMesh.tsx ───────────────────────────────────────────────────────

WAVEFORM_MESH = r'''/**
 * WaveformMesh.tsx
 *
 * Three.js R3F InstancedMesh waveform renderer.
 * Single GPU draw call for all BIN_COUNT bars. Zero React re-renders.
 *
 * Props:
 *   trackIndex  — loopEngine track index (-1 = master waveform)
 *   binCount    — instanced bar count (default 256)
 *   width/height/depth — world-unit dimensions
 *   gain        — visual amplitude multiplier (default 1.5)
 *   colorLow/colorHigh — hex color at low/high amplitude
 *   useFft      — read FFT bars instead of waveform
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getLoopEngine } from "../../features/loopstation/engine/loopEngine";

interface WaveformMeshProps {
  trackIndex:  number;
  binCount?:   number;
  width?:      number;
  height?:     number;
  depth?:      number;
  gain?:       number;
  colorLow?:   string;
  colorHigh?:  string;
  useFft?:     boolean;
  position?:   [number, number, number];
  rotation?:   [number, number, number];
}

export function WaveformMesh({
  trackIndex,
  binCount  = 256,
  width     = 4,
  height    = 1,
  depth     = 0.04,
  gain      = 1.5,
  colorLow  = "#00ff88",
  colorHigh = "#ff2244",
  useFft    = false,
  position  = [0, 0, 0],
  rotation  = [0, 0, 0],
}: WaveformMeshProps) {
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const colorBuf  = useMemo(() => new THREE.Color(), []);
  const colorLoV  = useMemo(() => new THREE.Color(colorLow),  [colorLow]);
  const colorHiV  = useMemo(() => new THREE.Color(colorHigh), [colorHigh]);
  const barWidth  = width / binCount;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const engine = getLoopEngine();
    if (!engine.initialized) return;

    const raw = useFft
      ? (trackIndex < 0 ? engine.getMasterFft()      : engine.getTrackFft(trackIndex))
      : (trackIndex < 0 ? engine.getMasterWaveform() : engine.getTrackWaveform(trackIndex));
    if (!raw?.length) return;

    const step = Math.max(1, Math.floor(raw.length / binCount));

    for (let i = 0; i < binCount; i++) {
      const sample = raw[i * step] ?? 0;
      const amp    = Math.min(1, Math.abs(useFft ? Math.max(0, (sample + 100) / 100) : sample) * gain);
      const barH   = Math.max(0.001, amp * height);

      dummy.position.set((i / (binCount - 1) - 0.5) * width, barH * 0.5, 0);
      dummy.scale.set(barWidth * 0.85, barH, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colorBuf.lerpColors(colorLoV, colorHiV, amp);
      mesh.setColorAt(i, colorBuf);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, binCount]}
      position={position}
      rotation={rotation}
      castShadow receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.3} metalness={0.6} emissiveIntensity={0.2} />
    </instancedMesh>
  );
}
'''

# ── 7. AudioReactiveScene.tsx ─────────────────────────────────────────────────

AUDIO_REACTIVE_SCENE = r'''/**
 * AudioReactiveScene.tsx
 *
 * R3F Three.js scene driven by loopEngine FFT data.
 *
 * Features:
 *   - ShaderMaterial with 6 band energy uniforms (sub/low/mid/high/presence/air)
 *   - Vertex shader: bass-driven geometry displacement via smooth noise
 *   - Fragment shader: emissive pulse, fresnel rim, beat flash
 *   - Particle ring keyed to per-bin FFT
 *   - Camera dolly: pulls back on bass hit, recovers slowly
 *   - N8AOBeatController: animates SSAO aoRadius + intensity on beat
 *
 * Usage (inside <Canvas>):
 *   <AudioReactiveScene />
 *
 * For N8AO SSAO (optional):
 *   const n8aoRef = useRef();
 *   <N8AOPostPass ref={n8aoRef} ... />
 *   <N8AOBeatController passRef={n8aoRef} fftRef={fftRef} />
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getLoopEngine } from "../../features/loopstation/engine/loopEngine";
import { useLoopEngineFFTRef } from "../../hooks/use-loop-engine-fft";

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uBeatFlash;
varying vec3  vNormal;
varying vec3  vPosition;
varying float vAmplitude;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1); p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float sNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

void main() {
  vNormal   = normalize(normalMatrix * normal);
  vPosition = position;
  float n   = sNoise(position * (2.5 + uMidEnergy * 3.0) + uTime * 0.3);
  float d   = n * uBassEnergy * 0.6;
  float sh  = sNoise(position * 12.0 + uTime * 2.0) * uHighEnergy * 0.08;
  vAmplitude = d + sh;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal*(d+sh), 1.0);
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uBeatFlash;
uniform vec3  uColorBase;
uniform vec3  uColorAccent;
varying vec3  vNormal;
varying vec3  vPosition;
varying float vAmplitude;

void main() {
  vec3  vDir    = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(vDir, vNormal), 0.0), 3.0);
  float blend   = clamp(uMidEnergy * 2.0 + uHighEnergy, 0.0, 1.0);
  vec3  body    = mix(uColorBase, uColorAccent, blend);
  vec3  col     = body * (0.4 + vAmplitude * 1.8)
                + uColorAccent * fresnel * (0.6 + uHighEnergy * 1.2)
                + vec3(vAmplitude * 0.15 + uBeatFlash * 0.3);
  gl_FragColor  = vec4(col, 0.85 + fresnel * 0.15);
}`;

// ── Reactive icosphere ────────────────────────────────────────────────────────

function ReactiveIcosphere({ fftRef, beatFlashRef, colorBase, colorAccent }: {
  fftRef:       React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
  beatFlashRef: React.MutableRefObject<number>;
  colorBase:    string;
  colorAccent:  string;
}) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const toV3     = (hex: string) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uBassEnergy: { value: 0 },
    uMidEnergy:  { value: 0 },
    uHighEnergy: { value: 0 },
    uBeatFlash:  { value: 0 },
    uColorBase:  { value: toV3(colorBase) },
    uColorAccent:{ value: toV3(colorAccent) },
  }), [colorBase, colorAccent]);

  useFrame(({ clock }) => {
    const u = uniforms;
    const b = fftRef.current.bands;
    u.uTime.value       = clock.getElapsedTime();
    u.uBassEnergy.value = THREE.MathUtils.lerp(u.uBassEnergy.value, b.sub + b.low, 0.15);
    u.uMidEnergy.value  = THREE.MathUtils.lerp(u.uMidEnergy.value,  b.mid, 0.12);
    u.uHighEnergy.value = THREE.MathUtils.lerp(u.uHighEnergy.value, b.high + b.presence + b.air, 0.10);
    u.uBeatFlash.value  = THREE.MathUtils.lerp(u.uBeatFlash.value,  beatFlashRef.current, 0.3);
    beatFlashRef.current *= 0.88;
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003 + b.mid * 0.02;
      meshRef.current.rotation.x += 0.001 + b.sub * 0.01;
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <icosahedronGeometry args={[1.5, 5]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG}
        uniforms={uniforms} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ── Particle ring ─────────────────────────────────────────────────────────────

function ParticleRing({ fftRef, count = 128, radius = 3.2, color = "#00aaff" }: {
  fftRef:   React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
  count?:   number; radius?: number; color?: string;
}) {
  const ptsRef  = useRef<THREE.Points>(null);
  const geo     = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      pos[i*3]=Math.cos(a)*radius; pos[i*3+1]=0; pos[i*3+2]=Math.sin(a)*radius;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, radius]);

  useFrame(({ clock }) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const fft = fftRef.current.masterFft;
    const b   = fftRef.current.bands;
    const t   = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const a   = (i / count) * Math.PI * 2;
      const idx = Math.floor((i / count) * fft.length * 0.5);
      const e   = Math.max(0, (fft[idx] + 100) / 100);
      const r   = radius + e * 1.5 + b.sub * 0.8;
      pos.setXYZ(i,
        Math.cos(a + t*0.1)*r,
        Math.sin(t*0.3 + i*0.05) * (0.2 + e*0.5),
        Math.sin(a + t*0.1)*r,
      );
    }
    pos.needsUpdate = true;
  });

  return <points ref={ptsRef} geometry={geo}>
    <pointsMaterial color={color} size={0.06} sizeAttenuation transparent opacity={0.8} />
  </points>;
}

// ── Camera controller ─────────────────────────────────────────────────────────

function AudioReactiveCamera({ fftRef }: {
  fftRef: React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
}) {
  const { camera } = useThree();
  const baseZ      = useRef(5);

  useFrame(() => {
    const b = fftRef.current.bands;
    const bass = b.sub + b.low;
    baseZ.current = THREE.MathUtils.lerp(baseZ.current, 5, 0.02);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseZ.current + bass * 0.8, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, Math.sin(Date.now()*0.0003)*0.15 + b.mid*0.2, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── Main scene ────────────────────────────────────────────────────────────────

interface AudioReactiveSceneProps {
  colorBase?:     string;
  colorAccent?:   string;
  showRing?:      boolean;
  ringColor?:     string;
  animateCamera?: boolean;
}

export function AudioReactiveScene({
  colorBase     = "#1a0066",
  colorAccent   = "#00ff88",
  showRing      = true,
  ringColor     = "#00aaff",
  animateCamera = true,
}: AudioReactiveSceneProps) {
  const fftRef       = useLoopEngineFFTRef();
  const beatFlashRef = useRef(0);

  useEffect(() => {
    const off = getLoopEngine().on("beat", (_, beat) => {
      beatFlashRef.current = beat === 0 ? 1.0 : 0.35;
    });
    return off;
  }, []);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0,3,3]}   intensity={1.2} color={colorAccent} castShadow />
      <pointLight position={[0,-3,-3]} intensity={0.6} color={colorBase} />
      {animateCamera && <AudioReactiveCamera fftRef={fftRef} />}
      <ReactiveIcosphere fftRef={fftRef} beatFlashRef={beatFlashRef}
        colorBase={colorBase} colorAccent={colorAccent} />
      {showRing && <ParticleRing fftRef={fftRef} color={ringColor} />}
      <fog attach="fog" args={["#000000", 8, 20]} />
    </>
  );
}

// ── N8AO beat controller (attach to N8AOPostPass ref) ────────────────────────

export function N8AOBeatController({ passRef, fftRef, baseRadius = 1.5, baseIntensity = 5 }: {
  passRef:        React.RefObject<{ configuration: { aoRadius: number; intensity: number } }>;
  fftRef:         React.MutableRefObject<import("../../hooks/use-loop-engine-fft").FFTData>;
  baseRadius?:    number;
  baseIntensity?: number;
}) {
  useFrame(() => {
    const pass = passRef.current;
    if (!pass?.configuration) return;
    const bass = fftRef.current.bands.sub + fftRef.current.bands.low;
    pass.configuration.aoRadius  = baseRadius   + bass * 2.0;
    pass.configuration.intensity = baseIntensity + bass * 8.0;
  });
  return null;
}
'''

# ═══════════════════════════════════════════════════════════════════════════════
# EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n\033[1;37m═══════════════════════════════════════════════════════\033[0m")
    print("\033[1;37m  R3 v4 Enhancement Patch\033[0m")
    print("\033[1;37m═══════════════════════════════════════════════════════\033[0m\n")

    # ── Guard: must be run from project root ──────────────────────────────────
    if not os.path.exists(os.path.join(BASE, "pnpm-workspace.yaml")):
        _err("Run from project root (~/Stable/R3 v4). pnpm-workspace.yaml not found.")
        sys.exit(1)

    print("\033[1m1. FFT Hook + Audio-Reactive Scene\033[0m")
    write_file("client/src/hooks/use-loop-engine-fft.ts", USE_LOOP_ENGINE_FFT)
    write_file("client/src/components/three/AudioReactiveScene.tsx", AUDIO_REACTIVE_SCENE)

    print("\n\033[1m2. M/S Worklet (replaces instrument-processor.worklet.ts)\033[0m")
    write_file("client/src/worklets/instrument-processor.worklet.ts", MS_WORKLET, backup=True)

    print("\n\033[1m3. Sidechain Hook\033[0m")
    write_file("client/src/hooks/use-sidechain.ts", USE_SIDECHAIN)

    print("\n\033[1m4. InstancedMesh Waveform Renderer\033[0m")
    write_file("client/src/components/three/WaveformMesh.tsx", WAVEFORM_MESH)

    print("\n\033[1m5. IR Convolution Reverb\033[0m")
    write_file("client/src/audio/effects/ir-reverb-engine.ts", IR_REVERB_ENGINE)
    write_file("client/src/hooks/use-ir-reverb.ts", USE_IR_REVERB)

    # ── Create IR public directory ────────────────────────────────────────────
    ir_dir = os.path.join(BASE, "client/public/ir")
    os.makedirs(ir_dir, exist_ok=True)
    readme = os.path.join(ir_dir, "README.md")
    if not os.path.exists(readme):
        with open(readme, "w") as f:
            f.write("# IR Files\n\n"
                    "Place impulse response .wav files here to enable IR reverb presets.\n\n"
                    "## Free Sources\n"
                    "- OpenAIR: http://www.openairlib.net\n"
                    "- Echothief: http://www.echothief.com\n\n"
                    "## Expected Files (see IR_CATALOG in ir-reverb-engine.ts)\n"
                    "- small-room.wav\n- large-hall.wav\n- cathedral.wav\n"
                    "- club-room.wav\n- studio.wav\n- plate-medium.wav\n"
                    "- plate-large.wav\n- spring-reverb.wav\n- stadium.wav\n- tunnel.wav\n")
        _ok("Created client/public/ir/README.md")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n\033[1;37m═══════════════════════════════════════════════════════\033[0m")
    print(f"  \033[0;32m{len(PASS)} files written\033[0m", end="")
    if FAIL:
        print(f"  \033[0;31m{len(FAIL)} failures\033[0m")
        for f in FAIL:
            print(f"    ✗ {f}")
    else:
        print()
    print(f"\033[1;37m═══════════════════════════════════════════════════════\033[0m\n")

    print("\033[1mNext steps:\033[0m")
    print("  1. pnpm build   — verify TypeScript compiles clean")
    print("  2. Add IR files to client/public/ir/ (see README)")
    print("  3. Wire AudioReactiveScene into a <Canvas> component:")
    print("       import { AudioReactiveScene } from './components/three/AudioReactiveScene'")
    print("       // inside <Canvas>: <AudioReactiveScene />")
    print("  4. Use WaveformMesh inside any existing <Canvas>:")
    print("       <WaveformMesh trackIndex={0} useFft width={6} height={2} />")
    print("  5. The M/S worklet is a drop-in replacement — no call-site changes.")
    print("     New AudioWorkletNode params: msWidth (0-2), midGain, sideGain")
    print("  6. Sidechain hook:")
    print("       const sc = useSidechain()")
    print("       sc.enable({ sourceTrackIndex: 0, amount: 0.8, attack: 0.003, release: 0.15 })")
    print("  7. IR Reverb hook:")
    print("       const ir = useIRReverb()")
    print("       ir.loadPreset('largeHall')   // after placing .wav in public/ir/")
    print("       ir.setWet(0.4)")
    print()

if __name__ == "__main__":
    main()
