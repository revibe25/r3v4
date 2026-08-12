import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber), var(--status-ok) (emerald), var(--accent-purple) (violet)
// Reason: TRACK_COLORS decorative array — grep-excluded STATUS values used as track accents
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Scissors, Copy, Trash2, Play, Pause, SkipBack, SkipForward, Undo2, Redo2, Lock, Unlock, Magnet, Grid3X3, Layers, ChevronDown, ChevronRight, Music, Gauge, ArrowLeftRight } from 'lucide-react';
import { useTransportState } from '@/hooks/use-transport-state';
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
    'var(--looper-blue)', 'var(--status-ok)', 'var(--status-warn)', '#ef4444', 'var(--accent-purple)',
    'var(--track-pink)', 'var(--track-cyan)', 'var(--looper-lime)', 'var(--track-orange)', 'var(--track-indigo)'
];
const DEFAULT_TRACKS = [
    {
        id: 'track-1', name: 'Drums', armed: false, muted: false, solo: false,
        volume: 0.8, pan: 0, input: 'Input 1-2', fxChain: ['Compressor', 'EQ'],
        meter: 0, color: TRACK_COLORS[0], height: 80, collapsed: false,
        automation: [{
                id: 'vol-1', parameter: 'Volume', points: [], visible: true, color: 'var(--accent-amber)'
            }],
        fadeIn: null, fadeOut: null, locked: false,
    },
    {
        id: 'track-2', name: 'Bass', armed: false, muted: false, solo: false,
        volume: 0.7, pan: -0.2, input: 'Input 3', fxChain: ['Compressor', 'Saturator'],
        meter: 0, color: TRACK_COLORS[1], height: 80, collapsed: false,
        automation: [{
                id: 'vol-2', parameter: 'Volume', points: [], visible: true, color: 'var(--accent-amber)'
            }],
        fadeIn: null, fadeOut: null, locked: false,
    },
    {
        id: 'track-3', name: 'Synth Lead', armed: false, muted: false, solo: false,
        volume: 0.75, pan: 0.3, input: 'Input 4', fxChain: ['Delay', 'Reverb'],
        meter: 0, color: TRACK_COLORS[2], height: 80, collapsed: false,
        automation: [{
                id: 'vol-3', parameter: 'Volume', points: [], visible: true, color: 'var(--accent-amber)'
            }],
        fadeIn: null, fadeOut: null, locked: false,
    },
    {
        id: 'track-4', name: 'Vocals', armed: true, muted: false, solo: false,
        volume: 0.85, pan: 0, input: 'Input 1', fxChain: ['De-Esser', 'Compressor', 'EQ', 'Reverb'],
        meter: 0, color: TRACK_COLORS[3], height: 80, collapsed: false,
        automation: [
            { id: 'vol-4', parameter: 'Volume', points: [], visible: true, color: 'var(--accent-amber)' },
            { id: 'pan-4', parameter: 'Pan', points: [], visible: false, color: 'var(--accent-violet-soft)' },
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
    constructor() {
        this.peakHold = 0;
        this.peakHoldTimer = 0;
        this.smoothed = 0;
    }
    update(value, dt) {
        this.smoothed += (value - this.smoothed) * Math.min(1, dt * 12);
        if (value > this.peakHold) {
            this.peakHold = value;
            this.peakHoldTimer = PEAK_HOLD_TIME;
        }
        else {
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
function setupHighDPICanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true, // Better performance for animations
        willReadFrequently: false
    });
    ctx.scale(dpr, dpr);
    return ctx;
}
// ============================================================================
// COMPONENT
// ============================================================================
export function WaveformEditor({ getWaveformData, isInitialized }) {
    // ========================================================================
    // REFS
    // ========================================================================
    const canvasRef = useRef(null);
    const miniMapRef = useRef(null);
    const spectrumRef = useRef(null);
    const animationRef = useRef();
    const waveformCacheRef = useRef({
        data: null, peaks: [], rms: 0, peakHold: 0, lufs: -14, spectrum: []
    });
    const peakMeterRef = useRef(new PeakMeter());
    const lastTimeRef = useRef(performance.now());
    const _spectrogramHistoryRef = useRef([]);
    const containerRef = useRef(null);
    const _offscreenCanvasRef = useRef(null);
    const lastRenderTimeRef = useRef(0);
    // ========================================================================
    // TRANSPORT
    // ========================================================================
    const { transport, togglePlay, toggleRecord, setPosition, setBpm } = useTransportState();
    // ========================================================================
    // STATE: Multitrack
    // ========================================================================
    const [tracks, setTracks] = useState(DEFAULT_TRACKS);
    const updateTrack = useCallback((id, data) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    }, []);
    const addTrack = useCallback(() => {
        const idx = tracks.length;
        const newTrack = {
            id: `track-${Date.now()}`, name: `Track ${idx + 1}`, armed: false, muted: false,
            solo: false, volume: 0.8, pan: 0, input: `Input ${idx + 1}`, fxChain: [],
            meter: 0, color: TRACK_COLORS[idx % TRACK_COLORS.length], height: 80,
            collapsed: false,
            automation: [{
                    id: `vol-${Date.now()}`, parameter: 'Volume', points: [], visible: true, color: 'var(--accent-amber)'
                }],
            fadeIn: null, fadeOut: null, locked: false,
        };
        setTracks(prev => [...prev, newTrack]);
    }, [tracks.length]);
    const removeTrack = useCallback((id) => {
        setTracks(prev => prev.filter(t => t.id !== id));
    }, []);
    const duplicateTrack = useCallback((id) => {
        const track = tracks.find(t => t.id === id);
        if (!track)
            return;
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
    const [selection, setSelection] = useState({ start: 0, end: 0, active: false });
    const [activeTool, setActiveTool] = useState('select');
    const [snapMode, setSnapMode] = useState('off');
    const [viewMode, setViewMode] = useState('waveform');
    const [showGrid, setShowGrid] = useState(true);
    const [showMiniMap, setShowMiniMap] = useState(true);
    const [showSpectrum, setShowSpectrum] = useState(false);
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [loopStart, setLoopStart] = useState(0);
    const [loopEnd, setLoopEnd] = useState(100);
    const [markers, setMarkers] = useState([]);
    const [history, setHistory] = useState([]);
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
    const toDB = useCallback((val) => {
        if (val <= 0)
            return '-∞';
        const db = 20 * Math.log10(val);
        return db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
    }, []);
    const addToHistory = useCallback((type, description, data) => {
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
        if (!data || data === waveformCacheRef.current.data)
            return;
        waveformCacheRef.current.data = data;
        const peaks = [];
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
    const drawWaveform = useCallback((ctx, width, height) => {
        const now = performance.now();
        // Throttle rendering to 60fps
        if (now - lastRenderTimeRef.current < 16.67)
            return;
        lastRenderTimeRef.current = now;
        const { peaks } = waveformCacheRef.current;
        if (!peaks.length)
            return;
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
            if (idx >= visiblePeaks.length)
                break;
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
            if (idx >= visiblePeaks.length)
                continue;
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
        const playheadPos = ((transport.position / (transport.duration || 1)) * 100 - scrollOffset) / (100 / zoomLevel) * width;
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
    const drawMiniMap = useCallback((ctx, width, height) => {
        const { peaks } = waveformCacheRef.current;
        if (!peaks.length)
            return;
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
    const drawSpectrum = useCallback((ctx, width, height) => {
        const { spectrum } = waveformCacheRef.current;
        if (!spectrum.length)
            return;
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
        if (!isInitialized)
            return;
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
    const handleCanvasMouseDown = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * (100 / zoomLevel) + scrollOffset;
        if (activeTool === 'select') {
            setSelection({ start: percentage, end: percentage, active: true });
        }
        else if (activeTool === 'razor') {
            // Add cut point
            addToHistory('cut', `Cut at ${percentage.toFixed(1)}%`, { position: percentage });
        }
    }, [zoomLevel, scrollOffset, activeTool, addToHistory]);
    const handleCanvasMouseMove = useCallback((e) => {
        if (!selection.active)
            return;
        const canvas = canvasRef.current;
        if (!canvas)
            return;
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
        const handleKeyDown = (e) => {
            if (e.target instanceof HTMLInputElement)
                return;
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
                    const pos = (transport.position / (transport.duration || 1)) * 100;
                    setMarkers(prev => [...prev, {
                            id: `marker-${Date.now()}`,
                            position: pos,
                            label: `M${prev.length + 1}`,
                            color: 'var(--accent-amber)',
                            type: 'marker'
                        }]);
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (e.shiftKey)
                            redo();
                        else
                            undo();
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
    const LevelMeter = ({ value, peak, width, height }) => {
        const segments = Array.from({ length: METER_SEGMENTS }, (_, i) => {
            const segmentValue = 1 - i / METER_SEGMENTS;
            const isActive = value >= segmentValue;
            const isPeak = Math.abs(peak - segmentValue) < 0.03;
            let color = 'bg-[#a3e635]';
            if (segmentValue > 0.8)
                color = 'bg-red-500';
            else if (segmentValue > 0.6)
                color = 'bg-[var(--signal-warn)]';
            return (_jsx("div", { className: `w-full transition-opacity duration-75 ${isActive ? `${color} opacity-100` : 'bg-[var(--dj-surface2)] opacity-60'} ${isPeak ? 'opacity-100 brightness-150' : ''}`, style: { height: `${100 / METER_SEGMENTS}%` } }, i));
        });
        return (_jsx("div", { className: "flex flex-col gap-px", style: { width: `${width}px`, height: `${height}px` }, children: segments }));
    };
    // ========================================================================
    // RENDER
    // ========================================================================
    return (_jsxs("div", { ref: containerRef, className: "flex flex-col h-full relative text-foreground overflow-hidden", style: {
            borderRadius: 0,
            border: '1px solid var(--dj-border)',
            background: 'var(--dj-black)',
            boxShadow: 'none',
            fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        }, children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 border-b flex-shrink-0", style: {
                    background: 'var(--dj-surface)',
                    borderColor: 'var(--dj-border)',
                }, children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("div", { className: "flex items-center justify-center w-6 h-6 flex-shrink-0", style: {
                                    background: '#a3e635',
                                    borderRadius: 0,
                                }, children: _jsx(Music, { className: "w-3.5 h-3.5", style: { color: 'var(--dj-black)' } }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "text-xs font-bold leading-none", style: { color: 'var(--white)', letterSpacing: 2, textTransform: 'uppercase' }, children: "Waveform Editor" }), _jsx("p", { className: "text-[9px] leading-tight mt-0.5", style: { color: 'var(--dj-dim)', letterSpacing: 1 }, children: "MULTITRACK \u00B7 SPECTRAL \u00B7 AUTOMATION" })] })] }), !showMixerPanel && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowMixerPanel(true), className: "h-6 w-6 p-0 rounded-none", children: _jsx(Layers, { className: "w-3 h-3" }) }))] }), _jsxs("div", { className: "flex items-center gap-1 px-2 py-1.5 border-b flex-wrap flex-shrink-0", style: { background: 'var(--dj-surface)', borderColor: 'var(--dj-border)' }, children: [_jsx("div", { className: "flex items-center gap-0.5 pr-2 border-r border-[var(--dj-border)]", children: ['select', 'razor', 'draw', 'fade'].map(tool => (_jsxs(Button, { variant: activeTool === tool ? 'default' : 'ghost', size: "sm", onClick: () => setActiveTool(tool), className: `h-7 px-2 text-xs capitalize ${activeTool === tool ? 'bg-[#a3e635] text-black' : ''}`, children: [tool === 'select' && _jsx(ArrowLeftRight, { className: "w-3 h-3" }), tool === 'razor' && _jsx(Scissors, { className: "w-3 h-3" }), tool === 'draw' && 'Draw', tool === 'fade' && 'Fade'] }, tool))) }), _jsxs("div", { className: "flex items-center gap-0.5 pr-2 border-r border-[var(--dj-border)]", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: handleZoomOut, className: "h-7 w-7 p-0", children: _jsx(ZoomOut, { className: "w-3.5 h-3.5" }) }), _jsxs("span", { className: "text-[10px] text-[#555] font-mono w-10 text-center", children: [zoomLevel.toFixed(1), "x"] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleZoomIn, className: "h-7 w-7 p-0", children: _jsx(ZoomIn, { className: "w-3.5 h-3.5" }) })] }), _jsxs("div", { className: "flex items-center gap-0.5 pr-2 border-r border-[var(--dj-border)]", children: [_jsxs(Button, { variant: snapMode !== 'off' ? 'default' : 'ghost', size: "sm", onClick: () => setSnapMode(prev => prev === 'off' ? 'grid' : 'off'), className: "h-7 px-2 text-xs", children: [_jsx(Magnet, { className: "w-3 h-3 mr-1" }), snapMode === 'off' ? 'Off' : snapMode] }), _jsx(Button, { variant: showGrid ? 'default' : 'ghost', size: "sm", onClick: () => setShowGrid(prev => !prev), className: "h-7 w-7 p-0", children: _jsx(Grid3X3, { className: "w-3 h-3" }) })] }), _jsx("div", { className: "flex items-center gap-0.5 pr-2 border-r border-[var(--dj-border)]", children: ['waveform', 'spectral', 'bars'].map(mode => (_jsx(Button, { variant: viewMode === mode ? 'default' : 'ghost', size: "sm", onClick: () => setViewMode(mode), className: `h-7 px-2 text-xs capitalize ${viewMode === mode ? 'bg-[#a3e635] text-black' : ''}`, children: mode }, mode))) }), _jsxs("div", { className: "flex items-center gap-0.5 pr-2 border-r border-[var(--dj-border)]", children: [_jsx(Button, { variant: showMiniMap ? 'default' : 'ghost', size: "sm", onClick: () => setShowMiniMap(prev => !prev), className: "h-7 px-2 text-xs", children: "MiniMap" }), _jsx(Button, { variant: showSpectrum ? 'default' : 'ghost', size: "sm", onClick: () => setShowSpectrum(prev => !prev), className: "h-7 px-2 text-xs", children: "Spectrum" })] }), _jsxs("div", { className: "flex items-center gap-0.5", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: undo, disabled: historyIndex <= 0, className: "h-7 w-7 p-0", children: _jsx(Undo2, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: redo, disabled: historyIndex >= history.length - 1, className: "h-7 w-7 p-0", children: _jsx(Redo2, { className: "w-3.5 h-3.5" }) })] }), _jsx("div", { className: "ml-auto", children: _jsxs(Button, { variant: loopEnabled ? 'default' : 'ghost', size: "sm", onClick: () => setLoopEnabled(prev => !prev), className: `h-7 px-2 text-xs ${loopEnabled ? 'bg-[#a3e635] text-black' : ''}`, children: ["Loop ", loopEnabled && '✓'] }) })] }), _jsxs("div", { className: "flex flex-1 min-h-0", children: [showMixerPanel && (_jsxs("div", { className: "w-64 flex-shrink-0 border-r overflow-y-auto", style: {
                            background: '#0a0a0a',
                            borderColor: 'var(--dj-border)',
                        }, children: [_jsxs("div", { className: "flex items-center justify-between px-2 py-1.5 border-b border-[var(--dj-border)] sticky top-0 z-10 bg-[var(--dj-surface)] ", children: [_jsxs("span", { className: "text-xs font-semibold text-[#555] flex items-center gap-1", children: [_jsx(Layers, { className: "w-3 h-3" }), "TRACKS"] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowMixerPanel(false), className: "h-5 w-5 p-0", children: _jsx(ChevronDown, { className: "w-3 h-3" }) })] }), tracks.map(track => (_jsxs("div", { className: `border-b border-[var(--dj-border)]/30 ${track.collapsed ? 'h-6' : ''} transition-all`, style: { borderLeftWidth: 3, borderLeftColor: track.color }, children: [_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-[var(--dj-surface)] hover:bg-[var(--dj-surface2)] transition-colors", children: [_jsx("button", { onClick: () => updateTrack(track.id, { collapsed: !track.collapsed }), className: "text-[#555] hover:text-[#a3e635]", children: track.collapsed ? _jsx(ChevronRight, { className: "w-3 h-3" }) : _jsx(ChevronDown, { className: "w-3 h-3" }) }), _jsx("input", { type: "text", value: track.name, onChange: e => updateTrack(track.id, { name: e.target.value }), className: "flex-1 bg-transparent text-xs font-semibold text-foreground/80 border-none outline-none", onClick: e => e.stopPropagation() }), _jsxs("div", { className: "flex items-center gap-0.5", children: [_jsx("button", { onClick: e => { e.stopPropagation(); duplicateTrack(track.id); }, className: "text-[#555] hover:text-[#a3e635] p-0.5", children: _jsx(Copy, { className: "w-2.5 h-2.5" }) }), _jsx("button", { onClick: e => { e.stopPropagation(); removeTrack(track.id); }, className: "text-[#555] hover:text-red-400 p-0.5", children: _jsx(Trash2, { className: "w-2.5 h-2.5" }) })] })] }), !track.collapsed && (_jsxs("div", { className: "px-2 py-1.5 space-y-1.5", children: [_jsxs("div", { className: "flex items-center gap-1 text-[10px]", children: [_jsx("button", { onClick: e => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }); }, className: `w-4 h-4 rounded-none flex items-center justify-center font-bold transition-colors ${track.armed ? 'bg-[var(--signal-clip)] text-foreground' : 'bg-[var(--t-b2x)] text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`, children: "R" }), _jsx("button", { onClick: e => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }, className: `w-4 h-4 rounded-none flex items-center justify-center font-bold transition-colors ${track.muted ? 'bg-[var(--dj-border)] text-[var(--text-dim)]' : 'bg-[var(--t-b2x)] text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`, children: "M" }), _jsx("button", { onClick: e => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }, className: `w-4 h-4 rounded-none flex items-center justify-center font-bold transition-colors ${track.solo ? 'bg-[#a3e635] text-black' : 'bg-[var(--t-b2x)] text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`, children: "S" }), _jsx("button", { onClick: e => { e.stopPropagation(); updateTrack(track.id, { locked: !track.locked }); }, className: "text-[#555] hover:text-[#a3e635] p-0.5", children: track.locked ? _jsx(Lock, { className: "w-2.5 h-2.5" }) : _jsx(Unlock, { className: "w-2.5 h-2.5" }) }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.01", value: track.volume, onChange: e => { e.stopPropagation(); updateTrack(track.id, { volume: parseFloat(e.target.value) }); }, className: "flex-1 h-1 bg-[var(--t-b2x)] appearance-none cursor-pointer ml-1", onClick: e => e.stopPropagation() }), _jsx("span", { className: "text-[8px] text-[#555] w-5 text-right font-mono", children: toDB(track.volume) })] }), track.fxChain.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-0.5 px-2 pb-1.5", children: track.fxChain.map((fx, i) => (_jsx("span", { className: "text-[7px] px-1 py-0 rounded bg-[var(--dj-surface2)] text-[#555]", children: fx }, i))) }))] }))] }, track.id))), _jsx("button", { onClick: addTrack, className: "w-full py-2 text-[10px] text-[#555] hover:text-[#a3e635] hover:bg-[var(--dj-surface2)] transition-colors", children: "+ Add Track" })] })), _jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [_jsxs("div", { className: "h-5 bg-[var(--dj-surface)] border-b border-[var(--dj-border)] relative flex-shrink-0", children: [_jsx("canvas", { className: "w-full h-full" }), markers.map(m => (_jsx("div", { className: "absolute top-0 h-full", style: { left: `${m.position}%` }, children: _jsx("div", { className: "w-1 h-full", style: { backgroundColor: m.color + '40' } }) }, m.id)))] }), _jsx("canvas", { ref: canvasRef, className: `w-full flex-1 ${activeTool === 'select' ? 'cursor-crosshair' :
                                    activeTool === 'razor' ? 'cursor-col-resize' :
                                        activeTool === 'draw' ? 'cursor-cell' :
                                            'cursor-pointer'} hover:ring-1 hover:ring-[#a3e635]/40 transition-shadow`, style: { height: CANVAS_HEIGHT }, onMouseDown: handleCanvasMouseDown, onMouseMove: handleCanvasMouseMove, onMouseUp: handleCanvasMouseUp, onMouseLeave: handleCanvasMouseUp }), showMiniMap && (_jsx("canvas", { ref: miniMapRef, className: "w-full border-t border-[var(--dj-border)] flex-shrink-0", style: { height: 24 } })), showSpectrum && (_jsx("canvas", { ref: spectrumRef, className: "w-full border-t border-[var(--dj-border)] flex-shrink-0", style: { height: 48 } }))] }), _jsxs("div", { className: "w-16 flex-shrink-0 bg-[var(--dj-surface)] border-l border-[var(--dj-border)] flex flex-col items-center py-2 gap-1", children: [_jsx("span", { className: "text-[8px] text-[#555] font-mono uppercase tracking-widest", children: "MASTER" }), _jsxs("div", { className: "flex gap-1", children: [_jsx(LevelMeter, { value: rmsLevel, peak: peakLevel, width: 6, height: 100 }), _jsx(LevelMeter, { value: rmsLevel * 0.95, peak: peakLevel * 0.97, width: 6, height: 100 })] }), _jsxs("div", { className: "text-center mt-1", children: [_jsxs("div", { className: `text-[10px] font-mono font-bold ${peakLevel > 0.9 ? 'text-[var(--signal-clip)]' : 'text-[#a3e635]'}`, children: [toDB(peakLevel), " dB"] }), _jsxs("div", { className: "text-[8px] text-[#555] font-mono", children: ["RMS ", toDB(rmsLevel)] }), _jsxs("div", { className: "text-[8px] text-[#555] font-mono", children: ["LUFS ", lufsLevel.toFixed(1)] })] })] })] }), _jsxs("div", { className: "flex items-center gap-2 px-3 py-2 border-t", style: { background: 'var(--dj-surface)', borderColor: 'var(--dj-border)' }, children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setPosition(0), className: "h-7 w-7 p-0 text-[#555] hover:text-[#a3e635]", children: _jsx(SkipBack, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: transport.isPlaying ? 'default' : 'ghost', size: "sm", onClick: togglePlay, className: `h-7 w-7 p-0 ${transport.isPlaying ? 'bg-[#a3e635] hover:bg-[#a3e635]' : 'text-[#555] hover:text-[#a3e635]'}`, children: transport.isPlaying ? _jsx(Pause, { className: "w-3.5 h-3.5" }) : _jsx(Play, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: transport.isRecording ? 'destructive' : 'ghost', size: "sm", onClick: toggleRecord, disabled: !armedTrack?.armed, className: "h-7 w-7 p-0", children: _jsx("span", { className: `w-3 h-3 inline-block ${transport.isRecording ? 'bg-red-400 animate-pulse' : 'bg-[var(--dj-dimmer)]'}` }) }), _jsx(Button, { variant: "ghost", size: "sm", className: "h-7 w-7 p-0 text-[#555] hover:text-[#a3e635]", children: _jsx(SkipForward, { className: "w-3.5 h-3.5" }) })] }), _jsx("div", { className: "w-px h-5 bg-[var(--dj-border)]" }), _jsxs("div", { className: "bg-background px-2 py-0.5 font-mono flex items-baseline gap-1", children: [_jsxs("span", { className: "text-[#a3e635] text-sm font-bold tabular-nums", children: [Math.floor(transport.position / 60).toString().padStart(2, '0'), ":", Math.floor(transport.position % 60).toString().padStart(2, '0'), ".", Math.floor((transport.position % 1) * 100).toString().padStart(2, '0')] }), _jsxs("span", { className: "text-[var(--dj-dim)] text-[9px]", children: ["/ ", Math.floor((transport.duration || 0) / 60), ":", Math.floor((transport.duration || 0) % 60).toString().padStart(2, '0')] })] }), _jsx("div", { className: "w-px h-5 bg-[var(--dj-border)]" }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Gauge, { className: "w-3 h-3 text-[#555]" }), _jsx("input", { type: "number", min: "40", max: "300", value: transport.bpm, onChange: e => setBpm(parseInt(e.target.value) || 120), className: "w-12 bg-background/40 border border-[var(--dj-border)] text-[11px] text-center text-foreground/80 font-mono px-1 py-0.5" }), _jsx("span", { className: "text-[9px] text-[#555]", children: "BPM" })] }), _jsx("div", { className: "w-px h-5 bg-[var(--dj-border)]" }), loopEnabled && (_jsxs("div", { className: "flex items-center gap-1 text-[10px] font-mono", style: { color: '#a3e635' }, children: [_jsx("span", { children: "\u21BB" }), _jsxs("span", { children: [loopStart.toFixed(0), "%"] }), _jsx(ArrowLeftRight, { className: "w-3 h-3" }), _jsxs("span", { children: [loopEnd.toFixed(0), "%"] })] })), selection.active && selection.start !== selection.end && (_jsxs("div", { className: "text-[10px] text-[#a3e635] font-mono", children: ["Sel: ", selection.start.toFixed(1), "% \u2192 ", selection.end.toFixed(1), "% (", (selection.end - selection.start).toFixed(1), "%)"] })), _jsxs("div", { className: "ml-auto flex items-center gap-2 text-[9px] text-[var(--dj-dim)]", children: [_jsx("span", { children: "Space: Play" }), _jsx("span", { children: "R: Record" }), _jsx("span", { children: "L: Loop" }), _jsx("span", { children: "M: Marker" }), _jsx("span", { children: "Ctrl+Z/Y: Undo" })] })] }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--dj-border)]" })] }));
}
export default WaveformEditor;
