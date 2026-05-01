// ─── RGBRing v2 — Enhanced State Animations ──────────────────────────────────
import { motion } from 'framer-motion';
import React from 'react';
import type { TrackState } from '../types/loopstation.types';

interface Props {
  state: TrackState;
  bpm: number;
  color?: string;
}

const CFG: Record<TrackState, { op: number; bl: number; spin: number; pulseSpeed?: number }> = {
  idle:           { op: 0.05, bl: 2,  spin: 0 },
  stopped:        { op: 0.08, bl: 2,  spin: 0 },
  recording:      { op: 0.92, bl: 9,  spin: 0, pulseSpeed: 0.6 },
  overdubbing:    { op: 0.78, bl: 6,  spin: 3, pulseSpeed: 0.35 },
  playing:        { op: 0.82, bl: 5,  spin: 6 },
  waiting_record: { op: 0.55, bl: 5,  spin: 0, pulseSpeed: 0.25 },
  waiting_play:   { op: 0.45, bl: 4,  spin: 0, pulseSpeed: 0.4 },
};

const GRAD: Record<TrackState, string> = {
  idle:           'conic-gradient(#0f0f0f, #181818, #0f0f0f)',
  stopped:        'conic-gradient(#131313, #1e1e1e, #131313)',
  recording:      'conic-gradient(#ff1a1a, #cc0000, #990000, #cc0000, #ff1a1a)',
  overdubbing:    'conic-gradient(#ff6b00, #ea4500, #ff8c00, #ff6b00)',
  playing:        'conic-gradient(#32cd32, #22d3ee, #4ade80, #84cc16, #22d3ee, #32cd32)',
  waiting_record: 'conic-gradient(#ff1a1a88, #66000088, #ff1a1a88)',
  waiting_play:   'conic-gradient(#32cd3266, #22d3ee44, #32cd3266)',
};

const INNER_GLOW: Partial<Record<TrackState, string>> = {
  recording:      'radial-gradient(circle at 50% 60%, rgba(255,26,26,0.55) 0%, transparent 65%)',
  overdubbing:    'radial-gradient(circle at 50% 60%, rgba(255,107,0,0.45) 0%, transparent 65%)',
  playing:        'radial-gradient(circle at 50% 60%, rgba(57,255,20,0.12) 0%, transparent 60%)',
  waiting_record: 'radial-gradient(circle at 50% 50%, rgba(255,26,26,0.3) 0%, transparent 70%)',
  waiting_play:   'radial-gradient(circle at 50% 50%, rgba(57,255,20,0.2) 0%, transparent 70%)',
};

// Corner scan line for recording
const ScanLine: React.FC = () => (
  <motion.div
    style={{
      position: 'absolute', left: 0, right: 0, height: 1,
      background: 'linear-gradient(90deg, transparent, rgba(255,26,26,0.6), transparent)',
      pointerEvents: 'none',
    }}
    animate={{ top: ['0%', '100%', '0%'] }}
    transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
  />
);

export const RGBRing: React.FC<Props> = ({ state, bpm }) => {
  const _c = CFG[state] ?? CFG.idle;
  const _spinDuration = c.spin > 0 ? (60 / bpm) * c.spin : 0;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'hidden' }}>
      {/* Main spinning gradient ring */}
      <motion.div
        className="absolute inset-0"
        animate={c.spin > 0 ? { rotate: 360 } : { rotate: 0 }}
        transition={c.spin > 0
          ? { repeat: Infinity, duration: spinDuration, ease: 'linear' }
          : { duration: 0.3, ease: 'easeOut' }
        }
        style={{ background: GRAD[state], opacity: c.op, filter: `blur(${c.bl}px)` }}
      />

      {/* Inner radial glow */}
      {INNER_GLOW[state] && (
        <motion.div
          className="absolute inset-0"
          animate={c.pulseSpeed ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
          transition={c.pulseSpeed
            ? { repeat: Infinity, duration: c.pulseSpeed, ease: 'easeInOut' }
            : {}}
          style={{ background: INNER_GLOW[state] }}
        />
      )}

      {/* Recording scan line */}
      {state === 'recording' && <ScanLine />}

      {/* Overdub shimmer */}
      {state === 'overdubbing' && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.1, 0.35, 0.1] }}
          transition={{ repeat: Infinity, duration: 0.3, ease: 'easeInOut' }}
          style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.4) 0%, transparent 50%, rgba(255,107,0,0.2) 100%)' }}
        />
      )}

      {/* Playing beat shimmer - subtle edge highlight */}
      {state === 'playing' && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ repeat: Infinity, duration: (60 / bpm), ease: 'easeOut' }}
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.5) 0%, transparent 50%)',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Waiting states: dashed border pulse */}
      {(state === 'waiting_record' || state === 'waiting_play') && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
          style={{
            border: `2px dashed ${state === 'waiting_record' ? '#ff1a1a' : '#32cd32'}`,
            background: 'transparent',
          }}
        />
      )}
    </div>
  );
};