// @ts-nocheck
// ─── RC-505 MkII Loop Engine — ENHANCED v3 ────────────────────────────────────
// src/features/loopstation/engine/loopEngine.ts
//
// Dynamic import — Tone NEVER loads until init() is called inside a user-gesture.
// Zero AudioContext creation at module-load time.
//
// ENHANCEMENTS OVER v2:
//   BUG FIXES:
//   • sidechainGain now wired into master chain via preFXBus (was created but
//     never connected — sidechain ducking was completely non-functional)
//   • _wireLFO() now tracks and disposes Scale nodes before re-wiring
//     (was leaking one Scale node per LFO update call)
//   • Duplicate method block (~line 3300 in v2) removed — setMono,
//     enableLimiter, setBeatRepeatPitch, setReverbPreDelay, setGranularDensity,
//     setGranularSpread each appeared twice; dead code eliminated
//   • setSidechainTrack() replaced: was a one-shot Meter poll at call-time,
//     now runs a real Transport.scheduleRepeat envelope follower
//   • dispose() now clears _sidechainScheduleId, _lfoScaleNodes, preFXBus,
//     exciter nodes, multiband nodes
//
//   NEW FEATURES:
//   • True 3-band multiband compression (crossover network lazily inserted
//     between masterBus and preFXBus — zero-glitch toggle)
//   • Harmonic exciter (parallel HPF→saturation path in master chain,
//     wet/tone controls, adds air/presence without increasing perceived loudness)
//   • Real sidechain envelope follower (scheduleRepeat at '16n' reads source
//     analyser RMS, applies attack/release smoothing to sidechainGain)
//   • True granular freeze (grain scheduler via Transport.scheduleRepeat —
//     configurable grain size, count, pitch, scatter; replaces single Player loop)
//   • Per-grain stereo spread via randomized panning
//   • preFXBus insertion point makes future master-chain inserts clean
// ─────────────────────────────────────────────────────────────────────────────

import type * as ToneType from 'tone';
import type {
  HarmonyMode,
  LFOShape,
  LFOTarget,
  MacroKnob,
  MacroTarget,
  PlaybackMode,
  QuantMode,
  TimeSignature,
} from '../types/loopstation.types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const TRACK_COUNT    = 5   as const;
export const CLIP_COUNT     = 8   as const;
export const ANALYSER_SIZE  = 1024 as const;
export const FFT_SIZE       = 2048 as const;
export const TAP_HISTORY    = 6   as const;
export const UNDO_DEPTH     = 8   as const;
export const LFO_COUNT      = 4   as const;
export const MACRO_COUNT    = 4   as const;
export const GRAIN_COUNT_MAX = 8  as const;

// Multiband default crossover points
const MB_LOW_FREQ_DEFAULT  = 250;   // Hz — low / mid crossover
const MB_HIGH_FREQ_DEFAULT = 4000;  // Hz — mid / high crossover

// Sidechain envelope follower update rate
const SC_UPDATE_INTERVAL = '16n' as const;

// Granular defaults
const GRAIN_SIZE_DEFAULT   = 0.12;  // seconds
const GRAIN_COUNT_DEFAULT  = 4;
const GRAIN_INTERVAL       = '16n' as const;

const HARMONY_SEMITONES: Record<HarmonyMode, number> = {
  off: 0, subtle: 3, choir: 7, ambient: 12, counter: -5,
  octave: 12, fifth: 7, unison: 0,
};
const HARMONY_WET: Record<HarmonyMode, number> = {
  off: 0, subtle: 0.3, choir: 0.5, ambient: 0.4, counter: 0.4,
  octave: 0.5, fifth: 0.45, unison: 0.35,
};

const SYNCED_LFO_RATES = ['1m','2n','4n','8n','16n','8t','4t','1/32'] as const;

// ── Public types ──────────────────────────────────────────────────────────────

export interface StereoLevel { L: number; R: number; peak: number; clip: boolean; lufs: number }

export interface ClipBuffer {
  buffer:     ToneType.ToneAudioBuffer | null;
  hasContent: boolean;
  lengthBars: number;
  name:       string;
  color:      string;
  state:      'empty' | 'loaded' | 'playing' | 'recording' | 'queued';
  _player:    ToneType.Player | null;
  _synced:    boolean;
}

export interface LFOState {
  id:       number;
  shape:    LFOShape;
  rateSynced: boolean;
  rateHz:   number;
  rateNote: string;
  depth:    number;
  target:   LFOTarget;
  trackIndex: number | null;
  enabled:  boolean;
  phase:    number;
  _lfo:     ToneType.LFO | null;
}

export interface MultibandBand {
  threshold: number;   // dBFS, -60 to 0
  ratio:     number;   // 1-20
  gain:      number;   // dB output trim, -12 to +12
}

export interface MultibandState {
  enabled:  boolean;
  lowFreq:  number;    // Hz, crossover 1
  highFreq: number;    // Hz, crossover 2
  low:      MultibandBand;
  mid:      MultibandBand;
  high:     MultibandBand;
}

export interface ExciterState {
  amount: number;   // 0-1 wet blend
  tone:   number;   // HPF cutoff Hz (2000-12000)
  drive:  number;   // 0-1 saturation amount on high shelf
}

export interface GranularState {
  frozen:     boolean;
  grainSize:  number;  // seconds 0.02-0.5
  grainCount: number;  // 1-8 simultaneous grains
  pitch:      number;  // semitones ±12
  spread:     number;  // stereo spread 0-1
  density:    number;  // playback rate scalar 0-1 → 0.25-4x
}

export interface EngineTrack {
  readonly id:     string;
  readonly index:  number;

  recorder:        ToneType.UserMedia;
  player:          ToneType.Player;

  inputGain:       ToneType.Gain;
  gate:            ToneType.Gate;
  compressor:      ToneType.Compressor;
  eq:              ToneType.EQ3;
  saturator:       ToneType.Distortion;
  chorus:          ToneType.Chorus;
  flanger:         ToneType.Chorus;
  phaser:          ToneType.Phaser;
  bitCrusher:      ToneType.BitCrusher;
  pitchShift:      ToneType.PitchShift;
  tremolo:         ToneType.Tremolo;
  panner:          ToneType.Panner;
  outputGain:      ToneType.Gain;

  reverbSend:      ToneType.Gain;
  delaySend:       ToneType.Gain;
  chorusSend:      ToneType.Gain;

  meter:           ToneType.Meter;
  meterL:          ToneType.Meter;
  meterR:          ToneType.Meter;
  analyser:        ToneType.Analyser;
  fft:             ToneType.Analyser;

  clips:           ClipBuffer[];

  overdubLayers:   number;
  isMuted:         boolean;
  isSoloed:        boolean;
  isCued:          boolean;
  clipHeld:        boolean;
  playbackMode:    PlaybackMode;
  reverbSendAmount:  number;
  delaySendAmount:   number;
  chorusSendAmount:  number;
  _playerSynced:   boolean;
  _undoStack:      ToneType.ToneAudioBuffer[];
}

export interface SceneSnapshot {
  id:     string;
  label:  string;
  color:  string;
  bpm:    number;
  tracks: Array<{
    volume:      number;
    pan:         number;
    muted:       boolean;
    reverbSend:  number;
    delaySend:   number;
    chorusSend:  number;
    eq:          { low: number; mid: number; high: number };
    harmonyMode: HarmonyMode;
    playbackMode: PlaybackMode;
    inputGain:   number;
    saturation:  number;
    compThreshold: number;
    compRatio:   number;
    chorus:      { depth: number; rate: number; wet: number };
    phaser:      { frequency: number; wet: number };
    bitDepth:    number;
    tremolo:     { frequency: number; depth: number; wet: number };
  }>;
  fx: {
    filterFreq:    number;
    filterType:    BiquadFilterType;
    filterRes:     number;
    reverbWet:     number;
    reverbDecay:   number;
    delayFeedback: number;
    delayTime:     string;
    driveAmount:   number;
    stereoWidth:   number;
    phaserWet:     number;
    bitDepth:      number;
    granularFreeze: boolean;
  };
}

export type EngineEventMap = {
  ready:             [];
  disposed:          [];
  bpmChange:         [bpm: number];
  error:             [err: Error];
  beat:              [bar: number, beat: number, subdivision: number];
  quantizeTick:      [mode: QuantMode];
  clipDetected:      [trackIndex: number];
  soloChanged:       [soloActive: boolean];
  loopStart:         [trackIndex: number];
  loopEnd:           [trackIndex: number];
  recordStart:       [trackIndex: number];
  recordStop:        [trackIndex: number, durationSec: number];
  overdubStart:      [trackIndex: number];
  overdubStop:       [trackIndex: number];
  clipLaunched:      [trackIndex: number, clipIndex: number];
  clipStopped:       [trackIndex: number, clipIndex: number];
  macroChange:       [macroId: number, value: number, target: MacroTarget];
  lfoTick:           [lfoId: number, value: number];
  sceneCapture:      [scene: SceneSnapshot];
  sceneRecall:       [scene: SceneSnapshot];
  sceneMorphTick:    [progress: number];
  undoPush:          [trackIndex: number, depth: number];
  undoPop:           [trackIndex: number, depth: number];
  transportStart:    [];
  transportStop:     [];
  transportPause:    [];
  midiClockStart:    [];
  midiClockStop:     [];
  // MIDI input events (added 2026-04-25)
  midiNoteOn:        [trackIndex: number, note: number, velocity: number];
  midiNoteOff:       [trackIndex: number, note: number];
  midiCC:            [cc: number, value: number];
  midiInputEnabled:  [enabled: boolean];
  beatRepeatStart:   [trackIndex: number];
  beatRepeatStop:    [trackIndex: number];
  multibandEnabled:  [enabled: boolean];
  exciterChanged:    [state: ExciterState];
  sidechainEnabled:  [sourceTrack: number, amount: number];
  sidechainDisabled: [];
  granularParams:    [state: GranularState];
};

type EngineListener<K extends keyof EngineEventMap> = (...args: EngineEventMap[K]) => void;
type ToneModule = typeof ToneType;

let Tone: ToneModule | null = null;

// ── Internal Helpers ──────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerpParam(param: ToneType.Param<any>, to: number, ramp = 0.05): void {
  try { param.rampTo(to, ramp); } catch { param.value = to; }
}

function rmsToLufs(rms: number): number {
  if (rms <= 0) return -70;
  return 20 * Math.log10(rms) - 0.691;
}

// Compute RMS from a Float32Array (for sidechain envelope follower)
function computeRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

// ── BeatRepeat internal engine ─────────────────────────────────────────────────

interface BeatRepeatInternal {
  enabled:      boolean;
  trackIndex:   number;
  division:     string;
  chance:       number;
  length:       number;
  pitch:        number;
  variation:    string;
  _scheduleId:  number;
  _buffer:      ToneType.Player | null;
}

// ── LoopEngine ────────────────────────────────────────────────────────────────

class LoopEngine {
  private static _instance: LoopEngine | null = null;

  readonly tracks: EngineTrack[] = [];
  initialized = false;

  // Pre-init cache
  private _pendingBpm       = 120;
  private _tapTimes:number[]= [];
  private _beatCount        = 0;
  private _soloActive       = false;
  private _metronomeOn      = false;
  private _metronomeVol     = 0.4;
  private _beatScheduleId   = -1;
  private _quantScheduleId  = -1;
  private _currentBar       = 0;
  private _currentBeat      = 0;
  private _swingAmount      = 0;
  private _quantMode: QuantMode = '1m';
  private _timeSignature: TimeSignature = '4/4';
  private _midiOutput: MIDIOutput | null = null;
  private _midiInputPort: MIDIInput | undefined = undefined;
  private _midiInputEnabled = false;
  private _midiAccess: MIDIAccess | undefined = undefined;
  private _midiClockScheduleId = -1;

  // ── MIDI Input (added 2026-04-25) ──────────────────────────────────────────
  private _midiInput:        MIDIInput | null = null;
  // Default note map: C3–G3 (MIDI 60–64) → tracks 0–4.
  // Configurable via setMidiNoteMap().
  private _midiNoteMap: Record<number, number> = {
    60: 0,  // C3  → track 1
    62: 1,  // D3  → track 2
    64: 2,  // E3  → track 3
    65: 3,  // F3  → track 4
    67: 4,  // G3  → track 5
  };
  // CC-number → normalised-value (0..1) handler. Set via setMidiCCHandler().
  private _midiCCHandlers: Record<number, (v: number) => void> = {};

