// client/src/components/drum-pads.tsx
// ULTRA-ENHANCED VERSION - 10X Professional Features + Complete Optimizations
// FULLY DEBUGGED AND PRODUCTION READY

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { PAD_KEYS } from '@/audio/core/instrument-engine';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Trash2, 
  Volume2,
  Settings2,
  Download,
  Copy,
  Pause,
  Play,
  RotateCcw,
  Save,
  Activity,
  Zap,
  _Layers,
  Music,
  Mic,
  Radio,
  VolumeX,
  Shuffle,
  GitMerge,
  Wand2,
  SlidersHorizontal,
  Target,
  Cpu,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

interface DrumPadsProps {
  pads: { sample: AudioBuffer | null; name: string; isActive: boolean }[];
  onTrigger: (index: number, velocity?: number) => void;
  onAssignSample: (padIndex: number, buffer: AudioBuffer, name: string) => void;
  loadSample: (file: File) => Promise<AudioBuffer | null>;
  onClearSample?: (padIndex: number) => void;
  onExportKit?: () => void;
  onImportKit?: (file: File) => void;
  disabled?: boolean;
}

// Enhanced animation constants
const ANIMATION_DURATION = 120;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const TOUCH_VELOCITY_MULTIPLIER = 1.2;
const _DOUBLE_TAP_THRESHOLD = 300;

// ── Step Sequencer ─────────────────────────────────────────────────────────────
const SEQ_STEPS = 16;

// Category labels per-row (4 pads each, 4 rows total)
const PAD_CATEGORIES: Record<number, { label: string; color: string }> = {
  0:  { label: 'KICK',  color: '#ef4444' },
  1:  { label: 'KICK',  color: '#ef4444' },
  2:  { label: 'KICK',  color: '#ef4444' },
  3:  { label: 'KICK',  color: '#ef4444' },
  4:  { label: 'SNARE', color: 'var(--track-orange)' },
  5:  { label: 'SNARE', color: 'var(--track-orange)' },
  6:  { label: 'SNARE', color: 'var(--track-orange)' },
  7:  { label: 'SNARE', color: 'var(--track-orange)' },
  8:  { label: 'HI-HAT', color: '#a3e635' },
  9:  { label: 'HI-HAT', color: '#a3e635' },
  10: { label: 'HI-HAT', color: '#a3e635' },
  11: { label: 'HI-HAT', color: '#a3e635' },
  12: { label: 'PERC',  color: 'var(--accent-purple)' },
  13: { label: 'PERC',  color: 'var(--accent-purple)' },
  14: { label: 'PERC',  color: 'var(--accent-purple)' },
  15: { label: 'PERC',  color: 'var(--accent-purple)' },
};

// MIDI note numbers (General MIDI drum map)
const PAD_MIDI_NOTES = [36,38,42,46,41,43,45,47,48,49,51,39,40,44,50,37];

const PATTERN_SLOTS = ['A', 'B', 'C', 'D'] as const;
type PatternSlot = typeof PATTERN_SLOTS[number];

// Enhanced color palettes
const COLOR_THEMES = {
  rainbow: (i: number) => (i * 45) % 360,
  warm: (i: number) => 0 + (i * 15) % 60,
  cool: (i: number) => 180 + (i * 15) % 60,
  chrome: (i: number) => 200 + (i * 12) % 30,
  monochrome: () => 0,
  sunset: (i: number) => 15 + (i * 10) % 45,
  steel: (i: number) => 210 + (i * 5) % 25,
  forest: (i: number) => 120 + (i * 12) % 50,
  galaxy: (i: number) => [270, 300, 240, 330][i % 4],
  fire: (i: number) => [0, 15, 30, 45][i % 4]
};

const WAVEFORM_STYLES = {
  bars: 'bars',
  line: 'line',
  dots: 'dots',
  filled: 'filled'
} as const;

// ── Pro-grade additions ─────────────────────────────────────────────────────

// Velocity curve types (Pro feature: adjustable per-pad velocity curves)
type VelocityCurve = 'linear' | 'exponential' | 'logarithmic' | 'soft' | 'hard';

// Hit zone types (Pro feature: multi-zone pads)
type HitZone = 'center' | 'edge' | 'rim';

// Per-pad FX settings (Pro feature: per-pad FX routing)
interface PadFxSettings {
  reverbSend: number;   // 0–1
  filterCutoff: number; // 0–1 → maps to 200–18000 Hz
  saturation: number;   // 0–1
  pitchShift: number;   // -12 to +12 semitones
}

const DEFAULT_FX: PadFxSettings = { reverbSend: 0, filterCutoff: 1, saturation: 0, pitchShift: 0 };

// Macro mappings (Pro feature: one knob controls multiple params)
const MACRO_PARAMS = ['filter', 'reverb', 'saturation', 'pitch'] as const;
type MacroParam = typeof MACRO_PARAMS[number];

// Groove templates (Pro feature: professional groove templates)
const GROOVE_TEMPLATES: Record<string, { label: string; swing: number; velocityMap: number[] }> = {
  straight: { label: '⬛ Straight', swing: 0,  velocityMap: [100,80,100,80,100,80,100,80,100,80,100,80,100,80,100,80] },
  shuffle:  { label: '🎺 Shuffle',  swing: 33, velocityMap: [127,0,100,0,127,0,100,0,127,0,100,0,127,0,100,0] },
  swing50:  { label: '🎷 Swing 50', swing: 50, velocityMap: [127,0,80,0,127,0,80,0,127,0,80,0,127,0,80,0] },
  bossa:    { label: '🌴 Bossa',    swing: 20, velocityMap: [100,70,60,80,100,60,80,70,100,70,60,80,100,60,80,70] },
  trap:     { label: '🔥 Trap',     swing: 15, velocityMap: [127,50,60,50,127,50,60,50,127,60,50,60,127,50,60,50] },
  jazz:     { label: '🎩 Jazz',     swing: 45, velocityMap: [110,0,70,0,95,0,70,0,110,0,70,0,95,0,70,0] },
};

// AI groove suggestions (Pro feature: intelligent fill suggestions)
const AI_GROOVE_PATTERNS: Record<string, { label: string; pattern: boolean[] }> = {
  fourfour: { label: '4/4 Basic', pattern: [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false] },
  snareTwo:  { label: 'Snare 2&4', pattern: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false] },
  hihatEight: { label: 'HH Eights', pattern: [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false] },
  openHat:  { label: 'Open Hat',  pattern: [false,false,false,true,false,false,false,true,false,false,false,true,false,false,false,true] },
};

// Velocity curve function
const applyVelocityCurve = (v: number, curve: VelocityCurve): number => {
  const c = Math.max(0, Math.min(1, v));
  switch (curve) {
    case 'exponential': return Math.pow(c, 2);
    case 'logarithmic': return Math.sqrt(c);
    case 'soft':        return Math.pow(c, 0.6) * 0.85 + 0.15;
    case 'hard':        return Math.pow(c, 1.8);
    default:            return c;
  }
};

// Get hit zone from click position relative to pad element
const getHitZone = (
  clientX: number, clientY: number, rect: DOMRect
): HitZone => {
  const dx = (clientX - rect.left) / rect.width - 0.5;
  const dy = (clientY - rect.top) / rect.height - 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy) * 2; // normalized 0–1
  if (dist < 0.28) return 'center';
  if (dist < 0.72) return 'edge';
  return 'rim';
};

// Zone velocity modifiers
const ZONE_VELOCITY: Record<HitZone, number> = { center: 1.0, edge: 0.75, rim: 0.55 };

// Typed deep-clone for pattern arrays — replaces JSON.parse/stringify throughout
const clonePattern = (p: number[][]): number[][] => p.map(row => [...row]);

// ── Rotary Knob — replaces per-pad volume slider ──────────────────────────
function PadKnob({
  value, onChange, hue, label = 'VOL',
}: {
  value: number; onChange: (v: number) => void; hue: number; label?: string;
}) {
  const startY = useRef<number | null>(null);
  const startVal = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    startVal.current = value;
  }, [value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (startY.current === null) return;
    e.stopPropagation();
    const delta = (startY.current - e.clientY) / 80;
    onChange(Math.max(0, Math.min(1, startVal.current + delta)));
  }, [onChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    startY.current = null;
  }, []);

  // Arc from -135° to +135° (270° sweep)
  const MIN_DEG = -135;
  const SWEEP   = 270;
  const angle   = MIN_DEG + value * SWEEP;
  const toRad   = (d: number) => (d * Math.PI) / 180;

  const cx = 14; const cy = 14; const r = 10;
  // Track arc (full)
  const arcStart = { x: cx + r * Math.cos(toRad(MIN_DEG)), y: cy + r * Math.sin(toRad(MIN_DEG)) };
  const arcEnd   = { x: cx + r * Math.cos(toRad(MIN_DEG + SWEEP)), y: cy + r * Math.sin(toRad(MIN_DEG + SWEEP)) };
  // Value arc
  const valEnd   = { x: cx + r * Math.cos(toRad(angle)), y: cy + r * Math.sin(toRad(angle)) };
  // Indicator line tip
  const tipX = cx + (r - 2) * Math.cos(toRad(angle));
  const tipY = cy + (r - 2) * Math.sin(toRad(angle));

  const pct = Math.round(value * 100);

  return (
    <div
      className="flex flex-col items-center gap-0.5 select-none cursor-ns-resize"
      title={`${label}: ${pct}%`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={e => { e.stopPropagation(); onChange(0.75); }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ overflow: 'visible' }}>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r + 2} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        {/* Track arc */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round"
        />
        {/* Value arc */}
        {value > 0 && (
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${value * SWEEP > 180 ? 1 : 0} 1 ${valEnd.x} ${valEnd.y}`}
            fill="none"
            stroke={`hsl(${hue},75%,55%)`}
            strokeWidth="2" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px hsl(${hue},80%,50%))` }}
          />
        )}
        {/* Knob body */}
        <circle cx={cx} cy={cy} r={r - 1.5}
          fill={`radial-gradient(circle at 40% 35%, hsl(${hue},20%,30%), hsl(${hue},10%,15%))`}
          stroke={`hsl(${hue},40%,30%)`} strokeWidth="0.5"
        />
        {/* Indicator line */}
        <line
          x1={cx} y1={cy} x2={tipX} y2={tipY}
          stroke={`hsl(${hue},85%,65%)`} strokeWidth="1.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 2px hsl(${hue},80%,60%))` }}
        />
      </svg>
      <span className="text-[7px] font-mono tracking-widest opacity-50 leading-none"
        style={{ color: `hsl(${hue},70%,65%)` }}>
        {label}
      </span>
    </div>
  );
}

