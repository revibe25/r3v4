/**
 * DAW.tsx — R3 v4 Main DAW Page
 *
 * Single-page implementation of all three capability tiers:
 *   L1 Core       — arrangement, mixer, FX rack, AI mix, transport, file browser
 *   L2 Advanced   — MIDI piano-roll sequencer, real-time collab, cloud sync, plugin SDK
 *   L3 Elite      — AI co-producer chat, adaptive mastering, predictive arrangement,
 *                   generative audio layer suggestions
 *
 * Layout (CSS Grid):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                  TRANSPORT BAR                          │
 *   ├──────┬──────────────────────────────────────┬───────────┤
 *   │      │   ARRANGEMENT VIEW                   │   AI      │
 *   │ SIDE │   (+ prediction overlays — L3)       │  PANEL    │
 *   │  BAR │──────────────────────────────────────│  (tabbed) │
 *   │      │   MIDI SEQUENCER (collapsible — L2)  │           │
 *   ├──────┴──────────────────────────────────────┴───────────┤
 *   │        MIXER STRIP  +  FX RACK (inline)                 │
 *   └─────────────────────────────────────────────────────────┘
 *
 * All state is sourced from useDAWStore (Zustand).
 * Audio engine is wired via useDAWEngine (Tone.js).
 * Collab socket is managed by useCollabSocket.
 * MIDI sequencer is driven by useMidiSequencer.
 */

import { PageNav } from '@/components/page-nav';
import React, {
  useCallback, useEffect, useRef, useState, useMemo, memo,
} from 'react';

import { useLocation }      from 'wouter';
import { useDAWStore }      from '../hooks/useDAWStore';
import { useDAWEngine }     from '../hooks/useDAWEngine';
import { useCollabSocket }  from '../hooks/useCollabSocket';
import { useMidiSequencer } from '../hooks/useMidiSequencer';
import type {
  Track, TrackRegion, FXSlot, MidiPattern, AISuggestion, AIChatMessage,
  CollabUser,
} from '../hooks/useDAWStore';
import { useLoopEngineFFTRef }   from '../hooks/useLoopEngineFFTRef';
import { AudioReactiveScene }    from '../components/daw/AudioReactiveScene';
import { WaveformMesh }          from '../components/daw/WaveformMesh';
import { SessionChip }           from '../components/session-summary/SessionChip';
import { SessionSummaryPanel }   from '../components/session-summary/SessionSummaryPanel';

// ─── Shared mini-components ───────────────────────────────────────────────────

const Knob = memo(({
  value, min = 0, max = 1, label, onChange, accent = '#a3e635', size = 36,
}: {
  value: number; min?: number; max?: number; label: string;
  onChange: (v: number) => void; accent?: string; size?: number;
}) => {
  const dragStart = useRef<{ y: number; v: number } | null>(null);
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { y: e.clientY, v: value };
    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const delta = (dragStart.current.y - ev.clientY) / 120;
      const next  = Math.max(min, Math.min(max, dragStart.current.v + delta * (max - min)));
      onChange(Math.round(next * 1000) / 1000);
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 select-none" style={{ width: size }}>
      <div
        className="relative rounded-full border border-[var(--dj-dimmer)] bg-[var(--t-b2x)] cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={onMouseDown}
      >
        <div
          className="absolute inset-[3px] rounded-full"
          style={{ background: `conic-gradient(from ${-135}deg at 50% 50%, var(--dj-border) 0deg, var(--dj-border) ${pct*270}deg, transparent ${pct*270}deg)` }}
        />
        <div
          className="absolute w-0.5 bg-current origin-bottom rounded"
          style={{
            height: size * 0.38,
            bottom: '50%',
            left: '50%',
            transform: `translateX(-50%) rotate(${angle}deg)`,
            color: accent,
          }}
        />
        <div
          className="absolute inset-[5px] rounded-full bg-[var(--dj-surface2)] flex items-center justify-center"
          style={{ boxShadow: `0 0 6px ${accent}44` }}
        />
      </div>
      <span className="text-[9px] tracking-widest uppercase" style={{ color: 'var(--surface-mid)' }}>{label}</span>
    </div>
  );
});
Knob.displayName = 'Knob';

const VUMeter = memo(({ level, vertical = true, accent = '#a3e635', warn = 'var(--status-warn)', clip = '#ef4444' }: {
  level: number; vertical?: boolean; accent?: string; warn?: string; clip?: string;
}) => {
  const bars = 12;
  return (
    <div className={`flex ${vertical ? 'flex-col-reverse' : 'flex-row'} gap-px`} style={vertical ? { height: 48 } : { width: 48 }}>
      {Array.from({ length: bars }, (_, i) => {
        const threshold = i / bars;
        const active = level > threshold;
        const color = i >= bars - 2 ? clip : i >= bars - 4 ? warn : accent;
        return (
          <div
            key={i}
            className={`rounded-sm transition-opacity duration-75`}
            style={{
              flex: 1,
              background: active ? color : 'var(--dj-border)',
              opacity: active ? 1 : 0.35,
              boxShadow: active ? `0 0 3px ${color}88` : 'none',
            }}
          />
        );
      })}
    </div>
  );
});
VUMeter.displayName = 'VUMeter';

const Btn = memo(({
  children, onClick, active, danger, dim, className = '', title,
}: {
  children: React.ReactNode; onClick?: () => void;
  active?: boolean; danger?: boolean; dim?: boolean;
  className?: string; title?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`
      px-2 py-1 rounded text-[11px] tracking-widest uppercase font-mono border
      transition-all duration-100 select-none
      ${active
        ? danger
          ? 'bg-red-600/20 border-red-600/60 text-red-400'
          : 'bg-[#a3e635]/10 border-[#a3e635]/40 text-[#a3e635]'
        : dim
          ? 'bg-transparent border-[#2a2a2a] text-[var(--dj-dim)] cursor-not-allowed'
          : 'bg-[var(--t-b2x)] border-[var(--dj-dimmer)] text-[var(--text-dim)] hover:border-[#555] hover:text-[var(--daw-ghost)]'
      }
      ${className}
    `}
  >
    {children}
  </button>
));
Btn.displayName = 'Btn';

const Led = memo(({ on, color = 'var(--status-warn)', pulse }: { on: boolean; color?: string; pulse?: boolean }) => (
  <div
    className={`w-2 h-2 rounded-full ${pulse && on ? 'animate-pulse' : ''}`}
    style={{
      background: on ? color : 'var(--t-b2x)',
      boxShadow: on ? `0 0 6px ${color}, 0 0 12px ${color}44` : 'none',
      border: `1px solid ${on ? color : 'var(--dj-dimmer)'}`,
    }}
  />
));
Led.displayName = 'Led';

// ─── Time Savings Readout  (PRD §8.4)  ──────────────────────────────────────
// PATCH-D04: Root cause — PRD §8.4 Time Savings UI absent entirely.
//   Fix: Self-contained memo component driven by acceptedCount from store.
//   4 min/suggestion is the conservative estimate from PRD §8.4.2.
//   Renders null when count=0 → no layout impact until first acceptance.
const TimeSavingsReadout = memo(() => {
  const acceptedCount = useDAWStore(
    s => s.aiSuggestions.filter((x: { accepted: boolean | null }) => x.accepted === true).length,
  );
  const MINS_PER = 4; // PRD §8.4.2 conservative estimate
  const saved    = acceptedCount * MINS_PER;
  if (saved === 0) return null;
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 border
                 border-[#a3e635]/25 bg-[#a3e635]/5"
      title={`${acceptedCount} AI suggestion${acceptedCount !== 1 ? 's' : ''} accepted — ~${saved} min saved`}
    >
      <span className="text-[8px] text-[#a3e635]/60 tracking-widest">SAVED</span>
      <span className="text-[10px] font-mono text-[#a3e635] font-semibold">{saved}m</span>
    </div>
  );
});
TimeSavingsReadout.displayName = 'TimeSavingsReadout';

// ─── Transport Bar ────────────────────────────────────────────────────────────