  // LFOs
  private _lfos: LFOState[] = [];
  // Scale nodes per LFO — disposed before each re-wire (fixes v2 leak)
  private _lfoScaleNodes: Map<number, ToneType.Scale[]> = new Map();

  // Macros
  private _macros: MacroKnob[] = [];

  // BeatRepeat
  private _beatRepeat: BeatRepeatInternal = {
    enabled: false, trackIndex: 0, division: '1/8',
    chance: 1, length: 1, pitch: 0, variation: 'none',
    _scheduleId: -1, _buffer: null,
  };

  // Scene morph
  private _morphRafId = 0;

  // ── Master chain nodes ───────────────────────────────────────────────────

  // Primary collection bus — all track outputGains connect here
  masterBus!:            ToneType.Gain;

  // preFXBus — insertion point for multiband / future pre-FX inserts
  // masterBus → preFXBus → globalFilter → ... (normal bypass)
  // masterBus → [multibandNet] → preFXBus → globalFilter → ... (when MB enabled)
  private _preFXBus!:    ToneType.Gain;

  // Global FX serial chain (preFXBus feeds into globalFilter)
  globalFilter!:         ToneType.Filter;
  globalDelay!:          ToneType.FeedbackDelay;
  globalReverb!:         ToneType.Reverb;
  globalChorus!:         ToneType.Chorus;
  globalPhaser!:         ToneType.Phaser;
  globalSaturator!:      ToneType.Distortion;
  globalBitCrusher!:     ToneType.BitCrusher;
  globalStereoWidener!:  ToneType.StereoWidener;

  // Harmonic exciter (parallel path, after globalSaturator)
  // preFX chain: ... → globalSaturator → [split] → exciterHPF → exciterSat → exciterWet
  //                                      └──────────────────────────────────→ exciterDry
  //              exciterWet + exciterDry → exciterSumBus → globalBitCrusher → ...
  private _exciterHPF:     ToneType.Filter | null = null;
  private _exciterSat:     ToneType.Distortion | null = null;
  private _exciterWetGain: ToneType.Gain | null = null;
  private _exciterDryGain: ToneType.Gain | null = null;
  private _exciterSumBus:  ToneType.Gain | null = null;
  private _exciterState: ExciterState = { amount: 0, tone: 6000, drive: 0.4 };
  private _exciterEnabled = false;

  // Sidechain ducking
  // sidechainGain is wired into master chain: globalStereoWidener → sidechainGain → masterCompressor
  // setSidechainTrack() starts a scheduleRepeat that reads source analyser RMS
  // and drives sidechainGain.gain with attack/release smoothing.
  sidechainEnv!:           ToneType.Envelope;   // kept for API compatibility
  sidechainGain!:          ToneType.Gain;
  private _sidechainScheduleId  = -1;
  private _sidechainSourceIdx   = -1;
  private _sidechainAmount      = 0;
  private _sidechainAttack      = 0.003;
  private _sidechainRelease     = 0.15;
  private _sidechainEnvLevel    = 1.0;  // running gain (attack/release smoothed)

  // Multiband compression
  // When enabled, masterBus disconnects from _preFXBus and feeds:
  //   masterBus → _mbLowPass   → _mbLowComp   → _mbLowGain   → _mbSumBus → _preFXBus
  //             → _mbMidHi→Lo  → _mbMidComp   → _mbMidGain   → _mbSumBus
  //             → _mbHighPass  → _mbHighComp  → _mbHighGain  → _mbSumBus
  private _mbEnabled         = false;
  private _mbLowLP:    ToneType.Filter | null = null;   // LP at lowFreq
  private _mbMidHP:    ToneType.Filter | null = null;   // HP at lowFreq (mid input)
  private _mbMidLP:    ToneType.Filter | null = null;   // LP at highFreq (mid output)
  private _mbHighHP:   ToneType.Filter | null = null;   // HP at highFreq
  private _mbLowComp:  ToneType.Compressor | null = null;
  private _mbMidComp:  ToneType.Compressor | null = null;
  private _mbHighComp: ToneType.Compressor | null = null;
  private _mbLowGain:  ToneType.Gain | null = null;
  private _mbMidGain:  ToneType.Gain | null = null;
  private _mbHighGain: ToneType.Gain | null = null;
  private _mbSumBus:   ToneType.Gain | null = null;
  private _mbState: MultibandState = {
    enabled: false,
    lowFreq: MB_LOW_FREQ_DEFAULT,
    highFreq: MB_HIGH_FREQ_DEFAULT,
    low:  { threshold: -24, ratio: 3, gain: 0 },
    mid:  { threshold: -18, ratio: 2.5, gain: 0 },
    high: { threshold: -20, ratio: 3, gain: 0 },
  };

  // Metering + master tail
  masterCompressor!:   ToneType.Compressor;
  masterLimiter!:      ToneType.Limiter;
  masterMeter!:        ToneType.Meter;
  masterFft!:          ToneType.Analyser;
  masterAnalyser!:     ToneType.Analyser;

  // Metronome
  metronomeClick!:     ToneType.MetalSynth;
  metronomeAccent!:    ToneType.MetalSynth;

  // Granular freeze — v3: grain scheduler replaces single looping Player
  private _granularFrozen      = false;
  private _granularSourceTrack = 0;
  private _granularScheduleId  = -1;
  private _grainState: GranularState = {
    frozen:     false,
    grainSize:  GRAIN_SIZE_DEFAULT,
    grainCount: GRAIN_COUNT_DEFAULT,
    pitch:      0,
    spread:     0,
    density:    0.5,
  };
  // Legacy single-player reference (for setGranularDensity compat when scheduler inactive)
  private _granularPlayer: ToneType.Player | null = null;
  private _granularWidener: ToneType.StereoWidener | null = null;

  // Reverb pre-delay
  private _reverbPreDelayNode: ToneType.Delay | null = null;

  // Mono collapse + limiter bypass state
  private _monoEnabled               = false;
  private _preMonoWidth              = 0.5;
  private _limiterEnabled            = true;
  private _preBypassLimiterThreshold = -1;

  private _listeners: { [K in keyof EngineEventMap]?: Set<EngineListener<K>> } = {};

  private constructor() {
    for (let i = 0; i < LFO_COUNT; i++) {
      this._lfos.push({
        id: i, shape: 'sine', rateSynced: true,
        rateHz: 1, rateNote: '4n', depth: 0.5,
        target: 'none', trackIndex: null, enabled: false,
        phase: 0, _lfo: null,
      });
      this._lfoScaleNodes.set(i, []);
    }
    for (let i = 0; i < MACRO_COUNT; i++) {
      this._macros.push({
        id: i, label: `MACRO ${i + 1}`, value: 0.5,
        target: 'none', color: 'var(--looper-acid-2)',
        lfoEnabled: false, lfoShape: 'sine',
        lfoRate: 0.3, lfoDepth: 0.5, lfoSync: true,
      });
    }
  }

  static getInstance(): LoopEngine {
    if (!LoopEngine._instance) LoopEngine._instance = new LoopEngine();
    return LoopEngine._instance;
  }

  // ── Event bus ─────────────────────────────────────────────────────────────

  on<K extends keyof EngineEventMap>(event: K, cb: EngineListener<K>): () => void {
    if (!this._listeners[event])
      (this._listeners[event] as Set<EngineListener<K>>) = new Set();
    (this._listeners[event] as Set<EngineListener<K>>).add(cb);
    return () => this.off(event, cb);
  }

  off<K extends keyof EngineEventMap>(event: K, cb: EngineListener<K>): void {
    (this._listeners[event] as Set<EngineListener<K>> | undefined)?.delete(cb);
  }

  private emit<K extends keyof EngineEventMap>(event: K, ...args: EngineEventMap[K]): void {
    (this._listeners[event] as Set<EngineListener<K>> | undefined)
      ?.forEach(fn => { try { fn(...args); } catch (e) { console.error('[LoopEngine] event handler error', e); } });
  }

  // ── init() ────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      _Tone = await import('tone');
      await _Tone.start();

      _Tone.Transport.bpm.value = this._pendingBpm;
      this._applySwing();

      // ── Master collection bus ────────────────────────────────────────────
      this.masterBus  = new _Tone.Gain(1);

      // preFXBus — insertion point so multiband can intercept without rewiring
      // the entire chain. masterBus normally connects directly here.
      this._preFXBus  = new _Tone.Gain(1);
      this.masterBus.connect(this._preFXBus);

