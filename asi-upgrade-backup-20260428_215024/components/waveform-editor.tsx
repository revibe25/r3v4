// @ts-nocheck
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn, ZoomOut, Scissors, Volume2, Eye, EyeOff, Copy, Trash2,
  Play, Pause, SkipBack, SkipForward, Undo2, Redo2, Mic, MicOff,
  Lock, Unlock, Magnet, Grid3X3, Layers, ChevronDown, ChevronRight,
  Headphones, Music, Sliders, Gauge, ArrowLeftRight
} from 'lucide-react';
import { useTransportState } from '@/hooks/use-transport-state';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface WaveformEditorProps {
  getWaveformData: () => Uint8Array | null;
  isInitialized: boolean;
}

interface SelectionRegion {
  start: number;
  end: number;
  active: boolean;
}

interface Marker {
  id: string;
  position: number; // percentage 0-100
  label: string;
  color: string;
  type: 'marker' | 'loop-start' | 'loop-end' | 'cue';
}

interface AutomationPoint {
  time: number; // percentage 0-100
  value: number; // 0-1
}

interface AutomationLane {
  id: string;
  parameter: string;
  points: AutomationPoint[];
  visible: boolean;
  color: string;
}

interface FadeConfig {
  type: 'in' | 'out';
  duration: number; // percentage of total
  curve: 'linear' | 'exponential' | 'logarithmic' | 'scurve';
}

interface WaveformCache {
  data: Uint8Array | null;
  peaks: number[];
  rms: number;
  peakHold: number;
  lufs: number;
  spectrum: number[];
}

interface HistoryEntry {
  type: string;
  description: string;
  timestamp: number;
  data: any;
}

interface Track {
  id: string;
  name: string;
  armed: boolean;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  input: string;
  fxChain: string[];
  meter: number;
  color: string;
  height: number;
  collapsed: boolean;
  automation: AutomationLane[];
  fadeIn: FadeConfig | null;
  fadeOut: FadeConfig | null;
  locked: boolean;
}

interface MultitrackState {
  tracks: Track[];
  updateTrack: (id: string, data: Partial<Track>) => void;
  addTrack: () => void;
  removeTrack: (id: string) => void;
  duplicateTrack: (id: string) => void;
}

type EditTool = 'select' | 'razor' | 'draw' | 'fade' | 'slip' | 'stretch';
type SnapMode = 'off' | 'grid' | 'beat' | 'bar' | 'marker';
type ViewMode = 'waveform' | 'spectral' | 'bars';

// ============================================================================
// CONSTANTS
// ============================================================================

const CANVAS_HEIGHT = 140;
const GRID_LINES = 8;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 32;
const PEAK_HOLD_TIME = 2000;
const MAX_HISTORY = 50;
const METER_SEGMENTS = 40;
const TRACK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track-1', name: 'Drums', armed: false, muted: false, solo: false,
    volume: 0.8, pan: 0, input: 'Input 1-2', fxChain: ['Compressor', 'EQ'],
    meter: 0, color: TRACK_COLORS[0], height: 80, collapsed: false,
    automation: [{
      id: 'vol-1', parameter: 'Volume', points: [], visible: true, color: '#fbbf24'
    }],
    fadeIn: null, fadeOut: null, locked: false,
  },
  {
    id: 'track-2', name: 'Bass', armed: false, muted: false, solo: false,
    volume: 0.7, pan: -0.2, input: 'Input 3', fxChain: ['Compressor', 'Saturator'],
    meter: 0, color: TRACK_COLORS[1], height: 80, collapsed: false,
    automation: [{
      id: 'vol-2', parameter: 'Volume', points: [], visible: true, color: '#fbbf24'
    }],
    fadeIn: null, fadeOut: null, locked: false,
  },
  {
    id: 'track-3', name: 'Synth Lead', armed: false, muted: false, solo: false,
    volume: 0.75, pan: 0.3, input: 'Input 4', fxChain: ['Delay', 'Reverb'],
    meter: 0, color: TRACK_COLORS[2], height: 80, collapsed: false,
    automation: [{
      id: 'vol-3', parameter: 'Volume', points: [], visible: true, color: '#fbbf24'
    }],
    fadeIn: null, fadeOut: null, locked: false,
  },
  {
    id: 'track-4', name: 'Vocals', armed: true, muted: false, solo: false,
    volume: 0.85, pan: 0, input: 'Input 1', fxChain: ['De-Esser', 'Compressor', 'EQ', 'Reverb'],
    meter: 0, color: TRACK_COLORS[3], height: 80, collapsed: false,
    automation: [
      { id: 'vol-4', parameter: 'Volume', points: [], visible: true, color: '#fbbf24' },
      { id: 'pan-4', parameter: 'Pan', points: [], visible: false, color: '#a78bfa' },
    ],
    fadeIn: { type: 'in', duration: 2, curve: 'logarithmic' },
    fadeOut: { type: 'out', duration: 3, curve: 'exponential' },
    locked: false,
  },
];

