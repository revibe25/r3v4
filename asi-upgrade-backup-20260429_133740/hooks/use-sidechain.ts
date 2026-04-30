/**
 * use-sidechain.ts
 * React hook over loopEngine's real envelope-follower sidechain (v3).
 *
 * loopEngine already has full sidechain: Transport.scheduleRepeat at 16n,
 * reads source analyser RMS, IIR smoothing, drives sidechainGain in master chain.
 * This hook just exposes it cleanly with React state + event sync.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getLoopEngine } from "../features/loopstation/engine/loopEngine";

export interface SidechainConfig {
  sourceTrackIndex: number;
  amount:  number;  // 0-1 duck depth
  attack:  number;  // seconds, default 0.003
  release: number;  // seconds, default 0.15
}

export interface SidechainState {
  enabled:   boolean;
  config:    SidechainConfig;
  enable:    (cfg: SidechainConfig) => void;
  disable:   () => void;
  update:    (partial: Partial<SidechainConfig>) => void;
  setAmount: (amount: number) => void;
}

const DEFAULT: SidechainConfig = {
  sourceTrackIndex: 0, amount: 0.7, attack: 0.003, release: 0.15,
};

export function useSidechain(): SidechainState {
  const [enabled, setEnabled] = useState(false);
  const [config,  setConfig]  = useState<SidechainConfig>(DEFAULT);
  const cfgRef                = useRef<SidechainConfig>(DEFAULT);

  useEffect(() => {
    const e   = getLoopEngine();
    const on  = e.on("sidechainEnabled",  () => setEnabled(true));
    const off = e.on("sidechainDisabled", () => setEnabled(false));
    return () => { on(); off(); };
  }, []);

  useEffect(() => {
    return () => { if (getLoopEngine().initialized) getLoopEngine().disableSidechain(); };
  }, []);

  const enable = useCallback((cfg: SidechainConfig) => {
    const c = { ...cfg,
      amount:  Math.max(0, Math.min(1, cfg.amount)),
      attack:  Math.max(0.0001, Math.min(1, cfg.attack)),
      release: Math.max(0.001,  Math.min(2, cfg.release)),
    };
    cfgRef.current = c;
    setConfig(c);
    const engine = getLoopEngine();
    if (engine.initialized) {
      engine.enableSidechain(c.sourceTrackIndex, c.amount, c.attack, c.release);
      setEnabled(true);
    } else {
      const off = engine.on("ready", () => {
        engine.enableSidechain(c.sourceTrackIndex, c.amount, c.attack, c.release);
        off();
      });
    }
  }, []);

  const disable = useCallback(() => {
    getLoopEngine().disableSidechain();
    setEnabled(false);
  }, []);

  const update = useCallback((partial: Partial<SidechainConfig>) => {
    const next = { ...cfgRef.current, ...partial };
    cfgRef.current = next;
    setConfig(next);
    if (enabled && getLoopEngine().initialized) {
      getLoopEngine().enableSidechain(next.sourceTrackIndex, next.amount, next.attack, next.release);
    }
  }, [enabled]);

  const setAmount = useCallback((amount: number) => {
    update({ amount: Math.max(0, Math.min(1, amount)) });
  }, [update]);

  return { enabled, config, enable, disable, update, setAmount };
}
