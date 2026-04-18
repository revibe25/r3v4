import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────
const BPM          = 126;
const STEPS        = 16;
const STEP_TIME    = 60 / BPM / 4;   // seconds per 16th note
const LOOKAHEAD    = 0.1;            // schedule 100ms ahead
const SCHED_MS     = 25;             // scheduler tick interval
const PAD_DIM_MS   = 220;            // how long pad glow persists
const POP_MS       = 150;            // scale pop duration

// ── Pad categories (mirrors drum-pads.tsx) ─────────────────────────────────────
const CATS = [
  { label: "KICK",   color: "#ef4444", rgb: "239,68,68"   },
  { label: "KICK",   color: "#ef4444", rgb: "239,68,68"   },
  { label: "KICK",   color: "#ef4444", rgb: "239,68,68"   },
  { label: "KICK",   color: "#ef4444", rgb: "239,68,68"   },
  { label: "SNARE",  color: "#f97316", rgb: "249,115,22"  },
  { label: "SNARE",  color: "#f97316", rgb: "249,115,22"  },
  { label: "SNARE",  color: "#f97316", rgb: "249,115,22"  },
  { label: "SNARE",  color: "#f97316", rgb: "249,115,22"  },
  { label: "HI-HAT", color: "#a3e635", rgb: "163,230,53"  },
  { label: "HI-HAT", color: "#a3e635", rgb: "163,230,53"  },
  { label: "HI-HAT", color: "#a3e635", rgb: "163,230,53"  },
  { label: "HI-HAT", color: "#a3e635", rgb: "163,230,53"  },
  { label: "PERC",   color: "#8b5cf6", rgb: "139,92,246"  },
  { label: "PERC",   color: "#8b5cf6", rgb: "139,92,246"  },
  { label: "PERC",   color: "#8b5cf6", rgb: "139,92,246"  },
  { label: "PERC",   color: "#8b5cf6", rgb: "139,92,246"  },
];

// ── Sound names per pad ────────────────────────────────────────────────────────
const PAD_NAMES = [
  "KICK MAIN", "KICK GHOST", "KICK GHOST", "KICK GHOST",
  "SNARE MAIN","SNARE GHOST","SNARE DRAG", "SNARE FLAM",
  "HH CLOSED", "HH OPEN",   "HH CLOSED", "HH CLOSED",
  "RIM SHOT",  "COWBELL",   "TEXTURE",   "ACCENT",
];

// ── Intro beat pattern ─────────────────────────────────────────────────────────
// pad: 0-15, step: 0-15 (16th notes), vel: 0-1
const BEAT = [
  // ─ KICK ─────────────────────────────────────────────────────
  { pad: 0,  step: 0,  vel: 1.00 },  // Beat 1 downbeat
  { pad: 1,  step: 3,  vel: 0.50 },  // Ghost 16th before beat 2
  { pad: 0,  step: 8,  vel: 0.92 },  // Beat 3
  { pad: 0,  step: 10, vel: 0.62 },  // Syncopated ghost
  { pad: 0,  step: 14, vel: 0.72 },  // Anticipation of next bar

  // ─ SNARE ────────────────────────────────────────────────────
  { pad: 4,  step: 4,  vel: 1.00 },  // Beat 2
  { pad: 5,  step: 6,  vel: 0.44 },  // Ghost snare
  { pad: 4,  step: 12, vel: 0.96 },  // Beat 4
  { pad: 5,  step: 11, vel: 0.40 },  // Ghost before beat 4
  { pad: 6,  step: 2,  vel: 0.32 },  // Drag

  // ─ HI-HAT ───────────────────────────────────────────────────
  { pad: 8,  step: 0,  vel: 0.72 },
  { pad: 8,  step: 2,  vel: 0.50 },
  { pad: 8,  step: 4,  vel: 0.68 },
  { pad: 9,  step: 6,  vel: 0.86 },  // Open hat
  { pad: 8,  step: 8,  vel: 0.76 },
  { pad: 8,  step: 10, vel: 0.50 },
  { pad: 8,  step: 12, vel: 0.68 },
  { pad: 9,  step: 14, vel: 0.82 },  // Open hat

  // ─ PERC ─────────────────────────────────────────────────────
  { pad: 12, step: 2,  vel: 0.65 },  // Rim
  { pad: 12, step: 5,  vel: 0.60 },
  { pad: 12, step: 9,  vel: 0.70 },
  { pad: 12, step: 13, vel: 0.65 },
  { pad: 12, step: 15, vel: 0.78 },  // Bar end flourish
  { pad: 13, step: 1,  vel: 0.55 },  // Cowbell
  { pad: 13, step: 7,  vel: 0.50 },
  { pad: 13, step: 15, vel: 0.60 },
  { pad: 14, step: 3,  vel: 0.32 },  // Texture
  { pad: 14, step: 11, vel: 0.32 },
  { pad: 15, step: 7,  vel: 0.56 },  // Accent
];

