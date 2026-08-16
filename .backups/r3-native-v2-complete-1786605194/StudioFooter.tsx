// client/src/components/studio/StudioFooter.tsx
// Refactored from the HTML prototype's .foot region.
// Wires to useAudioEngine() getAnalyserData() for real meter levels.

import { useState, useEffect, useRef, memo } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';

interface StudioFooterProps {
  getAnalyserData?: () => Float32Array | null;
  isInitialized: boolean;
}

function useMeterLevel(getAnalyserData: (() => Float32Array | null) | undefined, isInitialized: boolean) {
  const [level, setLevel] = useState(0.5);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isInitialized || !getAnalyserData) return;
    let lastUpdate = 0;

    const tick = (t: number) => {
      if (t - lastUpdate > 90) {
        lastUpdate = t;
        try {
          const data = getAnalyserData();
          if (data && data.length > 0) {
            const sum = data.reduce((s, v) => s + Math.abs(v), 0);
            const avg = sum / data.length;
            setLevel(0.42 + 0.45 * avg);
          }
        } catch { /* no-op */ }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isInitialized, getAnalyserData]);

  return level;
}

const MeterBar = memo(function MeterBar({
  count,
  level,
  warnAt,
}: {
  count: number;
  level: number;
  warnAt: number;
}) {
  const onCount = Math.round(count * level);
  return (
    <div className="flex gap-px items-end">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] rounded-sm transition-colors"
          style={{
            height: `${3 + i * 0.5}px`,
            background: i < onCount
              ? i >= warnAt ? 'var(--r3-warn)' : 'var(--r3-accent)'
              : 'var(--r3-border2)',
          }}
        />
      ))}
    </div>
  );
});

export const StudioFooter = memo(function StudioFooter({
  getAnalyserData,
  isInitialized,
}: StudioFooterProps) {
  const level = useMeterLevel(getAnalyserData, isInitialized);
  const db = -1 - Math.round((1 - level) * 11 * 10) / 10;

  return (
    <footer
      className="flex items-center justify-between px-4 py-1.5 flex-wrap gap-2"
      style={{
        minHeight: 34,
        background: 'linear-gradient(180deg, #0a0a0a, #070707)',
        borderTop: '1px solid #1b2117',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.018)',
      }}
    >
      {/* Left — Brand + Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[8px] tracking-[0.08em] uppercase" style={{ color: '#444' }}>R3 NATIVE</span>
          <span className="text-[8px] font-semibold" style={{ color: '#777' }}>v2.0.0 · X7</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="w-[5px] h-[5px] rounded-full"
            style={{
              background: isInitialized ? 'var(--r3-accent)' : '#444',
              boxShadow: isInitialized ? '0 0 5px rgba(200,255,0,0.35)' : 'none',
              animation: isInitialized ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[8px] font-semibold" style={{ color: '#777' }}>
            {isInitialized ? 'ENGINE READY' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Center — Specs */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: '◫', val: 'POLYPHONY 128' },
          { label: '◷', val: 'LATENCY 4.7 ms' },
          { label: '◈', val: 'SAMPLE RATE 48.0 kHz' },
          { label: '▣', val: 'BUFFER 256' },
          { label: '◉', val: 'MIDI IN All' },
          { label: '◉', val: 'MIDI OUT R3 Native' },
        ].map((spec) => (
          <div key={spec.val} className="flex items-center gap-1">
            <span className="text-[8px] tracking-[0.08em] uppercase" style={{ color: '#444' }}>{spec.label}</span>
            <span className="text-[8px] font-semibold" style={{ color: '#777' }}>{spec.val}</span>
          </div>
        ))}
      </div>

      {/* Right — Oversampling + Master Meter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[8px] tracking-[0.08em] uppercase" style={{ color: '#444' }}>OVERSAMPLING</span>
          <span className="text-[8px] font-semibold" style={{ color: '#777' }}>2× ▾</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-semibold" style={{ color: '#777' }}>0 dB</span>
          <MeterBar count={24} level={level} warnAt={20} />
          <span className="text-[8px] font-mono font-semibold" style={{ color: 'var(--r3-accent)' }}>
            {db.toFixed(1)}
          </span>
        </div>
      </div>
    </footer>
  );
});
