// client/src/components/visuals/VisualizerCanvas.tsx
// 11-mode canvas visualizer engine.
// NEW feature — replaces the simple AudioVisualizer with HTML spec.

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';

type VizMode =
  | 'bars' | 'wave' | 'radial' | 'particles' | 'scope'
  | 'spectro' | 'terrain' | 'galaxy' | 'dna' | 'flame' | 'matrix';

const MODES: { key: VizMode; label: string }[] = [
  { key: 'bars', label: '▦ BARS' },
  { key: 'wave', label: '∿ WAVE' },
  { key: 'radial', label: '◉ RADIAL' },
  { key: 'particles', label: '✦ PARTICLES' },
  { key: 'scope', label: '◯ SCOPE' },
  { key: 'spectro', label: '▦ SPECTRO' },
  { key: 'terrain', label: '▲ TERRAIN' },
  { key: 'galaxy', label: '✦ GALAXY' },
  { key: 'dna', label: '✕ DNA' },
  { key: 'flame', label: '🔥 FLAME' },
  { key: 'matrix', label: '▦ MATRIX' },
];

const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';

export const VisualizerCanvas = memo(function VisualizerCanvas() {
  const { getAnalyserData, isInitialized } = useAudioEngine();
  const [mode, setMode] = useState<VizMode>('matrix');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matrixRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const dprRef = useRef(1);

  // Matrix rain DOM columns
  const [matrixCols, setMatrixCols] = useState<{ chars: string[]; head: number }[]>([]);

  // Initialize matrix columns
  useEffect(() => {
    const cols = Array.from({ length: 16 }, () => ({
      chars: Array.from({ length: 7 }, () => KANA[Math.floor(Math.random() * KANA.length)]),
      head: Math.floor(Math.random() * 7),
    }));
    setMatrixCols(cols);
  }, []);

  // Resize observer for canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      dprRef.current = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dprRef.current));
      canvas.height = Math.max(1, Math.floor(rect.height * dprRef.current));
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);
      const dpr = dprRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Get audio data if available
      let audioLevel = 0.5;
      try {
        const data = getAnalyserData?.();
        if (data) {
          const sum = data.reduce((s: number, v: number) => s + Math.abs(v), 0);
          audioLevel = sum / data.length;
        }
      } catch { /* no-op */ }

      const accent = 'rgba(200,255,0,';
      const level = 0.45 + 0.28 * Math.sin(t * 0.0027) + 0.12 * Math.sin(t * 0.0061);
      const amp = Math.max(0.12, Math.min(0.95, level + audioLevel * 0.3));

      ctx.lineWidth = 1;

      if (mode === 'bars') {
        const count = 40, gap = 2, bw = (w - gap * (count - 1)) / count;
        for (let i = 0; i < count; i++) {
          const v = 0.08 + 0.72 * Math.abs(Math.sin(i * 0.37 + t * 0.003)) * amp;
          const bh = Math.max(3, v * h);
          const x = i * (bw + gap), y = h - bh;
          ctx.fillStyle = accent + (0.15 + v * 0.45) + ')';
          ctx.fillRect(x, y, bw, bh);
        }
      } else if (mode === 'wave' || mode === 'scope') {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const n = x / w;
          const y = h * 0.5 + Math.sin(n * 18 + t * 0.006) * h * 0.18 * amp + Math.sin(n * 43 - t * 0.003) * h * 0.055 * amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = accent + '.8)';
        ctx.shadowBlur = 9; ctx.shadowColor = accent + '.3)'; ctx.stroke(); ctx.shadowBlur = 0;
      } else if (mode === 'radial') {
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.18;
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          const len = r + (Math.sin(i * 0.55 + t * 0.004) + 1) * Math.min(w, h) * 0.16 * amp;
          ctx.strokeStyle = accent + (0.08 + 0.42 * (i % 7 === 0 ? 1 : 0)) + ')';
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = accent + '.35)'; ctx.stroke();
      } else if (mode === 'particles' || mode === 'galaxy') {
        const count = 90, cx = w / 2, cy = h / 2;
        for (let i = 0; i < count; i++) {
          const p = i / count, a = i * 0.75 + t * 0.00035 * (1 + p * 2), rad = p * Math.min(w, h) * 0.46;
          const x = cx + Math.cos(a) * rad * (1 + 0.08 * Math.sin(t * 0.003 + i));
          const y = cy + Math.sin(a) * rad * 0.55;
          const s = 1 + (1 - p) * 1.8;
          ctx.fillStyle = accent + (0.08 + 0.55 * (1 - p) * amp) + ')';
          ctx.fillRect(x, y, s, s);
        }
      } else if (mode === 'dna') {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const n = x / w * 2 * Math.PI * 2;
          const y1 = h * 0.5 + Math.sin(n + t * 0.003) * h * 0.30;
          const y2 = h * 0.5 + Math.sin(n + Math.PI + t * 0.003) * h * 0.30;
          if (x === 0) ctx.moveTo(x, y1); else ctx.lineTo(x, y1);
          ctx.moveTo(x, y2); ctx.lineTo(x, y2);
        }
        ctx.strokeStyle = accent + '.65)'; ctx.stroke();
        for (let i = 0; i < 18; i++) {
          const x = (i / 17) * w, n = i / 17 * Math.PI * 4;
          const y1 = h * 0.5 + Math.sin(n + t * 0.003) * h * 0.30;
          const y2 = h * 0.5 + Math.sin(n + Math.PI + t * 0.003) * h * 0.30;
          ctx.strokeStyle = accent + '.25)'; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
        }
      } else if (mode === 'terrain') {
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) {
          const n = x / w;
          const y = h * 0.72 - (Math.sin(n * 8 + t * 0.002) + 0.5 * Math.sin(n * 19 - t * 0.003)) * h * 0.18 * amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = accent + '.08)'; ctx.fill();
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const n = x / w;
          const y = h * 0.72 - (Math.sin(n * 8 + t * 0.002) + 0.5 * Math.sin(n * 19 - t * 0.003)) * h * 0.18 * amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = accent + '.65)'; ctx.stroke();
      } else if (mode === 'flame') {
        const bars = 48;
        for (let i = 0; i < bars; i++) {
          const n = i / (bars - 1);
          const v = 0.08 + 0.75 * Math.abs(Math.sin(i * 0.44 + t * 0.004)) * (0.55 + 0.45 * amp);
          const bh = v * h * 0.8;
          const x = n * w;
          const grad = ctx.createLinearGradient(0, h - bh, 0, h);
          grad.addColorStop(0, 'rgba(255,170,0,.42)');
          grad.addColorStop(0.35, 'rgba(200,255,0,.55)');
          grad.addColorStop(1, 'rgba(200,255,0,.06)');
          ctx.fillStyle = grad; ctx.fillRect(x, h - bh, Math.max(2, w / bars - 2), bh);
        }
      } else if (mode === 'spectro') {
        const cols = 72, rows = 24, cw = w / cols, rh = h / rows;
        for (let x = 0; x < cols; x++) {
          for (let y = 0; y < rows; y++) {
            const v = Math.abs(Math.sin(x * 0.29 + t * 0.002 + y * 0.21)) * (1 - y / rows) * amp;
            if (v < 0.16) continue;
            ctx.fillStyle = accent + (v * 0.42) + ')';
            ctx.fillRect(x * cw, y * rh, Math.max(1, cw - 1), Math.max(1, rh - 1));
          }
        }
      } else {
        // MATRIX mode — canvas adds subtle scan energy; DOM handles the rain
        ctx.fillStyle = 'rgba(200,255,0,.025)';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
        ctx.strokeStyle = 'rgba(200,255,0,.04)';
        for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, getAnalyserData]);

  // Matrix rain animation
  useEffect(() => {
    if (mode !== 'matrix') return;
    const interval = setInterval(() => {
      setMatrixCols((prev) =>
        prev.map((col) => {
          const head = Math.floor(Math.random() * 7);
          return {
            chars: col.chars.map((_, ri) =>
              ri === head ? KANA[Math.floor(Math.random() * KANA.length)] : col.chars[ri]
            ),
            head,
          };
        })
      );
    }, 110);
    return () => clearInterval(interval);
  }, [mode]);

  return (
    <div className="p-2" style={{ background: 'var(--r3-panel)' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--r3-accent)' }}>
            ♡ Visualizer & Transport
          </span>
        </div>
        <span className="text-[11px] text-[#555] cursor-pointer">⌄</span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-2 mb-1.5 p-1 rounded" style={{ background: 'linear-gradient(180deg, #111, #0d0d0d)', border: '1px solid #171717', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)' }}>
        <div
          className="w-[18px] h-[18px] rounded grid place-items-center text-[9px] font-extrabold"
          style={{ background: 'var(--r3-accent)', color: '#000' }}
        >
          ◆
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold text-white tracking-[0.03em]">VISUALIZER</div>
          <div className="text-[8px] text-[#666]">60 FPS · {mode.toUpperCase()}</div>
        </div>

        {/* Volume meter */}
        <div className="flex items-center gap-1">
          <span className="text-[7.5px] text-[#444] tracking-[0.08em] font-semibold">VOL</span>
          <div className="flex gap-px items-end h-[10px]">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="w-[2px] rounded-sm transition-colors"
                style={{
                  height: `${3 + i * 0.5}px`,
                  background: i < 12 ? 'var(--r3-accent)' : i >= 14 ? 'var(--r3-warn)' : 'var(--r3-border2)',
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[8.5px] font-semibold" style={{ color: 'var(--r3-accent)' }}>-6.2 dB</span>
        </div>

        {/* Peak meter */}
        <div className="flex items-center gap-1">
          <span className="text-[7.5px] text-[#444] tracking-[0.08em] font-semibold">PK</span>
          <div className="flex gap-px items-end h-[10px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="w-[2px] rounded-sm transition-colors"
                style={{
                  height: `${3 + i * 0.5}px`,
                  background: i < 8 ? 'var(--r3-accent)' : i >= 8 ? 'var(--r3-warn)' : 'var(--r3-border2)',
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[8.5px] font-semibold" style={{ color: 'var(--r3-accent)' }}>-1.2 dB</span>
        </div>

        <span className="text-[13px] text-[#333] cursor-pointer">×</span>
      </div>

      {/* Canvas / Matrix */}
      <div
        className="relative rounded overflow-hidden flex items-center justify-center"
        style={{
          height: 258,
          background: '#06070d',
          border: '1px solid #222617',
          boxShadow: 'inset 0 0 36px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.018), 0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(rgba(200,255,0,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,0,0.012) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.38) 100%), linear-gradient(90deg, rgba(200,255,0,0.035), transparent 12%, transparent 88%, rgba(200,255,0,0.035))',
          }}
        />

        {mode === 'matrix' ? (
          <div className="relative z-20 flex gap-1">
            {matrixCols.map((col, ci) => (
              <div key={ci} className="flex flex-col items-center gap-[1.5px]">
                {col.chars.map((ch, ri) => (
                  <span
                    key={ri}
                    className="font-mono text-[10px] leading-tight transition-opacity"
                    style={{
                      color: 'var(--r3-accent)',
                      opacity: ri === col.head ? 1 : Math.abs(ri - col.head) <= 2 ? 0.35 : 0.1,
                      textShadow: ri === col.head ? '0 0 6px rgba(200,255,0,0.5)' : 'none',
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" aria-hidden="true" />
        )}
      </div>

      {/* Mode controls */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className="px-2 py-1 rounded text-[8px] font-bold tracking-[0.06em] uppercase cursor-pointer transition-all flex items-center gap-1"
            style={{
              background: mode === m.key ? 'var(--r3-accent)' : 'var(--r3-elevated)',
              border: `1px solid ${mode === m.key ? 'var(--r3-accent)' : '#1c1c1c'}`,
              color: mode === m.key ? '#000' : '#666',
              boxShadow: mode === m.key ? '0 0 14px rgba(200,255,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)' : 'var(--r3-inset)',
              minHeight: 26,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
});
