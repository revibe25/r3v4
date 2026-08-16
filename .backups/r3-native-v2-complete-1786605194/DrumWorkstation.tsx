// client/src/components/drum/DrumWorkstation.tsx
// 16-pad drum workstation with step sequencer.
// NEW feature — no existing equivalent in your codebase.

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';

interface PadConfig {
  note: number;
  name: string;
  sub: string;
  colorIndex: number;
}

const PADS: PadConfig[] = [
  { note: 36, name: 'KICK', sub: 'SUB 808', colorIndex: 0 },
  { note: 37, name: 'SNARE', sub: 'TIGHT 14"', colorIndex: 1 },
  { note: 38, name: 'CLAP', sub: 'ROOM', colorIndex: 2 },
  { note: 39, name: 'HAT', sub: 'CLOSED', colorIndex: 3 },
  { note: 40, name: 'O-HAT', sub: 'OPEN', colorIndex: 4 },
  { note: 41, name: 'TOM', sub: 'LOW', colorIndex: 5 },
  { note: 42, name: 'TOM 2', sub: 'MID', colorIndex: 6 },
  { note: 43, name: 'RIM', sub: 'CLICK', colorIndex: 7 },
  { note: 44, name: 'PERC', sub: 'METAL', colorIndex: 0 },
  { note: 45, name: 'CRASH', sub: '18"', colorIndex: 1 },
  { note: 46, name: 'RIDE', sub: 'BELL', colorIndex: 2 },
  { note: 47, name: 'FX 1', sub: 'AIR', colorIndex: 3 },
  { note: 48, name: 'FX 2', sub: 'DIGITAL', colorIndex: 4 },
  { note: 49, name: 'PERC 2', sub: 'SHAKER', colorIndex: 5 },
  { note: 50, name: 'FILL', sub: 'ROLL', colorIndex: 6 },
  { note: 51, name: 'MASTER', sub: 'HIT', colorIndex: 7 },
];

const WAVE_COLORS = [
  'linear-gradient(180deg, #6f8c54, #31442b)',
  'linear-gradient(180deg, #8a7840, #3e351d)',
  'linear-gradient(180deg, #5e8a43, #294022)',
  'linear-gradient(180deg, #4c8d7b, #203e36)',
  'linear-gradient(180deg, #3f7284, #1b3540)',
  'linear-gradient(180deg, #536c8e, #253347)',
  'linear-gradient(180deg, #72508b, #342443)',
  'linear-gradient(180deg, #8b4d79, #3b2334)',
];

const KITS = [
  'R3 NATIVE · NEON ROOM',
  'R3 NATIVE · DARK CLUB',
  'R3 NATIVE · ANALOG 84',
  'R3 NATIVE · VIBE MACHINE',
];

