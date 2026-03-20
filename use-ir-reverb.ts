/**
 * use-ir-reverb.ts
 *
 * React hook managing IRReverbEngine lifecycle.
 *
 * Auto-wires into loopEngine as a parallel reverb return when the engine
 * is ready. IR files are loaded lazily on first loadPreset() / loadFromUrl().
 *
 * Usage:
 *   const ir = useIRReverb();
 *   await ir.loadPreset('largeHall');   // triggers fetch + AudioContext decode
 *   ir.setWet(0.4);
 *
 * Notes:
 *   - Place IR .wav files in client/public/ir/ (see IR_CATALOG in ir-reverb-engine.ts)
 *   - Free IRs: OpenAIR (openairlib.net), Echothief (echothief.com)
 *   - Engine init happens inside a tone.getContext() call, so it's safe to
 *     call loadPreset before the user gesture triggers loopEngine.init() —
 *     the hook queues the load for when the engine is ready.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { IRReverbEngine, IRPreset, IR_CATALOG } from '../audio/effects/ir-reverb-engine';
import { getLoopEngine } from '../features/loopstation/engine/loopEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IRReverbHookState {
  loaded:         boolean;
  loading:        boolean;
  error:          string | null;
  wet:            number;
  currentPreset:  IRPreset | null;
  currentUrl:     string;
  loadPreset:     (preset: IRPreset) => Promise<void>;
  loadFromUrl:    (url: string) => Promise<void>;
  setWet:         (wet: number) => void;
  setPreGain:     (gain: number) => void;
  /** Disconnect and release all nodes. Called automatically on unmount. */
  dispose:        () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useIRReverb(): IRReverbHookState {
  const engineRef     = useRef<IRReverbEngine>(new IRReverbEngine());
  const wiredRef      = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);

  const [loaded,        setLoaded]        = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [wet,           setWetState]      = useState(0.35);
  const [currentPreset, setCurrentPreset] = useState<IRPreset | null>(null);
  const [currentUrl,    setCurrentUrl]    = useState('');

  // ── Wire into loopEngine ───────────────────────────────────────────────────

  const wireEngine = useCallback(() => {
    if (wiredRef.current) return;

    import('tone').then(Tone => {
      const rawCtx    = Tone.getContext().rawContext as AudioContext;
      const irEngine  = engineRef.current;
      irEngine.init(rawCtx);

      const loopEngine = getLoopEngine();
      if (loopEngine.initialized) {
        irEngine.patchIntoLoopEngine(loopEngine as any);
        wiredRef.current = true;
      }

      // If a load was requested before engine was ready, execute it now
      if (pendingUrlRef.current) {
        const url = pendingUrlRef.current;
        pendingUrlRef.current = null;
        void loadFromUrlInternal(url);
      }
    }).catch(err => {
      setError(`IR Reverb init failed: ${err}`);
    });
  }, []);   // eslint-disable-line

  useEffect(() => {
    const loopEngine = getLoopEngine();
    if (loopEngine.initialized) {
      wireEngine();
    } else {
      const off = loopEngine.on('ready', wireEngine);
      return off;
    }
  }, [wireEngine]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => engineRef.current.dispose();
  }, []);

  // ── Load helpers ───────────────────────────────────────────────────────────

  const loadFromUrlInternal = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!wiredRef.current) {
        // Engine not ready yet — queue
        pendingUrlRef.current = url;
        return;
      }
      await engineRef.current.load(url);
      setLoaded(true);
      setCurrentUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadFromUrl = useCallback(async (url: string) => {
    setCurrentPreset(null);
    await loadFromUrlInternal(url);
  }, []);   // eslint-disable-line

  const loadPreset = useCallback(async (preset: IRPreset) => {
    setCurrentPreset(preset);
    await loadFromUrlInternal(IR_CATALOG[preset]);
  }, []);   // eslint-disable-line

  // ── Parameter setters ──────────────────────────────────────────────────────

  const setWet = useCallback((w: number) => {
    engineRef.current.setWet(w);
    setWetState(w);
  }, []);

  const setPreGain = useCallback((gain: number) => {
    engineRef.current.setPreGain(gain);
  }, []);

  const dispose = useCallback(() => {
    engineRef.current.dispose();
    wiredRef.current = false;
    setLoaded(false);
  }, []);

  return {
    loaded,
    loading,
    error,
    wet,
    currentPreset,
    currentUrl,
    loadPreset,
    loadFromUrl,
    setWet,
    setPreGain,
    dispose,
  };
}
