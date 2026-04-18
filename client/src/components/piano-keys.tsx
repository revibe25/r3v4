import clsx from "clsx";
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  Upload, ChevronUp, ChevronDown, AlertCircle, Circle, Check, Trash2, Settings,
  Layers, Zap, Music, Play, Square, Save, Download, Radio, Repeat, GitBranch,
  Volume2, VolumeX, Copy, Sparkles, Grid3x3, Shuffle, Lock, Unlock, Activity,
  Mic, StopCircle, SkipBack, SkipForward, AudioWaveform, Sliders, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { getAudioContext } from "@/audio/core/audio-context";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface KeyAssignment {
  keyIndex: number;
  buffer: AudioBuffer;
  name: string;
  velocity?: number;
  layer?: string;
  volume?: number;
  pan?: number;
  pitch?: number;
  fadeIn?: number;
  fadeOut?: number;
  reverse?: boolean;
  color?: string;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  filterCutoff?: number;
  filterResonance?: number;
  loopEnabled?: boolean;
  loopStart?: number;
  loopEnd?: number;
}

interface EffectSettings {
  reverb: number;
  delay: number;
  chorus: number;
  compression: number;
  eq: number;
  distortion: number;
  filter: number;
  tremolo: number;
  phaser: number;
  flanger: number;
  bitcrusher: number;
  saturation: number;
}

interface PerformancePreset {
  id: string;
  name: string;
  description?: string;
  assignments: Map<number, KeyAssignment[]>;
  effects: EffectSettings;
  octaveShift: number;
  velocity: number;
  arpeggiatorSettings?: ArpeggiatorSettings;
  sequenceData?: SequenceNote[];
  tags?: string[];
  createdAt?: number;
}

interface ArpeggiatorSettings {
  enabled: boolean;
  pattern: 'up' | 'down' | 'updown' | 'random' | 'chord' | 'euclidean' | 'pingpong';
  speed: number;
  octaves: number;
  gate: number;
  swing: number;
  probability: number;
}

interface SequenceNote {
  keyIndex: number;
  time: number;
  duration: number;
  velocity: number;
}

interface RecordedNote {
  keyIndex: number;
  timestamp: number;
  velocity: number;
  duration?: number;
  released?: boolean;
}

interface VelocityCurve {
  name: string;
  curve: (input: number) => number;
  description: string;
}

interface PianoKeysProps {
  keys: { sample: AudioBuffer | null; name: string; note: string; isActive: boolean }[];
  onTrigger: (index: number, octaveShift: number, velocity: number) => void;
  onAssignSample: (keyIndex: number, buffer: AudioBuffer, name: string) => void;
  loadSample: (file: File) => Promise<AudioBuffer | null>;
  onEffectChange?: (effects: EffectSettings) => void;
}

// ============================================================================
// CONSTANTS & CONFIGURATIONS
// ============================================================================

const KEYBOARD_MAP: Record<string, number> = {
  'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6,
  'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11, ',': 12,
  'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16, 'r': 17, '5': 18,
  't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24,
  'a': -12, 'k': 25, 'o': 26, '9': 27, 'p': 28, '[': 29
};

const PIANO_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VALID_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac'];
const KEY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
];

