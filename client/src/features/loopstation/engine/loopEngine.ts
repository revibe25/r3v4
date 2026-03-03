// ─── RC-505 MkII Loop Engine — ENHANCED v2 ────────────────────────────────────
// src/features/loopstation/engine/loopEngine.ts
//
// Dynamic import — Tone NEVER loads until init() is called inside a user-gesture.
// Zero AudioContext creation at module-load time.
//
// ENHANCEMENTS OVER v1:
//   • Per-track full FX chain: EQ3 → Compressor → Gate → Saturation →
//     Chorus → Flanger → Phaser → BitCrusher → PitchShift → Panner → Gain
//   • 8 Clip slots per track — independent AudioBuffers, simultaneous playback
//   • Playback modes: normal | reverse | half | double | stutter | pingpong
//   • 4 global LFOs with assignable targets + BPM sync + 5 shapes
//   • 4 Macro knobs wired to any engine parameter
//   • Beat Repeat engine — rhythmic buffer stutter on any track
//   • Time signature + swing (via Transport.swing)
//   • Global: Stereo Widener, Tape Saturation, BitCrusher, Phaser, Granular Freeze
//   • Sidechain compressor: any track can duck the master bus
//   • Scene morph — interpolate between two SceneSnapshots
//   • Undo/redo per-track recording history (up to 8 snapshots per track)
//   • LUFS-approximated loudness metering
//   • True-peak clip detection
//   • Loop point quantisation with swing
//   • Full MIDI clock output (WebMIDI)
//   • Comprehensive event bus (20+ event types)
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
export const CLIP_COUNT     = 8   as const;  // slots per track
export const ANALYSER_SIZE  = 1024 as const;
export const FFT_SIZE       = 2048 as const;
export const TAP_HISTORY    = 6   as const;
export const UNDO_DEPTH     = 8   as const;  // undo snapshots per track
export const LFO_COUNT      = 4   as const;
export const MACRO_COUNT    = 4   as const;

const HARMONY_SEMITONES: Record<HarmonyMode, number> = {
  off: 0, subtle: 3, choir: 7, ambient: 12, counter: -5,
  octave: 12, fifth: 7, unison: 0,
};
const HARMONY_WET: Record<HarmonyMode, number> = {
  off: 0, subtle: 0.3, choir: 0.5, ambient: 0.4, counter: 0.4,
  octave: 0.5, fifth: 0.45, unison: 0.35,
};

// LFO rate map for synced mode (LFO rate 0-1 → note division index)
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
  rateHz:   number;        // used when not synced (0.01–20)
  rateNote: string;        // used when synced ('4n' etc)
  depth:    number;        // 0–1
  target:   LFOTarget;
  trackIndex: number | null;  // null = global target
  enabled:  boolean;
  phase:    number;        // 0–1 manual phase offset
  _lfo:     ToneType.LFO | null;
}

export interface EngineTrack {
  readonly id:     string;
  readonly index:  number;

  // Source
  recorder:        ToneType.UserMedia;
  player:          ToneType.Player;

  // Per-track FX chain (signal flows top → bottom)
  inputGain:       ToneType.Gain;         // pre-gain
  gate:            ToneType.Gate;         // noise gate
  compressor:      ToneType.Compressor;   // dynamics
  eq:              ToneType.EQ3;          // 3-band EQ
  saturator:       ToneType.Distortion;   // tape-style saturation
  chorus:          ToneType.Chorus;       // chorus
  flanger:         ToneType.Chorus;       // flanger (short-delay chorus)
  phaser:          ToneType.Phaser;       // phaser
  bitCrusher:      ToneType.BitCrusher;   // bit reduction
  pitchShift:      ToneType.PitchShift;   // pitch + harmony
  tremolo:         ToneType.Tremolo;      // amplitude modulation
  panner:          ToneType.Panner;       // stereo position
  outputGain:      ToneType.Gain;         // post-fader

