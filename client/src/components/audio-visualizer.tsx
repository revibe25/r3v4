// @ts-nocheck
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type VisualizationMode = 'bars' | 'wave' | 'circular' | 'particles' | 'oscilloscope' | 'spectrogram' | 'terrain' | 'galaxy' | 'dna' | 'flame' | 'matrix' | 'aurora';

interface AudioVisualizerProps {
  getAnalyserData?: () => Uint8Array | null;
  isInitialized?: boolean;
  isActive?: boolean;
  width?: number;
  height?: number;
  className?: string;
  showControls?: boolean;
  onVisualizationModeChange?: (mode: VisualizationMode) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MODES = [
  { id: "bars", label: "Bars", icon: "▮▮▮" },
  { id: "wave", label: "Wave", icon: "〰" },
  { id: "circular", label: "Radial", icon: "◎" },
  { id: "particles", label: "Particles", icon: "✦" },
  { id: "oscilloscope", label: "Scope", icon: "⏦" },
  { id: "spectrogram", label: "Spectro", icon: "▦" },
  { id: "terrain", label: "Terrain", icon: "⛰" },
  { id: "galaxy", label: "Galaxy", icon: "✧" },
  { id: "dna", label: "DNA", icon: "⧖" },
  { id: "flame", label: "Flame", icon: "🔥" },
  { id: "matrix", label: "Matrix", icon: "⟦⟧" },
  { id: "aurora", label: "Aurora", icon: "☁" },
];

const THEMES = {
  cyber: {
    name: "Cyber",
    bg: "#0a0a1a",
    primary: "#00f0ff",
    secondary: "#ff00aa",
    accent: "#7b2dff",
    surface: "rgba(0, 240, 255, 0.06)",
  },
  sunset: {
    name: "Sunset",
    bg: "#1a0a0a",
    primary: "#ff6b35",
    secondary: "#ff2d7b",
    accent: "#ffd23f",
    surface: "rgba(255, 107, 53, 0.06)",
  },
  forest: {
    name: "Forest",
    bg: "#0a1a0a",
    primary: "#00ff88",
    secondary: "#00aa55",
    accent: "#88ff00",
    surface: "rgba(0, 255, 136, 0.06)",
  },
  ocean: {
    name: "Ocean",
    bg: "#050a1a",
    primary: "#0088ff",
    secondary: "#00ccff",
    accent: "#4400ff",
    surface: "rgba(0, 136, 255, 0.06)",
  },
  vapor: {
    name: "Vapor",
    bg: "#1a0520",
    primary: "#ff71ce",
    secondary: "#01cdfe",
    accent: "#b967ff",
    surface: "rgba(255, 113, 206, 0.06)",
  },
  mono: {
    name: "Mono",
    bg: "#0a0a0a",
    primary: "#ffffff",
    secondary: "#888888",
    accent: "#cccccc",
    surface: "rgba(255, 255, 255, 0.04)",
  },
};

const FFT_SIZE = 2048;
const SMOOTHING = 0.82;

// ─── Particle System ─────────────────────────────────────────────────────────
class Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; decay: number;
  constructor(w: number, h: number) {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.size = 1; this.life = 1; this.decay = 0.01;
    this.reset(w, h);
  }
  reset(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.size = Math.random() * 3 + 1;
    this.life = 1;
    this.decay = Math.random() * 0.02 + 0.005;
  }
  update(w: number, h: number, intensity: number) {
    this.x += this.vx * (1 + intensity * 3);
    this.y += this.vy * (1 + intensity * 3);
    this.life -= this.decay;
    if (this.life <= 0 || this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
      this.reset(w, h);
    }
  }
}

