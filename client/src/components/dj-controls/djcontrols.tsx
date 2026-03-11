// @ts-nocheck
import { useState } from 'react';
import type { DJControlsProps } from './types';
import {
  ACID, DJ_BLACK, DJ_SURFACE, DJ_BORDER, DJ_DIM, DJ_DIMMER,
} from './types';
import { Knob } from './knob';
import { TransBtn } from './transbtn';
import { VUMeter } from './vumeter';
import { ModeSwitcher } from './modeswitcher';
import { WaveformDisplay } from './waveformdisplay';

type PanelMode = 'compact' | 'normal' | 'professional';

export function DJControls({
  filterVal: filterProp, pitchSemitones: pitchProp, crossfade: crossfadeProp,
  onFilterChange, onPitchChange, onCrossfadeChange,
  onPlay, onPause, onStop, onCue, isPlaying = false,
}: DJControlsProps) {
  const [mode, setMode]           = useState<PanelMode>('normal');
  const [collapsed, setCollapsed] = useState(false);

  // Internal state (used when props are not provided)
  const [filterInt, setFilterInt]       = useState(0.5);
  const [pitchInt, setPitchInt]         = useState(0);
  const [crossfadeInt, setCrossfadeInt] = useState(0);
  const [gain, setGain]                 = useState(0.8);
  const [tempo, setTempo]               = useState(120);
  const [swing, setSwing]               = useState(0);
  const [eq, setEq]                     = useState({ low: 0, mid: 0, high: 0 });
  const [quantize, setQuantize]         = useState(true);
  const [sync, setSync]                 = useState(true);
  const [hotCue, setHotCue]             = useState<number | null>(null);
  const [playing, setPlaying]           = useState(true);

  const filter      = filterProp    ?? filterInt;
  const pitch       = pitchProp     ?? pitchInt;
  const crossfade   = crossfadeProp ?? crossfadeInt;
  const isActivePlay = isPlaying    ?? playing;

  const handleFilter    = onFilterChange    ?? setFilterInt;
  const handlePitch     = onPitchChange     ?? ((v: number) => setPitchInt(Math.round(v)));
  const handleCrossfade = onCrossfadeChange ?? setCrossfadeInt;
  const handlePlay      = onPlay            ?? (() => setPlaying(true));
  const handlePause     = onPause           ?? (() => setPlaying(false));
  const handleStop      = onStop            ?? (() => setPlaying(false));

  const cfPct    = (crossfade + 1) / 2;
  const knobSize = mode === 'compact' ? 52 : mode === 'professional' ? 88 : 68;
  const cols     = mode === 'compact' ? 4 : 6;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&display=swap');
        @keyframes dj-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .dj-body { transition: max-height 0.3s ease, opacity 0.2s ease, padding 0.25s ease; }
      `}</style>

      <div style={{
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        background: DJ_BLACK,
        border: `1px solid ${DJ_BORDER}`,
        borderRadius: 0,
        backdropFilter: 'none',
        boxShadow: 'none',
        overflow: 'hidden',
      }}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: collapsed ? 'none' : `1px solid ${DJ_BORDER}`,
          background: DJ_SURFACE,
        }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: ACID,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DJ_BLACK} strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: '#ffffff' }}>
                DJ CONTROLLER
              </div>
              <div style={{ fontSize: 8, color: DJ_DIM, letterSpacing: 2 }}>
                PRO MIX ENGINE v3.5
              </div>
            </div>
          </div>

          {/* Live badge + BPM */}
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'transparent', border: `1px solid ${ACID}` }}>
                <div style={{ width: 4, height: 4, background: ACID, animation: 'dj-pulse 1.2s infinite' }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: ACID, textTransform: 'uppercase', letterSpacing: 2 }}>LIVE</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACID, letterSpacing: 2 }}>
                {Math.round(tempo)} BPM
              </div>
            </div>
          )}

          {/* Mode switcher + collapse toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!collapsed && <ModeSwitcher mode={mode} onChange={setMode} />}
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 26, height: 26, borderRadius: 0, border: `1px solid ${DJ_BORDER}`,
                background: 'transparent', color: DJ_DIM,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"
                style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        <div
          className="dj-body"
          style={{
            maxHeight: collapsed ? 0 : 2000,
            opacity: collapsed ? 0 : 1,
            overflow: 'hidden',
            padding: collapsed ? '0 12px' : '12px 12px',
            display: 'flex', flexDirection: 'column', gap: mode === 'compact' ? 8 : 12,
            background: DJ_BLACK,
          }}
        >
          {/* Transport Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mode === 'compact' ? 5 : 8}, 1fr)`, gap: mode === 'compact' ? 4 : 6 }}>
            {mode !== 'compact' && (
              <TransBtn
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>}
                label="Prev" onClick={() => {}} compact={mode === 'compact'} />
            )}
            <TransBtn
              icon={isActivePlay
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
              label={isActivePlay ? 'Pause' : 'Play'}
              onClick={isActivePlay ? handlePause : handlePlay}
              active={isActivePlay} color={ACID}
              compact={mode === 'compact'}
            />
            <TransBtn
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
              label="Stop" onClick={handleStop} danger compact={mode === 'compact'}
            />
            <TransBtn
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>}
              label="Cue" onClick={() => onCue?.()} color={ACID} compact={mode === 'compact'}
            />
            {mode !== 'compact' && (
              <TransBtn
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>}
                label="Next" onClick={() => {}} compact={mode === 'compact'} />
            )}
            <TransBtn
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>}
              label="Loop" onClick={() => {}} compact={mode === 'compact'}
            />
            <TransBtn
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>}
              label="Shuffle" onClick={() => {}} compact={mode === 'compact'}
            />
            <TransBtn
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>}
              label={sync ? 'SYNC ON' : 'Sync'}
              onClick={() => setSync(!sync)}
              active={sync} color={ACID}
              compact={mode === 'compact'}
            />
          </div>

          {/* Main Knobs */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
            <Knob value={filter} min={0} max={1} label="Filter" onChange={handleFilter}
              formatValue={v => `${Math.round(v * 100)}%`} defaultValue={0.5} color={ACID} size={knobSize} />
            <Knob value={pitch} min={-12} max={12} label="Pitch"
              onChange={v => handlePitch(Math.round(v))}
              formatValue={v => `${v > 0 ? '+' : ''}${Math.round(v)}st`}
              defaultValue={0} step={1} color={ACID} size={knobSize} />
            <Knob value={gain} min={0} max={1.5} label="Gain" onChange={setGain}
              formatValue={v => `${Math.round(v * 100)}%`} defaultValue={0.8} color={ACID} size={knobSize} />
            <Knob value={tempo} min={60} max={200} label="Tempo" onChange={setTempo}
              formatValue={v => `${Math.round(v)}`} defaultValue={120} step={1} color={ACID} size={knobSize} />
            {(mode === 'normal' || mode === 'professional') && (
              <Knob value={swing} min={0} max={1} label="Swing" onChange={setSwing}
                formatValue={v => `${Math.round(v * 100)}%`} defaultValue={0} color={ACID} size={knobSize} />
            )}
            {(mode === 'normal' || mode === 'professional') && (
              <Knob value={0} min={-1} max={1} label="Jog" onChange={() => {}}
                formatValue={() => 'JOG'} defaultValue={0} color={ACID} size={knobSize} />
            )}
          </div>

          {/* EQ Section */}
          {mode !== 'compact' && (
            <div style={{
              padding: mode === 'professional' ? '12px 12px' : '10px 10px',
              borderRadius: 0,
              background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 8, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>
                  3-BAND EQ
                </span>
                <button
                  onClick={() => setEq({ low: 0, mid: 0, high: 0 })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                    background: 'transparent', border: `1px solid ${DJ_BORDER}`,
                    color: DJ_DIM, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'inherit',
                  }}
                >
                  ↺ RESET
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { key: 'low',  label: 'LOW'  },
                  { key: 'mid',  label: 'MID'  },
                  { key: 'high', label: 'HIGH' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 8, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: ACID }}>
                        {(eq[key as keyof typeof eq] > 0 ? '+' : '')}{(eq[key as keyof typeof eq] * 12).toFixed(1)} dB
                      </span>
                    </div>
                    <input type="range" min={-1} max={1} step={0.01}
                      value={eq[key as keyof typeof eq]}
                      onChange={e => setEq({ ...eq, [key]: +e.target.value })}
                      style={{ width: '100%', accentColor: ACID, height: 2 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VU Meters */}
          {mode !== 'compact' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <VUMeter value={filter}                  color={ACID} label="Filter" />
              <VUMeter value={Math.abs(pitch) / 12}    color={ACID} label="Pitch"  />
              <VUMeter value={Math.abs(tempo - 120) / 80} color={ACID} label="Tempo" />
              <VUMeter value={gain / 1.5}              color={ACID} label="Gain"   />
            </div>
          )}

          {/* Crossfader */}
          <div style={{
            padding: mode === 'compact' ? '8px 10px' : '10px 12px',
            borderRadius: 0,
            background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2 }}>
                CROSSFADER
              </span>
              <span style={{ fontSize: 8, fontWeight: 700, color: crossfade < -0.05 ? ACID : crossfade > 0.05 ? ACID : DJ_DIM, letterSpacing: 1 }}>
                {crossfade < -0.05 ? '◀ DECK A' : crossfade > 0.05 ? 'DECK B ▶' : '◆ CENTER'}
              </span>
            </div>

            {/* Visual track */}
            <div style={{ position: 'relative', height: 4, background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}`, marginBottom: 8 }}>
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: cfPct < 0.5 ? `${cfPct * 100}%` : '50%',
                right: cfPct > 0.5 ? `${(1 - cfPct) * 100}%` : '50%',
                background: ACID,
              }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: DJ_BORDER, transform: 'translateX(-50%)' }} />
              <div style={{
                position: 'absolute',
                left: `calc(${cfPct * 100}% - 4px)`,
                top: -4, width: 8, height: 12,
                background: ACID,
                pointerEvents: 'none',
              }} />
            </div>

            <input type="range" min={-1} max={1} step={0.01} value={crossfade}
              onChange={e => handleCrossfade(+e.target.value)}
              style={{ width: '100%', accentColor: ACID, height: 2, opacity: 0, position: 'absolute', left: 0, cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 7, color: DJ_DIM,    textTransform: 'uppercase', letterSpacing: 2 }}>A</span>
              <span style={{ fontSize: 7, color: DJ_DIMMER, textTransform: 'uppercase', letterSpacing: 2 }}>CENTER</span>
              <span style={{ fontSize: 7, color: DJ_DIM,    textTransform: 'uppercase', letterSpacing: 2 }}>B</span>
            </div>
          </div>

          {/* Hot Cues */}
          {mode !== 'compact' && (
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                HOT CUES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const isActive = hotCue === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setHotCue(i)}
                      style={{
                        aspectRatio: '1', borderRadius: 0,
                        border: `1px solid ${isActive ? ACID : DJ_BORDER}`,
                        background: isActive ? ACID : DJ_SURFACE,
                        color: isActive ? DJ_BLACK : DJ_DIM,
                        fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pro mode: waveform preview */}
          {mode === 'professional' && (
            <div style={{ padding: '10px 12px', background: DJ_SURFACE, border: `1px solid ${DJ_BORDER}` }}>
              <div style={{ fontSize: 8, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                WAVEFORM PREVIEW
              </div>
              <WaveformDisplay active={isActivePlay} />
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 10, borderTop: `1px solid ${DJ_BORDER}`,
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setQuantize(!quantize)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', cursor: 'pointer',
                  background: quantize ? ACID : 'transparent',
                  border: `1px solid ${quantize ? ACID : DJ_BORDER}`,
                  color: quantize ? DJ_BLACK : DJ_DIM,
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'inherit',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                QNT
              </button>
            </div>
            <span style={{ fontSize: 7, color: DJ_DIMMER, textTransform: 'uppercase', letterSpacing: 2 }}>
              PIONEER DJ · 24-BIT / 96KHZ
            </span>
          </div>
        </div>
      </div>
    </>
  );
}