// ============================================================================
// UTILITY: Peak-hold meter decay
// ============================================================================

class PeakMeter {
  private peakHold = 0;
  private peakHoldTimer = 0;
  private smoothed = 0;

  update(value: number, dt: number): { current: number; peak: number } {
    this.smoothed += (value - this.smoothed) * Math.min(1, dt * 12);
    if (value > this.peakHold) {
      this.peakHold = value;
      this.peakHoldTimer = PEAK_HOLD_TIME;
    } else {
      this.peakHoldTimer -= dt * 1000;
      if (this.peakHoldTimer <= 0) {
        this.peakHold *= 0.95;
      }
    }
    return { current: this.smoothed, peak: this.peakHold };
  }
}

// ============================================================================
// UTILITY: High-resolution canvas setup
// ============================================================================

function setupHighDPICanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d', { 
    alpha: true,
    desynchronized: true, // Better performance for animations
    willReadFrequently: false
  })!;
  
  ctx.scale(dpr, dpr);
  return ctx;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WaveformEditor({ getWaveformData, isInitialized }: WaveformEditorProps) {
  // ========================================================================
  // REFS
  // ========================================================================

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
  const spectrumRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const waveformCacheRef = useRef<WaveformCache>({
    data: null, peaks: [], rms: 0, peakHold: 0, lufs: -14, spectrum: []
  });
  const peakMeterRef = useRef(new PeakMeter());
  const lastTimeRef = useRef(performance.now());
  const spectrogramHistoryRef = useRef<number[][]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRenderTimeRef = useRef(0);

  // ========================================================================
  // TRANSPORT
  // ========================================================================

  const { transport, togglePlay, toggleRecord, setPosition, setBpm } = useTransportState();

  // ========================================================================
  // STATE: Multitrack
  // ========================================================================

  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);

  const updateTrack = useCallback((id: string, data: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, []);

  const addTrack = useCallback(() => {
    const idx = tracks.length;
    const newTrack: Track = {
      id: `track-${Date.now()}`, name: `Track ${idx + 1}`, armed: false, muted: false,
      solo: false, volume: 0.8, pan: 0, input: `Input ${idx + 1}`, fxChain: [],
      meter: 0, color: TRACK_COLORS[idx % TRACK_COLORS.length], height: 80,
      collapsed: false,
      automation: [{
        id: `vol-${Date.now()}`, parameter: 'Volume', points: [], visible: true, color: '#fbbf24'
      }],
      fadeIn: null, fadeOut: null, locked: false,
    };
    setTracks(prev => [...prev, newTrack]);
  }, [tracks.length]);

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  const duplicateTrack = useCallback((id: string) => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    const newTrack = {
      ...track,
      id: `track-${Date.now()}`,
      name: `${track.name} Copy`,
      armed: false,
      automation: track.automation.map(a => ({ ...a, id: `${a.id}-copy` }))
    };
    setTracks(prev => [...prev, newTrack]);
  }, [tracks]);

  // ========================================================================
  // STATE: UI & Editing
  // ========================================================================

  const [zoomLevel, setZoomLevel] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selection, setSelection] = useState<SelectionRegion>({ start: 0, end: 0, active: false });
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [snapMode, setSnapMode] = useState<SnapMode>('off');
  const [viewMode, setViewMode] = useState<ViewMode>('waveform');
  const [showGrid, setShowGrid] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showSpectrum, setShowSpectrum] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(100);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [rmsLevel, setRmsLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [lufsLevel, setLufsLevel] = useState(-14);
  const [showMixerPanel, setShowMixerPanel] = useState(true);

  // ========================================================================
  // DERIVED: Armed track
  // ========================================================================

  const armedTrack = useMemo(() => tracks.find(t => t.armed), [tracks]);

  // ========================================================================
  // UTILITIES
  // ========================================================================

  const toDB = useCallback((val: number) => {
    if (val <= 0) return '-∞';
    const db = 20 * Math.log10(val);
    return db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
  }, []);

  const addToHistory = useCallback((type: string, description: string, data: any) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ type, description, timestamp: Date.now(), data });
      return newHistory.slice(-MAX_HISTORY);
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      const entry = history[historyIndex - 1];
      // Apply undo logic based on entry.type
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      const entry = history[historyIndex + 1];
      // Apply redo logic
    }
  }, [historyIndex, history]);

  // ========================================================================
  // WAVEFORM PROCESSING (optimized with caching)
  // ========================================================================

  const processWaveformData = useCallback(() => {
    const data = getWaveformData();
    if (!data || data === waveformCacheRef.current.data) return;

    waveformCacheRef.current.data = data;
    const peaks: number[] = [];
    let sumSquares = 0;
    let maxPeak = 0;

    // Optimized peak calculation with downsampling
    const samplesPerPeak = Math.max(1, Math.floor(data.length / 2000));
    
    for (let i = 0; i < data.length; i += samplesPerPeak) {
      let localMax = 0;
      for (let j = 0; j < samplesPerPeak && i + j < data.length; j++) {
        const normalized = (data[i + j] - 128) / 128;
        const abs = Math.abs(normalized);
        localMax = Math.max(localMax, abs);
        sumSquares += normalized * normalized;
      }
      peaks.push(localMax);
      maxPeak = Math.max(maxPeak, localMax);
    }

    const rms = Math.sqrt(sumSquares / data.length);
    const lufs = -23 + 10 * Math.log10(rms * rms);

    waveformCacheRef.current.peaks = peaks;
    waveformCacheRef.current.rms = rms;
    waveformCacheRef.current.peakHold = maxPeak;
    waveformCacheRef.current.lufs = lufs;
  }, [getWaveformData]);

  // ========================================================================
  // HIGH-RESOLUTION RENDERING (optimized)
  // ========================================================================

  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const now = performance.now();
    
    // Throttle rendering to 60fps
    if (now - lastRenderTimeRef.current < 16.67) return;
    lastRenderTimeRef.current = now;

    const { peaks } = waveformCacheRef.current;
    if (!peaks.length) return;

    // Clear with better performance
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
    bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.4)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.2)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_LINES; i++) {
        const y = (i / GRID_LINES) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Calculate visible range
    const startIdx = Math.floor((scrollOffset / 100) * peaks.length);
    const endIdx = Math.ceil(((scrollOffset + 100 / zoomLevel) / 100) * peaks.length);
    const visiblePeaks = peaks.slice(startIdx, endIdx);

    // Optimized waveform rendering with adaptive detail
    const samplesPerPixel = Math.max(1, Math.ceil(visiblePeaks.length / width));
    
    ctx.beginPath();
    const waveGradient = ctx.createLinearGradient(0, height / 2, 0, 0);
    waveGradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
    waveGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.8)');
    waveGradient.addColorStop(1, 'rgba(96, 165, 250, 1)');
    ctx.fillStyle = waveGradient;
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
    ctx.lineWidth = 1;

    // Draw using path for better performance
    for (let x = 0; x < width; x++) {
      const idx = Math.floor((x / width) * visiblePeaks.length);
      if (idx >= visiblePeaks.length) break;

      let maxAmp = 0;
      for (let s = 0; s < samplesPerPixel && idx * samplesPerPixel + s < visiblePeaks.length; s++) {
        maxAmp = Math.max(maxAmp, visiblePeaks[idx * samplesPerPixel + s] || 0);
      }

      const barHeight = maxAmp * height * 0.9;
      const y = (height - barHeight) / 2;

      if (x === 0) {
        ctx.moveTo(x, height / 2);
      }
      ctx.lineTo(x, y);
    }

    // Mirror to create symmetric waveform
    for (let x = width - 1; x >= 0; x--) {
      const idx = Math.floor((x / width) * visiblePeaks.length);
      if (idx >= visiblePeaks.length) continue;

      let maxAmp = 0;
      for (let s = 0; s < samplesPerPixel && idx * samplesPerPixel + s < visiblePeaks.length; s++) {
        maxAmp = Math.max(maxAmp, visiblePeaks[idx * samplesPerPixel + s] || 0);
      }

      const barHeight = maxAmp * height * 0.9;
      const y = (height + barHeight) / 2;
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Selection overlay
    if (selection.active && selection.start !== selection.end) {
      const selStart = ((selection.start - scrollOffset) / (100 / zoomLevel)) * width;
      const selEnd = ((selection.end - scrollOffset) / (100 / zoomLevel)) * width;
      
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(selStart, 0, selEnd - selStart, height);
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(selStart, 0, selEnd - selStart, height);
    }

    // Playhead
    const playheadPos = ((transport.position / ((transport as any).duration || 1)) * 100 - scrollOffset) / (100 / zoomLevel) * width;
    if (playheadPos >= 0 && playheadPos <= width) {
      ctx.strokeStyle = transport.isPlaying ? 'rgba(16, 185, 129, 0.9)' : 'rgba(248, 113, 113, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadPos, 0);
      ctx.lineTo(playheadPos, height);
      ctx.stroke();

      // Playhead indicator at top
      ctx.fillStyle = transport.isPlaying ? 'rgba(16, 185, 129, 1)' : 'rgba(248, 113, 113, 1)';
      ctx.beginPath();
      ctx.moveTo(playheadPos - 5, 0);
      ctx.lineTo(playheadPos + 5, 0);
      ctx.lineTo(playheadPos, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Loop markers
    if (loopEnabled) {
      const loopStartX = ((loopStart - scrollOffset) / (100 / zoomLevel)) * width;
      const loopEndX = ((loopEnd - scrollOffset) / (100 / zoomLevel)) * width;

      ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);

      ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(loopStartX, 0);
      ctx.lineTo(loopStartX, height);
      ctx.moveTo(loopEndX, 0);
      ctx.lineTo(loopEndX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Markers
    markers.forEach(marker => {
      const markerX = ((marker.position - scrollOffset) / (100 / zoomLevel)) * width;
      if (markerX >= 0 && markerX <= width) {
        ctx.strokeStyle = marker.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, height);
        ctx.stroke();

        ctx.fillStyle = marker.color;
        ctx.font = '10px monospace';
        ctx.fillText(marker.label, markerX + 4, 14);
      }
    });
  }, [showGrid, scrollOffset, zoomLevel, selection, transport, loopEnabled, loopStart, loopEnd, markers]);

  // ========================================================================
  // MINIMAP RENDERING (optimized)
  // ========================================================================

  const drawMiniMap = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const { peaks } = waveformCacheRef.current;
    if (!peaks.length) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Downsampled waveform for minimap
    const samplesPerPixel = Math.max(1, Math.ceil(peaks.length / width));
    
    ctx.fillStyle = 'rgba(71, 85, 105, 0.6)';
    for (let x = 0; x < width; x++) {
      const idx = Math.floor((x / width) * peaks.length);
      let maxAmp = 0;
      
      for (let s = 0; s < samplesPerPixel && idx + s < peaks.length; s++) {
        maxAmp = Math.max(maxAmp, peaks[idx + s] || 0);
      }

      const barHeight = maxAmp * height * 0.8;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, 1, barHeight);
    }

    // Viewport indicator
    const viewStart = (scrollOffset / 100) * width;
    const viewWidth = (100 / zoomLevel / 100) * width;
    
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(viewStart, 0, viewWidth, height);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fillRect(viewStart, 0, viewWidth, height);
  }, [scrollOffset, zoomLevel]);

  // ========================================================================
  // SPECTRUM ANALYZER (optimized)
  // ========================================================================

  const drawSpectrum = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const { spectrum } = waveformCacheRef.current;
    if (!spectrum.length) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / spectrum.length;
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0.8)');

    ctx.fillStyle = gradient;
    
    spectrum.forEach((value, i) => {
      const barHeight = value * height;
      const x = i * barWidth;
      const y = height - barHeight;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, []);

  // ========================================================================
  // ANIMATION LOOP (optimized with requestAnimationFrame)
  // ========================================================================

  useEffect(() => {
    if (!isInitialized) return;

    const animate = () => {
      const now = performance.now();
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      processWaveformData();

      // Update meters
      const cache = waveformCacheRef.current;
      const { current, peak } = peakMeterRef.current.update(cache.rms, dt);
      setRmsLevel(current);
      setPeakLevel(peak);
      setLufsLevel(cache.lufs);

      // Render canvases
      const canvas = canvasRef.current;
      const miniMap = miniMapRef.current;
      const spectrum = spectrumRef.current;

      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const ctx = setupHighDPICanvas(canvas, rect.width, rect.height);
        drawWaveform(ctx, rect.width, rect.height);
      }

      if (miniMap && showMiniMap) {
        const rect = miniMap.getBoundingClientRect();
        const ctx = setupHighDPICanvas(miniMap, rect.width, rect.height);
        drawMiniMap(ctx, rect.width, rect.height);
      }

      if (spectrum && showSpectrum) {
        const rect = spectrum.getBoundingClientRect();
        const ctx = setupHighDPICanvas(spectrum, rect.width, rect.height);
        drawSpectrum(ctx, rect.width, rect.height);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isInitialized, processWaveformData, drawWaveform, drawMiniMap, drawSpectrum, showMiniMap, showSpectrum]);

  // ========================================================================
  // MOUSE INTERACTION
  // ========================================================================

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * (100 / zoomLevel) + scrollOffset;

    if (activeTool === 'select') {
      setSelection({ start: percentage, end: percentage, active: true });
    } else if (activeTool === 'razor') {
      // Add cut point
      addToHistory('cut', `Cut at ${percentage.toFixed(1)}%`, { position: percentage });
    }
  }, [zoomLevel, scrollOffset, activeTool, addToHistory]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selection.active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * (100 / zoomLevel) + scrollOffset;

    setSelection(prev => ({ ...prev, end: percentage }));
  }, [selection.active, zoomLevel, scrollOffset]);

  const handleCanvasMouseUp = useCallback(() => {
    if (selection.active) {
      const start = Math.min(selection.start, selection.end);
      const end = Math.max(selection.start, selection.end);
      setSelection({ start, end, active: false });
    }
  }, [selection]);

  // ========================================================================
  // KEYBOARD SHORTCUTS
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'r':
          e.preventDefault();
          toggleRecord();
          break;
        case 'l':
          e.preventDefault();
          setLoopEnabled(prev => !prev);
          break;
        case 'm':
          e.preventDefault();
          const pos = (transport.position / ((transport as any).duration || 1)) * 100;
          setMarkers(prev => [...prev, {
            id: `marker-${Date.now()}`,
            position: pos,
            label: `M${prev.length + 1}`,
            color: '#fbbf24',
            type: 'marker'
          }]);
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
          }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleRecord, undo, redo, transport]);

  // ========================================================================
  // ZOOM CONTROLS
  // ========================================================================

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, MIN_ZOOM));
  }, []);

  // ========================================================================
  // LEVEL METER COMPONENT
  // ========================================================================

  const LevelMeter = ({ value, peak, width, height }: { value: number; peak: number; width: number; height: number }) => {
    const segments = Array.from({ length: METER_SEGMENTS }, (_, i) => {
      const segmentValue = 1 - i / METER_SEGMENTS;
      const isActive = value >= segmentValue;
      const isPeak = Math.abs(peak - segmentValue) < 0.03;

      let color = 'bg-[#a3e635]';
      if (segmentValue > 0.8) color = 'bg-red-500';
      else if (segmentValue > 0.6) color = 'bg-[#ffaa00]';

      return (
        <div
          key={i}
          className={`w-full transition-opacity duration-75 ${
            isActive ? `${color} opacity-100` : 'bg-[#111] opacity-60'
          } ${isPeak ? 'opacity-100 brightness-150' : ''}`}
          style={{ height: `${100 / METER_SEGMENTS}%` }}
        />
      );
    });

    return (
      <div className="flex flex-col gap-px" style={{ width: `${width}px`, height: `${height}px` }}>
        {segments}
      </div>
    );
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full relative text-foreground overflow-hidden"
      style={{
        borderRadius: 0,
        border: '1px solid #222',
        background: '#000000',
        boxShadow: 'none',
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
      }}
    >
      {/* 3D Top highlight edge */}

      {/* Header bar — industrial */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{
          background: '#0c0c0c',
          borderColor: '#222',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex items-center justify-center w-6 h-6 flex-shrink-0"
            style={{
              background: '#a3e635',
              borderRadius: 0,
            }}
          >
            <Music className="w-3.5 h-3.5" style={{ color: '#000' }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold leading-none" style={{ color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>
              Waveform Editor
            </h3>
            <p className="text-[9px] leading-tight mt-0.5" style={{ color: '#444', letterSpacing: 1 }}>
              MULTITRACK · SPECTRAL · AUTOMATION
            </p>
          </div>
        </div>
        {!showMixerPanel && (
          <Button
            variant="ghost" size="sm"
            onClick={() => setShowMixerPanel(true)}
            className="h-6 w-6 p-0 rounded-none"
          >
            <Layers className="w-3 h-3" />
          </Button>
        )}
      </div>
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TOOLBAR */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap flex-shrink-0"
        style={{ background: '#0c0c0c', borderColor: '#222' }}
      >
        {/* Edit tools */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-[#222]">
          {(['select', 'razor', 'draw', 'fade'] as EditTool[]).map(tool => (
            <Button
              key={tool}
              variant={activeTool === tool ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTool(tool)}
              className={`h-7 px-2 text-xs capitalize ${activeTool === tool ? 'bg-[#a3e635] text-black' : ''}`}
            >
              {tool === 'select' && <ArrowLeftRight className="w-3 h-3" />}
              {tool === 'razor' && <Scissors className="w-3 h-3" />}
              {tool === 'draw' && 'Draw'}
              {tool === 'fade' && 'Fade'}
            </Button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-[#222]">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-7 w-7 p-0">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-[#555] font-mono w-10 text-center">
            {zoomLevel.toFixed(1)}x
          </span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-7 w-7 p-0">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Snap */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-[#222]">
          <Button
            variant={snapMode !== 'off' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSnapMode(prev => prev === 'off' ? 'grid' : 'off')}
            className="h-7 px-2 text-xs"
          >
            <Magnet className="w-3 h-3 mr-1" />
            {snapMode === 'off' ? 'Off' : snapMode}
          </Button>
          <Button
            variant={showGrid ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowGrid(prev => !prev)}
            className="h-7 w-7 p-0"
          >
            <Grid3X3 className="w-3 h-3" />
          </Button>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-[#222]">
          {(['waveform', 'spectral', 'bars'] as ViewMode[]).map(mode => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(mode)}
              className={`h-7 px-2 text-xs capitalize ${viewMode === mode ? 'bg-[#a3e635] text-black' : ''}`}
            >
              {mode}
            </Button>
          ))}
        </div>

        {/* Display toggles */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-[#222]">
          <Button
            variant={showMiniMap ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowMiniMap(prev => !prev)}
            className="h-7 px-2 text-xs"
          >
            MiniMap
          </Button>
          <Button
            variant={showSpectrum ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowSpectrum(prev => !prev)}
            className="h-7 px-2 text-xs"
          >
            Spectrum
          </Button>
        </div>

        {/* History */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-7 w-7 p-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-7 w-7 p-0"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Loop toggle */}
        <div className="ml-auto">
          <Button
            variant={loopEnabled ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setLoopEnabled(prev => !prev)}
            className={`h-7 px-2 text-xs ${loopEnabled ? 'bg-[#a3e635] text-black' : ''}`}
          >
            Loop {loopEnabled && '✓'}
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MAIN WORKSPACE */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">
        {/* ── Mixer Panel ── */}
        {showMixerPanel && (
          <div
            className="w-64 flex-shrink-0 border-r overflow-y-auto"
            style={{
              background: '#0a0a0a',
              borderColor: '#222',
            }}
          >
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#222] sticky top-0 z-10 bg-[#0c0c0c] ">
              <span className="text-xs font-semibold text-[#555] flex items-center gap-1">
                <Layers className="w-3 h-3" />
                TRACKS
              </span>
              <Button
                variant="ghost" size="sm"
                onClick={() => setShowMixerPanel(false)}
                className="h-5 w-5 p-0"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>

            {tracks.map(track => (
              <div
                key={track.id}
                className={`border-b border-[#222]/30 ${track.collapsed ? 'h-6' : ''} transition-all`}
                style={{ borderLeftWidth: 3, borderLeftColor: track.color }}
              >
                {/* Track header */}
                <div className="flex items-center gap-1 px-2 py-1 bg-[#0c0c0c] hover:bg-[#111] transition-colors">
                  <button
                    onClick={() => updateTrack(track.id, { collapsed: !track.collapsed })}
                    className="text-[#555] hover:text-[#a3e635]"
                  >
                    {track.collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <input
                    type="text"
                    value={track.name}
                    onChange={e => updateTrack(track.id, { name: e.target.value })}
                    className="flex-1 bg-transparent text-xs font-semibold text-foreground/80 border-none outline-none"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); duplicateTrack(track.id); }}
                      className="text-[#555] hover:text-[#a3e635] p-0.5"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); removeTrack(track.id); }}
                      className="text-[#555] hover:text-red-400 p-0.5"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {!track.collapsed && (
                  <div className="px-2 py-1.5 space-y-1.5">
                    {/* Controls row */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        onClick={e => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }); }}
                        className={`w-4 h-4 rounded-none flex items-center justify-center font-bold transition-colors ${
                          track.armed ? 'bg-[#ff2200] text-foreground' : 'bg-[#1a1a1a] text-[#444] hover:text-[#888]'
                        }`}
                      >
                        R
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
                        className={`w-4 h-4 rounded-none flex items-center justify-center font-bold transition-colors ${
                          track.muted ? 'bg-[#222] text-[#888]' : 'bg-[#1a1a1a] text-[#444] hover:text-[#888]'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
                        className={`w-4 h-4 rounded-none flex items-center justify-center font-bold transition-colors ${
                          track.solo ? 'bg-[#a3e635] text-black' : 'bg-[#1a1a1a] text-[#444] hover:text-[#888]'
                        }`}
                      >
                        S
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); updateTrack(track.id, { locked: !track.locked }); }}
                        className="text-[#555] hover:text-[#a3e635] p-0.5"
                      >
                        {track.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                      </button>

                      {/* Volume slider */}
                      <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={track.volume}
                        onChange={e => { e.stopPropagation(); updateTrack(track.id, { volume: parseFloat(e.target.value) }); }}
                        className="flex-1 h-1 bg-[#1a1a1a] appearance-none cursor-pointer ml-1"
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="text-[8px] text-[#555] w-5 text-right font-mono">
                        {toDB(track.volume)}
                      </span>
                    </div>

                    {/* FX chain pills */}
                    {track.fxChain.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 px-2 pb-1.5">
                        {track.fxChain.map((fx, i) => (
                          <span key={i} className="text-[7px] px-1 py-0 rounded bg-[#111] text-[#555]">
                            {fx}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add track button */}
            <button
              onClick={addTrack}
              className="w-full py-2 text-[10px] text-[#555] hover:text-[#a3e635] hover:bg-[#111] transition-colors"
            >
              + Add Track
            </button>
          </div>
        )}

        {/* ── Canvas Area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Ruler / Timeline */}
          <div className="h-5 bg-[#0c0c0c] border-b border-[#222] relative flex-shrink-0">
            <canvas className="w-full h-full" />
            {/* Marker flags on ruler */}
            {markers.map(m => (
              <div
                key={m.id}
                className="absolute top-0 h-full"
                style={{ left: `${m.position}%` }}
              >
                <div
                  className="w-1 h-full"
                  style={{ backgroundColor: m.color + '40' }}
                />
              </div>
            ))}
          </div>

          {/* Main waveform canvas */}
          <canvas
            ref={canvasRef}
            className={`w-full flex-1 ${
              activeTool === 'select' ? 'cursor-crosshair' :
              activeTool === 'razor' ? 'cursor-col-resize' :
              activeTool === 'draw' ? 'cursor-cell' :
              'cursor-pointer'
            } hover:ring-1 hover:ring-[#a3e635]/40 transition-shadow`}
            style={{ height: CANVAS_HEIGHT }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* Mini-map */}
          {showMiniMap && (
            <canvas
              ref={miniMapRef}
              className="w-full border-t border-[#222] flex-shrink-0"
              style={{ height: 24 }}
            />
          )}

          {/* Spectrum analyzer */}
          {showSpectrum && (
            <canvas
              ref={spectrumRef}
              className="w-full border-t border-[#222] flex-shrink-0"
              style={{ height: 48 }}
            />
          )}
        </div>

        {/* ── Master Meter ── */}
        <div className="w-16 flex-shrink-0 bg-[#0c0c0c] border-l border-[#222] flex flex-col items-center py-2 gap-1">
          <span className="text-[8px] text-[#555] font-mono uppercase tracking-widest">MASTER</span>
          <div className="flex gap-1">
            <LevelMeter value={rmsLevel} peak={peakLevel} width={6} height={100} />
            <LevelMeter value={rmsLevel * 0.95} peak={peakLevel * 0.97} width={6} height={100} />
          </div>
          <div className="text-center mt-1">
            <div className={`text-[10px] font-mono font-bold ${peakLevel > 0.9 ? 'text-[#ff2200]' : 'text-[#a3e635]'}`}>
              {toDB(peakLevel)} dB
            </div>
            <div className="text-[8px] text-[#555] font-mono">
              RMS {toDB(rmsLevel)}
            </div>
            <div className="text-[8px] text-[#555] font-mono">
              LUFS {lufsLevel.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TRANSPORT BAR */}
      <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ background: '#0c0c0c', borderColor: '#222' }}>
        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm"
            onClick={() => setPosition(0)}
            className="h-7 w-7 p-0 text-[#555] hover:text-[#a3e635]"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={transport.isPlaying ? 'default' : 'ghost'}
            size="sm"
            onClick={togglePlay}
            className={`h-7 w-7 p-0 ${transport.isPlaying ? 'bg-[#a3e635] hover:bg-[#a3e635]' : 'text-[#555] hover:text-[#a3e635]'}`}
          >
            {transport.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant={transport.isRecording ? 'destructive' : 'ghost'}
            size="sm"
            onClick={toggleRecord}
            disabled={!armedTrack?.armed}
            className="h-7 w-7 p-0"
          >
            <span className={`w-3 h-3 inline-block ${transport.isRecording ? 'bg-red-400 animate-pulse' : 'bg-[#333]'}`} />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-[#555] hover:text-[#a3e635]"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="w-px h-5 bg-[#222]" />

        {/* Time display */}
        <div className="bg-background px-2 py-0.5 font-mono flex items-baseline gap-1">
          <span className="text-[#a3e635] text-sm font-bold tabular-nums">
            {Math.floor(transport.position / 60).toString().padStart(2, '0')}:
            {Math.floor(transport.position % 60).toString().padStart(2, '0')}.
            {Math.floor((transport.position % 1) * 100).toString().padStart(2, '0')}
          </span>
          <span className="text-[#444] text-[9px]">
            / {Math.floor(((transport as any).duration || 0) / 60)}:{Math.floor(((transport as any).duration || 0) % 60).toString().padStart(2, '0')}
          </span>
        </div>

        <div className="w-px h-5 bg-[#222]" />

        {/* BPM */}
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3 h-3 text-[#555]" />
          <input
            type="number" min="40" max="300"
            value={(transport as any).bpm}
            onChange={e => setBpm(parseInt(e.target.value) || 120)}
            className="w-12 bg-background/40 border border-[#222] text-[11px] text-center text-foreground/80 font-mono px-1 py-0.5"
          />
          <span className="text-[9px] text-[#555]">BPM</span>
        </div>

        <div className="w-px h-5 bg-[#222]" />

        {/* Loop controls */}
        {loopEnabled && (
          <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: '#a3e635' }}>
            <span>↻</span>
            <span>{loopStart.toFixed(0)}%</span>
            <ArrowLeftRight className="w-3 h-3" />
            <span>{loopEnd.toFixed(0)}%</span>
          </div>
        )}

        {/* Selection info */}
        {selection.active && selection.start !== selection.end && (
          <div className="text-[10px] text-[#a3e635] font-mono">
            Sel: {selection.start.toFixed(1)}% → {selection.end.toFixed(1)}%
            ({(selection.end - selection.start).toFixed(1)}%)
          </div>
        )}

        {/* Right side: keyboard hint */}
        <div className="ml-auto flex items-center gap-2 text-[9px] text-[#444]">
          <span>Space: Play</span>
          <span>R: Record</span>
          <span>L: Loop</span>
          <span>M: Marker</span>
          <span>Ctrl+Z/Y: Undo</span>
        </div>
      </div>

      {/* 3D Bottom shadow edge */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#222]" />
    </div>
  );
}

export default WaveformEditor;