// @ts-nocheck
// client/src/hooks/useFXChain.ts
// React hook that wires FXChain lifecycle to component state

import { useEffect, useRef, useState, useCallback } from 'react';
import type { FXChainEventPayload, SerializedFXChain } from '@/audio/fx/fx-chain';
import { FXChain } from '@/audio/fx/fx-chain';
import type { FXNodeBase } from '../audio/fx/fx-nodebase';

export interface FXChainState {
  effects:   readonly FXNodeBase[];
  bypassed:  Record<string, boolean>;
  wetLevels: Record<string, number>;
  preGain:   number;
  postGain:  number;
}

export interface UseFXChainReturn extends FXChainState {
  chain:        FXChain | null;
  addFX:        (fx: FXNodeBase, index?: number, options?: { bypass?: boolean; wet?: number }) => void;
  removeFX:     (fxId: string) => void;
  moveFX:       (from: number, to: number) => void;
  setBypass:    (fxId: string, bypass: boolean) => void;
  toggleBypass: (fxId: string) => void;
  setWet:       (fxId: string, wet: number) => void;
  setPreGain:   (value: number) => void;
  setPostGain:  (value: number) => void;
  clear:        () => void;
  serialize:    () => SerializedFXChain | null;
}

export function useFXChain(
  connectTo?: AudioNode | null,
  initialData?: SerializedFXChain,
): UseFXChainReturn {
  const chainRef = useRef<FXChain | null>(null);

  const [state, setState] = useState<FXChainState>({
    effects:   [],
    bypassed:  {},
    wetLevels: {},
    preGain:   1,
    postGain:  1,
  });

  // Sync state from chain after any mutation
  const syncState = useCallback(() => {
    const chain = chainRef.current;
    if (!chain) return;

    const bypassed:  Record<string, boolean> = {};
    const wetLevels: Record<string, number>  = {};

    // Access internal slots via the public slot getter
    (chain as any).effects.forEach(fx => {
      const slot = chain.getSlot(fx.id);
      if (slot) {
        bypassed[fx.id]  = slot.bypass;
        wetLevels[fx.id] = slot.wet;
      }
    });

    setState({
      effects:   (chain as any).effects,
      bypassed,
      wetLevels,
      preGain:   (chain as any).preGain.gain.value,
      postGain:  (chain as any).postGain.gain.value,
    });
  }, []);

  // Create chain on mount
  useEffect(() => {
    const chain = new FXChain();
    chainRef.current = chain;

    // Restore from serialized data if provided
    if (initialData) {
      (FXChain as any).deserialize(initialData).then(restored => {
        (chain as any).dispose();
        chainRef.current = restored;
        if (connectTo) restored.connect(connectTo);
        restored.on(syncState as any);
        syncState();
      }).catch(console.error);
    } else {
      if (connectTo) (chain as any).connect(connectTo);
    }

    const unsub = (chain as any).on((payload: FXChainEventPayload) => {
      syncState();
    });

    syncState();

    return () => {
      unsub();
      (chain as any).dispose();
      chainRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-wire output if connectTo changes
  useEffect(() => {
    const chain = chainRef.current;
    if (!chain || !connectTo) return;
    (chain as any).disconnect();
    (chain as any).connect(connectTo);
  }, [connectTo]);

  const addFX = useCallback((fx: FXNodeBase, index?: number, options?: { bypass?: boolean; wet?: number }) => {
    chainRef.current?.addFX(fx, index, options);
  }, []);

  const removeFX = useCallback((fxId: string) => {
    chainRef.current?.removeFX(fxId);
  }, []);

  const moveFX = useCallback((from: number, to: number) => {
    chainRef.current?.moveFX(from, to);
  }, []);

  const setBypass = useCallback((fxId: string, bypass: boolean) => {
    chainRef.current?.setBypass(fxId, bypass);
    syncState();
  }, [syncState]);

  const toggleBypass = useCallback((fxId: string) => {
    chainRef.current?.toggleBypass(fxId);
    syncState();
  }, [syncState]);

  const setWet = useCallback((fxId: string, wet: number) => {
    chainRef.current?.setWet(fxId, wet);
    syncState();
  }, [syncState]);

  const setPreGain = useCallback((value: number) => {
    chainRef.current?.setPreGain(value);
    syncState();
  }, [syncState]);

  const setPostGain = useCallback((value: number) => {
    chainRef.current?.setPostGain(value);
    syncState();
  }, [syncState]);

  const clear = useCallback(() => {
    chainRef.current?.clear();
  }, []);

  const serialize = useCallback((): SerializedFXChain | null => {
    return chainRef.current?.serialize() ?? null;
  }, []);

  return {
    chain:   chainRef.current,
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