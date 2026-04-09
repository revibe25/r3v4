// @ts-nocheck
// client/src/components/vst-master-panel.tsx
import { useState, Suspense, useRef } from 'react';
import { VSTProjectSerializer } from '@/audio/fx/vst-project-serializer';
import type { SerializedVSTChain } from '@/audio/fx/vst-project-serializer';
import type { FXChain } from '@/audio/fx/fx-chain';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { VSTProjectManagerUI } from './vst-project-manager-ui';
import { VSTAutomationUI } from './vst-automation-ui';
import { VSTSidechainUI } from './vst-sidechain-ui';
import { VSTPerformanceUI } from './vst-performance-monitor-ui';

import type {
  VSTPerformanceMonitor,
  VSTAutomationEngine,
  MixerChannel,
} from '@/types/audio';
import { SidechainRouter } from '@/audio/fx/vst-sidechain';

// ============================================
// TYPES
// ============================================

interface VSTMasterPanelProps {
  performanceMonitor: VSTPerformanceMonitor;
  sidechainRouter: SidechainRouter;
  automationEngine: VSTAutomationEngine;
  channels: MixerChannel[];
  /** May return a Promise — allows callers to perform async serialization. */
  onProjectSave: () => Promise<ProjectData> | ProjectData;
  onProjectLoad: (data: ProjectData) => Promise<void>;
}

export interface ProjectData {
  version: string;
  timestamp: number;
  chains: ChannelChain[];
  sidechains: unknown[];
  globalSettings: {
    sampleRate: number;
    bufferSize: number;
  };
}

export interface ChannelChain {
  channelId: string;
  effects: EffectConfig[];
}

export interface EffectConfig {
  id: string;
  type: string;
  bypassed: boolean;
}

// ============================================
// PLACEHOLDER
// ============================================

function VSTPluginManagerPlaceholder() {
  return (
    <div className="border border-[#222] p-8 text-center">
      <div className="text-4xl mb-4">🔌</div>
      <p className="text-xs tracking-widest uppercase text-[#888]">VST Plugin Manager</p>
      <p className="text-xs text-[#444] mt-1 tracking-wider">Coming soon...</p>
    </div>
  );
}

// ============================================
// LOADING FALLBACK
// ============================================

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8 font-mono">
      <Loader2 className="animate-spin h-6 w-6 text-[#a3e635] mr-3" />
      <span className="text-xs tracking-widest text-[#888]">LOADING...</span>
    </div>
  );
}

