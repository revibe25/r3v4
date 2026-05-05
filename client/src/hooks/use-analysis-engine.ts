// @ts-nocheck
import { MixerChannel } from '@/audio/mixer/mixer-channel';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getMasterBus } from '../audio/mixer/master-bus';
import { transportEngine } from '../audio/transport/transport-engine';
import { AudioEngine } from '@/audio/core/analysis-engine';

import type {
  VSTPerformanceMonitor,
  VSTAutomationEngine,
} from '@/types/audio';
import { SidechainRouter } from '@/audio/fx/vst-sidechain';


// Import audio engine if it exists, otherwise we'll use a fallback
let analysisEngine: any;
let AudioState: any;
let PAD_KEYS: string[] = [];
let PIANO_KEYS: string[] = [];

try {
  const analysisEngineModule = require('@/lib/audio-engine');
  analysisEngine = analysisEngineModule.analysisEngine;
  AudioState = analysisEngineModule.AudioState;
  PAD_KEYS = analysisEngineModule.PAD_KEYS || ['1', '2', '3', '4', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];
  PIANO_KEYS = analysisEngineModule.PIANO_KEYS || ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];
} catch (error) {
  // Fallback if audio-engine doesn't exist
  console.warn('Audio engine not found, using fallback mode');
}

/**
 * Track interface for mixer integration
 */
export interface Track {
  id: string;
  name: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  color?: string;
}

/**
 * Audio State interface
 */
export interface AudioEngineState {
  isPlaying: boolean;
  isRecording: boolean;
  position: number;
  bpm: number;
  volume: number;
  metering?: {
    level: number;
    peak: number;
  };
}

/**
 * Unified Audio Engine Hook
 * 
 * Combines:
 * - Mixer channel management (MixerChannel, MasterBus)
 * - Transport engine controls (play/stop/record)
 * - Pad/Key triggering with keyboard shortcuts
 * - Real-time audio processing and effects
 * - Session management (import/export)
 * 
 * @param tracks - Array of tracks to initialize mixer channels for
 * @returns Audio engine state and control methods
 */