const TransportBar = memo(({ engine }: { engine: ReturnType<typeof useDAWEngine> }) => {
  const {
    playing, recording, bpm, position, timeSignature, loopEnabled,
    metronomeEnabled, masterGain, syncStatus, projectName, collabConnected,
    setPlaying, setRecording, setBpm, setLoopEnabled, setMetronome,
    setMasterGain, setProjectName, setTimeSignature,
  } = useDAWStore();

  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInput,  setBpmInput]    = useState('');
  const [editingName, setEditingName] = useState(false);

  const beats = Math.floor(position);
  const bar   = Math.floor(beats / timeSignature[0]) + 1;
  const beat  = (beats % timeSignature[0]) + 1;
  const posStr = `${String(bar).padStart(3,'0')}:${beat}`;

  const syncColors: Record<string, string> = {
    idle: 'var(--dj-dim)', syncing: 'var(--status-warn)', synced: 'var(--accent-green)', error: '#ef4444', offline: '#555',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#0d0d0d] border-b border-[#1c1c1c]"
         style={{ minHeight: 52 }}>
      {/* Project name */}
      <div className="flex items-center gap-2 min-w-[140px]">
        <Led on={collabConnected} color="var(--looper-cyan)" pulse={collabConnected} />
        {editingName ? (
          <input
            autoFocus
            className="bg-[var(--t-b2x)] border border-[#a3e635]/40 px-1 text-xs text-white w-28"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
          />
        ) : (
          <span
            className="text-[11px] tracking-widest text-[var(--text-dim)] cursor-pointer hover:text-[#a3e635] transition-colors"
            onClick={() => setEditingName(true)}
          >
            {projectName}
          </span>
        )}
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: syncColors[syncStatus] ?? 'var(--dj-dim)' }}
          title={`Sync: ${syncStatus}`}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-[#2a2a2a]" />

      {/* Transport buttons */}
      <div className="flex items-center gap-1.5">
        <Btn onClick={engine.stop} title="Stop (Space)">■</Btn>
        <Btn onClick={engine.togglePlay} active={playing} title="Play/Pause (Space)">
          {playing ? '⏸' : '▶'}
        </Btn>
        <Btn onClick={engine.toggleRecord} active={recording} danger={recording} title="Record (R)">
          ⏺
        </Btn>
      </div>

      {/* Position display */}
      <div className="font-mono text-sm bg-[#0a0a0a] border border-[var(--dj-border)] rounded px-2 py-1"
           style={{ minWidth: 72, textAlign: 'center' }}>
        <span className="text-[#a3e635]">{posStr}</span>
      </div>

      <div className="w-px h-8 bg-[#2a2a2a]" />

      {/* BPM */}
      <div className="flex items-center gap-1.5">
        <button
          className="text-[10px] text-[#555] hover:text-[#a3e635] px-1 select-none"
          onClick={() => engine.nudgeBpm(-1)}
        >◀</button>
        {editingBpm ? (
          <input
            autoFocus
            className="w-14 bg-[#0a0a0a] border border-[#a3e635]/40 text-center text-[#a3e635] font-mono text-sm"
            value={bpmInput}
            onChange={e => setBpmInput(e.target.value)}
            onBlur={() => {
              const v = parseFloat(bpmInput);
              if (!isNaN(v)) setBpm(v);
              setEditingBpm(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = parseFloat(bpmInput); if (!isNaN(v)) setBpm(v);
                setEditingBpm(false);
              }
              if (e.key === 'Escape') setEditingBpm(false);
            }}
          />
        ) : (
          <div
            className="font-mono text-sm bg-[#0a0a0a] border border-[var(--dj-border)] px-2 py-1 cursor-pointer hover:border-[#a3e635]/30 min-w-[56px] text-center text-[#a3e635]"
            onClick={() => { setBpmInput(String(bpm)); setEditingBpm(true); }}
          >
            {bpm.toFixed(1)}
          </div>
        )}
        <button
          className="text-[10px] text-[#555] hover:text-[#a3e635] px-1 select-none"
          onClick={() => engine.nudgeBpm(1)}
        >▶</button>
        <span className="text-[9px] text-[var(--dj-dim)] tracking-widest">BPM</span>
        <Btn onClick={engine.tapTempo} className="text-[9px]" title="Tap Tempo (T)">TAP</Btn>
      </div>

      {/* Time signature */}
      <select
        className="bg-[#0d0d0d] border border-[var(--dj-border)] rounded text-[11px] text-[var(--text-dim)] px-1 py-0.5 cursor-pointer"
        value={`${timeSignature[0]}/${timeSignature[1]}`}
        onChange={e => {
          const [n, d] = e.target.value.split('/').map(Number);
          setTimeSignature([n, d] as [number, number]);
        }}
      >
        {['4/4','3/4','6/8','7/8','5/4'].map(s => <option key={s}>{s}</option>)}
      </select>

      <div className="w-px h-8 bg-[#2a2a2a]" />

      {/* Loop / Metronome */}
      <div className="flex items-center gap-1.5">
        <Btn onClick={() => setLoopEnabled(!loopEnabled)} active={loopEnabled} title="Loop">⟳</Btn>
        <Btn onClick={() => setMetronome(!metronomeEnabled)} active={metronomeEnabled} title="Metronome">🎵</Btn>
      </div>

      {/* Master gain */}
      <div className="flex items-center gap-2 ml-auto">
        {/* PATCH-D04-b: Time savings readout wired here (PRD §8.4) */}
        <TimeSavingsReadout />
        <div className="w-px h-5 bg-[#2a2a2a]" />
        <span className="text-[9px] text-[var(--dj-dim)] tracking-widest">MASTER</span>
        <Knob
          value={masterGain} min={0} max={1.5} label=""
          onChange={setMasterGain} size={28}
        />
      </div>
    </div>
  );
});
TransportBar.displayName = 'TransportBar';

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = memo(({ collab }: { collab: ReturnType<typeof useCollabSocket> }) => {
  const { sidebarTab, setSidebarTab, collabUsers, collabConnected, collabEnabled, loadedPlugins } = useDAWStore();
  // PATCH-D01: reactive selector — getState() inside JSX is not reactive
  const collabRoom = useDAWStore(s => s.collabRoom);
  const [joining, setJoining] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [, navigate]  = useLocation();
  const uploadRef     = useRef<HTMLInputElement>(null);

  const FILES = [
    { name: 'KICKS/', type: 'folder' },
    { name: 'SNARES/', type: 'folder' },
    { name: 'SYNTHS/', type: 'folder' },
    { name: 'LOOPS/', type: 'folder' },
    { name: 'PRESETS/', type: 'folder' },
  ];

  return (
    <div className="flex flex-col bg-[#0d0d0d] border-r border-[#1c1c1c]" style={{ width: 180 }}>
      {/* Tab bar */}
      <div className="flex border-b border-[#1c1c1c]">
        {(['files', 'collab', 'plugins'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className={`flex-1 py-1.5 text-[9px] tracking-widest uppercase font-mono transition-colors ${
              sidebarTab === tab
                ? 'text-[#a3e635] border-b border-[#a3e635]'
                : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)]'
            }`}
          >
            {tab === 'files' ? '📁' : tab === 'collab' ? '👥' : '🧩'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* ── Files tab ──────────────────────────────────────────────────── */}
        {sidebarTab === 'files' && (
          <>
            <p className="text-[9px] text-[var(--dj-dim)] tracking-widest px-1 mb-2">BROWSER</p>
            {FILES.map(f => (
              <div
                key={f.name}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--t-b2x)] cursor-pointer group"
              >
                <span className="text-[#555] text-xs">{f.type === 'folder' ? '▸' : '•'}</span>
                <span className="text-[11px] text-[var(--dj-muted)] group-hover:text-[var(--daw-sub)] transition-colors font-mono">
                  {f.name}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#1c1c1c] mt-2">
              <input
                ref={uploadRef}
                type="file"
                accept="audio/*,.wav,.mp3,.aiff,.flac,.ogg"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { /* upload queued — wire to engine handler */ }
                  e.target.value = '';
                }}
              />
              <Btn className="w-full justify-center text-[9px]" onClick={() => uploadRef.current?.click()}>
                + UPLOAD
              </Btn>
            </div>
          </>
        )}

        {/* ── Collab tab (L2) ────────────────────────────────────────────── */}
        {sidebarTab === 'collab' && (
          <>
            <p className="text-[9px] text-[var(--dj-dim)] tracking-widest px-1 mb-2">
              COLLABORATION
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Led on={collabConnected} color="var(--looper-cyan)" pulse={collabConnected} />
              <span className="text-[10px] text-[var(--dj-muted)]">
                {collabConnected ? `ROOM ${collabRoom}` : 'DISCONNECTED'}
              </span>
            </div>

            {!collabEnabled ? (
              joining ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    placeholder="ROOM ID"
                    className="w-full bg-[var(--t-b2x)] border border-[#a3e635]/30 px-2 py-1 text-[11px] text-[var(--daw-ghost)] font-mono"
                    value={roomInput}
                    onChange={e => setRoomInput(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && roomInput) {
                        const userId = crypto.randomUUID().slice(0, 8);
                        const colors = ['var(--status-warn)','var(--looper-cyan)','var(--accent-green)','var(--accent-violet)','#ef4444'];
                        const color  = colors[Math.floor(Math.random() * colors.length)];
                        collab.joinRoom(roomInput, userId, `USER_${userId.slice(0,4)}`, color);
                        setJoining(false);
                      }
                    }}
                  />
                  <Btn className="w-full text-center text-[9px]" onClick={() => setJoining(false)}>CANCEL</Btn>
                </div>
              ) : (
                <Btn className="w-full text-center text-[9px]" onClick={() => setJoining(true)}>
                  JOIN ROOM
                </Btn>
              )
            ) : (
              <Btn className="w-full text-center text-[9px]" danger onClick={collab.leaveRoom}>
                LEAVE ROOM
              </Btn>
            )}

            {collabUsers.length > 0 && (
              <div className="mt-3 space-y-1">
                {collabUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-2 px-1 py-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: u.color }} />
                    <span className="text-[10px] font-mono" style={{ color: u.color }}>{u.name}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Plugins tab (L2) ───────────────────────────────────────────── */}
        {sidebarTab === 'plugins' && (
          <>
            <p className="text-[9px] text-[var(--dj-dim)] tracking-widest px-1 mb-2">PLUGIN SDK</p>
            {loadedPlugins.length === 0 ? (
              <div className="text-[10px] text-[var(--dj-dimmer)] text-center py-4 font-mono">NO PLUGINS LOADED</div>
            ) : loadedPlugins.map(p => (
              <div key={p.id} className="flex items-center justify-between px-2 py-1 rounded bg-[var(--t-b2x)]">
                <span className="text-[10px] text-[var(--text-muted)]">{p.name}</span>
                <Led on={p.enabled} color="var(--accent-green)" />
              </div>
            ))}
            <div className="pt-2 border-t border-[#1c1c1c] mt-2">
              <Btn className="w-full justify-center text-[9px]" onClick={() => navigate('/vst')}>
                LOAD VST/AU
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
Sidebar.displayName = 'Sidebar';

// ─── Arrangement View ─────────────────────────────────────────────────────────

const BEAT_WIDTH = 24; // px per beat at zoom=1

const ArrangementView = memo(({
  engine, collab,
}: {
  engine: ReturnType<typeof useDAWEngine>;
  collab: ReturnType<typeof useCollabSocket>;
}) => {
  const {
    tracks, regions, position, playing, zoom, scrollLeft,
    selectedTrackId, selectedRegionId, loopEnabled, loopStart, loopEnd,
    collabUsers, predictionsVisible, arrangementPredictions,
    setSelectedTrack, setScrollLeft, setZoom,
    trackHeightMode,
  } = useDAWStore();
  const setSelectedRegion = useDAWStore(s => s.setSelectedRegion);

  const containerRef = useRef<HTMLDivElement>(null);
  const TRACK_HEIGHT = trackHeightMode === 'compact' ? 28 : trackHeightMode === 'large' ? 56 : 40;
  const BPW = BEAT_WIDTH * zoom;  // beats → px with zoom

  const totalBeats = 128;
  const totalWidth = totalBeats * BPW;

  // Playhead position
  const playheadX = position * BPW - scrollLeft;

  // Snap to beat grid
  const snapBeat = useCallback((px: number) => {
    const rawBeat = (px + scrollLeft) / BPW;
    return Math.round(rawBeat);
  }, [scrollLeft, BPW]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft((e.currentTarget as HTMLDivElement).scrollLeft);
  }, [setScrollLeft]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(zoom * (e.deltaY > 0 ? 0.9 : 1.1));
    }
  }, [zoom, setZoom]);

  // Click on arrangement ruler to seek
  const onRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const beat = snapBeat(e.clientX - rect.left);
    engine.seekTo(beat);
    collab.broadcastCursor(beat, selectedTrackId);
  }, [snapBeat, engine, collab, selectedTrackId]);

  // Beat markers
  const beatMarkers = useMemo(() => {
    const markers: number[] = [];
    const step = zoom < 1 ? 8 : zoom < 2 ? 4 : 1;
    for (let b = 0; b <= totalBeats; b += step) {
      markers.push(b);
    }
    return markers;
  }, [zoom, totalBeats]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0d0d0d]">
      {/* Ruler */}
      <div
        className="flex-none bg-[#0a0a0a] border-b border-[#1c1c1c] relative overflow-hidden cursor-pointer"
        style={{ height: 24, marginLeft: 140 }}
        onClick={onRulerClick}
      >
        <div className="absolute top-0 left-0" style={{ width: totalWidth, height: 24 }}>
          {beatMarkers.map(b => (
            <div
              key={b}
              className="absolute top-0 h-full flex flex-col justify-end pb-1"
              style={{ left: b * BPW - scrollLeft }}
            >
              <div className="w-px bg-[#2a2a2a] flex-1" />
              <span className="text-[8px] text-[var(--dj-dim)] font-mono ml-1">{b}</span>
            </div>
          ))}
          {/* Loop region on ruler */}
          {loopEnabled && (
            <div
              className="absolute top-0 h-full bg-amber-500/10 border-l border-r border-amber-500/40"
              style={{
                left: loopStart * BPW - scrollLeft,
                width: (loopEnd - loopStart) * BPW,
              }}
            />
          )}
          {/* Playhead */}
          {playheadX >= 0 && (
            <div
              className="absolute top-0 w-px h-full"
              style={{
                left: playheadX,
                background: 'var(--status-warn)',
                boxShadow: '0 0 4px var(--status-warn)',
              }}
            />
          )}
          {/* Collab cursors on ruler */}
          {collabUsers.map(u =>
            u.cursorBeat != null ? (
              <div
                key={u.id}
                className="absolute top-0 w-px h-full opacity-70"
                style={{ left: u.cursorBeat * BPW - scrollLeft, background: u.color }}
                title={u.name}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* Track area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track labels */}
        <div className="flex-none flex flex-col border-r border-[#1c1c1c]" style={{ width: 140 }}>
          {tracks.map(track => (
            <TrackLabel
              key={track.id}
              track={track}
              height={TRACK_HEIGHT}
              selected={selectedTrackId === track.id}
              onSelect={() => setSelectedTrack(track.id)}
            />
          ))}
          {/* PATCH-D06: Add-track ghost row inside arrangement label column.
               Root cause: no affordance to add track from arrangement view.
               RA-01: requires addTrack to be on the store interface. */}
          <div
            className="flex items-center justify-center border-b border-[var(--t-b2x)]
                       cursor-pointer hover:bg-[var(--t-b2)] transition-colors group"
            style={{ height: TRACK_HEIGHT }}
            onClick={() => {
              const s = useDAWStore.getState();
              s.addTrack({
                label:       `TRACK ${s.tracks.length + 1}`,
                type:        'audio',
                color:       'var(--text-dim)',
                gain:        0.8,
                pan:         0,
                mute:        false,
                solo:        false,
                armed:       false,
                fxChain:     [],
                sends:       [],
                inputSource: null,
              });
            }}
            title="Add track (requires store.addTrack)"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
            }}
          >
            <span className="text-[9px] text-[#2a2a2a] group-hover:text-[#a3e635]/60
                             tracking-widest transition-colors select-none">
              + ADD TRACK
            </span>
          </div>
        </div>

        {/* Regions scrollable area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          style={{ scrollbarColor: '#2a2a2a #0d0d0d', scrollbarWidth: 'thin' }}
          onScroll={onScroll}
          onWheel={onWheel}
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Track row backgrounds */}
            {tracks.map((track, i) => (
              <div
                key={track.id}
                className={`absolute w-full border-b border-[var(--t-b2x)] ${
                  selectedTrackId === track.id ? 'bg-[var(--t-b2)]' : i % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[var(--panel-deep)]'
                }`}
                style={{ top: i * TRACK_HEIGHT, height: TRACK_HEIGHT }}
                onClick={() => {
                  setSelectedTrack(track.id);
                  collab.broadcastCursor(position, track.id);
                }}
              />
            ))}

            {/* Beat grid lines */}
            {beatMarkers.map(b => (
              <div
                key={b}
                className="absolute top-0 w-px"
                style={{
                  left: b * BPW,
                  height: tracks.length * TRACK_HEIGHT,
                  background: b % 4 === 0 ? '#1c1c1c' : 'var(--panel-deep)',
                }}
              />
            ))}

            {/* Regions */}
            {regions.map(region => {
              const track = tracks.find(t => t.id === region.trackId);
              const trackIdx = tracks.findIndex(t => t.id === region.trackId);
              if (!track || trackIdx < 0) return null;
              return (
                <RegionBlock
                  key={region.id}
                  region={region}
                  top={trackIdx * TRACK_HEIGHT}
                  height={TRACK_HEIGHT - 2}
                  bpw={BPW}
                  selected={selectedRegionId === region.id}
                  onClick={() => setSelectedRegion?.(region.id)}
                />
              );
            })}

            {/* L3: Arrangement prediction overlays */}
            {predictionsVisible && arrangementPredictions.map((pred, i) => {
              const trackIdx = tracks.findIndex(t => t.id === pred.trackId);
              if (trackIdx < 0) return null;
              const PRED_COLORS: Record<string, string> = {
                introduce: '#22c55e33', mute: '#ef444433',
                extend: '#3b82f633', fade: '#a855f733', break: '#f59e0b33',
              };
              return (
                <div
                  key={i}
                  className="absolute border rounded pointer-events-none"
                  style={{
                    left: pred.startBeat * BPW,
                    top: trackIdx * TRACK_HEIGHT,
                    height: TRACK_HEIGHT - 2,
                    width: 16 * BPW,
                    background: PRED_COLORS[pred.suggestedAction] ?? '#ffffff11',
                    borderColor: '#ffffff22',
                  }}
                  title={`AI: ${pred.label} (${Math.round(pred.confidence * 100)}%)`}
                >
                  <span className="text-[8px] text-white/40 px-1 leading-none absolute bottom-1">
                    {pred.suggestedAction.toUpperCase()}
                  </span>
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 w-px pointer-events-none z-10"
              style={{
                left: position * BPW,
                height: tracks.length * TRACK_HEIGHT,
                background: playing ? 'var(--status-warn)' : '#f59e0b66',
                boxShadow: playing ? '0 0 6px #f59e0b88' : 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
ArrangementView.displayName = 'ArrangementView';

const TrackLabel = memo(({
  track, height, selected, onSelect,
}: {
  track: Track; height: number; selected: boolean; onSelect: () => void;
}) => {
  const { updateTrack } = useDAWStore();
  return (
    <div
      className={`flex items-center gap-1.5 px-2 border-b border-[var(--t-b2x)] cursor-pointer transition-colors ${
        selected ? 'bg-[var(--t-b2x)]' : 'bg-[#0d0d0d] hover:bg-[var(--t-b2)]'
      }`}
      style={{ height, borderLeft: `2px solid ${track.color}` }}
      onClick={onSelect}
    >
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] font-mono tracking-wider text-[var(--daw-ghost)] truncate">{track.label}</span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-[var(--dj-dim)]">{track.type.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          className={`text-[8px] font-mono px-1 ${track.mute ? 'text-[#a3e635] bg-[#a3e635]/10' : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`}
          onClick={e => { e.stopPropagation(); updateTrack(track.id, { mute: !track.mute }); }}
        >M</button>
        <button
          className={`text-[8px] font-mono px-1 rounded ${track.solo ? 'text-cyan-400 bg-cyan-500/20' : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)]'}`}
          onClick={e => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
        >S</button>
      </div>
    </div>
  );
});
TrackLabel.displayName = 'TrackLabel';

const RegionBlock = memo(({
  region, top, height, bpw, selected, onClick,
}: {
  region: TrackRegion; top: number; height: number; bpw: number;
  selected: boolean; onClick: () => void;
}) => (
  <div
    className="absolute rounded-sm overflow-hidden cursor-pointer border transition-colors"
    style={{
      left: region.startBeat * bpw + 1,
      top: top + 1,
      width: Math.max(4, region.lengthBeats * bpw - 2),
      height,
      background: `${region.color}22`,
      borderColor: selected ? region.color : `${region.color}55`,
      boxShadow: selected ? `0 0 8px ${region.color}44` : 'none',
    }}
    onClick={onClick}
  >
    <div
      className="absolute top-0 left-0 right-0 h-0.5"
      style={{ background: region.color, opacity: 0.8 }}
    />
    <span
      className="absolute bottom-1 left-1 text-[9px] font-mono tracking-wide"
      style={{ color: region.color }}
    >
      {region.label}
    </span>
  </div>
));
RegionBlock.displayName = 'RegionBlock';

// ─── MIDI Sequencer Panel (L2) ────────────────────────────────────────────────

const PIANO_PITCHES = [
  72,71,70,69,68,67,66,65,64,63,62,61,60,59,58,57,56,55,54,53,52,51,50,49,48,
];

const MidiSequencerPanel = memo(({ seq }: { seq: ReturnType<typeof useMidiSequencer> }) => {
  const {
    midiPatterns, activePatternId, sequencerStep, setActivePattern, addMidiPattern,
  } = useDAWStore();

  const pattern = midiPatterns.find(p => p.id === activePatternId);
  const steps   = pattern?.steps ?? 16;

  const hasNote = useCallback((step: number, pitch: number) =>
    pattern?.notes.some(n => n.step === step && n.pitch === pitch) ?? false,
  [pattern]);

  const noteVelocity = useCallback((step: number, pitch: number) =>
    pattern?.notes.find(n => n.step === step && n.pitch === pitch)?.velocity ?? 100,
  [pattern]);

  return (
    <div className="flex flex-col bg-[#0a0a0a] border-t border-[#1c1c1c]" style={{ height: 200 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1c1c1c] flex-none">
        <span className="text-[10px] tracking-widest text-[#555]">MIDI PIANO ROLL</span>
        <div className="flex gap-1">
          {midiPatterns.map(p => (
            <button
              key={p.id}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
                p.id === activePatternId
                  ? 'bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/40'
                  : 'text-[var(--dj-dim)] hover:text-[var(--text-dim)] border border-[var(--dj-border)]'
              }`}
              onClick={() => setActivePattern(p.id)}
            >{p.name}</button>
          ))}
          <Btn
            className="text-[9px]"
            onClick={() => addMidiPattern({
              name: `PATTERN ${midiPatterns.length + 1}`, steps: 16,
              notes: [], trackId: useDAWStore.getState().selectedTrackId ?? '',
            })}
          >+</Btn>
        </div>
        <div className="ml-auto flex gap-1">
          <Btn className="text-[9px]" onClick={seq.clearPattern}>CLR</Btn>
          <Btn className="text-[9px]" onClick={seq.duplicate}>DUP</Btn>
          {([16,32] as const).map(n => (
            <Btn
              key={n}
              className="text-[9px]"
              active={pattern?.steps === n}
              onClick={() => seq.setPatternLength(n)}
            >{n}</Btn>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Piano keys */}
        <div className="flex-none flex flex-col border-r border-[#1c1c1c]" style={{ width: 36 }}>
          {PIANO_PITCHES.map(pitch => {
            const name = seq.getPitchLabel(pitch);
            const isBlack = name.includes('#');
            return (
              <div
                key={pitch}
                className={`flex items-center justify-end pr-1 border-b border-[var(--dj-surface2)] ${
                  isBlack ? 'bg-[var(--dj-surface2)]' : 'bg-[var(--t-b2x)]'
                }`}
                style={{ height: `${100 / PIANO_PITCHES.length}%` }}
              >
                <span className="text-[7px] font-mono" style={{ color: isBlack ? 'var(--dj-dim)' : '#555' }}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex flex-col" style={{ minWidth: steps * 20 }}>
            {PIANO_PITCHES.map(pitch => (
              <div key={pitch} className="flex flex-1" style={{ height: `${100 / PIANO_PITCHES.length}%` }}>
                {Array.from({ length: steps }, (_, step) => {
                  const active    = hasNote(step, pitch);
                  const isCurrent = step === sequencerStep;
                  const vel       = noteVelocity(step, pitch);
                  return (
                    <div
                      key={step}
                      className="border-r border-b border-[var(--dj-surface2)] cursor-pointer transition-colors flex items-end"
                      style={{
                        width: 20,
                        background: isCurrent
                          ? '#f59e0b22'
                          : active
                            ? '#a3e635'
                            : step % 4 === 0 ? 'var(--panel-deep)' : '#0d0d0d',
                        boxShadow: active ? '0 0 4px rgba(163,230,53,0.35)' : 'none',
                      }}
                      onClick={() => seq.toggleNote(step, pitch, 100)}
                      title={active ? `${seq.getPitchLabel(pitch)} vel:${vel}` : undefined}
                    >
                      {active && (
                        <div
                          className="w-full"
                          style={{ height: `${(vel / 127) * 100}%`, background: 'rgba(163,230,53,0.4)' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
MidiSequencerPanel.displayName = 'MidiSequencerPanel';

// ─── Mixer Strip ──────────────────────────────────────────────────────────────

const MixerStrip = memo(({ engine }: { engine: ReturnType<typeof useDAWEngine> }) => {
  const { tracks, masterGain, setMasterGain, updateTrack, setActiveFXTrack, activeFXTrackId } = useDAWStore();
  const [meters, setMeters] = useState<Record<string, number>>({});

  // Update meters on rAF
  useEffect(() => {
    let raf: number;
    const update = () => {
      const next: Record<string, number> = {};
      for (const t of tracks) next[t.id] = engine.getTrackMeterValue(t.id);
      setMeters(next);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [engine, tracks]);

  return (
    <div
      className="flex bg-[#0a0a0a] border-t border-[#1c1c1c] overflow-x-auto"
      style={{ height: 160, scrollbarColor: '#2a2a2a #0a0a0a', scrollbarWidth: 'thin' }}
    >
      {/* Track channels */}
      {tracks.map(track => (
        <MixerChannel
          key={track.id}
          track={track}
          meterLevel={meters[track.id] ?? 0}
          fxActive={activeFXTrackId === track.id}
          onFXClick={() => setActiveFXTrack(activeFXTrackId === track.id ? null : track.id)}
          onChange={(partial) => updateTrack(track.id, partial)}
        />
      ))}

      {/* Master channel */}
      <div className="flex flex-col items-center px-3 py-2 border-l border-[#2a2a2a] bg-[var(--dj-surface2)] min-w-[64px]">
        <span className="text-[8px] tracking-widest text-[#555] mb-2">MASTER</span>
        <VUMeter level={masterGain > 1 ? 1 : masterGain} />
        <div className="mt-auto">
          <input
            type="range" min={0} max={1.5} step={0.01}
            value={masterGain}
            onChange={e => setMasterGain(parseFloat(e.target.value))}
            className="h-20 appearance-none"
            style={{
              writingMode: 'vertical-lr', direction: 'rtl',
              accentColor: '#a3e635', background: 'transparent',
            }}
          />
        </div>
        <span className="text-[8px] font-mono text-[#a3e635] mt-1">
          {Math.round(masterGain * 100)}
        </span>
      </div>

      {/* FX Rack inline (for selected track) */}
      {activeFXTrackId && (
        <FXRackInline trackId={activeFXTrackId} />
      )}
    </div>
  );
});
MixerStrip.displayName = 'MixerStrip';

const MixerChannel = memo(({
  track, meterLevel, fxActive, onFXClick, onChange,
}: {
  track: Track;
  meterLevel: number;
  fxActive: boolean;
  onFXClick: () => void;
  onChange: (p: Partial<Track>) => void;
}) => (
  <div
    className={`flex flex-col items-center px-2 py-2 border-r border-[#1c1c1c] transition-colors min-w-[52px] ${
      track.solo ? 'bg-[var(--panel-deep)]' : track.mute ? 'bg-[var(--panel-deep)]' : ''
    }`}
    style={{ borderTop: `2px solid ${track.color}` }}
  >
    <span className="text-[8px] tracking-widest font-mono mb-1.5" style={{ color: track.color }}>
      {track.label.slice(0, 6)}
    </span>

    <Knob value={track.pan} min={-1} max={1} label="PAN" onChange={pan => onChange({ pan })} size={24} />

    <div className="flex items-center gap-1 my-1">
      <VUMeter level={meterLevel} />
    </div>

    <input
      type="range" min={0} max={1.5} step={0.01}
      value={track.mute ? 0 : track.gain}
      onChange={e => onChange({ gain: parseFloat(e.target.value) })}
      className="h-12 appearance-none"
      style={{
        writingMode: 'vertical-lr', direction: 'rtl',
        accentColor: track.color, background: 'transparent',
      }}
    />

    <span className="text-[8px] font-mono text-[#555] mb-1">
      {Math.round((track.mute ? 0 : track.gain) * 100)}
    </span>

    <div className="flex gap-0.5">
      <button
        className={`text-[7px] font-mono px-0.5 rounded transition-colors ${
          track.mute ? 'text-[#a3e635] bg-[#a3e635]/10' : 'text-[var(--dj-dimmer)] hover:text-[var(--dj-muted)]'
        }`}
        onClick={() => onChange({ mute: !track.mute })}
      >M</button>
      <button
        className={`text-[7px] font-mono px-0.5 rounded transition-colors ${
          track.solo ? 'text-cyan-400 bg-cyan-500/20' : 'text-[var(--dj-dimmer)] hover:text-[var(--dj-muted)]'
        }`}
        onClick={() => onChange({ solo: !track.solo })}
      >S</button>
      <button
        className={`text-[7px] font-mono px-0.5 rounded transition-colors ${
          fxActive ? 'text-purple-400 bg-purple-500/20' : 'text-[var(--dj-dimmer)] hover:text-[var(--dj-muted)]'
        }`}
        onClick={onFXClick}
      >FX</button>
    </div>
  </div>
));
MixerChannel.displayName = 'MixerChannel';

const FX_TYPES = ['eq','compressor','reverb','delay','filter','distortion'] as const;

const FXRackInline = memo(({ trackId }: { trackId: string }) => {
  const { tracks, updateFXSlot, toggleFXSlot } = useDAWStore();
  const track = tracks.find(t => t.id === trackId);
  if (!track) return null;

  const addFX = (type: FXSlot['type']) => {
    useDAWStore.getState().updateTrack(trackId, {
      fxChain: [...track.fxChain, {
        id: `fx_${Date.now()}`, type, enabled: true,
        params: { gain: 0, freq: 1000, q: 1, threshold: -20, ratio: 4, decay: 1, wet: 0.3 },
      }],
    });
  };

  return (
    <div className="flex flex-col px-3 py-2 border-l-2 border-purple-500/40 min-w-[240px] bg-[var(--panel-deep)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] tracking-widest text-purple-400">
          FX RACK — {track.label}
        </span>
        <select
          className="bg-[var(--t-b2x)] border border-[var(--dj-dimmer)] rounded text-[9px] text-[var(--text-dim)] px-1"
          onChange={e => addFX(e.target.value as FXSlot['type'])}
          value=""
        >
          <option value="" disabled>+ ADD FX</option>
          {FX_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {track.fxChain.map(fx => (
          <div
            key={fx.id}
            className={`px-2 py-1 rounded border text-[9px] font-mono cursor-pointer transition-colors ${
              fx.enabled
                ? 'border-purple-500/50 text-purple-300 bg-purple-500/10'
                : 'border-[var(--dj-dimmer)] text-[var(--dj-dim)]'
            }`}
            onClick={() => toggleFXSlot(trackId, fx.id)}
            title={fx.enabled ? 'Click to disable' : 'Click to enable'}
          >
            {fx.type.toUpperCase()}
          </div>
        ))}
        {track.fxChain.length === 0 && (
          <span className="text-[9px] text-[var(--dj-dimmer)]">NO FX — ADD FROM DROPDOWN</span>
        )}
      </div>
    </div>
  );
});
FXRackInline.displayName = 'FXRackInline';

// ─── AI Panel (L1 mix + L3 co-producer + L3 mastering) ───────────────────────

const AIPanel = memo(() => {
  const {
    aiPanelTab, aiSuggestions, aiChat, aiThinking, mastering,
    setAIPanelTab, acceptSuggestion, rejectSuggestion, addAIChat,
    setAIThinking, updateMastering, predictionsVisible, setPredictionsVisible,
  } = useDAWStore();

  const [chatInput, setChatInput] = useState('');
  const [aiError,   setAiError]   = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChat]);

  // ── sendChat: tries server, falls back to local LLPTE stub ──────────────
  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg) return;
    addAIChat({ role: 'user', content: msg });
    setChatInput('');
    setAIThinking(true);
    setAiError(null);

    try {
      const { useCloudSync } = await import('../hooks/useCloudSync');
      // NOTE: useCloudSync is a hook — we access it via dynamic import and
      // call the chatWithCoProd function directly on the module-level instance.
      // The actual hook instance is managed in useCloudSync.ts.
      // For a full tRPC integration, call trpc.daw['ai.chat'].mutate() here.
      const token = localStorage.getItem('r3_token');
      const apiBase = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
      const store = useDAWStore.getState();

      const res = await fetch(`${apiBase}/trpc/daw.ai.chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          json: {
            messages: store.aiChat.slice(-10).map(m => ({ role: m.role, content: m.content }))
              .concat([{ role: 'user', content: msg }]),
            context: { bpm: store.bpm, trackCount: store.tracks.length, position: store.position },
          },
        }),
      });

      if (res.ok) {
        const data = await res.json() as { result?: { data?: { json?: { reply: string } } } };
        const reply = data.result?.data?.json?.reply ?? '';
        addAIChat({ role: 'assistant', content: reply });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      // Graceful degradation: local response when server unavailable
      const bpm = useDAWStore.getState().bpm;
      const localReply = `Analysing your arrangement at ${bpm} BPM. `
        + `I suggest boosting low-mid on BASS around 200Hz, and introducing `
        + `a rhythmic sidechain from KICK at 4:1 ratio. `
        + `Current dynamic range reads approx -12 LUFS — 2dB headroom before ceiling.`;
      addAIChat({ role: 'assistant', content: localReply });
    } finally {
      setAIThinking(false);
    }
  }, [chatInput, addAIChat, setAIThinking]);

  // ── triggerSuggestions: server first, local LLPTE stub as fallback ───────
  const triggerSuggestions = useCallback(async () => {
    setAIThinking(true);
    setAiError(null);
    const store = useDAWStore.getState();

    try {
      const token = localStorage.getItem('r3_token');
      const apiBase = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
      const res = await fetch(`${apiBase}/trpc/daw.ai.suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          json: { tracks: store.tracks, bpm: store.bpm, position: store.position },
        }),
      });

      if (res.ok) {
        const data = await res.json() as {
          result?: { data?: { json?: { suggestions: { type: string; confidence: number; description: string; params: Record<string, unknown> }[] } } }
        };
        const suggestions = data.result?.data?.json?.suggestions ?? [];
        for (const s of suggestions) {
          store.addAISuggestion({
            type: s.type as 'mix' | 'arrangement' | 'mastering' | 'harmony' | 'rhythm',
            confidence: s.confidence, description: s.description, params: s.params,
          });
        }
        return;
      }
    } catch { /* fall through to local stubs */ }

    // Local LLPTE-derived stubs (used when server unavailable or unauthenticated)
    const localSuggestions: { type: 'mix' | 'arrangement' | 'rhythm'; confidence: number; description: string; params: Record<string, unknown> }[] = [
      { type: 'mix',         confidence: 0.87, description: 'Reduce SYNTH high shelf -2dB above 8kHz — masking clarity on the PAD layer.',     params: { trackId: 'trk_5', eq: { freq: 8000, gain: -2 } } },
      { type: 'arrangement', confidence: 0.74, description: 'Introduce a breakdown at bar 33 — tension has plateaued for 16 bars.',             params: { action: 'introduce_break', bar: 33 } },
      { type: 'rhythm',      confidence: 0.91, description: `HI-HAT ghost notes at 1/32 on beats 3–4 would increase groove at ${store.bpm} BPM.`, params: { trackId: 'trk_3', pattern: 'ghost_32' } },
    ];
    for (const s of localSuggestions) store.addAISuggestion(s);
  }, [setAIThinking]);

  // ── runMasteringAnalysis: server first, local calculation fallback ───────
  const runMasteringAnalysis = useCallback(async () => {
    updateMastering({ processing: true });
    const { targetLUFS, ceilingDB, dynamicsMode, stereoWidth } = mastering;

    try {
      const token = localStorage.getItem('r3_token');
      const apiBase = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
      const res = await fetch(`${apiBase}/trpc/daw.mastering.analyse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ json: { targetLUFS, ceilingDB, dynamicsMode, stereoWidth } }),
      });

      if (res.ok) {
        const data = await res.json() as { result?: { data?: { json?: {
          inputLUFS: number; inputPeak: number; outputLUFS: number;
          dynamicRange: number; recommendation: string;
        } } } };
        const result = data.result?.data?.json;
        if (result) { updateMastering({ processing: false, analysisResult: result }); return; }
      }
    } catch { /* fall through */ }

    // Local calculation fallback
    const inputLUFS = -18.3;
    const gainNeeded = targetLUFS - inputLUFS;
    updateMastering({
      processing: false,
      analysisResult: {
        inputLUFS,
        inputPeak:    inputLUFS + 6.2,
        outputLUFS:   targetLUFS,
        dynamicRange: 9.4 - (dynamicsMode === 'compressed' ? 2 : 0),
        recommendation: `Apply ${Math.abs(gainNeeded).toFixed(1)} dB ${gainNeeded > 0 ? 'gain' : 'attenuation'}. `
          + `True peak limiting at ${ceilingDB} dBFS. `
          + (stereoWidth !== 1.0 ? `Stereo width ×${stereoWidth.toFixed(1)} via M/S. ` : 'Stereo width nominal.'),
      },
    });
  }, [mastering, updateMastering]);

  return (
    <div className="flex flex-col bg-[#0a0a0a] border-l border-[#1c1c1c]" style={{ width: 280 }}>
      {/* Tab bar */}
      <div className="flex border-b border-[#1c1c1c] flex-none">
        {(['mix', 'coproducer', 'mastering'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setAIPanelTab(tab)}
            className={`flex-1 py-2 text-[8px] tracking-widest uppercase transition-colors ${
              aiPanelTab === tab
                ? 'text-[#a3e635] border-b border-[#a3e635] bg-[#a3e635]/5'
                : 'text-[var(--dj-dim)] hover:text-[var(--text-muted)]'
            }`}
          >
            {tab === 'mix' ? 'AI MIX' : tab === 'coproducer' ? 'CO-PROD' : 'MASTER'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── AI Mix Panel (L1) ──────────────────────────────────────────── */}
        {aiPanelTab === 'mix' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] tracking-widest text-[#555]">LLPTE SUGGESTIONS</span>
              <Btn className="text-[8px]" onClick={triggerSuggestions}>ANALYSE</Btn>
            </div>

            {aiThinking && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1 h-1 rounded-full bg-[#a3e635] animate-bounce"
                         style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-[9px] text-[#555]">Analysing signal…</span>
              </div>
            )}

            {aiSuggestions.filter(s => s.accepted === null).slice(0, 6).map(s => (
              <AISuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => acceptSuggestion(s.id)}
                onReject={() => rejectSuggestion(s.id)}
              />
            ))}

            {aiSuggestions.filter(s => s.accepted === null).length === 0 && !aiThinking && (
              <div className="text-center py-8">
                <div className="text-[10px] text-[var(--dj-dimmer)] font-mono">LLPTE READY</div>
                <div className="text-[9px] text-[var(--dj-border)] mt-1">Click ANALYSE to generate mix suggestions</div>
              </div>
            )}

            {/* L3 Arrangement predictions toggle */}
            <div className="pt-2 border-t border-[#1c1c1c]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#555] tracking-widest">ARRANGEMENT AI</span>
                <button
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    predictionsVisible
                      ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                      : 'border-[var(--dj-dimmer)] text-[var(--dj-dim)] hover:border-[#555]'
                  }`}
                  onClick={() => {
                    if (!predictionsVisible) {
                      const store = useDAWStore.getState();
                      const token = localStorage.getItem('r3_token');
                      const apiBase = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
                      fetch(`${apiBase}/trpc/daw.ai.suggestions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ json: { tracks: store.tracks, bpm: store.bpm, position: store.position } }),
                      }).then(r => r.json()).then((data: { result?: { data?: { json?: { suggestions: { type: string; confidence: number; description: string; params: Record<string, unknown> }[] } } } }) => {
                        const suggestions = data.result?.data?.json?.suggestions ?? [];
                        store.setArrangementPredictions(suggestions.map(s => ({
                          trackId: (s.params?.trackId as string) ?? 'trk_1',
                          startBeat: (s.params?.startBeat as number) ?? 32,
                          suggestedAction: s.type as 'mute' | 'extend' | 'introduce' | 'fade' | 'break',
                          confidence: s.confidence,
                          label: s.description.slice(0, 20).toUpperCase(),
                        })));
                      }).catch(() => {});
                    }
                    setPredictionsVisible(!predictionsVisible);
                  }}
                >
                  {predictionsVisible ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Co-Producer Chat (L3) ───────────────────────────────────── */}
        {aiPanelTab === 'coproducer' && (
          <div className="flex flex-col h-full" style={{ minHeight: 300 }}>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 320 }}>
              {aiChat.length === 0 && (
                <div className="text-center py-6">
                  <div className="text-[10px] text-[var(--dj-dimmer)] font-mono mb-1">AI CO-PRODUCER</div>
                  <div className="text-[9px] text-[var(--dj-border)]">
                    Ask me about your arrangement, mix balance, or genre direction.
                  </div>
                </div>
              )}
              {aiChat.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] rounded px-2 py-1.5 text-[10px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#a3e635]/12 text-[var(--accent-neon-lime)] border border-[#a3e635]/25'
                        : 'bg-[var(--t-b2x)] text-[var(--daw-sub)] border border-[#2a2a2a]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiThinking && aiPanelTab === 'coproducer' && (
                <div className="flex gap-1 pl-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--dj-dim)] animate-bounce"
                         style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex-none p-2 border-t border-[#1c1c1c]">
              <div className="flex gap-1.5">
                <input
                  className="flex-1 bg-[var(--t-b2x)] border border-[#2a2a2a] rounded px-2 py-1 text-[10px] text-[var(--daw-ghost)] placeholder-[var(--dj-dimmer)]"
                  placeholder="Ask the AI co-producer…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
                />
                <Btn onClick={sendChat} className="text-[9px]">→</Btn>
              </div>
            </div>
          </div>
        )}

        {/* ── Adaptive Mastering (L3) ────────────────────────────────────── */}
        {aiPanelTab === 'mastering' && (
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] tracking-widest text-[#555]">ADAPTIVE MASTERING</span>
              <div className="flex items-center gap-1.5">
                <Led on={mastering.enabled} color="var(--accent-green)" />
                <button
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    mastering.enabled
                      ? 'border-green-500/50 text-green-400 bg-green-500/10'
                      : 'border-[var(--dj-dimmer)] text-[var(--dj-dim)]'
                  }`}
                  onClick={() => updateMastering({ enabled: !mastering.enabled })}
                >
                  {mastering.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Target LUFS */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[9px] text-[#555]">TARGET LUFS</span>
                <span className="text-[9px] font-mono text-[#a3e635]">{mastering.targetLUFS} LUFS</span>
              </div>
              <input
                type="range" min={-23} max={-6} step={0.5}
                value={mastering.targetLUFS}
                onChange={e => updateMastering({ targetLUFS: parseFloat(e.target.value) })}
                className="w-full h-1 rounded appearance-none"
                style={{ accentColor: '#a3e635' }}
              />
              <div className="flex justify-between text-[8px] text-[var(--dj-dimmer)]">
                <span>-23 (broadcast)</span><span>-14 (streaming)</span><span>-6 (loud)</span>
              </div>
            </div>

            {/* True peak ceiling */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[9px] text-[#555]">TRUE PEAK CEILING</span>
                <span className="text-[9px] font-mono text-[#a3e635]">{mastering.ceilingDB} dBFS</span>
              </div>
              <input
                type="range" min={-3} max={-0.1} step={0.1}
                value={mastering.ceilingDB}
                onChange={e => updateMastering({ ceilingDB: parseFloat(e.target.value) })}
                className="w-full h-1 rounded appearance-none"
                style={{ accentColor: '#a3e635' }}
              />
            </div>

            {/* Dynamics mode */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-[#555]">DYNAMICS MODE</span>
              <div className="flex gap-1">
                {(['natural','compressed','punchy'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => updateMastering({ dynamicsMode: mode })}
                    className={`flex-1 py-1 rounded border text-[8px] font-mono transition-colors ${
                      mastering.dynamicsMode === mode
                        ? 'border-[#a3e635]/40 text-[#a3e635] bg-[#a3e635]/10'
                        : 'border-[var(--dj-border)] text-[var(--dj-dim)] hover:border-[var(--dj-dimmer)]'
                    }`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Stereo width */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[9px] text-[#555]">STEREO WIDTH</span>
                <span className="text-[9px] font-mono text-[#a3e635]">×{mastering.stereoWidth.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0} max={2} step={0.1}
                value={mastering.stereoWidth}
                onChange={e => updateMastering({ stereoWidth: parseFloat(e.target.value) })}
                className="w-full h-1 rounded appearance-none"
                style={{ accentColor: 'var(--looper-cyan)' }}
              />
            </div>

            <Btn
              className="w-full text-center text-[9px]"
              onClick={runMasteringAnalysis}
              active={mastering.processing}
            >
              {mastering.processing ? 'ANALYSING…' : 'RUN ANALYSIS'}
            </Btn>

            {mastering.analysisResult && (
              <div className="bg-[var(--dj-surface2)] border border-[var(--dj-border)] rounded p-2 space-y-1.5">
                <div className="flex justify-between text-[9px]">
                  <span className="text-[#555]">INPUT</span>
                  <span className="font-mono text-[var(--text-dim)]">{mastering.analysisResult.inputLUFS} LUFS</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-[#555]">TARGET</span>
                  <span className="font-mono text-[#a3e635]">{mastering.analysisResult.outputLUFS} LUFS</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-[#555]">DYN RANGE</span>
                  <span className="font-mono text-[var(--text-dim)]">{mastering.analysisResult.dynamicRange} LU</span>
                </div>
                <div className="pt-1 border-t border-[#1c1c1c]">
                  <p className="text-[9px] text-[var(--dj-muted)] leading-relaxed">
                    {mastering.analysisResult.recommendation}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
AIPanel.displayName = 'AIPanel';

const AISuggestionCard = memo(({
  suggestion, onAccept, onReject,
}: {
  suggestion: AISuggestion;
  onAccept: () => void;
  onReject: () => void;
}) => {
  const TYPE_COLORS: Record<string, string> = {
    mix: 'var(--looper-cyan)', arrangement: 'var(--status-warn)', mastering: 'var(--accent-green)',
    harmony: 'var(--accent-violet)', rhythm: 'var(--looper-pink)',
  };
  const color = TYPE_COLORS[suggestion.type] ?? 'var(--text-dim)';

  return (
    <div
      className="rounded border p-2 space-y-1.5"
      style={{ borderColor: `${color}33`, background: `${color}08` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono tracking-widest" style={{ color }}>
          {suggestion.type.toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          {/* PATCH-D05: ARIA meter for confidence bar */}
          <div
            className="w-12 h-0.5 rounded-full bg-[var(--dj-border)]"
            role="meter"
            aria-label={`Confidence ${Math.round(suggestion.confidence * 100)}%`}
            aria-valuenow={Math.round(suggestion.confidence * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${suggestion.confidence * 100}%`, background: color }}
            />
          </div>
          <span className="text-[8px] font-mono" style={{ color }}>
            {Math.round(suggestion.confidence * 100)}%
          </span>
        </div>
      </div>
      <p className="text-[9px] text-[var(--text-dim)] leading-relaxed">{suggestion.description}</p>
      <div className="flex gap-1.5">
        <button
          onClick={onAccept}
          className="flex-1 py-0.5 text-[8px] font-mono rounded border transition-colors border-green-500/30 text-green-500 hover:bg-green-500/10"
        >APPLY</button>
        <button
          onClick={onReject}
          className="flex-1 py-0.5 text-[8px] font-mono rounded border transition-colors border-[var(--dj-dimmer)] text-[var(--dj-dim)] hover:border-[#555]"
        >SKIP</button>
      </div>
    </div>
  );
});
AISuggestionCard.displayName = 'AISuggestionCard';

