#!/usr/bin/env python3
"""ASI Fix Script - Run this to fix auth.ts, trpc.ts, and instrument.tsx"""
import os

# Fix 1: auth.ts
auth_content = """import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionTier } from '@shared/schema';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username: string;
      email?: string;
      tier: SubscriptionTier;
    };
  }
}

export interface AuthPayload {
  id: string;
  username: string;
  email?: string;
  tier: SubscriptionTier;
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthPayload;
    req.user = payload;
  } catch {
    // ignore invalid token
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.tier !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
"""

# Fix 2: trpc.ts
trpc_content = """import { initTRPC } from '@trpc/server';
import type { Request } from 'express';
import { optionalAuth } from './middleware/auth';

export interface TRPCContext {
  req: Request;
  user?: Request['user'];
}

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
"""

# Fix 3: instrument.tsx - wired to real APIs
instrument_content = """import { useState, useRef, useEffect } from "react";
import { useTransportState } from "@/hooks/use-transport-state";
import { useAudioEngine } from "@/hooks/use-audio-engine";
import { useMidi } from "@/hooks/use-midi";
import { useDAWStore } from "@/hooks/useDAWStore";
import { trpc } from "@/lib/trpc";

export default function Instrument() {
  const { data: subscription } = trpc.subscription.getMySubscription.useQuery();
  const { data: trialStatus } = trpc.trial.status.useQuery();
  const transport = useTransportState();
  const audio = useAudioEngine();
  const midi = useMidi();
  const daw = useDAWStore();

  const [activeTab, setActiveTab] = useState("Instrument");
  const [bpm, setBpm] = useState(daw.bpm ?? 126);
  const [timelinePos, setTimelinePos] = useState(daw.position ?? 0);
  const [isPlaying, setIsPlaying] = useState(daw.playing ?? false);
  const [isRecording, setIsRecording] = useState(daw.recording ?? false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  useEffect(() => {
    setIsPlaying(daw.playing ?? false);
    setIsRecording(daw.recording ?? false);
    setTimelinePos(daw.position ?? 0);
    setBpm(daw.bpm ?? 126);
  }, [daw.playing, daw.recording, daw.position, daw.bpm]);

  const [octave, setOctave] = useState(0);
  const [sustain, setSustain] = useState(false);
  const [velocity, setVelocity] = useState(102);
  const [pitchBend, setPitchBend] = useState(0.0);
  const [modulation, setModulation] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [globalTune, setGlobalTune] = useState(0);
  const [curveType, setCurveType] = useState("LINEAR");
  const [showCurvePanel, setShowCurvePanel] = useState(true);

  const [swing, setSwing] = useState(18);
  const [selectedPad, setSelectedPad] = useState<number | null>(1);
  const [activeSteps, setActiveSteps] = useState<boolean[]>([
    true, false, false, false,
    true, false, false, false,
    true, false, true, false,
    true, false, false, false,
  ]);
  const [activePads, setActivePads] = useState<Record<number, boolean>>({});

  const [micOpen, setMicOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleTapTempo = () => {
    const now = Date.now();
    const newTapTimes = [...tapTimes.filter((t: number) => now - t < 3000), now];
    setTapTimes(newTapTimes);
    if (newTapTimes.length > 1) {
      const intervals = [];
      for (let i = 1; i < newTapTimes.length; i++) {
        intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.min(220, Math.max(40, Math.round(60000 / avgInterval)));
      setBpm(calculatedBpm);
      audio.setBpm?.(calculatedBpm);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      audio.stop?.();
    } else {
      audio.play?.();
    }
  };

  const toggleRecord = () => {
    audio.record?.();
  };

  const triggerPad = (padNum: number) => {
    setActivePads((prev: Record<number, boolean>) => ({ ...prev, [padNum]: true }));
    audio.triggerPad?.(padNum, velocity / 127);
    setTimeout(() => {
      setActivePads((prev: Record<number, boolean>) => ({ ...prev, [padNum]: false }));
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const noteMap: Record<string, number> = {
      a: 60, w: 61, s: 62, e: 63, d: 64,
      f: 65, t: 66, g: 67, y: 68, h: 69,
      u: 70, j: 71, k: 72, o: 73, l: 74,
    };
    const note = noteMap[key];
    if (note !== undefined) {
      audio.triggerKey?.(note - 60, octave, velocity / 127);
    }
  };

  const toggleStep = (idx: number) => {
    setActiveSteps((prev: boolean[]) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      if (audio.state?.fftData) {
        const data = audio.state.fftData;
        const barW = w / data.length;
        for (let i = 0; i < data.length; i++) {
          const barH = (data[i] / 255) * h * 0.8;
          ctx.fillStyle = "hsl(" + ((i / data.length) * 280 + 180) + ", 80%, 60%)";
          ctx.fillRect(i * barW, h - barH, barW - 1, barH);
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [audio.state?.fftData]);

  return (
    <div className="instrument-page" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="transport-bar">
        <div className="preset-selector">
          <span>{daw.midiPatterns?.[0]?.name ?? "SUNSET"}</span>
          <button onClick={() => {}}>◀</button>
          <button onClick={() => {}}>▶</button>
        </div>
        <div className="transport-controls">
          <button onClick={togglePlay} className={isPlaying ? "active" : ""}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={toggleRecord} className={isRecording ? "recording" : ""}>
            ⏺
          </button>
          <button onClick={handleTapTempo}>TAP</button>
          <span className="bpm-display">{bpm} BPM</span>
          <span className="timeline">{timelinePos.toFixed(1)}</span>
        </div>
        <div className="user-info">
          {subscription?.tier ?? "Free"}
          {trialStatus?.state === "active" && <span className="trial-badge">Trial</span>}
        </div>
      </div>
      <div className="workspace">
        <div className="sequencer-section">
          <canvas ref={canvasRef} width={800} height={200} className="visualizer" />
          <div className="step-sequencer">
            {activeSteps.map((on: boolean, idx: number) => (
              <button
                key={idx}
                className={"step " + (on ? "active " : "") + (idx % 4 === 0 ? "beat" : "")}
                onClick={() => toggleStep(idx)}
              />
            ))}
          </div>
        </div>
        <div className="drum-pads">
          {Array.from({ length: 16 }, (_, i) => (
            <button
              key={i}
              className={"drum-pad " + (activePads[i] ? "hit " : "") + (selectedPad === i ? "selected" : "")}
              onClick={() => triggerPad(i)}
              onMouseDown={() => setSelectedPad(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="controls-panel">
          <div className="control-group">
            <label>Octave</label>
            <button onClick={() => setOctave((o: number) => Math.max(-3, o - 1))}>-</button>
            <span>{octave}</span>
            <button onClick={() => setOctave((o: number) => Math.min(3, o + 1))}>+</button>
          </div>
          <div className="control-group">
            <label>Velocity</label>
            <input
              type="range"
              min={1}
              max={127}
              value={velocity}
              onChange={(e) => setVelocity(Number(e.target.value))}
            />
            <span>{velocity}</span>
          </div>
          <div className="control-group">
            <label>Swing</label>
            <input
              type="range"
              min={0}
              max={100}
              value={swing}
              onChange={(e) => setSwing(Number(e.target.value))}
            />
            <span>{swing}%</span>
          </div>
          <div className="control-group">
            <label>Pitch Bend</label>
            <input
              type="range"
              min={-100}
              max={100}
              value={pitchBend}
              onChange={(e) => setPitchBend(Number(e.target.value))}
            />
          </div>
          <div className="control-group">
            <label>Modulation</label>
            <input
              type="range"
              min={0}
              max={127}
              value={modulation}
              onChange={(e) => setModulation(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      <div className={"drawer " + (micOpen ? "open" : "")}>
        <button onClick={() => setMicOpen(!micOpen)}>Mic Input</button>
        {micOpen && (
          <div className="drawer-content">
            <p>MIDI Inputs: {midi.midiInputCount}</p>
            <p>Status: {midi.midiStatus}</p>
          </div>
        )}
      </div>
      <div className={"drawer " + (fxOpen ? "open" : "")}>
        <button onClick={() => setFxOpen(!fxOpen)}>FX Chain</button>
        {fxOpen && (
          <div className="drawer-content">
            <p>FX Chain: {daw.tracks?.length ?? 0} tracks</p>
            <p>Master Gain: {daw.masterGain?.toFixed(2) ?? "0.00"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
"""

# Write files
base = "/home/r3v/Stable"

with open(f"{base}/server/middleware/auth.ts", "w") as f:
    f.write(auth_content)
print("✓ auth.ts fixed")

with open(f"{base}/server/trpc.ts", "w") as f:
    f.write(trpc_content)
print("✓ trpc.ts fixed")

with open(f"{base}/client/src/pages/instrument.tsx", "w") as f:
    f.write(instrument_content)
print("✓ instrument.tsx fixed")

print("\nRun: cd /home/r3v/Stable/client && pnpm check")
