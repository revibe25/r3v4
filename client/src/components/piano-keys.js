import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--accent-purple) (violet), var(--status-warn) (amber), var(--status-ok) (emerald)
// Reason: AI prediction overlay + VU zone indicators on key surface
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
import clsx from "clsx";
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Upload, ChevronUp, ChevronDown, Circle, Trash2, Settings, Zap, Music, Play, Square, Save, Download, Lock, Unlock, Activity, Mic, StopCircle, SkipBack, Sliders, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { getAudioContext } from "@/audio/core/audio-context";
// ============================================================================
// CONSTANTS & CONFIGURATIONS
// ============================================================================
const KEYBOARD_MAP = {
    'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6,
    'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11, ',': 12,
    'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16, 'r': 17, '5': 18,
    't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24,
    'a': -12, 'k': 25, 'o': 26, '9': 27, 'p': 28, '[': 29
};
const PIANO_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VALID_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/flac'];
const KEY_COLORS = [
    '#ef4444', 'var(--track-orange)', 'var(--status-warn)', 'var(--amber-500)', 'var(--looper-lime)',
    'var(--accent-green)', 'var(--status-ok)', 'var(--looper-teal)', 'var(--track-cyan)', 'var(--accent-blue)',
    'var(--looper-blue)', 'var(--track-indigo)', 'var(--accent-purple)', 'var(--accent-violet)', 'var(--accent-fuchsia)',
];
const SCALES = {
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
const AUTO_CHORD_VOICINGS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    sus4: [0, 5, 7],
    power: [0, 7],
};
const DEFAULT_EFFECTS = {
    reverb: 0.2, delay: 0, chorus: 0, compression: 0.3, eq: 0,
    distortion: 0, filter: 0.5, tremolo: 0, phaser: 0, flanger: 0,
    bitcrusher: 0, saturation: 0,
};
const DEFAULT_ARPEGGIATOR = {
    enabled: false, pattern: 'up', speed: 120, octaves: 1,
    gate: 0.8, swing: 0, probability: 1,
};
const VELOCITY_CURVES = [
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
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}
function frequencyToMidi(frequency) {
    return 69 + 12 * Math.log2(frequency / 440);
}
function generateEuclideanRhythm(steps, pulses) {
    const pattern = new Array(steps).fill(false);
    if (pulses >= steps)
        return pattern.fill(true);
    const slope = pulses / steps;
    let previous = 0;
    for (let i = 0; i < steps; i++) {
        const current = Math.floor((i + 1) * slope);
        pattern[i] = current !== previous;
        previous = current;
    }
    return pattern;
}
function detectChord(activeNotes) {
    if (activeNotes.size < 2)
        return '';
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
function WhiteKey({ keyIdx, isActive, note, octave, label, hasAssignment, layerCount, keyColor, isLocked, velocity, onTrigger, onLongPress, negativeMargin, isInScale, }) {
    const [isPressed, setIsPressed] = useState(false);
    const [localVelocity, setLocalVelocity] = useState(0);
    const pressTimerRef = useRef();
    const handleMouseDown = (e) => {
        setIsPressed(true);
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;
        setLocalVelocity(clamp(1 - relativeY * 0.5, 0.5, 1.0));
        pressTimerRef.current = setTimeout(() => onLongPress(keyIdx), 500);
    };
    const handleMouseUp = () => {
        setIsPressed(false);
        if (pressTimerRef.current)
            clearTimeout(pressTimerRef.current);
        onTrigger(keyIdx);
        setLocalVelocity(0);
    };
    const handleMouseLeave = () => {
        setIsPressed(false);
        if (pressTimerRef.current)
            clearTimeout(pressTimerRef.current);
        setLocalVelocity(0);
    };
    const displayVelocity = isPressed ? localVelocity : (isActive ? velocity : 0);
    return (_jsxs("button", { "data-testid": `piano-key-${keyIdx}`, onMouseDown: handleMouseDown, onMouseUp: handleMouseUp, onMouseLeave: handleMouseLeave, className: clsx('relative w-8 md:w-10 h-24 md:h-28 rounded-b-lg flex flex-col items-center justify-end pb-2', 'transition-all duration-75 ease-out border border-gray-300 select-none touch-none', negativeMargin && '-mr-1', (isActive || isPressed)
            ? 'bg-white shadow-inner scale-[0.98] translate-y-0.5'
            : 'bg-white shadow-md hover:shadow-lg', isLocked && 'ring-2 ring-orange-400 ring-inset', isInScale && !isActive && 'ring-1 ring-lime-300/50 ring-inset'), children: [displayVelocity > 0 && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-400/40 to-transparent rounded-b-lg", style: { height: `${displayVelocity * 100}%` } })), hasAssignment && (_jsx("div", { className: "absolute top-1 left-1 right-1 h-1 flex gap-0.5", children: Array.from({ length: Math.min(layerCount, 5) }).map((_, i) => (_jsx("div", { className: "flex-1 rounded-full", style: {
                        backgroundColor: keyColor || KEY_COLORS[i % KEY_COLORS.length],
                        opacity: 0.7,
                    } }, i))) })), isLocked && _jsx(Lock, { className: "absolute top-2 right-1 w-3 h-3 text-orange-500" }), _jsx("span", { className: "text-[10px] md:text-xs font-semibold text-muted-foreground pointer-events-none", children: label }), _jsxs("span", { className: "text-[8px] md:text-[10px] text-muted-foreground pointer-events-none", children: [note, octave] }), layerCount > 1 && (_jsx("div", { className: "absolute bottom-1 right-1 w-4 h-4 rounded-full bg-blue-500 text-foreground text-[8px] font-bold flex items-center justify-center", children: layerCount }))] }));
}
function BlackKey({ keyIdx, isActive, note, octave, label, hasAssignment, layerCount, keyColor, isLocked, velocity, onTrigger, onLongPress, isInScale, }) {
    const [isPressed, setIsPressed] = useState(false);
    const [localVelocity, setLocalVelocity] = useState(0);
    const pressTimerRef = useRef();
    const handleMouseDown = (e) => {
        setIsPressed(true);
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = (e.clientY - rect.top) / rect.height;
        setLocalVelocity(clamp(1 - relativeY * 0.3, 0.5, 1.0));
        pressTimerRef.current = setTimeout(() => onLongPress(keyIdx), 500);
    };
    const handleMouseUp = () => {
        setIsPressed(false);
        if (pressTimerRef.current)
            clearTimeout(pressTimerRef.current);
        onTrigger(keyIdx);
        setLocalVelocity(0);
    };
    const displayVelocity = isPressed ? localVelocity : (isActive ? velocity : 0);
    return (_jsxs("button", { "data-testid": `piano-key-${keyIdx}`, onMouseDown: handleMouseDown, onMouseUp: handleMouseUp, onMouseLeave: () => {
            setIsPressed(false);
            if (pressTimerRef.current)
                clearTimeout(pressTimerRef.current);
            setLocalVelocity(0);
        }, className: clsx('absolute left-1/2 -translate-x-1/2 z-10 w-5 md:w-6 h-14 md:h-16 rounded-b-md', 'flex flex-col items-center justify-end pb-1.5 transition-all duration-75 ease-out', 'border border-gray-950 select-none touch-none', (isActive || isPressed)
            ? 'bg-background shadow-inner scale-[0.97] translate-y-0.5'
            : 'bg-background shadow-lg hover:shadow-xl', isInScale && !isActive && !isPressed && 'ring-1 ring-lime-400/60 ring-inset', isLocked && 'ring-2 ring-orange-400 ring-inset'), children: [displayVelocity > 0 && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/50 to-transparent rounded-b-md", style: { height: `${displayVelocity * 100}%` } })), hasAssignment && (_jsx("div", { className: "absolute top-0.5 left-0.5 right-0.5 h-0.5 flex gap-0.5", children: Array.from({ length: Math.min(layerCount, 3) }).map((_, i) => (_jsx("div", { className: "flex-1 rounded-full", style: {
                        backgroundColor: keyColor || KEY_COLORS[i % KEY_COLORS.length],
                        opacity: 0.9,
                    } }, i))) })), isLocked && _jsx(Lock, { className: "absolute top-1 right-0.5 w-2.5 h-2.5 text-orange-400" }), _jsx("span", { className: "text-[8px] md:text-[10px] font-semibold text-gray-300 pointer-events-none", children: label }), _jsxs("span", { className: "text-[7px] md:text-[8px] text-gray-500 pointer-events-none", children: [note, octave] }), layerCount > 1 && (_jsx("div", { className: "absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-blue-600 text-foreground text-[7px] font-bold flex items-center justify-center", children: layerCount }))] }));
}
// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function PianoKeys({ keys, onTrigger, onAssignSample, loadSample, onEffectChange, }) {
    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================
    const [octaveShift, setOctaveShift] = useState(0);
    const [velocity, setVelocity] = useState(0.8);
    const [pitchBend, setPitchBend] = useState(0);
    const [modulation, setModulation] = useState(0);
    const [sustain, setSustain] = useState(false);
    const [assignments, setAssignments] = useState(new Map());
    const [effects, setEffects] = useState(DEFAULT_EFFECTS);
    const [velocityCurve, setVelocityCurve] = useState(0);
    const [transpose, setTranspose] = useState(0);
    const [keyToEdit, setKeyToEdit] = useState(null);
    const [presets, setPresets] = useState([]);
    const [arpeggiator, setArpeggiator] = useState(DEFAULT_ARPEGGIATOR);
    const [heldKeys, setHeldKeys] = useState(new Set());
    const [lockedKeys, setLockedKeys] = useState(new Set());
    const [isRecording, setIsRecording] = useState(false);
    const [recordedNotes, setRecordedNotes] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeKeys, setActiveKeys] = useState(new Set());
    const [keyVelocities, setKeyVelocities] = useState(new Map());
    const [globalTuning, setGlobalTuning] = useState(0);
    const [scaleType, setScaleType] = useState('none');
    const [scaleRoot, setScaleRoot] = useState(0);
    const [detectedChord, setDetectedChord] = useState('');
    const [showWaveforms, setShowWaveforms] = useState(false);
    const [controlsCollapsed, setControlsCollapsed] = useState(false);
    const [filterType, setFilterType] = useState('lowpass');
    const [autoChordEnabled, setAutoChordEnabled] = useState(false);
    const [autoChordVoicing, setAutoChordVoicing] = useState('major');
    const [envelopePreset, setEnvelopePreset] = useState('custom');
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
    const fileInputRef = useRef(null);
    const arpIntervalRef = useRef();
    const recordingStartTimeRef = useRef(0);
    const sustainedKeysRef = useRef(new Set());
    const pressedKeysRef = useRef(new Set());
    const audioContextRef = useRef();
    const analyserRef = useRef();
    const waveformCanvasRef = useRef(null);
    const animationFrameRef = useRef();
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
            if (animationFrameRef.current)
                cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);
    // ========================================================================
    // WAVEFORM VISUALIZATION
    // ========================================================================
    const drawWaveform = useCallback(() => {
        if (!analyserRef.current || !waveformCanvasRef.current)
            return;
        const canvas = waveformCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
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
            if (i === 0)
                ctx.moveTo(i * sliceWidth, y);
            else
                ctx.lineTo(i * sliceWidth, y);
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        if (showWaveforms) {
            animationFrameRef.current = requestAnimationFrame(drawWaveform);
        }
    }, [showWaveforms]);
    useEffect(() => {
        if (showWaveforms)
            drawWaveform();
        else if (animationFrameRef.current)
            cancelAnimationFrame(animationFrameRef.current);
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
            if (arpIntervalRef.current)
                clearInterval(arpIntervalRef.current);
            return;
        }
        const sortedKeys = Array.from(heldKeys).sort((a, b) => a - b);
        let currentIndex = 0;
        let direction = 1;
        const intervalMs = (60000 / arpeggiator.speed) / 4;
        arpIntervalRef.current = setInterval(() => {
            if (Math.random() > arpeggiator.probability)
                return;
            let keyToPlay;
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
                    }
                    else if (currentIndex < 0) {
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
            if (arpIntervalRef.current)
                clearInterval(arpIntervalRef.current);
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
        if (recordedNotes.length === 0)
            return;
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
        if (recordedNotes.length === 0)
            return;
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
        if (!quantizeEnabled || recordedNotes.length === 0)
            return;
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
    const triggerKey = useCallback((keyIndex) => {
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
    const handleFileSelect = useCallback(async (keyIndex, event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        if (!VALID_AUDIO_TYPES.includes(file.type)) {
            alert('Please select a valid audio file (MP3, WAV, OGG, WEBM, FLAC)');
            return;
        }
        try {
            const buffer = await loadSample(file);
            if (buffer) {
                const newAssignment = {
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
        }
        catch (error) {
            console.error('Error loading sample:', error);
            alert('Failed to load audio file.');
        }
        event.target.value = '';
    }, [loadSample, onAssignSample]);
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);
    const handleDrop = useCallback(async (keyIndex, e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file || !VALID_AUDIO_TYPES.includes(file.type)) {
            alert('Please drop a valid audio file');
            return;
        }
        try {
            const buffer = await loadSample(file);
            if (buffer) {
                const newAssignment = {
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
        }
        catch (error) {
            console.error('Error loading dropped sample:', error);
        }
    }, [loadSample, onAssignSample]);
    // ========================================================================
    // KEYBOARD CONTROLS
    // ========================================================================
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            const key = e.key.toLowerCase();
            if (pressedKeysRef.current.has(key))
                return;
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
                if (arpeggiator.enabled)
                    setHeldKeys(prev => new Set(prev).add(keyIndex));
                triggerKey(keyIndex);
            }
        };
        const handleKeyUp = (e) => {
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
    const handleEffectChange = useCallback((effectName, value) => {
        const newEffects = { ...effects, [effectName]: value };
        setEffects(newEffects);
        onEffectChange?.(newEffects);
    }, [effects, onEffectChange]);
    const resetEffects = useCallback(() => {
        setEffects(DEFAULT_EFFECTS);
        onEffectChange?.(DEFAULT_EFFECTS);
    }, [onEffectChange]);
    const handleSavePreset = useCallback(() => {
        const preset = {
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
    const handleLoadPreset = useCallback((preset) => {
        setAssignments(new Map(preset.assignments));
        setEffects(preset.effects);
        setOctaveShift(preset.octaveShift);
        setVelocity(preset.velocity);
        if (preset.arpeggiatorSettings)
            setArpeggiator(preset.arpeggiatorSettings);
        if (preset.sequenceData) {
            setRecordedNotes(preset.sequenceData.map(n => ({
                keyIndex: n.keyIndex, timestamp: n.time, duration: n.duration, velocity: n.velocity, released: true,
            })));
        }
        onEffectChange?.(preset.effects);
    }, [onEffectChange]);
    const handleDeletePreset = useCallback((presetId) => {
        setPresets(prev => prev.filter(p => p.id !== presetId));
    }, []);
    const handleExportPreset = useCallback((preset) => {
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
    const toggleKeyLock = useCallback((keyIndex) => {
        setLockedKeys(prev => {
            const newSet = new Set(prev);
            newSet.has(keyIndex) ? newSet.delete(keyIndex) : newSet.add(keyIndex);
            return newSet;
        });
    }, []);
    const handleDuplicateKey = useCallback((fromKey, toKey) => {
        const layers = assignments.get(fromKey);
        if (!layers)
            return;
        setAssignments(prev => {
            const newMap = new Map(prev);
            newMap.set(toKey, [...layers]);
            return newMap;
        });
    }, [assignments]);
    const clearAllAssignments = useCallback(() => {
        if (confirm('Clear all key assignments?'))
            setAssignments(new Map());
    }, []);
    const applyEnvelopePreset = useCallback((preset) => {
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
                    return { ...layer, ...envelopes[preset] };
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
        const layout = [];
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
    return (_jsx(TooltipProvider, { children: _jsxs("section", { className: "relative rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/80 overflow-hidden shadow-lg", children: [_jsx("div", { className: "absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" }), _jsx("div", { className: "flex items-center justify-between px-3 py-2 border-b border-border/40", style: { background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.04) 100%)' }, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex items-center justify-center w-6 h-6 rounded-md", style: {
                                    background: 'linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(250, 60%, 45%) 100%)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                                }, children: _jsx(Music, { className: "w-3.5 h-3.5 text-foreground" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold text-foreground/90", children: "Piano Keys" }), _jsx("p", { className: "text-[10px] text-muted-foreground/50 mt-0.5", children: "24 Keys \u2022 Velocity Sensitive \u2022 Drag & Drop" })] })] }) }), _jsxs("div", { className: "p-2.5 space-y-3", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 px-1 mb-1.5", children: [_jsx("div", { className: "flex items-center gap-1.5 flex-1", children: detectedChord ? (_jsx("span", { className: "text-sm font-extrabold px-2 py-0.5 rounded", style: { background: 'rgba(163,230,53,0.12)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)' }, children: detectedChord })) : (_jsx("span", { className: "text-[10px] text-muted-foreground/40 italic", children: "play a chord\u2026" })) }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: autoChordEnabled ? 'default' : 'outline', size: "sm", onClick: () => setAutoChordEnabled(v => !v), className: "text-[9px] h-6", children: "Auto Chord" }), autoChordEnabled && (_jsxs(Select, { value: autoChordVoicing, onValueChange: v => setAutoChordVoicing(v), children: [_jsx(SelectTrigger, { className: "h-6 w-20 text-[9px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: Object.keys(AUTO_CHORD_VOICINGS).map(k => (_jsx(SelectItem, { value: k, className: "text-xs", children: k }, k))) })] }))] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsxs(Select, { value: scaleRoot.toString(), onValueChange: v => setScaleRoot(Number(v)), children: [_jsx(SelectTrigger, { className: "h-6 w-12 text-[9px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: PIANO_NOTES.map((n, i) => _jsx(SelectItem, { value: i.toString(), className: "text-xs", children: n }, i)) })] }), _jsxs(Select, { value: scaleType, onValueChange: v => setScaleType(v), children: [_jsx(SelectTrigger, { className: "h-6 w-24 text-[9px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: Object.entries(SCALES).map(([k, s]) => (_jsx(SelectItem, { value: k, className: "text-xs", children: s.label }, k))) })] })] })] }), _jsx("div", { className: "flex items-stretch gap-2", children: _jsxs("div", { className: "flex-1 relative p-3 rounded-lg border border-border/40", style: { background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)' }, children: [_jsx("div", { className: "flex justify-center gap-0.5", children: whiteKeys.map((keyData, idx) => {
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
                                                    return (_jsxs("div", { className: "relative", onDragOver: handleDragOver, onDrop: (e) => handleDrop(keyIndex, e), children: [_jsx(WhiteKey, { keyIdx: keyIndex, isActive: isActive, note: note, octave: octave, label: keyLabel, hasAssignment: layers.length > 0, layerCount: layers.length, keyColor: layers[0]?.color, isLocked: lockedKeys.has(keyIndex), velocity: currentVelocity, onTrigger: triggerKey, onLongPress: setKeyToEdit, negativeMargin: nextKeyIsBlack, isInScale: isInScale }), _jsx("input", { ref: keyToEdit === keyIndex ? fileInputRef : undefined, type: "file", accept: VALID_AUDIO_TYPES.join(','), onChange: (e) => handleFileSelect(keyIndex, e), className: "hidden" })] }, keyIndex));
                                                }) }), _jsx("div", { className: "absolute top-4 left-0 right-0 flex justify-center pointer-events-none", children: _jsx("div", { className: "flex gap-0.5", children: whiteKeys.map((whiteKey, idx) => {
                                                        const nextWhiteKeyIndex = whiteKeys[idx + 1]?.index;
                                                        const blackKeyBetween = blackKeys.find(bk => bk.index > whiteKey.index && bk.index < nextWhiteKeyIndex);
                                                        return (_jsx("div", { className: "relative w-8 md:w-10", children: blackKeyBetween && (_jsx("div", { className: "absolute right-0 translate-x-1/2 pointer-events-auto", children: _jsx(BlackKey, { keyIdx: blackKeyBetween.index, isActive: activeKeys.has(blackKeyBetween.index), note: blackKeyBetween.note, octave: 4 + Math.floor(blackKeyBetween.index / 12), label: Object.entries(KEYBOARD_MAP).find(([, v]) => v === blackKeyBetween.index)?.[0]?.toUpperCase() || '', hasAssignment: (assignments.get(blackKeyBetween.index)?.length || 0) > 0, layerCount: assignments.get(blackKeyBetween.index)?.length || 0, keyColor: assignments.get(blackKeyBetween.index)?.[0]?.color, isLocked: lockedKeys.has(blackKeyBetween.index), velocity: keyVelocities.get(blackKeyBetween.index) || 0, onTrigger: triggerKey, onLongPress: setKeyToEdit, isInScale: (() => {
                                                                        const intervals = SCALES[scaleType]?.intervals ?? [];
                                                                        return intervals.length > 0 ? intervals.includes((blackKeyBetween.index - scaleRoot + 120) % 12) : false;
                                                                    })() }) })) }, whiteKey.index));
                                                    }) }) })] }) }), showWaveforms && (_jsx("div", { className: "mt-2", children: _jsx("canvas", { ref: waveformCanvasRef, width: 800, height: 100, className: "w-full h-24 rounded border border-border/40 bg-background/50" }) }))] }), _jsxs("div", { className: "rounded-lg border border-border/40 overflow-hidden", style: { background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.01) 100%)' }, children: [_jsxs("button", { onClick: () => setControlsCollapsed(prev => !prev), className: "w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 transition-colors select-none", style: { background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.02) 100%)' }, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sliders, { className: "w-3 h-3 text-muted-foreground/60" }), _jsx("span", { className: "text-[11px] font-medium text-muted-foreground/70", children: "Controls & Effects" })] }), _jsx(ChevronDown, { className: `w-3.5 h-3.5 text-muted-foreground/50 transition-transform ${controlsCollapsed ? '-rotate-90' : ''}` })] }), !controlsCollapsed && (_jsx("div", { className: "px-2.5 pb-2.5 pt-1", children: _jsxs(Tabs, { defaultValue: "expression", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-6 gap-1", children: [_jsxs(TabsTrigger, { value: "expression", className: "text-xs", children: [_jsx(Sliders, { className: "w-3 h-3 mr-1" }), "Expression"] }), _jsxs(TabsTrigger, { value: "effects", className: "text-xs", children: [_jsx(Zap, { className: "w-3 h-3 mr-1" }), "Effects"] }), _jsxs(TabsTrigger, { value: "recording", className: "text-xs", children: [_jsx(Mic, { className: "w-3 h-3 mr-1" }), "Record"] }), _jsxs(TabsTrigger, { value: "arpeggiator", className: "text-xs", children: [_jsx(Activity, { className: "w-3 h-3 mr-1" }), "Arp"] }), _jsxs(TabsTrigger, { value: "advanced", className: "text-xs", children: [_jsx(Settings, { className: "w-3 h-3 mr-1" }), "Advanced"] }), _jsxs(TabsTrigger, { value: "presets", className: "text-xs", children: [_jsx(Save, { className: "w-3 h-3 mr-1" }), "Presets"] })] }), _jsxs(TabsContent, { value: "expression", className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Velocity" }), _jsx("span", { className: "text-muted-foreground font-mono", children: Math.round(velocity * 127) })] }), _jsx(Slider, { value: [velocity], onValueChange: ([v]) => setVelocity(v), min: 0, max: 1, step: 0.01, className: "w-full" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Octave" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [octaveShift > 0 ? '+' : '', octaveShift] })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setOctaveShift(prev => Math.max(prev - 1, -3)), className: "flex-1", children: _jsx(ChevronDown, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => setOctaveShift(prev => Math.min(prev + 1, 3)), className: "flex-1", children: _jsx(ChevronUp, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Pitch Bend" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [pitchBend > 0 ? '+' : '', pitchBend.toFixed(1)] })] }), _jsx(Slider, { value: [pitchBend], onValueChange: ([v]) => setPitchBend(v), min: -12, max: 12, step: 0.1, className: "w-full" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Modulation" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [Math.round(modulation * 100), "%"] })] }), _jsx(Slider, { value: [modulation], onValueChange: ([v]) => setModulation(v), min: 0, max: 1, step: 0.01, className: "w-full" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Transpose" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [transpose > 0 ? '+' : '', transpose, " st"] })] }), _jsx(Slider, { value: [transpose], onValueChange: ([v]) => setTranspose(Math.round(v)), min: -24, max: 24, step: 1, className: "w-full" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Velocity Curve" }), _jsxs(Select, { value: velocityCurve.toString(), onValueChange: (v) => setVelocityCurve(parseInt(v)), children: [_jsx(SelectTrigger, { className: "h-8 text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: VELOCITY_CURVES.map((curve, idx) => (_jsx(SelectItem, { value: idx.toString(), children: curve.name }, idx))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Global Tune" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [globalTuning > 0 ? '+' : '', globalTuning, " cents"] })] }), _jsx(Slider, { value: [globalTuning], onValueChange: ([v]) => setGlobalTuning(Math.round(v)), min: -100, max: 100, step: 1, className: "w-full" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Sustain Pedal" }), _jsx(Button, { variant: sustain ? 'default' : 'outline', size: "sm", onClick: () => setSustain(prev => !prev), className: "w-full", children: sustain ? 'ON' : 'OFF' })] })] }), _jsx("div", { className: "p-3 bg-muted/50 rounded-lg border border-border", children: _jsxs("p", { className: "text-xs text-muted-foreground", children: [_jsxs("strong", { children: [VELOCITY_CURVES[velocityCurve].name, ":"] }), " ", VELOCITY_CURVES[velocityCurve].description] }) })] }), _jsxs(TabsContent, { value: "effects", className: "space-y-4 mt-4", children: [_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4", children: Object.entries(effects).map(([effectName, value]) => (_jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between capitalize", children: [_jsx("span", { children: effectName }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [Math.round(value * 100), "%"] })] }), _jsx(Slider, { value: [value], onValueChange: ([v]) => handleEffectChange(effectName, v), min: 0, max: 1, step: 0.01, className: "w-full" })] }, effectName))) }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: resetEffects, className: "flex-1", children: [_jsx(SkipBack, { className: "w-4 h-4 mr-2" }), "Reset All Effects"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setShowWaveforms(prev => !prev), className: "flex-1", children: [showWaveforms ? _jsx(EyeOff, { className: "w-4 h-4 mr-2" }) : _jsx(Eye, { className: "w-4 h-4 mr-2" }), showWaveforms ? 'Hide' : 'Show', " Waveform"] })] })] }), _jsxs(TabsContent, { value: "recording", className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-2", children: [_jsx(Button, { variant: isRecording ? 'destructive' : 'default', size: "sm", onClick: isRecording ? stopRecording : startRecording, className: "w-full", children: isRecording ? (_jsxs(_Fragment, { children: [_jsx(StopCircle, { className: "w-4 h-4 mr-2 animate-pulse" }), "Stop"] })) : (_jsxs(_Fragment, { children: [_jsx(Circle, { className: "w-4 h-4 mr-2" }), "Record"] })) }), _jsx(Button, { variant: isPlaying ? 'default' : 'outline', size: "sm", onClick: isPlaying ? stopPlayback : startPlayback, disabled: recordedNotes.length === 0, className: "w-full", children: isPlaying ? (_jsxs(_Fragment, { children: [_jsx(Square, { className: "w-4 h-4 mr-2" }), "Stop"] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "w-4 h-4 mr-2" }), "Play"] })) }), _jsxs(Button, { variant: "outline", size: "sm", onClick: clearRecording, disabled: recordedNotes.length === 0, className: "w-full", children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Clear"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: exportRecording, disabled: recordedNotes.length === 0, className: "w-full", children: [_jsx(Download, { className: "w-4 h-4 mr-2" }), "Export"] })] }), _jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { className: "text-xs", children: "Quantize" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { checked: quantizeEnabled, onCheckedChange: (checked) => setQuantizeEnabled(!!checked) }), _jsxs(Select, { value: quantizeGrid.toString(), onValueChange: (v) => setQuantizeGrid(parseInt(v)), disabled: !quantizeEnabled, children: [_jsx(SelectTrigger, { className: "h-7 w-20 text-xs", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "4", children: "1/4" }), _jsx(SelectItem, { value: "8", children: "1/8" }), _jsx(SelectItem, { value: "16", children: "1/16" }), _jsx(SelectItem, { value: "32", children: "1/32" })] })] }), _jsx(Button, { variant: "outline", size: "sm", onClick: quantizeRecording, disabled: !quantizeEnabled || recordedNotes.length === 0, children: "Apply" })] })] }) }), _jsx("div", { className: "p-3 bg-muted/50 rounded-lg border border-border", children: _jsx("p", { className: "text-xs text-muted-foreground", children: recordedNotes.length === 0 ? ('No recording yet. Press Record to start capturing your performance.') : (_jsxs(_Fragment, { children: [_jsxs("strong", { children: [recordedNotes.length, " notes"] }), " recorded", isRecording && _jsx("span", { className: "ml-2 text-red-400 animate-pulse", children: "\u25CF Recording..." })] })) }) })] }), _jsxs(TabsContent, { value: "arpeggiator", className: "space-y-4 mt-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { className: "text-sm font-semibold", children: "Arpeggiator" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { checked: arpeggiator.enabled, onCheckedChange: (checked) => setArpeggiator({ ...arpeggiator, enabled: !!checked }) }), _jsx("span", { className: "text-xs text-muted-foreground", children: arpeggiator.enabled ? 'Enabled' : 'Disabled' })] })] }), arpeggiator.enabled && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Pattern" }), _jsxs(Select, { value: arpeggiator.pattern, onValueChange: (v) => setArpeggiator({ ...arpeggiator, pattern: v }), children: [_jsx(SelectTrigger, { className: "h-8 text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: ARP_PATTERNS.map(p => (_jsx(SelectItem, { value: p.value, children: p.label }, p.value))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Speed (BPM)" }), _jsx("span", { className: "text-muted-foreground font-mono", children: arpeggiator.speed })] }), _jsx(Slider, { value: [arpeggiator.speed], onValueChange: ([v]) => setArpeggiator({ ...arpeggiator, speed: v }), min: 40, max: 300, step: 1 })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Octaves" }), _jsx("span", { className: "text-muted-foreground font-mono", children: arpeggiator.octaves })] }), _jsx(Slider, { value: [arpeggiator.octaves], onValueChange: ([v]) => setArpeggiator({ ...arpeggiator, octaves: v }), min: 1, max: 4, step: 1 })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Gate" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [Math.round(arpeggiator.gate * 100), "%"] })] }), _jsx(Slider, { value: [arpeggiator.gate], onValueChange: ([v]) => setArpeggiator({ ...arpeggiator, gate: v }), min: 0.1, max: 1, step: 0.05 })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Swing" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [Math.round(arpeggiator.swing * 100), "%"] })] }), _jsx(Slider, { value: [arpeggiator.swing], onValueChange: ([v]) => setArpeggiator({ ...arpeggiator, swing: v }), min: 0, max: 1, step: 0.05 })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Probability" }), _jsxs("span", { className: "text-muted-foreground font-mono", children: [Math.round(arpeggiator.probability * 100), "%"] })] }), _jsx(Slider, { value: [arpeggiator.probability], onValueChange: ([v]) => setArpeggiator({ ...arpeggiator, probability: v }), min: 0, max: 1, step: 0.05 })] })] }), _jsx("div", { className: "p-3 bg-muted/50 rounded-lg border border-border", children: _jsxs("p", { className: "text-xs text-muted-foreground", children: ["\uD83D\uDCA1 ", ARP_PATTERNS.find(p => p.value === arpeggiator.pattern)?.description, ' • ', "Held keys: ", heldKeys.size] }) })] }))] }), _jsxs(TabsContent, { value: "advanced", className: "space-y-4 mt-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Filter Type" }), _jsxs(Select, { value: filterType, onValueChange: (v) => setFilterType(v), children: [_jsx(SelectTrigger, { className: "h-8 text-xs", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "lowpass", children: "Low Pass" }), _jsx(SelectItem, { value: "highpass", children: "High Pass" }), _jsx(SelectItem, { value: "bandpass", children: "Band Pass" }), _jsx(SelectItem, { value: "notch", children: "Notch" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Envelope Preset" }), _jsxs(Select, { value: envelopePreset, onValueChange: (v) => applyEnvelopePreset(v), children: [_jsx(SelectTrigger, { className: "h-8 text-xs", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "pluck", children: "Pluck" }), _jsx(SelectItem, { value: "pad", children: "Pad" }), _jsx(SelectItem, { value: "organ", children: "Organ" }), _jsx(SelectItem, { value: "percussion", children: "Percussion" }), _jsx(SelectItem, { value: "custom", children: "Custom" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs flex items-center justify-between", children: [_jsx("span", { children: "Polyphony Limit" }), _jsx("span", { className: "text-muted-foreground font-mono", children: polyphonyLimit })] }), _jsx(Slider, { value: [polyphonyLimit], onValueChange: ([v]) => setPolyphonyLimit(v), min: 1, max: 64, step: 1 })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Voice Stealing" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Checkbox, { checked: voiceStealingEnabled, onCheckedChange: (checked) => setVoiceStealingEnabled(!!checked) }), _jsx("span", { className: "text-xs text-muted-foreground", children: voiceStealingEnabled ? 'Enabled' : 'Disabled' })] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: clearAllAssignments, className: "flex-1", children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Clear All Keys"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setLockedKeys(new Set()), className: "flex-1", children: [_jsx(Unlock, { className: "w-4 h-4 mr-2" }), "Unlock All"] })] })] }), _jsxs(TabsContent, { value: "presets", className: "space-y-4 mt-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Dialog, { open: showPresetDialog, onOpenChange: setShowPresetDialog, children: [_jsx(DialogTrigger, { asChild: true, children: _jsxs(Button, { variant: "default", size: "sm", children: [_jsx(Save, { className: "w-4 h-4 mr-2" }), "Save New Preset"] }) }), _jsxs(DialogContent, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Save Performance Preset" }), _jsx(DialogDescription, { children: "Save your current configuration including samples, effects, and settings" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Preset Name" }), _jsx(Input, { placeholder: "My Preset", value: currentPresetName, onChange: (e) => setCurrentPresetName(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Description (Optional)" }), _jsx(Input, { placeholder: "What's this preset for?", value: currentPresetDescription, onChange: (e) => setCurrentPresetDescription(e.target.value) })] })] }), _jsx(DialogFooter, { children: _jsx(Button, { onClick: handleSavePreset, disabled: !currentPresetName.trim(), children: "Save Preset" }) })] })] }), _jsxs("span", { className: "text-xs text-muted-foreground ml-auto", children: [presets.length, " preset", presets.length !== 1 ? 's' : '', " saved"] })] }), _jsx("div", { className: "grid grid-cols-1 gap-2 max-h-96 overflow-y-auto", children: presets.length === 0 ? (_jsx("div", { className: "text-center p-8 text-muted-foreground text-sm", children: "No presets saved yet. Create your first preset!" })) : (presets.map((preset) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "text-sm font-semibold", children: preset.name }), preset.description && (_jsx("p", { className: "text-xs text-muted-foreground", children: preset.description })), _jsxs("div", { className: "flex gap-2 mt-1", children: [_jsxs("span", { className: "text-[10px] text-muted-foreground", children: [Array.from(preset.assignments.values()).reduce((sum, layers) => sum + layers.length, 0), " sounds"] }), preset.sequenceData && (_jsxs("span", { className: "text-[10px] text-muted-foreground", children: ["\u2022 ", preset.sequenceData.length, " notes"] })), preset.createdAt && (_jsxs("span", { className: "text-[10px] text-muted-foreground", children: ["\u2022 ", new Date(preset.createdAt).toLocaleDateString()] }))] })] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => handleLoadPreset(preset), children: "Load" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => handleExportPreset(preset), children: _jsx(Download, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleDeletePreset(preset.id), children: _jsx(Trash2, { className: "w-4 h-4 text-red-500" }) })] })] }, preset.id)))) })] })] }) }))] }), keyToEdit !== null && (_jsx(Popover, { open: keyToEdit !== null, onOpenChange: (open) => !open && setKeyToEdit(null), children: _jsx(PopoverContent, { className: "w-80", children: _jsxs("div", { className: "space-y-3", children: [_jsxs("h4", { className: "font-semibold text-sm", children: ["Edit ", PIANO_NOTES[keyToEdit % 12], 4 + Math.floor(keyToEdit / 12)] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
                                                        if (fileInputRef.current) {
                                                            fileInputRef.current.click();
                                                        }
                                                    }, className: "flex-1", children: [_jsx(Upload, { className: "w-4 h-4 mr-2" }), "Add Sample"] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => toggleKeyLock(keyToEdit), className: "flex-1", children: lockedKeys.has(keyToEdit) ? (_jsxs(_Fragment, { children: [_jsx(Unlock, { className: "w-4 h-4 mr-2" }), "Unlock"] })) : (_jsxs(_Fragment, { children: [_jsx(Lock, { className: "w-4 h-4 mr-2" }), "Lock"] })) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-xs", children: "Duplicate to..." }), _jsxs(Select, { value: "", onValueChange: (toKey) => {
                                                        handleDuplicateKey(keyToEdit, parseInt(toKey));
                                                        setKeyToEdit(null);
                                                    }, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Select key..." }) }), _jsx(SelectContent, { children: Array.from({ length: 24 }).map((_, i) => {
                                                                if (i === keyToEdit)
                                                                    return null;
                                                                const note = PIANO_NOTES[i % 12];
                                                                const octave = 4 + Math.floor(i / 12);
                                                                return (_jsxs(SelectItem, { value: i.toString(), children: [note, octave] }, i));
                                                            }) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-xs", children: ["Layers (", assignments.get(keyToEdit)?.length || 0, ")"] }), assignments.get(keyToEdit)?.map((layer, i) => (_jsxs("div", { className: "text-xs p-2 bg-muted rounded flex items-center justify-between", children: [_jsx("span", { className: "truncate flex-1", children: layer.name }), _jsx("div", { className: "w-3 h-3 rounded-full ml-2 flex-shrink-0", style: { backgroundColor: layer.color } })] }, i)))] }), _jsxs(Button, { variant: "destructive", size: "sm", onClick: () => {
                                                const newAssignments = new Map(assignments);
                                                newAssignments.delete(keyToEdit);
                                                setAssignments(newAssignments);
                                                setKeyToEdit(null);
                                            }, className: "w-full", children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Clear Key"] })] }) }) })), _jsxs("div", { className: "text-[10px] text-muted-foreground/50 p-2.5 rounded-lg border border-border/30 space-y-0.5", style: {
                                background: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.01) 100%)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.06) inset',
                            }, children: [_jsxs("p", { children: ["\u2328\uFE0F ", _jsx("strong", { children: "Keyboard:" }), " Z-M (C4-C5), Q-I (C5-C6) \u2022 \u2191\u2193 shift octaves"] }), _jsxs("p", { children: ["\uD83C\uDF9A\uFE0F ", _jsx("strong", { children: "Expression:" }), " 8 velocity curves \u2022 Pitch bend \u2022 Modulation \u2022 Transpose"] }), _jsxs("p", { children: ["\uD83D\uDD0A ", _jsx("strong", { children: "Layering:" }), " Unlimited layers \u2022 Lock keys \u2022 ADSR \u2022 Filter & pan"] }), _jsxs("p", { children: ["\u26A1 ", _jsx("strong", { children: "Advanced:" }), " MIDI recording \u2022 7-pattern arp with swing \u2022 12 effects \u2022 Waveform viz"] }), _jsxs("p", { children: ["\uD83D\uDCBE ", _jsx("strong", { children: "Shortcuts:" }), " Ctrl+R (Rec) \u2022 Ctrl+P (Play) \u2022 Ctrl+Space (Sustain) \u2022 Drag & drop"] })] })] }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent" })] }) }));
}
export default PianoKeys;
