// @ts-nocheck
/**
 * Mixer Channel Hook
 * 
 * React hook for managing mixer channel state and operations.
 * Provides a clean interface for channel control in components.
 * 
 * @module hooks/useMixerChannel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MixerChannel,
  MixerChannelConfig,
  AudioEffect
} from '@/types/audio';

export interface UseMixerChannelOptions {
  autoConnect?: boolean;
  destination?: AudioNode;
  onVolumeChange?: (volume: number) => void;
  onPanChange?: (pan: number) => void;
  onMuteChange?: (muted: boolean) => void;
  onSoloChange?: (solo: boolean) => void;
}

export interface UseMixerChannelReturn {
  channel: MixerChannel | null;
  isReady: boolean;
  
  // State
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  vuLevel: number;
  peakLevel: number;
  
  // Actions
  setVolume: (value: number) => void;
  setPan: (value: number) => void;
  setMute: (muted: boolean) => void;
  setSolo: (solo: boolean) => void;
  
  // Effects
  effects: AudioEffect[];
  addEffect: (effect: AudioEffect) => void;
  removeEffect: (effectId: string) => void;
  
  // Cleanup
  cleanup: () => void;
}

/**
 * Hook for managing a mixer channel
 */
export function useMixerChannel(
  channel: MixerChannel | null,
  options: UseMixerChannelOptions = {}
): UseMixerChannelReturn {
  const {
    autoConnect = true,
    destination,
    onVolumeChange,
    onPanChange,
    onMuteChange,
    onSoloChange,
  } = options;

  // State
  const [isReady, setIsReady] = useState(false);
  const [volume, setVolumeState] = useState(channel?.volume ?? 0.8);
  const [pan, setPanState] = useState(channel?.pan ?? 0);
  const [mute, setMuteState] = useState(channel?.mute ?? false);
  const [solo, setSoloState] = useState(channel?.solo ?? false);
  const [vuLevel, setVuLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [effects, setEffects] = useState<AudioEffect[]>([]);

  // Refs
  const animationFrameRef = useRef<number>();
  const vuUpdateIntervalRef = useRef<number>();

  /**
   * Initialize channel
   */
  useEffect(() => {
    if (!channel) {
      setIsReady(false);
      return;
    }

    // Sync initial state
    setVolumeState(channel.volume);
    setPanState(channel.pan);
    setMuteState(channel.mute);
    setSoloState(channel.solo);
    setEffects(channel.getEffects());

    // Auto-connect if requested
    if (autoConnect && destination) {
      try {
        channel.connect(destination);
      } catch (error) {
        console.error('[useMixerChannel] Failed to connect channel:', error);
      }
    }

    setIsReady(true);

    return () => {
      if (autoConnect && destination) {
        try {
          channel.disconnect();
        } catch (_error) {
          // Ignore disconnection errors
        }
      }
    };
  }, [channel, autoConnect, destination]);

  /**
   * VU meter updates
   */
  useEffect(() => {
    if (!channel || !isReady) {
      return;
    }

    // Update VU meters at ~30fps
    vuUpdateIntervalRef.current = window.setInterval(() => {
      setVuLevel(channel.vuLevel);
      setPeakLevel(channel.peakLevel);
    }, 33);

    return () => {
      if (vuUpdateIntervalRef.current) {
        clearInterval(vuUpdateIntervalRef.current);
      }
    };
  }, [channel, isReady]);

  /**
   * Set channel volume
   */
  const setVolume = useCallback((value: number) => {
    if (!channel) return;

    const clampedValue = Math.max(0, Math.min(1, value));
    channel.setVolume(clampedValue);
    setVolumeState(clampedValue);
    onVolumeChange?.(clampedValue);
  }, [channel, onVolumeChange]);

  /**
   * Set channel pan
   */
  const setPan = useCallback((value: number) => {
    if (!channel) return;

    const clampedValue = Math.max(-1, Math.min(1, value));
    channel.setPan(clampedValue);
    setPanState(clampedValue);
    onPanChange?.(clampedValue);
  }, [channel, onPanChange]);

  /**
   * Set channel mute
   */
  const setMute = useCallback((muted: boolean) => {
    if (!channel) return;

    channel.setMute(muted);
    setMuteState(muted);
    onMuteChange?.(muted);
  }, [channel, onMuteChange]);

  /**
   * Set channel solo
   */
  const setSolo = useCallback((solo: boolean) => {
    if (!channel) return;

    channel.setSolo(solo);
    setSoloState(solo);
    onSoloChange?.(solo);
  }, [channel, onSoloChange]);

  /**
   * Add effect to channel
   */
  const addEffect = useCallback((effect: AudioEffect) => {
    if (!channel) return;

    try {
      channel.addEffect(effect);
      setEffects(channel.getEffects());
    } catch (error) {
      console.error('[useMixerChannel] Failed to add effect:', error);
    }
  }, [channel]);

  /**
   * Remove effect from channel
   */
  const removeEffect = useCallback((effectId: string) => {
    if (!channel) return;

    try {
      channel.removeEffect(effectId);
      setEffects(channel.getEffects());
    } catch (error) {
      console.error('[useMixerChannel] Failed to remove effect:', error);
    }
  }, [channel]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (vuUpdateIntervalRef.current) {
      clearInterval(vuUpdateIntervalRef.current);
    }
  }, []);

  return {
    channel,
    isReady,
    volume,
    pan,
    mute,
    solo,
    vuLevel,
    peakLevel,
    effects,
    setVolume,
    setPan,
    setMute,
    setSolo,
    addEffect,
    removeEffect,
    cleanup,
  };
}

/**
 * Hook for creating a new mixer channel
 */
export function useCreateMixerChannel(
  config: MixerChannelConfig,
  _audioContext: AudioContext
): MixerChannel | null {
  const [channel, setChannel] = useState<MixerChannel | null>(null);

  useEffect(() => {
    // Import and create channel
    import('@/audio/mixer/mixer-channel').then(({ MixerChannel }) => {
      const newChannel = new MixerChannel(config.id);
      
      // Apply config
      if (config.name) newChannel.name = config.name;
      if (config.volume !== undefined) newChannel.setVolume(config.volume);
      if (config.pan !== undefined) newChannel.setPan(config.pan);
      if (config.mute !== undefined) newChannel.setMute(config.mute);
      if (config.solo !== undefined) newChannel.setSolo(config.solo);

      setChannel(newChannel);
    });

    return () => {
      if (channel) {
        channel.dispose();
      }
    };
  }, [config.id]);

  return channel;
}