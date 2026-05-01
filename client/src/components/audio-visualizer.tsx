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
const _MODES = [
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

const _THEMES = {
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
const _SMOOTHING = 0.82;

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
    const _charset = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    for (let _i = 0; i < this.length; i++) {
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
  const _canvasRef = useRef<HTMLCanvasElement>(null);
  const _animRef = useRef<number | null>(null);
  const _audioCtxRef = useRef<AudioContext | null>(null);
  const _analyserRef = useRef<AnalyserNode | null>(null);
  const _sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const _particlesRef = useRef<Particle[]>([]);
  const _matrixRef = useRef<MatrixDrop[]>([]);
  const _spectroRef = useRef<number[][]>([]);
  const _terrainRef = useRef<number[][]>([]);
  const _prevDataRef = useRef<Uint8Array | null>(null);
  const _timeRef = useRef<number>(0);
  const _galaxyStarsRef = useRef<any[]>([]);

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
  const _fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  const _colors = THEMES[theme as keyof typeof THEMES];

  // ── Audio Setup ──────────────────────────────────────────────────────────
  const _startAudio = useCallback(async () => {
    try {
      const _stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const _analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      const _source = ctx.createMediaStreamSource(stream);
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

  const _stopAudio = useCallback(() => {
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
  const _getData = useCallback(() => {
    // Prefer external analyser data from parent component
    if (externalGetAnalyserData) {
      const _extData = externalGetAnalyserData();
      if (extData) return extData;
    }
    if (!analyserRef.current) return null;
    const _bufferLength = analyserRef.current.frequencyBinCount;
    const _data = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, [externalGetAnalyserData]);

  const _getWaveData = useCallback(() => {
    if (!analyserRef.current) return null;
    const _bufferLength = analyserRef.current.frequencyBinCount;
    const _data = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(data);
    return data;
  }, []);

  // Track external initialization
  const _isEffectivelyListening = isListening || (externalIsInitialized && isActive);

  // ── Initialize particles / matrix / galaxy ────────────────────────────────
  useEffect(() => {
    const _canvas = canvasRef.current;
    if (!canvas) return;
    const _w = canvas.clientWidth;
    const _h = canvas.clientHeight;
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

  const _drawBars = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _count = 64;
      const _gap = 2;
      const _barW = (w - gap * count) / count;
      for (let _i = 0; i < count; i++) {
        const _idx = Math.floor((i / count) * data.length);
        const _val = (data[idx] / 255) * sensitivity;
        const _barH = val * h * 0.9;
        const _x = i * (barW + gap);
        const _ratio = i / count;

        // Gradient bar
        const _grad = ctx.createLinearGradient(x, h, x, h - barH);
        grad.addColorStop(0, colors.primary);
        grad.addColorStop(0.5, colors.secondary);
        grad.addColorStop(1, colors.accent);
        ctx.fillStyle = grad;

        // Rounded top
        const _radius = Math.min(barW / 2, 4);
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

  const _drawWave = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _waveData = getWaveData() || data;
      const _cy = h / 2;

      for (let _layer = 2; layer >= 0; layer--) {
        const _alpha = (3 - layer) * 0.3;
        const _yOff = layer * 8;
        ctx.beginPath();
        ctx.moveTo(0, cy);

        for (let _i = 0; i < waveData.length; i += 2) {
          const _x = (i / waveData.length) * w;
          const _val = ((waveData[i] / 128.0 - 1) * sensitivity * h) / 2.5;
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

  const _drawCircular = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _cx = w / 2;
      const _cy = h / 2;
      const _baseR = Math.min(w, h) * 0.22;
      const _bars = 128;
      const _t = timeRef.current * 0.001;

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = colors.primary + "30";
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let _i = 0; i < bars; i++) {
        const _idx = Math.floor((i / bars) * data.length);
        const _val = (data[idx] / 255) * sensitivity;
        const _angle = (i / bars) * Math.PI * 2 - Math.PI / 2 + t * 0.2;
        const _len = val * baseR * 0.9;
        const _x1 = cx + Math.cos(angle) * baseR;
        const _y1 = cy + Math.sin(angle) * baseR;
        const _x2 = cx + Math.cos(angle) * (baseR + len);
        const _y2 = cy + Math.sin(angle) * (baseR + len);

        const _grad = ctx.createLinearGradient(x1, y1, x2, y2);
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
          const _x3 = cx + Math.cos(angle) * (baseR - len * 0.3);
          const _y3 = cy + Math.sin(angle) * (baseR - len * 0.3);
          ctx.strokeStyle = colors.accent + "40";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x3, y3);
          ctx.stroke();
        }
      }

      // Center pulse
      const _avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const _pulseR = baseR * 0.5 + avg * sensitivity * 20;
      const _grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      grad.addColorStop(0, colors.accent + "40");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fill();
    },
    [colors, sensitivity]
  );

  const _drawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const _particles = particlesRef.current;

      for (const p of particles) {
        p.update(w, h, avg * sensitivity);
        const _alpha = p.life;
        const _size = p.size * (1 + avg * sensitivity * 2);

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
      for (let _i = 0; i < particles.length; i += 3) {
        for (let _j = i + 1; j < particles.length; j += 3) {
          const _dx = particles[i].x - particles[j].x;
          const _dy = particles[i].y - particles[j].y;
          const _dist = Math.sqrt(dx * dx + dy * dy);
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

  const _drawOscilloscope = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _waveData = getWaveData() || data;
      const _cy = h / 2;

      // Grid
      ctx.strokeStyle = colors.primary + "10";
      ctx.lineWidth = 1;
      for (let _i = 0; i < 10; i++) {
        const _y = (i / 10) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let _i = 0; i < 20; i++) {
        const _x = (i / 20) * w;
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
      for (let _pass = 2; pass >= 0; pass--) {
        ctx.beginPath();
        for (let _i = 0; i < waveData.length; i++) {
          const _x = (i / waveData.length) * w;
          const _val = ((waveData[i] / 128.0 - 1) * sensitivity * h) / 2.5;
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

  const _drawSpectrogram = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _col = [];
      for (let _i = 0; i < data.length; i++) {
        col.push(data[i] / 255);
      }
      spectroRef.current.push(col);
      const _maxCols = Math.floor(w / 2);
      while (spectroRef.current.length > maxCols) spectroRef.current.shift();

      const _colW = w / maxCols;
      const _rowH = h / col.length;

      for (let _x = 0; x < spectroRef.current.length; x++) {
        const _column = spectroRef.current[x];
        for (let _y = 0; y < column.length; y++) {
          const _val = column[y] * sensitivity;
          if (val < 0.05) continue;
          const _hue = 240 - val * 240;
          ctx.fillStyle = `hsla(${hue}, 100%, ${val * 55}%, ${val})`;
          ctx.fillRect(x * colW, h - y * rowH - rowH, colW + 0.5, rowH + 0.5);
        }
      }
    },
    [sensitivity]
  );

  const _drawTerrain = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _slices = 24;
      const _points = 80;

      for (let _s = slices - 1; s >= 0; s--) {
        const _yBase = h * 0.3 + (s / slices) * h * 0.65;
        const _alpha = 1 - s / slices;

        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let _i = 0; i <= points; i++) {
          const _x = (i / points) * w;
          const _idx = Math.floor((i / points) * data.length);
          const _val = (data[idx] / 255) * sensitivity;
          const _y = yBase - val * h * 0.35 * alpha;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        const _grad = ctx.createLinearGradient(0, yBase - h * 0.35, 0, yBase);
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

  const _drawGalaxy = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _cx = w / 2;
      const _cy = h / 2;
      const _avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const _stars = galaxyStarsRef.current;
      const _t = timeRef.current * 0.001;

      // Nebula core
      const _coreR = Math.min(w, h) * 0.15;
      const _coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR + avg * sensitivity * 40);
      coreGrad.addColorStop(0, colors.accent + "60");
      coreGrad.addColorStop(0.5, colors.primary + "20");
      coreGrad.addColorStop(1, "transparent");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR + avg * sensitivity * 40, 0, Math.PI * 2);
      ctx.fill();

      for (const star of stars) {
        star.angle += star.speed * (1 + avg * sensitivity);
        const _r = star.radius + Math.sin(t + star.angle * 3) * 5;
        const _x = cx + Math.cos(star.angle) * r;
        const _y = cy + Math.sin(star.angle) * r * 0.6; // Elliptical

        const _freqIdx = Math.floor((Math.abs(star.angle) / (Math.PI * 2)) * data.length) % data.length;
        const _freqVal = data[freqIdx] / 255;
        const _size = star.size * (1 + freqVal * sensitivity);
        const _bright = star.brightness * (0.5 + freqVal * 0.5);

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

  const _drawDNA = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _t = timeRef.current * 0.002;
      const _strands = 50;
      const _cy = h / 2;
      const _amp = h * 0.3;

      for (let _i = 0; i < strands; i++) {
        const _x = (i / strands) * w;
        const _idx = Math.floor((i / strands) * data.length);
        const _val = (data[idx] / 255) * sensitivity;
        const _phase = (i / strands) * Math.PI * 4 + t;

        const _y1 = cy + Math.sin(phase) * amp * val;
        const _y2 = cy - Math.sin(phase) * amp * val;

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

  const _drawFlame = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _cols = 64;
      const _colW = w / cols;

      for (let _i = 0; i < cols; i++) {
        const _idx = Math.floor((i / cols) * data.length);
        const _val = (data[idx] / 255) * sensitivity;
        const _flameH = val * h * 0.85;
        const _x = i * colW;

        for (let _y = 0; y < flameH; y += 3) {
          const _ratio = y / flameH;
          const _wobble = Math.sin(timeRef.current * 0.005 + i * 0.3 + y * 0.05) * (5 + val * 10);
          const _hue = 60 - ratio * 60; // Yellow → Red
          const _light = 60 - ratio * 30;
          const _alpha = (1 - ratio) * val;
          const _size = colW * (1 - ratio * 0.5) + wobble * 0.3;

          ctx.fillStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`;
          ctx.fillRect(x + wobble, h - y - 3, size, 4);
        }

        // Embers
        if (val > 0.5 && Math.random() > 0.7) {
          const _ex = x + Math.random() * colW;
          const _ey = h - flameH - Math.random() * 20;
          ctx.beginPath();
          ctx.arc(ex, ey, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(40, 100%, 70%, ${Math.random()})`;
          ctx.fill();
        }
      }
    },
    [sensitivity]
  );

  const _drawMatrix = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      const _drops = matrixRef.current;

      ctx.font = "14px monospace";
      for (const drop of drops) {
        drop.update(avg * sensitivity);
        for (let _i = 0; i < drop.length; i++) {
          const _y = drop.y - i * 14;
          if (y < 0 || y > h) continue;
          const _alpha = i === 0 ? 1 : Math.max(0, 1 - i / drop.length);
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

  const _drawAurora = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
      const _t = timeRef.current * 0.001;
      const _layers = 5;

      for (let _l = 0; l < layers; l++) {
        const _yBase = h * 0.2 + l * h * 0.12;
        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let _x = 0; x <= w; x += 4) {
          const _idx = Math.floor((x / w) * data.length);
          const _val = (data[idx] / 255) * sensitivity;
          const _wave1 = Math.sin(x * 0.005 + t + l) * 40 * val;
          const _wave2 = Math.sin(x * 0.01 + t * 1.5 + l * 2) * 20 * val;
          const _y = yBase + wave1 + wave2;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.closePath();

        const _grad = ctx.createLinearGradient(0, yBase - 60, 0, h);
        const _hue1 = 120 + l * 30 + Math.sin(t) * 20;
        const _hue2 = 180 + l * 20;
        grad.addColorStop(0, `hsla(${hue1}, 80%, 60%, ${0.15 - l * 0.02})`);
        grad.addColorStop(0.5, `hsla(${hue2}, 70%, 40%, ${0.1 - l * 0.015})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Stars
      for (let _i = 0; i < 50; i++) {
        const _sx = ((i * 137.5) % w);
        const _sy = ((i * 73.7) % (h * 0.5));
        const _twinkle = Math.sin(t * 3 + i) * 0.5 + 0.5;
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
    const _canvas = canvasRef.current;
    if (!canvas) return;

    const _ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const _resize = () => {
      const _rect = canvas.getBoundingClientRect();
      const _dpr = Math.min(window.devicePixelRatio, 2);
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

    const _animate = (timestamp) => {
      timeRef.current = timestamp;
      const _w = canvas.clientWidth;
      const _h = canvas.clientHeight;

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
      for (let _x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let _y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const _data = getData();
      if (data) {
        // Volume meter
        const _avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        const _maxVal = Math.max(...data) / 255;
        setVolume(avg);
        setPeak(maxVal);

        // Smooth data
        if (prevDataRef.current) {
          for (let _i = 0; i < data.length; i++) {
            data[i] = prevDataRef.current[i] * 0.3 + data[i] * 0.7;
          }
        }
        prevDataRef.current = new Uint8Array(data);

        const _renderer = renderers[mode];
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
        const _pulse = Math.sin(timestamp * 0.003) * 0.5 + 0.5;
        const _grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 100);
        grad.addColorStop(0, colors.primary + Math.round(pulse * 20).toString(16).padStart(2, "0"));
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 100, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vignette
      const _vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
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
  const _volumePercent = Math.round(volume * 100);
  const _peakPercent = Math.round(peak * 100);

  const _isEmbedded = propWidth != null || propHeight != null || externalGetAnalyserData != null;
  const _hasOwnAudio = !externalGetAnalyserData;

  // ── ACID TECHNO DESIGN TOKENS ──────────────────────────────────────────────
  const _ACID = "#a3e635";
  const ACID_DIM = "#a3e63533";
  const ACID_BORDER = "#a3e63566";
  const _BLACK = "#000000";
  const _SURFACE = "#0c0c0c";
  const _SURFACE2 = "#111111";
  const _BORDER = "#222222";

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
                const _threshold = (i / 16) * 100;
                const _active = threshold <= volumePercent;
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
                  const _threshold = (i / 8) * 100;
                  const _active = threshold <= peakPercent;
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