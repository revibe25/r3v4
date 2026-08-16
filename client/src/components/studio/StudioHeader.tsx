// client/src/components/studio/StudioHeader.tsx
// Refactored from the HTML prototype's .head region.
// Wires to useAudioEngine() for BPM and useMidi() for status.

import { useCallback, useRef, useState, memo } from 'react';
import { Link } from 'wouter';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useMidi } from '@/hooks/use-midi';

interface StudioHeaderProps {
  onSave: () => void;
  onLoad: (json: string) => void;
  onExport: () => void;
}

export const StudioHeader = memo(function StudioHeader({
  onSave,
  onLoad,
  onExport,
}: StudioHeaderProps) {
  const { state, isInitialized, setBpm } = useAudioEngine();
  const { midiStatus, midiInputCount } = useMidi({ enabled: isInitialized });

  const tapTimesRef = useRef<number[]>([]);
  const [tapFlash, setTapFlash] = useState(false);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const fresh = tapTimesRef.current.filter((t) => now - t < 3000);
    fresh.push(now);
    tapTimesRef.current = fresh.slice(-8);
    if (fresh.length >= 2) {
      const intervals = fresh.slice(1).map((t, i) => t - fresh[i]);
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      if (bpm >= 20 && bpm <= 999) setBpm(bpm);
    }
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
  }, [setBpm]);

  // Waveform bars — 64 bars animated via requestAnimationFrame
  const waveRef = useRef<HTMLDivElement>(null);
  const animateWave = useCallback(() => {
    if (!waveRef.current) return;
    const bars = waveRef.current.querySelectorAll<HTMLDivElement>('.r3-wave-bar');
    const t = performance.now();
    bars.forEach((b, i) => {
      const h = 4 + Math.random() * 30 * (0.35 + 0.65 * Math.sin((i + t / 220) * 0.13) ** 2);
      b.style.height = `${h}px`;
      b.style.opacity = String(0.35 + Math.random() * 0.55);
    });
    requestAnimationFrame(animateWave);
  }, []);

  // Start animation once initialized
  useState(() => {
    if (isInitialized) requestAnimationFrame(animateWave);
  });

  return (
    <header
      className="relative grid items-center gap-4 px-5 py-3"
      style={{
        gridTemplateColumns: 'minmax(340px, 1.1fr) auto minmax(240px, 1fr) auto',
        background:
          'radial-gradient(circle at 18% 45%, rgba(200,255,0,0.018), transparent 25%), linear-gradient(180deg, #101010 0%, #090909 100%)',
        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.018), 0 3px 15px rgba(0,0,0,0.24)',
        borderBottom: '1px solid var(--r3-border1)',
      }}
    >
      {/* After pseudo-element gradient border accent */}
      <div
        className="pointer-events-none absolute left-4 right-4 bottom-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(200,255,0,0.12), transparent)',
        }}
      />

      {/* Brand + Live Status */}
      <div className="flex items-center gap-4 min-w-0">
        <div>
          <div
            className="text-[27px] font-extrabold tracking-tight text-white"
            style={{ textShadow: '0 1px 0 #000, 0 0 20px rgba(255,255,255,0.035)' }}
          >
            R3<span style={{ color: 'var(--r3-accent)', fontStyle: 'normal', textShadow: '0 0 18px rgba(200,255,0,0.18)' }}>/</span>NATIVE
          </div>
          <div className="text-[8.5px] text-[#565656] tracking-[0.18em] uppercase mt-1">
            Instrument · Virtual VSTs
          </div>
        </div>

        <div
          className="flex flex-col gap-1 px-3 py-2 rounded-md min-w-[158px]"
          style={{
            background: '#0f0f0f',
            border: '1px solid #1c1c1c',
            boxShadow: 'var(--r3-inset), 0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <div className="flex items-center gap-2 text-[10px]">
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{
                background: isInitialized ? 'var(--r3-accent)' : '#444',
                boxShadow: isInitialized
                  ? '0 0 7px rgba(200,255,0,0.55), 0 0 16px rgba(200,255,0,0.14)'
                  : 'none',
                animation: isInitialized ? 'pulse 1.8s ease-in-out infinite' : 'none',
              }}
            />
            <span
              className="font-bold"
              style={{ color: isInitialized ? 'var(--r3-accent)' : '#555' }}
            >
              {isInitialized ? 'LIVE' : 'STANDBY'}
            </span>
          </div>
          <div className="text-[10px] text-[#888]">ERNESTO · R3VIBE</div>
          <div
            className="text-[9px]"
            style={{
              color:
                midiStatus === 'active'
                  ? 'var(--r3-accent)'
                  : midiStatus === 'denied'
                  ? 'var(--r3-danger)'
                  : '#666',
            }}
          >
            MIDI {(midiStatus ?? 'idle').toUpperCase()}
            {midiInputCount > 0 ? ` (${midiInputCount})` : ''}
          </div>
        </div>
      </div>

      {/* BPM Block */}
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-[8.5px] text-[#555] tracking-[0.12em]">BPM</div>
          <div
            className="font-mono text-[43px] font-semibold leading-none tracking-tight min-w-[90px] text-center"
            style={{
              color: 'var(--r3-accent)',
              textShadow: '0 0 28px rgba(200,255,0,0.22), 0 0 50px rgba(200,255,0,0.07)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isInitialized ? state.bpm : '120'}
          </div>
        </div>
        <button
          onClick={handleTapTempo}
          className="px-3 py-1.5 rounded text-[9px] font-bold tracking-[0.12em] uppercase cursor-pointer transition-all"
          style={{
            background: tapFlash ? 'var(--r3-accent)' : '#141414',
            border: '1px solid #2a2a2a',
            color: tapFlash ? '#090900' : '#777',
            boxShadow: tapFlash ? 'none' : 'var(--r3-inset)',
          }}
          title="Tap Tempo (tap 2–8× to set BPM)"
        >
          TAP
        </button>
      </div>

      {/* Waveform Monitor */}
      <div
        ref={waveRef}
        className="flex items-end gap-[1.5px] h-[38px] min-w-[180px] px-1"
        style={{ borderLeft: '1px solid #181818', borderRight: '1px solid #181818' }}
        aria-label="Audio activity visualization"
      >
        {Array.from({ length: 64 }).map((_, i) => (
          <div
            key={i}
            className="r3-wave-bar flex-1 min-w-[2px] rounded-sm transition-all"
            style={{
              background: 'var(--r3-accent)',
              opacity: 0.5,
              height: `${4 + Math.random() * 30}px`,
              boxShadow: '0 0 5px rgba(200,255,0,0.08)',
            }}
          />
        ))}
      </div>

      {/* User Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onSave}
          className="w-[30px] h-[30px] flex items-center justify-center rounded bg-[#121212] border border-[#242424] text-[#707070] text-[11px] cursor-pointer transition-all hover:border-[#444] hover:text-[#c0c0c0] hover:bg-[#161616] active:translate-y-px active:bg-[#0d0d0d]"
          title="Save"
          aria-label="Save"
        >
          💾
        </button>
        <button
          className="w-[30px] h-[30px] flex items-center justify-center rounded bg-[#121212] border border-[#242424] text-[#707070] text-[11px] cursor-pointer transition-all hover:border-[#444] hover:text-[#c0c0c0] hover:bg-[#161616] active:translate-y-px active:bg-[#0d0d0d]"
          title="Sessions"
          aria-label="Sessions"
        >
          📁
        </button>
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) file.text().then(onLoad);
            };
            input.click();
          }}
          className="w-[30px] h-[30px] flex items-center justify-center rounded bg-[#121212] border border-[#242424] text-[#707070] text-[11px] cursor-pointer transition-all hover:border-[#444] hover:text-[#c0c0c0] hover:bg-[#161616] active:translate-y-px active:bg-[#0d0d0d]"
          title="Load"
          aria-label="Load"
        >
          ↑
        </button>
        <button
          onClick={onExport}
          className="w-[30px] h-[30px] flex items-center justify-center rounded bg-[#121212] border border-[#242424] text-[#707070] text-[11px] cursor-pointer transition-all hover:border-[#444] hover:text-[#c0c0c0] hover:bg-[#161616] active:translate-y-px active:bg-[#0d0d0d]"
          title="Export"
          aria-label="Export"
        >
          ↓
        </button>
        <div className="w-px h-[22px] bg-[#1a1a1a] mx-1" />
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#111] border border-[#222]">
          <div className="w-4 h-4 rounded bg-[#292929] grid place-items-center text-[8px] text-[#999]">
            👤
          </div>
          <span className="text-[10px] font-semibold text-[#aaa]">DAM</span>
        </div>
      </div>
    </header>
  );
});
