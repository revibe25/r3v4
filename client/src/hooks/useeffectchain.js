/**
 * Effect Chain Hook
 *
 * React hook for managing effect chains with real-time updates.
 *
 * @module hooks/useEffectChain
 */
import { useState, useEffect, useCallback } from 'react';
/**
 * Hook for managing an effect chain
 */
export function useEffectChain(chain, options = {}) {
    const { autoUpdate = true, updateInterval = 100, onEffectAdded, onEffectRemoved, onEffectReordered, } = options;
    // State
    const [isReady, setIsReady] = useState(false);
    const [effects, setEffects] = useState([]);
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
        const intervalId = setInterval(() => {
            setEffects([...chain.effects]);
        }, updateInterval);
        return () => clearInterval(intervalId);
    }, [chain, autoUpdate, updateInterval]);
    /**
     * Add effect to chain
     */
    const addEffect = useCallback((effect, position) => {
        if (!chain) {
            console.error('[useEffectChain] Cannot add effect: chain not initialized');
            return;
        }
        try {
            chain.addEffect(effect, position);
            setEffects([...chain.effects]);
            onEffectAdded?.(effect);
        }
        catch (error) {
            console.error('[useEffectChain] Failed to add effect:', error);
        }
    }, [chain, onEffectAdded]);
    /**
     * Remove effect from chain
     */
    const removeEffect = useCallback((effectId) => {
        if (!chain) {
            console.error('[useEffectChain] Cannot remove effect: chain not initialized');
            return;
        }
        try {
            chain.removeEffect(effectId);
            setEffects([...chain.effects]);
            onEffectRemoved?.(effectId);
        }
        catch (error) {
            console.error('[useEffectChain] Failed to remove effect:', error);
        }
    }, [chain, onEffectRemoved]);
    /**
     * Reorder effect in chain
     */
    const reorderEffect = useCallback((effectId, newPosition) => {
        if (!chain) {
            console.error('[useEffectChain] Cannot reorder effect: chain not initialized');
            return;
        }
        try {
            chain.reorderEffect(effectId, newPosition);
            setEffects([...chain.effects]);
            onEffectReordered?.(effectId, newPosition);
        }
        catch (error) {
            console.error('[useEffectChain] Failed to reorder effect:', error);
        }
    }, [chain, onEffectReordered]);
    /**
     * Bypass/enable specific effect
     */
    const bypassEffect = useCallback((effectId, bypass) => {
        const effect = chain?.getEffect(effectId);
        if (!effect) {
            console.error(`[useEffectChain] Effect ${effectId} not found`);
            return;
        }
        effect.bypassed = bypass;
        setEffects([...chain.effects]);
    }, [chain]);
    /**
     * Set effect parameter
     */
    const setEffectParameter = useCallback((effectId, parameterId, value) => {
        const effect = chain?.getEffect(effectId);
        if (!effect) {
            console.error(`[useEffectChain] Effect ${effectId} not found`);
            return;
        }
        try {
            effect.setParameter(parameterId, value);
        }
        catch (error) {
            console.error('[useEffectChain] Failed to set parameter:', error);
        }
    }, [chain]);
    /**
     * Bypass all effects
     */
    const bypassAll = useCallback(() => {
        if (!chain)
            return;
        chain.bypassAll();
        setEffects([...chain.effects]);
    }, [chain]);
    /**
     * Enable all effects
     */
    const enableAll = useCallback(() => {
        if (!chain)
            return;
        chain.enableAll();
        setEffects([...chain.effects]);
    }, [chain]);
    /**
     * Clear all effects
     */
    const clear = useCallback(() => {
        if (!chain)
            return;
        chain.clear();
        setEffects([]);
    }, [chain]);
    /**
     * Get effect chain state
     */
    const getState = useCallback(() => {
        if (!chain)
            return [];
        return chain.effects.map(effect => effect.getState());
    }, [chain]);
    /**
     * Get specific effect
     */
    const getEffect = useCallback((effectId) => {
        return chain?.getEffect(effectId);
    }, [chain]);
    /**
     * Get effect parameters
     */
    const getEffectParameters = useCallback((effectId) => {
        const effect = chain?.getEffect(effectId);
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
