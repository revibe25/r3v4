// useAudioContext.ts — React hook for AudioContextManager
//
// Single canonical hook. Components never call audioContextManager directly.
// activateAudio() MUST be called from a user-gesture handler (onClick etc.).

import { useState, useEffect, useCallback } from "react";
import { audioContextManager, type ContextState } from "../lib/audio-context-manager";

interface UseAudioContextResult {
  isReady: boolean;
  state: ContextState | "uninitialised";
  activateAudio: () => Promise<void>;
  activationError: Error | null;
}

export function useAudioContext(): UseAudioContextResult {
  const [state, setState] = useState<ContextState | "uninitialised">(
    audioContextManager.getState(),
  );
  const [activationError, setActivationError] = useState<Error | null>(null);

  useEffect(() => {
    const id = setInterval(() => setState(audioContextManager.getState()), 500);
    return () => clearInterval(id);
  }, []);

  const activateAudio = useCallback(async () => {
    setActivationError(null);
    try {
      await audioContextManager.ensureRunning();
      setState(audioContextManager.getState());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setActivationError(error);
      throw error;
    }
  }, []);

  return { isReady: state === "running", state, activateAudio, activationError };
}
