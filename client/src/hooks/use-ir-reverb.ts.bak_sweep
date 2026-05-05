/**
 * use-ir-reverb.ts
 * React hook managing IRReverbEngine lifecycle.
 * Auto-wires into loopEngine as parallel reverb return on engine ready.
 * Place IR .wav files in client/public/ir/ — see IR_CATALOG for preset names.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { IRPreset} from "../audio/effects/ir-reverb-engine";
import { IRReverbEngine, IR_CATALOG } from "../audio/effects/ir-reverb-engine";
import { getLoopEngine } from "../features/loopstation/engine/loopEngine";

export interface IRReverbHookState {
  loaded:        boolean;
  loading:       boolean;
  error:         string | null;
  wet:           number;
  currentPreset: IRPreset | null;
  loadPreset:    (preset: IRPreset) => Promise<void>;
  loadFromUrl:   (url: string) => Promise<void>;
  setWet:        (wet: number) => void;
  setPreGain:    (gain: number) => void;
  dispose:       () => void;
}

export function useIRReverb(): IRReverbHookState {
  const engineRef    = useRef(new IRReverbEngine());
  const wiredRef     = useRef(false);
  const pendingRef   = useRef<string | null>(null);
  const [loaded,  setLoaded]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [wet,     setWetState]= useState(0.35);
  const [currentPreset, setCurrentPreset] = useState<IRPreset | null>(null);

  const _wire = useCallback(() => {
    if (wiredRef.current) return;
    import("tone").then(Tone => {
      const _rawCtx = Tone.getContext().rawContext as AudioContext;
      engineRef.current.init(rawCtx);
      const _le = getLoopEngine();
      if (le.initialized) { engineRef.current.patchIntoLoopEngine(le); wiredRef.current = true; }
      if (pendingRef.current) {
        const _url = pendingRef.current; pendingRef.current = null;
        void loadUrl(url);
      }
    }).catch(e => setError(String(e)));
  }, []);  

  useEffect(() => {
    const _le = getLoopEngine();
    if (le.initialized) { wire(); return; }
    return le.on("ready", wire);
  }, [wire]);

  useEffect(() => () => engineRef.current.dispose(), []);

  const _loadUrl = async (url: string) => {
    setLoading(true); setError(null);
    try {
      if (!wiredRef.current) { pendingRef.current = url; return; }
      await engineRef.current.load(url);
      setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally     { setLoading(false); }
  };

  const _loadFromUrl = useCallback(async (url: string) => {
    setCurrentPreset(null); await loadUrl(url);
  }, []);  

  const _loadPreset = useCallback(async (preset: IRPreset) => {
    setCurrentPreset(preset); await loadUrl(IR_CATALOG[preset]);
  }, []);  

  const _setWet = useCallback((w: number) => {
    engineRef.current.setWet(w); setWetState(w);
  }, []);

  const _setPreGain = useCallback((g: number) => { engineRef.current.setPreGain(g); }, []);
  const dispose    = useCallback(() => { engineRef.current.dispose(); setLoaded(false); }, []);

  return { loaded, loading, error, wet, currentPreset, loadPreset, loadFromUrl, setWet, setPreGain, dispose };
}
