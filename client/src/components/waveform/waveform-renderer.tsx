import { useRef, useEffect, useCallback, useState } from "react";

const T = {
  bg: "#0a0a0a", accent: "#b8ff00", dim: "#333",
  mid: "rgba(184,255,0,0.5)", rms: "rgba(184,255,0,0.25)",
} as const;

export interface WaveformRendererProps {
  /** Raw PCM samples (Float32Array) OR a URL to an audio file */
  source:      Float32Array | string | null;
  width?:      number;
  height?:     number;
  color?:      string;
  /** 0–1 playback position — draws a playhead line */
  playhead?:   number;
  /** If true, show RMS envelope behind peak */
  showRMS?:    boolean;
  className?:  string;
}

function downsamplePeak(data: Float32Array, targetBins: number): { peaks: Float32Array; rms: Float32Array } {
  const binSize = Math.max(1, Math.floor(data.length / targetBins));
  const peaks   = new Float32Array(targetBins);
  const rmsArr  = new Float32Array(targetBins);
  for (let b = 0; b < targetBins; b++) {
    const start = b * binSize;
    const end   = Math.min(start + binSize, data.length);
    let peak = 0, sumSq = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
      sumSq += data[i] * data[i];
    }
    peaks[b]  = peak;
    rmsArr[b] = Math.sqrt(sumSq / (end - start));
  }
  return { peaks, rms: rmsArr };
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  peaks: Float32Array, rms: Float32Array,
  color: string, showRMS: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, w, h);

  const mid = h / 2;
  const scaleY = mid * 0.9;

  // RMS envelope
  if (showRMS) {
    ctx.fillStyle = T.rms;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      ctx.lineTo(x, mid - rms[i] * scaleY);
    }
    for (let i = peaks.length - 1; i >= 0; i--) {
      const x = (i / peaks.length) * w;
      ctx.lineTo(x, mid + rms[i] * scaleY);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Peak waveform
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  for (let i = 0; i < peaks.length; i++) {
    const x = (i / peaks.length) * w;
    ctx.moveTo(x, mid - peaks[i] * scaleY);
    ctx.lineTo(x, mid + peaks[i] * scaleY);
  }
  ctx.stroke();

  // Centre line
  ctx.strokeStyle = T.dim;
  ctx.lineWidth   = 0.5;
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
}

export function WaveformRenderer({
  source, width = 400, height = 80,
  color = T.accent, playhead, showRMS = true,
}: WaveformRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const peaksRef  = useRef<{ peaks: Float32Array; rms: Float32Array } | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaksRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { peaks, rms } = peaksRef.current;
    drawWaveform(ctx, width, height, peaks, rms, color, showRMS);
    // Playhead
    if (playhead !== undefined && playhead >= 0 && playhead <= 1) {
      const x = playhead * width;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [width, height, color, playhead, showRMS]);

  useEffect(() => {
    if (!source) { peaksRef.current = null; return; }

    if (source instanceof Float32Array) {
      peaksRef.current = downsamplePeak(source, width);
      render();
      return;
    }

    // URL — fetch and decode
    setLoading(true); setError(null);
    let cancelled = false;

    (async () => {
      try {
        const resp    = await fetch(source);
        const buf     = await resp.arrayBuffer();
        const offCtx  = new OfflineAudioContext(1, 1, 44100);
        const decoded = await offCtx.decodeAudioData(buf);
        if (cancelled) return;
        const data = decoded.getChannelData(0);
        peaksRef.current = downsamplePeak(data, width);
        setLoading(false);
        render();
      } catch (e) {
        if (!cancelled) { setError("Could not decode audio"); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [source, width, render]);

  useEffect(() => { render(); }, [render]);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width, height }}
      />
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)", fontSize: 8,
          color: T.accent, fontFamily: "monospace", letterSpacing: ".15em",
        }}>
          LOADING…
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 8, color: "#ff3b3b", fontFamily: "monospace",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
