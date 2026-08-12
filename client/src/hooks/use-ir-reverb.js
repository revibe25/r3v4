/**
 * use-ir-reverb.ts
 * React hook managing IRReverbEngine lifecycle.
 * Auto-wires into loopEngine as parallel reverb return on engine ready.
 * Place IR .wav files in client/public/ir/ — see IR_CATALOG for preset names.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { IRReverbEngine, IR_CATALOG } from "../audio/effects/ir-reverb-engine";
import { getLoopEngine } from "../features/loopstation/engine/loopEngine";
export function useIRReverb() {
    const engineRef = useRef(new IRReverbEngine());
    const wiredRef = useRef(false);
    const pendingRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [wet, setWetState] = useState(0.35);
    const [currentPreset, setCurrentPreset] = useState(null);
    const wire = useCallback(() => {
        if (wiredRef.current)
            return;
        import("tone").then(Tone => {
            const rawCtx = Tone.getContext().rawContext;
            engineRef.current.init(rawCtx);
            const le = getLoopEngine();
            if (le.initialized) {
                engineRef.current.patchIntoLoopEngine(le);
                wiredRef.current = true;
            }
            if (pendingRef.current) {
                const url = pendingRef.current;
                pendingRef.current = null;
                void loadUrl(url);
            }
        }).catch(e => setError(String(e)));
    }, []);
    useEffect(() => {
        const le = getLoopEngine();
        if (le.initialized) {
            wire();
            return;
        }
        return le.on("ready", wire);
    }, [wire]);
    useEffect(() => () => engineRef.current.dispose(), []);
    const loadUrl = async (url) => {
        setLoading(true);
        setError(null);
        try {
            if (!wiredRef.current) {
                pendingRef.current = url;
                return;
            }
            await engineRef.current.load(url);
            setLoaded(true);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    };
    const loadFromUrl = useCallback(async (url) => {
        setCurrentPreset(null);
        await loadUrl(url);
    }, []);
    const loadPreset = useCallback(async (preset) => {
        setCurrentPreset(preset);
        await loadUrl(IR_CATALOG[preset]);
    }, []);
    const setWet = useCallback((w) => {
        engineRef.current.setWet(w);
        setWetState(w);
    }, []);
    const setPreGain = useCallback((g) => { engineRef.current.setPreGain(g); }, []);
    const dispose = useCallback(() => { engineRef.current.dispose(); setLoaded(false); }, []);
    return { loaded, loading, error, wet, currentPreset, loadPreset, loadFromUrl, setWet, setPreGain, dispose };
}
