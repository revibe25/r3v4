// client/src/hooks/use-audio-engine.ts (add these methods)

import { useState, useEffect, useCallback } from 'react';
import { instrumentEngine, type AudioState, PAD_KEYS, PIANO_KEYS } from '@/audio/core/instrument-engine';
import type { MixerChannel } from '@/audio/mixer/mixer-channel';

export function useAudioEngine() {
  const [state, setState] = useState<AudioState>(instrumentEngine.state);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const _unsubscribe = instrumentEngine.subscribe(() => {
      setState({ ...instrumentEngine.state });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const _init = useCallback(async () => {
    await instrumentEngine.init();
    setIsInitialized(true);
    setState({ ...instrumentEngine.state });
  }, []);

  useEffect(() => {
    const _handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const _tag = document.activeElement?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag || '')) return;

      const _key = e.key.toLowerCase();
      const _padIndex = PAD_KEYS.indexOf(key);
      const _keyIndex = PIANO_KEYS.indexOf(key);

      if (padIndex !== -1) {
        e.preventDefault();
        instrumentEngine.triggerPad(padIndex);
      } else if (keyIndex !== -1) {
        e.preventDefault();
        instrumentEngine.triggerKey(keyIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // VST loading helper for channels
  const _loadChannelVST = useCallback(async (
    channel: MixerChannel,
    vstUrl: string,
    workletName?: string
  ) => {
    try {
      const _vstNode = await channel.addVST(vstUrl, workletName);
      setState({ ...instrumentEngine.state });
      return vstNode;
    } catch (error) {
      console.error('Failed to load VST to channel:', error);
      throw error;
    }
  }, []);

  return {
    state,
    isInitialized,
    init,
    triggerPad: instrumentEngine.triggerPad.bind(instrumentEngine),
    triggerKey: instrumentEngine.triggerKey.bind(instrumentEngine),
    toggleFX: instrumentEngine.toggleFX.bind(instrumentEngine),
    setFilter: instrumentEngine.setFilter.bind(instrumentEngine),
    setPitch: instrumentEngine.setPitch.bind(instrumentEngine),
    setCrossfade: instrumentEngine.setCrossfade.bind(instrumentEngine),
    setBpm: instrumentEngine.setBpm.bind(instrumentEngine),
    toggleMetronome: instrumentEngine.toggleMetronome.bind(instrumentEngine),
    arm: instrumentEngine.arm.bind(instrumentEngine),
    record: instrumentEngine.record.bind(instrumentEngine),
    stop: instrumentEngine.stop.bind(instrumentEngine),
    play: instrumentEngine.play.bind(instrumentEngine),
    undo: instrumentEngine.undo.bind(instrumentEngine),
    redo: instrumentEngine.redo.bind(instrumentEngine),
    getAnalyserData: instrumentEngine.getAnalyserData.bind(instrumentEngine),
    getWaveformData: instrumentEngine.getWaveformData.bind(instrumentEngine),
    loadSample: instrumentEngine.loadSample.bind(instrumentEngine),
    assignPadSample: instrumentEngine.assignPadSample.bind(instrumentEngine),
    assignKeySample: instrumentEngine.assignKeySample.bind(instrumentEngine),
    exportSession: instrumentEngine.exportSession.bind(instrumentEngine),
    importSession: instrumentEngine.importSession.bind(instrumentEngine),
    
    // VST helper
    loadChannelVST,
  };
}