import { useState, useEffect, useCallback } from 'react';
import { audioEngine, type AudioState, PAD_KEYS, PIANO_KEYS } from '@/lib/audio-engine';

export function useAudioEngine() {
  const [state, setState] = useState<AudioState>(audioEngine.state);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe(() => {
      setState({ ...audioEngine.state });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const init = useCallback(async () => {
    await audioEngine.init();
    setIsInitialized(true);
    setState({ ...audioEngine.state });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag || '')) return;

      const key = e.key.toLowerCase();
      const padIndex = PAD_KEYS.indexOf(key);
      const keyIndex = PIANO_KEYS.indexOf(key);

      if (padIndex !== -1) {
        e.preventDefault();
        audioEngine.triggerPad(padIndex);
      } else if (keyIndex !== -1) {
        e.preventDefault();
        audioEngine.triggerKey(keyIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    state,
    isInitialized,
    init,
    triggerPad: audioEngine.triggerPad.bind(audioEngine),
    triggerKey: audioEngine.triggerKey.bind(audioEngine),
    toggleFX: audioEngine.toggleFX.bind(audioEngine),
    setFilter: audioEngine.setFilter.bind(audioEngine),
    setPitch: audioEngine.setPitch.bind(audioEngine),
    setCrossfade: audioEngine.setCrossfade.bind(audioEngine),
    setBpm: audioEngine.setBpm.bind(audioEngine),
    toggleMetronome: audioEngine.toggleMetronome.bind(audioEngine),
    arm: audioEngine.arm.bind(audioEngine),
    record: audioEngine.record.bind(audioEngine),
    stop: audioEngine.stop.bind(audioEngine),
    play: audioEngine.play.bind(audioEngine),
    undo: audioEngine.undo.bind(audioEngine),
    redo: audioEngine.redo.bind(audioEngine),
    getAnalyserData: audioEngine.getAnalyserData.bind(audioEngine),
    getWaveformData: audioEngine.getWaveformData.bind(audioEngine),
    loadSample: audioEngine.loadSample.bind(audioEngine),
    assignPadSample: audioEngine.assignPadSample.bind(audioEngine),
    assignKeySample: audioEngine.assignKeySample.bind(audioEngine),
    exportSession: audioEngine.exportSession.bind(audioEngine),
    importSession: audioEngine.importSession.bind(audioEngine),
  };
}