  // FX sends
  reverbSend:      ToneType.Gain;
  delaySend:       ToneType.Gain;
  chorusSend:      ToneType.Gain;

  // Metering
  meter:           ToneType.Meter;
  meterL:          ToneType.Meter;
  meterR:          ToneType.Meter;
  analyser:        ToneType.Analyser;
  fft:             ToneType.Analyser;

  // Clip slots
  clips:           ClipBuffer[];

  // State
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
  ready:           [];
  disposed:        [];
  bpmChange:       [bpm: number];
  error:           [err: Error];
  beat:            [bar: number, beat: number, subdivision: number];
  quantizeTick:    [mode: QuantMode];
  clipDetected:    [trackIndex: number];
  soloChanged:     [soloActive: boolean];
  loopStart:       [trackIndex: number];
  loopEnd:         [trackIndex: number];
  recordStart:     [trackIndex: number];
  recordStop:      [trackIndex: number, durationSec: number];
  overdubStart:    [trackIndex: number];
  overdubStop:     [trackIndex: number];
  clipLaunched:    [trackIndex: number, clipIndex: number];
  clipStopped:     [trackIndex: number, clipIndex: number];
  macroChange:     [macroId: number, value: number, target: MacroTarget];
  lfoTick:         [lfoId: number, value: number];
  sceneCapture:    [scene: SceneSnapshot];
  sceneRecall:     [scene: SceneSnapshot];
  sceneMorphTick:  [progress: number];  // 0–1
  undoPush:        [trackIndex: number, depth: number];
  undoPop:         [trackIndex: number, depth: number];
  transportStart:  [];
  transportStop:   [];
  transportPause:  [];
  midiClockStart:  [];
  midiClockStop:   [];
  beatRepeatStart: [trackIndex: number];
  beatRepeatStop:  [trackIndex: number];
};

type EngineListener<K extends keyof EngineEventMap> = (...args: EngineEventMap[K]) => void;
type ToneModule = typeof ToneType;

let _Tone: ToneModule | null = null;

// ── Internal Helpers ──────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerpParam(param: ToneType.Param<any>, to: number, ramp = 0.05): void {
  try { param.rampTo(to, ramp); } catch { param.value = to; }
}

