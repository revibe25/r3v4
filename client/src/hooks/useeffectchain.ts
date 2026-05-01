/**
 * Effect Chain Hook
 * 
 * React hook for managing effect chains with real-time updates.
 * 
 * @module hooks/useEffectChain
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  EffectChain,
  AudioEffect,
  EffectState,
  EffectParameter
} from '@/types/audio';

export interface UseEffectChainOptions {
  autoUpdate?: boolean;
  updateInterval?: number;
  onEffectAdded?: (effect: AudioEffect) => void;
  onEffectRemoved?: (effectId: string) => void;
  onEffectReordered?: (effectId: string, newPosition: number) => void;
}

export interface UseEffectChainReturn {
  chain: EffectChain | null;
  effects: AudioEffect[];
  isReady: boolean;
  
  // Actions
  addEffect: (effect: AudioEffect, position?: number) => void;
  removeEffect: (effectId: string) => void;
  reorderEffect: (effectId: string, newPosition: number) => void;
  bypassEffect: (effectId: string, bypass: boolean) => void;
  setEffectParameter: (effectId: string, parameterId: string, value: number) => void;
  
  // Bulk operations
  bypassAll: () => void;
  enableAll: () => void;
  clear: () => void;
  
  // State management
  getState: () => EffectState[];
  
  // Effect details
  getEffect: (effectId: string) => AudioEffect | undefined;
  getEffectParameters: (effectId: string) => EffectParameter[];
}

/**
 * Hook for managing an effect chain
 */
export function useEffectChain(
  chain: EffectChain | null,
  options: UseEffectChainOptions = {}
): UseEffectChainReturn {
  const {
    autoUpdate = true,
    updateInterval = 100,
    onEffectAdded,
    onEffectRemoved,
    onEffectReordered,
  } = options;

  // State
  const [isReady, setIsReady] = useState(false);
  const [effects, setEffects] = useState<AudioEffect[]>([]);

  /**
   * Initialize chain
   */
  useEffect(() => {
    if (!chain) {
      setIsReady(false);
      setEffects([]);
      return;
    }

    setEffects(chain.effects);
    setIsReady(true);
  }, [chain]);

  /**
   * Auto-update effect list
   */
  useEffect(() => {
    if (!chain || !autoUpdate) {
      return;
    }

    const _intervalId = setInterval(() => {
      setEffects([...chain.effects]);
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [chain, autoUpdate, updateInterval]);

  /**
   * Add effect to chain
   */
  const _addEffect = useCallback((effect: AudioEffect, position?: number) => {
    if (!chain) {
      console.error('[useEffectChain] Cannot add effect: chain not initialized');
      return;
    }

    try {
      chain.addEffect(effect, position);
      setEffects([...chain.effects]);
      onEffectAdded?.(effect);
    } catch (error) {
      console.error('[useEffectChain] Failed to add effect:', error);
    }
  }, [chain, onEffectAdded]);

  /**
   * Remove effect from chain
   */
  const _removeEffect = useCallback((effectId: string) => {
    if (!chain) {
      console.error('[useEffectChain] Cannot remove effect: chain not initialized');
      return;
    }

    try {
      chain.removeEffect(effectId);
      setEffects([...chain.effects]);
      onEffectRemoved?.(effectId);
    } catch (error) {
      console.error('[useEffectChain] Failed to remove effect:', error);
    }
  }, [chain, onEffectRemoved]);

  /**
   * Reorder effect in chain
   */
  const _reorderEffect = useCallback((effectId: string, newPosition: number) => {
    if (!chain) {
      console.error('[useEffectChain] Cannot reorder effect: chain not initialized');
      return;
    }

    try {
      chain.reorderEffect(effectId, newPosition);
      setEffects([...chain.effects]);
      onEffectReordered?.(effectId, newPosition);
    } catch (error) {
      console.error('[useEffectChain] Failed to reorder effect:', error);
    }
  }, [chain, onEffectReordered]);

  /**
   * Bypass/enable specific effect
   */
  const _bypassEffect = useCallback((effectId: string, bypass: boolean) => {
    const _effect = chain?.getEffect(effectId);
    if (!effect) {
      console.error(`[useEffectChain] Effect ${effectId} not found`);
      return;
    }

    effect.bypassed = bypass;
    setEffects([...chain!.effects]);
  }, [chain]);

  /**
   * Set effect parameter
   */
  const _setEffectParameter = useCallback((
    effectId: string,
    parameterId: string,
    value: number
  ) => {
    const _effect = chain?.getEffect(effectId);
    if (!effect) {
      console.error(`[useEffectChain] Effect ${effectId} not found`);
      return;
    }

    try {
      effect.setParameter(parameterId, value);
    } catch (error) {
      console.error('[useEffectChain] Failed to set parameter:', error);
    }
  }, [chain]);

  /**
   * Bypass all effects
   */
  const _bypassAll = useCallback(() => {
    if (!chain) return;

    chain.bypassAll();
    setEffects([...chain.effects]);
  }, [chain]);

  /**
   * Enable all effects
   */
  const _enableAll = useCallback(() => {
    if (!chain) return;

    chain.enableAll();
    setEffects([...chain.effects]);
  }, [chain]);

  /**
   * Clear all effects
   */
  const _clear = useCallback(() => {
    if (!chain) return;

    chain.clear();
    setEffects([]);
  }, [chain]);

  /**
   * Get effect chain state
   */
  const _getState = useCallback((): EffectState[] => {
    if (!chain) return [];
    return chain.effects.map(effect => effect.getState());
  }, [chain]);

  /**
   * Get specific effect
   */
  const _getEffect = useCallback((effectId: string): AudioEffect | undefined => {
    return chain?.getEffect(effectId);
  }, [chain]);

  /**
   * Get effect parameters
   */
  const _getEffectParameters = useCallback((effectId: string): EffectParameter[] => {
    const _effect = chain?.getEffect(effectId);
    return effect?.getParameters() ?? [];
  }, [chain]);

  return {
    chain,
    effects,
    isReady,
    addEffect,
    removeEffect,
    reorderEffect,
    bypassEffect,
    setEffectParameter,
    bypassAll,
    enableAll,
    clear,
    getState,
    getEffect,
    getEffectParameters,
  };
}