// ─── Matrix Rain Characters ─────────────────────────────────────────────────
class MatrixDrop {
  x: number; y: number; speed: number; chars: string[];
  h: number; length: number;
  constructor(x: number, h: number) {
    this.x = x;
    this.y = Math.random() * -100;
    this.speed = Math.random() * 4 + 2;
    this.chars = [];
    this.h = h;
    this.length = Math.floor(Math.random() * 15) + 5;
    const charset = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    for (let i = 0; i < this.length; i++) {
      this.chars.push(charset[Math.floor(Math.random() * charset.length)]);
    }
  }
  update(intensity: number) {
    this.y += this.speed * (1 + intensity * 2);
    if (this.y > this.h + this.length * 14) {
      this.y = Math.random() * -100;
    }
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
// Named export to match: import { AudioVisualizer } from './audio-visualizer'
export function AudioVisualizer({
  getAnalyserData: externalGetAnalyserData,
  isInitialized: externalIsInitialized,
  isActive = true,
  width: propWidth,
  height: propHeight,
  className = '',
  showControls = true,
  onVisualizationModeChange,
}: AudioVisualizerProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const matrixRef = useRef<MatrixDrop[]>([]);
  const spectroRef = useRef<number[][]>([]);
  const terrainRef = useRef<number[][]>([]);
  const prevDataRef = useRef<Uint8Array | null>(null);
  const timeRef = useRef<number>(0);
  const galaxyStarsRef = useRef<any[]>([]);

  const [mode, setMode] = useState<string>("bars");
  const [theme, setTheme] = useState<string>("cyber");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [peak, setPeak] = useState(0);
  const [sensitivity, setSensitivity] = useState(1.5);
  const [showUI, setShowUI] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  const colors = THEMES[theme as keyof typeof THEMES];

  // ── Audio Setup ──────────────────────────────────────────────────────────
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setIsListening(true);
      setError(null);
    } catch (e) {
      setError("Microphone access denied. Click to retry.");
      console.error(e);
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.mediaStream.getTracks().forEach((t) => t.stop());
      sourceRef.current.disconnect();
    }
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setIsListening(false);
  }, []);

  // ── Get frequency data ───────────────────────────────────────────────────
  const getData = useCallback(() => {
    // Prefer external analyser data from parent component
    if (externalGetAnalyserData) {
      const extData = externalGetAnalyserData();
      if (extData) return extData;
    }
    if (!analyserRef.current) return null;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, [externalGetAnalyserData]);

  const getWaveData = useCallback(() => {
    if (!analyserRef.current) return null;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(data);
    return data;
  }, []);

  // Track external initialization
  const isEffectivelyListening = isListening || (externalIsInitialized && isActive);

  // ── Initialize particles / matrix / galaxy ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    particlesRef.current = Array.from({ length: 300 }, () => new Particle(w, h));
    matrixRef.current = Array.from(
      { length: Math.floor(w / 14) },
      (_, i) => new MatrixDrop(i * 14, h)
    );
    galaxyStarsRef.current = Array.from({ length: 500 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: Math.random() * Math.min(w, h) * 0.45,
      speed: (Math.random() * 0.005 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      size: Math.random() * 2 + 0.5,
      brightness: Math.random(),
    }));
  }, []);

  // ── Visualization Renderers ─────────────────────────────────────────────

  const drawBars = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const count = 64;
      const gap = 2;
      const barW = (w - gap * count) / count;
      for (let i = 0; i < count; i++) {
        const idx = Math.floor((i / count) * data.length);
        const val = (data[idx] / 255) * sensitivity;
        const barH = val * h * 0.9;
        const x = i * (barW + gap);
        const ratio = i / count;

        // Gradient bar
        const grad = ctx.createLinearGradient(x, h, x, h - barH);
        grad.addColorStop(0, colors.primary);
        grad.addColorStop(0.5, colors.secondary);
        grad.addColorStop(1, colors.accent);
        ctx.fillStyle = grad;

        // Rounded top
        const radius = Math.min(barW / 2, 4);
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, h - barH + radius);
        ctx.quadraticCurveTo(x, h - barH, x + radius, h - barH);
        ctx.lineTo(x + barW - radius, h - barH);
        ctx.quadraticCurveTo(x + barW, h - barH, x + barW, h - barH + radius);
        ctx.lineTo(x + barW, h);
        ctx.fill();

        // Glow on loud bars
        if (val > 0.7) {
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = colors.primary;
          ctx.fillStyle = colors.primary + "40";
          ctx.fillRect(x - 2, h - barH - 5, barW + 4, barH + 5);
          ctx.restore();
        }

        // Reflection
        ctx.fillStyle = colors.primary + "08";
        ctx.fillRect(x, h, barW, Math.min(barH * 0.3, 30));
      }
    },
    [colors, sensitivity]
  );

  const drawWave = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const waveData = getWaveData() || data;
      const cy = h / 2;

      for (let layer = 2; layer >= 0; layer--) {
        const alpha = (3 - layer) * 0.3;
        const yOff = layer * 8;
        ctx.beginPath();
        ctx.moveTo(0, cy);

        for (let i = 0; i < waveData.length; i += 2) {
          const x = (i / waveData.length) * w;
          const val = ((waveData[i] / 128.0 - 1) * sensitivity * h) / 2.5;
          ctx.lineTo(x, cy + val + yOff);
        }

        ctx.strokeStyle =
          layer === 0
            ? colors.primary + Math.round(alpha * 255).toString(16).padStart(2, "0")
            : colors.secondary + Math.round(alpha * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = 3 - layer;
        ctx.stroke();

        // Fill under curve
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = (layer === 0 ? colors.primary : colors.secondary) + "08";
        ctx.fill();
      }
    },
    [colors, sensitivity, getWaveData]
  );

  const drawCircular = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.22;
      const bars = 128;
      const t = timeRef.current * 0.001;

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = colors.primary + "30";
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * data.length);
        const val = (data[idx] / 255) * sensitivity;
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2 + t * 0.2;
        const len = val * baseR * 0.9;
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + len);
        const y2 = cy + Math.sin(angle) * (baseR + len);

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, colors.primary + "80");
        grad.addColorStop(1, colors.secondary);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1, (Math.PI * 2 * baseR) / bars - 1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Inner mirror (shorter)
        if (val > 0.2) {
          const x3 = cx + Math.cos(angle) * (baseR - len * 0.3);
          const y3 = cy + Math.sin(angle) * (baseR - len * 0.3);
          ctx.strokeStyle = colors.accent + "40";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x3, y3);
          ctx.stroke();
        }
      }

      // Center pulse
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const pulseR = baseR * 0.5 + avg * sensitivity * 20;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      grad.addColorStop(0, colors.accent + "40");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fill();
    },
    [colors, sensitivity]
  );

  const drawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const particles = particlesRef.current;

      for (const p of particles) {
        p.update(w, h, avg * sensitivity);
        const alpha = p.life;
        const size = p.size * (1 + avg * sensitivity * 2);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle =
          p.life > 0.5
            ? colors.primary + Math.round(alpha * 200).toString(16).padStart(2, "0")
            : colors.secondary + Math.round(alpha * 200).toString(16).padStart(2, "0");
        ctx.fill();

        if (avg > 0.4) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = colors.primary;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Connection lines between nearby particles
      for (let i = 0; i < particles.length; i += 3) {
        for (let j = i + 1; j < particles.length; j += 3) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.strokeStyle = colors.primary + Math.round((1 - dist / 80) * 40).toString(16).padStart(2, "0");
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    },
    [colors, sensitivity]
  );

  const drawOscilloscope = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const waveData = getWaveData() || data;
      const cy = h / 2;

      // Grid
      ctx.strokeStyle = colors.primary + "10";
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const y = (i / 10) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let i = 0; i < 20; i++) {
        const x = (i / 20) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = colors.primary + "30";
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();

      // Phosphor glow (multiple passes)
      for (let pass = 2; pass >= 0; pass--) {
        ctx.beginPath();
        for (let i = 0; i < waveData.length; i++) {
          const x = (i / waveData.length) * w;
          const val = ((waveData[i] / 128.0 - 1) * sensitivity * h) / 2.5;
          if (i === 0) ctx.moveTo(x, cy + val);
          else ctx.lineTo(x, cy + val);
        }
        ctx.strokeStyle = pass === 0 ? colors.primary : colors.primary + (pass === 1 ? "60" : "20");
        ctx.lineWidth = pass === 0 ? 2 : pass === 1 ? 4 : 8;
        ctx.stroke();
      }
    },
    [colors, sensitivity, getWaveData]
  );

  const drawSpectrogram = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const col = [];
      for (let i = 0; i < data.length; i++) {
        col.push(data[i] / 255);
      }
      spectroRef.current.push(col);
      const maxCols = Math.floor(w / 2);
      while (spectroRef.current.length > maxCols) spectroRef.current.shift();

      const colW = w / maxCols;
      const rowH = h / col.length;

      for (let x = 0; x < spectroRef.current.length; x++) {
        const column = spectroRef.current[x];
        for (let y = 0; y < column.length; y++) {
          const val = column[y] * sensitivity;
          if (val < 0.05) continue;
          const hue = 240 - val * 240;
          ctx.fillStyle = `hsla(${hue}, 100%, ${val * 55}%, ${val})`;
          ctx.fillRect(x * colW, h - y * rowH - rowH, colW + 0.5, rowH + 0.5);
        }
      }
    },
    [sensitivity]
  );

  const drawTerrain = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const slices = 24;
      const points = 80;

      for (let s = slices - 1; s >= 0; s--) {
        const yBase = h * 0.3 + (s / slices) * h * 0.65;
        const alpha = 1 - s / slices;

        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let i = 0; i <= points; i++) {
          const x = (i / points) * w;
          const idx = Math.floor((i / points) * data.length);
          const val = (data[idx] / 255) * sensitivity;
          const y = yBase - val * h * 0.35 * alpha;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, yBase - h * 0.35, 0, yBase);
        grad.addColorStop(0, colors.primary + Math.round(alpha * 180).toString(16).padStart(2, "0"));
        grad.addColorStop(1, colors.bg + "80");
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = colors.primary + Math.round(alpha * 100).toString(16).padStart(2, "0");
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },
    [colors, sensitivity]
  );

  const drawGalaxy = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const stars = galaxyStarsRef.current;
      const t = timeRef.current * 0.001;

      // Nebula core
      const coreR = Math.min(w, h) * 0.15;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR + avg * sensitivity * 40);
      coreGrad.addColorStop(0, colors.accent + "60");
      coreGrad.addColorStop(0.5, colors.primary + "20");
      coreGrad.addColorStop(1, "transparent");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR + avg * sensitivity * 40, 0, Math.PI * 2);
      ctx.fill();

      for (const star of stars) {
        star.angle += star.speed * (1 + avg * sensitivity);
        const r = star.radius + Math.sin(t + star.angle * 3) * 5;
        const x = cx + Math.cos(star.angle) * r;
        const y = cy + Math.sin(star.angle) * r * 0.6; // Elliptical

        const freqIdx = Math.floor((Math.abs(star.angle) / (Math.PI * 2)) * data.length) % data.length;
        const freqVal = data[freqIdx] / 255;
        const size = star.size * (1 + freqVal * sensitivity);
        const bright = star.brightness * (0.5 + freqVal * 0.5);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle =
          freqVal > 0.6
            ? colors.secondary + Math.round(bright * 255).toString(16).padStart(2, "0")
            : colors.primary + Math.round(bright * 200).toString(16).padStart(2, "0");
        ctx.fill();

        if (freqVal > 0.75) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = colors.primary;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    },
    [colors, sensitivity]
  );

  const drawDNA = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const t = timeRef.current * 0.002;
      const strands = 50;
      const cy = h / 2;
      const amp = h * 0.3;

      for (let i = 0; i < strands; i++) {
        const x = (i / strands) * w;
        const idx = Math.floor((i / strands) * data.length);
        const val = (data[idx] / 255) * sensitivity;
        const phase = (i / strands) * Math.PI * 4 + t;

        const y1 = cy + Math.sin(phase) * amp * val;
        const y2 = cy - Math.sin(phase) * amp * val;

        // Connecting rungs
        if (i % 3 === 0) {
          ctx.strokeStyle = colors.accent + "40";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }

        // Top strand
        ctx.beginPath();
        ctx.arc(x, y1, 3 + val * 4, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary + Math.round((0.5 + val * 0.5) * 255).toString(16).padStart(2, "0");
        ctx.fill();

        // Bottom strand
        ctx.beginPath();
        ctx.arc(x, y2, 3 + val * 4, 0, Math.PI * 2);
        ctx.fillStyle = colors.secondary + Math.round((0.5 + val * 0.5) * 255).toString(16).padStart(2, "0");
        ctx.fill();
      }
    },
    [colors, sensitivity]
  );

  const drawFlame = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const cols = 64;
      const colW = w / cols;

      for (let i = 0; i < cols; i++) {
        const idx = Math.floor((i / cols) * data.length);
        const val = (data[idx] / 255) * sensitivity;
        const flameH = val * h * 0.85;
        const x = i * colW;

        for (let y = 0; y < flameH; y += 3) {
          const ratio = y / flameH;
          const wobble = Math.sin(timeRef.current * 0.005 + i * 0.3 + y * 0.05) * (5 + val * 10);
          const hue = 60 - ratio * 60; // Yellow → Red
          const light = 60 - ratio * 30;
          const alpha = (1 - ratio) * val;
          const size = colW * (1 - ratio * 0.5) + wobble * 0.3;

          ctx.fillStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`;
          ctx.fillRect(x + wobble, h - y - 3, size, 4);
        }

        // Embers
        if (val > 0.5 && Math.random() > 0.7) {
          const ex = x + Math.random() * colW;
          const ey = h - flameH - Math.random() * 20;
          ctx.beginPath();
          ctx.arc(ex, ey, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(40, 100%, 70%, ${Math.random()})`;
          ctx.fill();
        }
      }
    },
    [sensitivity]
  );

  const drawMatrix = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const drops = matrixRef.current;

      ctx.font = "14px monospace";
      for (const drop of drops) {
        drop.update(avg * sensitivity);
        for (let i = 0; i < drop.length; i++) {
          const y = drop.y - i * 14;
          if (y < 0 || y > h) continue;
          const alpha = i === 0 ? 1 : Math.max(0, 1 - i / drop.length);
          ctx.fillStyle =
            i === 0
              ? "#ffffff"
              : colors.primary + Math.round(alpha * 200).toString(16).padStart(2, "0");
          ctx.fillText(drop.chars[i], drop.x, y);
        }
      }

      // Audio-reactive brightness overlay
      if (avg > 0.3) {
        ctx.fillStyle = colors.primary + "05";
        ctx.fillRect(0, 0, w, h);
      }
    },
    [colors, sensitivity]
  );

  const drawAurora = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const t = timeRef.current * 0.001;
      const layers = 5;

      for (let l = 0; l < layers; l++) {
        const yBase = h * 0.2 + l * h * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let x = 0; x <= w; x += 4) {
          const idx = Math.floor((x / w) * data.length);
          const val = (data[idx] / 255) * sensitivity;
          const wave1 = Math.sin(x * 0.005 + t + l) * 40 * val;
          const wave2 = Math.sin(x * 0.01 + t * 1.5 + l * 2) * 20 * val;
          const y = yBase + wave1 + wave2;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, yBase - 60, 0, h);
        const hue1 = 120 + l * 30 + Math.sin(t) * 20;
        const hue2 = 180 + l * 20;
        grad.addColorStop(0, `hsla(${hue1}, 80%, 60%, ${0.15 - l * 0.02})`);
        grad.addColorStop(0.5, `hsla(${hue2}, 70%, 40%, ${0.1 - l * 0.015})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Stars
      for (let i = 0; i < 50; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 73.7) % (h * 0.5));
        const twinkle = Math.sin(t * 3 + i) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, twinkle * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.8})`;
        ctx.fill();
      }
    },
    [colors, sensitivity]
  );

  // ── Main Render Loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const renderers: Record<string, (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => void> = {
      bars: drawBars,
      wave: drawWave,
      circular: drawCircular,
      particles: drawParticles,
      oscilloscope: drawOscilloscope,
      spectrogram: drawSpectrogram,
      terrain: drawTerrain,
      galaxy: drawGalaxy,
      dna: drawDNA,
      flame: drawFlame,
      matrix: drawMatrix,
      aurora: drawAurora,
    };

    const animate = (timestamp) => {
      timeRef.current = timestamp;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // FPS
      fpsRef.current.frames++;
      if (timestamp - fpsRef.current.lastTime >= 1000) {
        setFps(fpsRef.current.frames);
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = timestamp;
      }

      // Clear with theme background
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle grid overlay
      ctx.strokeStyle = colors.primary + "06";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const data = getData();
      if (data) {
        // Volume meter
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        const maxVal = Math.max(...data) / 255;
        setVolume(avg);
        setPeak(maxVal);

        // Smooth data
        if (prevDataRef.current) {
          for (let i = 0; i < data.length; i++) {
            data[i] = prevDataRef.current[i] * 0.3 + data[i] * 0.7;
          }
        }
        prevDataRef.current = new Uint8Array(data);

        const renderer = renderers[mode];
        if (renderer) renderer(ctx, data, w, h);
      } else {
        // Idle animation
        ctx.fillStyle = colors.primary + "15";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          isEffectivelyListening ? "Waiting for audio..." : "Click Start to begin",
          w / 2,
          h / 2
        );

        // Idle pulse
        const pulse = Math.sin(timestamp * 0.003) * 0.5 + 0.5;
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 100);
        grad.addColorStop(0, colors.primary + Math.round(pulse * 20).toString(16).padStart(2, "0"));
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 100, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vignette
      const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, colors.bg + "80");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [
    mode, colors, isEffectivelyListening, getData, getWaveData, sensitivity,
    drawBars, drawWave, drawCircular, drawParticles, drawOscilloscope,
    drawSpectrogram, drawTerrain, drawGalaxy, drawDNA, drawFlame,
    drawMatrix, drawAurora,
  ]);

  // Cleanup audio on unmount
  useEffect(() => () => stopAudio(), [stopAudio]);

  // ── UI ──────────────────────────────────────────────────────────────────
  const volumePercent = Math.round(volume * 100);
  const peakPercent = Math.round(peak * 100);

  const isEmbedded = propWidth != null || propHeight != null || externalGetAnalyserData != null;
  const hasOwnAudio = !externalGetAnalyserData;

  // ── ACID TECHNO DESIGN TOKENS ──────────────────────────────────────────────
  const ACID = "#b8ff00";
  const ACID_DIM = "#b8ff0033";
  const ACID_BORDER = "#b8ff0066";
  const BLACK = "#000000";
  const SURFACE = "#0c0c0c";
  const SURFACE2 = "#111111";
  const BORDER = "#222222";

  return (
    <div
      className={className}
      style={{
        width: isEmbedded ? (propWidth || "100%") : "100%",
        height: collapsed ? "auto" : (isEmbedded ? (propHeight || 400) : "100vh"),
        background: BLACK,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        color: ACID,
        overflow: "hidden",
        position: "relative",
        borderRadius: 0,
        border: isEmbedded ? `1px solid ${BORDER}` : "none",
        boxShadow: "none",
        transition: "height 0.3s ease",
      }}
    >
      {/* ── Header bar — always visible ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 12px",
          background: SURFACE,
          borderBottom: collapsed ? "none" : `1px solid ${BORDER}`,
          zIndex: 10,
          flexShrink: 0,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setCollapsed(prev => !prev)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Collapse chevron */}
          <div
            style={{
              width: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              color: "#444",
              transition: "transform 0.15s",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </div>
          {/* Acid square icon */}
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: ACID,
              fontSize: 11,
              color: BLACK,
              fontWeight: 900,
            }}
          >
            ◆
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, lineHeight: 1, color: "#ffffff", textTransform: "uppercase" }}>
              VISUALIZER
            </span>
            <div style={{ fontSize: 8, color: "#444", marginTop: 2, letterSpacing: 1 }}>
              {collapsed ? `${MODES.find(m => m.id === mode)?.label.toUpperCase()} · ${isEffectivelyListening ? "ACTIVE" : "IDLE"}` : `${fps} FPS · ${MODES.find(m => m.id === mode)?.label.toUpperCase()}`}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {/* Volume meter - segmented bars */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: "#444", letterSpacing: 1 }}>VOL</span>
            <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
              {Array.from({ length: 16 }).map((_, i) => {
                const threshold = (i / 16) * 100;
                const active = threshold <= volumePercent;
                return (
                  <div
                    key={i}
                    style={{
                      width: collapsed ? 2 : 3,
                      height: 10,
                      background: active ? (i > 12 ? "#ff2200" : i > 9 ? "#ffaa00" : ACID) : SURFACE2,
                      border: `1px solid ${active ? "transparent" : BORDER}`,
                    }}
                  />
                );
              })}
            </div>
            {!collapsed && (
              <span style={{ fontSize: 8, color: "#444", width: 26 }}>{volumePercent}%</span>
            )}
          </div>

          {/* Peak */}
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 8, color: "#444", letterSpacing: 1 }}>PK</span>
              <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const threshold = (i / 8) * 100;
                  const active = threshold <= peakPercent;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: 10,
                        background: active ? (peakPercent > 80 ? "#ff2200" : ACID) : SURFACE2,
                        border: `1px solid ${active ? "transparent" : BORDER}`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Start/Stop */}
          {hasOwnAudio && (
            <button
              onClick={isListening ? stopAudio : startAudio}
              style={{
                background: isListening ? ACID : "transparent",
                border: `1px solid ${isListening ? ACID : BORDER}`,
                color: isListening ? BLACK : ACID,
                padding: "4px 10px",
                borderRadius: 0,
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
              onMouseEnter={(e) => {
                if (!isListening) {
                  e.currentTarget.style.borderColor = ACID;
                  e.currentTarget.style.color = ACID;
                }
              }}
              onMouseLeave={(e) => {
                if (!isListening) {
                  e.currentTarget.style.borderColor = BORDER;
                }
              }}
            >
              {isListening ? "■ STOP" : "▶ START"}
            </button>
          )}

          {!collapsed && (
            <button
              onClick={() => setShowUI(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#333",
                cursor: "pointer",
                fontSize: 12,
                padding: "2px 4px",
                fontFamily: "inherit",
              }}
              title="Hide UI (press H to toggle)"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Collapsible content ── */}
      {!collapsed && (<>

      {/* ── Canvas ── */}
      <canvas
        ref={canvasRef}
        style={{
          flex: 1,
          width: "100%",
          display: "block",
          cursor: "crosshair",
        }}
        onClick={() => !showUI && setShowUI(true)}
      />

      {/* ── Bottom Controls ── */}
      {showUI && (
        <div
          style={{
            padding: "8px 12px",
            background: SURFACE,
            borderTop: `1px solid ${BORDER}`,
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          {/* Mode selector */}
          <div
            style={{
              display: "flex",
              gap: 2,
              marginBottom: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id as VisualizationMode);
                  spectroRef.current = [];
                  onVisualizationModeChange?.(m.id);
                }}
                style={{
                  background: mode === m.id ? ACID : "transparent",
                  border: `1px solid ${mode === m.id ? ACID : BORDER}`,
                  color: mode === m.id ? BLACK : "#555",
                  padding: "3px 8px",
                  borderRadius: 0,
                  fontSize: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onMouseEnter={(e) => {
                  if (mode !== m.id) {
                    e.currentTarget.style.borderColor = ACID_BORDER;
                    e.currentTarget.style.color = ACID;
                  }
                }}
                onMouseLeave={(e) => {
                  if (mode !== m.id) {
                    e.currentTarget.style.borderColor = BORDER;
                    e.currentTarget.style.color = "#555";
                  }
                }}
              >
                <span style={{ fontSize: 10 }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Theme + Sensitivity */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Theme square swatches */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 8, color: "#444", letterSpacing: 1, marginRight: 2 }}>THEME</span>
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    background: t.primary,
                    border: theme === key ? `2px solid ${ACID}` : `1px solid #333`,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title={t.name}
                />
              ))}
            </div>

            {/* Sensitivity slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: "#444", letterSpacing: 1 }}>GAIN</span>
              <div style={{ position: "relative", width: 80, height: 14, display: "flex", alignItems: "center" }}>
                {/* Track */}
                <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: BORDER }} />
                {/* Active track */}
                <div style={{ position: "absolute", left: 0, width: `${((sensitivity - 0.5) / 2.5) * 100}%`, height: 2, background: ACID }} />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                    margin: 0,
                  }}
                />
                {/* Square thumb indicator */}
                <div style={{
                  position: "absolute",
                  left: `calc(${((sensitivity - 0.5) / 2.5) * 100}% - 4px)`,
                  width: 8,
                  height: 12,
                  background: ACID,
                  pointerEvents: "none",
                }} />
              </div>
              <span style={{ fontSize: 8, color: "#555", width: 28 }}>
                {sensitivity.toFixed(1)}x
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: SURFACE,
            border: `1px solid #ff2200`,
            padding: "20px 30px",
            borderRadius: 0,
            textAlign: "center",
            zIndex: 20,
          }}
        >
          <p style={{ color: "#ff4400", fontSize: 12, margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>{error}</p>
          <button
            onClick={startAudio}
            style={{
              marginTop: 12,
              background: ACID,
              border: "none",
              color: BLACK,
              padding: "6px 20px",
              borderRadius: 0,
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "inherit",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* Hidden UI hint */}
      {!showUI && !collapsed && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 8,
            color: "#333",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          CLICK TO SHOW CONTROLS
        </div>
      )}
      </>)}
    </div>
  );
}