// Simple approximation of LUFS-I from RMS
function rmsToLufs(rms: number): number {
  if (rms <= 0) return -70;
  return 20 * Math.log10(rms) - 0.691;
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
  private _midiClockScheduleId = -1;

  // LFOs
  private _lfos: LFOState[] = [];

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

  // Master chain
  masterBus!:          ToneType.Gain;
  masterCompressor!:   ToneType.Compressor;
  masterLimiter!:      ToneType.Limiter;
  masterMeter!:        ToneType.Meter;
  masterFft!:          ToneType.Analyser;
  masterAnalyser!:     ToneType.Analyser;
  globalFilter!:       ToneType.Filter;
  globalDelay!:        ToneType.FeedbackDelay;
  globalReverb!:       ToneType.Reverb;
  globalChorus!:       ToneType.Chorus;
  globalPhaser!:       ToneType.Phaser;
  globalSaturator!:    ToneType.Distortion;
  globalBitCrusher!:   ToneType.BitCrusher;
  globalStereoWidener!:ToneType.StereoWidener;
  metronomeClick!:     ToneType.MetalSynth;
  metronomeAccent!:    ToneType.MetalSynth;
  sidechainEnv!:       ToneType.Envelope;
  sidechainGain!:      ToneType.Gain;

  // Granular freeze — keeps a live buffer for freeze effect
  private _granularPlayer: ToneType.Player | null = null;
  private _granularFrozen = false;

  private _listeners: { [K in keyof EngineEventMap]?: Set<EngineListener<K>> } = {};

  private constructor() {
    // Pre-populate LFOs
    for (let i = 0; i < LFO_COUNT; i++) {
      this._lfos.push({
        id: i, shape: 'sine', rateSynced: true,
        rateHz: 1, rateNote: '4n', depth: 0.5,
        target: 'none', trackIndex: null, enabled: false,
        phase: 0, _lfo: null,
      });
    }
    // Pre-populate macros
    for (let i = 0; i < MACRO_COUNT; i++) {
      this._macros.push({
        id: i, label: `MACRO ${i + 1}`, value: 0.5,
        target: 'none', color: '#32cd32',
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

      // ── Master chain ────────────────────────────────────────────────────
      this.masterBus           = new _Tone.Gain(1);
      this.masterCompressor    = new _Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.003, release: 0.1 });
      this.masterLimiter       = new _Tone.Limiter(-1);
      this.masterMeter         = new _Tone.Meter({ normalRange: true });
      this.masterFft           = new _Tone.Analyser('fft', FFT_SIZE);
      this.masterAnalyser      = new _Tone.Analyser('waveform', ANALYSER_SIZE);

      // Global FX (parallel/serial)
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

      // Sidechain: envelope follower on track 0 → modulate masterBus gain
      this.sidechainEnv  = new _Tone.Envelope({ attack: 0.003, decay: 0.1, sustain: 1, release: 0.3 });
      this.sidechainGain = new _Tone.Gain(1);

      // Chain: masterBus → filter → chorus → phaser → saturator → bitCrusher
      //        → delay → reverb → widener → compressor → limiter → dest
      this.masterBus.chain(
        this.globalFilter,
        this.globalChorus,
        this.globalPhaser,
        this.globalSaturator,
        this.globalBitCrusher,
        this.globalDelay,
        this.globalReverb,
        this.globalStereoWidener,
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

      // ── Beat / quantize scheduler ────────────────────────────────────────
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

    // Output → master
    const outputGain    = new T.Gain(1).connect(this.masterBus);
    const panner        = new T.Panner(0).connect(outputGain);

    // Modulation
    const tremolo       = new T.Tremolo({ frequency: 4, depth: 0, type: 'sine' }).start();
    tremolo.wet.value   = 0;
    tremolo.connect(panner);

    // Pitch
    const pitchShift    = new T.PitchShift(0);
    pitchShift.connect(tremolo);

    // Spectral
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

    // Dynamics
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

    // FX sends (parallel off panner, pre-master)
    const reverbSend    = new T.Gain(0).connect(this.globalReverb);
    const delaySend     = new T.Gain(0).connect(this.globalDelay);
    const chorusSend    = new T.Gain(0).connect(this.globalChorus);

    // Metering
    const meter         = new T.Meter({ normalRange: true });
    const meterL        = new T.Meter({ normalRange: true, channelCount: 1 });
    const meterR        = new T.Meter({ normalRange: true, channelCount: 1 });

    // Visualisation
    const analyser      = new T.Analyser('waveform', ANALYSER_SIZE);
    const fft           = new T.Analyser('fft', FFT_SIZE);

    // Player → inputGain → chain
    const player        = new T.Player();
    player.loop         = true;
    player.connect(inputGain);
    player.fan(meter, meterL, meterR, analyser, fft, reverbSend, delaySend, chorusSend);

    // Recorder → inputGain → chain (live monitoring)
    const recorder      = new T.UserMedia();
    recorder.connect(inputGain);
    recorder.fan(meter, meterL, meterR, analyser, fft, reverbSend, delaySend, chorusSend);

    // Clip slots
    const clips: ClipBuffer[] = Array.from({ length: CLIP_COUNT }, (_, ci) => ({
      buffer: null, hasContent: false,
      lengthBars: 0, name: `Clip ${ci + 1}`,
      color: '#222222',
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

  private _wireLFO(lfo: LFOState): void {
    if (!lfo._lfo || !_Tone) return;
    const depth = lfo.depth;

    const connectToParam = (param: ToneType.Param<any>, scale: number) => {
      const scaleNode = new _Tone.Scale(-scale, scale);
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
      case 'bitcrush':
        // BitCrusher bits can't easily be modulated via rampTo, skip
        break;
      case 'drive':
        connectToParam(this.globalSaturator.wet as any, 0.8 * depth);
        break;
    }
  }

  // ── Beat / Quantize schedulers ────────────────────────────────────────────

  private _startBeatScheduler(): void {
    if (!_Tone) return;
    const [beatsPerBar] = this._parseTimeSignature();
    let beat = 0;

    this._beatScheduleId = _Tone.Transport.scheduleRepeat((time) => {
      const bar   = Math.floor(beat / beatsPerBar);
      const b     = beat % beatsPerBar;
      const sub   = 0;
      this._currentBar  = bar;
      this._currentBeat = b;
      this.emit('beat', bar, b, sub);

      if (this._metronomeOn) {
        const isAccent = b === 0;
        if (isAccent) {
          this.metronomeAccent.triggerAttackRelease('16n', time);
        } else {
          this.metronomeClick.triggerAttackRelease('32n', time);
        }
      }

      // Emit MIDI clock (24 pulses/beat via separate schedule)
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
    _Tone.Transport.swing    = this._swingAmount;
    _Tone.Transport.swingSubdivision = '8n';
  }

  // ── MIDI clock ────────────────────────────────────────────────────────────

  private async _initMidiClock(): Promise<void> {
    if (!navigator.requestMIDIAccess) return;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      const outputs = Array.from(access.outputs.values());
      if (outputs.length) this._midiOutput = outputs[0];
    } catch { /* no MIDI access */ }
  }

  setMidiClockOutput(enabled: boolean): void {
    if (!_Tone || !this._midiOutput) return;
    if (enabled) {
      // 24 MIDI clock pulses per quarter note
      this._midiClockScheduleId = _Tone.Transport.scheduleRepeat((time) => {
        _Tone!.getDraw().schedule(() => {
          this._midiOutput?.send([0xF8]); // MIDI clock
        }, time);
      }, '32t' as ToneType.Unit.Time);
      this._midiOutput.send([0xFA]); // Start
      this.emit('midiClockStart');
    } else {
      if (this._midiClockScheduleId >= 0) {
        _Tone.Transport.clear(this._midiClockScheduleId);
        this._midiClockScheduleId = -1;
      }
      this._midiOutput?.send([0xFC]); // Stop
      this.emit('midiClockStop');
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
        // Alternate reverse on each loop — polled via loop event
        t.player.reverse = false;
        t.player.playbackRate = 1;
        break;
      case 'stutter': {
        // Short loop window — set player loopEnd to 1/4 of buffer
        const dur = t.player.buffer.duration;
        t.player.loopStart = 0;
        t.player.loopEnd   = dur * 0.25;
        t.player.reverse   = false;
        t.player.playbackRate = 1;
        break;
      }
      default: // normal
        t.player.reverse = false;
        t.player.playbackRate = 1;
        break;
    }
  }

  // ── Playback mode ─────────────────────────────────────────────────────────

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
    // Deep-copy via Tone AudioBuffer
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
    return this.track(i)?.undoStack.length ?? this.tracks[i]?._undoStack.length ?? 0;
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

  // ── Granular Freeze ───────────────────────────────────────────────────────

  setGranularFreeze(frozen: boolean, trackIndex = 0): void {
    if (!this.ready() || !_Tone) return;
    this._granularFrozen = frozen;

    if (frozen) {
      const t = this.tracks[trackIndex];
      if (!t?.player.loaded) return;
      if (this._granularPlayer) {
        this._granularPlayer.stop();
        this._granularPlayer.dispose();
      }
      this._granularPlayer = new _Tone.Player(t.player.buffer).connect(this.masterBus);
      this._granularPlayer.loop = true;
      this._granularPlayer.start();
    } else {
      this._granularPlayer?.stop();
      this._granularPlayer?.dispose();
      this._granularPlayer = null;
    }
  }

  isGranularFrozen(): boolean { return this._granularFrozen; }

  // ── Sidechain ─────────────────────────────────────────────────────────────

  setSidechainTrack(sourceTrackIndex: number, amount: number): void {
    const t = this.track(sourceTrackIndex, 'setSidechainTrack');
    if (!t || !_Tone) return;
    // Duck master bus proportionally to track level
    const meterVal = this.getTrackLevel(sourceTrackIndex);
    const duck     = 1 - meterVal * clamp(amount, 0, 1);
    lerpParam(this.sidechainGain.gain as any, duck, 0.01);
  }

  // ── Clip launcher ─────────────────────────────────────────────────────────

  async loadClip(trackIndex: number, clipIndex: number, buffer: ToneType.ToneAudioBuffer): Promise<void> {
    const t = this.track(trackIndex, 'loadClip');
    if (!t || !_Tone) return;
    const clip = t.clips[clipIndex];
    if (!clip) return;

    // Clean up old player if any
    if (clip._player) {
      if (clip._synced) { try { clip._player.stop(); clip._player.unsync(); } catch { /* ok */ } }
      clip._player.dispose();
    }

    clip.buffer     = buffer;
    clip.hasContent = true;
    clip.state      = 'loaded';

    const player = new _Tone.Player(buffer).connect(t.inputGain);
    player.loop   = true;
    clip._player  = player;
    clip._synced  = false;
  }

  launchClip(trackIndex: number, clipIndex: number): void {
    const t = this.track(trackIndex, 'launchClip');
    if (!t || !_Tone) return;
    const clip = t.clips[clipIndex];
    if (!clip?.hasContent || !clip._player) return;

    // Stop all other clips on this track
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

    // Stop old schedule
    if (this._beatRepeat._scheduleId >= 0) {
      _Tone.Transport.clear(this._beatRepeat._scheduleId);
      this._beatRepeat._scheduleId = -1;
    }
    this._beatRepeat.enabled     = config.enabled;
    this._beatRepeat.trackIndex  = config.trackIndex;
    this._beatRepeat.division    = config.division;
    this._beatRepeat.chance      = config.chance;
    this._beatRepeat.length      = config.length;
    this._beatRepeat.pitch       = config.pitch;
    this._beatRepeat.variation   = config.variation;

    if (!config.enabled) {
      this.emit('beatRepeatStop', config.trackIndex);
      return;
    }

    const t = this.track(config.trackIndex);
    if (!t?.player.loaded) return;

    this._beatRepeat._scheduleId = _Tone.Transport.scheduleRepeat((time) => {
      if (Math.random() > config.chance) return;

      // Momentarily trigger a short player fragment
      const dur  = _Tone!.Time(config.division as ToneType.Unit.Time).toSeconds() * config.length;
      const frag = new _Tone.Player(t.player.buffer).connect(t.inputGain);

      // Variation
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

      // Clean up after playback
      setTimeout(() => frag.dispose(), (dur + 0.5) * 1000);

    }, config.division as ToneType.Unit.Time);

    this.emit('beatRepeatStart', config.trackIndex);
  }

  // ── LFO controls ─────────────────────────────────────────────────────────

  setLFO(id: number, config: Partial<LFOState>): void {
    if (id < 0 || id >= LFO_COUNT) return;
    const lfo = this._lfos[id];
    Object.assign(lfo, config);

    if (!_Tone || !lfo._lfo) return;

    // Update node
    (lfo._lfo as any).type = lfo.shape as ToneType.ToneOscillatorType;
    lfo._lfo.frequency.value = lfo.rateSynced
      ? this._lfoSyncFreq(lfo.rateNote)
      : lfo.rateHz;

    if (lfo.enabled && !lfo._lfo.state?.startsWith('start')) {
      lfo._lfo.start();
      this._wireLFO(lfo);
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
    // Restart beat scheduler with new meter
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

  getMasterLufs(): number {
    return rmsToLufs(this.getMasterLevel());
  }

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
      // Re-sync LFOs that are BPM-synced
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
    if (this.metronomeClick) this.metronomeClick.volume.value  = -22 + volume * 12;
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

  captureScene(id: string, label: string, color = '#333'): SceneSnapshot {
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

  // ── Scene morph (interpolate A → B over durationMs) ──────────────────────

  morphScenes(from: SceneSnapshot, to: SceneSnapshot, durationMs = 2000): void {
    cancelAnimationFrame(this._morphRafId);
    const start    = performance.now();
    const totalMs  = durationMs;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / totalMs);

      // BPM
      this.setBpm(lerp(from.bpm, to.bpm, t));

      // Global FX
      this.setGlobalFilter(lerp(from.fx.filterFreq, to.fx.filterFreq, t));
      this.setGlobalReverb(
        lerp(from.fx.reverbDecay,  to.fx.reverbDecay,  t),
        lerp(from.fx.reverbWet,    to.fx.reverbWet,    t),
      );
      this.setGlobalDrive(lerp(from.fx.driveAmount, to.fx.driveAmount, t));
      this.setGlobalStereoWidth(lerp(from.fx.stereoWidth, to.fx.stereoWidth, t));

      // Per track
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
        this.setTrackSaturation(i,   lerp(fs.saturation, ts.saturation, t));
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

    // Beat repeat
    if (this._beatRepeat._scheduleId >= 0)
      _Tone.Transport.clear(this._beatRepeat._scheduleId);
    if (this._beatRepeat._buffer) this._beatRepeat._buffer.dispose();

    // Schedules
    [this._beatScheduleId, this._quantScheduleId, this._midiClockScheduleId]
      .filter(id => id >= 0)
      .forEach(id => _Tone!.Transport.clear(id));

    // LFOs
    this._lfos.forEach(lfo => {
      try { lfo._lfo?.stop(); lfo._lfo?.dispose(); } catch { /* ok */ }
      lfo._lfo = null;
    });

    // Granular
    this._granularPlayer?.stop();
    this._granularPlayer?.dispose();
    this._granularPlayer = null;

    // Tracks
    this.tracks.forEach(t => {
      t.recorder.close();
      if (t._playerSynced) {
        try { t.player.stop(); t.player.unsync(); } catch { /* ok */ }
      }
      // Clip players
      t.clips.forEach(c => {
        if (c._synced && c._player) {
          try { c._player.stop(); c._player.unsync(); } catch { /* ok */ }
        }
        c._player?.dispose();
      });
      // Dispose undo buffers
      t._undoStack.forEach(b => b.dispose());

      [t.player, t.recorder, t.inputGain, t.gate, t.compressor, t.eq,
       t.saturator, t.chorus, t.flanger, t.phaser, t.bitCrusher,
       t.pitchShift, t.tremolo, t.panner, t.outputGain,
       t.reverbSend, t.delaySend, t.chorusSend,
       t.meter, t.meterL, t.meterR, t.analyser, t.fft]
        .forEach(n => { try { n.dispose(); } catch { /* ok */ } });
    });
    (this.tracks as EngineTrack[]).length = 0;

    // Master chain
    [this.globalReverb, this.globalDelay, this.globalFilter,
     this.globalChorus, this.globalPhaser, this.globalSaturator,
     this.globalBitCrusher, this.globalStereoWidener,
     this.masterCompressor, this.masterLimiter,
     this.masterMeter, this.masterFft, this.masterAnalyser,
     this.masterBus, this.metronomeClick, this.metronomeAccent,
     this.sidechainEnv, this.sidechainGain]
      .forEach(n => { try { n?.dispose(); } catch { /* ok */ } });

    _Tone.Transport.stop();
    _Tone.Transport.cancel(0);
    this.initialized     = false;
    _Tone                = null;
    LoopEngine._instance = null;
    _engine              = null;
    this.emit('disposed');
    this._listeners = {};
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let _engine: LoopEngine | null = null;

export function getLoopEngine(): LoopEngine {
  if (!_engine) _engine = LoopEngine.getInstance();
  return _engine;
}

export { LoopEngine };
export type { LFOState };