export function useAudioEngine(tracks?: Track[]) {
  // State management
  const [state, setState] = useState<AudioEngineState>({
    isPlaying: false,
    isRecording: false,
    position: 0,
    bpm: 120,
    volume: 0.8,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Store mixer channels
  const channelsRef = useRef<Map<string, MixerChannel>>(new Map());
  const rafRef = useRef<number>();

  /**
   * Initialize audio context and engine
   * Must be called after user interaction (browser policy)
   */
  const init = useCallback(async () => {
    try {
      // Initialize audio engine if available
      if (analysisEngine?.init) {
        await analysisEngine.init();
      }
      
      // Initialize transport engine
      if (transportEngine?.init) {
        await (transportEngine as any).init();
      }
      
      setIsInitialized(true);
      
      // Update state from audio engine if available
      if (analysisEngine?.state) {
        setState(prevState => ({ ...prevState, ...analysisEngine.state }));
      }
      
      console.log('✅ Audio engine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize audio engine:', error);
      throw error;
    }
  }, []);

  /**
   * Initialize mixer channels for each track
   */
  useEffect(() => {
    if (!tracks || tracks.length === 0) return;

    const channels = channelsRef.current;
    
    // Create new channels for new tracks
    tracks.forEach(track => {
      if (!channels.has(track.id)) {
        try {
          const channel = new MixerChannel(track.id);
          channel.connect(getMasterBus().gainNode);
          
          // Set initial parameters
          if (track.volume !== undefined) {
            channel.setVolume(track.volume);
          }
          if (track.pan !== undefined) {
            channel.setPan(track.pan);
          }
          if (track.muted !== undefined) {
            channel.setMute(track.muted);
          }
          if (track.solo !== undefined) {
            channel.setSolo(track.solo);
          }
          
          channels.set(track.id, channel);
          console.log(`🎚️ Mixer channel created: ${track.name}`);
        } catch (error) {
          console.error(`Failed to create mixer channel for ${track.id}:`, error);
        }
      }
    });

    // Remove channels for deleted tracks
    const trackIds = new Set(tracks.map(t => t.id));
    channels.forEach((channel, id) => {
      if (!trackIds.has(id)) {
        channel.disconnect();
        channels.delete(id);
        console.log(`🗑️ Mixer channel removed: ${id}`);
      }
    });

    // Cleanup on unmount
    return () => {
      channels.forEach(channel => {
        try {
          channel.disconnect();
        } catch (error) {
          console.error('Error disconnecting channel:', error);
        }
      });
      channels.clear();
    };
  }, [tracks]);

  /**
   * Subscribe to audio engine state changes
   */
  useEffect(() => {
    if (!analysisEngine?.subscribe) return;

    const unsubscribe = analysisEngine.subscribe(() => {
      setState(prevState => ({ ...prevState, ...analysisEngine.state }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Keyboard shortcut handler
   * Pads: 1-V (16 pads)
   * Piano: A-; (10 keys)
   * Transport: Space (play/pause), Enter (record), Esc (stop)
   */
  useEffect(() => {
    if (!isInitialized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore repeated keys
      if (e.repeat) return;
      
      // Ignore if typing in input fields
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag || '')) return;

      const key = e.key.toLowerCase();

      // Check for pad triggers
      if (PAD_KEYS.length > 0) {
        const padIndex = PAD_KEYS.indexOf(key);
        if (padIndex !== -1 && analysisEngine?.triggerPad) {
          e.preventDefault();
          analysisEngine.triggerPad(padIndex);
          return;
        }
      }

      // Check for piano key triggers
      if (PIANO_KEYS.length > 0) {
        const keyIndex = PIANO_KEYS.indexOf(key);
        if (keyIndex !== -1 && analysisEngine?.triggerKey) {
          e.preventDefault();
          analysisEngine.triggerKey(keyIndex);
          return;
        }
      }

      // Transport controls
      switch (key) {
        case ' ': // Space - Play/Pause
          e.preventDefault();
          if (state.isPlaying) {
            stop();
          } else {
            play();
          }
          break;
        case 'enter': // Enter - Record
          e.preventDefault();
          if (state.isRecording) {
            stop();
          } else {
            record();
          }
          break;
        case 'escape': // Esc - Stop
          e.preventDefault();
          stop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInitialized, state.isPlaying, state.isRecording]);

  /**
   * Transport Controls
   */
  const play = useCallback(() => {
    transportEngine?.play?.();
    analysisEngine?.play?.();
    setState(prev => ({ ...prev, isPlaying: true, isRecording: false }));
  }, []);

  const stop = useCallback(() => {
    transportEngine?.stop?.();
    analysisEngine?.stop?.();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setState(prev => ({ ...prev, isPlaying: false, isRecording: false }));
  }, []);

  const record = useCallback(() => {
    transportEngine?.record?.();
    analysisEngine?.record?.();
    setState(prev => ({ ...prev, isRecording: true, isPlaying: true }));
  }, []);

  /**
   * Mixer channel controls
   */
  const setChannelVolume = useCallback((trackId: string, volume: number) => {
    const channel = channelsRef.current.get(trackId);
    channel?.setVolume?.(volume);
  }, []);

  const setChannelPan = useCallback((trackId: string, pan: number) => {
    const channel = channelsRef.current.get(trackId);
    channel?.setPan?.(pan);
  }, []);

  const setChannelMute = useCallback((trackId: string, muted: boolean) => {
    const channel = channelsRef.current.get(trackId);
    channel?.setMute?.(muted);
  }, []);

  const setChannelSolo = useCallback((trackId: string, solo: boolean) => {
    const channel = channelsRef.current.get(trackId);
    channel?.setSolo?.(solo);
  }, []);

  const getChannel = useCallback((trackId: string): MixerChannel | undefined => {
    return channelsRef.current.get(trackId);
  }, []);

  /**
   * Return unified API
   */
  return {
    // State
    state,
    isInitialized,
    channels: channelsRef.current,

    // Initialization
    init,

    // Transport controls
    play,
    stop,
    record,
    arm: analysisEngine?.arm?.bind(analysisEngine),

    // Mixer controls
    setChannelVolume,
    setChannelPan,
    setChannelMute,
    setChannelSolo,
    getChannel,

    // Pad/Key triggers (if available)
    triggerPad: analysisEngine?.triggerPad?.bind(analysisEngine),
    triggerKey: analysisEngine?.triggerKey?.bind(analysisEngine),

    // Effects (if available)
    toggleFX: analysisEngine?.toggleFX?.bind(analysisEngine),
    setFilter: analysisEngine?.setFilter?.bind(analysisEngine),
    setPitch: analysisEngine?.setPitch?.bind(analysisEngine),
    setCrossfade: analysisEngine?.setCrossfade?.bind(analysisEngine),

    // Global controls
    setBpm: analysisEngine?.setBpm?.bind(analysisEngine) || ((bpm: number) => {
      setState(prev => ({ ...prev, bpm }));
    }),
    toggleMetronome: analysisEngine?.toggleMetronome?.bind(analysisEngine),

    // Analysis
    getAnalyserData: analysisEngine?.getAnalyserData?.bind(analysisEngine),
    getWaveformData: analysisEngine?.getWaveformData?.bind(analysisEngine),

    // Sample management
    loadSample: analysisEngine?.loadSample?.bind(analysisEngine),
    assignPadSample: analysisEngine?.assignPadSample?.bind(analysisEngine),
    assignKeySample: analysisEngine?.assignKeySample?.bind(analysisEngine),

    // Session management
    exportSession: analysisEngine?.exportSession?.bind(analysisEngine),
    importSession: analysisEngine?.importSession?.bind(analysisEngine),

    // History
    undo: analysisEngine?.undo?.bind(analysisEngine),
    redo: analysisEngine?.redo?.bind(analysisEngine),
  };
}