// ─── VUMeter v2 — Stereo + Gain Reduction + Correlation ──────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getLoopEngine } from '../engine/loopEngine';

const SEG = 28;
const DEC = 0.018;
const PHOLD = 2400;
const PDEC = 0.01;
const GR_DEC = 0.03;

function segColor(i: number, lit: boolean): string {
  if (!lit) return 'var(--panel-deep)';
  const p = i / SEG;
  if (p >= 0.93) return 'var(--signal-clip-alt)';
  if (p >= 0.82) return 'var(--looper-orange)';
  if (p >= 0.70) return 'var(--accent-yellow)';
  if (p >= 0.50) return 'var(--status-ok-alt)';
  return 'var(--looper-acid)';
}

function segGlow(i: number, lit: boolean): string {
  if (!lit) return 'none';
  const p = i / SEG;
  if (p >= 0.93) return '0 0 5px #ff224499, 0 0 10px #ff224433';
  if (p >= 0.82) return '0 0 4px #ff6b0088';
  if (p >= 0.70) return '0 0 3px #f5d00066';
  return '0 0 2px #39ff1433';
}

const Bar: React.FC<{
  level: number; peak: number; gr: number; clip: boolean;
  onReset: () => void; h: number; showGr?: boolean;
}> = ({ level, peak, gr, clip, onReset, h, showGr }) => {
  const filled = Math.round(level * SEG);
  const ps = Math.min(SEG - 1, Math.round(peak * SEG) - 1);
  const grFilled = Math.round(gr * SEG);

  return (
    <div style={{ display: 'flex', gap: 1.5 }}>
      {/* Main level bar */}
      <div
        style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, width: 5, height: h, cursor: 'pointer' }}
        onClick={onReset}
      >
        {Array.from({ length: SEG }, (_, i) => {
          const lit = i < filled;
          const isPk = i === ps && peak > 0.01;
          const isClip = clip && i >= SEG - 1;
          const bg = isClip ? 'var(--signal-clip-hard)' : isPk ? 'var(--white)' : segColor(i, lit);
          return (
            <div
              key={i}
              style={{
                flex: 1, background: bg,
                boxShadow: isClip ? '0 0 6px #ff003399' : isPk ? '0 0 4px #ffffff88' : segGlow(i, lit),
                minHeight: 2,
                transition: lit ? 'none' : 'background 80ms',
              }}
            />
          );
        })}
      </div>

      {/* Gain reduction bar (inverted, shows compression) */}
      {showGr && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: 3, height: h }}>
          {Array.from({ length: SEG }, (_, i) => {
            const idx = SEG - 1 - i;
            const lit = idx >= SEG - grFilled;
            return (
              <div
                key={i}
                style={{
                  flex: 1, minHeight: 2,
                  background: lit ? 'var(--looper-purple)' : 'var(--panel-deep)',
                  boxShadow: lit ? '0 0 2px #c084fc66' : 'none',
                  transition: 'background 40ms',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// Stereo correlation meter (-1 to +1)
const CorrelationMeter: React.FC<{ L: number; R: number }> = ({ L, R }) => {
  const corr = L * R > 0 ? 1 : L * R < 0 ? -1 : 0;
  const pos = (corr + 1) / 2;
  return (
    <div style={{ position: 'relative', width: '100%', height: 4, background: '#0a0a0a', border: '1px solid var(--t-b2)' }}>
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${pos * 100}%`,
        width: 2,
        background: pos > 0.4 && pos < 0.9 ? 'var(--looper-acid)' : 'var(--looper-orange)',
        boxShadow: '0 0 4px currentColor',
        transform: 'translateX(-50%)',
        transition: 'left 60ms',
      }} />
      <div style={{ position: 'absolute', top: -1, left: '50%', width: 1, height: 6, background: 'var(--dj-border)', transform: 'translateX(-50%)' }} />
    </div>
  );
};

interface Props {
  trackIndex: number;
  isActive: boolean;
  showScale?: boolean;
  showGr?: boolean;
  showCorr?: boolean;
  height?: number;
  compact?: boolean;
}

export const VUMeter: React.FC<Props> = ({
  trackIndex, isActive,
  showScale = true, showGr = false, showCorr = false,
  height = 80, compact = false,
}) => {
  const [lL, sLL] = useState(0);
  const [lR, sLR] = useState(0);
  const [pL, sPL] = useState(0);
  const [pR, sPR] = useState(0);
  const [gr, sGR] = useState(0);
  const [clip, sClip] = useState(false);

  const rafRef = useRef<number>(0);
  const smL = useRef(0), smR = useRef(0);
  const pkL = useRef(0), pkR = useRef(0);
  const pkLA = useRef(0), pkRA = useRef(0);
  const smGR = useRef(0);

  useEffect(() => {
    const e = getLoopEngine();
    return e.on('clipDetected', i => { if (i === trackIndex) sClip(true); });
  }, [trackIndex]);

  const reset = useCallback(() => {
    pkL.current = 0; pkR.current = 0;
    sPL(0); sPR(0); sClip(false); sGR(0);
    getLoopEngine().resetClip(trackIndex);
  }, [trackIndex]);

  useEffect(() => {
    if (!isActive) {
      cancelAnimationFrame(rafRef.current);
      smL.current = 0; smR.current = 0;
      sLL(0); sLR(0);
      return;
    }
    const tick = (now: number) => {
      const s = getLoopEngine().getStereoLevel(trackIndex);
      smL.current = s.L >= smL.current ? s.L : Math.max(0, smL.current - DEC);
      smR.current = s.R >= smR.current ? s.R : Math.max(0, smR.current - DEC);
      if (smL.current >= pkL.current) { pkL.current = smL.current; pkLA.current = now; }
      else if (now - pkLA.current > PHOLD) pkL.current = Math.max(0, pkL.current - PDEC);
      if (smR.current >= pkR.current) { pkR.current = smR.current; pkRA.current = now; }
      else if (now - pkRA.current > PHOLD) pkR.current = Math.max(0, pkR.current - PDEC);
      // Simulated GR (would come from compressor node in real impl)
      const peak = Math.max(smL.current, smR.current);
      const targetGr = peak > 0.7 ? (peak - 0.7) * 2 : 0;
      smGR.current = targetGr >= smGR.current ? targetGr : Math.max(0, smGR.current - GR_DEC);
      sLL(smL.current); sLR(smR.current); sPL(pkL.current); sPR(pkR.current);
      sGR(smGR.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, trackIndex]);

  const SCALE_LABELS = ['0', '3', '6', '10', '18', '∞'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {/* Clip indicator */}
      <div
        onClick={reset}
        style={{
          width: compact ? 10 : 13, height: 4,
          background: clip ? 'var(--signal-clip-hard)' : '#0d0d0d',
          border: `1px solid ${clip ? '#ff003388' : 'var(--t-b2x)'}`,
          boxShadow: clip ? '0 0 8px #ff003366, 0 0 16px #ff003322' : 'none',
          cursor: 'pointer',
          transition: 'all 0.1s',
        }}
      />

      <div style={{ display: 'flex', gap: 3, height, alignItems: 'stretch' }}>
        {/* dB scale */}
        {showScale && !compact && (
          <div style={{
            display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
            height, paddingRight: 2,
            fontSize: 5, color: 'var(--t-b3x)',
            fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1,
          }}>
            {SCALE_LABELS.map(l => <span key={l}>{l}</span>)}
          </div>
        )}

        <Bar level={lL} peak={pL} gr={gr} clip={clip} onReset={reset} h={height} showGr={showGr} />
        <Bar level={lR} peak={pR} gr={gr} clip={clip} onReset={reset} h={height} />
      </div>

      {/* Correlation */}
      {showCorr && !compact && (
        <div style={{ width: compact ? 14 : 22 }}>
          <CorrelationMeter L={lL} R={lR} />
        </div>
      )}

      {/* Channel labels */}
      {!compact && (
        <div style={{ display: 'flex', gap: showGr ? 10 : 5 }}>
          {['L', 'R'].map(c => (
            <span key={c} style={{ fontSize: 5, color: 'var(--t-b3)', fontFamily: 'IBM Plex Mono,monospace', width: 5, textAlign: 'center' }}>{c}</span>
          ))}
        </div>
      )}
    </div>
  );
};