// step → list of hits (pre-computed for O(1) lookup)
const STEP_MAP = Array.from({ length: STEPS }, (_, s) =>
  BEAT.filter(b => b.step === s)
);

// ── Web Audio synthesis ────────────────────────────────────────────────────────

function mkKick(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.connect(g); g.connect(dest);
  osc.frequency.setValueAtTime(58, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(0.001, t + 0.46);
  g.gain.setValueAtTime(vel * 1.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
  osc.start(t); osc.stop(t + 0.5);
  // Click transient
  const c = ctx.createOscillator(), cg = ctx.createGain();
  c.connect(cg); cg.connect(dest);
  c.frequency.value = 1400;
  cg.gain.setValueAtTime(vel * 0.38, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
  c.start(t); c.stop(t + 0.02);
}

function mkGhostKick(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.connect(g); g.connect(dest);
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);
  g.gain.setValueAtTime(vel * 0.62, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.start(t); osc.stop(t + 0.35);
}

function mkSnare(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  // Noise body
  const len = Math.floor(ctx.sampleRate * 0.22);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), ng = ctx.createGain();
  ns.buffer = buf;
  hpf.type = "highpass"; hpf.frequency.value = 2200;
  ns.connect(hpf); hpf.connect(ng); ng.connect(dest);
  ng.gain.setValueAtTime(vel * 0.88, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
  ns.start(t); ns.stop(t + 0.22);
  // Tone
  const osc = ctx.createOscillator(), og = ctx.createGain();
  osc.connect(og); og.connect(dest);
  osc.frequency.value = 180;
  og.gain.setValueAtTime(vel * 0.58, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.start(t); osc.stop(t + 0.09);
}

function mkGhostSnare(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const len = Math.floor(ctx.sampleRate * 0.1);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(), bpf = ctx.createBiquadFilter(), ng = ctx.createGain();
  ns.buffer = buf;
  bpf.type = "bandpass"; bpf.frequency.value = 2800; bpf.Q.value = 0.8;
  ns.connect(bpf); bpf.connect(ng); ng.connect(dest);
  ng.gain.setValueAtTime(vel * 0.46, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  ns.start(t); ns.stop(t + 0.11);
}

function mkClosedHH(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const len = Math.floor(ctx.sampleRate * 0.055);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), ng = ctx.createGain();
  ns.buffer = buf;
  hpf.type = "highpass"; hpf.frequency.value = 9500;
  ns.connect(hpf); hpf.connect(ng); ng.connect(dest);
  ng.gain.setValueAtTime(vel * 0.36, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
  ns.start(t); ns.stop(t + 0.058);
}

function mkOpenHH(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const len = Math.floor(ctx.sampleRate * 0.32);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), ng = ctx.createGain();
  ns.buffer = buf;
  hpf.type = "highpass"; hpf.frequency.value = 8500;
  ns.connect(hpf); hpf.connect(ng); ng.connect(dest);
  ng.gain.setValueAtTime(vel * 0.40, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
  ns.start(t); ns.stop(t + 0.33);
}

function mkRim(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = "triangle";
  osc.connect(g); g.connect(dest);
  osc.frequency.setValueAtTime(1700, t);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.055);
  g.gain.setValueAtTime(vel * 0.52, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.058);
  osc.start(t); osc.stop(t + 0.07);
}

function mkCowbell(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  [562, 845].forEach(freq => {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = "square"; osc.frequency.value = freq;
    // gentle waveshape distortion
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      const x = (i / 64) - 1;
      curve[i] = (Math.PI + 180) * x / (Math.PI + 180 * Math.abs(x));
    }
    ws.curve = curve;
    osc.connect(ws); ws.connect(g); g.connect(dest);
    g.gain.setValueAtTime(vel * 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.start(t); osc.stop(t + 0.26);
  });
}

function mkTexture(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const osc = ctx.createOscillator(), lpf = ctx.createBiquadFilter(), g = ctx.createGain();
  osc.type = "sawtooth";
  lpf.type = "lowpass"; lpf.frequency.value = 780;
  osc.connect(lpf); lpf.connect(g); g.connect(dest);
  osc.frequency.setValueAtTime(210, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.17);
  g.gain.setValueAtTime(vel * 0.24, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
  osc.start(t); osc.stop(t + 0.22);
}

function mkAccent(ctx: AudioContext, dest: AudioNode, t: number, vel: number) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.connect(g); g.connect(dest);
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.11);
  g.gain.setValueAtTime(vel * 0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.start(t); osc.stop(t + 0.15);
}

// pad → synth function
const SYNTHS = [
  mkKick, mkGhostKick, mkGhostKick, mkGhostKick,
  mkSnare, mkGhostSnare, mkGhostSnare, mkGhostSnare,
  mkClosedHH, mkOpenHH, mkClosedHH, mkClosedHH,
  mkRim, mkCowbell, mkTexture, mkAccent,
];

// ── Component ──────────────────────────────────────────────────────────────────
interface BeatIntroProps {
  /** Called on every synthesized hit — wires into handlePadTrigger in instrument.tsx */
  onTrigger?: (padIndex: number, velocity: number) => void;
  /** Mirrors instrument page isInitialized — disables play when audio engine not ready */
  disabled?: boolean;
}

export function BeatIntro({ onTrigger, disabled = false }: BeatIntroProps) {
  const [playing,    setPlaying]    = useState(false);
  const [step,       setStep]       = useState(-1);
  const [activePads, setActivePads] = useState<Record<number,number>>({});   // pad → vel
  const [poppingPads,setPoppingPads]= useState<Set<number>>(new Set());
  const [lastHit,    setLastHit]    = useState<{pad:number;vel:number;step:number;id:number}|null>(null);
  const [hitLog,     setHitLog]     = useState<{id:number;pad:number;vel:number;step:number}[]>([]);
  const [bars,       setBars]       = useState(0);

  const ctxRef     = useRef<AudioContext|null>(null);
  const destRef    = useRef<GainNode|null>(null);
  const schedRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const rafRef     = useRef<number|null>(null);
  const playingRef = useRef(false);
  const stepRef    = useRef(0);
  const nextTimeRef= useRef(0);
  const pendingVis = useRef<{pad:number;vel:number;step:number;time:number}[]>([]);
  const hitIdRef   = useRef(0);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(schedRef.current ?? undefined);
    cancelAnimationFrame(rafRef.current ?? 0);
    ctxRef.current?.close();
  }, []);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AudioCtx();
      const master = ctxRef.current.createGain();
      master.gain.value = 0.82;
      master.connect(ctxRef.current.destination);
      destRef.current = master;
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return { ctx: ctxRef.current, dest: destRef.current };
  }, []);

  // Schedule one step's hits into Web Audio
  const scheduleStep = useCallback((s: number, t: number) => {
    const { ctx, dest } = getCtx();
    STEP_MAP[s].forEach(({ pad, vel }) => {
      SYNTHS[pad](ctx, dest!, t, vel);
      pendingVis.current.push({ pad, vel, step: s, time: t });
    });
  }, [getCtx]);

  // Audio scheduler — runs on setInterval, schedules ahead by LOOKAHEAD
  const runScheduler = useCallback(() => {
    const { ctx } = getCtx();
    while (nextTimeRef.current < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(stepRef.current, nextTimeRef.current);
      if (stepRef.current % 4 === 0) setBars(b => b + 1);
      stepRef.current = (stepRef.current + 1) % STEPS;
      nextTimeRef.current += STEP_TIME;
    }
  }, [getCtx, scheduleStep]);

  // Visual loop — syncs to Web Audio clock via requestAnimationFrame
  const visualLoop = useCallback(() => {
    if (!playingRef.current) return;
    const ctx = ctxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      const due = pendingVis.current.filter(v => v.time <= now + 0.005);
      if (due.length) {
        pendingVis.current = pendingVis.current.filter(v => v.time > now + 0.005);
        const latest = due[due.length - 1];

        setStep(latest.step);
        setLastHit({ pad: latest.pad, vel: latest.vel, step: latest.step, id: ++hitIdRef.current });

        const padMap = {};
        due.forEach(v => {
          padMap[v.pad] = v.vel;
          // ── Drive instrument.tsx audio engine + 3D stage ──────────────────
          // onTrigger feeds handlePadTrigger which calls triggerPad (real audio)
          // AND updates padVelocities/stageShake for the DrumStage component.
          onTrigger?.(v.pad, v.vel);
        });

        setActivePads(prev => ({ ...prev, ...padMap }));
        setPoppingPads(prev => { const n = new Set(prev); due.forEach(v => n.add(v.pad)); return n; });
        setHitLog(prev => {
          const entries = due.map(v => ({
            id: hitIdRef.current + v.pad,
            pad: v.pad, vel: v.vel, step: v.step,
          }));
          return [...entries, ...prev].slice(0, 10);
        });

        // Clear pads after dim time
        due.forEach(({ pad }) => {
          setTimeout(() => {
            setActivePads(prev => {
              const n = { ...prev }; delete n[pad]; return n;
            });
          }, PAD_DIM_MS);
          setTimeout(() => {
            setPoppingPads(prev => { const n = new Set(prev); n.delete(pad); return n; });
          }, POP_MS);
        });
      }
    }
    rafRef.current = requestAnimationFrame(visualLoop);
  }, []);

  const start = useCallback(() => {
    const { ctx } = getCtx();
    playingRef.current = true;
    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.04;
    pendingVis.current = [];
    setBars(0); setStep(-1); setHitLog([]); setLastHit(null);
    schedRef.current = setInterval(runScheduler, SCHED_MS);
    rafRef.current = requestAnimationFrame(visualLoop);
    setPlaying(true);
  }, [getCtx, runScheduler, visualLoop]);

  const stop = useCallback(() => {
    playingRef.current = false;
    clearInterval(schedRef.current ?? undefined); schedRef.current = null;
    cancelAnimationFrame(rafRef.current ?? 0); rafRef.current = null;
    pendingVis.current = [];
    setPlaying(false); setStep(-1); setActivePads({});
    setPoppingPads(new Set()); setBars(0);
  }, []);

  const beatNum  = ((bars - 1) % 4) + 1;
  const barNum   = Math.ceil(bars / 4) || 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono','Courier New',monospace",
      background: "#060606",
      color: "#f0f0f0",
      minHeight: "100vh",
      padding: "20px",
      backgroundImage:
        "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.006) 3px,rgba(255,255,255,.006) 4px)," +
        "repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,.009) 31px,rgba(255,255,255,.009) 32px)",
      boxSizing: "border-box",
    }}>

      {/* ── Injected keyframes ─────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes padPop  { 0%{transform:scale(1)} 35%{transform:scale(1.055)} 100%{transform:scale(1)} }
        @keyframes logSlide{ from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline{ 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .pad-pop { animation: padPop 0.18s cubic-bezier(.22,.61,.36,1) forwards; }
        .log-entry { animation: logSlide 0.12s ease-out forwards; }
        ::-webkit-scrollbar{width:4px;background:#0a0a0a}
        ::-webkit-scrollbar-thumb{background:#1c1c1c}
      `}</style>

      {/* ── Scanline overlay ───────────────────────────────────────────────── */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:99, overflow:"hidden",
      }}>
        <div style={{
          position:"absolute", left:0, right:0, height:"2px",
          background:"rgba(163,230,53,0.03)",
          animation:"scanline 8s linear infinite",
        }} />
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"flex-end", justifyContent:"space-between",
        borderBottom:"3px solid #1c1c1c", paddingBottom:12, marginBottom:20,
        borderLeft:"3px solid #a3e635", paddingLeft:14,
      }}>
        <div>
          <div style={{ fontSize:8, letterSpacing:"0.4em", color:"#a3e635", textTransform:"uppercase", marginBottom:4 }}>
            R3 · NATIVE / INTRO SEQUENCE
          </div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, letterSpacing:"-0.02em", lineHeight:1 }}>
            BEAT PLAYER <span style={{ color:"#a3e635" }}>/</span> KEY POSITION MONITOR
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:8, letterSpacing:"0.25em", color:"rgba(255,255,255,0.25)", textTransform:"uppercase" }}>126 BPM · 16-STEP · SYNTHESIZED</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end", marginTop:4 }}>
            <div style={{
              width:8, height:14,
              background: playing ? "#a3e635" : "#1c1c1c",
              boxShadow: playing ? "0 0 8px #a3e635" : "none",
              animation: playing ? "blink 1s step-end infinite" : "none",
            }} />
            <span style={{ fontSize:9, letterSpacing:"0.2em", color: playing ? "#a3e635" : "#333", textTransform:"uppercase" }}>
              {playing ? "LIVE" : "STANDBY"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Transport bar ─────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:20 }}>
        {/* Play / Stop */}
        <button
          onClick={playing ? stop : start}
          disabled={disabled && !playing}
          style={{
            background: playing ? "#a3e635" : "transparent",
            color: playing ? "#060606" : (disabled ? "#333" : "#a3e635"),
            border:`2px solid ${disabled && !playing ? "#222" : "#a3e635"}`,
            padding:"12px 32px", fontSize:10,
            letterSpacing:"0.3em", textTransform:"uppercase",
            cursor: disabled && !playing ? "not-allowed" : "pointer",
            fontFamily:"inherit", fontWeight:700,
            boxShadow: playing ? "0 0 24px rgba(163,230,53,0.45)" : "none",
            transition:"all 0.08s",
            flexShrink: 0,
          }}
        >
          {playing ? "■  STOP" : disabled ? "ENGINE STANDBY" : "▶  PLAY INTRO"}
        </button>

        {/* Counters */}
        {[
          { label:"BAR",  val: playing ? barNum                : "—", big: true,  col:"#a3e635" },
          { label:"BEAT", val: playing ? beatNum               : "—", big: true,  col:"#f0f0f0" },
          { label:"STEP", val: playing && step >= 0 ? String(step+1).padStart(2,"0") : "—", big: false, col:"#555" },
        ].map(({ label, val, big, col }) => (
          <div key={label}>
            <div style={{ fontSize:7, letterSpacing:"0.3em", color:"rgba(255,255,255,0.25)", textTransform:"uppercase", marginBottom:2 }}>{label}</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize: big ? 32 : 26, color:col, lineHeight:1,
              textShadow: col === "#a3e635" && playing ? "0 0 18px rgba(163,230,53,0.5)" : "none",
            }}>{val}</div>
          </div>
        ))}

        {/* BPM ghost */}
        <div style={{
          marginLeft:"auto", fontFamily:"'Syne',sans-serif", fontWeight:800,
          fontSize:72, color:"transparent", WebkitTextStroke:"1px rgba(163,230,53,0.06)",
          lineHeight:1, userSelect:"none", letterSpacing:"-0.04em",
        }}>126</div>
      </div>

      {/* ── Step sequencer bar ────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:7, letterSpacing:"0.3em", color:"rgba(255,255,255,0.22)", textTransform:"uppercase", marginBottom:6 }}>
          STEP POSITION — BEAT GRID
        </div>
        <div style={{ display:"flex", gap:2 }}>
          {Array.from({ length: STEPS }, (_, s) => {
            const hits   = STEP_MAP[s];
            const active = s === step;
            return (
              <div key={s} style={{ flex:1, position:"relative" }}>
                <div style={{
                  height:32,
                  background: active
                    ? "#a3e635"
                    : hits.length ? "rgba(163,230,53,0.08)" : "rgba(255,255,255,0.03)",
                  border:`1px solid ${active ? "#a3e635" : hits.length ? "rgba(163,230,53,0.2)" : "#111"}`,
                  boxShadow: active ? "0 0 14px rgba(163,230,53,0.7)" : "none",
                  transition:"background 0.04s, box-shadow 0.04s",
                }} />
                {/* Category color dots for each hit in this step */}
                <div style={{ display:"flex", gap:1, justifyContent:"center", marginTop:2 }}>
                  {hits.slice(0,4).map((h, i) => (
                    <div key={i} style={{
                      width:4, height:4,
                      background: CATS[h.pad].color,
                      opacity: active ? 1 : 0.55,
                      boxShadow: active ? `0 0 4px ${CATS[h.pad].color}` : "none",
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* Beat markers */}
        <div style={{ display:"flex", marginTop:3 }}>
          {[1,2,3,4].map(b => (
            <div key={b} style={{ flex:4, fontSize:7, color:"rgba(255,255,255,0.18)", letterSpacing:"0.1em", paddingLeft:2 }}>{b}</div>
          ))}
        </div>
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:16 }}>

        {/* LEFT — pad grid ─────────────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize:7, letterSpacing:"0.3em", color:"rgba(255,255,255,0.22)", textTransform:"uppercase", marginBottom:8 }}>
            PAD GRID — SAMPLE EXECUTION POSITIONS
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:4 }}>
            {Array.from({ length:16 }, (_, i) => {
              const cat  = CATS[i];
              const vel  = activePads[i] ?? 0;
              const pop  = poppingPads.has(i);
              const hit  = vel > 0.04;
              const hasNote = BEAT.some(b => b.pad === i);
              const row  = Math.floor(i / 4) + 1;
              const col  = (i % 4) + 1;

              return (
                <div
                  key={i}
                  className={pop ? "pad-pop" : ""}
                  style={{
                    position:"relative", paddingTop:"90%",
                    background: hit
                      ? `rgba(${cat.rgb},${0.12 + vel * 0.52})`
                      : hasNote ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.018)",
                    border:`1px solid ${hit ? cat.color : hasNote ? "rgba(255,255,255,0.1)" : "#111"}`,
                    boxShadow: hit
                      ? `0 0 ${10 + vel * 22}px rgba(${cat.rgb},${vel * 0.8}), inset 0 0 ${vel * 14}px rgba(${cat.rgb},0.15)`
                      : "none",
                    transition:"background 0.06s, border-color 0.06s, box-shadow 0.05s",
                  }}
                >
                  <div style={{ position:"absolute", inset:0, padding:8, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                    {/* Top row: pad number + active dot */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <span style={{
                        fontSize:9, fontWeight:700, letterSpacing:"0.05em",
                        color: hit ? cat.color : "rgba(255,255,255,0.22)",
                        textShadow: hit ? `0 0 8px ${cat.color}` : "none",
                      }}>
                        {String(i+1).padStart(2,"0")}
                      </span>
                      {hasNote && (
                        <div style={{
                          width:5, height:5,
                          background: cat.color,
                          opacity: hit ? 1 : 0.35,
                          boxShadow: hit ? `0 0 6px ${cat.color}` : "none",
                        }} />
                      )}
                    </div>

                    {/* Bottom: category + velocity bar */}
                    <div>
                      <div style={{ fontSize:6, letterSpacing:"0.18em", color: hit ? cat.color : "rgba(255,255,255,0.18)", textTransform:"uppercase", lineHeight:1 }}>
                        {cat.label}
                      </div>
                      <div style={{ fontSize:6, letterSpacing:"0.1em", color:"rgba(255,255,255,0.18)", marginTop:1 }}>
                        R{row}·C{col}
                      </div>
                      <div style={{ marginTop:4, height:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                        <div style={{
                          height:"100%", width:`${vel * 100}%`,
                          background: cat.color,
                          transition:"width 0.04s",
                          boxShadow: hit ? `0 0 4px ${cat.color}` : "none",
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Radial glow overlay */}
                  {hit && (
                    <div style={{
                      position:"absolute", inset:0, pointerEvents:"none",
                      background:`radial-gradient(circle at 50% 40%, rgba(${cat.rgb},${vel * 0.25}) 0%, transparent 70%)`,
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:20, marginTop:10 }}>
            {[
              { label:"KICK",   color:"#ef4444" },
              { label:"SNARE",  color:"#f97316" },
              { label:"HI-HAT", color:"#a3e635" },
              { label:"PERC",   color:"#8b5cf6" },
            ].map(({ label, color }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, background:color }} />
                <span style={{ fontSize:7, letterSpacing:"0.2em", color:"rgba(255,255,255,0.35)", textTransform:"uppercase" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Pattern overview ─────────────────────────────────── */}
          <div style={{ marginTop:16, borderTop:"1px solid #1c1c1c", paddingTop:12 }}>
            <div style={{ fontSize:7, letterSpacing:"0.3em", color:"rgba(255,255,255,0.22)", textTransform:"uppercase", marginBottom:8 }}>
              PATTERN MAP — ALL 16 PADS
            </div>
            {["KICK","SNARE","HI-HAT","PERC"].map((cat, ri) => {
              const color = ["#ef4444","#f97316","#a3e635","#8b5cf6"][ri];
              const base  = ri * 4;
              const activeSteps = new Set(BEAT.filter(b => b.pad >= base && b.pad < base+4).map(b => b.step));
              return (
                <div key={cat} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <span style={{ fontSize:6, letterSpacing:"0.15em", color:"rgba(255,255,255,0.22)", textTransform:"uppercase", minWidth:44 }}>{cat}</span>
                  <div style={{ display:"flex", gap:1, flex:1 }}>
                    {Array.from({ length:16 }, (_, s) => {
                      const on  = activeSteps.has(s);
                      const cur = s === step;
                      return (
                        <div key={s} style={{
                          flex:1, height:10,
                          background: on ? (cur ? color : `${color}55`) : "rgba(255,255,255,0.04)",
                          boxShadow: on && cur ? `0 0 8px ${color}` : "none",
                          transition:"background 0.04s, box-shadow 0.04s",
                        }} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — key position monitor + hit log ───────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>

          {/* ── Live position display ──────────────────────────── */}
          <div style={{
            border:"1px solid #1c1c1c",
            borderTop:`3px solid ${lastHit ? CATS[lastHit.pad].color : "#1c1c1c"}`,
            background:"rgba(0,0,0,0.4)",
            padding:16, marginBottom:2,
            minHeight:168,
            position:"relative", overflow:"hidden",
          }}>
            <div style={{ fontSize:7, letterSpacing:"0.3em", color:"rgba(255,255,255,0.25)", textTransform:"uppercase", marginBottom:10 }}>
              KEY EXECUTION POSITION
            </div>
            {lastHit ? (() => {
              const c   = CATS[lastHit.pad];
              const row = Math.floor(lastHit.pad / 4) + 1;
              const col = (lastHit.pad % 4) + 1;
              return (
                <>
                  {/* Big pad number */}
                  <div style={{
                    fontFamily:"'Syne',sans-serif", fontWeight:800,
                    fontSize:52, lineHeight:1, letterSpacing:"-0.04em",
                    color: c.color,
                    textShadow:`0 0 28px rgba(${c.rgb},0.6)`,
                  }}>
                    PAD {String(lastHit.pad + 1).padStart(2,"0")}
                  </div>
                  <div style={{ fontSize:10, letterSpacing:"0.18em", color:c.color, textTransform:"uppercase", marginTop:2, fontWeight:600 }}>
                    {PAD_NAMES[lastHit.pad]}
                  </div>
                  <div style={{ display:"flex", gap:16, marginTop:8 }}>
                    <div>
                      <div style={{ fontSize:6, letterSpacing:"0.25em", color:"rgba(255,255,255,0.25)", textTransform:"uppercase" }}>POSITION</div>
                      <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em" }}>
                        ROW {row} / COL {col}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:6, letterSpacing:"0.25em", color:"rgba(255,255,255,0.25)", textTransform:"uppercase" }}>STEP</div>
                      <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em" }}>
                        {String(lastHit.step + 1).padStart(2,"0")} / 16
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:6, letterSpacing:"0.25em", color:"rgba(255,255,255,0.25)", textTransform:"uppercase" }}>MIDI VEL</div>
                      <div style={{ fontSize:11, fontWeight:600, color: c.color, letterSpacing:"0.1em" }}>
                        {Math.round(lastHit.vel * 127)}
                      </div>
                    </div>
                  </div>
                  {/* Velocity bar */}
                  <div style={{ marginTop:10, height:3, background:"rgba(255,255,255,0.06)" }}>
                    <div style={{
                      height:"100%", width:`${lastHit.vel * 100}%`,
                      background:`linear-gradient(90deg,${c.color},${c.color}aa)`,
                      boxShadow:`0 0 8px rgba(${c.rgb},0.7)`,
                      transition:"width 0.08s",
                    }} />
                  </div>
                  {/* Background glow */}
                  <div style={{
                    position:"absolute", inset:0, pointerEvents:"none",
                    background:`radial-gradient(ellipse at 50% 100%, rgba(${c.rgb},0.07) 0%, transparent 65%)`,
                  }} />
                </>
              );
            })() : (
              <div style={{ paddingTop:16 }}>
                <div style={{ fontSize:8, letterSpacing:"0.2em", color:"rgba(255,255,255,0.12)", textTransform:"uppercase" }}>
                  Awaiting trigger…
                </div>
                <div style={{ marginTop:8, fontSize:7, color:"rgba(255,255,255,0.08)", lineHeight:1.8 }}>
                  {["PAD 01 · KICK MAIN", "PAD 05 · SNARE", "PAD 09 · HH OPEN", "PAD 13 · RIM SHOT"].map(l => (
                    <div key={l}>{l}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Hit log ────────────────────────────────────────── */}
          <div style={{ border:"1px solid #111", background:"rgba(0,0,0,0.3)", flex:1 }}>
            <div style={{ padding:"8px 10px", borderBottom:"1px solid #111", fontSize:7, letterSpacing:"0.3em", color:"rgba(255,255,255,0.22)", textTransform:"uppercase" }}>
              LIVE HIT LOG
            </div>
            <div style={{ overflow:"hidden" }}>
              {hitLog.length === 0 ? (
                <div style={{ padding:"12px 10px", fontSize:8, letterSpacing:"0.15em", color:"rgba(255,255,255,0.1)", textTransform:"uppercase" }}>
                  No events yet
                </div>
              ) : hitLog.map((h, idx) => {
                const c = CATS[h.pad];
                return (
                  <div
                    key={h.id}
                    className="log-entry"
                    style={{
                      display:"flex", alignItems:"center", gap:8, padding:"5px 10px",
                      background: idx === 0 ? `rgba(${c.rgb},0.08)` : "transparent",
                      borderLeft:`2px solid ${idx === 0 ? c.color : "transparent"}`,
                      borderBottom:"1px solid rgba(255,255,255,0.03)",
                      opacity: Math.max(0.2, 1 - idx * 0.09),
                    }}
                  >
                    <span style={{ fontSize:7, color:"rgba(255,255,255,0.22)", minWidth:22 }}>
                      S{String(h.step+1).padStart(2,"0")}
                    </span>
                    <div style={{ width:5, height:5, background:c.color, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:8, fontWeight:600, letterSpacing:"0.1em", color: idx === 0 ? c.color : "rgba(255,255,255,0.55)", textTransform:"uppercase", lineHeight:1 }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize:7, color:"rgba(255,255,255,0.25)", lineHeight:1, marginTop:1 }}>
                        PAD {String(h.pad+1).padStart(2,"0")} · R{Math.floor(h.pad/4)+1}·C{(h.pad%4)+1}
                      </div>
                    </div>
                    <div style={{ fontSize:7, color:"rgba(255,255,255,0.22)", letterSpacing:"0.05em" }}>
                      {Math.round(h.vel * 127)}
                    </div>
                    <div style={{ display:"flex", gap:1 }}>
                      {Array.from({length:5}, (_, i) => (
                        <div key={i} style={{ width:2, height:8, background: i < Math.round(h.vel*5) ? c.color : "#1c1c1c" }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
