// ─── RC-505 MkII LoopStation Types — ENHANCED v2 ─────────────────────────────

export type TrackState =
  | 'idle'
  | 'empty'           // alias for idle — used by Zustand store
  | 'recording'
  | 'overdubbing'
  | 'playing'
  | 'stopped'
  | 'waiting_record'   // queued to record on next quantize boundary
  | 'waiting_play';    // queued to play on next quantize boundary

export type HarmonyMode = 'off' | 'subtle' | 'choir' | 'ambient' | 'counter' | 'octave' | 'fifth' | 'unison';

export type PlaybackMode = 'normal' | 'reverse' | 'half' | 'double' | 'stutter' | 'pingpong';

export type WarpMode = 'off' | 'repitch' | 'complex' | 'texture';

export type LFOShape = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'random';

export type LFOTarget =
  | 'filter' | 'reverb' | 'delay' | 'volume' | 'pan'
  | 'drive' | 'chorus' | 'bitcrush' | 'none';

export type MacroTarget = LFOTarget | 'xy_x' | 'xy_y' | 'master_vol' | 'bpm';

export type TimeSignature = '3/4' | '4/4' | '5/4' | '6/8' | '7/8' | '12/8';

export type QuantMode = '1m' | '2m' | '4m' | '1/2' | '1/4' | '1/8' | 'free' | 'instant';

export type LoopSlice = 2 | 4 | 8 | 16 | 32;

export interface LoopTrack {
  id:            string;
  index:         number;
  state:         TrackState;
  volume:        number;          // 0–1
  pan:           number;          // -1–1
  muted:         boolean;
  cued:          boolean;
  hasContent:    boolean;
  loopLength:    number | null;   // bars
  harmonyMode:   HarmonyMode;
  playbackMode:  PlaybackMode;
  warpMode:      WarpMode;
  eq:            { low: number; mid: number; high: number };  // dB -24–+24
  // FX sends
  reverbSend:    number;          // 0–1
  delaySend:     number;          // 0–1
  chorusSend:    number;          // 0–1
  // Per-track FX
  inputGain:     number;          // 0–2 (unity = 1)
  overdubBlend:  number;          // 0–1 (how much prev layer survives overdub)
  pitchSemis:    number;          // -24 to +24 semitones
  pitchFine:     number;          // -100 to +100 cents
  // Dynamics
  gateThreshold: number;          // 0–1
  compAmount:    number;          // 0–1
  saturation:    number;          // 0–1
  // Slice
  sliceEnabled:  boolean;
  sliceCount:    LoopSlice;
  activeSlice:   number;
  // Clip slots (8 per track)
  clips:         ClipSlot[];
}

export interface ClipSlot {
  id:         string;
  hasContent: boolean;
  name:       string;
  color:      string;
  length:     number | null;      // bars
  state:      'empty' | 'loaded' | 'playing' | 'recording' | 'queued';
}

export interface MacroKnob {
  id:          number;            // 0–3
  label:       string;
  value:       number;            // 0–1
  target:      MacroTarget;
  color:       string;
  lfoEnabled:  boolean;
  lfoShape:    LFOShape;
  lfoRate:     number;            // 0–1 (maps to 0.1–16Hz or note divisions)
  lfoDepth:    number;            // 0–1
  lfoSync:     boolean;           // sync to BPM
}

export interface BeatRepeatState {
  enabled:     boolean;
  trackId:     string | null;
  division:    '1/4' | '1/8' | '1/16' | '1/32';
  chance:      number;            // 0–1
  length:      number;            // beats
  pitch:       number;            // semitones
  variation:   'none' | 'pitch' | 'volume' | 'pan';
}

export interface LoopStationState {
  tracks:        LoopTrack[];
  bpm:           number;
  masterVolume:  number;
  isPlaying:     boolean;
  midiSync:      boolean;
  quantize:      QuantMode;
  timeSignature: TimeSignature;
  swing:         number;          // 0–1 (0 = straight, 1 = max swing)
  macros:        MacroKnob[];
  beatRepeat:    BeatRepeatState;
  activeClipRow: number;          // which clip row is active in clip view
}

export interface FXState {
  filterFreq:      number;        // 20–20000 Hz
  filterResonance: number;        // 0.1–20
  filterType:      BiquadFilterType;
  delayTime:       string;        // Tone notation e.g. '8n'
  delayFeedback:   number;
  reverbDecay:     number;
  reverbWet:       number;
  chorusDepth:     number;
  chorusRate:      number;
  chorusWet:       number;
  flangerDepth:    number;
  flangerRate:     number;
  driveAmount:     number;
  bitDepth:        number;        // 1–16
  stereoWidth:     number;        // 0–1
  tiltEQ:          number;        // -1 to 1 (bipolar)
  phaserStages:    number;        // 2–12
  phaserRate:      number;
  phaserWet:       number;
  granularFreeze:  boolean;
  granularSize:    number;
  granularDensity: number;
  xyX:             number;        // 0–1
  xyY:             number;        // 0–1
  metronomeOn:     boolean;
  metronomeVol:    number;
  compThreshold:   number;
  compRatio:       number;
}