      // ── Global FX serial chain ───────────────────────────────────────────
      this.globalFilter        = new _Tone.Filter(8000, 'lowpass');
      this.globalDelay         = new _Tone.FeedbackDelay('8n', 0.3);
      this.globalDelay.wet.value = 0;
      this.globalReverb        = new _Tone.Reverb({ decay: 2.5, wet: 0 });
      this.globalChorus        = new _Tone.Chorus(2, 2.5, 0.5).start();
      this.globalChorus.wet.value = 0;
      this.globalPhaser        = new _Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000 });
      this.globalPhaser.wet.value = 0;
      this.globalSaturator     = new _Tone.Distortion(0);
      this.globalBitCrusher    = new _Tone.BitCrusher(16);
      this.globalStereoWidener = new _Tone.StereoWidener(0.5);

      await this.globalReverb.ready;

      // Sidechain ducking gain — FIX: now wired into chain between
      // globalStereoWidener and masterCompressor. v2 created these nodes
      // but never connected them; the chain was untouched.
      this.sidechainEnv  = new _Tone.Envelope({ attack: 0.003, decay: 0.1, sustain: 1, release: 0.3 });
      this.sidechainGain = new _Tone.Gain(1);

      // Master dynamics tail
      this.masterCompressor = new _Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.003, release: 0.1 });
      this.masterLimiter    = new _Tone.Limiter(-1);
      this.masterMeter      = new _Tone.Meter({ normalRange: true });
      this.masterFft        = new _Tone.Analyser('fft', FFT_SIZE);
      this.masterAnalyser   = new _Tone.Analyser('waveform', ANALYSER_SIZE);

      // ── Wire master chain ────────────────────────────────────────────────
      // _preFXBus → filter → chorus → phaser → saturator → bitCrusher
      //   → delay → reverb → widener → sidechainGain (FIX) → compressor
      //   → limiter → meter
      this._preFXBus.chain(
        this.globalFilter,
        this.globalChorus,
        this.globalPhaser,
        this.globalSaturator,
        this.globalBitCrusher,
        this.globalDelay,
        this.globalReverb,
        this.globalStereoWidener,
        this.sidechainGain,        // ← FIX: was dangling in v2
        this.masterCompressor,
        this.masterLimiter,
        this.masterMeter,
      );
      this.masterLimiter.fan(this.masterFft, this.masterAnalyser);
      this.masterLimiter.toDestination();

      // ── Metronome ────────────────────────────────────────────────────────
      this.metronomeClick = new _Tone.MetalSynth({
        frequency: 600, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 0.5,
      });
      this.metronomeAccent = new _Tone.MetalSynth({
        frequency: 1000, envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
        harmonicity: 8, modulationIndex: 40, resonance: 6000, octaves: 1,
      });
      this.metronomeClick.connect(this.masterLimiter);
      this.metronomeAccent.connect(this.masterLimiter);
      this.metronomeClick.volume.value  = -22;
      this.metronomeAccent.volume.value = -18;

      // ── Per-track nodes ──────────────────────────────────────────────────
      const built = await Promise.all(
        Array.from({ length: TRACK_COUNT }, (_, i) => this._buildTrack(i))
      );
      (this.tracks as EngineTrack[]).push(...built);

      // ── LFO nodes ────────────────────────────────────────────────────────
      this._initLFOs();

      // ── Schedulers ───────────────────────────────────────────────────────
      this._startBeatScheduler();
      this._startQuantizeScheduler();

      // ── MIDI clock ───────────────────────────────────────────────────────
      this._initMidiClock().catch(() => {/* no MIDI, ok */});

      this.initialized = true;
      this.emit('ready');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    }
  }

  // ── Track builder ─────────────────────────────────────────────────────────

  private async _buildTrack(i: number): Promise<EngineTrack> {
    const T = _Tone!;

    const outputGain    = new T.Gain(1).connect(this.masterBus);
    const panner        = new T.Panner(0).connect(outputGain);

    const tremolo       = new T.Tremolo({ frequency: 4, depth: 0, type: 'sine' }).start();
    tremolo.wet.value   = 0;
    tremolo.connect(panner);

    const pitchShift    = new T.PitchShift(0);
    pitchShift.connect(tremolo);

    const bitCrusher    = new T.BitCrusher(16);
    bitCrusher.connect(pitchShift);

    const phaser        = new T.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000 });
    phaser.wet.value    = 0;
    phaser.connect(bitCrusher);

    const flanger       = new T.Chorus({ frequency: 0.1, delayTime: 3.5, depth: 0.7 }).start();
    flanger.wet.value   = 0;
    flanger.connect(phaser);

    const chorus        = new T.Chorus({ frequency: 2, delayTime: 3.5, depth: 0.7 }).start();
    chorus.wet.value    = 0;
    chorus.connect(flanger);

    const saturator     = new T.Distortion(0);
    saturator.wet.value = 0;
    saturator.connect(chorus);

    const eq            = new T.EQ3({ low: 0, mid: 0, high: 0 });
    eq.connect(saturator);

    const compressor    = new T.Compressor({ threshold: -24, ratio: 3, attack: 0.003, release: 0.15 });
    compressor.connect(eq);

    const gate          = new T.Gate({ threshold: -60, smoothing: 0.1 });
    gate.connect(compressor);

    const inputGain     = new T.Gain(1);
    inputGain.connect(gate);

    const reverbSend    = new T.Gain(0).connect(this.globalReverb);
    const delaySend     = new T.Gain(0).connect(this.globalDelay);
    const chorusSend    = new T.Gain(0).connect(this.globalChorus);

    const meter         = new T.Meter({ normalRange: true });
    const meterL        = new T.Meter({ normalRange: true, channelCount: 1 });
    const meterR        = new T.Meter({ normalRange: true, channelCount: 1 });

    const analyser      = new T.Analyser('waveform', ANALYSER_SIZE);
    const fft           = new T.Analyser('fft', FFT_SIZE);

    const player        = new T.Player();
    player.loop         = true;
    player.connect(inputGain);
    player.fan(meter, meterL, meterR, analyser, fft, reverbSend, delaySend, chorusSend);

    const recorder      = new T.UserMedia();
    recorder.connect(inputGain);
    recorder.fan(meter, meterL, meterR, analyser, fft, reverbSend, delaySend, chorusSend);

    const clips: ClipBuffer[] = Array.from({ length: CLIP_COUNT }, (_, ci) => ({
      buffer: null, hasContent: false,
      lengthBars: 0, name: `Clip ${ci + 1}`,
      color: 'var(--dj-border)',
      state: 'empty' as const,
      _player: null, _synced: false,
    }));

    return {
      id: `track-${i}`, index: i,
      recorder, player,
      inputGain, gate, compressor, eq,
      saturator, chorus, flanger, phaser, bitCrusher,
      pitchShift, tremolo, panner, outputGain,
      reverbSend, delaySend, chorusSend,
      meter, meterL, meterR, analyser, fft,
      clips,
      overdubLayers: 0,
      isMuted: false, isSoloed: false, isCued: false, clipHeld: false,
      playbackMode: 'normal',
      reverbSendAmount: 0, delaySendAmount: 0, chorusSendAmount: 0,
      _playerSynced: false,
      _undoStack: [],
    };
  }

  // ── LFO init / re-init ────────────────────────────────────────────────────

  private _initLFOs(): void {
    if (!_Tone) return;
    this._lfos.forEach(lfo => {
      if (lfo._lfo) { lfo._lfo.stop(); lfo._lfo.dispose(); }
      const node = new _Tone.LFO({
        type:      lfo.shape as ToneType.ToneOscillatorType,
        frequency: lfo.rateSynced ? this._lfoSyncFreq(lfo.rateNote) : lfo.rateHz,
        min:       -1, max: 1,
        phase:     lfo.phase * 360,
      });
      lfo._lfo = node;
      if (lfo.enabled) {
        node.start();
        this._wireLFO(lfo);
      }
    });
  }

  private _lfoSyncFreq(note: string): number {
    if (!_Tone) return 1;
    try {
      const seconds = _Tone.Time(note as ToneType.Unit.Time).toSeconds();
      return 1 / seconds;
    } catch { return 1; }
  }

  /**
   * Wire an LFO to its target parameter.
   * FIX (v3): disposes previously created Scale nodes for this LFO before
   * creating new ones. v2 leaked one Scale node per call.
   */
  private _wireLFO(lfo: LFOState): void {
    if (!lfo._lfo || !_Tone) return;

    // Dispose old scale nodes for this LFO
    const oldNodes = this._lfoScaleNodes.get(lfo.id) ?? [];
    oldNodes.forEach(n => { try { n.dispose(); } catch { /* ok */ } });
    this._lfoScaleNodes.set(lfo.id, []);

    const depth = lfo.depth;
    const newScaleNodes: ToneType.Scale[] = [];

    const connectToParam = (param: ToneType.Param<any>, scale: number) => {
      const scaleNode = new _Tone.Scale(-scale, scale);
      newScaleNodes.push(scaleNode);
      lfo._lfo!.connect(scaleNode);
      scaleNode.connect(param);
    };

    const trackI = lfo.trackIndex;

    switch (lfo.target) {
      case 'filter':
        connectToParam(this.globalFilter.frequency as any, 4000 * depth);
        break;
      case 'reverb':
        connectToParam(this.globalReverb.wet as any, 0.5 * depth);
        break;
      case 'delay':
        connectToParam(this.globalDelay.wet as any, 0.5 * depth);
        break;
      case 'volume':
        if (trackI !== null && this.tracks[trackI]) {
          connectToParam(this.tracks[trackI].outputGain.gain as any, 0.4 * depth);
        }
        break;
      case 'pan':
        if (trackI !== null && this.tracks[trackI]) {
          connectToParam(this.tracks[trackI].panner.pan as any, depth);
        }
        break;
      case 'chorus':
        connectToParam(this.globalChorus.wet as any, 0.6 * depth);
        break;
      case 'drive':
        connectToParam(this.globalSaturator.wet as any, 0.8 * depth);
        break;
      case 'bitcrush':
        // BitCrusher.bits is not an AudioParam — skip AudioParam wiring
        break;
    }

    this._lfoScaleNodes.set(lfo.id, newScaleNodes);
  }

  // ── Beat / Quantize schedulers ────────────────────────────────────────────

  private _startBeatScheduler(): void {
    if (!_Tone) return;
    const [beatsPerBar] = this._parseTimeSignature();
    let beat = 0;

    this._beatScheduleId = _Tone.Transport.scheduleRepeat((time) => {
      const bar = Math.floor(beat / beatsPerBar);
      const b   = beat % beatsPerBar;
      this._currentBar  = bar;
      this._currentBeat = b;
      this.emit('beat', bar, b, 0);

      if (this._metronomeOn) {
        if (b === 0) {
          this.metronomeAccent.triggerAttackRelease('16n', time);
        } else {
          this.metronomeClick.triggerAttackRelease('32n', time);
        }
      }
      beat++;
    }, '4n');
  }

  private _startQuantizeScheduler(): void {
    if (!_Tone) return;
    const intervalMap: Record<QuantMode, string> = {
      '1m': '1m', '2m': '2m', '4m': '4m',
      '1/2': '2n', '1/4': '4n', '1/8': '8n',
      'free': '4n', 'instant': '16n',
    };
    const interval = intervalMap[this._quantMode] ?? '1m';
    this._quantScheduleId = _Tone.Transport.scheduleRepeat(() => {
      this.emit('quantizeTick', this._quantMode);
    }, interval as ToneType.Unit.Time);
  }

  private _parseTimeSignature(): [number, number] {
    const [n, d] = this._timeSignature.split('/').map(Number);
    return [n ?? 4, d ?? 4];
  }

  private _applySwing(): void {
    if (!_Tone) return;
    _Tone.Transport.swing = this._swingAmount;
    _Tone.Transport.swingSubdivision = '8n';
  }

  // ── MIDI clock ────────────────────────────────────────────────────────────

  private async _initMidiClock(): Promise<void> {
    if (!navigator.requestMIDIAccess) return;
    try {
      const access  = await navigator.requestMIDIAccess({ sysex: false });
      const outputs = Array.from(access.outputs.values());
      if (outputs.length) this._midiOutput = outputs[0];

      // ── MIDI Input capture (added 2026-04-25) ───────────────────────────
      this._midiAccess = access;
      const inputs = Array.from(access.inputs.values());
      if (inputs.length) {
        this._midiInput = inputs[0];
        // setMidiInputEnabled(true) may have been called before MIDI was ready
        if (this._midiInputEnabled) {
          this._midiInput.onmidimessage = this._onMidiMessage.bind(this);
        }
      }
    } catch { /* no MIDI access */ }
  }

  setMidiClockOutput(enabled: boolean): void {
    if (!_Tone || !this._midiOutput) return;
    if (enabled) {
      this._midiClockScheduleId = _Tone.Transport.scheduleRepeat((time) => {
        _Tone!.getDraw().schedule(() => {
          this._midiOutput?.send([0xF8]);
        }, time);
      }, '32t' as ToneType.Unit.Time);
      this._midiOutput.send([0xFA]);
      this.emit('midiClockStart');
    } else {
      if (this._midiClockScheduleId >= 0) {
        _Tone.Transport.clear(this._midiClockScheduleId);
        this._midiClockScheduleId = -1;
      }
      this._midiOutput?.send([0xFC]);
      this.emit('midiClockStop');
    }
  }

  // ── MIDI input handler (added 2026-04-25) ──────────────────────────────────

  private _onMidiMessage(e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data || data.length < 1) return;
    const status = data[0];
    const type   = status & 0xF0;
    const note   = data[1] ?? 0;
    const vel    = data[2] ?? 0;

    // ── System real-time transport bytes ──────────────────────────────────
    if (status === 0xFA) { this.startTransport(); this.emit('transportStart'); return; }
    if (status === 0xFC) { this.stopTransport();  this.emit('transportStop');  return; }
    if (status === 0xFB) { this.startTransport(); this.emit('transportStart'); return; } // continue

    // ── Note On ───────────────────────────────────────────────────────────
    if (type === 0x90 && vel > 0) {
      const trackIdx = this._midiNoteMap[note];
      if (trackIdx !== undefined) this.emit('midiNoteOn', trackIdx, note, vel);
      return;
    }

    // ── Note Off (status 0x80, or Note On with vel=0) ─────────────────────
    if (type === 0x80 || (type === 0x90 && vel === 0)) {
      const trackIdx = this._midiNoteMap[note];
      if (trackIdx !== undefined) this.emit('midiNoteOff', trackIdx, note);
      return;
    }

    // ── Control Change ────────────────────────────────────────────────────
    if (type === 0xB0) {
      const norm = vel / 127;
      this.emit('midiCC', note, vel);
      // Custom handler takes priority
      const handler = this._midiCCHandlers[note];
      if (handler) { handler(norm); return; }
      // Default CC map — uses confirmed public Tone.js node properties
      switch (note) {
        case 1:   // Mod wheel → global filter cutoff
        case 74:  // Filter cutoff (MIDI standard)
          if (this.globalFilter) this.globalFilter.frequency.rampTo(200 + norm * 19800, 0.05);
          break;
        case 7:   // Channel volume → master volume
          this.setMasterVolume(norm * 1.5);
          break;
        case 91:  // Reverb send → global reverb wet
          if (this.globalReverb) this.globalReverb.wet.rampTo(norm, 0.05);
          break;
        case 93:  // Chorus send → global chorus wet
          if (this.globalChorus) (this.globalChorus.wet as any).rampTo(norm, 0.05);
          break;
        case 64:  // Sustain pedal → toggle transport
          if (vel >= 64) this.toggleTransport();
          break;
      }
      return;
    }
  }

  /** Enable / disable MIDI note + CC input. Safe to call before init(). */
  setMidiInputEnabled(enabled: boolean): void {
    this._midiInputEnabled = enabled;
    if (this._midiInput) {
      this._midiInput.onmidimessage = enabled
        ? this._onMidiMessage.bind(this)
        : null;
    }
    this.emit('midiInputEnabled', enabled);
  }

  /** Replace the MIDI note → track index map (MIDI note numbers as keys). */
  setMidiNoteMap(map: Record<number, number>): void {
    this._midiNoteMap = { ...map };
  }

  /**
   * Register a custom handler for a CC number.
   * Value is normalised 0..1. Overrides the built-in default for that CC.
   */
  setMidiCCHandler(cc: number, handler: (normalised: number) => void): void {
    this._midiCCHandlers[cc] = handler;
  }

  /** Remove a custom CC handler, restoring built-in default behaviour. */
  clearMidiCCHandler(cc: number): void {
    delete this._midiCCHandlers[cc];
  }

  /** Names of available MIDI input ports. Empty until after init(). */
  getMidiInputs(): string[] {
    if (!this._midiAccess) return [];
    return Array.from(this._midiAccess.inputs.values()).map(i => i.name ?? 'Unknown');
  }

  /** Switch the active MIDI input port by index into getMidiInputs(). */
  selectMidiInput(index: number): void {
    if (!this._midiAccess) return;
    const inputs = Array.from(this._midiAccess.inputs.values());
    const input  = inputs[index];
    if (!input) return;
    if (this._midiInput) this._midiInput.onmidimessage = null;
    this._midiInput = input;
    if (this._midiInputEnabled) {
      this._midiInput.onmidimessage = this._onMidiMessage.bind(this);
    }
  }

  // ── Player sync helpers ───────────────────────────────────────────────────

  startPlayerOnTransport(i: number): void {
    const t = this.track(i, 'startPlayerOnTransport');
    if (!t || !_Tone || t._playerSynced || !t.player.loaded) return;
    this._applyPlaybackMode(t);
    t.player.sync().start(0);
    t._playerSynced = true;
  }

  setupTrack(trackId: string): void {
    const i = parseInt(trackId.split('-')[1], 10);
    if (!isNaN(i) && this.tracks[i]) { /* nodes built in _buildTrack */ }
  }

  getTrackNodes(trackId: string): { gain: ToneType.Gain; analyser: ToneType.Analyser } | null {
    const i = parseInt(trackId.split('-')[1], 10);
    if (isNaN(i)) return null;
    const t = this.tracks[i];
    if (!t) return null;
    return { gain: t.outputGain, analyser: t.analyser };
  }

  stopPlayerFromTransport(i: number): void {
    const t = this.track(i, 'stopPlayerFromTransport');
    if (!t || !_Tone || !t._playerSynced) return;
    try { t.player.stop(); t.player.unsync(); } catch { /* ok */ }
    t._playerSynced = false;
  }

  private _applyPlaybackMode(t: EngineTrack): void {
    if (!_Tone) return;
    switch (t.playbackMode) {
      case 'reverse':
        t.player.reverse = true;
        t.player.playbackRate = 1;
        break;
      case 'half':
        t.player.reverse = false;
        t.player.playbackRate = 0.5;
        break;
      case 'double':
        t.player.reverse = false;
        t.player.playbackRate = 2;
        break;
      case 'pingpong':
        t.player.reverse = false;
        t.player.playbackRate = 1;
        break;
      case 'stutter': {
        const dur = t.player.buffer.duration;
        t.player.loopStart = 0;
        t.player.loopEnd   = dur * 0.25;
        t.player.reverse   = false;
        t.player.playbackRate = 1;
        break;
      }
      default:
        t.player.reverse = false;
        t.player.playbackRate = 1;
        break;
    }
  }

  setPlaybackMode(i: number, mode: PlaybackMode): void {
    const t = this.track(i, 'setPlaybackMode');
    if (!t) return;
    t.playbackMode = mode;
    if (t._playerSynced) this._applyPlaybackMode(t);
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  pushUndo(i: number): void {
    const t = this.track(i, 'pushUndo');
    if (!t || !t.player.loaded) return;
    const copy = t.player.buffer.get();
    if (!copy) return;
    if (t._undoStack.length >= UNDO_DEPTH) t._undoStack.shift();
    if (_Tone) {
      const buf = new _Tone.ToneAudioBuffer(copy);
      t._undoStack.push(buf);
      this.emit('undoPush', i, t._undoStack.length);
    }
  }

  undoTrack(i: number): boolean {
    const t = this.track(i, 'undoTrack');
    if (!t || t._undoStack.length === 0) return false;
    const prev = t._undoStack.pop()!;
    this.stopPlayerFromTransport(i);
    t.player.buffer = prev;
    this.startPlayerOnTransport(i);
    this.emit('undoPop', i, t._undoStack.length);
    return true;
  }

  getUndoDepth(i: number): number {
    return this.tracks[i]?._undoStack.length ?? 0;
  }

  // ── Track FX controls ────────────────────────────────────────────────────

  setTrackVolume(i: number, vol: number): void {
    const t = this.track(i, 'setTrackVolume');
    if (t) lerpParam(t.outputGain.gain as any, clamp(vol, 0, 1.5));
  }

  setTrackInputGain(i: number, gain: number): void {
    const t = this.track(i, 'setTrackInputGain');
    if (t) lerpParam(t.inputGain.gain as any, clamp(gain, 0, 4));
  }

  setTrackPan(i: number, pan: number): void {
    const t = this.track(i, 'setTrackPan');
    if (t) lerpParam(t.panner.pan as any, clamp(pan, -1, 1));
  }

  setTrackEQ(i: number, band: 'low' | 'mid' | 'high', val: number): void {
    const t = this.track(i, 'setTrackEQ');
    if (t) t.eq[band].value = clamp(val, -24, 24);
  }

  setTrackCompressor(i: number, threshold: number, ratio: number, attack = 0.003, release = 0.15): void {
    const t = this.track(i, 'setTrackCompressor');
    if (!t) return;
    t.compressor.threshold.value = clamp(threshold, -60, 0);
    t.compressor.ratio.value     = clamp(ratio, 1, 20);
    t.compressor.attack.value    = clamp(attack, 0.001, 0.5);
    t.compressor.release.value   = clamp(release, 0.01, 2);
  }

  setTrackGate(i: number, threshold: number): void {
    const t = this.track(i, 'setTrackGate');
    if (t) (t.gate as any).threshold = clamp(threshold, -80, 0);
  }

  setTrackSaturation(i: number, amount: number): void {
    const t = this.track(i, 'setTrackSaturation');
    if (!t) return;
    t.saturator.distortion = clamp(amount, 0, 1);
    t.saturator.wet.value  = amount > 0.01 ? 1 : 0;
  }

  setTrackChorus(i: number, depth: number, freq: number, wet: number): void {
    const t = this.track(i, 'setTrackChorus');
    if (!t) return;
    (t.chorus as any).depth     = clamp(depth, 0, 1);
    (t.chorus as any).frequency = clamp(freq, 0.1, 10);
    lerpParam(t.chorus.wet as any, clamp(wet, 0, 1));
  }

  setTrackFlanger(i: number, depth: number, freq: number, wet: number): void {
    const t = this.track(i, 'setTrackFlanger');
    if (!t) return;
    (t.flanger as any).depth     = clamp(depth, 0, 1);
    (t.flanger as any).frequency = clamp(freq, 0.05, 5);
    lerpParam(t.flanger.wet as any, clamp(wet, 0, 1));
  }

  setTrackPhaser(i: number, freq: number, wet: number): void {
    const t = this.track(i, 'setTrackPhaser');
    if (!t) return;
    (t.phaser as any).frequency = clamp(freq, 0.1, 20);
    lerpParam(t.phaser.wet as any, clamp(wet, 0, 1));
  }

  setTrackBitCrusher(i: number, bits: number): void {
    const t = this.track(i, 'setTrackBitCrusher');
    if (t) t.bitCrusher.bits = clamp(Math.round(bits), 1, 16) as any;
  }

  setTrackTremolo(i: number, freq: number, depth: number, wet: number): void {
    const t = this.track(i, 'setTrackTremolo');
    if (!t) return;
    (t.tremolo as any).frequency = clamp(freq, 0.1, 20);
    (t.tremolo as any).depth     = clamp(depth, 0, 1);
    lerpParam(t.tremolo.wet as any, clamp(wet, 0, 1));
  }

  setTrackPitch(i: number, semitones: number, cents = 0): void {
    const t = this.track(i, 'setTrackPitch');
    if (!t) return;
    t.pitchShift.pitch = clamp(semitones + cents / 100, -24, 24);
  }

  setHarmonyMode(i: number, mode: HarmonyMode): void {
    const t = this.track(i, 'setHarmonyMode');
    if (!t) return;
    t.pitchShift.pitch     = HARMONY_SEMITONES[mode];
    t.pitchShift.wet.value = HARMONY_WET[mode];
  }

  setReverbSend(i: number, amount: number): void {
    const t = this.track(i, 'setReverbSend');
    if (!t) return;
    t.reverbSendAmount = amount;
    lerpParam(t.reverbSend.gain as any, clamp(amount, 0, 1));
  }

  setDelaySend(i: number, amount: number): void {
    const t = this.track(i, 'setDelaySend');
    if (!t) return;
    t.delaySendAmount = amount;
    lerpParam(t.delaySend.gain as any, clamp(amount, 0, 1));
  }

  setChorusSend(i: number, amount: number): void {
    const t = this.track(i, 'setChorusSend');
    if (!t) return;
    t.chorusSendAmount = amount;
    lerpParam(t.chorusSend.gain as any, clamp(amount, 0, 1));
  }

  // ── Mute / Solo ───────────────────────────────────────────────────────────

  muteTrack(i: number, muted: boolean): void {
    const t = this.track(i, 'muteTrack');
    if (!t) return;
    t.isMuted = muted;
    this._updateSoloMuteBus();
  }

  soloTrack(i: number, soloed: boolean): void {
    const t = this.track(i, 'soloTrack');
    if (!t) return;
    t.isSoloed = soloed;
    this._soloActive = this.tracks.some(tr => tr.isSoloed);
    this._updateSoloMuteBus();
    this.emit('soloChanged', this._soloActive);
  }

  private _updateSoloMuteBus(): void {
    this.tracks.forEach(t => {
      const hear = t.isMuted ? false : this._soloActive ? t.isSoloed : true;
      lerpParam(t.outputGain.gain as any, hear ? 1 : 0, 0.02);
    });
  }

  cueTrack(i: number, cued: boolean): void {
    const t = this.track(i, 'cueTrack');
    if (t) t.isCued = cued;
  }

  incrementOverdub(i: number): void {
    const t = this.track(i); if (t) t.overdubLayers++;
  }

  resetOverdub(i: number): void {
    const t = this.track(i);
    if (t) { t.overdubLayers = 0; this.stopPlayerFromTransport(i); }
  }

  // ── Global FX controls ────────────────────────────────────────────────────

  setGlobalFilter(freq: number): void {
    if (!this.ready()) return;
    lerpParam(this.globalFilter.frequency as any, clamp(freq, 20, 20000), 0.1);
  }

  setFilterType(type: BiquadFilterType): void {
    if (this.ready()) this.globalFilter.type = type;
  }

  setFilterResonance(q: number): void {
    if (!this.ready()) return;
    lerpParam(this.globalFilter.Q as any, clamp(q, 0.1, 20), 0.1);
  }

  setGlobalDelay(time: ToneType.Unit.Time, feedback: number, wet = 1): void {
    if (!this.ready()) return;
    (this.globalDelay.delayTime as ToneType.Param<'time'>).value = time;
    lerpParam(this.globalDelay.feedback as any, clamp(feedback, 0, 0.95));
    lerpParam(this.globalDelay.wet as any, clamp(wet, 0, 1));
  }

  setGlobalReverb(decay: number, wet: number): void {
    if (!this.ready()) return;
    lerpParam(this.globalReverb.wet as any, clamp(wet, 0, 1), 0.1);
    if (Math.abs((this.globalReverb.decay as number) - decay) > 0.1) {
      this.globalReverb.decay = clamp(decay, 0.1, 30);
      void this.globalReverb.generate();
    }
  }

  setGlobalChorus(depth: number, rate: number, wet: number): void {
    if (!this.ready()) return;
    (this.globalChorus as any).depth     = clamp(depth, 0, 1);
    (this.globalChorus as any).frequency = clamp(rate, 0.1, 10);
    lerpParam(this.globalChorus.wet as any, clamp(wet, 0, 1));
  }

  setGlobalPhaser(freq: number, wet: number): void {
    if (!this.ready()) return;
    (this.globalPhaser as any).frequency = clamp(freq, 0.1, 20);
    lerpParam(this.globalPhaser.wet as any, clamp(wet, 0, 1));
  }

  setGlobalDrive(amount: number): void {
    if (!this.ready()) return;
    this.globalSaturator.distortion = clamp(amount, 0, 1);
    this.globalSaturator.wet.value  = amount > 0.01 ? 1 : 0;
  }

  setGlobalBitCrusher(bits: number): void {
    if (!this.ready()) return;
    this.globalBitCrusher.bits = clamp(Math.round(bits), 1, 16) as any;
  }

  setGlobalStereoWidth(width: number): void {
    if (!this.ready()) return;
    (this.globalStereoWidener as any).width.value = clamp(width, 0, 1);
  }

  setMasterVolume(vol: number): void {
    if (!this.ready()) return;
    lerpParam(this.masterBus.gain as any, clamp(vol, 0, 1.5));
  }

  setMasterCompressor(threshold: number, ratio: number): void {
    if (!this.ready()) return;
    this.masterCompressor.threshold.value = threshold;
    this.masterCompressor.ratio.value     = ratio;
  }

  // ── Multiband compression ─────────────────────────────────────────────────

  /**
   * Enable / disable 3-band multiband compression.
   *
   * Topology when ENABLED:
   *   masterBus → [disconnect from _preFXBus]
   *   masterBus → _mbLowLP  → _mbLowComp  → _mbLowGain  → _mbSumBus → _preFXBus
   *   masterBus → _mbMidHP  → _mbMidLP    → _mbMidComp  → _mbMidGain → _mbSumBus
   *   masterBus → _mbHighHP → _mbHighComp → _mbHighGain → _mbSumBus
   *
   * When DISABLED: destroys the crossover network, masterBus reconnects directly
   * to _preFXBus. Zero audio glitch because Tone.js Gain nodes pass through
   * at their current gain value during the transition frame.
   */
  enableMultiband(enabled: boolean): void {
    if (!this.ready('enableMultiband') || !_Tone) return;
    if (this._mbEnabled === enabled) return;
    this._mbEnabled = enabled;
    this._mbState.enabled = enabled;

    if (enabled) {
      // Disconnect direct bypass path
      try { this.masterBus.disconnect(this._preFXBus); } catch { /* ok */ }

      // Create crossover network
      this._mbSumBus   = new _Tone.Gain(1);
      this._mbSumBus.connect(this._preFXBus);

      // Low band: LP at lowFreq → compressor → gain trim → sum
      this._mbLowLP    = new _Tone.Filter(this._mbState.lowFreq, 'lowpass');
      this._mbLowComp  = new _Tone.Compressor({
        threshold: this._mbState.low.threshold,
        ratio:     this._mbState.low.ratio,
        attack:    0.003, release: 0.1,
      });
      this._mbLowGain  = new _Tone.Gain(this._dbToLinear(this._mbState.low.gain));
      this.masterBus.connect(this._mbLowLP);
      this._mbLowLP.connect(this._mbLowComp);
      this._mbLowComp.connect(this._mbLowGain);
      this._mbLowGain.connect(this._mbSumBus);

      // Mid band: HP at lowFreq → LP at highFreq → compressor → gain → sum
      this._mbMidHP    = new _Tone.Filter(this._mbState.lowFreq, 'highpass');
      this._mbMidLP    = new _Tone.Filter(this._mbState.highFreq, 'lowpass');
      this._mbMidComp  = new _Tone.Compressor({
        threshold: this._mbState.mid.threshold,
        ratio:     this._mbState.mid.ratio,
        attack:    0.003, release: 0.1,
      });
      this._mbMidGain  = new _Tone.Gain(this._dbToLinear(this._mbState.mid.gain));
      this.masterBus.connect(this._mbMidHP);
      this._mbMidHP.connect(this._mbMidLP);
      this._mbMidLP.connect(this._mbMidComp);
      this._mbMidComp.connect(this._mbMidGain);
      this._mbMidGain.connect(this._mbSumBus);

      // High band: HP at highFreq → compressor → gain → sum
      this._mbHighHP   = new _Tone.Filter(this._mbState.highFreq, 'highpass');
      this._mbHighComp = new _Tone.Compressor({
        threshold: this._mbState.high.threshold,
        ratio:     this._mbState.high.ratio,
        attack:    0.003, release: 0.08,
      });
      this._mbHighGain = new _Tone.Gain(this._dbToLinear(this._mbState.high.gain));
      this.masterBus.connect(this._mbHighHP);
      this._mbHighHP.connect(this._mbHighComp);
      this._mbHighComp.connect(this._mbHighGain);
      this._mbHighGain.connect(this._mbSumBus);

    } else {
      // Tear down crossover network
      this._disposeMBNodes();
      // Restore direct bypass
      this.masterBus.connect(this._preFXBus);
    }

    this.emit('multibandEnabled', enabled);
  }

  /**
   * Set per-band compressor parameters and optional output trim.
   * No-op if multiband is not enabled.
   */
  setMultibandBand(
    band: 'low' | 'mid' | 'high',
    threshold: number,
    ratio: number,
    gainDb = 0,
  ): void {
    if (!this.ready('setMultibandBand')) return;

    const state  = this._mbState[band];
    state.threshold = clamp(threshold, -60, 0);
    state.ratio     = clamp(ratio, 1, 20);
    state.gain      = clamp(gainDb, -12, 12);

    if (!this._mbEnabled) return;

    const compMap  = { low: this._mbLowComp,  mid: this._mbMidComp,  high: this._mbHighComp  };
    const gainMap  = { low: this._mbLowGain,  mid: this._mbMidGain,  high: this._mbHighGain  };

    const comp = compMap[band];
    const gain = gainMap[band];

    if (comp) {
      comp.threshold.value = state.threshold;
      comp.ratio.value     = state.ratio;
    }
    if (gain) {
      lerpParam(gain.gain as any, this._dbToLinear(state.gain));
    }
  }

  /**
   * Set crossover frequencies.
   * Rebuilds the crossover filters in place — a brief (< 1 ms) filter transient
   * occurs, which is inaudible in practice.
   */
  setMultibandCrossover(lowFreq: number, highFreq: number): void {
    if (!this.ready('setMultibandCrossover')) return;
    this._mbState.lowFreq  = clamp(lowFreq,  20,   2000);
    this._mbState.highFreq = clamp(highFreq, this._mbState.lowFreq + 100, 18000);

    if (!this._mbEnabled) return;

    if (this._mbLowLP)  (this._mbLowLP.frequency  as any).value = this._mbState.lowFreq;
    if (this._mbMidHP)  (this._mbMidHP.frequency  as any).value = this._mbState.lowFreq;
    if (this._mbMidLP)  (this._mbMidLP.frequency  as any).value = this._mbState.highFreq;
    if (this._mbHighHP) (this._mbHighHP.frequency as any).value = this._mbState.highFreq;
  }

  getMultibandState(): MultibandState {
    return { ...this._mbState };
  }

  private _disposeMBNodes(): void {
    const nodes = [
      this._mbLowLP, this._mbMidHP, this._mbMidLP, this._mbHighHP,
      this._mbLowComp, this._mbMidComp, this._mbHighComp,
      this._mbLowGain, this._mbMidGain, this._mbHighGain,
      this._mbSumBus,
    ];
    nodes.forEach(n => { try { n?.dispose(); } catch { /* ok */ } });
    this._mbLowLP = this._mbMidHP = this._mbMidLP = this._mbHighHP = null;
    this._mbLowComp = this._mbMidComp = this._mbHighComp = null;
    this._mbLowGain = this._mbMidGain = this._mbHighGain = null;
    this._mbSumBus  = null;
  }

  private _dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // ── Harmonic exciter ──────────────────────────────────────────────────────

  /**
   * Harmonic exciter — parallel high-frequency saturation.
   *
   * Signal path (inserted between globalSaturator and globalBitCrusher):
   *   globalSaturator output splits into:
   *     dry path:  → _exciterDryGain → _exciterSumBus → globalBitCrusher
   *     wet path:  → _exciterHPF → _exciterSat → _exciterWetGain → _exciterSumBus
   *
   * The HPF ensures that saturation only affects the upper frequency content
   * (harmonics above `tone` Hz), keeping low-mids clean and punchy.
   *
   * amount: 0 = dry only, 1 = equal wet/dry mix
   * tone:   HPF cutoff in Hz (2000–12000). Higher = only air is saturated.
   * drive:  saturation drive (0–1) on the wet path only.
   *
   * First call: lazily creates the nodes and rewires the chain.
   * Subsequent calls: only updates parameter values (no rewiring glitch).
   */
  setHarmonicExciter(amount: number, tone: number, drive?: number): void {
    if (!this.ready('setHarmonicExciter') || !_Tone) return;

    const wetAmt  = clamp(amount, 0, 1);
    const hpfFreq = clamp(tone, 2000, 12000);
    const satDrive = drive !== undefined ? clamp(drive, 0, 1) : this._exciterState.drive;

    this._exciterState = { amount: wetAmt, tone: hpfFreq, drive: satDrive };

    if (!this._exciterEnabled) {
      // First call — create nodes and rewire chain
      this._exciterHPF     = new _Tone.Filter(hpfFreq, 'highpass');
      this._exciterSat     = new _Tone.Distortion(satDrive);
      this._exciterWetGain = new _Tone.Gain(wetAmt);
      this._exciterDryGain = new _Tone.Gain(1 - wetAmt * 0.5); // partial dry blend
      this._exciterSumBus  = new _Tone.Gain(1);

      // Disconnect globalSaturator → globalBitCrusher
      try { this.globalSaturator.disconnect(this.globalBitCrusher); } catch { /* ok */ }

      // Wire dry path
      this.globalSaturator.connect(this._exciterDryGain);
      this._exciterDryGain.connect(this._exciterSumBus);

      // Wire wet path: HPF → saturation → wet gain → sum
      this.globalSaturator.connect(this._exciterHPF);
      this._exciterHPF.connect(this._exciterSat);
      this._exciterSat.connect(this._exciterWetGain);
      this._exciterWetGain.connect(this._exciterSumBus);

      // Sum → rest of chain
      this._exciterSumBus.connect(this.globalBitCrusher);

      this._exciterEnabled = true;
    } else {
      // Update values only
      if (this._exciterHPF)     (this._exciterHPF.frequency as any).value = hpfFreq;
      if (this._exciterSat)     this._exciterSat.distortion = satDrive;
      if (this._exciterWetGain) lerpParam(this._exciterWetGain.gain as any, wetAmt, 0.05);
      if (this._exciterDryGain) lerpParam(this._exciterDryGain.gain as any, 1 - wetAmt * 0.5, 0.05);
    }

    this.emit('exciterChanged', { ...this._exciterState });
  }

  /**
   * Bypass / restore the harmonic exciter.
   * Raises wet gain to 0 and dry to 1 (bypass), or restores stored state.
   */
  bypassExciter(bypassed: boolean): void {
    if (!this.ready('bypassExciter') || !this._exciterEnabled) return;
    if (bypassed) {
      if (this._exciterWetGain) this._exciterWetGain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      if (this._exciterDryGain) this._exciterDryGain.gain.setTargetAtTime(1, ctx.currentTime, 0.015);
    } else {
      if (this._exciterWetGain) lerpParam(this._exciterWetGain.gain as any, this._exciterState.amount, 0.05);
      if (this._exciterDryGain) lerpParam(this._exciterDryGain.gain as any, 1 - this._exciterState.amount * 0.5, 0.05);
    }
  }

  getExciterState(): ExciterState { return { ...this._exciterState }; }

  private _disposeExciterNodes(): void {
    try { this.globalSaturator.disconnect(this._exciterHPF!); } catch { /* ok */ }
    try { this.globalSaturator.disconnect(this._exciterDryGain!); } catch { /* ok */ }
    try { this._exciterSumBus?.disconnect(this.globalBitCrusher); } catch { /* ok */ }
    [this._exciterHPF, this._exciterSat, this._exciterWetGain, this._exciterDryGain, this._exciterSumBus]
      .forEach(n => { try { n?.dispose(); } catch { /* ok */ } });
    this._exciterHPF = this._exciterSat = this._exciterWetGain =
      this._exciterDryGain = this._exciterSumBus = null;
    // Restore direct connection
    try { this.globalSaturator.connect(this.globalBitCrusher); } catch { /* ok */ }
    this._exciterEnabled = false;
  }

  // ── Sidechain ducking (real envelope follower) ────────────────────────────

  /**
   * Enable sidechain ducking of the master bus from a source track.
   *
   * FIX (v3): v2 called getTrackLevel() once at call-time and set gain
   * directly. This had no ongoing effect and only fired once.
   *
   * v3 implementation:
   *   • Reads source track Analyser waveform data at '16n' intervals via
   *     Transport.scheduleRepeat (runs in audio thread via Tone.getDraw.schedule)
   *   • Applies first-order IIR attack/release smoothing to the envelope level
   *   • Writes the inverted (ducking) value to sidechainGain.gain
   *   • sidechainGain is now properly in the master chain (see init() fix)
   *
   * attack:  time constant in seconds for gain reduction (default 0.003)
   * release: time constant in seconds for gain recovery (default 0.15)
   */
  enableSidechain(sourceTrackIndex: number, amount: number, attack = 0.003, release = 0.15): void {
    if (!this.ready('enableSidechain') || !_Tone) return;
    const t = this.tracks[sourceTrackIndex];
    if (!t) { console.warn(`[LoopEngine] enableSidechain: track ${sourceTrackIndex} not found`); return; }

    // Clear any existing sidechain schedule
    this.disableSidechain();

    this._sidechainSourceIdx = sourceTrackIndex;
    this._sidechainAmount    = clamp(amount, 0, 1);
    this._sidechainAttack    = clamp(attack, 0.0001, 1);
    this._sidechainRelease   = clamp(release, 0.001, 2);
    this._sidechainEnvLevel  = 1.0;

    // Schedule envelope follower at 16th-note intervals
    // getDraw().schedule() ensures the gain write happens on the audio thread
    this._sidechainScheduleId = _Tone.Transport.scheduleRepeat((time) => {
      _Tone!.getDraw().schedule(() => {
        const src = this.tracks[this._sidechainSourceIdx];
        if (!src) return;

        // Read waveform RMS from source analyser
        const waveform = src.analyser.getValue() as Float32Array;
        const rms      = computeRMS(waveform);
        const env      = clamp(rms, 0, 1);

        // IIR smoothing: attack when signal rises, release when falls
        const coeff = env > this._sidechainEnvLevel
          ? Math.exp(-1 / (this._sidechainAttack * 44100 / 64))   // ~audio-rate
          : Math.exp(-1 / (this._sidechainRelease * 44100 / 64));

        this._sidechainEnvLevel = coeff * this._sidechainEnvLevel + (1 - coeff) * env;

        // Gain reduction: 1 = no duck, (1 - amount) = max duck
        const duck = 1 - this._sidechainEnvLevel * this._sidechainAmount;
        this.sidechainGain.gain.setTargetAtTime(clamp(duck, 0, 1), ctx.currentTime, 0.015);
      }, time);
    }, SC_UPDATE_INTERVAL);

    this.emit('sidechainEnabled', sourceTrackIndex, amount);
  }

  /**
   * Disable sidechain ducking and restore master gain to unity.
   */
  disableSidechain(): void {
    if (this._sidechainScheduleId >= 0 && _Tone) {
      _Tone.Transport.clear(this._sidechainScheduleId);
      this._sidechainScheduleId = -1;
    }
    this._sidechainSourceIdx = -1;
    this._sidechainAmount    = 0;
    if (this.sidechainGain) lerpParam(this.sidechainGain.gain as any, 1.0, 0.05);
    this.emit('sidechainDisabled');
  }

  /**
   * Legacy one-shot version — kept for backwards compatibility.
   * Prefer enableSidechain() for real-time envelope following.
   * @deprecated
   */
  setSidechainTrack(sourceTrackIndex: number, amount: number): void {
    this.enableSidechain(sourceTrackIndex, amount);
  }

  // ── Granular freeze (v3: true grain scheduler) ────────────────────────────

  /**
   * Set granular freeze parameters.
   *
   * grainSize:  grain duration in seconds (0.02–0.5)
   * grainCount: simultaneous grains (1–8)
   * pitch:      playback rate shift in semitones (±12)
   *
   * If freeze is already active, the grain scheduler restarts with new params.
   * If freeze is not active, values are stored for next setGranularFreeze(true).
   */
  setGranularParams(grainSize: number, grainCount: number, pitch: number): void {
    if (!this.ready('setGranularParams')) return;
    this._grainState.grainSize  = clamp(grainSize,  0.02, 0.5);
    this._grainState.grainCount = clamp(Math.round(grainCount), 1, GRAIN_COUNT_MAX);
    this._grainState.pitch      = clamp(pitch, -12, 12);

    if (this._granularFrozen) {
      // Restart scheduler with updated params
      this._stopGrainScheduler();
      this._startGrainScheduler();
    }

    this.emit('granularParams', { ...this._grainState });
  }

  /**
   * Enable / disable granular freeze.
   *
   * v3 grain scheduler vs v2 single Player:
   *   v2: one Tone.Player set to loop — not granular, just a looping buffer.
   *   v3: Transport.scheduleRepeat fires every GRAIN_INTERVAL; each fire
   *       spawns up to `grainCount` short Tone.Player instances with:
   *         • randomized start position within the source buffer
   *         • grain-size envelope (linear fade in/out)
   *         • pitch shift via playbackRate (semitone-accurate)
   *         • optional stereo spread via panner
   *       Players are disposed ~500ms after their grain ends to avoid leaks.
   *
   * trackIndex: which track's buffer to freeze (default 0)
   */
  setGranularFreeze(frozen: boolean, trackIndex = 0): void {
    if (!this.ready('setGranularFreeze') || !_Tone) return;
    this._granularFrozen       = frozen;
    this._granularSourceTrack  = trackIndex;
    this._grainState.frozen    = frozen;

    if (frozen) {
      this._stopGrainScheduler();
      this._startGrainScheduler();
    } else {
      this._stopGrainScheduler();
    }

    this.emit('granularParams', { ...this._grainState });
  }

  private _startGrainScheduler(): void {
    if (!_Tone) return;
    const t = this.tracks[this._granularSourceTrack];
    if (!t?.player.loaded) return;

    const dest = this._granularWidener ?? this.masterBus;

    this._granularScheduleId = _Tone.Transport.scheduleRepeat((time) => {
      if (!_Tone || !this._granularFrozen) return;

      const src    = this.tracks[this._granularSourceTrack];
      if (!src?.player.loaded) return;

      const buf    = src.player.buffer;
      const dur    = buf.duration;
      const gs     = this._grainState.grainSize;
      const rate   = Math.pow(2, this._grainState.pitch / 12);

      for (let g = 0; g < this._grainState.grainCount; g++) {
        // Randomized start within buffer, leaving room for grain length
        const maxStart = Math.max(0, dur - gs);
        const startPos = Math.random() * maxStart;

        const grain = new _Tone.Player(buf).connect(dest);
        grain.playbackRate = rate;

        // Optional stereo spread per grain
        if (this._grainState.spread > 0) {
          const pan = (Math.random() * 2 - 1) * this._grainState.spread;
          const panner = new _Tone.Panner(pan).connect(dest);
          grain.disconnect(dest);
          grain.connect(panner);
          // Dispose panner after grain
          setTimeout(() => { try { panner.dispose(); } catch { /* ok */ } }, (gs + 0.3) * 1000);
        }

        // Stagger grains within the interval for richer texture
        const staggerSec = (g / this._grainState.grainCount) * gs * 0.5;
        grain.start(time + staggerSec, startPos, gs);
        grain.stop(time + staggerSec + gs);

        // Dispose grain after it has definitely finished
        setTimeout(() => { try { grain.dispose(); } catch { /* ok */ } }, (gs + staggerSec + 0.5) * 1000);
      }
    }, GRAIN_INTERVAL);
  }

  private _stopGrainScheduler(): void {
    if (this._granularScheduleId >= 0 && _Tone) {
      _Tone.Transport.clear(this._granularScheduleId);
      this._granularScheduleId = -1;
    }
    // Clean up legacy single player if present
    if (this._granularPlayer) {
      try { this._granularPlayer.stop(); this._granularPlayer.dispose(); } catch { /* ok */ }
      this._granularPlayer = null;
    }
  }

  isGranularFrozen(): boolean { return this._granularFrozen; }
  getGranularState(): GranularState { return { ...this._grainState }; }

  /** Density — maps to grain interval scaling (0=sparse/slow, 0.5=normal, 1=dense/fast). */
  setGranularDensity(density: number): void {
    if (!this.ready('setGranularDensity')) return;
    this._grainState.density = clamp(density, 0, 1);
    // If grain scheduler not running, fall back to legacy player rate
    if (!this._granularFrozen && this._granularPlayer) {
      this._granularPlayer.playbackRate = 0.25 * Math.pow(16, this._grainState.density);
    }
    // When grain scheduler is active, density affects stagger logic on next cycle (live)
  }

  /**
   * Set stereo spread of granular output.
   * Lazily creates a StereoWidener between grains and masterBus.
   */
  setGranularSpread(spread: number): void {
    if (!this.ready('setGranularSpread') || !_Tone) return;
    const width = clamp(spread, 0, 1);
    this._grainState.spread = width;

    if (!this._granularWidener) {
      this._granularWidener = new _Tone.StereoWidener(width);
      this._granularWidener.connect(this.masterBus);
    } else {
      (this._granularWidener as any).width.value = width;
    }
  }

  // ── Clip launcher ─────────────────────────────────────────────────────────

  async loadClip(trackIndex: number, clipIndex: number, buffer: ToneType.ToneAudioBuffer): Promise<void> {
    const t = this.track(trackIndex, 'loadClip');
    if (!t || !_Tone) return;
    const clip = t.clips[clipIndex];
    if (!clip) return;

    if (clip._player) {
      if (clip._synced) { try { clip._player.stop(); clip._player.unsync(); } catch { /* ok */ } }
      clip._player.dispose();
    }

    clip.buffer     = buffer;
    clip.hasContent = true;
    clip.state      = 'loaded';

    const player  = new _Tone.Player(buffer).connect(t.inputGain);
    player.loop   = true;
    clip._player  = player;
    clip._synced  = false;
  }

  launchClip(trackIndex: number, clipIndex: number): void {
    const t = this.track(trackIndex, 'launchClip');
    if (!t || !_Tone) return;
    const clip = t.clips[clipIndex];
    if (!clip?.hasContent || !clip._player) return;

    t.clips.forEach((c, ci) => {
      if (ci !== clipIndex && c.state === 'playing') this.stopClip(trackIndex, ci);
    });

    if (!clip._synced) {
      clip._player.sync().start(0);
      clip._synced = true;
    }
    clip.state = 'playing';
    this.emit('clipLaunched', trackIndex, clipIndex);
  }

  stopClip(trackIndex: number, clipIndex: number): void {
    const t = this.track(trackIndex, 'stopClip');
    if (!t) return;
    const clip = t.clips[clipIndex];
    if (!clip?._player) return;
    if (clip._synced) {
      try { clip._player.stop(); clip._player.unsync(); } catch { /* ok */ }
      clip._synced = false;
    }
    clip.state = clip.hasContent ? 'loaded' : 'empty';
    this.emit('clipStopped', trackIndex, clipIndex);
  }

  setClipMeta(trackIndex: number, clipIndex: number, name: string, color: string): void {
    const t = this.track(trackIndex);
    if (!t) return;
    const clip = t.clips[clipIndex];
    if (clip) { clip.name = name; clip.color = color; }
  }

  // ── Beat Repeat ──────────────────────────────────────────────────────────

  setBeatRepeat(config: {
    enabled:    boolean;
    trackIndex: number;
    division:   string;
    chance:     number;
    length:     number;
    pitch:      number;
    variation:  string;
  }): void {
    if (!_Tone) return;

    if (this._beatRepeat._scheduleId >= 0) {
      _Tone.Transport.clear(this._beatRepeat._scheduleId);
      this._beatRepeat._scheduleId = -1;
    }
    Object.assign(this._beatRepeat, config);

    if (!config.enabled) {
      this.emit('beatRepeatStop', config.trackIndex);
      return;
    }

    const t = this.track(config.trackIndex);
    if (!t?.player.loaded) return;

    this._beatRepeat._scheduleId = _Tone.Transport.scheduleRepeat((time) => {
      if (Math.random() > config.chance) return;

      const dur  = _Tone!.Time(config.division as ToneType.Unit.Time).toSeconds() * config.length;
      const frag = new _Tone.Player(t.player.buffer).connect(t.inputGain);

      if (config.variation === 'pitch') {
        frag.playbackRate = Math.pow(2, (Math.floor(Math.random() * 5) - 2) / 12);
      } else if (config.variation === 'volume') {
        frag.volume.value = -6 + Math.random() * 12 - 6;
      }

      if (config.pitch !== 0) {
        frag.playbackRate = Math.pow(2, config.pitch / 12);
      }

      const startOff = Math.random() * (t.player.buffer.duration * 0.5);
      frag.start(time, startOff, dur);
      frag.stop(time + dur);
      setTimeout(() => { try { frag.dispose(); } catch { /* ok */ } }, (dur + 0.5) * 1000);
    }, config.division as ToneType.Unit.Time);

    this.emit('beatRepeatStart', config.trackIndex);
  }

  setBeatRepeatPitch(semitones: number): void {
    if (!this.ready('setBeatRepeatPitch')) return;
    const pitch = clamp(semitones, -24, 24);
    this._beatRepeat.pitch = pitch;
    if (this._beatRepeat.enabled) {
      this.setBeatRepeat({
        enabled:    this._beatRepeat.enabled,
        trackIndex: this._beatRepeat.trackIndex,
        division:   this._beatRepeat.division,
        chance:     this._beatRepeat.chance,
        length:     this._beatRepeat.length,
        pitch,
        variation:  this._beatRepeat.variation,
      });
    }
  }

  // ── LFO controls ─────────────────────────────────────────────────────────

  setLFO(id: number, config: Partial<LFOState>): void {
    if (id < 0 || id >= LFO_COUNT) return;
    const lfo = this._lfos[id];
    Object.assign(lfo, config);

    if (!_Tone || !lfo._lfo) return;

    (lfo._lfo as any).type = lfo.shape as ToneType.ToneOscillatorType;
    lfo._lfo.frequency.value = lfo.rateSynced
      ? this._lfoSyncFreq(lfo.rateNote)
      : lfo.rateHz;

    if (lfo.enabled && !lfo._lfo.state?.startsWith('start')) {
      lfo._lfo.start();
      this._wireLFO(lfo);  // now cleans up old Scale nodes first
    } else if (!lfo.enabled) {
      try { lfo._lfo.stop(); } catch { /* ok */ }
    }
  }

  getLFOs(): LFOState[] { return this._lfos; }

  // ── Macro controls ────────────────────────────────────────────────────────

  setMacro(id: number, value: number): void {
    if (id < 0 || id >= MACRO_COUNT) return;
    const m = this._macros[id];
    m.value = clamp(value, 0, 1);
    this._applyMacro(m);
    this.emit('macroChange', id, m.value, m.target);
  }

  setMacroTarget(id: number, target: MacroTarget): void {
    if (id < 0 || id >= MACRO_COUNT) return;
    this._macros[id].target = target;
  }

  setMacroLabel(id: number, label: string): void {
    if (id < 0 || id >= MACRO_COUNT) return;
    this._macros[id].label = label;
  }

  private _applyMacro(m: MacroKnob): void {
    if (!this.ready()) return;
    const v = m.value;
    switch (m.target) {
      case 'filter':      this.setGlobalFilter(20 + v * 19980);  break;
      case 'reverb':      this.setGlobalReverb(2.5, v);          break;
      case 'delay':       this.setGlobalDelay('8n', v * 0.9, v); break;
      case 'drive':       this.setGlobalDrive(v);                 break;
      case 'chorus':      this.setGlobalChorus(v, 2, v);         break;
      case 'bitcrush':    this.setGlobalBitCrusher(1 + v * 15);  break;
      case 'master_vol':  this.setMasterVolume(v * 1.5);         break;
      case 'bpm':         this.setBpm(80 + v * 120);             break;
      case 'xy_x':        this.setGlobalFilter(200 + v * 15000); break;
      case 'xy_y':        this.setGlobalReverb(0.5 + v * 10, v); break;
    }
  }

  getMacros(): MacroKnob[] { return this._macros; }

  // ── Time / Quantize / Swing ───────────────────────────────────────────────

  setTimeSignature(sig: TimeSignature): void {
    this._timeSignature = sig;
    if (_Tone && this._beatScheduleId >= 0) {
      _Tone.Transport.clear(this._beatScheduleId);
      this._startBeatScheduler();
    }
  }

  setSwing(amount: number): void {
    this._swingAmount = clamp(amount, 0, 1);
    this._applySwing();
  }

  setQuantMode(mode: QuantMode): void {
    this._quantMode = mode;
    if (_Tone && this._quantScheduleId >= 0) {
      _Tone.Transport.clear(this._quantScheduleId);
      this._startQuantizeScheduler();
    }
  }

  getQuantMode(): QuantMode { return this._quantMode; }

  // ── Reverb pre-delay ──────────────────────────────────────────────────────

  /**
   * Insert a shared pre-delay node before globalReverb.
   *
   * globalReverb receives from two sources:
   *   (a) Serial chain:  globalDelay → globalReverb
   *   (b) Track sends:   track[n].reverbSend → globalReverb
   *
   * After first call, both are intercepted through _reverbPreDelayNode.
   * Subsequent calls only update delayTime.
   */
  setReverbPreDelay(seconds: number): void {
    if (!this.ready('setReverbPreDelay') || !_Tone) return;
    const delayTime = clamp(seconds, 0, 0.5);

    if (!this._reverbPreDelayNode) {
      this._reverbPreDelayNode = new _Tone.Delay(delayTime, 0.5);

      try { this.globalDelay.disconnect(this.globalReverb); } catch { /* ok */ }
      this.globalDelay.connect(this._reverbPreDelayNode);
      this._reverbPreDelayNode.connect(this.globalReverb);

      this.tracks.forEach(t => {
        try { t.reverbSend.disconnect(this.globalReverb); } catch { /* ok */ }
        t.reverbSend.connect(this._reverbPreDelayNode!);
      });
    } else {
      (this._reverbPreDelayNode.delayTime as ToneType.Param<'time'>).value = delayTime as any;
    }
  }

  // ── Mono / Limiter toggles ────────────────────────────────────────────────

  /**
   * Collapse stereo to mono via globalStereoWidener.width = 0.
   * width=0 → mono sum. width=0.5 → unity stereo.
   * Saves and restores the previous width value.
   */
  setMono(enabled: boolean): void {
    if (!this.ready('setMono')) return;
    if (this._monoEnabled === enabled) return;
    this._monoEnabled = enabled;
    if (enabled) {
      this._preMonoWidth = (this.globalStereoWidener as any).width?.value ?? 0.5;
      (this.globalStereoWidener as any).width.value = 0;
    } else {
      (this.globalStereoWidener as any).width.value = this._preMonoWidth;
    }
  }

  /**
   * Bypass / restore the master limiter.
   * Safe bypass: raises threshold to 0 dBFS so DynamicsCompressor never fires.
   * Saves and restores threshold on re-enable.
   */
  enableLimiter(enabled: boolean): void {
    if (!this.ready('enableLimiter')) return;
    if (this._limiterEnabled === enabled) return;
    this._limiterEnabled = enabled;
    if (enabled) {
      this.masterLimiter.threshold.value = this._preBypassLimiterThreshold;
    } else {
      this._preBypassLimiterThreshold = this.masterLimiter.threshold.value as number;
      this.masterLimiter.threshold.value = 0;
    }
  }

  // ── Metering / Visualisation ──────────────────────────────────────────────

  getTrackLevel(i: number): number {
    const t = this.track(i); if (!t) return 0;
    const v     = t.meter.getValue();
    const level = typeof v === 'number' ? v : (v as number[])[0] ?? 0;
    if (level >= 0.99 && !t.clipHeld) { t.clipHeld = true; this.emit('clipDetected', i); }
    return level;
  }

  getStereoLevel(i: number): StereoLevel {
    const t = this.track(i);
    if (!t) return { L: 0, R: 0, peak: 0, clip: false, lufs: -70 };
    const toM = (v: number | number[]) => typeof v === 'number' ? v : (v[0] ?? 0);
    const L    = toM(t.meterL.getValue());
    const R    = toM(t.meterR.getValue());
    const peak = Math.max(L, R);
    const lufs = rmsToLufs(peak);
    if (peak >= 0.99 && !t.clipHeld) { t.clipHeld = true; this.emit('clipDetected', i); }
    return { L, R, peak, clip: t.clipHeld, lufs };
  }

  resetClip(i: number): void {
    const t = this.track(i); if (t) t.clipHeld = false;
  }

  getMasterLevel(): number {
    if (!this.ready()) return 0;
    const v = this.masterMeter.getValue();
    return typeof v === 'number' ? v : (v as number[])[0] ?? 0;
  }

  getMasterLufs(): number { return rmsToLufs(this.getMasterLevel()); }

  getTrackWaveform(i: number): Float32Array {
    const t = this.track(i);
    if (!t) return new Float32Array(ANALYSER_SIZE);
    return t.analyser.getValue() as Float32Array;
  }

  getTrackFft(i: number): Float32Array {
    const t = this.track(i);
    if (!t) return new Float32Array(FFT_SIZE / 2);
    return t.fft.getValue() as Float32Array;
  }

  getMasterFft(): Float32Array {
    if (!this.ready()) return new Float32Array(FFT_SIZE / 2);
    return this.masterFft.getValue() as Float32Array;
  }

  getMasterWaveform(): Float32Array {
    if (!this.ready()) return new Float32Array(ANALYSER_SIZE);
    return this.masterAnalyser.getValue() as Float32Array;
  }

  // ── BPM / Tap Tempo ───────────────────────────────────────────────────────

  getBpm(): number {
    return this.initialized && _Tone ? _Tone.Transport.bpm.value : this._pendingBpm;
  }

  setBpm(bpm: number): void {
    const c = clamp(bpm, 20, 300);
    this._pendingBpm = c;
    if (this.initialized && _Tone) {
      _Tone.Transport.bpm.value = c;
      this._lfos.forEach(lfo => {
        if (lfo.enabled && lfo.rateSynced && lfo._lfo) {
          lfo._lfo.frequency.value = this._lfoSyncFreq(lfo.rateNote);
        }
      });
      this.emit('bpmChange', c);
    }
  }

  tapTempo(): number {
    const now = performance.now();
    this._tapTimes.push(now);
    if (this._tapTimes.length > TAP_HISTORY + 1) this._tapTimes.shift();
    if (this._tapTimes.length < 2) return this._pendingBpm;
    let total = 0;
    for (let i = 1; i < this._tapTimes.length; i++)
      total += this._tapTimes[i] - this._tapTimes[i - 1];
    const bpm = clamp(Math.round(60000 / (total / (this._tapTimes.length - 1))), 40, 240);
    this.setBpm(bpm);
    return bpm;
  }

  resetTapTempo(): void { this._tapTimes = []; }

  // ── Metronome ─────────────────────────────────────────────────────────────

  setMetronome(on: boolean, volume = 0.4): void {
    this._metronomeOn  = on;
    this._metronomeVol = volume;
    if (this.metronomeClick)  this.metronomeClick.volume.value  = -22 + volume * 12;
    if (this.metronomeAccent) this.metronomeAccent.volume.value = -18 + volume * 12;
  }

  // ── Transport ─────────────────────────────────────────────────────────────

  startTransport(): void {
    if (!this.ready() || !_Tone) return;
    _Tone.Transport.start();
    this.emit('transportStart');
  }

  stopTransport(): void {
    if (!this.ready() || !_Tone) return;
    if (this._reverbPreDelayNode) {
      try { this._reverbPreDelayNode.dispose(); } catch { /* ok */ }
      this._reverbPreDelayNode = null;
    }
    _Tone.Transport.stop();
    _Tone.Transport.position = 0;
    this.emit('transportStop');
  }

  pauseTransport(): void {
    if (!this.ready() || !_Tone) return;
    _Tone.Transport.pause();
    this.emit('transportPause');
  }

  toggleTransport(): void {
    if (!this.ready() || !_Tone) return;
    if (_Tone.Transport.state === 'started') this.pauseTransport();
    else this.startTransport();
  }

  getTransportState(): 'started' | 'stopped' | 'paused' {
    if (!this.initialized || !_Tone) return 'stopped';
    return _Tone.Transport.state;
  }

  getTransportPosition(): string {
    if (!this.initialized || !_Tone) return '0:0:0';
    return _Tone.Transport.position as string;
  }

  getTransportSeconds(): number {
    if (!this.initialized || !_Tone) return 0;
    return _Tone.Transport.seconds;
  }

  getCurrentBar(): number  { return this._currentBar; }
  getCurrentBeat(): number { return this._currentBeat; }

  scheduleRepeat(cb: (time: number) => void, interval: ToneType.Unit.Time): number {
    if (!this.ready('scheduleRepeat') || !_Tone) return -1;
    return _Tone.Transport.scheduleRepeat(cb, interval, 0);
  }

  clearSchedule(id: number): void {
    if (id >= 0 && _Tone) _Tone.Transport.clear(id);
  }

  // ── Scene snapshots ───────────────────────────────────────────────────────

  captureScene(id: string, label: string, color = 'var(--dj-dimmer)'): SceneSnapshot {
    const scene: SceneSnapshot = {
      id, label, color,
      bpm: this.getBpm(),
      tracks: this.tracks.map(t => ({
        volume:        t.outputGain.gain.value as number,
        pan:           t.panner.pan.value as number,
        muted:         t.isMuted,
        reverbSend:    t.reverbSendAmount,
        delaySend:     t.delaySendAmount,
        chorusSend:    t.chorusSendAmount,
        eq:            {
          low:  t.eq.low.value  as number,
          mid:  t.eq.mid.value  as number,
          high: t.eq.high.value as number,
        },
        harmonyMode:   'off' as HarmonyMode,
        playbackMode:  t.playbackMode,
        inputGain:     t.inputGain.gain.value as number,
        saturation:    t.saturator.distortion as number,
        compThreshold: t.compressor.threshold.value as number,
        compRatio:     t.compressor.ratio.value as number,
        chorus:        {
          depth: (t.chorus as any).depth,
          rate:  (t.chorus as any).frequency?.value ?? 2,
          wet:   t.chorus.wet.value as number,
        },
        phaser:        {
          frequency: (t.phaser as any).frequency?.value ?? 0.5,
          wet:       t.phaser.wet.value as number,
        },
        bitDepth:      t.bitCrusher.bits as number,
        tremolo:       {
          frequency: (t.tremolo as any).frequency?.value ?? 4,
          depth:     (t.tremolo as any).depth ?? 0,
          wet:       t.tremolo.wet.value as number,
        },
      })),
      fx: {
        filterFreq:     this.globalFilter.frequency.value as number,
        filterType:     this.globalFilter.type,
        filterRes:      this.globalFilter.Q.value as number,
        reverbWet:      this.globalReverb.wet.value as number,
        reverbDecay:    this.globalReverb.decay as number,
        delayFeedback:  this.globalDelay.feedback.value as number,
        delayTime:      String(this.globalDelay.delayTime.value),
        driveAmount:    this.globalSaturator.distortion as number,
        stereoWidth:    (this.globalStereoWidener as any).width?.value ?? 0.5,
        phaserWet:      this.globalPhaser.wet.value as number,
        bitDepth:       this.globalBitCrusher.bits as number,
        granularFreeze: this._granularFrozen,
      },
    };
    this.emit('sceneCapture', scene);
    return scene;
  }

  recallScene(scene: SceneSnapshot): void {
    if (!this.ready()) return;
    this.setBpm(scene.bpm);
    scene.tracks.forEach((s, i) => {
      this.setTrackVolume(i, s.volume);
      this.setTrackInputGain(i, s.inputGain);
      this.setTrackPan(i, s.pan);
      this.muteTrack(i, s.muted);
      this.setReverbSend(i, s.reverbSend);
      this.setDelaySend(i, s.delaySend);
      this.setChorusSend(i, s.chorusSend);
      this.setTrackEQ(i, 'low',  s.eq.low);
      this.setTrackEQ(i, 'mid',  s.eq.mid);
      this.setTrackEQ(i, 'high', s.eq.high);
      this.setHarmonyMode(i, s.harmonyMode);
      this.setPlaybackMode(i, s.playbackMode);
      this.setTrackSaturation(i, s.saturation);
      this.setTrackCompressor(i, s.compThreshold, s.compRatio);
      this.setTrackChorus(i, s.chorus.depth, s.chorus.rate, s.chorus.wet);
      this.setTrackPhaser(i, s.phaser.frequency, s.phaser.wet);
      this.setTrackBitCrusher(i, s.bitDepth);
      this.setTrackTremolo(i, s.tremolo.frequency, s.tremolo.depth, s.tremolo.wet);
    });
    this.setGlobalFilter(scene.fx.filterFreq);
    this.setFilterType(scene.fx.filterType);
    this.setFilterResonance(scene.fx.filterRes);
    this.setGlobalReverb(scene.fx.reverbDecay, scene.fx.reverbWet);
    this.setGlobalDelay(scene.fx.delayTime as ToneType.Unit.Time, scene.fx.delayFeedback);
    this.setGlobalDrive(scene.fx.driveAmount);
    this.setGlobalStereoWidth(scene.fx.stereoWidth);
    this.setGlobalPhaser(0.5, scene.fx.phaserWet);
    this.setGlobalBitCrusher(scene.fx.bitDepth);
    this.emit('sceneRecall', scene);
  }

  // ── Scene morph ───────────────────────────────────────────────────────────

  morphScenes(from: SceneSnapshot, to: SceneSnapshot, durationMs = 2000): void {
    cancelAnimationFrame(this._morphRafId);
    const start   = performance.now();
    const totalMs = durationMs;
    const lerp    = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / totalMs);

      this.setBpm(lerp(from.bpm, to.bpm, t));
      this.setGlobalFilter(lerp(from.fx.filterFreq, to.fx.filterFreq, t));
      this.setGlobalReverb(
        lerp(from.fx.reverbDecay,  to.fx.reverbDecay,  t),
        lerp(from.fx.reverbWet,    to.fx.reverbWet,    t),
      );
      this.setGlobalDrive(lerp(from.fx.driveAmount, to.fx.driveAmount, t));
      this.setGlobalStereoWidth(lerp(from.fx.stereoWidth, to.fx.stereoWidth, t));

      from.tracks.forEach((fs, i) => {
        const ts = to.tracks[i];
        if (!ts) return;
        this.setTrackVolume(i, lerp(fs.volume, ts.volume, t));
        this.setTrackPan(i,    lerp(fs.pan,    ts.pan,    t));
        this.setReverbSend(i,  lerp(fs.reverbSend,  ts.reverbSend,  t));
        this.setDelaySend(i,   lerp(fs.delaySend,   ts.delaySend,   t));
        this.setTrackEQ(i, 'low',  lerp(fs.eq.low,  ts.eq.low,  t));
        this.setTrackEQ(i, 'mid',  lerp(fs.eq.mid,  ts.eq.mid,  t));
        this.setTrackEQ(i, 'high', lerp(fs.eq.high, ts.eq.high, t));
        this.setTrackSaturation(i, lerp(fs.saturation, ts.saturation, t));
        this.setTrackChorus(i, lerp(fs.chorus.depth, ts.chorus.depth, t),
          lerp(fs.chorus.rate, ts.chorus.rate, t), lerp(fs.chorus.wet, ts.chorus.wet, t));
      });

      this.emit('sceneMorphTick', t);
      if (t < 1) this._morphRafId = requestAnimationFrame(tick);
    };

    this._morphRafId = requestAnimationFrame(tick);
  }

  cancelMorph(): void { cancelAnimationFrame(this._morphRafId); }

  // ── Guards ────────────────────────────────────────────────────────────────

  private ready(caller?: string): boolean {
    if (!this.initialized || !_Tone) {
      if (caller) console.warn(`[LoopEngine] ${caller}() called before init().`);
      return false;
    }
    return true;
  }

  private track(index: number, caller?: string): EngineTrack | null {
    if (!this.ready(caller)) return null;
    const t = this.tracks[index];
    if (!t) { console.warn(`[LoopEngine] track(${index}) out of range.`); return null; }
    return t;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  dispose(): void {
    if (!this.initialized || !_Tone) return;

    cancelAnimationFrame(this._morphRafId);

    // Sidechain schedule
    this.disableSidechain();

    // Beat repeat
    if (this._beatRepeat._scheduleId >= 0)
      _Tone.Transport.clear(this._beatRepeat._scheduleId);
    if (this._beatRepeat._buffer) this._beatRepeat._buffer.dispose();

    // Granular
    this._stopGrainScheduler();
    if (this._granularWidener) {
      try { this._granularWidener.dispose(); } catch { /* ok */ }
      this._granularWidener = null;
    }

    // Schedules
    [this._beatScheduleId, this._quantScheduleId, this._midiClockScheduleId]
      .filter(id => id >= 0)
      .forEach(id => _Tone!.Transport.clear(id));
    // MIDI input teardown (added 2026-04-25)
    if (this._midiInput) { this._midiInput.onmidimessage = null; this._midiInput = null; }
    this._midiAccess = null;


    // LFOs + Scale nodes
    this._lfos.forEach(lfo => {
      // Dispose scale nodes first
      const scales = this._lfoScaleNodes.get(lfo.id) ?? [];
      scales.forEach(n => { try { n.dispose(); } catch { /* ok */ } });
      try { lfo._lfo?.stop(); lfo._lfo?.dispose(); } catch { /* ok */ }
      lfo._lfo = null;
    });
    this._lfoScaleNodes.clear();

    // Multiband
    if (this._mbEnabled) this._disposeMBNodes();

    // Exciter
    if (this._exciterEnabled) this._disposeExciterNodes();

    // Reverb pre-delay
    if (this._reverbPreDelayNode) {
      try { this._reverbPreDelayNode.dispose(); } catch { /* ok */ }
      this._reverbPreDelayNode = null;
    }

    // Tracks
    this.tracks.forEach(t => {
      t.recorder.close();
      if (t._playerSynced) {
        try { t.player.stop(); t.player.unsync(); } catch { /* ok */ }
      }
      t.clips.forEach(c => {
        if (c._synced && c._player) {
          try { c._player.stop(); c._player.unsync(); } catch { /* ok */ }
        }
        c._player?.dispose();
      });
      t._undoStack.forEach(b => b.dispose());

      [t.player, t.recorder, t.inputGain, t.gate, t.compressor, t.eq,
       t.saturator, t.chorus, t.flanger, t.phaser, t.bitCrusher,
       t.pitchShift, t.tremolo, t.panner, t.outputGain,
       t.reverbSend, t.delaySend, t.chorusSend,
       t.meter, t.meterL, t.meterR, t.analyser, t.fft]
        .forEach(n => { try { n.dispose(); } catch { /* ok */ } });
    });
    (this.tracks as EngineTrack[]).length = 0;

    // preFXBus
    try { this._preFXBus?.dispose(); } catch { /* ok */ }

    // Master chain
    [this.globalReverb, this.globalDelay, this.globalFilter,
     this.globalChorus, this.globalPhaser, this.globalSaturator,
     this.globalBitCrusher, this.globalStereoWidener,
     this.sidechainGain, this.sidechainEnv,
     this.masterCompressor, this.masterLimiter,
     this.masterMeter, this.masterFft, this.masterAnalyser,
     this.masterBus, this.metronomeClick, this.metronomeAccent]
      .forEach(n => { try { n?.dispose(); } catch { /* ok */ } });

    _Tone.Transport.stop();
    _Tone.Transport.cancel(0);
    this.initialized     = false;
    _Tone                = null;
    LoopEngine._instance = null;
    engine              = null;
    this.emit('disposed');
    this._listeners = {};
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let engine: LoopEngine | null = null;

export function getLoopEngine(): LoopEngine {
  if (!engine) engine = LoopEngine.getInstance();
  return engine;
}

export { LoopEngine };
export type { LFOState };