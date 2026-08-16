// client/src/components/studio/TransportBar.tsx
// Refactored from the HTML prototype's .trans region.
// Preserves the existing TransportControls prop contract.

import { useState, useCallback, memo } from 'react';
import { TransportControls } from '@/components/transport-controls';

interface TransportBarProps {
  isArmed: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  recordedEventsCount: number;
  onArm: () => void;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  disabled?: boolean;
}

const PRESETS = ['SUNSET', 'AFTER MIDNIGHT', 'R3 DREAMSCAPE', 'ANALOG MOTION'];

export const TransportBar = memo(function TransportBar({
  isArmed,
  isRecording,
  isPlaying,
  recordedEventsCount,
  onArm,
  onRecord,
  onStop,
  onPlay,
  onUndo,
  onRedo,
  onExport,
}: TransportBarProps) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [scrubPos, setScrubPos] = useState(35);

  const cyclePreset = useCallback(() => {
    setPreset((p) => {
      const idx = PRESETS.indexOf(p);
      return PRESETS[(idx + 1) % PRESETS.length];
    });
  }, []);

  const handleScrub = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setScrubPos(pct);
  }, []);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{
        background: 'linear-gradient(180deg, #0c0c0c, #090909)',
        borderBottom: '1px solid var(--r3-border1)',
        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.012)',
      }}
    >
      {/* R3 Badge */}
      <div className="flex items-center gap-2">
        <div
          className="w-[22px] h-[22px] rounded grid place-items-center text-[9px] font-extrabold"
          style={{
            background: 'var(--r3-accent)',
            color: '#000',
            boxShadow: '0 0 10px rgba(200,255,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          R3
        </div>
        <span className="text-[9px] text-[#555] tracking-[0.06em]">STUDIO · DAM</span>
      </div>

      {/* Click / BPM Pill */}
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded"
        style={{ background: '#0f0f0f', border: '1px solid #1c1c1c', boxShadow: 'var(--r3-inset)' }}
      >
        <span className="text-[9px] text-[#555] tracking-[0.06em]">CLICK</span>
        <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--r3-accent)' }}>
          126 BPM
        </span>
      </div>

      {/* Scrubber */}
      <div className="flex-1 flex items-center gap-2">
        <div
          className="flex-1 h-1 rounded relative cursor-pointer"
          style={{ background: '#1a1a1a', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.65)' }}
          onPointerDown={handleScrub}
          role="slider"
          tabIndex={0}
          aria-label="Timeline position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrubPos)}
        >
          <div
            className="h-full rounded"
            style={{
              width: `${scrubPos}%`,
              background: 'var(--r3-accent)',
              boxShadow: '0 0 8px rgba(200,255,0,0.18)',
            }}
          />
          <div
            className="absolute top-1/2 w-2.5 h-2.5 rounded-sm -translate-y-1/2 -translate-x-1/2"
            style={{
              left: `${scrubPos}%`,
              background: 'var(--r3-accent)',
              boxShadow: '0 0 8px rgba(200,255,0,0.3)',
            }}
          />
        </div>
        <span className="font-mono text-[9px] text-[#555] min-w-[44px]">478ms</span>
      </div>

      {/* Transport Controls — existing component, preserved contract */}
      <div className="scale-90 origin-right">
        <TransportControls
          isArmed={isArmed}
          isRecording={isRecording}
          isPlaying={isPlaying}
          recordedEventsCount={recordedEventsCount}
          onArm={onArm}
          onRecord={onRecord}
          onStop={onStop}
          onPlay={onPlay}
          onUndo={onUndo}
          onRedo={onRedo}
          onExport={onExport}
        />
      </div>

      {/* Preset Dropdown */}
      <button
        onClick={cyclePreset}
        className="flex items-center gap-1 px-2 py-1 rounded text-[9px] cursor-pointer transition-all hover:text-[#aaa]"
        style={{ background: '#111', border: '1px solid #222', color: '#777' }}
      >
        🌅 {preset} ▾
      </button>
    </div>
  );
});