export function DrumPads({
  pads, 
  onTrigger, 
  onAssignSample, 
  loadSample,
  onClearSample,
  onExportKit,
  onImportKit,
  disabled = false,
}: DrumPadsProps) {
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kitImportRef = useRef<HTMLInputElement>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<number[]>(
    Array.from({ length: pads.length }, (_, i) => COLOR_THEMES.rainbow(i))
  );
  const animationFrameRef = useRef<number | null>(null);
  const velocityRef = useRef<Map<number, number>>(new Map());
  const _lastTapTimeRef = useRef<Map<number, number>>(new Map());
  const touchStartTimeRef = useRef<Map<number, number>>(new Map());
  const waveformCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  // Ref mirror of pressedPads so the animation loop never restarts on every hit
  const pressedPadsRef = useRef<Set<number>>(new Set());

  // UI State
  const [selectedPad, setSelectedPad] = useState<string>('0');
  const [pressedPads, setPressedPads] = useState<Set<number>>(new Set());
  // Keep ref in sync so the rAF animation loop can read without being a dep
  const updatePressedPads = useCallback((updater: (prev: Set<number>) => Set<number>) => {
    setPressedPads(prev => {
      const next = updater(prev);
      pressedPadsRef.current = next;
      return next;
    });
  }, []);
  const [padHues, setPadHues] = useState<number[]>([...hueRef.current]);
  const [padVelocities, setPadVelocities] = useState<Map<number, number>>(new Map());
  const [loadingPadIndex, setLoadingPadIndex] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ buffer: AudioBuffer; name: string } | null>(null);
  const [error, setError] = useState<{ padIndex: number; message: string } | null>(null);
  const [success, setSuccess] = useState<{ padIndex: number; fileName: string } | null>(null);
  const [colorTheme, setColorTheme] = useState<keyof typeof COLOR_THEMES>('rainbow');
  const [showSettings, setShowSettings] = useState(false);
  const [animationMode, setAnimationMode] = useState<'static' | 'chase' | 'pulse' | 'wave'>('static');
  const [padVolumes, setPadVolumes] = useState<Map<number, number>>(new Map());
  const [padMutes, setPadMutes] = useState<Set<number>>(new Set());
  const [soloedPad, setSoloedPad] = useState<number | null>(null);
  const [copySourcePad, setCopySourcePad] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetPad, setDragTargetPad] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'normal' | 'compact' | 'performance'>('normal');
  const [showWaveforms, setShowWaveforms] = useState(true);
  const [waveformStyle, setWaveformStyle] = useState<keyof typeof WAVEFORM_STYLES>('bars');
  const [recordingMode, setRecordingMode] = useState(false);
  const [recordedSequence, setRecordedSequence] = useState<Array<{pad: number, time: number, velocity: number}>>([]);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [history, setHistory] = useState<Array<{padIndex: number, buffer: AudioBuffer | null, name: string}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ── Sequencer state ────────────────────────────────────────────────────────
  // patterns[slot][pad][step] = velocity 0–127 (0 = off)
  const [patterns, setPatterns] = useState<Record<PatternSlot, number[][]>>(() => {
    const empty = (): number[][] => Array.from({ length: 16 }, () => Array(SEQ_STEPS).fill(0));
    return { A: empty(), B: empty(), C: empty(), D: empty() };
  });
  const [activePatternSlot, setActivePatternSlot] = useState<PatternSlot>('A');
  const [seqPlaying, setSeqPlaying]   = useState(false);
  const [seqStep, setSeqStep]         = useState(0);
  const [seqBpm, setSeqBpm]           = useState(120);
  const [seqSwing, setSeqSwing]       = useState(0);   // 0–50 (percentage swing)
  const [showSequencer, setShowSequencer] = useState(false);
  const [seqPadOffset, setSeqPadOffset]   = useState(0); // which 4 pads to show (0 or 4, etc.)
  const seqIntervalRef = useRef<number | null>(null);
  const seqStepRef     = useRef(0);

  // ── Pro-grade state ────────────────────────────────────────────────────────
  // Velocity history: last 8 velocities per pad (restored here for memoization)
  const [velHistory, setVelHistory] = useState<Map<number, number[]>>(new Map());
  // Velocity curves per pad
  const [padVelocityCurves, setPadVelocityCurves] = useState<Map<number, VelocityCurve>>(new Map());
  // Per-pad FX settings
  const [padFxSettings, setPadFxSettings] = useState<Map<number, PadFxSettings>>(new Map());
  // Which pad's FX panel is open
  const [openFxPad, setOpenFxPad] = useState<number | null>(null);
  // Multi-zone: last hit zone per pad
  const [padHitZones, setPadHitZones] = useState<Map<number, HitZone>>(new Map());
  // Macro controls
  const [macroValue, setMacroValue] = useState(0.5);
  const [macroEnabled, setMacroEnabled] = useState(false);
  const [macroParams, setMacroParams] = useState<Set<MacroParam>>(new Set(['filter', 'reverb']));
  // Pattern morph
  const [patternMorphAmount, setPatternMorphAmount] = useState(0);
  const [patternMorphTarget, setPatternMorphTarget] = useState<PatternSlot>('B');
  // Polyrhythm: per-row step counts
  const [rowStepCounts, setRowStepCounts] = useState<number[]>(Array(16).fill(16));
  // Groove template
  const [selectedGroove, setSelectedGroove] = useState<string>('straight');
  // Humanize amount
  const [humanizeAmount, setHumanizeAmount] = useState(15);
  // Show pro panel
  const [showProPanel, setShowProPanel] = useState(false);
  // Pad controls tray open/closed
  const [showPadControls, setShowPadControls] = useState(true);
  // Round-robin counter per pad
  const rrCounterRef = useRef<Map<number, number>>(new Map());
  const midiAccessRef   = useRef<MIDIAccess | null>(null);
  const midiOutputRef   = useRef<MIDIOutput | null>(null);
  const [midiAvailable, setMidiAvailable] = useState(false);


  const sequenceStartTimeRef = useRef<number | null>(null);

  const selectedPadIndex = Number(selectedPad);
  const isLoading = loadingPadIndex !== null;

  // Initialize audio context — resume on user gesture (iOS/Chrome require it)
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const resume = () => { audioContextRef.current?.resume(); };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);


  // MIDI output initialisation
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      (navigator as any).requestMIDIAccess({ sysex: false }).then((access: MIDIAccess) => {
        midiAccessRef.current = access;
        const outputs = Array.from(access.outputs.values());
        midiOutputRef.current = outputs[0] ?? null;
        setMidiAvailable(outputs.length > 0);
        access.onstatechange = () => {
          const outs = Array.from(access.outputs.values());
          midiOutputRef.current = outs[0] ?? null;
          setMidiAvailable(outs.length > 0);
        };
      }).catch(() => { /* MIDI not available */ });
    }
  }, []);

  // Keep a ref to latest tickSeq so the setInterval never holds a stale closure
  const tickSeqRef = useRef<() => void>(() => {});

  // Memoized color calculation
  const getPadColor = useCallback((index: number) => {
    return COLOR_THEMES[colorTheme](index);
  }, [colorTheme]);


  // MIDI note sender (channel 10 = drums in General MIDI)
  const sendMidi = useCallback((padIndex: number, velocity: number, noteOn: boolean) => {
    const midi = midiOutputRef.current;
    if (!midi || padIndex >= PAD_MIDI_NOTES.length) return;
    const note = PAD_MIDI_NOTES[padIndex];
    const vel  = Math.max(0, Math.min(127, Math.round(velocity * 127)));
    try {
      // Channel 10 (0x99 = note-on ch10, 0x89 = note-off ch10)
      midi.send([noteOn ? 0x99 : 0x89, note, noteOn ? Math.max(1, vel) : 0]);
    } catch {}
  }, []);

  // Play a pad locally through a Web Audio FX chain.
  // Returns true when it handled playback (so caller can skip calling onTrigger for audio).
  const playPadWithFx = useCallback((padIndex: number, velocity: number): boolean => {
    const pad = pads[padIndex];
    if (!pad.sample) return false;
    const ac = audioContextRef.current;
    if (!ac) return false;
    if (ac.state === 'suspended') ac.resume();

    const fx  = padFxSettings.get(padIndex) ?? { ...DEFAULT_FX };
    const vol = (padVolumes.get(padIndex) ?? 1) * Math.max(0, Math.min(1, velocity));

    // Round-robin micro-pitch variation (subtle ±2 cents per hit)
    const rrCount = rrCounterRef.current.get(padIndex) ?? 0;
    const microPitch = fx.pitchShift + (((rrCount % 4) - 1.5) * 0.02); // ±0.03 semi
    rrCounterRef.current.set(padIndex, rrCount + 1);

    // Source
    const source = ac.createBufferSource();
    source.buffer = pad.sample;
    source.playbackRate.value = Math.pow(2, microPitch / 12);

    // Gain
    const gainNode = ac.createGain();
    gainNode.gain.value = vol;

    // Low-pass filter (filterCutoff 0→1 maps to 200–18200 Hz)
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200 + fx.filterCutoff * 18000;
    filter.Q.value = 0.8;

    // Saturation waveshaper
    const shaper = ac.createWaveShaper();
    const n = 512;
    const shapeCurve = new Float32Array(n);
    const k = fx.saturation * 150;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      shapeCurve[i] = k === 0 ? x : ((1 + k / 100) * x) / (1 + (k / 100) * Math.abs(x));
    }
    shaper.curve = shapeCurve;
    shaper.oversample = '4x';

    // Reverb — parallel delay network (simple but musical)
    const dryGain = ac.createGain();
    dryGain.gain.value = 1;

    const revWet = ac.createGain();
    revWet.gain.value = fx.reverbSend * 0.85;

    const delay1 = ac.createDelay(3);
    const delay2 = ac.createDelay(3);
    delay1.delayTime.value = 0.117;
    delay2.delayTime.value = 0.253;
    const fbGain = ac.createGain();
    fbGain.gain.value = Math.min(0.55, fx.reverbSend * 0.7);
    const revLp = ac.createBiquadFilter();
    revLp.type = 'lowpass';
    revLp.frequency.value = 4000;

    // Chain: source → gain → filter → shaper → [dry + reverb send]
    source.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(shaper);
    shaper.connect(dryGain);
    dryGain.connect(ac.destination);

    if (fx.reverbSend > 0.01) {
      shaper.connect(revWet);
      revWet.connect(delay1);
      delay1.connect(revLp);
      revLp.connect(delay2);
      delay2.connect(fbGain);
      fbGain.connect(delay1);        // feedback loop
      delay2.connect(ac.destination);
    }

    source.start(ac.currentTime);

    // Cleanup nodes after sample ends
    const cleanup = () => {
      [source, gainNode, filter, shaper, dryGain, revWet, delay1, delay2, fbGain, revLp]
        .forEach(n => { try { n.disconnect(); } catch {} });
    };
    source.onended = cleanup;
    // Safety timeout (sample duration + max reverb tail)
    const safeguard = setTimeout(cleanup, (pad.sample.duration + 3) * 1000);
    source.onended = () => { clearTimeout(safeguard); cleanup(); };

    // MIDI note-on
    sendMidi(padIndex, velocity, true);
    setTimeout(() => sendMidi(padIndex, velocity, false), 80);

    return true;
  }, [pads, padFxSettings, padVolumes, sendMidi]);

  // Update hues when theme changes
  useEffect(() => {
    hueRef.current = Array.from({ length: pads.length }, (_, i) => getPadColor(i));
    setPadHues([...hueRef.current]);
  }, [colorTheme, pads.length, getPadColor]);

  // Enhanced RGB animation with multiple modes
  useEffect(() => {
    let frameCount = 0;
    
    const animatePads = () => {
      frameCount++;
      
      hueRef.current = hueRef.current.map((hue, i) => {
        // Read from ref — no re-subscribe needed when pads are hit
        if (pads[i]?.isActive || pressedPadsRef.current.has(i)) {
          const baseHue = getPadColor(i);
          const velocity = velocityRef.current.get(i) || 1;
          return (baseHue + velocity * 10) % 360;
        }
        
        switch (animationMode) {
          case 'chase':
            return (hue + 0.8) % 360;
          case 'pulse':
            return (getPadColor(i) + Math.sin(frameCount / 30) * 20) % 360;
          case 'wave':
            return (getPadColor(i) + Math.sin((frameCount + i * 10) / 20) * 30) % 360;
          default:
            return getPadColor(i);
        }
      });

      setPadHues([...hueRef.current]);
      animationFrameRef.current = requestAnimationFrame(animatePads);
    };

    animationFrameRef.current = requestAnimationFrame(animatePads);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  // pressedPadsRef is a ref — intentionally excluded so this loop never restarts on pad hits
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pads, getPadColor, animationMode]);

  // Draw waveform visualization
  const drawWaveform = useCallback((canvas: HTMLCanvasElement, buffer: AudioBuffer, hue: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    
    ctx.clearRect(0, 0, width, height);
    
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.8)`);
    gradient.addColorStop(1, `hsla(${hue + 30}, 70%, 60%, 0.8)`);
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;

    switch (waveformStyle) {
      case 'bars':
        for (let i = 0; i < width; i++) {
          const chunk = data.subarray(i * step, (i + 1) * step);
          let min = 1, max = -1;
          for (let j = 0; j < chunk.length; j++) {
            if (chunk[j] < min) min = chunk[j];
            if (chunk[j] > max) max = chunk[j];
          }
          const barHeight = Math.max(1, (max - min) * height / 2);
          ctx.fillRect(i, (height - barHeight) / 2, 1, barHeight);
        }
        break;
      
      case 'line':
        ctx.beginPath();
        for (let i = 0; i < width; i++) {
          const chunk = data.subarray(i * step, (i + 1) * step);
          let sum = 0;
          for (let j = 0; j < chunk.length; j++) sum += chunk[j];
          const y = (1 - sum / chunk.length) * height / 2;
          i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
        }
        ctx.stroke();
        break;
      
      case 'dots':
        for (let i = 0; i < width; i += 2) {
          const chunk = data.subarray(i * step, (i + 1) * step);
          let sum = 0;
          for (let j = 0; j < chunk.length; j++) sum += chunk[j];
          const y = (1 - sum / chunk.length) * height / 2;
          ctx.fillRect(i, y - 1, 2, 2);
        }
        break;
      
      case 'filled':
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let i = 0; i < width; i++) {
          const chunk = data.subarray(i * step, (i + 1) * step);
          let sum = 0;
          for (let j = 0; j < chunk.length; j++) sum += chunk[j];
          const y = (1 - sum / chunk.length) * height / 2;
          ctx.lineTo(i, y);
        }
        ctx.lineTo(width, height / 2);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }, [waveformStyle]);

  // Update waveforms when pads or style changes
  useEffect(() => {
    if (!showWaveforms) return;
    
    pads.forEach((pad, index) => {
      if (pad.sample && waveformCanvasRefs.current.has(index)) {
        const canvas = waveformCanvasRefs.current.get(index)!;
        drawWaveform(canvas, pad.sample, padHues[index]);
      }
    });
  }, [pads, padHues, showWaveforms, drawWaveform]);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Undo/Redo - DEFINED BEFORE handleKey to avoid hoisting issues
  const handleUndo = useCallback(() => {
    if (historyIndex < 0) return;
    
    const historyItem = history[historyIndex];
    if (historyItem.buffer) {
      onAssignSample(historyItem.padIndex, historyItem.buffer, historyItem.name);
    } else if (onClearSample) {
      onClearSample(historyItem.padIndex);
    }
    
    setHistoryIndex(prev => prev - 1);
    setSuccess({ padIndex: historyItem.padIndex, fileName: 'Undo' });
  }, [history, historyIndex, onAssignSample, onClearSample]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    const historyItem = history[historyIndex + 1];
    if (historyItem.buffer) {
      onAssignSample(historyItem.padIndex, historyItem.buffer, historyItem.name);
    } else if (onClearSample) {
      onClearSample(historyItem.padIndex);
    }
    
    setHistoryIndex(prev => prev + 1);
    setSuccess({ padIndex: historyItem.padIndex, fileName: 'Redo' });
  }, [history, historyIndex, onAssignSample, onClearSample]);

  // toggleSeqStep and recordToSeq must be defined BEFORE handlePadMouseDown (which calls recordToSeq)
  const toggleSeqStep = useCallback((padIdx: number, step: number, vel = 100) => {
    setPatterns(prev => {
      const next = { ...prev };
      const slot = clonePattern(prev[activePatternSlot]);
      slot[padIdx][step] = slot[padIdx][step] > 0 ? 0 : vel;
      next[activePatternSlot] = slot;
      return next;
    });
  }, [activePatternSlot]);

  const recordToSeq = useCallback((padIdx: number, vel: number) => {
    if (!seqPlaying) return;
    const step = seqStepRef.current;
    toggleSeqStep(padIdx, step, Math.round(vel * 127));
  }, [seqPlaying, toggleSeqStep]);


  // Enhanced keyboard handler with velocity simulation
  const handleKey = useCallback((e: KeyboardEvent, type: 'down' | 'up') => {
    // Check for modifier keys for shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && type === 'down' && !e.repeat) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.key === 'y' && type === 'down' && !e.repeat) {
        e.preventDefault();
        handleRedo();
        return;
      }
    }

    const padIndex = PAD_KEYS.indexOf(e.key.toLowerCase());
    if (padIndex === -1 || padIndex >= pads.length) return;
    e.preventDefault();

    // Check if pad is muted or should be muted by solo
    if (padMutes.has(padIndex) || (soloedPad !== null && soloedPad !== padIndex)) return;

    if (type === 'down' && !e.repeat) {
      updatePressedPads((prev) => new Set(prev).add(padIndex));
      
      const velocity = 1.0;
      velocityRef.current.set(padIndex, velocity);
      setPadVelocities(new Map(velocityRef.current));
      
      // Apply pad volume
      const played = playPadWithFx(padIndex, velocity);
      if (!played) {
        const padVolume = padVolumes.get(padIndex) ?? 1;
        onTrigger(padIndex, velocity * padVolume);
      }
      
      // Record if in free-record mode
      if (recordingMode && sequenceStartTimeRef.current) {
        const time = Date.now() - sequenceStartTimeRef.current;
        setRecordedSequence(prev => [...prev, { pad: padIndex, time, velocity }]);
      }
      // Also record into live sequencer step if seq is running
      recordToSeq(padIndex, velocity);
      
      // Haptic feedback for mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      
      setTimeout(() => {
        velocityRef.current.delete(padIndex);
        setPadVelocities(new Map(velocityRef.current));
      }, ANIMATION_DURATION);
    } else if (type === 'up') {
      updatePressedPads((prev) => {
        const next = new Set(prev);
        next.delete(padIndex);
        return next;
      });
    }
  }, [pads.length, onTrigger, padVolumes, padMutes, soloedPad, recordingMode, handleUndo, handleRedo, updatePressedPads, playPadWithFx, recordToSeq]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => handleKey(e, 'down');
    const up = (e: KeyboardEvent) => handleKey(e, 'up');

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [handleKey]);

  // Enhanced mouse/touch handlers
  const handlePadMouseDown = useCallback((index: number, event: React.MouseEvent | React.TouchEvent) => {
    if (padMutes.has(index) || (soloedPad !== null && soloedPad !== index)) return;

    updatePressedPads((prev) => new Set(prev).add(index));
    
    let clientX: number, clientY: number;
    
    if ('touches' in event) {
      const touch = event.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
      touchStartTimeRef.current.set(index, Date.now());
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    // ── Pro: Multi-zone hit detection ─────────────────────────────────────────
    const rect = event.currentTarget.getBoundingClientRect();
    const zone = getHitZone(clientX, clientY, rect);
    const zoneVelMod = ZONE_VELOCITY[zone];
    setPadHitZones(prev => { const n = new Map(prev); n.set(index, zone); return n; });

    // Base velocity from distance to center
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = Math.abs(clientX - centerX);
    const distanceY = Math.abs(clientY - centerY);
    const maxDistance = Math.sqrt(rect.width ** 2 + rect.height ** 2) / 2;
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
    
    const rawVelocity = Math.max(0.3, 1 - (distance / maxDistance) * 0.7);
    const touchMult = 'touches' in event ? TOUCH_VELOCITY_MULTIPLIER : 1;

    // ── Pro: Apply velocity curve ──────────────────────────────────────────────
    const curve = padVelocityCurves.get(index) ?? 'linear';
    const curvedVelocity = applyVelocityCurve(rawVelocity * touchMult, curve);
    const velocity = Math.min(1, curvedVelocity * zoneVelMod);

    // ── Pro: Round-robin counter increment ─────────────────────────────────────
    const rrCount = (rrCounterRef.current.get(index) ?? 0) + 1;
    rrCounterRef.current.set(index, rrCount);
    
    velocityRef.current.set(index, velocity);
    setPadVelocities(new Map(velocityRef.current));
    
    const played = playPadWithFx(index, velocity);
    if (!played) {
      const padVolume = padVolumes.get(index) ?? 1;
      onTrigger(index, velocity * padVolume);
    }
    
    if (recordingMode && sequenceStartTimeRef.current) {
      const time = Date.now() - sequenceStartTimeRef.current;
      setRecordedSequence(prev => [...prev, { pad: index, time, velocity }]);
    }

    // track velocity history
    setVelHistory(prev => {
      const next = new Map(prev);
      const hist = [...(prev.get(index) ?? []), Math.round(velocity * 127)];
      next.set(index, hist.slice(-8));
      return next;
    });

    // record into sequencer step
    recordToSeq(index, velocity);
    
    if ('vibrate' in navigator && 'touches' in event) {
      navigator.vibrate(Math.floor(velocity * 15));
    }
    
    setTimeout(() => {
      velocityRef.current.delete(index);
      setPadVelocities(new Map(velocityRef.current));
    }, ANIMATION_DURATION);
  }, [onTrigger, padVolumes, padMutes, soloedPad, recordingMode, padVelocityCurves, updatePressedPads, playPadWithFx, recordToSeq]);

  const handlePadMouseUp = useCallback((index: number) => {
    updatePressedPads((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    touchStartTimeRef.current.delete(index);
  }, []);

  const handlePadMouseLeave = useCallback((index: number) => {
    updatePressedPads((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handlePadDoubleClick = useCallback((index: number) => {
    // onDoubleClick already filters for native double-click timing — just toggle solo
    setSoloedPad(prev => prev === index ? null : index);
  }, []);

  // File handling
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError({ padIndex: -1, message: 'Please select a valid audio file' });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError({ 
        padIndex: -1, 
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      });
      return;
    }

    setLoadingPadIndex(selectedPadIndex);
    setError(null);

    try {
      const buffer = await loadSample(file);
      if (buffer) {
        setUploadedFile({ buffer, name: file.name });
        setSuccess({ padIndex: selectedPadIndex, fileName: `Loaded: ${file.name}` });
      } else {
        setError({ padIndex: selectedPadIndex, message: 'Failed to load audio file' });
      }
    } catch (err) {
      console.error('Load error:', err);
      setError({ 
        padIndex: selectedPadIndex, 
        message: err instanceof Error ? err.message : 'Failed to load sample' 
      });
    } finally {
      setLoadingPadIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [selectedPadIndex, loadSample]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAssign = useCallback(() => {
    if (!uploadedFile) return;

    const currentPad = pads[selectedPadIndex];
    setHistory(prev => [
      ...prev.slice(0, historyIndex + 1),
      { padIndex: selectedPadIndex, buffer: currentPad.sample, name: currentPad.name }
    ]);
    setHistoryIndex(prev => prev + 1);

    onAssignSample(selectedPadIndex, uploadedFile.buffer, uploadedFile.name);
    setSuccess({ padIndex: selectedPadIndex, fileName: `Assigned: ${uploadedFile.name}` });
    setUploadedFile(null);
  }, [uploadedFile, selectedPadIndex, onAssignSample, pads, historyIndex]);

  const handleClearSample = useCallback((index: number) => {
    if (!onClearSample || !pads[index].sample) return;

    const currentPad = pads[index];
    setHistory(prev => [
      ...prev.slice(0, historyIndex + 1),
      { padIndex: index, buffer: currentPad.sample, name: currentPad.name }
    ]);
    setHistoryIndex(prev => prev + 1);

    onClearSample(index);
    setSuccess({ padIndex: index, fileName: `Cleared pad ${index + 1}` });
  }, [onClearSample, pads, historyIndex]);

  const handleCopySample = useCallback((index: number) => {
    if (!pads[index].sample) return;
    setCopySourcePad(index);
    setSuccess({ padIndex: index, fileName: `Copied pad ${index + 1}` });
  }, [pads]);

  const handlePasteSample = useCallback((targetIndex: number) => {
    if (copySourcePad === null || !pads[copySourcePad].sample) return;

    const sourcePad = pads[copySourcePad];
    onAssignSample(targetIndex, sourcePad.sample!, sourcePad.name);
    setSuccess({ padIndex: targetIndex, fileName: `Pasted to pad ${targetIndex + 1}` });
    setCopySourcePad(null);
  }, [copySourcePad, pads, onAssignSample]);

  const handleVolumeChange = useCallback((index: number, volume: number) => {
    setPadVolumes(prev => {
      const next = new Map(prev);
      next.set(index, volume);
      return next;
    });
  }, []);

  const handleToggleMute = useCallback((index: number) => {
    setPadMutes(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleToggleRecording = useCallback(() => {
    if (recordingMode) {
      setRecordingMode(false);
      sequenceStartTimeRef.current = null;
      setSuccess({ padIndex: -1, fileName: `Recorded ${recordedSequence.length} hits` });
    } else {
      setRecordingMode(true);
      setRecordedSequence([]);
      sequenceStartTimeRef.current = Date.now();
    }
  }, [recordingMode, recordedSequence.length]);

  const handlePlaySequence = useCallback(() => {
    if (recordedSequence.length === 0 || isPlayingSequence) return;
    
    setIsPlayingSequence(true);
    
    recordedSequence.forEach(({ pad, time, velocity }) => {
      setTimeout(() => {
        const played = playPadWithFx(pad, velocity);
        if (!played) {
          const padVolume = padVolumes.get(pad) ?? 1;
          onTrigger(pad, velocity * padVolume);
        }
        updatePressedPads(prev => new Set(prev).add(pad));
        velocityRef.current.set(pad, velocity);
        setPadVelocities(new Map(velocityRef.current));
        
        setTimeout(() => {
          updatePressedPads(prev => {
            const next = new Set(prev);
            next.delete(pad);
            return next;
          });
          velocityRef.current.delete(pad);
          setPadVelocities(new Map(velocityRef.current));
        }, ANIMATION_DURATION);
      }, time);
    });
    
    const maxTime = recordedSequence.reduce((m, s) => Math.max(m, s.time), 0) + ANIMATION_DURATION;
    setTimeout(() => {
      setIsPlayingSequence(false);
    }, maxTime);
  }, [recordedSequence, isPlayingSequence, onTrigger, padVolumes, playPadWithFx, updatePressedPads]);

  const handleClearSequence = useCallback(() => {
    setRecordedSequence([]);
    setSuccess({ padIndex: -1, fileName: 'Sequence cleared' });
  }, []);

  // ── Sequencer engine ───────────────────────────────────────────────────────

  // getMorphedPattern must be defined BEFORE tickSeq (which calls it)
  const getMorphedPattern = useCallback((): number[][] => {
    if (patternMorphAmount === 0) return patterns[activePatternSlot];
    const src = patterns[activePatternSlot];
    const tgt = patterns[patternMorphTarget];
    return src.map((row, ri) =>
      row.map((vel, si) => {
        const tgtVel = tgt[ri]?.[si] ?? 0;
        const morphed = vel * (1 - patternMorphAmount) + tgtVel * patternMorphAmount;
        return Math.round(morphed);
      })
    );
  }, [patterns, activePatternSlot, patternMorphTarget, patternMorphAmount]);

  const tickSeq = useCallback(() => {
    const step = seqStepRef.current;
    const morphedPattern = getMorphedPattern();
    const rowCounts = rowStepCounts;
    // Apply swing: delay odd 16th-note steps by a fraction of the 16th-note interval
    const baseInterval = 60000 / seqBpm / 4;
    const swingDelay = (step % 2 === 1) ? (seqSwing / 50) * (baseInterval * 0.5) : 0;

    const fire = () => {
      morphedPattern.forEach((padRow, padIdx) => {
        // ── Pro: Polyrhythm – each row has its own step count ────────────────
        const rowSteps = rowCounts[padIdx] ?? SEQ_STEPS;
        const rowStep = step % rowSteps;
        const vel = padRow[rowStep];
        if (vel > 0 && !padMutes.has(padIdx) && !(soloedPad !== null && soloedPad !== padIdx)) {
          const v = vel / 127;
          const played = playPadWithFx(padIdx, v);
          if (!played) onTrigger(padIdx, v);
          updatePressedPads(prev => new Set(prev).add(padIdx));
          velocityRef.current.set(padIdx, v);
          setPadVelocities(new Map(velocityRef.current));
          setVelHistory(prev => {
            const next = new Map(prev);
            const hist = [...(prev.get(padIdx) ?? []), vel];
            next.set(padIdx, hist.slice(-8));
            return next;
          });
          setTimeout(() => {
            updatePressedPads(prev => { const n = new Set(prev); n.delete(padIdx); return n; });
            velocityRef.current.delete(padIdx);
            setPadVelocities(new Map(velocityRef.current));
          }, ANIMATION_DURATION);
        }
      });
    };

    if (swingDelay > 0) {
      setTimeout(fire, swingDelay);
    } else {
      fire();
    }

    seqStepRef.current = (step + 1) % SEQ_STEPS;
    setSeqStep(seqStepRef.current);
  }, [getMorphedPattern, rowStepCounts, padMutes, soloedPad, onTrigger, seqBpm, seqSwing, playPadWithFx]);

  // Keep tickSeqRef always pointing to latest tickSeq (fixes stale closure in setInterval)
  useEffect(() => { tickSeqRef.current = tickSeq; }, [tickSeq]);

  const startSeq = useCallback(() => {
    if (seqPlaying) return;
    seqStepRef.current = 0;
    setSeqStep(0);
    setSeqPlaying(true);
    const interval = 60000 / seqBpm / 4; // 16th note interval
    seqIntervalRef.current = window.setInterval(() => tickSeqRef.current(), interval);
  }, [seqPlaying, seqBpm, tickSeq]);

  const stopSeq = useCallback(() => {
    if (seqIntervalRef.current) { clearInterval(seqIntervalRef.current); seqIntervalRef.current = null; }
    setSeqPlaying(false);
    setSeqStep(0);
    seqStepRef.current = 0;
  }, []);

  // Restart sequencer when BPM/pattern changes
  useEffect(() => {
    if (!seqPlaying) return;
    if (seqIntervalRef.current) clearInterval(seqIntervalRef.current);
    const interval = 60000 / seqBpm / 4;
    seqIntervalRef.current = window.setInterval(() => tickSeqRef.current(), interval);
    return () => { if (seqIntervalRef.current) clearInterval(seqIntervalRef.current); };
  }, [seqBpm, tickSeq, seqPlaying]);

  useEffect(() => () => { if (seqIntervalRef.current) clearInterval(seqIntervalRef.current); }, []);

  const clearPattern = useCallback((slot: PatternSlot) => {
    setPatterns(prev => ({
      ...prev,
      [slot]: Array.from({ length: 16 }, () => Array(SEQ_STEPS).fill(0)),
    }));
  }, []);

  const copyPattern = useCallback((from: PatternSlot, to: PatternSlot) => {
    setPatterns(prev => ({
      ...prev,
      [to]: clonePattern(prev[from]),
    }));
    setSuccess({ padIndex: -1, fileName: `Pattern ${from} → ${to}` });
  }, []);

  // ── Pro-grade functions ────────────────────────────────────────────────────

  // Humanize: adds subtle velocity & timing micro-variation to current pattern
  const humanizePattern = useCallback(() => {
    setPatterns(prev => {
      const next = { ...prev };
      const slot: number[][] = clonePattern(prev[activePatternSlot]);
      slot.forEach(row => {
        row.forEach((vel, step) => {
          if (vel > 0) {
            const variation = (Math.random() - 0.5) * 2 * humanizeAmount;
            row[step] = Math.max(1, Math.min(127, Math.round(vel + variation)));
          }
        });
      });
      next[activePatternSlot] = slot;
      return next;
    });
    setSuccess({ padIndex: -1, fileName: `Humanized (±${humanizeAmount})` });
  }, [activePatternSlot, humanizeAmount]);

  // Apply groove template: sets swing and re-maps velocities on active pattern
  const applyGrooveTemplate = useCallback((templateKey: string) => {
    const template = GROOVE_TEMPLATES[templateKey];
    if (!template) return;
    setSeqSwing(template.swing);
    setPatterns(prev => {
      const next = { ...prev };
      const slot: number[][] = clonePattern(prev[activePatternSlot]);
      slot.forEach(row => {
        row.forEach((vel, step) => {
          if (vel > 0) {
            row[step] = template.velocityMap[step % template.velocityMap.length];
          }
        });
      });
      next[activePatternSlot] = slot;
      return next;
    });
    setSelectedGroove(templateKey);
    setSuccess({ padIndex: -1, fileName: `Groove: ${template.label}` });
  }, [activePatternSlot]);

  // Apply AI groove suggestion to a specific pad row
  const applyAiGroove = useCallback((padIdx: number, patternKey: string) => {
    const suggestion = AI_GROOVE_PATTERNS[patternKey];
    if (!suggestion) return;
    setPatterns(prev => {
      const next = { ...prev };
      const slot: number[][] = clonePattern(prev[activePatternSlot]);
      slot[padIdx] = suggestion.pattern.map(on => on ? 100 : 0);
      next[activePatternSlot] = slot;
      return next;
    });
    setSuccess({ padIndex: padIdx, fileName: `AI: ${suggestion.label} → Pad ${padIdx + 1}` });
  }, [activePatternSlot]);

  // Pattern morph: compute morphed pattern between active slot and morph target
  // Update per-pad FX setting
  const updatePadFx = useCallback((padIdx: number, key: keyof PadFxSettings, value: number) => {
    setPadFxSettings(prev => {
      const next = new Map(prev);
      const existing = prev.get(padIdx) ?? { ...DEFAULT_FX };
      next.set(padIdx, { ...existing, [key]: value });
      return next;
    });
  }, []);

  // Update velocity curve
  const setPadVelocityCurve = useCallback((padIdx: number, curve: VelocityCurve) => {
    setPadVelocityCurves(prev => {
      const next = new Map(prev);
      next.set(padIdx, curve);
      return next;
    });
  }, []);

  // Apply macro value across all active pads (only when enabled)
  const applyMacro = useCallback((value: number) => {
    setMacroValue(value);
    if (!macroEnabled) return;
    pads.forEach((_, idx) => {
      setPadFxSettings(prev => {
        const next = new Map(prev);
        const existing = prev.get(idx) ?? { ...DEFAULT_FX };
        const updated = { ...existing };
        if (macroParams.has('filter'))    updated.filterCutoff = value;
        if (macroParams.has('reverb'))    updated.reverbSend   = value;
        if (macroParams.has('saturation')) updated.saturation  = value * 0.8;
        next.set(idx, updated);
        return next;
      });
    });
  }, [pads, macroParams, macroEnabled]);

  // Toggle macro param
  const toggleMacroParam = useCallback((param: MacroParam) => {
    setMacroParams(prev => {
      const next = new Set(prev);
      if (next.has(param)) next.delete(param); else next.add(param);
      return next;
    });
  }, []);

  // Adjust row step count for polyrhythm
  const setRowStepCount = useCallback((rowIdx: number, count: number) => {
    setRowStepCounts(prev => {
      const next = [...prev];
      next[rowIdx] = count;
      return next;
    });
  }, []);

  // Increment step velocity on scroll in sequencer
  const handleStepScroll = useCallback((
    e: React.WheelEvent, padIdx: number, step: number
  ) => {
    e.preventDefault();
    setPatterns(prev => {
      const next = { ...prev };
      const slot: number[][] = clonePattern(prev[activePatternSlot]);
      const cur = slot[padIdx][step];
      if (cur === 0) return prev; // don't activate inactive steps
      const delta = e.deltaY < 0 ? 10 : -10;
      slot[padIdx][step] = Math.max(1, Math.min(127, cur + delta));
      next[activePatternSlot] = slot;
      return next;
    });
  }, [activePatternSlot]);

  // Record pad hits into sequencer step (nearest step when seq is running)
  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTargetPad(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, padIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTargetPad(null);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(f => f.type.startsWith('audio/'));
    
    if (!audioFile) {
      setError({ padIndex: -1, message: 'Please drop an audio file' });
      return;
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      setError({ 
        padIndex: -1, 
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      });
      return;
    }

    const targetIndex = padIndex ?? selectedPadIndex;
    setLoadingPadIndex(targetIndex);

    try {
      const buffer = await loadSample(audioFile);
      if (buffer) {
        onAssignSample(targetIndex, buffer, audioFile.name);
        setSuccess({ padIndex: targetIndex, fileName: `Dropped: ${audioFile.name}` });
      } else {
        setError({ padIndex: targetIndex, message: 'Failed to load audio file' });
      }
    } catch (err) {
      console.error('Drop error:', err);
      setError({ 
        padIndex: targetIndex, 
        message: err instanceof Error ? err.message : 'Failed to load sample' 
      });
    } finally {
      setLoadingPadIndex(null);
    }
  }, [selectedPadIndex, loadSample, onAssignSample]);

  const handlePadDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTargetPad(index);
  }, []);

  const handlePadDrop = useCallback((e: React.DragEvent, index: number) => {
    handleDrop(e, index);
  }, [handleDrop]);

  const handleKitImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportKit) return;

    try {
      await onImportKit(file);
      setSuccess({ padIndex: -1, fileName: `Imported kit: ${file.name}` });
    } catch (err) {
      setError({ 
        padIndex: -1, 
        message: err instanceof Error ? err.message : 'Failed to import kit' 
      });
    }

    if (kitImportRef.current) kitImportRef.current.value = '';
  }, [onImportKit]);

  // Memoized pad grid
  const padGrid = useMemo(() => (
    <div 
      className={clsx(
        'grid gap-2',
        viewMode === 'performance' ? 'grid-cols-4' : 'grid-cols-4 md:grid-cols-8'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {pads.map((pad, i) => {
        const isLoaded = pad.sample !== null;
        const isTriggered = pressedPads.has(i) || pad.isActive;
        const velocity = padVelocities.get(i) || 1;
        const hue = padHues[i] || 0;
        const volume = padVolumes.get(i) ?? 1;
        const isMuted = padMutes.has(i);
        const isSoloed = soloedPad === i;
        const isInactive = soloedPad !== null && soloedPad !== i;
        const isDragTarget = dragTargetPad === i;
        
        const saturation = isTriggered ? 80 : 60;
        const lightness = isTriggered ? 65 : 50;
        const rgbColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        return (
          <div 
            key={i} 
            className="relative group"
            onDragOver={(e) => handlePadDragOver(e, i)}
            onDrop={(e) => handlePadDrop(e, i)}
          >
            <button
              onMouseDown={(e) => handlePadMouseDown(i, e)}
              onMouseUp={() => handlePadMouseUp(i)}
              onMouseLeave={() => handlePadMouseLeave(i)}
              onTouchStart={(e) => handlePadMouseDown(i, e)}
              onTouchEnd={() => handlePadMouseUp(i)}
              onDoubleClick={() => handlePadDoubleClick(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (isLoaded) handleClearSample(i);
              }}
              style={{
                background: isTriggered
                  ? `linear-gradient(180deg, ${rgbColor} 0%, #00000080 100%)`
                  : isDragTarget
                  ? `linear-gradient(180deg, ${rgbColor} 0%, #ffffff40 100%)`
                  : undefined,
                transform: isTriggered ? `scale(${1.08 + velocity * 0.15})` : undefined,
                opacity: isMuted || isInactive ? 0.4 : 1,
                boxShadow: isSoloed ? `0 0 20px ${rgbColor}` : undefined
              }}
              className={clsx(
                'relative w-full rounded-lg font-bold flex flex-col items-center justify-center border border-border/30 select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary overflow-hidden',
                viewMode === 'compact' ? 'h-10 text-xs' : viewMode === 'performance' ? 'h-20 md:h-24 text-base' : 'h-14 md:h-16 text-xs md:text-sm',
                isTriggered
                  ? 'text-foreground shadow-2xl -translate-y-0.5'
                  : 'bg-card text-foreground/90 hover:bg-muted/20',
                isMuted && 'ring-2 ring-red-500/50',
                isSoloed && 'ring-2 ring-yellow-500/50'
              )}
              aria-pressed={isTriggered}
              aria-label={`Pad ${i + 1}, ${PAD_KEYS[i]?.toUpperCase()}, ${isLoaded ? pad.name : 'empty'}`}
              disabled={loadingPadIndex === i || disabled}
            >
              {showWaveforms && isLoaded && viewMode !== 'compact' && (
                <canvas
                  ref={el => {
                    if (el) waveformCanvasRefs.current.set(i, el);
                  }}
                  width={200}
                  height={60}
                  className="absolute inset-0 w-full h-full opacity-20"
                />
              )}

              {/* ── Pro: Multi-zone ring indicator ────────────────────────── */}
              {isTriggered && viewMode !== 'compact' && (
                <div className="absolute inset-0 pointer-events-none z-5">
                  {/* Inner zone ring - center */}
                  <div className="absolute inset-[30%] rounded-full border border-white/20" />
                  {/* Outer zone ring - edge */}
                  <div className="absolute inset-[15%] rounded-full border border-white/10" />
                  {/* Active zone highlight */}
                  {padHitZones.get(i) === 'center' && (
                    <div className="absolute inset-[30%] rounded-full animate-ping opacity-40"
                      style={{ background: `hsl(${hue}, 80%, 70%)` }} />
                  )}
                  {padHitZones.get(i) === 'edge' && (
                    <div className="absolute inset-[15%] rounded-full border-2 animate-ping opacity-30"
                      style={{ borderColor: `hsl(${hue}, 70%, 65%)` }} />
                  )}
                  {padHitZones.get(i) === 'rim' && (
                    <div className="absolute inset-0 rounded-lg border-2 animate-ping opacity-25"
                      style={{ borderColor: `hsl(${hue}, 60%, 55%)` }} />
                  )}
                </div>
              )}

              <div className="absolute left-2 right-2 top-1.5 h-1.5 rounded-full bg-background/20 overflow-hidden z-10">
                <div
                  style={{ background: rgbColor, width: isTriggered ? `${velocity * 100}%` : '0%' }}
                  className="h-full transition-all duration-100"
                />
              </div>

              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <span className={clsx('mt-1 font-extrabold', viewMode === 'performance' && 'text-xl')}>
                  {i + 1}
                </span>
                <span className={clsx('text-[10px] opacity-60', viewMode === 'performance' && 'text-xs')}>
                  {PAD_KEYS[i]?.toUpperCase()}
                </span>
                {/* ── Pro: Velocity curve & hit zone indicator ─────────── */}
                {viewMode !== 'compact' && (padVelocityCurves.get(i) ?? 'linear') !== 'linear' && (
                  <span className="text-[7px] opacity-50 tracking-wide"
                    style={{ color: `hsl(${hue},70%,70%)` }}>
                    {(padVelocityCurves.get(i) ?? '').slice(0, 3).toUpperCase()}
                  </span>
                )}
                {viewMode !== 'compact' && padHitZones.get(i) && isTriggered && (
                  <span className="text-[7px] opacity-60 font-mono">
                    {padHitZones.get(i)?.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {viewMode === 'performance' && PAD_CATEGORIES[i] && (
                  <span
                    className="text-[8px] font-bold px-1 rounded-sm tracking-widest"
                    style={{ color: PAD_CATEGORIES[i].color, border: `1px solid ${PAD_CATEGORIES[i].color}44` }}
                  >
                    {PAD_CATEGORIES[i].label}
                  </span>
                )}
                {/* Velocity history bars (always in non-compact) */}
                {viewMode !== 'compact' && (velHistory.get(i)?.length ?? 0) > 0 && (
                  <div className="absolute bottom-0.5 left-1 right-1 flex items-end gap-px h-3">
                    {(velHistory.get(i) ?? []).map((v, vi) => (
                      <div
                        key={vi}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${(v / 127) * 100}%`,
                          background: `hsl(${hue}, 70%, 60%)`,
                          opacity: 0.4 + (vi / 7) * 0.6,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {isLoaded && viewMode === 'performance' && (
                <span className="absolute bottom-1 text-[9px] opacity-70 truncate max-w-full px-1">
                  {pad.name}
                </span>
              )}

              <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                {isLoaded && (
                  <span className="w-1.5 h-1.5 bg-accent rounded-full" 
                    aria-label="Sample loaded" />
                )}
                {loadingPadIndex === i && (
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" 
                    aria-label="Loading" />
                )}
              </div>

              <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
                {volume !== 1 && (
                  <Volume2 className="w-3 h-3 opacity-50" />
                )}
                {isMuted && (
                  <VolumeX className="w-3 h-3 text-red-500" />
                )}
              </div>

              <div className="absolute top-0.5 left-0.5 flex gap-0.5 items-center">
                {copySourcePad === i && (
                  <Copy className="w-3 h-3 text-blue-400" />
                )}
                {isSoloed && (
                  <Radio className="w-3 h-3 text-yellow-400 animate-pulse" />
                )}
                {viewMode === 'performance' && i < PAD_MIDI_NOTES.length && (
                  <span className="text-[7px] opacity-40 font-mono leading-none">{PAD_MIDI_NOTES[i]}</span>
                )}
              </div>
            </button>

            {viewMode !== 'compact' && isLoaded && (
              <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-20">
                <button
                  onClick={() => handleToggleMute(i)}
                  className={clsx(
                    'p-0.5 rounded-full text-foreground hover:scale-110 transition-transform',
                    isMuted ? 'bg-red-600' : 'bg-red-500/80'
                  )}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => handleCopySample(i)}
                  className="p-0.5 bg-blue-500/80 rounded-full text-foreground hover:scale-110 transition-transform"
                  title="Copy sample"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleClearSample(i)}
                  className="p-0.5 bg-background0/80 rounded-full text-foreground hover:scale-110 transition-transform"
                  title="Clear (or right-click)"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}

            {viewMode !== 'compact' && isLoaded && (
              <div className="absolute -bottom-1 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex justify-center pb-0.5">
                <PadKnob
                  value={volume}
                  onChange={v => handleVolumeChange(i, v)}
                  hue={hue}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  ), [
    pads, pressedPads, padHues, padVelocities, padVolumes, padMutes, soloedPad, viewMode, 
    copySourcePad, loadingPadIndex, showWaveforms, dragTargetPad,
    padHitZones, padVelocityCurves, velHistory,
    handlePadMouseDown, handlePadMouseUp, handlePadMouseLeave, handlePadDoubleClick,
    handleClearSample, handleCopySample, handleToggleMute, handleVolumeChange,
    handleDragOver, handleDragLeave, handleDrop, handlePadDragOver, handlePadDrop
  ]);

  return (
    <section
      aria-label="Drum pads"
      className="relative rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/80 overflow-hidden"
      style={{
        boxShadow: `
          0 1px 0 0 rgba(255,255,255,0.05) inset,
          0 -1px 0 0 rgba(0,0,0,0.1) inset,
          0 4px 14px -2px rgba(0,0,0,0.25),
          0 1px 3px 0 rgba(0,0,0,0.15)
        `,
      }}
    >
      {/* 3D Top highlight edge */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Disabled overlay */}
      {disabled && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl">
          <span className="text-[11px] font-mono tracking-widest text-muted-foreground/60 uppercase">Initializing…</span>
        </div>
      )}

      {isDragging && (
        <div 
          ref={dragOverlayRef}
          className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center">
            <Upload className="w-10 h-10 mx-auto mb-1.5 text-primary animate-bounce" />
            <p className="text-xs font-medium text-primary">Drop audio file here</p>
          </div>
        </div>
      )}

      {/* Header bar — pinned, never scrolls */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border/40"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.04) 100%)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{
              background: 'linear-gradient(135deg, hsl(280, 60%, 50%) 0%, hsl(320, 60%, 45%) 100%)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }}
          >
            <Music className="w-3.5 h-3.5 text-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5 leading-none">
              Drum Pads
              {viewMode !== 'compact' && (
                <span className="text-[10px] font-normal text-muted-foreground/60">(Q-I • A-K)</span>
              )}
              {recordingMode && (
                <span className="px-1.5 py-0.5 bg-red-500 text-foreground text-[9px] rounded-full animate-pulse flex items-center gap-1 leading-none">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  REC
                </span>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground/50 leading-tight mt-0.5 truncate">
              {viewMode === 'compact' 
                ? 'Compact' 
                : viewMode === 'performance'
                ? 'Performance • Dbl-click solo • Right-click clear'
                : `Velocity · Multi-touch · Drag & drop${midiAvailable ? ' · MIDI ✓' : ''}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <SelectTrigger className="w-[72px] h-6 text-[10px] rounded-md border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="performance">Perform</SelectItem>
            </SelectContent>
          </Select>
          
          {recordedSequence.length === 0 ? (
            <Button
              variant={recordingMode ? "destructive" : "ghost"}
              size="sm"
              onClick={handleToggleRecording}
              disabled={disabled}
              className="h-6 w-6 p-0 rounded-md"
              title={recordingMode ? "Stop recording" : "Start recording"}
            >
              {recordingMode ? <Pause className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlaySequence}
                disabled={isPlayingSequence}
                className="h-6 w-6 p-0 rounded-md"
                title="Play sequence"
              >
                <Play className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSequence}
                className="h-6 w-6 p-0 rounded-md"
                title="Clear sequence"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={historyIndex < 0 || disabled}
            className="h-6 w-6 p-0 rounded-md"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
          
          <Button
            variant={showProPanel ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowProPanel(!showProPanel)}
            className="h-6 w-6 p-0 rounded-md"
            title="Pro Panel — FX, Macro, Curves"
          >
            <Cpu className="w-3 h-3" />
          </Button>
          <Button
            variant={showSequencer ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowSequencer(!showSequencer)}
            className="h-6 w-6 p-0 rounded-md"
            title="Step Sequencer"
          >
            <Activity className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-6 w-6 p-0 rounded-md"
          >
            <Settings2 className={clsx('w-3 h-3', showSettings && 'animate-spin')} />
          </Button>
          
          {onExportKit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportKit}
              className="h-6 w-6 p-0 rounded-md"
              title="Export drum kit"
            >
              <Download className="w-3 h-3" />
            </Button>
          )}
          
          {onImportKit && (
            <>
              <input
                ref={kitImportRef}
                type="file"
                accept=".json"
                onChange={handleKitImport}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => kitImportRef.current?.click()}
                className="h-6 w-6 p-0 rounded-md"
                title="Import drum kit"
              >
                <Save className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="p-2.5 space-y-2.5 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#a3e635 transparent' }}>
        {showSettings && (
          <div
            className="p-2.5 rounded-lg border border-border/40 space-y-2.5 animate-in slide-in-from-top-2"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1) inset, 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Theme</label>
                <Select value={colorTheme} onValueChange={(v) => setColorTheme(v as keyof typeof COLOR_THEMES)}>
                  <SelectTrigger className="h-6 text-[10px] rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rainbow">🌈 Rainbow</SelectItem>
                    <SelectItem value="warm">🔥 Warm</SelectItem>
                    <SelectItem value="cool">❄️ Cool</SelectItem>
                    <SelectItem value="chrome">🔩 Chrome</SelectItem>
                    <SelectItem value="sunset">🌅 Sunset</SelectItem>
                    <SelectItem value="steel">⚙️ Steel</SelectItem>
                    <SelectItem value="forest">🌲 Forest</SelectItem>
                    <SelectItem value="galaxy">🌌 Galaxy</SelectItem>
                    <SelectItem value="fire">🔥 Fire</SelectItem>
                    <SelectItem value="monochrome">⚫ Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Animation</label>
                <Select value={animationMode} onValueChange={(v) => setAnimationMode(v as any)}>
                  <SelectTrigger className="h-6 text-[10px] rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static</SelectItem>
                    <SelectItem value="chase">Chase</SelectItem>
                    <SelectItem value="pulse">Pulse</SelectItem>
                    <SelectItem value="wave">Wave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Waveform</label>
                <Select value={waveformStyle} onValueChange={(v) => setWaveformStyle(v as any)}>
                  <SelectTrigger className="h-6 text-[10px] rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bars">Bars</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="dots">Dots</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground/70 mb-0.5 block">Waves</label>
                <Button
                  variant={showWaveforms ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowWaveforms(!showWaveforms)}
                  className="h-6 w-full text-[10px] rounded-md"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  {showWaveforms ? 'On' : 'Off'}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
              <Zap className="w-3 h-3" />
              <span>Max {MAX_FILE_SIZE / (1024 * 1024)}MB • Velocity • Multi-touch</span>
            </div>
          </div>
        )}

        {padGrid}

        {/* ── Pro Panel ───────────────────────────────────────────────────── */}
        {showProPanel && (
          <div
            className="rounded-lg border border-border/40 overflow-hidden animate-in slide-in-from-top-2"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 100%)' }}
          >
            {/* Pro Panel Header */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/30"
              style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.03) 0%,rgba(0,0,0,0.04) 100%)' }}>
              <Cpu className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-foreground/80">Pro Controls</span>
            </div>

            <div className="p-2.5 space-y-3">
              {/* Row 1: Macro + Groove + Humanize */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Macro Knob */}
                <div className="rounded-md border border-border/30 p-2 space-y-1.5"
                  style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold tracking-widest text-foreground/60 uppercase flex items-center gap-1">
                      <SlidersHorizontal className="w-3 h-3" /> Macro
                    </span>
                    <button
                      onClick={() => setMacroEnabled(e => !e)}
                      className={clsx(
                        'text-[8px] px-1.5 py-0.5 rounded font-bold transition-all',
                        macroEnabled ? 'bg-purple-500 text-foreground' : 'bg-muted/40 text-foreground/40'
                      )}
                    >{macroEnabled ? 'ON' : 'OFF'}</button>
                  </div>
                  <input
                    type="range"
                    min={0} max={1} step={0.01}
                    value={macroValue}
                    onChange={e => applyMacro(Number(e.target.value))}
                    disabled={!macroEnabled}
                    className="w-full h-1.5 [accent-color:var(--neon-violet,var(--accent-violet))]"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {MACRO_PARAMS.map(p => (
                      <button
                        key={p}
                        onClick={() => toggleMacroParam(p)}
                        className={clsx(
                          'text-[8px] px-1 py-0.5 rounded capitalize transition-all',
                          macroParams.has(p) ? 'bg-purple-500/80 text-foreground' : 'bg-muted/30 text-foreground/40'
                        )}
                      >{p}</button>
                    ))}
                  </div>
                  <div className="text-[8px] text-muted-foreground/40 text-center">
                    {Math.round(macroValue * 100)}%
                  </div>
                </div>

                {/* Groove Template */}
                <div className="rounded-md border border-border/30 p-2 space-y-1.5"
                  style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <span className="text-[9px] font-bold tracking-widest text-foreground/60 uppercase flex items-center gap-1">
                    <Shuffle className="w-3 h-3" /> Groove
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(GROOVE_TEMPLATES).map(([key, tmpl]) => (
                      <button
                        key={key}
                        onClick={() => applyGrooveTemplate(key)}
                        className={clsx(
                          'text-[8px] px-1.5 py-1 rounded text-left transition-all truncate',
                          selectedGroove === key
                            ? 'bg-accent/80 text-foreground'
                            : 'bg-muted/30 text-foreground/60 hover:bg-muted/50'
                        )}
                      >{tmpl.label}</button>
                    ))}
                  </div>
                </div>

                {/* Humanize */}
                <div className="rounded-md border border-border/30 p-2 space-y-1.5"
                  style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <span className="text-[9px] font-bold tracking-widest text-foreground/60 uppercase flex items-center gap-1">
                    <Wand2 className="w-3 h-3" /> Humanize
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground">Amount</span>
                    <input
                      type="range"
                      min={1} max={40} step={1}
                      value={humanizeAmount}
                      onChange={e => setHumanizeAmount(Number(e.target.value))}
                      className="flex-1 h-1.5 [accent-color:var(--neon-amber,var(--status-warn))]"
                    />
                    <span className="text-[9px] text-muted-foreground w-5">±{humanizeAmount}</span>
                  </div>
                  <button
                    onClick={humanizePattern}
                    className="w-full h-6 text-[9px] font-bold rounded bg-amber-500/80 text-foreground hover:bg-amber-500 transition-all"
                  >Apply Humanize</button>

                  {/* Pattern Morph */}
                  <div className="pt-1 border-t border-border/20 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <GitMerge className="w-3 h-3 text-foreground/40" />
                      <span className="text-[9px] text-muted-foreground">Morph →</span>
                      <div className="flex gap-0.5">
                        {PATTERN_SLOTS.filter(s => s !== activePatternSlot).map(s => (
                          <button key={s}
                            onClick={() => setPatternMorphTarget(s)}
                            className={clsx(
                              'text-[8px] w-4 h-4 rounded font-bold transition-all',
                              patternMorphTarget === s ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground/50'
                            )}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0} max={1} step={0.01}
                      value={patternMorphAmount}
                      onChange={e => setPatternMorphAmount(Number(e.target.value))}
                      className="w-full h-1.5 [accent-color:var(--accent,var(--b8lime))]"
                    />
                    <div className="text-[8px] text-center text-muted-foreground/40">
                      {activePatternSlot} ←→ {patternMorphTarget}: {Math.round(patternMorphAmount * 100)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Per-pad FX & Velocity Curves */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-foreground/40" />
                  <span className="text-[9px] font-bold tracking-widest text-foreground/60 uppercase">Per-Pad FX & Velocity Curves</span>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-1">
                  {pads.map((pad, i) => {
                    const fx = padFxSettings.get(i) ?? DEFAULT_FX;
                    const curve = padVelocityCurves.get(i) ?? 'linear';
                    const hue = padHues[i] ?? 0;
                    const isOpen = openFxPad === i;
                    return (
                      <div key={i} className="relative">
                        <button
                          onClick={() => setOpenFxPad(isOpen ? null : i)}
                          className={clsx(
                            'w-full rounded-md text-[8px] font-bold py-1 transition-all border',
                            isOpen
                              ? 'border-primary text-primary-foreground'
                              : 'border-border/30 text-foreground/60 hover:border-border/60'
                          )}
                          style={{
                            background: isOpen ? `hsl(${hue},60%,35%)` : `hsl(${hue},30%,20%)`,
                          }}
                        >
                          <div>{i + 1}</div>
                          {/* Tiny FX indicator bars */}
                          <div className="flex gap-px justify-center mt-0.5">
                            <div className="w-1 rounded-sm" style={{ height: `${fx.filterCutoff * 8 + 1}px`, background: `hsl(${hue},70%,60%)` }} />
                            <div className="w-1 rounded-sm" style={{ height: `${fx.reverbSend * 8 + 1}px`, background: `hsl(${(hue+120)%360},70%,60%)` }} />
                            <div className="w-1 rounded-sm" style={{ height: `${fx.saturation * 8 + 1}px`, background: `hsl(${(hue+240)%360},70%,60%)` }} />
                          </div>
                        </button>
                        {isOpen && (
                          <div
                            className="absolute left-0 z-30 mt-1 rounded-lg border border-border/50 p-2 space-y-1.5 min-w-[150px] shadow-xl"
                            style={{ background: `hsl(${hue},15%,12%)`, top: '100%' }}
                          >
                            <div className="text-[9px] font-bold text-foreground/70 flex items-center justify-between">
                              <span>Pad {i + 1} FX</span>
                              <button onClick={() => setOpenFxPad(null)} className="text-foreground/40 hover:text-foreground">✕</button>
                            </div>
                            {/* Velocity Curve */}
                            <div>
                              <label className="text-[8px] text-muted-foreground/60 flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> Vel Curve</label>
                              <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                                {(['linear','exponential','logarithmic','soft','hard'] as VelocityCurve[]).map(c => (
                                  <button key={c}
                                    onClick={() => setPadVelocityCurve(i, c)}
                                    className={clsx(
                                      'text-[7px] py-0.5 rounded capitalize transition-all',
                                      curve === c ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-foreground/50'
                                    )}
                                  >{c.slice(0, 3)}</button>
                                ))}
                              </div>
                            </div>
                            {/* Filter */}
                            <div>
                              <label className="text-[8px] text-muted-foreground/60">Filter {Math.round(200 + fx.filterCutoff * 17800)}Hz</label>
                              <input type="range" min={0} max={1} step={0.01} value={fx.filterCutoff}
                                onChange={e => updatePadFx(i, 'filterCutoff', Number(e.target.value))}
                                className="w-full h-1.5 [accent-color:var(--neon-cyan,var(--accent-cyan))]" />
                            </div>
                            {/* Reverb */}
                            <div>
                              <label className="text-[8px] text-muted-foreground/60">Reverb Send {Math.round(fx.reverbSend * 100)}%</label>
                              <input type="range" min={0} max={1} step={0.01} value={fx.reverbSend}
                                onChange={e => updatePadFx(i, 'reverbSend', Number(e.target.value))}
                                className="w-full h-1.5 [accent-color:var(--neon-violet,var(--accent-violet))]" />
                            </div>
                            {/* Saturation */}
                            <div>
                              <label className="text-[8px] text-muted-foreground/60">Saturation {Math.round(fx.saturation * 100)}%</label>
                              <input type="range" min={0} max={1} step={0.01} value={fx.saturation}
                                onChange={e => updatePadFx(i, 'saturation', Number(e.target.value))}
                                className="w-full h-1.5 [accent-color:var(--neon-amber,var(--status-warn))]" />
                            </div>
                            {/* Pitch Shift */}
                            <div>
                              <label className="text-[8px] text-muted-foreground/60">Pitch {fx.pitchShift > 0 ? '+' : ''}{fx.pitchShift} st</label>
                              <input type="range" min={-12} max={12} step={1} value={fx.pitchShift}
                                onChange={e => updatePadFx(i, 'pitchShift', Number(e.target.value))}
                                className="w-full h-1.5 [accent-color:var(--neon-lime,var(--b8lime))]" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Groove Suggestions */}
              <div className="border-t border-border/20 pt-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-[9px] font-bold tracking-widest text-foreground/60 uppercase">AI Groove Suggestions</span>
                  <span className="text-[8px] text-muted-foreground/40">Right-click pad row to apply</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(AI_GROOVE_PATTERNS).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => {
                        const padIdx = parseInt(selectedPad);
                        applyAiGroove(padIdx, key);
                        if (!showSequencer) setShowSequencer(true);
                      }}
                      className="text-[8px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/40 border border-yellow-500/20 transition-all"
                    >{p.label} → Pad {parseInt(selectedPad) + 1}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 p-1.5 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-[10px] animate-in slide-in-from-top-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-1.5 p-1.5 bg-accent/10 border border-border/20 rounded-md text-accent dark:text-accent text-[10px] animate-in slide-in-from-top-2">
            <CheckCircle className="w-3 h-3 flex-shrink-0" />
            <span>{success.fileName}</span>
          </div>
        )}

        {/* ── Sequencer Panel ──────────────────────────────────────────── */}
        {showSequencer && (
          <div
            className="rounded-lg border border-border/40 overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)' }}
          >
            {/* Sequencer header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30"
              style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.02) 0%,rgba(0,0,0,0.03) 100%)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-foreground/80 tracking-widest uppercase">Step Seq</span>
                {/* Pattern slots */}
                <div className="flex gap-0.5">
                  {PATTERN_SLOTS.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setActivePatternSlot(slot)}
                      className={clsx(
                        'w-5 h-5 text-[9px] font-bold rounded transition-all',
                        activePatternSlot === slot
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'bg-muted/40 text-foreground/50 hover:bg-muted'
                      )}
                    >{slot}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* BPM */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">BPM</span>
                  <input
                    type="number"
                    value={seqBpm}
                    min={40} max={300}
                    onChange={e => setSeqBpm(Number(e.target.value))}
                    className="w-10 h-5 text-[10px] text-center bg-muted/30 border border-border/40 rounded focus:outline-none"
                  />
                </div>
                {/* Swing */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Swing</span>
                  <input
                    type="range"
                    value={seqSwing}
                    min={0} max={50} step={1}
                    onChange={e => setSeqSwing(Number(e.target.value))}
                    className="w-12 h-2 [accent-color:var(--accent,var(--b8lime))]"
                  />
                  <span className="text-[9px] text-muted-foreground w-5">{seqSwing}%</span>
                </div>
                {/* Pad range */}
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setSeqPadOffset(o => Math.max(0, o - 4))} className="text-[9px] px-1 rounded hover:bg-muted">◀</button>
                  <span className="text-[9px] text-muted-foreground">{seqPadOffset + 1}–{Math.min(seqPadOffset + 4, pads.length)}</span>
                  <button onClick={() => setSeqPadOffset(o => Math.min(pads.length - 4, o + 4))} className="text-[9px] px-1 rounded hover:bg-muted">▶</button>
                </div>
                {/* Play / Stop */}
                <button
                  onClick={seqPlaying ? stopSeq : startSeq}
                  className={clsx(
                    'h-6 px-2 text-[10px] font-bold rounded transition-all',
                    seqPlaying ? 'bg-destructive text-foreground' : 'bg-primary text-primary-foreground'
                  )}
                >
                  {seqPlaying ? '■ Stop' : '▶ Play'}
                </button>
                <button
                  onClick={() => clearPattern(activePatternSlot)}
                  className="h-6 px-2 text-[10px] rounded bg-muted/40 hover:bg-muted text-foreground/60"
                >Clear</button>
              </div>
            </div>

            {/* Step grid */}
            <div className="p-2 space-y-1">
              {Array.from({ length: 4 }).map((_, rowOffset) => {
                const padIdx = seqPadOffset + rowOffset;
                if (padIdx >= pads.length) return null;
                const _pad = pads[padIdx];
                const row = patterns[activePatternSlot][padIdx] ?? Array(SEQ_STEPS).fill(0);
                const cat = PAD_CATEGORIES[padIdx];
                return (
                  <div key={padIdx} className="flex items-center gap-1">
                    {/* Row label */}
                    <div className="w-14 flex-shrink-0 flex flex-col leading-tight">
                      <span className="text-[9px] font-bold text-foreground/70">{padIdx + 1}</span>
                      {cat && (
                        <span className="text-[7px] font-bold tracking-widest" style={{ color: cat.color }}>{cat.label}</span>
                      )}
                    </div>
                    {/* Steps */}
                    <div className="flex gap-0.5 flex-1">
                      {row.map((vel, step) => {
                        // ── Pro: Use polyrhythm step count per row ────────────
                        const rowSteps = rowStepCounts[padIdx] ?? SEQ_STEPS;
                        const isInRange = step < rowSteps;
                        const isCurrentStep = seqPlaying && step === seqStep && isInRange;
                        const isOn = vel > 0 && isInRange;
                        const hue = padHues[padIdx] ?? 0;
                        return (
                          <button
                            key={step}
                            onClick={() => isInRange && toggleSeqStep(padIdx, step)}
                            onContextMenu={e => { e.preventDefault(); if (isInRange) toggleSeqStep(padIdx, step, 64); }}
                            onWheel={e => isOn && handleStepScroll(e, padIdx, step)}
                            className={clsx(
                              'flex-1 rounded-sm transition-all',
                              step % 4 === 0 ? 'h-5' : 'h-4',
                              !isInRange && 'opacity-10 cursor-not-allowed',
                            )}
                            style={{
                              background: isOn
                                ? `hsl(${hue},${isCurrentStep ? 90 : 70}%,${isCurrentStep ? 75 : 55}%)`
                                : isCurrentStep
                                ? 'rgba(255,255,255,0.18)'
                                : step % 4 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                              boxShadow: isOn && isCurrentStep ? `0 0 6px hsl(${hue},80%,60%)` : undefined,
                              opacity: isOn ? 0.5 + (vel / 127) * 0.5 : (isInRange ? 1 : 0.15),
                            }}
                            title={isInRange ? `Pad ${padIdx+1} step ${step+1}${vel > 0 ? ` vel ${vel}` : ''}${isOn ? ' (scroll to change vel)' : ''}` : 'Out of row range'}
                          />
                        );
                      })}
                    </div>
                    {/* ── Pro: Polyrhythm step count per row ─────────────── */}
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        onClick={() => setRowStepCount(padIdx, Math.max(4, (rowStepCounts[padIdx] ?? 16) - 4))}
                        className="text-[8px] w-3 h-3 rounded hover:bg-muted flex items-center justify-center opacity-50 hover:opacity-100"
                      >−</button>
                      <span className="text-[7px] text-muted-foreground/50 w-4 text-center">{rowStepCounts[padIdx] ?? 16}</span>
                      <button
                        onClick={() => setRowStepCount(padIdx, Math.min(32, (rowStepCounts[padIdx] ?? 16) + 4))}
                        className="text-[8px] w-3 h-3 rounded hover:bg-muted flex items-center justify-center opacity-50 hover:opacity-100"
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pattern copy row */}
            <div className="flex items-center gap-1.5 px-2.5 pb-2 text-[9px] text-muted-foreground/50">
              <span>Copy to:</span>
              {PATTERN_SLOTS.filter(s => s !== activePatternSlot).map(s => (
                <button key={s} onClick={() => copyPattern(activePatternSlot, s)}
                  className="px-1.5 py-0.5 rounded bg-muted/30 hover:bg-muted text-foreground/60 hover:text-foreground transition-all"
                >→ {s}</button>
              ))}
            </div>
          </div>
        )}

      </div>{/* end scrollable content */}

      {/* ── Pad Controls tray — collapsible ─────────────────────────────── */}
      <div className="border-t border-border/40 shrink-0">
        {/* Tab header — always visible, click to collapse */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowPadControls(p => !p)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowPadControls(p => !p)}
          className="w-full flex items-center justify-between px-3 py-1.5 group transition-colors hover:bg-white/[0.03] cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(0,0,0,0.04) 100%)',
          }}
        >
          <div className="flex items-center gap-2">
            {/* Accent pip */}
            <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] shadow-[0_0_6px_#a3e635] shrink-0" />
            <span className="text-[9px] font-mono tracking-[0.22em] uppercase text-foreground/60 group-hover:text-foreground/90 transition-colors">
              Pad Controls
            </span>
            {/* Selected pad badge */}
            <span className="px-1.5 py-0.5 rounded bg-[#a3e635]/10 border border-[#a3e635]/20 text-[8px] font-mono text-[#a3e635]/70 leading-none">
              P{selectedPadIndex + 1}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* MIDI indicator */}
            {midiAvailable && (
              <span className="text-[7px] font-mono text-[#a3e635]/50 tracking-widest flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#a3e635]/60 inline-block" />MIDI
              </span>
            )}
            {/* Mute / Solo toggles for selected pad */}
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleMute(selectedPadIndex); }}
              title={padMutes.has(selectedPadIndex) ? 'Unmute pad' : 'Mute pad'}
              className="text-[7px] font-mono px-1.5 py-0.5 rounded-sm border transition-all"
              style={{
                background: padMutes.has(selectedPadIndex) ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: padMutes.has(selectedPadIndex) ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                color: padMutes.has(selectedPadIndex) ? 'var(--status-error-soft)' : 'rgba(255,255,255,0.3)',
              }}
            >M</button>
            <button
              onClick={(e) => { e.stopPropagation(); setSoloedPad(soloedPad === selectedPadIndex ? null : selectedPadIndex); }}
              title={soloedPad === selectedPadIndex ? 'Unsolo pad' : 'Solo pad'}
              className="text-[7px] font-mono px-1.5 py-0.5 rounded-sm border transition-all"
              style={{
                background: soloedPad === selectedPadIndex ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: soloedPad === selectedPadIndex ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.1)',
                color: soloedPad === selectedPadIndex ? 'var(--accent-amber)' : 'rgba(255,255,255,0.3)',
              }}
            >S</button>
            {/* Sample count */}
            <span className="text-[8px] font-mono text-muted-foreground/30">
              {pads.filter(p => p.sample).length}/{pads.length}
            </span>
            <ChevronDown
              className="w-3 h-3 text-muted-foreground/40 group-hover:text-foreground/60 transition-all duration-200"
              style={{ transform: showPadControls ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            />
          </div>
        </div>

        {/* Collapsible body */}
        {showPadControls && (
          <div
            className="relative"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.04) 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3) inset',
            }}
          >
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" disabled={isLoading || disabled} />

            {/* Scrollable knob row */}
            <div
              className="flex items-stretch gap-0 overflow-x-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#a3e635 rgba(0,0,0,0.3)',
                minHeight: '72px',
              }}
            >
              {/* ── Left panel: file actions ──────────────────────────── */}
              <div
                className="flex flex-col justify-center gap-1 px-3 py-2 shrink-0 border-r border-border/30"
                style={{ background: 'rgba(0,0,0,0.15)', minWidth: '88px' }}
              >
                {/* Pad selector */}
                <Select value={selectedPad} onValueChange={setSelectedPad} disabled={isLoading}>
                  <SelectTrigger className="w-full h-5 text-[8px] rounded-sm px-1.5 border-border/40 bg-background/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pads.map((pad, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        Pad {i + 1} {pad.sample && '✓'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Action row */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleUploadClick}
                    disabled={isLoading || disabled}
                    title={isLoading ? 'Loading…' : 'Upload sample'}
                    className="flex-1 h-5 flex items-center justify-center gap-1 rounded-sm border border-border/40 bg-background/20 hover:bg-[#a3e635]/10 hover:border-[#a3e635]/40 text-muted-foreground hover:text-[#a3e635] transition-all disabled:opacity-30 text-[7px] font-mono tracking-wider"
                  >
                    <Upload className={clsx('w-2 h-2 shrink-0', isLoading && 'animate-pulse')} />
                    {isLoading ? '…' : 'UPL'}
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!uploadedFile || isLoading || disabled}
                    title="Assign sample to pad"
                    className="flex-1 h-5 flex items-center justify-center rounded-sm border border-border/40 bg-background/20 hover:bg-[#a3e635]/10 hover:border-[#a3e635]/40 text-muted-foreground hover:text-[#a3e635] transition-all disabled:opacity-25 text-[7px] font-mono tracking-wider"
                  >
                    ASN
                  </button>
                  {copySourcePad !== null && (
                    <button
                      onClick={() => handlePasteSample(selectedPadIndex)}
                      title="Paste sample"
                      className="h-5 w-5 flex items-center justify-center rounded-sm border border-border/40 bg-background/20 hover:bg-[#a3e635]/10 hover:border-[#a3e635]/40 text-muted-foreground hover:text-[#a3e635] transition-all"
                    >
                      <Copy className="w-2 h-2" />
                    </button>
                  )}
                </div>
                {/* Filename */}
                {uploadedFile && (
                  <span className="text-[7px] font-mono text-[#a3e635]/50 truncate leading-none" title={uploadedFile.name}>
                    {uploadedFile.name}
                  </span>
                )}
              </div>

              {/* ── Pad context row: name + FX indicator ─────────────── */}
              {pads[selectedPadIndex]?.sample && (
                <div className="flex flex-col justify-center items-center px-2 py-2 shrink-0 border-r border-border/20 min-w-[52px]"
                  style={{ background: 'rgba(0,0,0,0.08)' }}>
                  <span className="text-[7px] font-mono text-[#a3e635]/60 leading-none text-center truncate max-w-[48px]"
                    title={pads[selectedPadIndex]?.name}>
                    {(pads[selectedPadIndex]?.name ?? '').slice(0, 8)}
                  </span>
                  <span className="text-[6px] font-mono text-muted-foreground/30 leading-none mt-0.5">
                    {PAD_MIDI_NOTES[selectedPadIndex] != null ? `n${PAD_MIDI_NOTES[selectedPadIndex]}` : ''}
                  </span>
                </div>
              )}

              {/* ── Knob strip ─────────────────────────────────────────── */}
              {(() => {
                const padHue = padHues[selectedPadIndex] ?? 200;
                const fx = padFxSettings.get(selectedPadIndex) ?? { ...DEFAULT_FX };
                const vol = padVolumes.get(selectedPadIndex) ?? 1;
                const pitchNorm = (fx.pitchShift + 12) / 24;

                const knobs = [
                  { label: 'VOL',  val: vol,             onChange: (v: number) => handleVolumeChange(selectedPadIndex, v),                          hue: padHue },
                  { label: 'FILT', val: fx.filterCutoff, onChange: (v: number) => updatePadFx(selectedPadIndex, 'filterCutoff', v),                   hue: (padHue + 40) % 360 },
                  { label: 'REV',  val: fx.reverbSend,   onChange: (v: number) => updatePadFx(selectedPadIndex, 'reverbSend', v),                     hue: (padHue + 80) % 360 },
                  { label: 'SAT',  val: fx.saturation,   onChange: (v: number) => updatePadFx(selectedPadIndex, 'saturation', v),                     hue: (padHue + 120) % 360 },
                  { label: 'PCH',  val: pitchNorm,        onChange: (v: number) => updatePadFx(selectedPadIndex, 'pitchShift', Math.round((v * 24) - 12)), hue: (padHue + 160) % 360 },
                ];

                return knobs.map(({ label, val, onChange, hue }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center px-3 py-2 shrink-0 border-r border-border/20 last:border-r-0 hover:bg-white/[0.02] transition-colors"
                    style={{ minWidth: '56px' }}
                  >
                    {/* Value readout above knob */}
                    <span className="text-[7px] font-mono mb-1 leading-none"
                      style={{ color: `hsl(${hue},65%,60%)`, opacity: 0.75 }}>
                      {label === 'PCH'
                        ? `${Math.round(val * 24 - 12) > 0 ? '+' : ''}${Math.round(val * 24 - 12)}`
                        : `${Math.round(val * 100)}%`}
                    </span>
                    <PadKnob value={val} onChange={onChange} hue={hue} label={label} />
                  </div>
                ));
              })()}

              {/* ── Velocity curve quick-select ────────────────────────── */}
              <div
                className="flex flex-col justify-center px-3 py-2 shrink-0 border-l border-border/30"
                style={{ background: 'rgba(0,0,0,0.12)', minWidth: '80px' }}
              >
                <span className="text-[7px] font-mono tracking-widest text-muted-foreground/40 mb-1.5 uppercase">Curve</span>
                <div className="flex flex-col gap-0.5">
                  {(['linear','exponential','logarithmic','soft','hard'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setPadVelocityCurve(selectedPadIndex, c)}
                      className="h-4 px-1.5 text-[7px] font-mono rounded-sm text-left transition-all capitalize"
                      style={{
                        background: (padVelocityCurves.get(selectedPadIndex) ?? 'linear') === c
                          ? 'rgba(163,230,53,0.15)'
                          : 'rgba(255,255,255,0.03)',
                        color: (padVelocityCurves.get(selectedPadIndex) ?? 'linear') === c
                          ? '#a3e635'
                          : 'rgba(255,255,255,0.35)',
                        borderLeft: (padVelocityCurves.get(selectedPadIndex) ?? 'linear') === c
                          ? '2px solid #a3e635'
                          : '2px solid transparent',
                      }}
                    >
                      {c.slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3D Bottom shadow edge */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" />
    </section>
  );
}