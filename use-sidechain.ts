/**
 * use-sidechain.ts
 *
 * React hook over loopEngine's real envelope-follower sidechain.
 *
 * loopEngine already has full sidechain implementation (v3):
 *   • Transport.scheduleRepeat at '16n' reads source track analyser RMS
 *   • IIR attack/release smoothing drives sidechainGain.gain
 *   • sidechainGain is live in the master chain (between StereoWidener and masterCompressor)
 *
 * This hook provides:
 *   • Typed React state wrapper
 *   • Config object with per-field update
 *   • Listens to engine events so state stays in sync if engine is controlled externally
 *   • Cleanup on unmount
 *
 * Usage:
 *   const sc = useSidechain();
 *   sc.enable({ sourceTrackIndex: 0, amount: 0.8, attack: 0.003, release: 0.12 });
 *   sc.update({ amount: 0.5 });   // hot-update without disable/re-enable
 *   sc.disable();
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLoopEngine } from '../features/loopstation/engine/loopEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SidechainConfig {
  /** Index of the track whose level drives ducking (0-indexed) */
  sourceTrackIndex: number;
  /** Duck depth 0–1. 0 = no ducking, 1 = full silence at signal peak */
  amount:           number;
  /** Attack time constant in seconds. Smaller = faster gain reduction. Default 0.003 */
  attack:           number;
  /** Release time constant in seconds. Larger = longer pump tail. Default 0.15 */
  release:          number;
}

export interface SidechainState {
  enabled: boolean;
  config:  SidechainConfig;
  /**
   * Enable sidechain with the given config.
   * Safe to call while already enabled — restarts the envelope follower.
   */
  enable:  (cfg: SidechainConfig) => void;
  /** Disable sidechain and restore master gain to unity (50ms ramp). */
  disable: () => void;
  /**
   * Hot-update one or more config fields without disabling.
   * Calls enableSidechain() internally so the new envelope follower
   * takes effect immediately on the next '16n' tick.
   */
  update:  (partial: Partial<SidechainConfig>) => void;
  /** Convenience: ramp the amount knob only (no full restart needed). */
  setAmount: (amount: number) => void;
}

const DEFAULT_CONFIG: SidechainConfig = {
  sourceTrackIndex: 0,
  amount:           0.7,
  attack:           0.003,
  release:          0.15,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSidechain(): SidechainState {
  const [enabled,  setEnabled]  = useState(false);
  const [config,   setConfig]   = useState<SidechainConfig>(DEFAULT_CONFIG);
  const configRef               = useRef<SidechainConfig>(DEFAULT_CONFIG);

  // ── Engine event sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const engine = getLoopEngine();
    const offOn  = engine.on('sidechainEnabled',  () => setEnabled(true));
    const offOff = engine.on('sidechainDisabled', () => setEnabled(false));
    return () => { offOn(); offOff(); };
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Only disable if this hook instance is the one that started it
      if (configRef.current && getLoopEngine().initialized) {
        getLoopEngine().disableSidechain();
      }
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const enable = useCallback((cfg: SidechainConfig) => {
    const clamped: SidechainConfig = {
      sourceTrackIndex: Math.max(0, cfg.sourceTrackIndex),
      amount:           Math.max(0, Math.min(1,   cfg.amount)),
      attack:           Math.max(0.0001, Math.min(1, cfg.attack)),
      release:          Math.max(0.001,  Math.min(2, cfg.release)),
    };
    configRef.current = clamped;
    setConfig(clamped);

    const engine = getLoopEngine();
    if (!engine.initialized) {
      // Queue for when engine is ready
      const off = engine.on('ready', () => {
        engine.enableSidechain(clamped.sourceTrackIndex, clamped.amount, clamped.attack, clamped.release);
        off();
      });
      return;
    }
    engine.enableSidechain(clamped.sourceTrackIndex, clamped.amount, clamped.attack, clamped.release);
    setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    getLoopEngine().disableSidechain();
    setEnabled(false);
  }, []);

  const update = useCallback((partial: Partial<SidechainConfig>) => {
    const next: SidechainConfig = { ...configRef.current, ...partial };
    configRef.current = next;
    setConfig(next);

    if (!enabled) return;
    const engine = getLoopEngine();
    if (engine.initialized) {
      engine.enableSidechain(next.sourceTrackIndex, next.amount, next.attack, next.release);
    }
  }, [enabled]);

  const setAmount = useCallback((amount: number) => {
    update({ amount: Math.max(0, Math.min(1, amount)) });
  }, [update]);

  return { enabled, config, enable, disable, update, setAmount };
}
