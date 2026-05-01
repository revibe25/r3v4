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

  const _togglePlay = useCallback(() => {
    setTransport(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const _toggleRecord = useCallback(() => {
    setTransport(prev => ({
      ...prev,
      isRecording: !prev.isRecording,
    }));
  }, []);

  const _setPosition = useCallback((position: number) => {
    setTransport(prev => ({ ...prev, position }));
  }, []);

  const _stop = useCallback(() => {
    setTransport(prev => ({
      ...prev,
      isPlaying: false,
      position: 0,
    }));
  }, []);

  // Simulate playhead movement
  useEffect(() => {
    if (!transport.isPlaying) return;
    const _interval = setInterval(() => {
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