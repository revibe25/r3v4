// @ts-nocheck
// client/src/hooks/useFXChain.ts
// React hook that wires FXChain lifecycle to component state
import { useEffect, useRef, useState, useCallback } from 'react';
import { FXChain } from '@/audio/fx/fx-chain';
export function useFXChain(connectTo, initialData) {
    const chainRef = useRef(null);
    const [state, setState] = useState({
        effects: [],
        bypassed: {},
        wetLevels: {},
        preGain: 1,
        postGain: 1,
    });
    // Sync state from chain after any mutation
    const syncState = useCallback(() => {
        const chain = chainRef.current;
        if (!chain)
            return;
        const bypassed = {};
        const wetLevels = {};
        // Access internal slots via the public slot getter
        chain.effects.forEach(fx => {
            const slot = chain.getSlot(fx.id);
            if (slot) {
                bypassed[fx.id] = slot.bypass;
                wetLevels[fx.id] = slot.wet;
            }
        });
        setState({
            effects: chain.effects,
            bypassed,
            wetLevels,
            preGain: chain.preGain.gain.value,
            postGain: chain.postGain.gain.value,
        });
    }, []);
    // Create chain on mount
    useEffect(() => {
        const chain = new FXChain();
        chainRef.current = chain;
        // Restore from serialized data if provided
        if (initialData) {
            FXChain.deserialize(initialData).then(restored => {
                chain.dispose();
                chainRef.current = restored;
                if (connectTo)
                    restored.connect(connectTo);
                restored.on(syncState);
                syncState();
            }).catch(console.error);
        }
        else {
            if (connectTo)
                chain.connect(connectTo);
        }
        const unsub = chain.on((payload) => {
            syncState();
        });
        syncState();
        return () => {
            unsub();
            chain.dispose();
            chainRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Re-wire output if connectTo changes
    useEffect(() => {
        const chain = chainRef.current;
        if (!chain || !connectTo)
            return;
        chain.disconnect();
        chain.connect(connectTo);
    }, [connectTo]);
    const addFX = useCallback((fx, index, options) => {
        chainRef.current?.addFX(fx, index, options);
    }, []);
    const removeFX = useCallback((fxId) => {
        chainRef.current?.removeFX(fxId);
    }, []);
    const moveFX = useCallback((from, to) => {
        chainRef.current?.moveFX(from, to);
    }, []);
    const setBypass = useCallback((fxId, bypass) => {
        chainRef.current?.setBypass(fxId, bypass);
        syncState();
    }, [syncState]);
    const toggleBypass = useCallback((fxId) => {
        chainRef.current?.toggleBypass(fxId);
        syncState();
    }, [syncState]);
    const setWet = useCallback((fxId, wet) => {
        chainRef.current?.setWet(fxId, wet);
        syncState();
    }, [syncState]);
    const setPreGain = useCallback((value) => {
        chainRef.current?.setPreGain(value);
        syncState();
    }, [syncState]);
    const setPostGain = useCallback((value) => {
        chainRef.current?.setPostGain(value);
        syncState();
    }, [syncState]);
    const clear = useCallback(() => {
        chainRef.current?.clear();
    }, []);
    const serialize = useCallback(() => {
        return chainRef.current?.serialize() ?? null;
    }, []);
    return {
        chain: chainRef.current,
        ...state,
        addFX,
        removeFX,
        moveFX,
        setBypass,
        toggleBypass,
        setWet,
        setPreGain,
        setPostGain,
        clear,
        serialize,
    };
}