export const DrumWorkstation = memo(function DrumWorkstation() {
  const { triggerPad, isInitialized } = useAudioEngine();
  const [selectedPad, setSelectedPad] = useState(0);
  const [hitPad, setHitPad] = useState<number | null>(null);
  const [kit, setKit] = useState(0);
  const [swing, setSwing] = useState(18);
  const [playing, setPlaying] = useState(true);
  const [recording, setRecording] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<boolean[]>(() =>
    Array.from({ length: 16 }, (_, i) => [0, 4, 8, 12].includes(i))
  );
  const [collapsed, setCollapsed] = useState(false);

  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step sequencer timer
  useEffect(() => {
    if (!playing) {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      return;
    }
    stepTimerRef.current = setInterval(() => {
      setStepIndex((prev) => {
        const next = (prev + 1) % 16;
        // Trigger on beat steps if active
        if (steps[next] && isInitialized) {
          triggerPad(next % 16);
          setHitPad(next % 16);
          setTimeout(() => setHitPad(null), 110);
        }
        return next;
      });
    }, 126); // 126 BPM default step interval
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [playing, steps, isInitialized, triggerPad]);

  const handlePadHit = useCallback(
    (index: number) => {
      setSelectedPad(index);
      setHitPad(index);
      if (isInitialized) triggerPad(index);
      setTimeout(() => setHitPad(null), 110);
    },
    [isInitialized, triggerPad]
  );

  const toggleStep = useCallback((i: number) => {
    setSteps((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }, []);

  const cycleKit = useCallback(() => setKit((k) => (k + 1) % KITS.length), []);

  if (collapsed) {
    return (
      <div
        className="mb-2 p-3 rounded cursor-pointer"
        style={{ background: 'linear-gradient(180deg, #111411, #0b0d0b)', border: '1px solid #20261c' }}
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--r3-accent)' }}>
            ▦ Drum Pad
          </span>
          <span className="text-[12px] text-[#555]">⌄</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-2 rounded overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0b0e0b, #080a08)',
        border: '1px solid #20261c',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025), 0 10px 30px rgba(0,0,0,0.18)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: 'linear-gradient(180deg, #111411, #0b0d0b)', minHeight: 39 }}
      >
        <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--r3-accent)' }}>
          ▦ Drum Pad
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded border text-[7.5px] font-mono font-semibold tracking-[0.08em]"
            style={{ background: '#0d1009', borderColor: '#20231a', color: '#77852f' }}
          >
            <span className="w-[5px] h-[5px] rounded-full" style={{ background: 'var(--r3-accent)', boxShadow: '0 0 7px rgba(200,255,0,0.55)' }} />
            DRUM ENGINE
          </span>
          <button
            onClick={() => setSteps(Array(16).fill(false))}
            className="h-6 px-2 rounded border text-[8px] font-mono font-semibold cursor-pointer transition-all hover:border-[#3a3a3a] hover:text-[#aaa]"
            style={{ background: '#101010', borderColor: '#222', color: '#555' }}
          >
            CLEAR
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded border text-[12px] font-mono font-semibold cursor-pointer transition-all hover:border-[#3a3a3a] hover:text-[#aaa]"
            style={{ background: '#101010', borderColor: '#222', color: '#555' }}
            aria-label="Collapse drum pad"
          >
            ⌃
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="grid items-center gap-2 px-2 py-2"
        style={{
          gridTemplateColumns: 'minmax(180px, 1.5fr) minmax(150px, 1fr) auto auto',
          borderBottom: '1px solid #171b17',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[7.5px] font-mono font-semibold tracking-[0.12em] text-[#4f4f4f]">KIT</span>
          <button
            onClick={cycleKit}
            className="flex-1 flex justify-between items-center min-w-0 px-2 py-[7px] rounded border text-[9px] font-semibold tracking-[0.05em] cursor-pointer transition-all hover:border-[#3d3d3d] hover:text-[#ddd]"
            style={{ background: '#111', borderColor: '#242424', color: '#aaa' }}
          >
            {KITS[kit]} <span>▾</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[7.5px] font-mono font-semibold tracking-[0.12em] text-[#4f4f4f]">SWING</span>
          <div className="flex-1 h-[3px] min-w-[55px] rounded relative cursor-pointer" style={{ background: '#202020' }}>
            <div className="h-full rounded" style={{ width: `${swing}%`, background: 'var(--r3-accent)' }} />
            <div
              className="absolute top-1/2 w-2 h-2 rounded-sm -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${swing}%`, background: 'var(--r3-accent)', boxShadow: '0 0 8px rgba(200,255,0,0.25)' }}
            />
          </div>
          <strong className="min-w-[29px] text-right text-[9px] font-mono font-semibold" style={{ color: 'var(--r3-accent)' }}>
            {swing}%
          </strong>
        </div>

        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded border text-[7.5px] font-mono font-semibold tracking-[0.08em] whitespace-nowrap"
          style={{ borderColor: '#1d2117', color: '#626a4b' }}
        >
          <span className="w-[5px] h-[5px] rounded-full" style={{ background: 'var(--r3-accent)', boxShadow: '0 0 6px rgba(200,255,0,0.5)' }} />
          MIDI SYNC
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setRecording((r) => !r)}
            className="px-2 py-1.5 rounded border text-[7.5px] font-mono font-bold cursor-pointer transition-all"
            style={{
              background: recording ? '#170b0b' : '#101010',
              borderColor: recording ? '#552222' : '#222',
              color: recording ? '#ff6666' : '#666',
            }}
          >
            ● REC
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="px-2 py-1.5 rounded border text-[7.5px] font-mono font-bold cursor-pointer transition-all"
            style={{
              background: playing ? '#171b0c' : '#101010',
              borderColor: playing ? '#4b5b17' : '#222',
              color: playing ? 'var(--r3-accent)' : '#666',
              boxShadow: playing ? 'inset 0 0 0 1px rgba(200,255,0,0.05)' : 'none',
            }}
          >
            ▶ PLAY
          </button>
          <button
            onClick={() => setPlaying(false)}
            className="px-2 py-1.5 rounded border text-[7.5px] font-mono font-bold cursor-pointer transition-all hover:text-[#aaa] hover:border-[#383838]"
            style={{ background: '#101010', borderColor: '#222', color: '#666' }}
          >
            ■ STOP
          </button>
        </div>
      </div>

      {/* Pad Grid */}
      <div className="p-2">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-[7.5px] font-mono font-semibold tracking-[0.11em] text-[#4e554c]">PERFORMANCE PADS</span>
          <span className="text-[7.5px] font-mono text-[#4a5148]">MIDI 36–51 · 4 × 4</span>
        </div>

        <div
          className="grid gap-0 rounded overflow-hidden"
          style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', border: '1px solid #1c211b', background: '#080a08' }}
        >
          {PADS.map((pad, i) => {
            const isHit = hitPad === i;
            const isSelected = selectedPad === i;
            return (
              <button
                key={pad.note}
                onPointerDown={() => handlePadHit(i)}
                className="relative min-h-[69px] p-2 text-center cursor-pointer transition-all"
                style={{
                  background: isHit
                    ? 'linear-gradient(180deg, #1b2411, #0c1109)'
                    : 'linear-gradient(180deg, rgba(18,21,18,0.88), rgba(9,11,9,0.96))',
                  borderRight: (i + 1) % 8 === 0 ? 'none' : '1px solid #161b16',
                  borderBottom: i >= 8 ? 'none' : '1px solid #161b16',
                  boxShadow: isHit ? 'inset 0 0 22px rgba(200,255,0,0.08)' : 'none',
                }}
              >
                <span className="absolute top-1 right-1.5 text-[6.5px] font-mono font-semibold text-[#70776d] z-10">
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Waveform mini */}
                <div className="h-[31px] my-2 flex items-center justify-center gap-px opacity-70 overflow-hidden">
                  {Array.from({ length: 44 }).map((_, wi) => {
                    const h = [1, 2, 1, 2, 2, 1, 1, 7, 1, 3, 1, 1, 1, 9, 1, 2, 5, 1, 1, 3, 1, 1, 8, 1, 1, 1, 1, 1, 5, 1, 1, 0, 1, 1, 3, 1, 8, 1, 1, 1, 1, 7, 1, 9][wi] || 1;
                    return (
                      <span
                        key={wi}
                        className="block w-[2px] min-h-[2px] rounded-sm"
                        style={{
                          height: `${h}px`,
                          background: isHit ? 'var(--r3-accent)' : WAVE_COLORS[pad.colorIndex],
                          boxShadow: isHit ? '0 0 7px rgba(200,255,0,0.35)' : '0 0 4px rgba(200,255,0,0.03)',
                        }}
                      />
                    );
                  })}
                </div>

                <span
                  className="block text-[7.5px] font-bold tracking-[0.09em]"
                  style={{ color: i === 0 ? 'var(--r3-accent)' : '#aeb5aa' }}
                >
                  {pad.name}
                </span>
                <span className="block text-[6px] font-mono text-[#555d54] tracking-[0.07em]">{pad.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Meter */}
        <div className="mt-1 h-1 rounded overflow-hidden" style={{ background: '#171717' }}>
          <div
            className="h-full"
            style={{
              width: `${hitPad !== null ? 68 + Math.random() * 30 : 0}%`,
              background: 'linear-gradient(90deg, #536c12, var(--r3-accent))',
              boxShadow: '0 0 8px rgba(200,255,0,0.25)',
              transition: 'width 0.08s ease',
            }}
          />
        </div>
      </div>

      {/* Selected Pad Detail Strip */}
      <div
        className="grid items-stretch mt-2 min-h-[108px]"
        style={{
          gridTemplateColumns: '135px repeat(5, minmax(54px, 1fr)) minmax(110px, 1.3fr)',
          border: '1px solid #1b201a',
          borderRadius: 2,
          background: '#090b09',
        }}
      >
        <div className="flex flex-col justify-center gap-2 px-3 py-2" style={{ borderRight: '1px solid #242a22' }}>
          <span className="text-[8px] font-mono font-semibold tracking-[0.1em] text-[#777]">SELECTED PAD</span>
          <strong className="text-[9px] font-bold tracking-[0.09em]" style={{ color: '#c2c8bf' }}>
            {PADS[selectedPad].name}
          </strong>
        </div>

        {[
          { label: 'LEVEL', val: '-1.8 dB', pct: 76 },
          { label: 'PAN', val: 'C', pct: 50 },
          { label: 'ATTACK', val: '8 ms', pct: 28 },
          { label: 'RELEASE', val: '180 ms', pct: 44 },
          { label: 'VELOCITY', val: '100%', pct: 82 },
        ].map((row) => (
          <div
            key={row.label}
            className="flex flex-col justify-center gap-2 px-2 py-2"
            style={{ borderRight: '1px solid #171c17' }}
          >
            <span className="text-[6.5px] font-mono font-semibold tracking-[0.12em] text-[#666e64]">{row.label}</span>
            <b className="text-[7px] font-mono font-semibold text-[#6f776c] text-left">{row.val}</b>
            <div className="w-full h-[3px] rounded relative" style={{ background: '#1a1f19' }}>
              <div className="h-full rounded" style={{ width: `${row.pct}%`, background: 'var(--r3-accent)' }} />
            </div>
          </div>
        ))}

        <div className="flex flex-col justify-center gap-2 px-3 py-2">
          <div className="flex justify-between gap-3">
            <span className="text-[6.5px] font-mono font-semibold tracking-[0.08em] text-[#555d53]">NOTE</span>
            <b className="text-[7px] font-mono font-semibold text-[#8c9489]">
              C2 · {PADS[selectedPad].note}
            </b>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[6.5px] font-mono font-semibold tracking-[0.08em] text-[#555d53]">OUTPUT</span>
            <b className="text-[7px] font-mono font-semibold text-[#8c9489]">DRUM BUS</b>
          </div>
        </div>
      </div>

      {/* Step Sequencer */}
      <div className="mt-2 p-2 rounded" style={{ background: '#080a08', border: '1px solid #1b201a' }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[7.5px] font-mono font-semibold tracking-[0.1em] text-[#555]">16-STEP TRIGGER LANE</span>
          <b className="text-[7px] font-mono font-semibold text-[#4c4c4c]">
            {PADS[selectedPad].name} · {steps.filter(Boolean).length}/16
          </b>
        </div>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
          {steps.map((on, i) => (
            <button
              key={i}
              onClick={() => toggleStep(i)}
              className="h-4 rounded-sm border cursor-pointer transition-all"
              style={{
                background: on ? '#718e16' : '#101010',
                borderColor: on ? '#9bbf1e' : '#1a1a1a',
                boxShadow: on ? '0 0 5px rgba(200,255,0,0.12)' : 'none',
                borderTopColor: i % 4 === 0 ? '#444' : undefined,
                boxShadow: stepIndex % 16 === i ? 'inset 0 0 0 1px var(--r3-accent)' : on ? '0 0 5px rgba(200,255,0,0.12)' : 'none',
              }}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
