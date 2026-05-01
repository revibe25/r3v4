/**
 * VST Store
 * 
 * State management for VST system including performance monitoring,
 * sidechain routing, and automation.
 * 
 * @module store/vstStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  VSTPerformanceMonitor,
  VSTAutomationEngine,
  PerformanceSnapshot
} from '@/types/audio';
import type { SidechainRouter } from '@/audio/fx/vst-sidechain';

// ============================================
// TYPES
// ============================================

interface VSTStoreState {
  // Core systems
  performanceMonitor: VSTPerformanceMonitor | null;
  sidechainRouter: SidechainRouter | null;
  automationEngine: VSTAutomationEngine | null;
  
  // Performance data
  currentSnapshot: PerformanceSnapshot | null;
  performanceHistory: PerformanceSnapshot[];
  isMonitoring: boolean;
  
  // Alerts
  cpuOverload: boolean;
  memoryWarning: boolean;
  dropoutCount: number;
  
  // System state
  initialized: boolean;

  // Channel FX chains
  channelFXChains: Record<string, string[]>;
  activePlugin: { id: string; name: string; channelId: string } | null;
}

interface VSTStoreActions {
  // Initialization
  initialize: (audioContext: AudioContext) => Promise<void>;
  
  // Performance monitoring
  startMonitoring: () => void;
  stopMonitoring: () => void;
  updatePerformance: (snapshot: PerformanceSnapshot) => void;
  clearPerformanceHistory: () => void;
  
  // Alerts
  setCPUOverload: (overload: boolean) => void;
  setMemoryWarning: (warning: boolean) => void;
  incrementDropoutCount: () => void;
  resetDropoutCount: () => void;
  
  // Channel FX chain management
  addPluginToChannel:     (channelId: string, pluginId: string, pluginName: string) => void;
  removePluginFromChannel:(channelId: string, pluginIndex: number) => void;
  reorderChannelFX:       (channelId: string, from: number, to: number) => void;
  setActivePlugin:        (plugin: { id: string; name: string; channelId: string } | null) => void;

  // Cleanup
  cleanup: () => void;
}

type VSTStore = VSTStoreState & VSTStoreActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: VSTStoreState = {
  performanceMonitor: null,
  sidechainRouter: null,
  automationEngine: null,
  currentSnapshot: null,
  performanceHistory: [],
  isMonitoring: false,
  cpuOverload: false,
  memoryWarning: false,
  dropoutCount: 0,
  initialized: false,
  channelFXChains: {},
  activePlugin: null,
};

// ============================================
// CONSTANTS
// ============================================

const MAX_HISTORY_LENGTH = 300; // 10 seconds at 30fps
const PERFORMANCE_UPDATE_INTERVAL = 33; // ~30fps

// ============================================
// STORE
// ============================================

// Module-level ref — not Zustand state (not serializable, not reactive)
let _monitoringIntervalId: ReturnType<typeof setInterval> | null = null;

export const _useVSTStore = create<VSTStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ============================================
      // INITIALIZATION
      // ============================================

      initialize: async (audioContext: AudioContext) => {
        if (get().initialized) {
          console.warn('[VSTStore] Already initialized');
          return;
        }

        try {
          // Dynamically import VST systems
          const [
            { VSTPerformanceMonitor },
            { SidechainRouter },
            { VSTAutomationEngine },
          ] = await Promise.all([
            import('@/audio/fx/vst-performance-monitor'),
            import('@/audio/fx/vst-sidechain'),
            import('@/audio/fx/vst-automation-engine'),
          ]);

          const _performanceMonitor = new VSTPerformanceMonitor(audioContext);
          const _sidechainRouter = new SidechainRouter(audioContext);
          const _automationEngine = new VSTAutomationEngine(audioContext);

          // Set up performance callbacks
          performanceMonitor.onOverload(() => {
            console.warn('[VSTStore] CPU overload detected');
            get().setCPUOverload(true);
          });

          // onMemoryWarning: not available on VSTPerformanceMonitor

          // onDropout: not available on VSTPerformanceMonitor

          set({
            performanceMonitor,
            sidechainRouter,
            automationEngine,
            initialized: true,
          });

          console.log('[VSTStore] Initialized successfully');
        } catch (error) {
          console.error('[VSTStore] Initialization failed:', error);
          throw error;
        }
      },

      // ============================================
      // PERFORMANCE MONITORING
      // ============================================

      startMonitoring: () => {
        const { performanceMonitor, isMonitoring } = get();

        if (!performanceMonitor) {
          console.error('[VSTStore] Cannot start monitoring: not initialized');
          return;
        }

        if (isMonitoring) {
          console.warn('[VSTStore] Monitoring already active');
          return;
        }

        performanceMonitor.start();
        
        // Set up periodic updates
        const _intervalId = setInterval(() => {
          const _snapshot = performanceMonitor.getCurrentSnapshot();
          get().updatePerformance(snapshot);
        }, PERFORMANCE_UPDATE_INTERVAL);

        // Store interval ID for cleanup
        _monitoringIntervalId = intervalId;

        set({ isMonitoring: true });
        console.log('[VSTStore] Performance monitoring started');
      },

      stopMonitoring: () => {
        const { performanceMonitor } = get();

        if (!performanceMonitor) {
          return;
        }

        performanceMonitor.stop();

        // Clear interval
        if (_monitoringIntervalId !== null) {
          clearInterval(_monitoringIntervalId);
          _monitoringIntervalId = null;
        }

        set({ isMonitoring: false });
        console.log('[VSTStore] Performance monitoring stopped');
      },

      updatePerformance: (snapshot: PerformanceSnapshot) => {
        const { performanceHistory } = get();

        // Add to history
        const _newHistory = [...performanceHistory, snapshot];
        
        // Trim if too long
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          newHistory.shift();
        }

        set({
          currentSnapshot: snapshot,
          performanceHistory: newHistory,
        });

        // Check thresholds
        if (snapshot.cpu.total > 85) {
          get().setCPUOverload(true);
        } else if (snapshot.cpu.total < 70) {
          get().setCPUOverload(false);
        }

        if (snapshot.memory.percentage > 90) {
          get().setMemoryWarning(true);
        } else if (snapshot.memory.percentage < 75) {
          get().setMemoryWarning(false);
        }
      },

      clearPerformanceHistory: () => {
        set({ performanceHistory: [] });
      },

      // ============================================
      // ALERTS
      // ============================================

      setCPUOverload: (overload: boolean) => {
        set({ cpuOverload: overload });
      },

      setMemoryWarning: (warning: boolean) => {
        set({ memoryWarning: warning });
      },

      incrementDropoutCount: () => {
        set(state => ({ dropoutCount: state.dropoutCount + 1 }));
      },

      resetDropoutCount: () => {
        set({ dropoutCount: 0 });
      },

      // ============================================
      // CHANNEL FX CHAINS
      // ============================================

      addPluginToChannel: (channelId, pluginId, pluginName) => {
        const _chains = get().channelFXChains;
        const chain  = chains[channelId] ?? [];
        set({
          channelFXChains: { ...chains, [channelId]: [...chain, pluginId] },
          activePlugin: { id: pluginId, name: pluginName, channelId },
        });
        console.log(`[VSTStore] '${pluginName}' → channel '${channelId}'`);
      },

      removePluginFromChannel: (channelId, pluginIndex) => {
        const _chains = get().channelFXChains;
        const chain  = [...(chains[channelId] ?? [])];
        chain.splice(pluginIndex, 1);
        set({ channelFXChains: { ...chains, [channelId]: chain } });
      },

      reorderChannelFX: (channelId, from, to) => {
        const _chains = get().channelFXChains;
        const chain  = [...(chains[channelId] ?? [])];
        const [item] = chain.splice(from, 1);
        chain.splice(to, 0, item);
        set({ channelFXChains: { ...chains, [channelId]: chain } });
      },

      setActivePlugin: (plugin) => set({ activePlugin: plugin }),

      // ============================================
      // CLEANUP
      // ============================================

      cleanup: () => {
        const { performanceMonitor, sidechainRouter, automationEngine } = get();

        // Stop monitoring
        if (get().isMonitoring) {
          get().stopMonitoring();
        }

        // Dispose systems
        if (performanceMonitor) {
          performanceMonitor.dispose();
        }
        if (sidechainRouter) {
          sidechainRouter.dispose();
        }
        if (automationEngine) {
          automationEngine.dispose();
        }

        set({
          ...initialState,
        });

        console.log('[VSTStore] Cleanup complete');
      },
    }),
    { name: 'VSTStore' }
  )
);

// ============================================
// SELECTORS
// ============================================

export const _selectCPUUsage = (state: VSTStore) => 
  state.currentSnapshot?.cpu.total ?? 0;

export const _selectMemoryUsage = (state: VSTStore) => 
  state.currentSnapshot?.memory.percentage ?? 0;

export const _selectLatency = (state: VSTStore) => 
  state.currentSnapshot?.latency.total ?? 0;

export const _selectHasAlerts = (state: VSTStore) =>
  state.cpuOverload || state.memoryWarning || state.dropoutCount > 0;

export const _selectChannelFX = (channelId: string) => (state: VSTStore) =>
  state.channelFXChains[channelId] ?? [];

export const _selectActivePlugin = (state: VSTStore) =>
  state.activePlugin;

export const _selectPerformanceHistory = (state: VSTStore, duration: number = 10) => {
  const _now = Date.now();
  const _cutoff = now - (duration * 1000);
  return state.performanceHistory.filter(s => s.timestamp >= cutoff);
};