const SCALES: Record<string, { label: string; intervals: number[] }> = {
  none: { label: 'None', intervals: [] },
  major: { label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'Natural Min', intervals: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { label: 'Pentatonic', intervals: [0, 2, 4, 7, 9] },
  blues: { label: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { label: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  chromatic: { label: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

const CHORD_PATTERNS = [
  { name: '', suffix: '', intervals: [0, 4, 7] },
  { name: 'm', suffix: 'm', intervals: [0, 3, 7] },
  { name: '7', suffix: '7', intervals: [0, 4, 7, 10] },
  { name: 'maj7', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { name: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { name: 'dim', suffix: '°', intervals: [0, 3, 6] },
  { name: 'aug', suffix: '+', intervals: [0, 4, 8] },
  { name: 'sus2', suffix: 'sus2', intervals: [0, 2, 7] },
  { name: 'sus4', suffix: 'sus4', intervals: [0, 5, 7] },
  { name: '5', suffix: '5', intervals: [0, 7] },
];

const AUTO_CHORD_VOICINGS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  power: [0, 7],
};

const DEFAULT_EFFECTS: EffectSettings = {
  reverb: 0.2, delay: 0, chorus: 0, compression: 0.3, eq: 0,
  distortion: 0, filter: 0.5, tremolo: 0, phaser: 0, flanger: 0,
  bitcrusher: 0, saturation: 0,
};

const DEFAULT_ARPEGGIATOR: ArpeggiatorSettings = {
  enabled: false, pattern: 'up', speed: 120, octaves: 1,
  gate: 0.8, swing: 0, probability: 1,
};

const VELOCITY_CURVES: VelocityCurve[] = [
  { name: 'Linear', curve: (x) => x, description: 'Direct velocity response' },
  { name: 'Soft', curve: (x) => Math.pow(x, 0.5), description: 'Softer response' },
  { name: 'Hard', curve: (x) => Math.pow(x, 2), description: 'Harder response' },
  { name: 'Exponential', curve: (x) => (Math.exp(x) - 1) / (Math.E - 1), description: 'Exponential growth' },
  { name: 'Logarithmic', curve: (x) => Math.log(1 + x * 9) / Math.log(10), description: 'Logarithmic response' },
  { name: 'S-Curve', curve: (x) => 1 / (1 + Math.exp(-12 * (x - 0.5))), description: 'S-shaped curve' },
];

const ARP_PATTERNS = [
  { value: 'up', label: 'Up ↑', description: 'Ascending' },
  { value: 'down', label: 'Down ↓', description: 'Descending' },
  { value: 'updown', label: 'Up-Down ↕', description: 'Bidirectional' },
  { value: 'pingpong', label: 'Ping-Pong 🏓', description: 'Bouncing' },
  { value: 'random', label: 'Random 🎲', description: 'Random order' },
  { value: 'chord', label: 'Chord 🎹', description: 'Simultaneously' },
  { value: 'euclidean', label: 'Euclidean ⭕', description: 'Euclidean rhythm' },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

function generateEuclideanRhythm(steps: number, pulses: number): boolean[] {
  const pattern: boolean[] = new Array(steps).fill(false);
  if (pulses >= steps) return pattern.fill(true);
  const slope = pulses / steps;
  let previous = 0;
  for (let i = 0; i < steps; i++) {
    const current = Math.floor((i + 1) * slope);
    pattern[i] = current !== previous;
    previous = current;
  }
  return pattern;
}

function detectChord(activeNotes: Set<number>): string {
  if (activeNotes.size < 2) return '';
  const notesMod = Array.from(activeNotes).map(n => n % 12).sort((a, b) => a - b);
  for (const root of notesMod) {
    for (const pat of CHORD_PATTERNS) {
      const shifted = pat.intervals.map(i => (i + root) % 12).sort((a, b) => a - b);
      if (shifted.length === notesMod.length && shifted.every((n, i) => n === notesMod[i])) {
        return PIANO_NOTES[root] + pat.suffix;
      }
    }
  }
  return notesMod.map(n => PIANO_NOTES[n]).join('/');
}

// ============================================================================
// PIANO KEY COMPONENTS
// ============================================================================

function WhiteKey({
  keyIdx, isActive, note, octave, label, hasAssignment, layerCount,
  keyColor, isLocked, velocity, onTrigger, onLongPress, negativeMargin, isInScale,
}: {
  keyIdx: number; isActive: boolean; note: string; octave: number; label: string;
  hasAssignment: boolean; layerCount: number; keyColor?: string; isLocked: boolean;
  velocity: number; onTrigger: (idx: number) => void; onLongPress: (idx: number) => void;
  negativeMargin: boolean; isInScale: boolean;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const [localVelocity, setLocalVelocity] = useState(0);
  const pressTimerRef = useRef<NodeJS.Timeout>();

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPressed(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;
    setLocalVelocity(clamp(1 - relativeY * 0.5, 0.5, 1.0));
    pressTimerRef.current = setTimeout(() => onLongPress(keyIdx), 500);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    onTrigger(keyIdx);
    setLocalVelocity(0);
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    setLocalVelocity(0);
  };

  const displayVelocity = isPressed ? localVelocity : (isActive ? velocity : 0);

  return (
    <button
      data-testid={`piano-key-${keyIdx}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'relative w-8 md:w-10 h-24 md:h-28 rounded-b-lg flex flex-col items-center justify-end pb-2',
        'transition-all duration-75 ease-out border border-gray-300 select-none touch-none',
        negativeMargin && '-mr-1',
        (isActive || isPressed)
          ? 'bg-white shadow-inner scale-[0.98] translate-y-0.5'
          : 'bg-white shadow-md hover:shadow-lg',
        isLocked && 'ring-2 ring-orange-400 ring-inset',
        isInScale && !isActive && 'ring-1 ring-lime-300/50 ring-inset'
      )}
    >
      {displayVelocity > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-400/40 to-transparent rounded-b-lg"
          style={{ height: `${displayVelocity * 100}%` }}
        />
      )}

      {hasAssignment && (
        <div className="absolute top-1 left-1 right-1 h-1 flex gap-0.5">
          {Array.from({ length: Math.min(layerCount, 5) }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{
                backgroundColor: keyColor || KEY_COLORS[i % KEY_COLORS.length],
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      )}

      {isLocked && <Lock className="absolute top-2 right-1 w-3 h-3 text-orange-500" />}

      <span className="text-[10px] md:text-xs font-semibold text-muted-foreground pointer-events-none">
        {label}
      </span>
      <span className="text-[8px] md:text-[10px] text-muted-foreground pointer-events-none">
        {note}{octave}
      </span>

      {layerCount > 1 && (
        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">
          {layerCount}
        </div>
      )}
    </button>
  );
}

function BlackKey({
  keyIdx, isActive, note, octave, label, hasAssignment, layerCount,
  keyColor, isLocked, velocity, onTrigger, onLongPress, isInScale,
}: {
  keyIdx: number; isActive: boolean; note: string; octave: number; label: string;
  hasAssignment: boolean; layerCount: number; keyColor?: string; isLocked: boolean;
  velocity: number; onTrigger: (idx: number) => void; onLongPress: (idx: number) => void;
  isInScale: boolean;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const [localVelocity, setLocalVelocity] = useState(0);
  const pressTimerRef = useRef<NodeJS.Timeout>();

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPressed(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;
    setLocalVelocity(clamp(1 - relativeY * 0.3, 0.5, 1.0));
    pressTimerRef.current = setTimeout(() => onLongPress(keyIdx), 500);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    onTrigger(keyIdx);
    setLocalVelocity(0);
  };

  const displayVelocity = isPressed ? localVelocity : (isActive ? velocity : 0);

  return (
    <button
      data-testid={`piano-key-${keyIdx}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsPressed(false);
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        setLocalVelocity(0);
      }}
      className={clsx(
        'absolute left-1/2 -translate-x-1/2 z-10 w-5 md:w-6 h-14 md:h-16 rounded-b-md',
        'flex flex-col items-center justify-end pb-1.5 transition-all duration-75 ease-out',
        'border border-gray-950 select-none touch-none',
        (isActive || isPressed)
          ? 'bg-black shadow-inner scale-[0.97] translate-y-0.5'
          : 'bg-black shadow-lg hover:shadow-xl',
        isInScale && !isActive && !isPressed && 'ring-1 ring-lime-400/60 ring-inset',
        isLocked && 'ring-2 ring-orange-400 ring-inset'
      )}
    >
      {displayVelocity > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/50 to-transparent rounded-b-md"
          style={{ height: `${displayVelocity * 100}%` }}
        />
      )}

      {hasAssignment && (
        <div className="absolute top-0.5 left-0.5 right-0.5 h-0.5 flex gap-0.5">
          {Array.from({ length: Math.min(layerCount, 3) }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{
                backgroundColor: keyColor || KEY_COLORS[i % KEY_COLORS.length],
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      )}

      {isLocked && <Lock className="absolute top-1 right-0.5 w-2.5 h-2.5 text-orange-400" />}

      <span className="text-[8px] md:text-[10px] font-semibold text-gray-300 pointer-events-none">
        {label}
      </span>
      <span className="text-[7px] md:text-[8px] text-gray-500 pointer-events-none">
        {note}{octave}
      </span>

      {layerCount > 1 && (
        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-blue-600 text-white text-[7px] font-bold flex items-center justify-center">
          {layerCount}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PianoKeys({
  keys, onTrigger, onAssignSample, loadSample, onEffectChange,
}: PianoKeysProps) {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [octaveShift, setOctaveShift] = useState(0);
  const [velocity, setVelocity] = useState(0.8);
  const [pitchBend, setPitchBend] = useState(0);
  const [modulation, setModulation] = useState(0);
  const [sustain, setSustain] = useState(false);
  const [assignments, setAssignments] = useState<Map<number, KeyAssignment[]>>(new Map());
  const [effects, setEffects] = useState<EffectSettings>(DEFAULT_EFFECTS);
  const [velocityCurve, setVelocityCurve] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [keyToEdit, setKeyToEdit] = useState<number | null>(null);
  const [presets, setPresets] = useState<PerformancePreset[]>([]);
  const [arpeggiator, setArpeggiator] = useState<ArpeggiatorSettings>(DEFAULT_ARPEGGIATOR);
  const [heldKeys, setHeldKeys] = useState<Set<number>>(new Set());
  const [lockedKeys, setLockedKeys] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [keyVelocities, setKeyVelocities] = useState<Map<number, number>>(new Map());
  const [globalTuning, setGlobalTuning] = useState(0);
  const [scaleType, setScaleType] = useState<keyof typeof SCALES>('none');
  const [scaleRoot, setScaleRoot] = useState(0);
  const [detectedChord, setDetectedChord] = useState('');
  const [showWaveforms, setShowWaveforms] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [filterType, setFilterType] = useState<'lowpass' | 'highpass' | 'bandpass' | 'notch'>('lowpass');
  const [autoChordEnabled, setAutoChordEnabled] = useState(false);
  const [autoChordVoicing, setAutoChordVoicing] = useState<keyof typeof AUTO_CHORD_VOICINGS>('major');
  const [envelopePreset, setEnvelopePreset] = useState<'pluck' | 'pad' | 'organ' | 'percussion' | 'custom'>('custom');
  const [polyphonyLimit, setPolyphonyLimit] = useState(32);
  const [voiceStealingEnabled, setVoiceStealingEnabled] = useState(true);
  const [quantizeEnabled, setQuantizeEnabled] = useState(false);
  const [quantizeGrid, setQuantizeGrid] = useState(16);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [currentPresetName, setCurrentPresetName] = useState('');
  const [currentPresetDescription, setCurrentPresetDescription] = useState('');

  // ========================================================================
  // REFS
  // ========================================================================

  const fileInputRef = useRef<HTMLInputElement>(null);
  const arpIntervalRef = useRef<NodeJS.Timeout>();
  const recordingStartTimeRef = useRef<number>(0);
  const sustainedKeysRef = useRef<Set<number>>(new Set());
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // ========================================================================
  // AUDIO CONTEXT SETUP
  // ========================================================================

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = getAudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // ========================================================================
  // WAVEFORM VISUALIZATION
  // ========================================================================

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !waveformCanvasRef.current) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgb(15, 23, 42)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(59, 130, 246)';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(i * sliceWidth, y);
      else ctx.lineTo(i * sliceWidth, y);
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (showWaveforms) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [showWaveforms]);

  useEffect(() => {
    if (showWaveforms) drawWaveform();
    else if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, [showWaveforms, drawWaveform]);

  // ========================================================================
  // CHORD DETECTION
  // ========================================================================

  useEffect(() => {
    setDetectedChord(detectChord(activeKeys));
  }, [activeKeys]);

  // ========================================================================
  // ARPEGGIATOR LOGIC
  // ========================================================================

  useEffect(() => {
    if (!arpeggiator.enabled || heldKeys.size === 0) {
      if (arpIntervalRef.current) clearInterval(arpIntervalRef.current);
      return;
    }

    const sortedKeys = Array.from(heldKeys).sort((a, b) => a - b);
    let currentIndex = 0;
    let direction = 1;
    const intervalMs = (60000 / arpeggiator.speed) / 4;

    arpIntervalRef.current = setInterval(() => {
      if (Math.random() > arpeggiator.probability) return;

      let keyToPlay: number;

      switch (arpeggiator.pattern) {
        case 'up':
          keyToPlay = sortedKeys[currentIndex % sortedKeys.length];
          currentIndex++;
          break;
        case 'down':
          keyToPlay = sortedKeys[sortedKeys.length - 1 - (currentIndex % sortedKeys.length)];
          currentIndex++;
          break;
        case 'updown':
        case 'pingpong':
          keyToPlay = sortedKeys[currentIndex];
          currentIndex += direction;
          if (currentIndex >= sortedKeys.length) {
            currentIndex = sortedKeys.length - 2;
            direction = -1;
          } else if (currentIndex < 0) {
            currentIndex = 1;
            direction = 1;
          }
          break;
        case 'random':
          keyToPlay = sortedKeys[Math.floor(Math.random() * sortedKeys.length)];
          break;
        case 'chord':
          sortedKeys.forEach(key => {
            onTrigger(key + transpose, octaveShift, velocity * VELOCITY_CURVES[velocityCurve].curve(0.8));
          });
          return;
        default:
          keyToPlay = sortedKeys[0];
      }

      const actualKey = keyToPlay + transpose;
      onTrigger(actualKey, octaveShift, velocity * VELOCITY_CURVES[velocityCurve].curve(0.8) * arpeggiator.gate);
    }, intervalMs);

    return () => {
      if (arpIntervalRef.current) clearInterval(arpIntervalRef.current);
    };
  }, [arpeggiator, heldKeys, octaveShift, velocity, velocityCurve, transpose, onTrigger]);

  // ========================================================================
  // RECORDING & PLAYBACK
  // ========================================================================

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordedNotes([]);
    recordingStartTimeRef.current = performance.now();
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const startPlayback = useCallback(() => {
    if (recordedNotes.length === 0) return;
    setIsPlaying(true);

    const sortedNotes = [...recordedNotes].sort((a, b) => a.timestamp - b.timestamp);
    sortedNotes.forEach(note => {
      setTimeout(() => {
        onTrigger(note.keyIndex, octaveShift, note.velocity);
        setActiveKeys(prev => new Set(prev).add(note.keyIndex));
        if (note.duration) {
          setTimeout(() => {
            setActiveKeys(prev => {
              const newSet = new Set(prev);
              newSet.delete(note.keyIndex);
              return newSet;
            });
          }, note.duration);
        }
      }, note.timestamp);
    });

    const totalDuration = sortedNotes[sortedNotes.length - 1].timestamp + (sortedNotes[sortedNotes.length - 1].duration || 0);
    setTimeout(() => {
      setIsPlaying(false);
      setActiveKeys(new Set());
    }, totalDuration);
  }, [recordedNotes, onTrigger, octaveShift]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setActiveKeys(new Set());
  }, []);

  const clearRecording = useCallback(() => {
    setRecordedNotes([]);
  }, []);

  const exportRecording = useCallback(() => {
    if (recordedNotes.length === 0) return;
    const data = { notes: recordedNotes, tempo: 120, timeSignature: '4/4', exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedNotes]);

  const quantizeRecording = useCallback(() => {
    if (!quantizeEnabled || recordedNotes.length === 0) return;
    const quantizeMs = (60000 / 120) * (4 / quantizeGrid);
    const quantized = recordedNotes.map(note => ({
      ...note,
      timestamp: Math.round(note.timestamp / quantizeMs) * quantizeMs,
    }));
    setRecordedNotes(quantized);
  }, [recordedNotes, quantizeEnabled, quantizeGrid]);

  // ========================================================================
  // KEY TRIGGERING
  // ========================================================================

  const triggerKey = useCallback((keyIndex: number) => {
    const adjustedIndex = keyIndex + transpose;
    const currentVelocity = velocity * VELOCITY_CURVES[velocityCurve].curve(Math.random() * 0.2 + 0.8);

    onTrigger(adjustedIndex, octaveShift, currentVelocity);
    setActiveKeys(prev => new Set(prev).add(keyIndex));
    setKeyVelocities(prev => new Map(prev).set(keyIndex, currentVelocity));

    if (isRecording) {
      const timestamp = performance.now() - recordingStartTimeRef.current;
      setRecordedNotes(prev => [...prev, {
        keyIndex, timestamp, velocity: currentVelocity, released: false,
      }]);
    }

    setTimeout(() => {
      if (!sustain && !sustainedKeysRef.current.has(keyIndex)) {
        setActiveKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(keyIndex);
          return newSet;
        });
        setKeyVelocities(prev => {
          const newMap = new Map(prev);
          newMap.delete(keyIndex);
          return newMap;
        });
      }
    }, 100);
  }, [velocity, velocityCurve, octaveShift, transpose, sustain, isRecording, onTrigger]);

  // ========================================================================
  // FILE HANDLING
  // ========================================================================

  const handleFileSelect = useCallback(
    async (keyIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!VALID_AUDIO_TYPES.includes(file.type)) {
        alert('Please select a valid audio file (MP3, WAV, OGG, WEBM, FLAC)');
        return;
      }

      try {
        const buffer = await loadSample(file);
        if (buffer) {
          const newAssignment: KeyAssignment = {
            keyIndex, buffer, name: file.name, velocity: 1,
            layer: `layer-${Date.now()}`,
            volume: 1, pan: 0, pitch: 0, fadeIn: 0.01, fadeOut: 0.05,
            reverse: false, color: KEY_COLORS[Math.floor(Math.random() * KEY_COLORS.length)],
            attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3,
            filterCutoff: 1, filterResonance: 0, loopEnabled: false,
          };

          setAssignments(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(keyIndex) || [];
            newMap.set(keyIndex, [...existing, newAssignment]);
            return newMap;
          });

          onAssignSample(keyIndex, buffer, file.name);
        }
      } catch (error) {
        console.error('Error loading sample:', error);
        alert('Failed to load audio file.');
      }

      event.target.value = '';
    },
    [loadSample, onAssignSample]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    async (keyIndex: number, e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !VALID_AUDIO_TYPES.includes(file.type)) {
        alert('Please drop a valid audio file');
        return;
      }

      try {
        const buffer = await loadSample(file);
        if (buffer) {
          const newAssignment: KeyAssignment = {
            keyIndex, buffer, name: file.name, velocity: 1,
            layer: `layer-${Date.now()}`,
            volume: 1, pan: 0, pitch: 0, fadeIn: 0.01, fadeOut: 0.05,
            reverse: false, color: KEY_COLORS[Math.floor(Math.random() * KEY_COLORS.length)],
            attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3,
            filterCutoff: 1, filterResonance: 0,
          };

          setAssignments(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(keyIndex) || [];
            newMap.set(keyIndex, [...existing, newAssignment]);
            return newMap;
          });

          onAssignSample(keyIndex, buffer, file.name);
        }
      } catch (error) {
        console.error('Error loading dropped sample:', error);
      }
    },
    [loadSample, onAssignSample]
  );

  // ========================================================================
  // KEYBOARD CONTROLS
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (pressedKeysRef.current.has(key)) return;
      pressedKeysRef.current.add(key);

      if (key === 'arrowup') {
        e.preventDefault();
        setOctaveShift(prev => Math.min(prev + 1, 3));
        return;
      }
      if (key === 'arrowdown') {
        e.preventDefault();
        setOctaveShift(prev => Math.max(prev - 1, -3));
        return;
      }

      if (e.code === 'Space' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSustain(true);
        return;
      }

      const keyIndex = KEYBOARD_MAP[key];
      if (keyIndex !== undefined) {
        e.preventDefault();
        if (arpeggiator.enabled) setHeldKeys(prev => new Set(prev).add(keyIndex));
        triggerKey(keyIndex);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeysRef.current.delete(key);

      if (e.code === 'Space' && sustain) {
        setSustain(false);
        sustainedKeysRef.current.forEach(keyIndex => {
          setActiveKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(keyIndex);
            return newSet;
          });
        });
        sustainedKeysRef.current.clear();
        return;
      }

      const keyIndex = KEYBOARD_MAP[key];
      if (keyIndex !== undefined) {
        if (arpeggiator.enabled) {
          setHeldKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(keyIndex);
            return newSet;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [arpeggiator.enabled, triggerKey, sustain]);

  // ========================================================================
  // EFFECTS & PRESETS
  // ========================================================================

  const handleEffectChange = useCallback(
    (effectName: keyof EffectSettings, value: number) => {
      const newEffects = { ...effects, [effectName]: value };
      setEffects(newEffects);
      onEffectChange?.(newEffects);
    },
    [effects, onEffectChange]
  );

  const resetEffects = useCallback(() => {
    setEffects(DEFAULT_EFFECTS);
    onEffectChange?.(DEFAULT_EFFECTS);
  }, [onEffectChange]);

  const handleSavePreset = useCallback(() => {
    const preset: PerformancePreset = {
      id: `preset-${Date.now()}`,
      name: currentPresetName,
      description: currentPresetDescription || undefined,
      assignments: new Map(assignments),
      effects: { ...effects },
      octaveShift, velocity,
      arpeggiatorSettings: { ...arpeggiator },
      sequenceData: recordedNotes.length > 0 ? recordedNotes.map(n => ({
        keyIndex: n.keyIndex, time: n.timestamp, duration: n.duration || 0, velocity: n.velocity,
      })) : undefined,
      tags: [], createdAt: Date.now(),
    };

    setPresets(prev => [...prev, preset]);
    setShowPresetDialog(false);
    setCurrentPresetName('');
    setCurrentPresetDescription('');
  }, [currentPresetName, currentPresetDescription, assignments, effects, octaveShift, velocity, arpeggiator, recordedNotes]);

  const handleLoadPreset = useCallback((preset: PerformancePreset) => {
    setAssignments(new Map(preset.assignments));
    setEffects(preset.effects);
    setOctaveShift(preset.octaveShift);
    setVelocity(preset.velocity);
    if (preset.arpeggiatorSettings) setArpeggiator(preset.arpeggiatorSettings);
    if (preset.sequenceData) {
      setRecordedNotes(preset.sequenceData.map(n => ({
        keyIndex: n.keyIndex, timestamp: n.time, duration: n.duration, velocity: n.velocity, released: true,
      })));
    }
    onEffectChange?.(preset.effects);
  }, [onEffectChange]);

  const handleDeletePreset = useCallback((presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  }, []);

  const handleExportPreset = useCallback((preset: PerformancePreset) => {
    const exportData = {
      ...preset,
      assignments: Array.from(preset.assignments.entries()).map(([key, layers]) => ({
        key, layers: layers.map(l => ({ ...l, buffer: null })),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const toggleKeyLock = useCallback((keyIndex: number) => {
    setLockedKeys(prev => {
      const newSet = new Set(prev);
      newSet.has(keyIndex) ? newSet.delete(keyIndex) : newSet.add(keyIndex);
      return newSet;
    });
  }, []);

  const handleDuplicateKey = useCallback((fromKey: number, toKey: number) => {
    const layers = assignments.get(fromKey);
    if (!layers) return;
    setAssignments(prev => {
      const newMap = new Map(prev);
      newMap.set(toKey, [...layers]);
      return newMap;
    });
  }, [assignments]);

  const clearAllAssignments = useCallback(() => {
    if (confirm('Clear all key assignments?')) setAssignments(new Map());
  }, []);

  const applyEnvelopePreset = useCallback((preset: typeof envelopePreset) => {
    setEnvelopePreset(preset);
    setAssignments(prev => {
      const newMap = new Map(prev);
      newMap.forEach((layers, key) => {
        const updated = layers.map(layer => {
          const envelopes = {
            pluck: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.5 },
            pad: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 1.5 },
            organ: { attack: 0.01, decay: 0, sustain: 1, release: 0.1 },
            percussion: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.2 },
          };
          return { ...layer, ...envelopes[preset as keyof typeof envelopes] };
        });
        newMap.set(key, updated);
      });
      return newMap;
    });
  }, []);

  // ========================================================================
  // KEYBOARD LAYOUT
  // ========================================================================

  const getKeyboardLayout = useMemo(() => {
    const layout: Array<{ type: 'white' | 'black'; index: number; note: string }> = [];
    for (let i = 0; i < 24; i++) {
      const noteIndex = i % 12;
      const note = PIANO_NOTES[noteIndex];
      layout.push({ type: note.includes('#') ? 'black' : 'white', index: i, note });
    }
    return layout;
  }, []);

  const whiteKeys = useMemo(() => getKeyboardLayout.filter(k => k.type === 'white'), [getKeyboardLayout]);
  const blackKeys = useMemo(() => getKeyboardLayout.filter(k => k.type === 'black'), [getKeyboardLayout]);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <TooltipProvider>
      <section className="relative rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/80 overflow-hidden shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.04) 100%)' }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md"
              style={{
                background: 'linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(250, 60%, 45%) 100%)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
              }}>
              <Music className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground/90">Piano Keys</h3>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">24 Keys • Velocity Sensitive • Drag & Drop</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2.5 space-y-3">
          {/* Keyboard */}
          <div className="relative">
            <div className="flex items-center justify-between gap-2 px-1 mb-1.5">
              <div className="flex items-center gap-1.5 flex-1">
                {detectedChord ? (
                  <span className="text-sm font-extrabold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(163,230,53,0.12)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)' }}>
                    {detectedChord}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40 italic">play a chord…</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant={autoChordEnabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAutoChordEnabled(v => !v)}
                  className="text-[9px] h-6"
                >
                  Auto Chord
                </Button>
                {autoChordEnabled && (
                  <Select value={autoChordVoicing} onValueChange={v => setAutoChordVoicing(v as any)}>
                    <SelectTrigger className="h-6 w-20 text-[9px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(AUTO_CHORD_VOICINGS).map(k => (
                        <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Select value={scaleRoot.toString()} onValueChange={v => setScaleRoot(Number(v))}>
                  <SelectTrigger className="h-6 w-12 text-[9px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIANO_NOTES.map((n, i) => <SelectItem key={i} value={i.toString()} className="text-xs">{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={scaleType} onValueChange={v => setScaleType(v as any)}>
                  <SelectTrigger className="h-6 w-24 text-[9px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCALES).map(([k, s]) => (
                      <SelectItem key={k} value={k} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Keyboard */}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 relative p-3 rounded-lg border border-border/40"
                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)' }}>
                <div className="flex justify-center gap-0.5">
                  {whiteKeys.map((keyData, idx) => {
                    const keyIndex = keyData.index;
                    const note = keyData.note;
                    const octave = 4 + Math.floor(keyIndex / 12);
                    const layers = assignments.get(keyIndex) || [];
                    const keyLabel = Object.entries(KEYBOARD_MAP).find(([, v]) => v === keyIndex)?.[0]?.toUpperCase() || '';
                    const isActive = activeKeys.has(keyIndex);
                    const currentVelocity = keyVelocities.get(keyIndex) || 0;
                    const scaleIntervals = SCALES[scaleType]?.intervals ?? [];
                    const isInScale = scaleIntervals.length > 0
                      ? scaleIntervals.includes((keyIndex - scaleRoot + 120) % 12)
                      : false;
                    const nextKeyIsBlack = idx < whiteKeys.length - 1 &&
                      blackKeys.some(bk => bk.index === whiteKeys[idx + 1].index - 1);

                    return (
                      <div key={keyIndex} className="relative" onDragOver={handleDragOver} onDrop={(e) => handleDrop(keyIndex, e)}>
                        <WhiteKey
                          keyIdx={keyIndex} isActive={isActive} note={note} octave={octave}
                          label={keyLabel} hasAssignment={layers.length > 0} layerCount={layers.length}
                          keyColor={layers[0]?.color} isLocked={lockedKeys.has(keyIndex)}
                          velocity={currentVelocity} onTrigger={triggerKey} onLongPress={setKeyToEdit}
                          negativeMargin={nextKeyIsBlack} isInScale={isInScale}
                        />
                        <input
                          ref={keyToEdit === keyIndex ? fileInputRef : undefined}
                          type="file"
                          accept={VALID_AUDIO_TYPES.join(',')}
                          onChange={(e) => handleFileSelect(keyIndex, e)}
                          className="hidden"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                  <div className="flex gap-0.5">
                    {whiteKeys.map((whiteKey, idx) => {
                      const nextWhiteKeyIndex = whiteKeys[idx + 1]?.index;
                      const blackKeyBetween = blackKeys.find(bk => bk.index > whiteKey.index && bk.index < nextWhiteKeyIndex);

                      return (
                        <div key={whiteKey.index} className="relative w-8 md:w-10">
                          {blackKeyBetween && (
                            <div className="absolute right-0 translate-x-1/2 pointer-events-auto">
                              <BlackKey
                                keyIdx={blackKeyBetween.index}
                                isActive={activeKeys.has(blackKeyBetween.index)}
                                note={blackKeyBetween.note}
                                octave={4 + Math.floor(blackKeyBetween.index / 12)}
                                label={Object.entries(KEYBOARD_MAP).find(([, v]) => v === blackKeyBetween.index)?.[0]?.toUpperCase() || ''}
                                hasAssignment={(assignments.get(blackKeyBetween.index)?.length || 0) > 0}
                                layerCount={assignments.get(blackKeyBetween.index)?.length || 0}
                                keyColor={assignments.get(blackKeyBetween.index)?.[0]?.color}
                                isLocked={lockedKeys.has(blackKeyBetween.index)}
                                velocity={keyVelocities.get(blackKeyBetween.index) || 0}
                                onTrigger={triggerKey}
                                onLongPress={setKeyToEdit}
                                isInScale={(() => {
                                  const intervals = SCALES[scaleType]?.intervals ?? [];
                                  return intervals.length > 0 ? intervals.includes((blackKeyBetween.index - scaleRoot + 120) % 12) : false;
                                })()}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {showWaveforms && (
              <div className="mt-2">
                <canvas ref={waveformCanvasRef} width={800} height={100}
                  className="w-full h-24 rounded border border-border/40 bg-background/50" />
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="rounded-lg border border-border/40 overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.01) 100%)' }}>
            <button
              onClick={() => setControlsCollapsed(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors select-none"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.02) 100%)' }}>
              <div className="flex items-center gap-2">
                <Sliders className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-[11px] font-medium text-muted-foreground/70">Controls & Effects</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform ${controlsCollapsed ? '-rotate-90' : ''}`} />
            </button>

            {!controlsCollapsed && (
              <div className="px-2.5 pb-2.5 pt-1">
                <Tabs defaultValue="expression">
                  <TabsList className="grid w-full grid-cols-6 gap-1">
                    <TabsTrigger value="expression" className="text-xs"><Sliders className="w-3 h-3 mr-1" />Expression</TabsTrigger>
                    <TabsTrigger value="effects" className="text-xs"><Zap className="w-3 h-3 mr-1" />Effects</TabsTrigger>
                    <TabsTrigger value="recording" className="text-xs"><Mic className="w-3 h-3 mr-1" />Record</TabsTrigger>
                    <TabsTrigger value="arpeggiator" className="text-xs"><Activity className="w-3 h-3 mr-1" />Arp</TabsTrigger>
                    <TabsTrigger value="advanced" className="text-xs"><Settings className="w-3 h-3 mr-1" />Advanced</TabsTrigger>
                    <TabsTrigger value="presets" className="text-xs"><Save className="w-3 h-3 mr-1" />Presets</TabsTrigger>
                  </TabsList>

                  {/* ── Expression Tab ── */}
                  <TabsContent value="expression" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Velocity */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Velocity</span>
                          <span className="text-muted-foreground font-mono">{Math.round(velocity * 127)}</span>
                        </Label>
                        <Slider
                          value={[velocity]}
                          onValueChange={([v]) => setVelocity(v)}
                          min={0}
                          max={1}
                          step={0.01}
                          className="w-full"
                        />
                      </div>

                      {/* Octave Shift */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Octave</span>
                          <span className="text-muted-foreground font-mono">{octaveShift > 0 ? '+' : ''}{octaveShift}</span>
                        </Label>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOctaveShift(prev => Math.max(prev - 1, -3))}
                            className="flex-1"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOctaveShift(prev => Math.min(prev + 1, 3))}
                            className="flex-1"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Pitch Bend */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Pitch Bend</span>
                          <span className="text-muted-foreground font-mono">{pitchBend > 0 ? '+' : ''}{pitchBend.toFixed(1)}</span>
                        </Label>
                        <Slider
                          value={[pitchBend]}
                          onValueChange={([v]) => setPitchBend(v)}
                          min={-12}
                          max={12}
                          step={0.1}
                          className="w-full"
                        />
                      </div>

                      {/* Modulation */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Modulation</span>
                          <span className="text-muted-foreground font-mono">{Math.round(modulation * 100)}%</span>
                        </Label>
                        <Slider
                          value={[modulation]}
                          onValueChange={([v]) => setModulation(v)}
                          min={0}
                          max={1}
                          step={0.01}
                          className="w-full"
                        />
                      </div>

                      {/* Transpose */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Transpose</span>
                          <span className="text-muted-foreground font-mono">{transpose > 0 ? '+' : ''}{transpose} st</span>
                        </Label>
                        <Slider
                          value={[transpose]}
                          onValueChange={([v]) => setTranspose(Math.round(v))}
                          min={-24}
                          max={24}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Velocity Curve */}
                      <div className="space-y-2">
                        <Label className="text-xs">Velocity Curve</Label>
                        <Select value={velocityCurve.toString()} onValueChange={(v) => setVelocityCurve(parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VELOCITY_CURVES.map((curve, idx) => (
                              <SelectItem key={idx} value={idx.toString()}>
                                {curve.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Global Tuning */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Global Tune</span>
                          <span className="text-muted-foreground font-mono">{globalTuning > 0 ? '+' : ''}{globalTuning} cents</span>
                        </Label>
                        <Slider
                          value={[globalTuning]}
                          onValueChange={([v]) => setGlobalTuning(Math.round(v))}
                          min={-100}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Sustain Pedal */}
                      <div className="space-y-2">
                        <Label className="text-xs">Sustain Pedal</Label>
                        <Button
                          variant={sustain ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSustain(prev => !prev)}
                          className="w-full"
                        >
                          {sustain ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                    </div>

                    {/* Velocity Curve Info */}
                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">
                        <strong>{VELOCITY_CURVES[velocityCurve].name}:</strong> {VELOCITY_CURVES[velocityCurve].description}
                      </p>
                    </div>
                  </TabsContent>

                  {/* ── Effects Tab ── */}
                  <TabsContent value="effects" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Object.entries(effects).map(([effectName, value]) => (
                        <div key={effectName} className="space-y-2">
                          <Label className="text-xs flex items-center justify-between capitalize">
                            <span>{effectName}</span>
                            <span className="text-muted-foreground font-mono">{Math.round(value * 100)}%</span>
                          </Label>
                          <Slider
                            value={[value]}
                            onValueChange={([v]) => handleEffectChange(effectName as keyof EffectSettings, v)}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={resetEffects} className="flex-1">
                        <SkipBack className="w-4 h-4 mr-2" />
                        Reset All Effects
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowWaveforms(prev => !prev)}
                        className="flex-1"
                      >
                        {showWaveforms ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                        {showWaveforms ? 'Hide' : 'Show'} Waveform
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ── Recording Tab ── */}
                  <TabsContent value="recording" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant={isRecording ? 'destructive' : 'default'}
                        size="sm"
                        onClick={isRecording ? stopRecording : startRecording}
                        className="w-full"
                      >
                        {isRecording ? (
                          <>
                            <StopCircle className="w-4 h-4 mr-2 animate-pulse" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4 mr-2" />
                            Record
                          </>
                        )}
                      </Button>

                      <Button
                        variant={isPlaying ? 'default' : 'outline'}
                        size="sm"
                        onClick={isPlaying ? stopPlayback : startPlayback}
                        disabled={recordedNotes.length === 0}
                        className="w-full"
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-4 h-4 mr-2" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Play
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearRecording}
                        disabled={recordedNotes.length === 0}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportRecording}
                        disabled={recordedNotes.length === 0}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Quantize</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={quantizeEnabled}
                            onCheckedChange={(checked) => setQuantizeEnabled(!!checked)}
                          />
                          <Select
                            value={quantizeGrid.toString()}
                            onValueChange={(v) => setQuantizeGrid(parseInt(v))}
                            disabled={!quantizeEnabled}
                          >
                            <SelectTrigger className="h-7 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="4">1/4</SelectItem>
                              <SelectItem value="8">1/8</SelectItem>
                              <SelectItem value="16">1/16</SelectItem>
                              <SelectItem value="32">1/32</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={quantizeRecording}
                            disabled={!quantizeEnabled || recordedNotes.length === 0}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">
                        {recordedNotes.length === 0 ? (
                          'No recording yet. Press Record to start capturing your performance.'
                        ) : (
                          <>
                            <strong>{recordedNotes.length} notes</strong> recorded
                            {isRecording && <span className="ml-2 text-red-400 animate-pulse">● Recording...</span>}
                          </>
                        )}
                      </p>
                    </div>
                  </TabsContent>

                  {/* ── Arpeggiator Tab ── */}
                  <TabsContent value="arpeggiator" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Arpeggiator</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={arpeggiator.enabled}
                          onCheckedChange={(checked) =>
                            setArpeggiator({ ...arpeggiator, enabled: !!checked })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {arpeggiator.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    {arpeggiator.enabled && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Pattern */}
                          <div className="space-y-2">
                            <Label className="text-xs">Pattern</Label>
                            <Select
                              value={arpeggiator.pattern}
                              onValueChange={(v: any) => setArpeggiator({ ...arpeggiator, pattern: v })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ARP_PATTERNS.map(p => (
                                  <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Speed */}
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center justify-between">
                              <span>Speed (BPM)</span>
                              <span className="text-muted-foreground font-mono">{arpeggiator.speed}</span>
                            </Label>
                            <Slider
                              value={[arpeggiator.speed]}
                              onValueChange={([v]) => setArpeggiator({ ...arpeggiator, speed: v })}
                              min={40}
                              max={300}
                              step={1}
                            />
                          </div>

                          {/* Octaves */}
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center justify-between">
                              <span>Octaves</span>
                              <span className="text-muted-foreground font-mono">{arpeggiator.octaves}</span>
                            </Label>
                            <Slider
                              value={[arpeggiator.octaves]}
                              onValueChange={([v]) => setArpeggiator({ ...arpeggiator, octaves: v })}
                              min={1}
                              max={4}
                              step={1}
                            />
                          </div>

                          {/* Gate */}
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center justify-between">
                              <span>Gate</span>
                              <span className="text-muted-foreground font-mono">{Math.round(arpeggiator.gate * 100)}%</span>
                            </Label>
                            <Slider
                              value={[arpeggiator.gate]}
                              onValueChange={([v]) => setArpeggiator({ ...arpeggiator, gate: v })}
                              min={0.1}
                              max={1}
                              step={0.05}
                            />
                          </div>

                          {/* Swing */}
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center justify-between">
                              <span>Swing</span>
                              <span className="text-muted-foreground font-mono">{Math.round(arpeggiator.swing * 100)}%</span>
                            </Label>
                            <Slider
                              value={[arpeggiator.swing]}
                              onValueChange={([v]) => setArpeggiator({ ...arpeggiator, swing: v })}
                              min={0}
                              max={1}
                              step={0.05}
                            />
                          </div>

                          {/* Probability */}
                          <div className="space-y-2">
                            <Label className="text-xs flex items-center justify-between">
                              <span>Probability</span>
                              <span className="text-muted-foreground font-mono">{Math.round(arpeggiator.probability * 100)}%</span>
                            </Label>
                            <Slider
                              value={[arpeggiator.probability]}
                              onValueChange={([v]) => setArpeggiator({ ...arpeggiator, probability: v })}
                              min={0}
                              max={1}
                              step={0.05}
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">
                            💡 {ARP_PATTERNS.find(p => p.value === arpeggiator.pattern)?.description}
                            {' • '}Held keys: {heldKeys.size}
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Advanced Tab ── */}
                  <TabsContent value="advanced" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Filter Type */}
                      <div className="space-y-2">
                        <Label className="text-xs">Filter Type</Label>
                        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lowpass">Low Pass</SelectItem>
                            <SelectItem value="highpass">High Pass</SelectItem>
                            <SelectItem value="bandpass">Band Pass</SelectItem>
                            <SelectItem value="notch">Notch</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Envelope Preset */}
                      <div className="space-y-2">
                        <Label className="text-xs">Envelope Preset</Label>
                        <Select value={envelopePreset} onValueChange={(v: any) => applyEnvelopePreset(v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pluck">Pluck</SelectItem>
                            <SelectItem value="pad">Pad</SelectItem>
                            <SelectItem value="organ">Organ</SelectItem>
                            <SelectItem value="percussion">Percussion</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Polyphony Limit */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center justify-between">
                          <span>Polyphony Limit</span>
                          <span className="text-muted-foreground font-mono">{polyphonyLimit}</span>
                        </Label>
                        <Slider
                          value={[polyphonyLimit]}
                          onValueChange={([v]) => setPolyphonyLimit(v)}
                          min={1}
                          max={64}
                          step={1}
                        />
                      </div>

                      {/* Voice Stealing */}
                      <div className="space-y-2">
                        <Label className="text-xs">Voice Stealing</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={voiceStealingEnabled}
                            onCheckedChange={(checked) => setVoiceStealingEnabled(!!checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {voiceStealingEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllAssignments}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear All Keys
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLockedKeys(new Set())}
                        className="flex-1"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Unlock All
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ── Presets Tab ── */}
                  <TabsContent value="presets" className="space-y-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
                        <DialogTrigger asChild>
                          <Button variant="default" size="sm">
                            <Save className="w-4 h-4 mr-2" />
                            Save New Preset
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Performance Preset</DialogTitle>
                            <DialogDescription>
                              Save your current configuration including samples, effects, and settings
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Preset Name</Label>
                              <Input
                                placeholder="My Preset"
                                value={currentPresetName}
                                onChange={(e) => setCurrentPresetName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description (Optional)</Label>
                              <Input
                                placeholder="What's this preset for?"
                                value={currentPresetDescription}
                                onChange={(e) => setCurrentPresetDescription(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSavePreset} disabled={!currentPresetName.trim()}>
                              Save Preset
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <span className="text-xs text-muted-foreground ml-auto">
                        {presets.length} preset{presets.length !== 1 ? 's' : ''} saved
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                      {presets.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground text-sm">
                          No presets saved yet. Create your first preset!
                        </div>
                      ) : (
                        presets.map((preset) => (
                          <div
                            key={preset.id}
                            className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold">{preset.name}</h4>
                              {preset.description && (
                                <p className="text-xs text-muted-foreground">{preset.description}</p>
                              )}
                              <div className="flex gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {Array.from(preset.assignments.values()).reduce((sum, layers) => sum + layers.length, 0)} sounds
                                </span>
                                {preset.sequenceData && (
                                  <span className="text-[10px] text-muted-foreground">
                                    • {preset.sequenceData.length} notes
                                  </span>
                                )}
                                {preset.createdAt && (
                                  <span className="text-[10px] text-muted-foreground">
                                    • {new Date(preset.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLoadPreset(preset)}
                              >
                                Load
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportPreset(preset)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePreset(preset.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                    </div>
                  )}
                </div>

                {/* ══════════════════════════════════════════════════════════════ */}
                {/* KEY EDITOR POPOVER */}
                {/* ══════════════════════════════════════════════════════════════ */}
                {keyToEdit !== null && (
                  <Popover open={keyToEdit !== null} onOpenChange={(open) => !open && setKeyToEdit(null)}>
                    <PopoverContent className="w-80">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">
                          Edit {PIANO_NOTES[keyToEdit % 12]}{4 + Math.floor(keyToEdit / 12)}
                        </h4>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (fileInputRef.current) {
                                fileInputRef.current.click();
                              }
                            }}
                            className="flex-1"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Add Sample
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleKeyLock(keyToEdit)}
                            className="flex-1"
                          >
                            {lockedKeys.has(keyToEdit) ? (
                              <>
                                <Unlock className="w-4 h-4 mr-2" />
                                Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4 mr-2" />
                                Lock
                              </>
                            )}
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Duplicate to...</Label>
                          <Select 
                            value="" 
                            onValueChange={(toKey) => {
                              handleDuplicateKey(keyToEdit, parseInt(toKey));
                              setKeyToEdit(null);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select key..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }).map((_, i) => {
                                if (i === keyToEdit) return null;
                                const note = PIANO_NOTES[i % 12];
                                const octave = 4 + Math.floor(i / 12);
                                return (
                                  <SelectItem key={i} value={i.toString()}>
                                    {note}{octave}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Layers ({assignments.get(keyToEdit)?.length || 0})</Label>
                          {assignments.get(keyToEdit)?.map((layer, i) => (
                            <div key={i} className="text-xs p-2 bg-muted rounded flex items-center justify-between">
                              <span className="truncate flex-1">{layer.name}</span>
                              <div 
                                className="w-3 h-3 rounded-full ml-2 flex-shrink-0" 
                                style={{ backgroundColor: layer.color }}
                              />
                            </div>
                          ))}
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const newAssignments = new Map(assignments);
                            newAssignments.delete(keyToEdit);
                            setAssignments(newAssignments);
                            setKeyToEdit(null);
                          }}
                          className="w-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear Key
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* ══════════════════════════════════════════════════════════════ */}
                {/* HELP TEXT */}
                {/* ══════════════════════════════════════════════════════════════ */}
                <div
                  className="text-[10px] text-muted-foreground/50 p-2.5 rounded-lg border border-border/30 space-y-0.5"
                  style={{
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.01) 100%)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06) inset',
                  }}
                >
                  <p>⌨️ <strong>Keyboard:</strong> Z-M (C4-C5), Q-I (C5-C6) • ↑↓ shift octaves</p>
                  <p>🎚️ <strong>Expression:</strong> 8 velocity curves • Pitch bend • Modulation • Transpose</p>
                  <p>🔊 <strong>Layering:</strong> Unlimited layers • Lock keys • ADSR • Filter & pan</p>
                  <p>⚡ <strong>Advanced:</strong> MIDI recording • 7-pattern arp with swing • 12 effects • Waveform viz</p>
                  <p>💾 <strong>Shortcuts:</strong> Ctrl+R (Rec) • Ctrl+P (Play) • Ctrl+Space (Sustain) • Drag & drop</p>
                </div>
                </div>

                {/* 3D Bottom shadow edge */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              </section>
            </TooltipProvider>
          );
        }

        export default PianoKeys;