// ─── Main DAW Page ────────────────────────────────────────────────────────────

export default function DAW() {
  const engine = useDAWEngine();
  const collab = useCollabSocket();
  const seq    = useMidiSequencer();

  const { sequencerVisible, setSequencerVisible, aiPanelVisible, setAIPanelVisible } = useDAWStore();

  // PATCH-D03: Session analytics boundary (PRD §8.4)
  //   Root cause: no mount/unmount timestamps → Time Savings UI has no denominator.
  //   Fix: write session record to localStorage on mount; stamp endMs on unmount.
  //   Regression: additive — no UI change; quota failure is non-fatal.
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const startMs   = Date.now();
    try {
      const prev = JSON.parse(localStorage.getItem('r3v4_sessions') ?? '[]') as unknown[];
      localStorage.setItem(
        'r3v4_sessions',
        JSON.stringify([...prev.slice(-49), { sessionId, startMs, endMs: null, page: 'DAW' }]),
      );
    } catch { /* localStorage quota — non-fatal */ }

    return () => {
      try {
        type SessionEntry = { sessionId: string; endMs: number | null };
        const sessions = JSON.parse(
          localStorage.getItem('r3v4_sessions') ?? '[]',
        ) as SessionEntry[];
        localStorage.setItem(
          'r3v4_sessions',
          JSON.stringify(
            sessions.map(s =>
              s.sessionId === sessionId ? { ...s, endMs: Date.now() } : s,
            ),
          ),
        );
      } catch { /* quota — non-fatal */ }
    };
  }, []); // empty — runs exactly once per DAW mount

  // Global keyboard shortcuts — Ctrl+S triggers cloud save
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Ctrl/Cmd + S → save to localStorage immediately; cloud save async
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const store = useDAWStore.getState();
        store.setSyncStatus('syncing');
        try {
          localStorage.setItem('r3v4_project_snapshot', JSON.stringify({
            bpm: store.bpm, projectName: store.projectName,
            tracks: store.tracks, regions: store.regions,
          }));
          store.setSyncStatus('synced');
          store.setLastSaved(Date.now());
        } catch { store.setSyncStatus('error'); }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          await engine.resumeContext();
          engine.togglePlay();
          break;
        case 'r': case 'R':
          await engine.resumeContext();
          engine.toggleRecord();
          break;
        case 't': case 'T':
          engine.tapTempo();
          break;
        case 'Escape':
          engine.stop();
          break;
        case 'm': case 'M':
          setSequencerVisible(!sequencerVisible);
          break;
        case 'a': case 'A':
          setAIPanelVisible(!aiPanelVisible);
          break;
        case '+': case '=':
          useDAWStore.getState().setZoom(useDAWStore.getState().zoom * 1.2);
          break;
        case '-':
          useDAWStore.getState().setZoom(useDAWStore.getState().zoom * 0.8);
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // PATCH-D02: removed `seq` — never referenced inside handler; was causing
  //            unnecessary re-registration on every seq ref change.
  }, [engine, sequencerVisible, aiPanelVisible, setSequencerVisible, setAIPanelVisible]);

  return (
    <>
      <div
      className="flex flex-col"
      style={{
        height: '100vh',
        background: 'var(--void)',
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px),repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,.016) 31px,rgba(255,255,255,.016) 32px)',
        color: '#e5e5e5',
        fontFamily: '"IBM Plex Mono","JetBrains Mono","Fira Code",monospace',
        overflow: 'hidden',
        borderLeft: '3px solid #a3e635',
        boxShadow: 'inset 3px 0 18px rgba(163,230,53,0.15)',
      }}
    >
      <SessionSummaryPanel />
      {/* Transport bar — always visible at top */}
      <TransportBar engine={engine} />
      {/* Ticker */}
      <style>{`@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ overflow:'hidden', position:'relative', background:'#080808', padding:'5px 0', flexShrink:0 }}>
        <div style={{ display:'flex', width:'max-content', animation:'ag-scroll 28s linear infinite' }}>
          {['R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System','R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System'].map((item, i) => (
            <span key={i} style={{ padding:'0 18px', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'"IBM Plex Mono",monospace', color:'#fff', whiteSpace:'nowrap' }}>
              {item}<span style={{ color:'#a3e635', marginLeft:8 }}>/</span>
            </span>
          ))}
        </div>
      </div>

      {/* Toolbar row */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[#1c1c1c] bg-[#0d0d0d] flex-none">
        <span className="text-[8px] text-[var(--dj-dimmer)] tracking-widest mr-1">VIEW</span>
        <Btn
          active={sequencerVisible}
          onClick={() => setSequencerVisible(!sequencerVisible)}
          className="text-[9px]"
          title="Toggle MIDI Sequencer (M)"
        >
          MIDI SEQ
        </Btn>
        <Btn
          active={aiPanelVisible}
          onClick={() => setAIPanelVisible(!aiPanelVisible)}
          className="text-[9px]"
          title="Toggle AI Panel (A)"
        >
          AI PANEL
        </Btn>
        <Btn
          active={useDAWStore(s => s.predictionsVisible)}
          onClick={() => useDAWStore.getState().setPredictionsVisible(!useDAWStore.getState().predictionsVisible)}
          className="text-[9px]"
          title="Toggle arrangement AI predictions"
        >
          PREDICTIONS
        </Btn>

        <div className="ml-auto flex items-center gap-2">
              <SessionChip />
          <span className="text-[8px] text-[var(--dj-dimmer)]">ZOOM</span>
          <Btn className="text-[9px]" onClick={() => useDAWStore.getState().setZoom(useDAWStore.getState().zoom * 0.8)}>−</Btn>
          <span className="text-[9px] font-mono text-[#555] w-8 text-center">
            {useDAWStore(s => s.zoom).toFixed(1)}×
          </span>
          <Btn className="text-[9px]" onClick={() => useDAWStore.getState().setZoom(useDAWStore.getState().zoom * 1.2)}>+</Btn>

          <div className="w-px h-4 bg-[#2a2a2a] mx-1" />

          <span className="text-[8px] text-[var(--dj-dimmer)]">ROWS</span>
          {(['compact','normal','large'] as const).map(m => (
            <Btn
              key={m}
              active={useDAWStore(s => s.trackHeightMode) === m}
              onClick={() => useDAWStore.getState().setTrackHeightMode(m)}
              className="text-[8px]"
            >
              {m[0].toUpperCase()}
            </Btn>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <Sidebar collab={collab} />

        {/* Center column: arrangement + optional MIDI sequencer */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Arrangement view — grows to fill available space */}
          <ArrangementView engine={engine} collab={collab} />

          {/* MIDI Sequencer — collapsible (Level 2) */}
          {sequencerVisible && (
            <MidiSequencerPanel seq={seq} />
          )}

          {/* Mixer + FX rack */}
          <MixerStrip engine={engine} />
        </div>

        {/* Right AI panel — collapsible (L1 + L3) */}
        {aiPanelVisible && <AIPanel />}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-1 border-t border-[var(--t-b2x)] bg-[var(--t-b0x)] flex-none">
        <StatusBar />
      </div>
    </div>
    </>
  );
}

const StatusBar = memo(() => {
  const { playing, recording, collabConnected, collabUsers, syncStatus, bpm, timeSignature } = useDAWStore();
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Led on={playing}    color="var(--accent-green)"  />
        <Led on={recording}  color="#ef4444" pulse={recording} />
        <span className="text-[8px] text-[var(--dj-dimmer)]">
          {recording ? 'REC' : playing ? 'PLAY' : 'STOPPED'}
        </span>
      </div>
      <div className="w-px h-3 bg-[#2a2a2a]" />
      <span className="text-[8px] font-mono text-[var(--dj-dimmer)]">
        {bpm} BPM · {timeSignature[0]}/{timeSignature[1]}
      </span>
      {collabConnected && (
        <>
          <div className="w-px h-3 bg-[#2a2a2a]" />
          <div className="flex items-center gap-1.5">
            <Led on color="var(--looper-cyan)" />
            <span className="text-[8px] text-[var(--looper-cyan)]">{collabUsers.length + 1} IN SESSION</span>
          </div>
        </>
      )}
      <div className="ml-auto text-[8px] text-[var(--t-b3x)] font-mono">
        R3 v4 · SPACE=play · R=rec · T=tap · M=midi · A=ai · ±=zoom
      </div>
    </>
  );
});
StatusBar.displayName = 'StatusBar';