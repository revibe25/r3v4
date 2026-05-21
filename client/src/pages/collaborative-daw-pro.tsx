// collaborative-daw-pro.tsx
// R3 v4 — Collaborative DAW Pro
// Enhanced v2.0 — Acid Grid design system, LLPTE integration, full TypeScript
// Route: /collab (App.tsx)

import { PageNav } from '@/components/page-nav';
import React, {
  useState, useRef, useEffect, useCallback, useMemo, memo, lazy, Suspense
} from 'react';
import {
  Play, Pause, Square, Plus, ZoomIn, ZoomOut, SkipBack,
  User, Download, Upload, Settings, Save, Share2, Undo2, Redo2,
  Grid3x3, Mic, Volume2, VolumeX, Activity, Wifi, WifiOff,
  ChevronUp, ChevronDown, Copy, Trash2, Layers, Sliders, X,
  AlertCircle, CheckCircle, Zap, Radio, Lock, Unlock, Music, Repeat2,
} from 'lucide-react';

// ── Lazy panels ───────────────────────────────────────────────────────────────────────────
const VSTBrowser     = lazy(() => import('@/components/vst-browser').then(m => ({ default: m.VSTBrowser })));
const LoopStation505 = lazy(() => import('@/features/loopstation/LoopStation505').then(m => ({ default: m.LoopStation505 })));

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackType = 'audio' | 'midi' | 'bus';
type TransportMode = 'stopped' | 'playing' | 'paused' | 'recording';
type CollabStatus = 'active' | 'idle' | 'offline';
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
// PRD §12 aiDecisionLog.outcome: 'auto_applied' | 'accepted' | 'rejected' | 'ignored' | 'discarded'
type LLPTEDecision = 'auto_applied' | 'accepted' | 'rejected' | 'ignored' | 'discarded';

interface Send { busId: string; level: number; }

interface Track {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  armed: boolean;
  type: TrackType;
  sends: Send[];
  locked: boolean;
  fxChain: string[];
}

interface Clip {
  id: string;
  trackId: string;
  startBar: number;
  durationBars: number;
  name: string;
  gain: number;
  fadeIn: number;
  fadeOut: number;
  color?: string;
}

interface Marker {
  id: string;
  bar: number;
  name: string;
  color?: string;
}

interface Project {
  id: string;
  name: string;
  tempo: number;
  timeSignature: [number, number];
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
  status: CollabStatus;
  lastAction: string;
  timestamp: number;
  editingTrackId?: string;
}

interface Activity {
  id: number;
  user: string;
  action: string;
  timestamp: number;
  type: 'edit' | 'transport' | 'collab' | 'ai';
}

interface LLPTESuggestion {
  id: string;
  trackId: string;
  type: 'gain_adjust' | 'eq_suggest' | 'conflict_flag' | 'transition';
  confidence: number;
  displayedConfidence: number;
  decision: Record<string, unknown>;
  outcome: LLPTEDecision;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  void:          '#060606',
  space:         '#0a0a0a',
  surface:       '#0d0d0d',
  surfaceLift:   '#0f0f0f',
  surfaceHover:  'var(--dj-surface3)',
  border:        '#1c1c1c',
  borderBright:  '#2a2a2a',
  neon:          '#a3e635',
  neonGlow:      'rgba(163,230,53,0.5)',
  neonDim:       'rgba(163,230,53,0.08)',
  neonDim2:      'rgba(163,230,53,0.12)',
  acid2:         'var(--looper-lime)',
  cyan:          '#00F5FF',             // PRD §3 — active state cyan
  magenta:       '#ff3b3b',
  yellow:        '#ffcc00',
  purple:        'var(--accent-purple)',
  text:          '#f0f0f0',
  textMuted:     '#555555',
  textDim:       'var(--dj-dimmer)',
  tracks: [
    '#ff3b3b','#a3e635','#00F5FF','#ffcc00',
    '#b048f8','#ff6600','#06ffa5','#f72585','#0088ff','#f72585',
  ],
} as const;

const FONT = {
  display: '"Syne", sans-serif',
  mono:    '"IBM Plex Mono", monospace',
} as const;

const TL = {
  trackHeight:   88,
  rulerHeight:   44,
  headerWidth:   232,
  gridWidth:     112,
  beatsPerBar:   4,
  minZoom:       0.25,
  maxZoom:       5,
  snapThreshold: 6,
} as const;

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INIT_PROJECT: Project = {
  id:            `proj_${Date.now()}`,
  name:          'Untitled Session',
  tempo:         128,
  timeSignature: [4, 4],
  tracks: [
    { id:'t1', name:'Kick / Snare', color:C.tracks[0], muted:false, solo:false, volume:0.82, pan:0,    armed:false, type:'audio', sends:[], locked:false, fxChain:['Compressor','EQ'] },
    { id:'t2', name:'808 Bass',     color:C.tracks[1], muted:false, solo:false, volume:0.76, pan:0,    armed:false, type:'audio', sends:[], locked:false, fxChain:['Compressor','Limiter'] },
    { id:'t3', name:'Synth Lead',   color:C.tracks[2], muted:false, solo:false, volume:0.71, pan:0.2,  armed:false, type:'audio', sends:[], locked:false, fxChain:['Reverb','Delay'] },
    { id:'t4', name:'Vox Chop',     color:C.tracks[3], muted:false, solo:false, volume:0.88, pan:-0.1, armed:false, type:'audio', sends:[], locked:false, fxChain:['Reverb','EQ'] },
    { id:'t5', name:'Pad Texture',  color:C.tracks[4], muted:false, solo:false, volume:0.55, pan:0.3,  armed:false, type:'audio', sends:[], locked:false, fxChain:['Reverb'] },
  ],
  clips: [
    { id:'c1', trackId:'t1', startBar:0,  durationBars:4,  name:'Kick Pattern',   gain:1.0, fadeIn:0,    fadeOut:0   },
    { id:'c2', trackId:'t1', startBar:4,  durationBars:8,  name:'Full Drums',     gain:1.0, fadeIn:0.1,  fadeOut:0   },
    { id:'c3', trackId:'t2', startBar:2,  durationBars:10, name:'808 Bass',       gain:0.9, fadeIn:0,    fadeOut:0.2 },
    { id:'c4', trackId:'t3', startBar:8,  durationBars:4,  name:'Lead A',         gain:1.0, fadeIn:0,    fadeOut:0   },
    { id:'c5', trackId:'t3', startBar:12, durationBars:4,  name:'Lead Variation', gain:0.8, fadeIn:0,    fadeOut:0   },
    { id:'c6', trackId:'t4', startBar:4,  durationBars:12, name:'Verse 1',        gain:0.95,fadeIn:0.05, fadeOut:0.1 },
    { id:'c7', trackId:'t5', startBar:0,  durationBars:16, name:'Pad Atmos',      gain:0.6, fadeIn:0.5,  fadeOut:0.5 },
  ],
  markers: [
    { id:'m1', bar:0,  name:'INTRO',  color:C.neon },
    { id:'m2', bar:4,  name:'VERSE',  color:C.yellow },
    { id:'m3', bar:12, name:'CHORUS', color:C.cyan },
    { id:'m4', bar:20, name:'OUTRO',  color:C.magenta },
  ],
};

const INIT_COLLABS: Collaborator[] = [
  { id:'u1', name:'Alex Martinez', color:'#a3e635', cursor:{x:450,y:180}, status:'active', lastAction:'Editing "Full Drums"',  timestamp:Date.now()-30000,  editingTrackId:'t1' },
  { id:'u2', name:'Jordan Kim',    color:'#00F5FF', cursor:{x:780,y:320}, status:'active', lastAction:'Adjusting EQ',          timestamp:Date.now()-15000  },
  { id:'u3', name:'Sam Rivera',    color:'#ff3b3b', cursor:{x:580,y:240}, status:'idle',   lastAction:'Added marker',          timestamp:Date.now()-120000 },
];

