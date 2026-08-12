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
const DEFAULT = {
    sourceTrackIndex: 0, amount: 0.7, attack: 0.003, release: 0.15,
};
export function useSidechain() {
    const [enabled, setEnabled] = useState(false);
    const [config, setConfig] = useState(DEFAULT);
    const cfgRef = useRef(DEFAULT);
    useEffect(() => {
        const e = getLoopEngine();
        const on = e.on("sidechainEnabled", () => setEnabled(true));
        const off = e.on("sidechainDisabled", () => setEnabled(false));
        return () => { on(); off(); };
    }, []);
    useEffect(() => {
        return () => { if (getLoopEngine().initialized)
            getLoopEngine().disableSidechain(); };
    }, []);
    const enable = useCallback((cfg) => {
        const c = { ...cfg,
            amount: Math.max(0, Math.min(1, cfg.amount)),
            attack: Math.max(0.0001, Math.min(1, cfg.attack)),
            release: Math.max(0.001, Math.min(2, cfg.release)),
        };
        cfgRef.current = c;
        setConfig(c);
        const engine = getLoopEngine();
        if (engine.initialized) {
            engine.enableSidechain(c.sourceTrackIndex, c.amount, c.attack, c.release);
            setEnabled(true);
        }
        else {
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
    const update = useCallback((partial) => {
        const next = { ...cfgRef.current, ...partial };
        cfgRef.current = next;
        setConfig(next);
        if (enabled && getLoopEngine().initialized) {
            getLoopEngine().enableSidechain(next.sourceTrackIndex, next.amount, next.attack, next.release);
        }
    }, [enabled]);
    const setAmount = useCallback((amount) => {
        update({ amount: Math.max(0, Math.min(1, amount)) });
    }, [update]);
    return { enabled, config, enable, disable, update, setAmount };
}
