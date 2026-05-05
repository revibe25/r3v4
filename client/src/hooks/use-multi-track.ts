// @ts-nocheck
// File 1: src/hooks/usemultitrack.ts
import { useState, useCallback } from 'react';

type FXType = 'EQ' | 'Compressor' | 'Reverb' | 'Delay' | 'Limiter' | 'Saturation';

export type Track = {
  id: string;
  name: string;
  armed: boolean;
  muted: boolean;
  solo: boolean;
  volume: number;
  pan: number;
  input: string;
  fxChain: FXType[];
  meter?: number;
  color?: string;
  locked?: boolean;
  hidden?: boolean;
  groupId?: string;
};

export function useMultitrack(initialTracks: Track[] = []) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);

  const updateTrack = useCallback((id: string, data: Partial<Track>) => {
    setTracks(prev => prev.map(t => (t.id === id ? { ...t, ...data } : t)));
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  const duplicateTrack = useCallback((id: string) => {
    setTracks(prev => {
      const track = prev.find(t => t.id === id);
      if (!track) return prev;
      return [
        ...prev,
        {
          ...track,
          id: `track-${Date.now()}`,
          name: `${track.name} (Copy)`,
        },
      ];
    });
  }, []);

  const armTrack = useCallback((id: string) => {
    setTracks(prev =>
      prev.map(t => (t.id === id ? { ...t, armed: !t.armed } : t))
    );
  }, []);

  const toggleMute = useCallback((id: string) => {
    setTracks(prev =>
      prev.map(t => (t.id === id ? { ...t, muted: !t.muted } : t))
    );
  }, []);

  const toggleSolo = useCallback((id: string) => {
    setTracks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, solo: !t.solo }
          : t.solo
            ? { ...t, solo: false }
            : t
      )
    );
  }, []);

  const addFX = useCallback((trackId: string, fxType: FXType) => {
    setTracks(prev =>
      prev.map(t =>
        t.id === trackId
          ? { ...t, fxChain: [...t.fxChain, fxType] }
          : t
      )
    );
  }, []);

  const removeFX = useCallback((trackId: string, fxIndex: number) => {
    setTracks(prev =>
      prev.map(t =>
        t.id === trackId
          ? {
              ...t,
              fxChain: t.fxChain.filter((_, i) => i !== fxIndex),
            }
          : t
      )
    );
  }, []);

  const reorderFX = useCallback(
    (trackId: string, fromIdx: number, toIdx: number) => {
      setTracks(prev =>
        prev.map(t => {
          if (t.id !== trackId) return t;
          const newChain = [...t.fxChain];
          const [removed] = newChain.splice(fromIdx, 1);
          newChain.splice(toIdx, 0, removed);
          return { ...t, fxChain: newChain };
        })
      );
    },
    []
  );

  const reorderTracks = useCallback((fromId: string, toId: string) => {
    setTracks(prev => {
      const fromIdx = prev.findIndex(t => t.id === fromId);
      const toIdx = prev.findIndex(t => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const newTracks = [...prev];
      const [moved] = newTracks.splice(fromIdx, 1);
      newTracks.splice(toIdx, 0, moved);
      return newTracks;
    });
  }, []);

  return {
    tracks,
    updateTrack,
    deleteTrack,
    duplicateTrack,
    armTrack,
    toggleMute,
    toggleSolo,
    addFX,
    removeFX,
    reorderFX,
    reorderTracks,
  };
}

// ============================================

// File 2: src/hooks/useTransportState.ts

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
      // Stop recording when toggling off
      position: prev.isRecording ? prev.position : prev.position,
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
        position: prev.position + 0.016, // ~60fps
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