// ============================================
// SECTION HEADER
// ============================================

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-4 border-b border-[#1a1a1a] pb-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-[#a3e635]">
        {label}
      </h2>
      {sub && (
        <p className="text-[10px] tracking-wider text-[#555] mt-1">{sub}</p>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

function VSTMasterPanel({
  performanceMonitor,
  sidechainRouter,
  automationEngine,
  channels,
  onProjectSave,
  onProjectLoad,
}: VSTMasterPanelProps) {
  const [loadingProject, setLoadingProject] = useState(false);
  const [activeTab, setActiveTab] = useState('project');

  // Lazy AudioContext for serializer (only needed for sampleRate)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  };

  const handleSaveProject = async () => {
    try {
      const projectData = await onProjectSave();
      console.log('Project saved:', projectData);
      return projectData;
    } catch (error) {
      console.error('Failed to save project:', error);
      throw error;
    }
  };

  const handleLoadProject = async (data: ProjectData) => {
    setLoadingProject(true);
    try {
      await onProjectLoad(data);
      console.log('Project loaded successfully');
    } catch (error) {
      console.error('Failed to load project:', error);
      throw error;
    } finally {
      setLoadingProject(false);
    }
  };

  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono">

      {/* Loading bar */}
      {loadingProject && (
        <div className="border border-[#a3e635]/20 bg-[#a3e635]/5 px-4 py-3 mb-4 flex items-center gap-3">
          <Loader2 className="animate-spin h-4 w-4 text-[#a3e635] shrink-0" />
          <span className="text-xs tracking-widest uppercase text-[#a3e635]">
            Loading project...
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/* Tab bar */}
        <TabsList className="
          w-full grid grid-cols-5
          bg-[#0a0a0a] border-b border-[#1a1a1a]
          rounded-none h-auto p-0
        ">
          {[
            { value: 'project',    label: 'Project'     },
            { value: 'plugins',    label: 'Plugins'     },
            { value: 'automation', label: 'Automation'  },
            { value: 'sidechain',  label: 'Sidechain'   },
            { value: 'monitor',    label: 'Performance' },
          ].map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="
                rounded-none border-r border-[#1a1a1a] last:border-r-0
                text-[10px] tracking-widest uppercase font-mono py-3
                text-[#555] hover:text-[#888] transition-colors
                data-[state=active]:bg-transparent
                data-[state=active]:text-[#a3e635]
                data-[state=active]:border-b-2
                data-[state=active]:border-b-[#a3e635]
                data-[state=active]:shadow-none
              "
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab content */}
        <div className="pt-6">

          {/* ── Project ── */}
          <TabsContent value="project" className="mt-0">
            <SectionHeader
              label="Project Manager"
              sub="Save, load, and back up your VST project state"
            />
            <VSTProjectManagerUI
              onSave={() => {
                // Build chains Map directly from channel fxChains
                const chains = new Map<string, FXChain>();
                channels.forEach(ch => chains.set(ch.id, ch.fxChain));
                return VSTProjectSerializer.serializeProject(
                  chains,
                  sidechainRouter,
                  getAudioCtx()
                );
              }}
              onLoad={async (data: SerializedVSTChain) => {
                const audioCtx = getAudioCtx();
                const restoredChains = await VSTProjectSerializer.deserializeProject(
                  data,
                  audioCtx
                );
                // Convert SerializedVSTChain → ProjectData for onProjectLoad
                await onProjectLoad({
                  version: data.version,
                  timestamp: data.timestamp,
                  chains: Array.from(restoredChains.entries()).map(
                    ([channelId, chain]) => ({
                      channelId,
                      effects: chain.getAllEffects().map(fx => ({
                        id: fx.id,
                        type: (fx as any).type ?? 'vst',
                        bypassed: fx.bypassed ?? false,
                      })),
                    })
                  ),
                  sidechains: data.sidechains,
                  globalSettings: data.globalSettings,
                });
              }}
            />
          </TabsContent>

          {/* ── Plugins ── */}
          <TabsContent value="plugins" className="mt-0">
            <SectionHeader
              label="VST Plugins"
              sub="Browse and manage installed VST plugins"
            />
            <VSTPluginManagerPlaceholder />
          </TabsContent>

          {/* ── Automation ── */}
          <TabsContent value="automation" className="mt-0">
            <SectionHeader
              label="Automation"
              sub="Parameter automation lanes and recording"
            />
            <Suspense fallback={<LoadingFallback />}>
              <VSTAutomationUI
                automationEngine={automationEngine}
                paramId={0}
                paramName="Master Volume"
                minValue={0}
                maxValue={1}
                currentValue={0.8}
              />
            </Suspense>
          </TabsContent>

          {/* ── Sidechain ── */}
          <TabsContent value="sidechain" className="mt-0">
            <SectionHeader
              label="Sidechain Routing"
              sub="Route audio between channels for sidechain compression"
            />
            <Suspense fallback={<LoadingFallback />}>
              <VSTSidechainUI
                router={sidechainRouter}
                channels={channels}
                onUpdate={() => {}}
              />
            </Suspense>
          </TabsContent>

          {/* ── Performance ── */}
          <TabsContent value="monitor" className="mt-0">
            <SectionHeader
              label="Performance Monitor"
              sub="CPU, latency, and buffer usage per plugin"
            />
            <Suspense fallback={<LoadingFallback />}>
              <VSTPerformanceUI
                monitor={performanceMonitor}
                vstIds={channels.map(c => c.id)}
              />
            </Suspense>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default VSTMasterPanel;
export { VSTMasterPanel };
export type { VSTMasterPanelProps, ChannelChain, EffectConfig };
