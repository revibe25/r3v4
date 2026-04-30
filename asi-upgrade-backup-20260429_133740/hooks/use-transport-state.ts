import { useState, useCallback, useEffect } from 'react';

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  position: number;
}

export function useTransportState() {
  const [transport, setTransport] = useState<TransportState>({
    isPlaying: false,
    isRecording: false,
    position: 0,
  });

  const togglePlay = useCallback(() => {
    setTransport(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const toggleRecord = useCallback(() => {
    setTransport(prev => ({
      ...prev,
      isRecording: !prev.isRecording,
    }));
  }, []);

  const setPosition = useCallback((position: number) => {
    setTransport(prev => ({ ...prev, position }));
  }, []);

  const stop = useCallback(() => {
    setTransport(prev => ({
      ...prev,
      isPlaying: false,
      position: 0,
    }));
  }, []);

  // Simulate playhead movement
  useEffect(() => {
    if (!transport.isPlaying) return;
    const interval = setInterval(() => {
      setTransport(prev => ({
        ...prev,
        position: prev.position + 0.016,
      }));
    }, 16);
    return () => clearInterval(interval);
  }, [transport.isPlaying]);

  return {
    transport,
    togglePlay,
    toggleRecord,
    setPosition,
    stop,
  };
}