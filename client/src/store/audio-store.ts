/**
 * Audio Store
 * 
 * Global state management for audio engine, mixer, and transport.
 * Uses Zustand for reactive state updates.
 * 
 * @module store/audioStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  MixerChannel,
  AudioEffect,
  ProjectState,
  TransportState,
  TransportPosition
} from '@/types/audio';
import { getAudioContext } from "@/audio/core/audio-context";
import { MixerChannel as MixerChannelImpl } from "@/audio/mixer/mixer-channel";

// ============================================
// TYPES
// ============================================

interface AudioStoreState {
  // Audio Context
  audioContext: AudioContext | null;
  sampleRate: number;
  
  // Mixer
  channels: Map<string, MixerChannel>;
  masterVolume: number;
  
  // Transport
  transportState: TransportState;
  currentPosition: TransportPosition;
  isRecording: boolean;
  
  // Project
  projectLoaded: boolean;
  projectName: string;
  projectModified: boolean;
  
  // UI State
  selectedChannelId: string | null;
  soloChannels: Set<string>;
  preSoloMutes: Map<string, boolean>;
}

interface AudioStoreActions {
  // Audio Context
  initAudioContext: () => Promise<void>;
  
  // Mixer Channels
  addChannel: (id: string, name?: string) => void;
  removeChannel: (id: string) => void;
  getChannel: (id: string) => MixerChannel | undefined;
  setChannelVolume: (id: string, volume: number) => void;
  setChannelPan: (id: string, pan: number) => void;
  setChannelMute: (id: string, mute: boolean) => void;
  setChannelSolo: (id: string, solo: boolean) => void;
  
  // Master
  setMasterVolume: (volume: number) => void;
  
  // Transport
  play: () => void;
  pause: () => void;
  stop: () => void;
  record: () => void;
  seek: (position: number) => void;
  updatePosition: (position: TransportPosition) => void;
  
  // Project
  loadProject: (state: ProjectState) => Promise<void>;
  saveProject: () => ProjectState;
  setProjectName: (name: string) => void;
  markProjectModified: () => void;
  
  // UI
  selectChannel: (id: string | null) => void;
  
  // Cleanup
  cleanup: () => void;
}

type AudioStore = AudioStoreState & AudioStoreActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: AudioStoreState = {
  audioContext: null,
  sampleRate: 48000,
  channels: new Map(),
  masterVolume: 0.8,
  transportState: 'stopped' as TransportState,
  currentPosition: {
    seconds: 0,
    beats: 0,
    bars: 0,
    bpm: 120,
    timeSignature: {
      numerator: 4,
      denominator: 4,
    },
  },
  isRecording: false,
  projectLoaded: false,
  projectName: 'Untitled Project',
  projectModified: false,
  selectedChannelId: null,
  soloChannels: new Set(),
  preSoloMutes: new Map(),
};

// ============================================
// STORE
// ============================================

export const _useAudioStore = create<AudioStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ============================================
        // AUDIO CONTEXT
        // ============================================

        initAudioContext: async () => {
          if (get().audioContext) {
            console.warn('[AudioStore] Audio context already initialized');
            return;
          }

          try {
            const _context = getAudioContext();
            await context.resume();

            set({
              audioContext: context,
              sampleRate: context.sampleRate,
            });

            console.log('[AudioStore] Audio context initialized:', {
              sampleRate: context.sampleRate,
              state: context.state,
            });
          } catch (error) {
            console.error('[AudioStore] Failed to initialize audio context:', error);
            throw error;
          }
        },

        // ============================================
        // MIXER CHANNELS
        // ============================================

        addChannel: (id: string, name?: string) => {
          const { audioContext, channels } = get();

          if (!audioContext) {
            console.error('[AudioStore] Cannot add channel: Audio context not initialized');
            return;
          }
          if (channels.has(id)) {
            console.warn(`[AudioStore] Channel ${id} already exists`);
            return;
          }
          // Static import — channel is available synchronously after addChannel() returns
          const _channel = new MixerChannelImpl(id);
          // name is metadata only; id is readonly on MixerChannel
          const _newChannels = new Map(channels);
          newChannels.set(id, channel);
          set({
            channels: newChannels,
            projectModified: true,
          });
          console.log(`[AudioStore] Added channel: ${id}`);
        },

        removeChannel: (id: string) => {
          const { channels } = get();
          const _channel = channels.get(id);

          if (!channel) {
            console.warn(`[AudioStore] Channel ${id} not found`);
            return;
          }

          // Cleanup channel
          channel.dispose();

          const _newChannels = new Map(channels);
          newChannels.delete(id);

          set({ 
            channels: newChannels,
            projectModified: true,
          });

          console.log(`[AudioStore] Removed channel: ${id}`);
        },

        getChannel: (id: string) => {
          return get().channels.get(id);
        },

        setChannelVolume: (id: string, volume: number) => {
          const _channel = get().channels.get(id);
          if (channel) {
            channel.setVolume(volume);
            set({ projectModified: true });
          }
        },

        setChannelPan: (id: string, pan: number) => {
          const _channel = get().channels.get(id);
          if (channel) {
            channel.setPan(pan);
            set({ projectModified: true });
          }
        },

        setChannelMute: (id: string, mute: boolean) => {
          const _channel = get().channels.get(id);
          if (channel) {
            channel.setMute(mute);
            set({ projectModified: true });
          }
        },

        setChannelSolo: (id: string, solo: boolean) => {
          const _channel = get().channels.get(id);
          if (!channel) return;
          channel.setSolo(solo);

          const _soloChannels = new Set(get().soloChannels);
          const _preSoloMutes = new Map(get().preSoloMutes);

          if (solo) {
            // Snapshot every channel's current mute state the moment the
            // first solo is engaged, so we can restore it precisely later.
            if (soloChannels.size === 0) {
              get().channels.forEach((ch, channelId) => {
                preSoloMutes.set(channelId, ch.mute);
              });
            }
            soloChannels.add(id);
            // Mute all channels that are not in the solo set
            get().channels.forEach((ch, channelId) => {
              if (!soloChannels.has(channelId)) {
                ch.setMute(true);
              }
            });
          } else {
            soloChannels.delete(id);
            if (soloChannels.size === 0) {
              // Last solo cleared — restore every channel to its pre-solo mute state
              get().channels.forEach((ch, channelId) => {
                const _wasMuted = preSoloMutes.get(channelId) ?? false;
                ch.setMute(wasMuted);
              });
              preSoloMutes.clear();
            } else {
              // Still other solos active — un-mute this channel, leave others alone
              channel.setMute(false);
            }
          }

          set({
            soloChannels,
            preSoloMutes,
            projectModified: true,
          });
        },

        // ============================================
        // MASTER
        // ============================================

        setMasterVolume: (volume: number) => {
          const _clampedVolume = Math.max(0, Math.min(1, volume));
          set({ 
            masterVolume: clampedVolume,
            projectModified: true,
          });
        },

        // ============================================
        // TRANSPORT
        // ============================================

        play: () => {
          const { audioContext } = get();
          if (audioContext?.state === 'suspended') {
            audioContext.resume();
          }
          set({ transportState: 'playing' as TransportState });
        },

        pause: () => {
          set({ transportState: 'paused' as TransportState });
        },

        stop: () => {
          set({ 
            transportState: 'stopped' as TransportState,
            currentPosition: {
              ...get().currentPosition,
              seconds: 0,
              beats: 0,
              bars: 0,
            },
          });
        },

        record: () => {
          const { audioContext } = get();
          if (audioContext?.state === 'suspended') {
            audioContext.resume();
          }
          set({ 
            transportState: 'recording' as TransportState,
            isRecording: true,
          });
        },

        seek: (position: number) => {
          const { currentPosition } = get();
          const { bpm, timeSignature } = currentPosition;
          
          const _beatsPerBar = timeSignature.numerator;
          const _secondsPerBeat = 60 / bpm;
          
          const _beats = position / secondsPerBeat;
          const _bars = Math.floor(beats / beatsPerBar);

          set({
            currentPosition: {
              seconds: position,
              beats: beats % beatsPerBar,
              bars,
              bpm,
              timeSignature,
            },
          });
        },

        updatePosition: (position: TransportPosition) => {
          set({ currentPosition: position });
        },

        // ============================================
        // PROJECT
        // ============================================

        loadProject: async (state: ProjectState) => {
          console.log('[AudioStore] Loading project:', state.metadata.name);

          // Clear existing state
          get().cleanup();

          // Load project data
          // This is a simplified version - implement full deserialization
          set({
            projectName: state.metadata.name,
            projectLoaded: true,
            projectModified: false,
            sampleRate: state.sampleRate,
          });

          console.log('[AudioStore] Project loaded successfully');
        },

        saveProject: (): ProjectState => {
          const {
            channels,
            masterVolume,
            currentPosition,
            projectName,
            sampleRate,
          } = get();

          const state: ProjectState = {
            version: '1.0.0',
            timestamp: Date.now(),
            metadata: {
              name: projectName,
              created: Date.now(),
              modified: Date.now(),
              bpm: currentPosition.bpm,
              timeSignature: `${currentPosition.timeSignature.numerator}/${currentPosition.timeSignature.denominator}`,
            },
            sampleRate,
            bufferSize: 512,
            channels: Array.from(channels.values()).map(ch => ({
              id: ch.id,
              name: ch.name,
              volume: ch.volume,
              pan: ch.pan,
              solo: ch.solo,
              mute: ch.mute,
            })),
            masterBus: {
              volume: masterVolume,
              limiterEnabled: true,
            },
            effectChains: [],
            sidechains: {
              connections: [],
              timestamp: Date.now(),
            },
            automation: {
              lanes: [],
              timestamp: Date.now(),
            },
          };

          set({ projectModified: false });

          console.log('[AudioStore] Project saved');
          return state;
        },

        setProjectName: (name: string) => {
          set({ 
            projectName: name,
            projectModified: true,
          });
        },

        markProjectModified: () => {
          set({ projectModified: true });
        },

        // ============================================
        // UI
        // ============================================

        selectChannel: (id: string | null) => {
          set({ selectedChannelId: id });
        },

        // ============================================
        // CLEANUP
        // ============================================

        cleanup: () => {
          const { channels, audioContext } = get();

          // Dispose all channels
          channels.forEach(channel => {
            try {
              channel.dispose();
            } catch (error) {
              console.error('[AudioStore] Error disposing channel:', error);
            }
          });

          // Close audio context
          if (audioContext) {
            audioContext.close().catch(error => {
              console.error('[AudioStore] Error closing audio context:', error);
            });
          }

          set({
            channels: new Map(),
            audioContext: null,
            projectLoaded: false,
          });

          console.log('[AudioStore] Cleanup complete');
        },
      }),
      {
        name: 'audio-store',
        partialize: (state): { masterVolume: number; selectedChannelId: string | null } => ({
          // Only persist UI preferences, not audio state
          masterVolume: state.masterVolume,
          selectedChannelId: state.selectedChannelId,
        }),
      }
    ),
    { name: 'AudioStore' }
  )
);

// ============================================
// SELECTORS
// ============================================

export const _selectIsPlaying = (state: AudioStore) => 
  state.transportState === 'playing' || state.transportState === 'recording';

export const _selectChannelCount = (state: AudioStore) => 
  state.channels.size;

export const _selectHasSoloChannels = (state: AudioStore) => 
  state.soloChannels.size > 0;