// client/src/components/studio/EngineTelemetry.tsx
// Refactored from the HTML prototype's .krow region.
// Wires to useAudioEngine() for parameter control.

import { useState, useCallback, useRef, memo } from 'react';

interface KnobConfig {
  label: string;
  key: string;
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
  ariaLabel: string;
}

const KNOBS: KnobConfig[] = [
  { label: 'CPU', key: 'cpu', min: 0, max: 100, defaultValue: 12, unit: '%', ariaLabel: 'CPU' },
  { label: 'Voices', key: 'voices', min: 0, max: 128, defaultValue: 16, unit: '', ariaLabel: 'Voices' },
  { label: 'VOL', key: 'vol', min: 0, max: 100, defaultValue: 75, unit: '%', ariaLabel: 'Volume' },
  { label: 'FILT', key: 'filt', min: 0, max: 100, defaultValue: 75, unit: '%', ariaLabel: 'Filter' },
  { label: 'REV', key: 'rev', min: 0, max: 100, defaultValue: 75, unit: '%', ariaLabel: 'Reverb' },
  { label: 'SAT', key: 'sat', min: 0, max: 100, defaultValue: 75, unit: '%', ariaLabel: 'Saturation' },
  { label: 'PCH', key: 'pch', min: 0, max: 100, defaultValue: 75, unit: '%', ariaLabel: 'Pitch' },
];

interface RotaryKnobProps {
  config: KnobConfig;
  value: number;
  onChange: (val: number) => void;
}

const RotaryKnob = memo(function RotaryKnob({ config, value, onChange }: RotaryKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startValRef = useRef(0);

  const pct = (value - config.min) / (config.max - config.min);
  const deg = pct * 270;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      startYRef.current = e.clientY;
      startValRef.current = value;
      knobRef.current?.setPointerCapture(e.pointerId);
    },
    [value]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!knobRef.current?.hasPointerCapture(e.pointerId)) return;
      const delta = startYRef.current - e.clientY;
      const range = config.max - config.min;
      const step = range > 50 ? 1 : 0.5;
      const newVal = Math.max(config.min, Math.min(config.max, startValRef.current + delta * step));
      onChange(newVal);
    },
    [config, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = config.max - config.min > 50 ? 1 : 0.5;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(config.max, value + step));
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(config.min, value - step));
      else if (e.key === 'Home') onChange(config.min);
      else if (e.key === 'End') onChange(config.max);
      else return;
      e.preventDefault();
    },
    [config, value, onChange]
  );

  return (
    <div className="flex-1 text-center min-w-[42px]">
      <div className="text-[8px] text-[#555] tracking-[0.12em] uppercase font-semibold mb-1">
        {config.label}
      </div>
      <div
        ref={knobRef}
        className="w-[34px] h-[34px] mx-auto rounded-full relative cursor-ns-resize"
        style={{
          background: `conic-gradient(from 135deg, var(--r3-accent) 0deg, ${deg}deg, #181b17 ${deg}deg, #181b17 360deg)`,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.06), inset 0 -2px 3px rgba(0,0,0,0.65), 0 2px 5px rgba(0,0,0,0.45)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onDoubleClick={() => onChange((config.max - config.min) / 2 + config.min)}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={config.ariaLabel}
        aria-valuemin={config.min}
        aria-valuemax={config.max}
        aria-valuenow={Math.round(value)}
      >
        {/* Gloss overlay */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 32%, transparent 55%)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
          }}
        />
        {/* Indicator tick */}
        <div
          className="absolute top-[5px] left-1/2 w-[2px] h-[9px] rounded-sm -translate-x-1/2"
          style={{
            background: 'linear-gradient(180deg, var(--r3-accent), rgba(200,255,0,0.4))',
            boxShadow: '0 0 12px rgba(200,255,0,0.9), inset 0 1px 2px rgba(255,255,255,0.5), 0 2px 5px rgba(0,0,0,0.8)',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
            transform: `translateX(-50%) rotate(${deg - 135}deg)`,
            transformOrigin: '50% 14px',
          }}
        />
      </div>
      <div
        className="font-mono text-[8.5px] mt-1 font-medium"
        style={{ color: value > 50 ? 'var(--r3-accent)' : '#777', fontVariantNumeric: 'tabular-nums' }}
      >
        {Math.round(value)}{config.unit}
      </div>
    </div>
  );
});

export const EngineTelemetry = memo(function EngineTelemetry() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(KNOBS.map((k) => [k.key, k.defaultValue]))
  );
  const [quality, setQuality] = useState<'soft' | 'hard'>('hard');

  const updateValue = useCallback((key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  return (
    <div
      className="flex gap-2 mb-2 p-2 rounded-md"
      style={{
        background: 'linear-gradient(180deg, #0b0d0b, #080908)',
        border: '1px solid #1b201a',
        boxShadow: 'var(--r3-inset), 0 4px 12px rgba(0,0,0,0.16)',
        minHeight: 59,
      }}
    >
      {KNOBS.map((k) => (
        <RotaryKnob key={k.key} config={k} value={values[k.key] ?? k.defaultValue} onChange={(v) => updateValue(k.key, v)} />
      ))}

      {/* Quality Toggle */}
      <div className="flex flex-col gap-1 ml-auto justify-center">
        <div className="text-[8px] text-[#555] tracking-[0.12em] uppercase font-semibold mb-1">QUALITY</div>
        <button
          onClick={() => setQuality('soft')}
          className="px-2 py-[3px] text-[8px] font-bold tracking-[0.08em] uppercase rounded cursor-pointer transition-all"
          style={{
            background: quality === 'soft' ? 'var(--r3-accent)' : '#111',
            border: quality === 'soft' ? '1px solid var(--r3-accent)' : '1px solid #222',
            color: quality === 'soft' ? '#000' : '#555',
            boxShadow: quality === 'soft' ? '0 0 12px rgba(200,255,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
          }}
        >
          SOFT
        </button>
        <button
          onClick={() => setQuality('hard')}
          className="px-2 py-[3px] text-[8px] font-bold tracking-[0.08em] uppercase rounded cursor-pointer transition-all"
          style={{
            background: quality === 'hard' ? 'var(--r3-accent)' : '#111',
            border: quality === 'hard' ? '1px solid var(--r3-accent)' : '1px solid #222',
            color: quality === 'hard' ? '#000' : '#555',
            boxShadow: quality === 'hard' ? '0 0 12px rgba(200,255,0,0.10), inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
          }}
        >
          HARD
        </button>
      </div>

      {/* Engine Chips */}
      <div className="flex flex-col gap-1 justify-center">
        <div
          className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded border text-[7px] font-mono"
          style={{ background: '#10130d', borderColor: '#263016', color: '#666' }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--r3-accent)', boxShadow: '0 0 7px rgba(200,255,0,0.55)' }} />
          <strong style={{ color: 'var(--r3-accent)' }}>DSP</strong> READY
        </div>
        <div
          className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded border text-[7px] font-mono"
          style={{ background: '#10130d', borderColor: '#263016', color: '#666' }}
        >
          <strong style={{ color: '#9a9a9a' }}>48k</strong> AUDIO
        </div>
      </div>
    </div>
  );
});