const INIT_SUGGESTIONS: LLPTESuggestion[] = [
  { id:'s1', trackId:'t1', type:'gain_adjust',  confidence:0.87, displayedConfidence:0.87, decision:{gain:0.78}, outcome:'auto_applied', label:'Reduce kick gain −2dB' },
  { id:'s2', trackId:'t2', type:'conflict_flag', confidence:0.74, displayedConfidence:0.74, decision:{band:'80Hz'}, outcome:'ignored',     label:'Freq clash @ 80Hz with t1' },
  { id:'s3', trackId:'t3', type:'eq_suggest',   confidence:0.61, displayedConfidence:0.61, decision:{cut:'2kHz'}, outcome:'ignored',      label:'Cut 2kHz harshness −3dB' },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const barsToPixels = (bars: number, gw: number) => bars * gw;
const pixelsToBars = (px: number,   gw: number) => px / gw;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const formatTime = (bars: number, tempo: number, bpb: number): string => {
  const secs = (bars * bpb * 60) / tempo;
  const m    = Math.floor(secs / 60);
  const s    = Math.floor(secs % 60);
  const ms   = Math.floor((secs % 1) * 100);
  return `${m}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
};

const wfCache = new Map<string, number[]>();
const getWaveform = (id: string, pts: number): number[] => {
  const key = `${id}_${pts}`;
  if (!wfCache.has(key)) {
    const d: number[] = [];
    for (let i = 0; i < pts; i++) {
      const t = i / pts;
      d.push((Math.sin(t * Math.PI * 4 + Math.random()) * 0.6 + (Math.random()-0.5)*0.3) * Math.sin(t*Math.PI) * 0.85 + 0.08);
    }
    wfCache.set(key, d);
  }
  return wfCache.get(key)!;
};

const confidenceColor = (c: number): string => {
  if (c >= 0.65) return C.neon;
  if (c >= 0.40) return C.yellow;
  return C.magenta;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AgBtn = memo(({
  children, onClick, disabled=false, active=false,
  activeColor=C.neon, title, style: sx,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  active?: boolean;
  activeColor?: string;
  title?: string;
  style?: React.CSSProperties;
}) => (
  <button
    onClick={onClick} disabled={disabled} title={title}
    style={{
      background:     active ? activeColor : 'transparent',
      border:         `1px solid ${active ? activeColor : C.border}`,
      borderRadius:   0,
      color:          active ? C.void : C.text,
      padding:        '5px 9px',
      cursor:         disabled ? 'not-allowed' : 'pointer',
      display:        'flex', alignItems:'center', justifyContent:'center', gap:4,
      transition:     'background .07s, border-color .07s, color .07s',
      outline:        'none',
      opacity:        disabled ? 0.3 : 1,
      fontFamily:     FONT.mono,
      fontSize:       9,
      letterSpacing:  '.1em',
      textTransform:  'uppercase',
      whiteSpace:     'nowrap',
      boxShadow:      active ? `0 0 10px ${activeColor}66` : 'none',
      flexShrink:     0,
      ...sx,
    }}
    onMouseEnter={e => { if (!disabled && !active) { (e.currentTarget as HTMLButtonElement).style.background=C.neon; (e.currentTarget as HTMLButtonElement).style.borderColor=C.neon; (e.currentTarget as HTMLButtonElement).style.color=C.void; }}}
    onMouseLeave={e => { if (!disabled && !active) { (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor=C.border; (e.currentTarget as HTMLButtonElement).style.color=C.text; }}}
  >
    {children}
  </button>
));
AgBtn.displayName = 'AgBtn';

const AgLabel = ({ children, style: sx }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <span style={{ fontSize:8, letterSpacing:'.3em', textTransform:'uppercase', color:C.textMuted, fontFamily:FONT.mono, ...sx }}>
    {children}
  </span>
);

const Divider = () => (
  <div style={{ width:1, alignSelf:'stretch', background:C.border, margin:'0 4px', flexShrink:0 }} />
);

// VU Meter
const VUMeter = memo(({ level, color, peaked }: { level: number; color: string; peaked: boolean }) => (
  <div style={{ display:'flex', flexDirection:'column-reverse', gap:1, height:48, width:6 }}>
    {Array.from({length:12}).map((_,i) => {
      const threshold = i / 12;
      const lit       = level > threshold;
      const seg       = i > 9 ? C.magenta : i > 7 ? C.yellow : color;
      return (
        <div key={i} style={{
          flex:1, background: lit ? seg : C.border,
          boxShadow: lit && i > 9 ? `0 0 4px ${C.magenta}` : 'none',
          transition:'background .06s',
        }} />
      );
    })}
  </div>
));
VUMeter.displayName = 'VUMeter';

// LLPTE confidence badge
const _ConfBadge = ({ confidence, label }: { confidence: number; label: string }) => {
  const col = confidenceColor(confidence);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:5,
      padding:'3px 8px',
      background:`${col}10`,
      border:`1px solid ${col}44`,
      fontSize:8, fontFamily:FONT.mono, letterSpacing:'.1em',
    }}>
      <div style={{ width:5, height:5, background:col, boxShadow:`0 0 6px ${col}` }} />
      <span style={{ color:col, fontWeight:700 }}>{Math.round(confidence*100)}%</span>
      <span style={{ color:C.textMuted }}>{label}</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

// ── DAW Error Boundary ───────────────────────────────────────────────────────────────────────────
interface _DAWEBState { error: Error | null }
class DAWErrorBoundary extends React.Component<{ children: React.ReactNode }, _DAWEBState> {
  state: _DAWEBState = { error: null };
  static getDerivedStateFromError(e: Error): _DAWEBState { return { error: e }; }
  componentDidCatch(e: Error, _info: React.ErrorInfo): void {
    window.dispatchEvent(new CustomEvent('daw:error', { detail: { error: e } }));
  }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
                    background:'#030303', flexDirection:'column', gap:16,
                    fontFamily:'"IBM Plex Mono",monospace' }}>
        <span style={{ color:'#ff3b3b', fontSize:11, letterSpacing:'.2em' }}>DAW RENDER ERROR</span>
        <span style={{ color:'#555555', fontSize:9 }}>{this.state.error.message}</span>
        <button onClick={()=>this.setState({error:null})}
                style={{ marginTop:8, padding:'6px 16px', background:'#a3e635',
                         border:'none', cursor:'pointer', fontSize:9, letterSpacing:'.2em' }}>
          RESET
        </button>
      </div>
    );
    return this.props.children;
  }
}

export default function CollabDAWPro() {
  return <DAWErrorBoundary><CollabDAWProInner /></DAWErrorBoundary>;
}

function CollabDAWProInner() {

  const [project, setProject]                       = useState<Project>(INIT_PROJECT);
  const [transport, setTransport]                   = useState<TransportMode>('stopped');
  const [currentBar, setCurrentBar]                 = useState(0);
  const [zoom, setZoom]                             = useState(1);
  const [scrollLeft, setScrollLeft]                 = useState(0);
  const [scrollTop, setScrollTop]                   = useState(0);
  const [selectedClipIds, setSelectedClipIds]       = useState<string[]>([]);
  const [selectedTrackId, setSelectedTrackId]       = useState<string|null>(null);
  const [collaborators, setCollaborators]           = useState<Collaborator[]>(INIT_COLLABS);
  const [activities, setActivities]                 = useState<Activity[]>([
    { id:1, user:'You',           action:'Created session',    timestamp:Date.now()-300000, type:'collab' },
    { id:2, user:'Alex Martinez', action:'Joined session',     timestamp:Date.now()-240000, type:'collab' },
    { id:3, user:'Jordan Kim',    action:'Added "808 Bass"',   timestamp:Date.now()-180000, type:'edit'   },
  ]);
  const [showActivity, setShowActivity]             = useState(true);
  const [showMixer, setShowMixer]                   = useState(false);
  const [showAI, setShowAI]                         = useState(true);
  const [showVST, setShowVST]                       = useState(false);
  const [showLoopStation, setShowLoopStation]       = useState(false);
  const [connStatus, setConnStatus]                 = useState<ConnectionStatus>('connected');
  const [metronome, setMetronome]                   = useState(false);
  const [snapGrid, setSnapGrid]                     = useState(true);
  const [loopOn, setLoopOn]                         = useState(false);
  const [loopRegion, setLoopRegion]                 = useState({ start:0, end:16 });
  const [masterVol, setMasterVol]                   = useState(0.82);
  const [masterMuted, setMasterMuted]               = useState(false);
  const [hoveredClipId, setHoveredClipId]           = useState<string|null>(null);
  const [contextMenu, setContextMenu]               = useState<{x:number;y:number}|null>(null);
  const [history, setHistory]                       = useState<Project[]>([INIT_PROJECT]);
  const [historyIdx, setHistoryIdx]                 = useState(0);
  const [suggestions, setSuggestions]               = useState<LLPTESuggestion[]>(INIT_SUGGESTIONS);
  const [llpteLatency]                              = useState(10);
  const [cpuLoad, setCpuLoad]                       = useState(0.38);
  const [vuLevels, setVuLevels]                     = useState<Record<string,number>>({});
  const [peakedTracks, setPeakedTracks]             = useState<Set<string>>(new Set());
  const [toasts, setToasts]                         = useState<{id:number;msg:string;type:'ai'|'info'|'warn'}[]>([]);
  const [showSettings, setShowSettings]             = useState(false);
  const [, _tickTs]                                  = useState(0);

  const canvasRef         = useRef<HTMLCanvasElement|null>(null);
  const containerRef      = useRef<HTMLDivElement|null>(null);
  const rafRef            = useRef<number|null>(null);
  const startTimeRef      = useRef<number|null>(null);
  const lastRenderRef     = useRef(0);
  const dragRef = useRef<{
    clipId: string; origStartBar: number; origTrackId: string;
    startX: number; startY: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ clipId: string; startBar: number; trackId: string } | null>(null);

  const gridWidth = TL.gridWidth * zoom;

  // ── Toast helper ────────────────────────────────────────────────────────────
  const toast = useCallback((msg: string, type: 'ai'|'info'|'warn' = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, {id, msg, type}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Activity feed ───────────────────────────────────────────────────────────
  const addActivity = useCallback((action: string, user = 'You', type: Activity['type'] = 'edit') => {
    setActivities(p => [{id:Date.now(), user, action, timestamp:Date.now(), type}, ...p].slice(0,60));
  }, []);

  // ── Transport ────────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    setTransport('playing');
    startTimeRef.current = performance.now() - (currentBar * (60/project.tempo) * TL.beatsPerBar * 1000);
    addActivity('Started playback', 'You', 'transport');
  }, [currentBar, project.tempo, addActivity]);

  const pause = useCallback(() => {
    setTransport('paused');
    addActivity('Paused', 'You', 'transport');
  }, [addActivity]);

  const stop = useCallback(() => {
    setTransport('stopped');
    setCurrentBar(0);
    startTimeRef.current = null;
    addActivity('Stopped', 'You', 'transport');
  }, [addActivity]);

  const togglePlay = useCallback(() => {
    transport === 'playing' ? pause() : play();
  }, [transport, pause, play]);

  // Playback loop
  useEffect(() => {
    if (transport === 'playing') {
      const tick = () => {
        const elapsed    = performance.now() - (startTimeRef.current ?? performance.now());
        const bps        = project.tempo / 60;
        let bars         = (elapsed / 1000) / TL.beatsPerBar * bps;
        if (loopOn) {
          const len = loopRegion.end - loopRegion.start;
          while (bars >= loopRegion.end) {
            bars -= len;
            if (startTimeRef.current !== null)
              startTimeRef.current += (len * TL.beatsPerBar * 60 / project.tempo * 1000);
          }
        }
        setCurrentBar(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [transport, project.tempo, loopOn, loopRegion]);

  // CPU + VU simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(transport === 'playing' ? 0.35 + Math.random()*0.25 : 0.08 + Math.random()*0.1);
      if (transport === 'playing') {
        const levels: Record<string,number> = {};
        project.tracks.forEach(t => {
          if (t.muted) { levels[t.id] = 0; return; }
          levels[t.id] = clamp((Math.random()*0.7 + 0.2) * t.volume, 0, 1);
        });
        setVuLevels(levels);
        const peaked = new Set<string>(
          project.tracks
            .filter(t => !t.muted && (levels[t.id] ?? 0) > 0.93)
            .map(t => t.id)
        );
        if (peaked.size) {
          setPeakedTracks(prev => new Set([...prev, ...peaked]));
          setTimeout(() => setPeakedTracks(new Set()), 1500);
        }
      } else {
        const levels: Record<string,number> = {};
        project.tracks.forEach(t => { levels[t.id] = 0; });
        setVuLevels(levels);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [transport, project.tracks]);

  // Simulated collab activity
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.65) {
        const collab  = INIT_COLLABS[Math.floor(Math.random() * INIT_COLLABS.length)];
        const actions = ['Adjusted fader','Moved clip','Added FX','Muted track','Set loop'];
        const action  = actions[Math.floor(Math.random() * actions.length)];
        addActivity(action, collab.name, 'edit');
        setCollaborators(p => p.map(c =>
          c.id === collab.id
            ? { ...c, cursor:{x:200+Math.random()*800, y:80+Math.random()*400}, lastAction:action, timestamp:Date.now() }
            : c
        ));
      }
    }, 9000);
    return () => clearInterval(interval);
  }, [addActivity]);

  // ── Timestamp ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => _tickTs(n => n + 1), 8000);
    return () => clearInterval(id);
  }, []);

  // ── History ───────────────────────────────────────────────────────────────────
  const pushHistory = useCallback((next: Project) => {
    const h = history.slice(0, historyIdx + 1);
    h.push(next);
    setHistory(h);
    setHistoryIdx(h.length - 1);
    setProject(next);
  }, [history, historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      setHistoryIdx(i => i - 1);
      setProject(history[historyIdx - 1]);
      addActivity('Undo');
    }
  }, [history, historyIdx, addActivity]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(i => i + 1);
      setProject(history[historyIdx + 1]);
      addActivity('Redo');
    }
  }, [history, historyIdx, addActivity]);

  // ── Track ops ──────────────────────────────────────────────────────────────────
  const addTrack = useCallback(() => {
    const t: Track = {
      id: `t${Date.now()}`, name:`Track ${project.tracks.length+1}`,
      color: C.tracks[project.tracks.length % C.tracks.length],
      muted:false, solo:false, volume:0.8, pan:0, armed:false,
      type:'audio', sends:[], locked:false, fxChain:['EQ'],
    };
    pushHistory({ ...project, tracks:[...project.tracks, t] });
    addActivity(`Added track "${t.name}"`);
  }, [project, pushHistory, addActivity]);

  const _deleteTrack = useCallback((id: string) => {
    const t = project.tracks.find(x => x.id === id);
    pushHistory({ ...project, tracks:project.tracks.filter(x=>x.id!==id), clips:project.clips.filter(c=>c.trackId!==id) });
    addActivity(`Deleted "${t?.name}"`);
  }, [project, pushHistory, addActivity]);

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    pushHistory({ ...project, tracks:project.tracks.map(t => t.id===id ? {...t,...patch} : t) });
  }, [project, pushHistory]);

  const toggleMute = useCallback((id: string) => {
    const t = project.tracks.find(x=>x.id===id);
    if (!t) return;
    updateTrack(id, { muted: !t.muted });
    addActivity(`${t.muted?'Unmuted':'Muted'} "${t.name}"`);
  }, [project.tracks, updateTrack, addActivity]);

  const toggleSolo = useCallback((id: string) => {
    const t = project.tracks.find(x=>x.id===id);
    if (!t) return;
    updateTrack(id, { solo: !t.solo });
    addActivity(`${t.solo?'Unsoloed':'Soloed'} "${t.name}"`);
  }, [project.tracks, updateTrack, addActivity]);

  // ── Clip ops ──────────────────────────────────────────────────────────────────
  const deleteClip = useCallback((id: string) => {
    const c = project.clips.find(x=>x.id===id);
    pushHistory({ ...project, clips:project.clips.filter(x=>x.id!==id) });
    setSelectedClipIds(p => p.filter(x=>x!==id));
    addActivity(`Deleted "${c?.name}"`);
  }, [project, pushHistory, selectedClipIds, addActivity]);

  const duplicateClip = useCallback((id: string) => {
    const c = project.clips.find(x=>x.id===id);
    if (!c) return;
    const nc = { ...c, id:`c${Date.now()}`, startBar:c.startBar+c.durationBars, name:`${c.name} (Copy)` };
    pushHistory({ ...project, clips:[...project.clips, nc] });
    addActivity(`Duplicated "${c.name}"`);
  }, [project, pushHistory, addActivity]);

  const _updateClip = useCallback((id: string, patch: Partial<Clip>) => {
    pushHistory({ ...project, clips:project.clips.map(c => c.id===id ? {...c,...patch} : c) });
  }, [project, pushHistory]);

  // ── AI suggestion ops ──────────────────────────────────────────────────────────
  // TODO(collab-pro-tier): aiDecisionLog metrics not wired on this surface.
  //
  // Previous logSuggestionOutcome implementation called a deprecated tRPC
  // endpoint (aiMix.submitSuggestionOutcome) that never existed, AND passed
  // a local suggestion ID where the server expects an aiDecisionLog row ID.
  // Both bugs deleted.
  //
  // When Pro Artist collab tier ships, migrate to the canonical hook
  // `useMixSuggestions` (see client/src/hooks/useMixSuggestions.ts) — it
  // surfaces decisions via sessionMetrics.recordDecision and updates them
  // via sessionMetrics.recordOutcome with proper decisionId tracking.

  const acceptSuggestion = useCallback((id: string) => {
    const s = suggestions.find(x => x.id === id);
    if (!s) return;
    setSuggestions(p => p.map(x => x.id === id ? { ...x, outcome: 'accepted' as const } : x));
    setSuggestions(p => p.filter(x => x.id !== id));
    toast(`AI applied: ${s.label}`, 'ai');
    addActivity(`Accepted AI: ${s.label}`, 'You', 'ai');
  }, [suggestions, toast, addActivity]);

  const rejectSuggestion = useCallback((id: string) => {
    setSuggestions(p => p.map(x => x.id === id ? { ...x, outcome: 'rejected' as const } : x));
    setSuggestions(p => p.filter(x => x.id !== id));
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code==='Space')               { e.preventDefault(); togglePlay(); }
      if (e.code==='Escape')              { e.preventDefault(); stop(); }
      if (mod && e.code==='KeyZ' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && e.code==='KeyZ' &&  e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.code==='Delete'||e.code==='Backspace') && selectedClipIds.length) {
        e.preventDefault(); selectedClipIds.forEach(deleteClip);
      }
      if (mod && e.code==='KeyD' && selectedClipIds.length) { e.preventDefault(); selectedClipIds.forEach(duplicateClip); }
      if (mod && e.code==='KeyA') { e.preventDefault(); setSelectedClipIds(project.clips.map(c=>c.id)); }
      if (mod && e.code==='Equal') { e.preventDefault(); setZoom(z => Math.min(z+0.2, TL.maxZoom)); }
      if (mod && e.code==='Minus') { e.preventDefault(); setZoom(z => Math.max(z-0.2, TL.minZoom)); }
      if (mod && e.code==='Digit0') { e.preventDefault(); setZoom(1); }
      if (e.code==='KeyM') { e.preventDefault(); setMetronome(v=>!v); }
      if (e.code==='KeyL') { e.preventDefault(); setLoopOn(v=>!v); }
      if (e.code==='KeyG') { e.preventDefault(); setSnapGrid(v=>!v); }
      if (mod && e.code==='KeyT') { e.preventDefault(); addTrack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, stop, undo, redo, selectedClipIds, deleteClip, duplicateClip, project.clips, addTrack]);

  // ── Canvas rendering ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const now = performance.now();
    if (now - lastRenderRef.current < 14) return;
    lastRenderRef.current = now;

    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx) return;
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nw   = Math.round(rect.width  * dpr);
    const nh   = Math.round(rect.height * dpr);
    if (canvas.width !== nw || canvas.height !== nh) {
      canvas.width  = nw;
      canvas.height = nh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;

    ctx.fillStyle = C.space;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.008)';
      ctx.fillRect(0, y, W, 1);
    }

    drawRuler(ctx, W);

    project.tracks.forEach((track, idx) => {
      const ty = TL.rulerHeight + idx * TL.trackHeight - scrollTop;
      if (ty + TL.trackHeight < 0 || ty > H) return;
      drawTrack(ctx, track, ty, W, track.id === selectedTrackId);
      project.clips
        .filter(c => c.trackId === track.id)
        .forEach(c => {
          if (dragPreview?.clipId === c.id) return;
          const cx = barsToPixels(c.startBar, gridWidth) - scrollLeft;
          const cw = barsToPixels(c.durationBars, gridWidth);
          if (cx + cw < 0 || cx > W) return;
          drawClip(ctx, c, track, ty, selectedClipIds.includes(c.id), c.id === hoveredClipId);
        });
    });
    if (dragPreview) {
      const dc   = project.clips.find(c => c.id === dragPreview.clipId);
      const dt   = project.tracks.find(t => t.id === dragPreview.trackId);
      const didx = project.tracks.findIndex(t => t.id === dragPreview.trackId);
      if (dc && dt && didx >= 0) {
        const dty = TL.rulerHeight + didx * TL.trackHeight - scrollTop;
        const dcx = barsToPixels(dragPreview.startBar, gridWidth) - scrollLeft;
        const dcw = barsToPixels(dc.durationBars, gridWidth);
        if (dcx + dcw >= 0 && dcx <= W) {
          ctx.globalAlpha = 0.82;
          drawClip(ctx, { ...dc, startBar: dragPreview.startBar }, dt, dty, true, false);
          ctx.globalAlpha = 1;
        }
      }
    }

    project.markers.forEach(m => drawMarker(ctx, m, H));
    drawPlayhead(ctx, H);
    if (loopOn) drawLoop(ctx, H);
    collaborators.filter(c=>c.status==='active').forEach(c => drawCursor(ctx, c));

  }, [project, currentBar, zoom, scrollLeft, scrollTop, selectedClipIds, selectedTrackId, collaborators, gridWidth, hoveredClipId, loopOn, loopRegion, dragPreview]);

  const drawRuler = (ctx: CanvasRenderingContext2D, W: number) => {
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, W, TL.rulerHeight);
    ctx.fillStyle = C.neon;
    ctx.fillRect(0, 0, 3, TL.rulerHeight);
    ctx.fillRect(0, TL.rulerHeight-2, W, 2);
    ctx.font      = `600 10px ${FONT.mono}`;
    ctx.textAlign = 'center';
    const total = Math.ceil((W + scrollLeft) / gridWidth) + 2;
    const start = Math.floor(scrollLeft / gridWidth);
    for (let i = start; i < start + total; i++) {
      const x = i * gridWidth - scrollLeft;
      ctx.strokeStyle = i % 4 === 0 ? C.borderBright : C.border;
      ctx.lineWidth   = i % 4 === 0 ? 1.5 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, TL.rulerHeight); ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = C.neon;
        ctx.fillText(String(i+1), x + gridWidth/2, TL.rulerHeight - 10);
      }
      for (let b = 1; b < TL.beatsPerBar; b++) {
        const bx = x + b * gridWidth / TL.beatsPerBar;
        ctx.strokeStyle = C.border;
        ctx.lineWidth   = 0.5;
        ctx.beginPath(); ctx.moveTo(bx, TL.rulerHeight-8); ctx.lineTo(bx, TL.rulerHeight); ctx.stroke();
      }
    }
  };

  const drawTrack = (ctx: CanvasRenderingContext2D, track: Track, ty: number, W: number, sel: boolean) => {
    ctx.fillStyle = sel ? C.surfaceLift : C.surface;
    ctx.fillRect(0, ty, W, TL.trackHeight);
    ctx.strokeStyle = sel ? C.neon : C.border;
    ctx.lineWidth   = sel ? 1.5 : 0.5;
    ctx.beginPath(); ctx.moveTo(0,ty+TL.trackHeight-0.5); ctx.lineTo(W,ty+TL.trackHeight-0.5); ctx.stroke();
    ctx.fillStyle = track.color;
    ctx.fillRect(0, ty, 3, TL.trackHeight);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = C.borderBright;
    ctx.lineWidth   = 0.5;
    const ts = Math.floor(scrollLeft/gridWidth), te = Math.ceil((W+scrollLeft)/gridWidth)+2;
    for (let i=ts; i<te; i++) {
      const x = i*gridWidth - scrollLeft;
      ctx.beginPath(); ctx.moveTo(x,ty); ctx.lineTo(x,ty+TL.trackHeight); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (track.muted) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, ty, W, TL.trackHeight);
    }
  };

  const drawClip = (ctx: CanvasRenderingContext2D, clip: Clip, track: Track, ty: number, sel: boolean, hov: boolean) => {
    const x  = barsToPixels(clip.startBar, gridWidth) - scrollLeft;
    const cw = barsToPixels(clip.durationBars, gridWidth);
    const cy = ty + 6;
    const ch = TL.trackHeight - 12;
    const g  = ctx.createLinearGradient(x, cy, x, cy+ch);
    if (sel) {
      g.addColorStop(0, `${track.color}66`);
      g.addColorStop(1, `${track.color}22`);
    } else {
      g.addColorStop(0, `${track.color}30`);
      g.addColorStop(1, `${track.color}10`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, cy, cw, ch);
    if (hov || sel) {
      ctx.shadowColor = track.color;
      ctx.shadowBlur  = sel ? 12 : 6;
    }
    ctx.strokeStyle = sel ? C.neon : track.color;
    ctx.lineWidth   = sel ? 1.5 : 1;
    ctx.strokeRect(x+0.5, cy+0.5, cw-1, ch-1);
    ctx.shadowBlur = 0;
    const wpts   = Math.max(20, Math.min(180, Math.floor(cw/2)));
    const wf     = getWaveform(clip.id, wpts);
    ctx.strokeStyle = `${C.neon}60`;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    wf.forEach((a, i) => {
      const wx = x + (i/wf.length)*cw, wy = cy+ch/2, wh = a*(ch*0.65);
      i===0 ? ctx.moveTo(wx, wy-wh/2) : ctx.lineTo(wx, wy-wh/2);
    });
    ctx.stroke();
    ctx.beginPath();
    wf.forEach((a, i) => {
      const wx = x + (i/wf.length)*cw, wy = cy+ch/2, wh = a*(ch*0.65);
      i===0 ? ctx.moveTo(wx, wy+wh/2) : ctx.lineTo(wx, wy+wh/2);
    });
    ctx.stroke();
    ctx.lineWidth = 1;
    if (clip.fadeIn > 0) {
      const fw = barsToPixels(clip.fadeIn, gridWidth);
      ctx.fillStyle = `${track.color}25`;
      ctx.beginPath(); ctx.moveTo(x,cy); ctx.lineTo(x+fw,cy); ctx.lineTo(x+fw,cy+ch); ctx.lineTo(x,cy+ch); ctx.closePath(); ctx.fill();
    }
    if (clip.fadeOut > 0) {
      const fw = barsToPixels(clip.fadeOut, gridWidth);
      ctx.fillStyle = `${track.color}25`;
      ctx.beginPath(); ctx.moveTo(x+cw,cy); ctx.lineTo(x+cw-fw,cy); ctx.lineTo(x+cw-fw,cy+ch); ctx.lineTo(x+cw,cy+ch); ctx.closePath(); ctx.fill();
    }
    if (cw > 48) {
      ctx.fillStyle = `${C.surface}D0`;
      ctx.fillRect(x+8, cy+5, Math.min(cw-16,120), 16);
      ctx.fillStyle  = C.text;
      ctx.font       = `500 9px ${FONT.mono}`;
      ctx.textAlign  = 'left';
      ctx.fillText(clip.name, x+12, cy+16, cw-24);
    }
  };

  const drawMarker = (ctx: CanvasRenderingContext2D, m: Marker, H: number) => {
    const x   = barsToPixels(m.bar, gridWidth) - scrollLeft;
    const col = m.color ?? C.yellow;
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(x, TL.rulerHeight); ctx.lineTo(x, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x,TL.rulerHeight); ctx.lineTo(x+10,TL.rulerHeight+6); ctx.lineTo(x,TL.rulerHeight+12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.surface;
    ctx.fillRect(x+12, TL.rulerHeight+1, m.name.length*7+12, 16);
    ctx.fillStyle  = col;
    ctx.font       = `700 9px ${FONT.mono}`;
    ctx.textAlign  = 'left';
    ctx.fillText(m.name, x+16, TL.rulerHeight+12);
    ctx.lineWidth = 1;
  };

  const drawPlayhead = (ctx: CanvasRenderingContext2D, H: number) => {
    const x = barsToPixels(currentBar, gridWidth) - scrollLeft;
    ctx.shadowColor = C.neon;
    ctx.shadowBlur  = 16;
    ctx.strokeStyle = C.neon;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(x, TL.rulerHeight); ctx.lineTo(x, H); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle  = C.neon;
    ctx.beginPath(); ctx.moveTo(x-9,TL.rulerHeight); ctx.lineTo(x+9,TL.rulerHeight); ctx.lineTo(x,TL.rulerHeight+14); ctx.closePath(); ctx.fill();
    const label = formatTime(currentBar, project.tempo, TL.beatsPerBar);
    ctx.fillStyle = C.surface;
    ctx.fillRect(x-38, TL.rulerHeight+17, 76, 19);
    ctx.strokeStyle = C.neon;
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(x-38, TL.rulerHeight+17, 76, 19);
    ctx.fillStyle  = C.neon;
    ctx.font       = `700 10px ${FONT.mono}`;
    ctx.textAlign  = 'center';
    ctx.fillText(label, x, TL.rulerHeight+30);
    ctx.lineWidth = 1;
  };

  const drawLoop = (ctx: CanvasRenderingContext2D, H: number) => {
    const sx = barsToPixels(loopRegion.start, gridWidth) - scrollLeft;
    const ex = barsToPixels(loopRegion.end,   gridWidth) - scrollLeft;
    ctx.fillStyle   = `${C.cyan}0E`;
    ctx.fillRect(sx, TL.rulerHeight, ex-sx, H-TL.rulerHeight);
    [sx, ex].forEach((x, i) => {
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x,TL.rulerHeight); ctx.lineTo(x,H); ctx.stroke();
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      i===0 ? (ctx.moveTo(x,TL.rulerHeight), ctx.lineTo(x+10,TL.rulerHeight+6), ctx.lineTo(x,TL.rulerHeight+12))
             : (ctx.moveTo(x,TL.rulerHeight), ctx.lineTo(x-10,TL.rulerHeight+6), ctx.lineTo(x,TL.rulerHeight+12));
      ctx.closePath(); ctx.fill();
    });
    ctx.lineWidth = 1;
  };

  const drawCursor = (ctx: CanvasRenderingContext2D, c: Collaborator) => {
    const {x,y} = c.cursor;
    ctx.fillStyle   = c.color;
    ctx.shadowColor = c.color;
    ctx.shadowBlur  = 12;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+12,y+5); ctx.lineTo(x+5,y+12); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    const lw = c.name.split(' ').map(n=>n[0]).join('')+'  '+c.name;
    ctx.fillStyle   = `${c.color}E0`;
    ctx.fillRect(x+14, y-2, lw.length*6+14, 20);
    ctx.fillStyle   = C.void;
    ctx.font        = `700 9px ${FONT.mono}`;
    ctx.textAlign   = 'left';
    ctx.fillText(c.name.split(' ').map(n=>n[0]).join('') + '  ' + c.lastAction, x+20, y+12, 160);
  };

  // ── Canvas interactions ───────────────────────────────────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left + scrollLeft;
    const cy   = e.clientY - rect.top  + scrollTop;
    let hit: string|null = null;
    project.tracks.forEach((t, idx) => {
      const ty = TL.rulerHeight + idx * TL.trackHeight;
      project.clips.filter(c=>c.trackId===t.id).forEach(c => {
        const x=barsToPixels(c.startBar,gridWidth), w=barsToPixels(c.durationBars,gridWidth);
        if (cx>=x&&cx<=x+w&&cy>=ty+6&&cy<=ty+TL.trackHeight-6) hit=c.id;
      });
    });
    if (hit) {
      const h = hit;
      e.metaKey||e.ctrlKey
        ? setSelectedClipIds(p => p.includes(h) ? p.filter(x=>x!==h) : [...p,h])
        : !selectedClipIds.includes(h) && setSelectedClipIds([h]);
    } else {
      setSelectedClipIds([]);
    }
    if (cy < TL.rulerHeight) {
      let bar = pixelsToBars(cx, gridWidth);
      if (snapGrid) bar = Math.round(bar);
      setCurrentBar(bar);
      if (transport==='playing' && startTimeRef.current!==null)
        startTimeRef.current = performance.now() - (bar*(60/project.tempo)*TL.beatsPerBar*1000);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx   = e.clientX - rect.left + scrollLeft;
    const cy   = e.clientY - rect.top  + scrollTop;
    if (dragRef.current) {
      const drag = dragRef.current;
      const dxBars    = pixelsToBars(cx - drag.startX, gridWidth);
      const newBar    = Math.max(0, drag.origStartBar + dxBars);
      const trackIdx  = Math.max(0, Math.min(project.tracks.length - 1,
        Math.floor((cy - TL.rulerHeight) / TL.trackHeight)));
      const newTrackId = project.tracks[trackIdx]?.id ?? drag.origTrackId;
      setDragPreview({ clipId: drag.clipId, startBar: newBar, trackId: newTrackId });
      return;
    }
    let hov: string|null = null;
    project.tracks.forEach((t, idx) => {
      const ty = TL.rulerHeight + idx * TL.trackHeight;
      project.clips.filter(c=>c.trackId===t.id).forEach(c => {
        const x=barsToPixels(c.startBar,gridWidth), w=barsToPixels(c.durationBars,gridWidth);
        if (cx>=x&&cx<=x+w&&cy>=ty+6&&cy<=ty+TL.trackHeight-6) hov=c.id;
      });
    });
    setHoveredClipId(hov);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left + scrollLeft;
    const cy = e.clientY - rect.top  + scrollTop;
    if (cy < TL.rulerHeight) return;
    let hit: string | null = null;
    project.tracks.forEach((t, idx) => {
      const ty = TL.rulerHeight + idx * TL.trackHeight;
      project.clips.filter(c => c.trackId === t.id).forEach(c => {
        const x = barsToPixels(c.startBar, gridWidth), w = barsToPixels(c.durationBars, gridWidth);
        if (cx >= x && cx <= x + w && cy >= ty + 6 && cy <= ty + TL.trackHeight - 6) hit = c.id;
      });
    });
    if (!hit) return;
    const clip = project.clips.find(c => c.id === hit)!;
    dragRef.current = { clipId: hit, origStartBar: clip.startBar, origTrackId: clip.trackId, startX: cx, startY: cy };
    setDragPreview({ clipId: hit, startBar: clip.startBar, trackId: clip.trackId });
    e.preventDefault();
  };
  const handleMouseUp = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || !dragPreview) { dragRef.current = null; setDragPreview(null); return; }
    dragRef.current = null;
    const finalBar = Math.max(0, snapGrid ? Math.round(dragPreview.startBar) : dragPreview.startBar);
    pushHistory({
      ...project,
      clips: project.clips.map(c =>
        c.id === drag.clipId ? { ...c, startBar: finalBar, trackId: dragPreview.trackId } : c
      ),
    });
    setDragPreview(null);
  };
  const totalTH = project.tracks.length * TL.trackHeight + TL.rulerHeight;

  // ─── Ticker items ──────────────────────────────────────────────────────────
  const TICKER_ITEMS = [
    'R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony',
    'Accessible','MultiTrack DAW','VST System','LLPTE Engine','Collaborative',
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

        /* ── Acid Grid header classes (ported from instrument.tsx) ────────── */
        .ag-header {
          border-bottom: 3px solid var(--ag-border, #1c1c1c);
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,.6);
          flex-shrink: 0;
          z-index: 100;
        }
        .ag-header-top {
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid var(--ag-border, #1c1c1c);
        }
        .ag-ghost-bpm {
          position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
          font-family: 'Syne', sans-serif; font-weight: 800;
          font-size: clamp(56px, 9vw, 110px);
          color: transparent; -webkit-text-stroke: 1px rgba(163,230,53,0.04);
          letter-spacing: -0.04em; pointer-events: none; user-select: none; z-index: 0;
        }
        .ag-wordmark-block {
          padding: 12px 20px 10px;
          border-right: 1px solid var(--ag-border, #1c1c1c);
          display: flex; flex-direction: column; justify-content: center;
          min-width: 176px; position: relative; z-index: 1; flex-shrink: 0;
        }
        .ag-wordmark {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px;
          letter-spacing: -0.02em; color: var(--ag-white, #f0f0f0); line-height: 1;
        }
        .ag-wordmark-slash {
          color: var(--ag-acid, #a3e635); margin: 0 2px; font-size: 26px;
          line-height: .9; text-shadow: 0 0 14px #a3e635;
        }
        .ag-wordmark-sub {
          font-size: 7px; letter-spacing: .4em; text-transform: uppercase;
          color: var(--ag-mid, #555); margin-top: 4px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-status-block {
          padding: 10px 14px;
          border-right: 1px solid var(--ag-border, #1c1c1c);
          display: flex; flex-direction: column; justify-content: center;
          gap: 5px; z-index: 1; flex-shrink: 0;
        }
        .ag-status-line {
          font-size: 8px; letter-spacing: .2em; text-transform: uppercase;
          display: flex; align-items: center; gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-cursor-live {
          display: inline-block; width: 7px; height: 12px;
          background: var(--ag-acid, #a3e635); box-shadow: 0 0 8px #a3e635;
          animation: ag-blink 1s step-end infinite; flex-shrink: 0;
        }
        .ag-cursor-standby {
          display: inline-block; width: 7px; height: 12px;
          background: #555; flex-shrink: 0;
        }
        .ag-status-live-text  { color: var(--ag-acid, #a3e635); }
        .ag-status-dead-text  { color: #ff3b3b; }
        .ag-bpm-block {
          padding: 0 16px;
          border-right: 1px solid var(--ag-border, #1c1c1c);
          display: flex; align-items: center; gap: 10px; z-index: 1; flex-shrink: 0;
        }
        .ag-bpm-label {
          font-size: 7px; letter-spacing: .3em; color: var(--ag-mid, #555);
          text-transform: uppercase; writing-mode: vertical-rl; transform: rotate(180deg);
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-bpm-number {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 36px;
          letter-spacing: -0.04em; color: var(--ag-acid, #a3e635); line-height: 1;
          text-shadow: 0 0 20px rgba(163,230,53,.4), 0 0 40px rgba(163,230,53,.15);
        }
        .ag-controls-block {
          flex: 1; padding: 8px 12px;
          display: flex; align-items: center;
          gap: 4px; flex-wrap: wrap; z-index: 1; overflow: hidden;
        }

        /* ── Ticker ──────────────────────────────────────────────────────── */
        .ag-ticker-row {
          padding: 4px 0;
          background: #080808;
          overflow: hidden; position: relative; flex-shrink: 0;
        }
        .ag-ticker-row::before, .ag-ticker-row::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 32px; z-index: 2;
        }
        .ag-ticker-row::before { left: 0; background: linear-gradient(90deg, #080808, transparent); }
        .ag-ticker-row::after  { right: 0; background: linear-gradient(-90deg, #080808, transparent); }
        .ag-ticker-inner {
          display: flex; width: max-content;
          animation: ag-scroll 28s linear infinite;
        }
        @keyframes ag-scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .ag-ticker-item {
          font-size: 9px; letter-spacing: .2em; text-transform: uppercase;
          color: #fff; padding: 0 18px; white-space: nowrap;
          display: flex; align-items: center; gap: 10px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .ag-ticker-sep { color: #a3e635; font-size: 10px; }

        /* ── Animations ──────────────────────────────────────────────────── */
        @keyframes ag-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ag-pulse { 0%,100%{box-shadow:0 0 6px #a3e635} 50%{box-shadow:0 0 18px #a3e635,0 0 30px rgba(163,230,53,.3)} }
        @keyframes ag-slidein { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes ag-rec { 0%,100%{background:#ff3b3b} 50%{background:#ff3b3b88} }

        /* ── Scrollbars ───────────────────────────────────────────────────── */
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:${C.surface}; }
        ::-webkit-scrollbar-thumb { background:${C.borderBright}; }
        ::-webkit-scrollbar-thumb:hover { background:${C.neon}; }
        input[type=range] { -webkit-appearance:none; appearance:none; outline:none; cursor:pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; background:${C.neon}; cursor:pointer; }
      `}</style>

      {/* Toast notifications */}
      <div style={{ position:'fixed', top:80, right:16, zIndex:9999, display:'flex', flexDirection:'column', gap:6, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding:'8px 14px',
            background: t.type==='ai' ? `rgba(163,230,53,0.12)` : C.surface,
            border:`1px solid ${t.type==='ai' ? C.neon : C.border}`,
            borderLeft:`3px solid ${t.type==='ai' ? C.neon : C.cyan}`,
            fontFamily:FONT.mono, fontSize:10, color:C.text,
            animation:'ag-slidein .2s ease',
            boxShadow:`0 4px 24px rgba(0,0,0,.8)`,
            maxWidth:320,
          }}>
            {t.type==='ai' && <span style={{color:C.neon,marginRight:8}}>⚡ AI</span>}
            {t.msg}
          </div>
        ))}
      </div>

      <div style={{
        width:'100%',
        height:'calc(100vh - var(--nav-h, 44px))',
        background:C.void,
        display:'flex',
        flexDirection:'column',
        fontFamily:FONT.mono,
        color:C.text,
        overflow:'hidden',
        position:'relative',
      }}>

        {/* Left acid bar */}
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:C.neon, boxShadow:`0 0 20px ${C.neon}`, zIndex:300, pointerEvents:'none' }} />

        {/* Scanline overlay */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
          background:`repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.007) 3px,rgba(255,255,255,0.007) 4px)`,
        }} />

        {/* Ambient glow */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
          background:'radial-gradient(circle at 15% 50%, rgba(163,230,53,0.04) 0%, transparent 55%)',
        }} />

        {/* ── AG HEADER ──────────────────────────────────────────────────────── */}
        <header className="ag-header" style={{ background: C.surface }}>
          <div className="ag-header-top">

            {/* Ghost BPM */}
            <span className="ag-ghost-bpm" aria-hidden="true">{Math.round(project.tempo)}</span>

            {/* Wordmark */}
            <div className="ag-wordmark-block">
              <div className="ag-wordmark">
                R3<span className="ag-wordmark-slash">/</span>COLLAB
              </div>
              <div className="ag-wordmark-sub">Collaborative · Session</div>
            </div>

            {/* Connection status + collab avatars */}
            <div className="ag-status-block">
              <div className={`ag-status-line ${connStatus==='connected' ? 'ag-status-live-text' : 'ag-status-dead-text'}`}>
                <span className={connStatus==='connected' ? 'ag-cursor-live' : 'ag-cursor-standby'} />
                {connStatus==='connected'
                  ? <Wifi size={9} style={{flexShrink:0}} />
                  : <WifiOff size={9} style={{flexShrink:0}} />}
                {connStatus.toUpperCase()}
              </div>
              <div style={{ display:'flex', alignItems:'center' }}>
                {collaborators.map((c, i) => (
                  <div key={c.id} title={`${c.name} — ${c.lastAction}`} style={{
                    width:20, height:20, background:c.color,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border:`2px solid ${C.surface}`, fontSize:7, fontWeight:700, color:C.void,
                    position:'relative', cursor:'pointer', zIndex:collaborators.length-i,
                    marginLeft: i===0 ? 0 : -5, flexShrink:0,
                  }}>
                    {c.name.split(' ').map(n=>n[0]).join('')}
                    {c.status==='active' && (
                      <div style={{ position:'absolute', bottom:-2, right:-2, width:5, height:5, background:C.neon, border:`1.5px solid ${C.surface}` }} />
                    )}
                  </div>
                ))}
                <div style={{ width:20, height:20, background:C.neon, display:'flex', alignItems:'center', justifyContent:'center', border:`2px solid ${C.surface}`, marginLeft:-5, flexShrink:0 }}>
                  <User size={10} color={C.void} />
                </div>
              </div>
            </div>

            {/* BPM + time sig */}
            <div className="ag-bpm-block">
              <span className="ag-bpm-label">BPM</span>
              <input
                type="number" value={project.tempo} min={40} max={240}
                onChange={e => pushHistory({ ...project, tempo: clamp(Number(e.target.value), 40, 240) })}
                className="ag-bpm-number"
                style={{
                  background:'transparent', border:'none', outline:'none',
                  width:64, textAlign:'center', cursor:'ew-resize',
                }}
              />
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontSize:6, letterSpacing:'.3em', textTransform:'uppercase', color:C.textMuted, fontFamily:FONT.mono }}>SIG</span>
                <span style={{ fontSize:13, fontWeight:700, color:C.textMuted, fontFamily:FONT.display, lineHeight:1 }}>
                  {project.timeSignature[0]}/{project.timeSignature[1]}
                </span>
              </div>
            </div>

            {/* Controls block — transport + position + all toggles */}
            <div className="ag-controls-block">

              {/* Transport */}
              <AgBtn onClick={() => setCurrentBar(0)} title="Return to start (Home)"><SkipBack size={13} /></AgBtn>
              <AgBtn onClick={togglePlay} active={transport==='playing'} title="Play/Pause (Space)">
                {transport==='playing' ? <Pause size={13} /> : <Play size={13} />}
              </AgBtn>
              <AgBtn onClick={stop} title="Stop (Esc)"><Square size={13} /></AgBtn>
              <AgBtn
                onClick={() => setTransport(t => t==='recording' ? 'stopped' : 'recording')}
                active={transport==='recording'}
                activeColor={C.magenta}
                title="Record"
              >
                <div style={{
                  width:9, height:9,
                  background: transport==='recording' ? C.magenta : C.textMuted,
                  animation: transport==='recording' ? 'ag-rec 1s infinite' : 'none',
                  flexShrink:0,
                }} />
              </AgBtn>

              <Divider />

              {/* Position */}
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <AgLabel>BAR</AgLabel>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:FONT.display, color:C.neon, lineHeight:1 }}>
                  {String(Math.floor(currentBar)+1).padStart(3,'0')}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <AgLabel>TIME</AgLabel>
                <div style={{ fontSize:9, fontWeight:600, fontFamily:FONT.mono, color:C.textMuted }}>
                  {formatTime(currentBar, project.tempo, TL.beatsPerBar)}
                </div>
              </div>

              <Divider />

              {/* Grid toggles */}
              <AgBtn onClick={()=>setMetronome(v=>!v)} active={metronome} title="Metronome (M)"><Activity size={11} /> MET</AgBtn>
              <AgBtn onClick={()=>setSnapGrid(v=>!v)}  active={snapGrid}  title="Snap Grid (G)"><Grid3x3 size={11} /> SNAP</AgBtn>
              <AgBtn onClick={()=>setLoopOn(v=>!v)}    active={loopOn}    activeColor={C.cyan} title="Loop (L)">
                <span style={{fontSize:11,fontWeight:900}}>↺</span> LOOP
              </AgBtn>

              <Divider />

              {/* Undo / Redo */}
              <AgBtn onClick={undo} disabled={historyIdx===0}                title="Undo (⌘Z)"><Undo2 size={11} /></AgBtn>
              <AgBtn onClick={redo} disabled={historyIdx===history.length-1} title="Redo (⌘⇧Z)"><Redo2 size={11} /></AgBtn>

              <Divider />

              {/* Zoom */}
              <AgBtn onClick={()=>setZoom(z=>Math.max(z-0.2,TL.minZoom))} title="Zoom out"><ZoomOut size={11} /></AgBtn>
              <span style={{ fontSize:8, color:C.textMuted, minWidth:28, textAlign:'center', fontWeight:600, flexShrink:0 }}>
                {Math.round(zoom*100)}%
              </span>
              <AgBtn onClick={()=>setZoom(z=>Math.min(z+0.2,TL.maxZoom))} title="Zoom in"><ZoomIn size={11} /></AgBtn>

              <Divider />

              {/* View toggles */}
              <AgBtn onClick={()=>setShowMixer(v=>!v)}       active={showMixer}       title="Mixer"><Sliders size={11} /> MIX</AgBtn>
              <AgBtn onClick={()=>setShowAI(v=>!v)}           active={showAI}          title="AI Panel"><Zap size={11} /> AI</AgBtn>
              <AgBtn onClick={()=>setShowActivity(v=>!v)}     active={showActivity}    title="Activity Log"><Radio size={11} /> LOG</AgBtn>
              <AgBtn onClick={()=>setShowVST(v=>!v)}           active={showVST}         title="VST Browser"><Music size={11} /> VST</AgBtn>
              <AgBtn onClick={()=>setShowLoopStation(v=>!v)}   active={showLoopStation} title="Loop Station"><Repeat2 size={11} /> 505</AgBtn>

              <Divider />

              {/* CPU + LLPTE */}
              <div style={{ display:'flex', flexDirection:'column', gap:3, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <AgLabel>CPU</AgLabel>
                  <div style={{ width:48, height:3, background:C.border, flexShrink:0 }}>
                    <div style={{
                      height:'100%', width:`${cpuLoad*100}%`,
                      background: cpuLoad>0.8 ? C.magenta : cpuLoad>0.6 ? C.yellow : C.neon,
                      transition:'width .2s, background .2s',
                    }} />
                  </div>
                  <span style={{ fontSize:7, color:C.textMuted, width:22, textAlign:'right' }}>{Math.round(cpuLoad*100)}%</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <AgLabel>LLPTE</AgLabel>
                  <span style={{ fontSize:7, color:C.neon, fontWeight:700, animation:'ag-pulse 2s infinite' }}>{llpteLatency}ms</span>
                </div>
              </div>

              <Divider />

              {/* Master volume */}
              <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                <button
                  onClick={() => setMasterMuted(v=>!v)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:masterMuted?C.magenta:C.textMuted, padding:2, flexShrink:0 }}
                >
                  {masterMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={masterMuted ? 0 : masterVol}
                  onChange={e => setMasterVol(Number(e.target.value))}
                  style={{ width:60, height:2, accentColor:C.neon }}
                />
                <span style={{ fontSize:7, color:C.neon, minWidth:24, textAlign:'right', flexShrink:0 }}>
                  {masterMuted ? '—' : `${Math.round(masterVol*100)}%`}
                </span>
              </div>

              {/* File actions */}
              <AgBtn title="Export"><Download size={11} /></AgBtn>
              <AgBtn title="Share"><Share2 size={11} /></AgBtn>

            </div>
          </div>

          {/* Ticker */}
          <div className="ag-ticker-row">
            <div className="ag-ticker-inner">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <span key={i} className="ag-ticker-item">
                  {item}<span className="ag-ticker-sep">/</span>
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* ── LLPTE STATUS STRIP ──────────────────────────────────────────────── */}
        <div style={{
          height:28, background:C.void, borderBottom:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', gap:0, padding:'0 20px', flexShrink:0,
          overflowX:'auto', zIndex:90,
        }}>
          <AgLabel style={{marginRight:12, flexShrink:0}}>LLPTE PIPELINE</AgLabel>
          {(['inputRouter','spectralAnalyzer','aiMixEngine','transitionGraph','outputBus'] as const).map((node, i) => (
            <React.Fragment key={node}>
              <div style={{
                padding:'2px 10px',
                background: i===2 ? C.neonDim2 : 'transparent',
                border:`1px solid ${i===2 ? C.neon : C.border}`,
                fontSize:7, letterSpacing:'.15em', textTransform:'uppercase',
                color: i===2 ? C.neon : C.textMuted,
                flexShrink:0,
                boxShadow: i===2 ? `0 0 8px ${C.neonDim}` : 'none',
              }}>
                {node}
                {i===2 && <span style={{marginLeft:6, color:C.neon, fontWeight:700}}>{llpteLatency}ms</span>}
              </div>
              {i < 4 && (
                <div style={{ width:18, height:1, background:`linear-gradient(90deg,${C.neon},${C.border})`, flexShrink:0 }} />
              )}
            </React.Fragment>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:7, letterSpacing:'.2em', textTransform:'uppercase', color:C.textMuted }}>EDGES</span>
            <span style={{ fontSize:7, color:C.neon, fontWeight:700 }}>847</span>
            <span style={{ fontSize:7, color:C.textMuted, letterSpacing:'.2em', marginLeft:8 }}>TICK</span>
            <span style={{ fontSize:7, color:C.neon, fontWeight:700 }}>0.8ms</span>
            <span style={{ fontSize:7, color:C.textMuted, letterSpacing:'.2em', marginLeft:8 }}>CONF GATE</span>
            <span style={{ fontSize:7, color:C.neon, fontWeight:700 }}>≥0.65</span>
          </div>
        </div>

        {/* ── VST BROWSER PANEL ─────────────────────────────────────────────────────── */}
        {showVST && (
          <div style={{ height:340, background:C.void, borderTop:`2px solid ${C.neon}`, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
            <div style={{ height:28, padding:'0 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:C.void, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:6, height:6, background:C.neon, boxShadow:`0 0 6px ${C.neon}` }} />
                <span style={{ fontSize:7, letterSpacing:'.3em', textTransform:'uppercase', color:C.neon, fontFamily:FONT.mono }}>VIRTUAL VSTS</span>
              </div>
              <button onClick={()=>setShowVST(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textMuted, padding:2 }}><X size={12} /></button>
            </div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <Suspense fallback={<div style={{ padding:16, fontSize:8, color:C.textMuted, fontFamily:FONT.mono, letterSpacing:'.2em' }}>LOADING VSTS…</div>}>
                <VSTBrowser onPluginSelect={() => {}} />
              </Suspense>
            </div>
          </div>
        )}

        {/* ── LOOP STATION 505 ─────────────────────────────────────────────────────── */}
        {showLoopStation && (
          <div style={{ height:340, background:C.void, borderTop:`2px solid ${C.neon}`, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
            <div style={{ height:28, padding:'0 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:C.void, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:6, height:6, background:C.neon, boxShadow:`0 0 6px ${C.neon}` }} />
                <span style={{ fontSize:7, letterSpacing:'.3em', textTransform:'uppercase', color:C.neon, fontFamily:FONT.mono }}>LOOP STATION 505</span>
              </div>
              <button onClick={()=>setShowLoopStation(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textMuted, padding:2 }}><X size={12} /></button>
            </div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <Suspense fallback={<div style={{ padding:16, fontSize:8, color:C.textMuted, fontFamily:FONT.mono, letterSpacing:'.2em' }}>LOADING LOOP STATION…</div>}>
                <LoopStation505 />
              </Suspense>
            </div>
          </div>
        )}

        {/* ── MAIN BODY ───────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative', zIndex:1 }}>

          {/* Track headers */}
          <div style={{
            width:TL.headerWidth, flexShrink:0,
            background:C.surface, borderRight:`2px solid ${C.border}`,
            display:'flex', flexDirection:'column', overflowY:'hidden',
          }}>
            {/* Ruler spacer */}
            <div style={{
              height:TL.rulerHeight, background:C.void, borderBottom:`2px solid ${C.neon}`,
              display:'flex', alignItems:'center', paddingLeft:8,
            }}>
              <AgLabel style={{fontSize:7}}>TRACKS</AgLabel>
            </div>

            {/* Track rows */}
            <div style={{ flex:1, overflowY:'auto' }}>
              {project.tracks.map(track => (
                <div
                  key={track.id}
                  onClick={() => setSelectedTrackId(t => t===track.id ? null : track.id)}
                  style={{
                    height:TL.trackHeight,
                    background: selectedTrackId===track.id ? C.surfaceLift : 'transparent',
                    borderBottom:`1px solid ${C.border}`,
                    borderLeft:`3px solid ${selectedTrackId===track.id ? C.neon : track.color}`,
                    cursor:'pointer', display:'flex', flexDirection:'column',
                    justifyContent:'center', padding:'6px 8px', gap:4, position:'relative',
                  }}
                >
                  {/* Collab indicator */}
                  {collaborators.filter(c=>c.editingTrackId===track.id&&c.status==='active').map(c => (
                    <div key={c.id} style={{
                      position:'absolute', top:4, right:4,
                      width:8, height:8, background:c.color, boxShadow:`0 0 6px ${c.color}`,
                    }} title={`${c.name} editing`} />
                  ))}

                  {/* Name */}
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8, height:8, background:track.color, flexShrink:0 }} />
                    <span style={{ fontSize:9, fontWeight:600, color:C.text, letterSpacing:'.05em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {track.name}
                    </span>
                    {track.locked && <Lock size={8} color={C.textMuted} />}
                  </div>

                  {/* Controls row */}
                  <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                    <AgBtn onClick={e=>{e.stopPropagation();toggleMute(track.id)}} active={track.muted} activeColor={C.yellow} style={{height:18,padding:'0 5px',fontSize:7}}>M</AgBtn>
                    <AgBtn onClick={e=>{e.stopPropagation();toggleSolo(track.id)}}  active={track.solo}  activeColor={C.cyan}   style={{height:18,padding:'0 5px',fontSize:7}}>S</AgBtn>
                    <AgBtn onClick={e=>{e.stopPropagation();updateTrack(track.id,{armed:!track.armed})}} active={track.armed} activeColor={C.magenta} style={{height:18,padding:'0 5px',fontSize:7}}>R</AgBtn>
                    <div style={{ marginLeft:'auto', display:'flex', gap:2 }}>
                      <VUMeter level={vuLevels[track.id]??0} color={track.color} peaked={peakedTracks.has(track.id)} />
                      <VUMeter level={(vuLevels[track.id]??0)*0.9} color={track.color} peaked={peakedTracks.has(track.id)} />
                    </div>
                  </div>

                  {/* Volume */}
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={track.volume}
                      onChange={e=>{e.stopPropagation();updateTrack(track.id,{volume:Number(e.target.value)})}}
                      onClick={e=>e.stopPropagation()}
                      style={{ flex:1, height:2, accentColor:track.color }}
                    />
                    <span style={{ fontSize:7, color:C.textMuted, minWidth:22, textAlign:'right' }}>{Math.round(track.volume*100)}%</span>
                  </div>

                  {/* FX tags */}
                  {track.fxChain.length > 0 && (
                    <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                      {track.fxChain.slice(0,2).map(fx => (
                        <span key={fx} style={{ fontSize:6, color:C.textDim, border:`1px solid ${C.border}`, padding:'1px 4px', letterSpacing:'.1em', textTransform:'uppercase' }}>
                          {fx}
                        </span>
                      ))}
                      {track.fxChain.length > 2 && <span style={{ fontSize:6, color:C.textDim }}>+{track.fxChain.length-2}</span>}
                    </div>
                  )}
                </div>
              ))}

              {/* Add track */}
              <button
                onClick={addTrack}
                style={{
                  width:'100%', height:40, background:'transparent', border:'none',
                  borderTop:`1px solid ${C.border}`, color:C.neon, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'.25em',
                  fontFamily:FONT.mono, transition:'background .1s',
                }}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=C.neon;(e.currentTarget as HTMLButtonElement).style.color=C.void;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background='transparent';(e.currentTarget as HTMLButtonElement).style.color=C.neon;}}
              >
                <Plus size={12} /> ADD TRACK
              </button>
            </div>
          </div>

          {/* Timeline canvas area */}
          <div
            ref={containerRef}
            onScroll={e => {
              setScrollLeft((e.currentTarget as HTMLDivElement).scrollLeft);
              setScrollTop((e.currentTarget as HTMLDivElement).scrollTop);
            }}
            style={{ flex:1, position:'relative', overflow:'auto' }}
          >
            <div style={{ width:Math.max(3000, project.clips.reduce((acc,c)=>Math.max(acc,c.startBar+c.durationBars),0)*gridWidth+200), height:Math.max(totalTH,400), position:'relative' }}>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={e=>{ e.preventDefault(); setContextMenu({x:e.clientX,y:e.clientY}); }}
                style={{ position:'sticky', top:0, left:0, width:'100%', height:'100%', cursor:hoveredClipId?'pointer':'crosshair', display:'block' }}
              />
            </div>

            {/* Overlay HUD — selection info */}
            {selectedClipIds.length > 0 && (
              <div style={{
                position:'fixed', bottom:16, left:TL.headerWidth+16,
                background:C.surface, border:`1px solid ${C.neon}`, borderLeft:`3px solid ${C.neon}`,
                padding:'5px 12px', fontSize:8, fontFamily:FONT.mono, color:C.neon,
                letterSpacing:'.15em', textTransform:'uppercase', zIndex:200,
              }}>
                {selectedClipIds.length} CLIP{selectedClipIds.length>1?'S':''} SELECTED — DEL to remove · ⌘D duplicate
              </div>
            )}
          </div>

          {/* ── AI SUGGESTIONS PANEL ──────────────────────────────────────────── */}
          {showAI && (
            <div style={{
              width:240, background:C.surface, borderLeft:`2px solid ${C.border}`,
              display:'flex', flexDirection:'column', flexShrink:0,
            }}>
              <div style={{
                height:TL.rulerHeight+28, padding:'0 12px',
                borderBottom:`1px solid ${C.border}`, borderLeft:`3px solid ${C.neon}`,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:C.void,
              }}>
                <div>
                  <div style={{ fontSize:7, letterSpacing:'.3em', textTransform:'uppercase', color:C.neon, marginBottom:2 }}>AI SUGGESTIONS</div>
                  <div style={{ fontSize:7, color:C.textMuted, letterSpacing:'.1em' }}>LLPTE · {llpteLatency}ms</div>
                </div>
                <Zap size={14} color={C.neon} />
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
                {suggestions.length === 0 ? (
                  <div style={{ padding:16, textAlign:'center', fontSize:8, color:C.textDim, letterSpacing:'.15em' }}>
                    NO PENDING SUGGESTIONS
                  </div>
                ) : suggestions.map(s => {
                  const track = project.tracks.find(t=>t.id===s.trackId);
                  const col   = confidenceColor(s.confidence);
                  return (
                    <div key={s.id} style={{
                      background:C.void, border:`1px solid ${C.border}`,
                      borderLeft:`2px solid ${col}`, padding:'8px 10px',
                    }}>
                      <div style={{ fontSize:7, color:C.textMuted, letterSpacing:'.1em', marginBottom:4, textTransform:'uppercase' }}>
                        {track?.name ?? s.trackId} · {s.type.replace('_',' ')}
                      </div>
                      <div style={{ fontSize:9, color:C.text, marginBottom:6, lineHeight:1.4 }}>{s.label}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <div style={{ width:5, height:5, background:col, boxShadow:`0 0 5px ${col}` }} />
                          <span style={{ fontSize:8, color:col, fontWeight:700 }}>{Math.round(s.confidence*100)}%</span>
                        </div>
                        <span style={{ fontSize:7, color:C.textMuted, letterSpacing:'.1em', textTransform:'uppercase' }}>
                          {s.confidence>=0.65?'AUTO':'SUGGEST'}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button
                          onClick={()=>acceptSuggestion(s.id)}
                          style={{
                            flex:1, height:22, background:C.neonDim2, border:`1px solid ${C.neon}`,
                            color:C.neon, cursor:'pointer', fontSize:7, fontFamily:FONT.mono,
                            letterSpacing:'.15em', textTransform:'uppercase', fontWeight:700,
                          }}
                        >✓ ACCEPT</button>
                        <button
                          onClick={()=>rejectSuggestion(s.id)}
                          style={{
                            flex:1, height:22, background:'transparent', border:`1px solid ${C.border}`,
                            color:C.textMuted, cursor:'pointer', fontSize:7, fontFamily:FONT.mono,
                            letterSpacing:'.15em', textTransform:'uppercase',
                          }}
                        >✕ REJECT</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* LLPTE confidence legend */}
              <div style={{ padding:10, borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:4 }}>
                <AgLabel style={{marginBottom:4}}>CONFIDENCE GATES</AgLabel>
                {[
                  { label:'AUTO APPLY', threshold:'≥0.65', color:C.neon },
                  { label:'SUGGEST',    threshold:'≥0.40', color:C.yellow },
                  { label:'DISCARD',    threshold:'<0.40', color:C.magenta },
                ].map(g => (
                  <div key={g.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:5, height:5, background:g.color }} />
                      <span style={{ fontSize:7, color:g.color, fontWeight:700, letterSpacing:'.1em' }}>{g.label}</span>
                    </div>
                    <span style={{ fontSize:7, color:C.textMuted }}>{g.threshold}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACTIVITY FEED ─────────────────────────────────────────────────── */}
          {showActivity && (
            <div style={{
              width:220, background:C.surface, borderLeft:`2px solid ${C.border}`,
              display:'flex', flexDirection:'column', flexShrink:0,
            }}>
              <div style={{
                height:TL.rulerHeight+28, padding:'0 12px',
                borderBottom:`1px solid ${C.border}`, borderLeft:`3px solid ${C.neon}`,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:C.void,
              }}>
                <div style={{ fontSize:7, letterSpacing:'.3em', textTransform:'uppercase', color:C.neon }}>
                  ACTIVITY
                </div>
                <div style={{ fontSize:7, color:C.textMuted }}>
                  {collaborators.filter(c=>c.status==='active').length} ONLINE
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:6, display:'flex', flexDirection:'column', gap:4 }}>
                {activities.map(a => {
                  const ago  = Date.now() - a.timestamp;
                  const mins = Math.floor(ago/60000);
                  const secs = Math.floor((ago%60000)/1000);
                  const t    = mins>0 ? `${mins}m` : secs>0 ? `${secs}s` : 'now';
                  const col  = a.type==='ai' ? C.neon : a.type==='transport' ? C.cyan : a.type==='collab' ? C.yellow : C.textMuted;
                  return (
                    <div key={a.id} style={{
                      padding:'6px 8px', background:C.void,
                      border:`1px solid ${C.border}`, borderLeft:`2px solid ${col}`,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:8, color:C.neon, fontWeight:700 }}>{a.user}</span>
                        <span style={{ fontSize:7, color:C.textDim }}>{t}</span>
                      </div>
                      <div style={{ fontSize:8, color:C.textMuted, letterSpacing:'.05em' }}>{a.action}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── MIXER STRIP (collapsible) ───────────────────────────────────────── */}
        {showMixer && (
          <div style={{
            height:140, background:C.surface, borderTop:`2px solid ${C.border}`,
            display:'flex', flexShrink:0, overflowX:'auto',
          }}>
            <div style={{
              width:TL.headerWidth, flexShrink:0, borderRight:`2px solid ${C.border}`,
              display:'flex', alignItems:'center', justifyContent:'center', padding:'0 12px',
            }}>
              <div style={{ display:'flex', flexDirection:'column', gap:4, width:'100%' }}>
                <AgLabel>MASTER FADER</AgLabel>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={masterMuted ? 0 : masterVol}
                    onChange={e=>setMasterVol(Number(e.target.value))}
                    style={{ flex:1, accentColor:C.neon }}
                  />
                  <span style={{ fontSize:10, color:C.neon, fontWeight:700, minWidth:30, textAlign:'right' }}>
                    {Math.round(masterVol*100)}
                  </span>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <VUMeter level={vuLevels[project.tracks[0]?.id]??0} color={C.neon} peaked={false} />
                  <VUMeter level={(vuLevels[project.tracks[0]?.id]??0)*0.95} color={C.neon} peaked={false} />
                </div>
              </div>
            </div>
            {project.tracks.map(track => (
              <div key={track.id} style={{
                width:80, flexShrink:0, borderRight:`1px solid ${C.border}`,
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'8px 6px', gap:4,
                background: selectedTrackId===track.id ? C.surfaceLift : 'transparent',
                borderTop:`3px solid ${track.color}`,
              }}>
                <span style={{ fontSize:7, color:C.textMuted, letterSpacing:'.08em', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>
                  {track.name}
                </span>
                <div style={{ display:'flex', gap:3, marginBottom:2 }}>
                  <VUMeter level={vuLevels[track.id]??0} color={track.color} peaked={peakedTracks.has(track.id)} />
                  <VUMeter level={(vuLevels[track.id]??0)*0.88} color={track.color} peaked={peakedTracks.has(track.id)} />
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={track.volume}
                  onChange={e=>updateTrack(track.id,{volume:Number(e.target.value)})}
                  style={{ width:60, accentColor:track.color }}
                />
                <span style={{ fontSize:7, color:C.textMuted }}>{Math.round(track.volume*100)}</span>
                <div style={{ display:'flex', gap:2 }}>
                  <AgBtn onClick={()=>toggleMute(track.id)} active={track.muted} activeColor={C.yellow} style={{height:16,padding:'0 4px',fontSize:6}}>M</AgBtn>
                  <AgBtn onClick={()=>toggleSolo(track.id)} active={track.solo}  activeColor={C.cyan}   style={{height:16,padding:'0 4px',fontSize:6}}>S</AgBtn>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STATUS BAR ─────────────────────────────────────────────────────── */}
        <div style={{
          height:26, background:C.void, borderTop:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', padding:'0 16px', gap:24, flexShrink:0,
        }}>
          {[
            ['SPC','Play/Pause'],['ESC','Stop'],['⌘Z','Undo'],['⌘D','Dup'],
            ['DEL','Remove'],['M','Metro'],['L','Loop'],['G','Snap'],['⌘T','Track'],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ fontSize:7, color:C.neon, fontWeight:700, fontFamily:FONT.mono, padding:'1px 4px', border:`1px solid ${C.border}`, letterSpacing:'.05em' }}>{k}</span>
              <span style={{ fontSize:7, color:C.textDim, letterSpacing:'.1em', textTransform:'uppercase' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginLeft:'auto', fontSize:7, color:C.textDim, letterSpacing:'.2em' }}>
            {project.tracks.length} TRACKS · {project.clips.length} CLIPS · {project.markers.length} MARKERS
          </div>
        </div>

        {/* Context menu */}
        {contextMenu && (
          <>
            <div style={{ position:'fixed', inset:0, zIndex:998 }} onClick={()=>setContextMenu(null)} />
            <div style={{
              position:'fixed', left:contextMenu.x, top:contextMenu.y,
              background:C.surface, border:`1px solid ${C.border}`, borderTop:`2px solid ${C.neon}`,
              padding:4, minWidth:160, boxShadow:'0 8px 32px rgba(0,0,0,.9)', zIndex:999,
            }}>
              {selectedClipIds.length > 0 ? (
                <>
                  <CtxItem onClick={()=>{ selectedClipIds.forEach(duplicateClip); setContextMenu(null); }}><Copy size={11} /> Duplicate</CtxItem>
                  <CtxItem onClick={()=>{ selectedClipIds.forEach(deleteClip); setContextMenu(null); }}><Trash2 size={11} /> Delete</CtxItem>
                </>
              ) : (
                <>
                  <CtxItem onClick={()=>{ addTrack(); setContextMenu(null); }}><Plus size={11} /> Add Track</CtxItem>
                  <CtxItem onClick={()=>setContextMenu(null)}><Upload size={11} /> Import Audio</CtxItem>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

const CtxItem = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <div
    onClick={onClick}
    style={{
      padding:'7px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:8,
      fontSize:9, fontFamily:FONT.mono, letterSpacing:'.1em', textTransform:'uppercase',
      color:C.text, transition:'background .07s, color .07s', borderLeft:'2px solid transparent',
    }}
    onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.background=C.neon; (e.currentTarget as HTMLDivElement).style.color=C.void; (e.currentTarget as HTMLDivElement).style.borderColor=C.neon; }}
    onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.background='transparent'; (e.currentTarget as HTMLDivElement).style.color=C.text; (e.currentTarget as HTMLDivElement).style.borderColor='transparent'; }}
  >
    {children}
  </div>
);