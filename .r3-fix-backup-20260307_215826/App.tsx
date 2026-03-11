// client/src/App.tsx
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  Component,
  type ReactNode,
  type ComponentType,
} from 'react';
import { Switch, Route } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageNav } from '@/components/page-nav';
import { ThemeProvider } from '@/components/theme-provider';
import type { ProjectData } from '@/components/vst-master-panel';
// ─── TYPE-ONLY imports (zero runtime cost — stripped by TypeScript) ───────────
import type { VSTPerformanceMonitor } from '@/audio/fx/vst-performance-monitor';
import type { SidechainRouter } from '@/audio/fx/vst-sidechain';
import type { VSTAutomationEngine } from '@/audio/fx/vst-automation-engine';
import type { MixerChannel } from '@/audio/mixer/mixer-channel';
import type { FXChain } from '@/audio/fx/fx-chain';
// ─── LAZY PAGES ───────────────────────────────────────────────────────────────
const InstrumentPage  = lazy(() => import('@/pages/instrument'));
const NotFound        = lazy(() => import('@/pages/not-found'));
const MultiTrackPanel = lazy(() => import('@/components/multi-track-panel'));
const VSTMasterPanel  = lazy(() => import('@/components/vst-master-panel'));
const LoopStation505  = lazy(() =>
  import('@/features/loopstation/LoopStation505').then(m => ({
    default: m.LoopStation505 as ComponentType,
  }))
);
// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-screen bg-[#060606] text-[#f0f0f0] font-mono">
            <div className="text-center max-w-md">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-2">Failed to Load Component</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {this.state.error?.message ?? 'An unexpected error occurred.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#a3e635] hover:bg-[#84cc16] text-[#060606]
                           rounded-none font-mono text-xs tracking-widest uppercase transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// LOADING FALLBACKS
// ─────────────────────────────────────────────────────────────────────────────
function LoadingFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-screen bg-[#060606] text-[#f0f0f0] font-mono">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a3e635] mx-auto mb-4" />
        <p className="text-sm tracking-wider">{message}</p>
      </div>
    </div>
  );
}
function PanelFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-[#f0f0f0] font-mono">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a3e635] mx-auto mb-3" />
        <p className="text-xs tracking-wider text-[#888]">{message}</p>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// VST CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
interface VSTContextType {
  performanceMonitor: VSTPerformanceMonitor;
  sidechainRouter: SidechainRouter;
  automationEngine: VSTAutomationEngine;
  audioContext: AudioContext;
  channels: MixerChannel[];
  addChannel: (id: string) => MixerChannel;
  removeChannel: (id: string) => void;
  getChannel: (id: string) => MixerChannel | undefined;
}
const VSTContext = createContext<VSTContextType | null>(null);
export function useVSTContext(): VSTContextType {
  const ctx = useContext(VSTContext);
  if (!ctx) throw new Error('useVSTContext must be used within <VSTProvider>');
  return ctx;
}
export function useVSTContextOptional(): VSTContextType | null {
  return useContext(VSTContext);
}
// ─────────────────────────────────────────────────────────────────────────────
// VST PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
function VSTProvider({ children }: { children: ReactNode }) {
  const [vstSystem, setVstSystem] = useState<VSTContextType | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const channelsMap = new Map<string, MixerChannel>();
    const initAudio = async () => {
      const [
        { VSTPerformanceMonitor },
        { SidechainRouter },
        { VSTAutomationEngine },
        { getAudioContext },
        { MixerChannel },
      ] = await Promise.all([
        import('@/audio/fx/vst-performance-monitor'),
        import('@/audio/fx/vst-sidechain'),
        import('@/audio/fx/vst-automation-engine'),
        import('@/audio/core/audio-context'),
        import('@/audio/mixer/mixer-channel'),
      ]);
      const audioContext = await getAudioContext();
      const system: VSTContextType = {
        performanceMonitor: new VSTPerformanceMonitor(audioContext),
        sidechainRouter:    new SidechainRouter(audioContext),
        automationEngine:   new VSTAutomationEngine(audioContext),
        audioContext,
        channels: [],
        addChannel(id) {
          if (channelsMap.has(id)) return channelsMap.get(id)!;
          const ch = new MixerChannel(id);
          channelsMap.set(id, ch);
          setVstSystem(prev =>
            prev ? { ...prev, channels: Array.from(channelsMap.values()) } : null
          );
          return ch;
        },
        removeChannel(id) {
          const ch = channelsMap.get(id);
          if (ch) {
            ch.dispose();
            channelsMap.delete(id);
            setVstSystem(prev =>
              prev ? { ...prev, channels: Array.from(channelsMap.values()) } : null
            );
          }
        },
        getChannel: id => channelsMap.get(id),
      };
      setVstSystem(system);
      (channelsMap as Map<string, MixerChannel> & { __system?: VSTContextType }).__system = system;
    };
    const onGesture = () => {
      initAudio().catch(err => {
        console.error('[VSTProvider] Audio init failed:', err);
        setInitError(err?.message ?? 'Audio initialization failed.');
      });
      document.removeEventListener('click',   onGesture);
      document.removeEventListener('keydown', onGesture);
    };
    document.addEventListener('click',   onGesture);
    document.addEventListener('keydown', onGesture);
    return () => {
      document.removeEventListener('click',   onGesture);
      document.removeEventListener('keydown', onGesture);
      const typedMap = channelsMap as Map<string, MixerChannel> & { __system?: VSTContextType };
      const system = typedMap.__system;
      if (system) {
        system.performanceMonitor.dispose();
        system.sidechainRouter.dispose();
        system.automationEngine.dispose();
      }
      channelsMap.forEach(ch => ch.dispose());
      channelsMap.clear();
    };
  }, []);
  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#060606] text-[#f0f0f0] font-mono">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Audio Engine Error</h2>
          <p className="text-sm text-red-400 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#a3e635] hover:bg-[#84cc16] text-[#060606]
                       rounded-none font-mono text-xs tracking-widest uppercase transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!vstSystem) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#060606] text-[#f0f0f0] font-mono">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a3e635] mx-auto mb-4" />
          <p className="text-sm tracking-wider">Initializing VST Engine…</p>
          <p className="text-xs tracking-wider text-[#666] mt-2">
            Click or press any key to activate audio
          </p>
        </div>
      </div>
    );
  }
  return <VSTContext.Provider value={vstSystem}>{children}</VSTContext.Provider>;
}
// ─────────────────────────────────────────────────────────────────────────────
// VST MANAGER PAGE
// ─────────────────────────────────────────────────────────────────────────────
function VSTManagerPage() {
  const vstContext = useVSTContext();
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Returns ProjectData — the serialized form expected by VSTMasterPanel.
  const handleProjectSave = async (): Promise<ProjectData> => {
    setSaveStatus('saving');
    try {
      const { VSTProjectSerializer } = await import('@/audio/fx/vst-project-serializer');
      const { FXChain }              = await import('@/audio/fx/fx-chain');
      const chainMap = new Map<string, FXChain>();
      vstContext.channels.forEach(ch => chainMap.set(ch.id, ch.fxChain));
      const data = VSTProjectSerializer.serializeProject(
        chainMap,
        vstContext.sidechainRouter,
        vstContext.audioContext,
      ) as unknown as ProjectData; // SerializedVSTChain satisfies ProjectData shape
      VSTProjectSerializer.createBackup(data as any, `auto-${Date.now()}`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return data;
    } catch (err) {
      console.error('[VSTManagerPage] Save failed:', err);
      setSaveStatus('error');
      throw err;
    }
  };

  const handleProjectLoad = async (data: ProjectData) => {
    setLoadError(null);
    if (!data?.version || !Array.isArray(data?.chains)) {
      const msg = 'Invalid project file: missing "version" or "chains".';
      setLoadError(msg);
      throw new Error(msg);
    }
    const { VSTProjectSerializer } = await import('@/audio/fx/vst-project-serializer');
    const { FXChain }              = await import('@/audio/fx/fx-chain');
    try {
      const chainMap = new Map<string, FXChain>();
      vstContext.channels.forEach(ch => chainMap.set(ch.id, ch.fxChain));
      const snapshot = VSTProjectSerializer.serializeProject(
        chainMap,
        vstContext.sidechainRouter,
        vstContext.audioContext,
      );
      VSTProjectSerializer.createBackup(snapshot, `pre-load-${Date.now()}`);
    } catch (backupErr) {
      console.warn('[VSTManagerPage] Pre-load backup failed:', backupErr);
    }
    vstContext.channels.map(ch => ch.id).forEach(id => vstContext.removeChannel(id));
    for (const chainData of data.chains) {
      const ch = vstContext.addChannel(chainData.channelId);
      const anyChain = chainData as unknown as Record<string, unknown>;
      if (typeof anyChain['volume'] === 'number') ch.setVolume(anyChain['volume']);
      if (typeof anyChain['pan'] === 'number')    ch.setPan(anyChain['pan']);
      if (typeof anyChain['muted'] === 'boolean') ch.setMute(anyChain['muted']);
      if (typeof anyChain['solo'] === 'boolean')  ch.setSolo(anyChain['solo']);
      if (typeof anyChain['armed'] === 'boolean') ch.setArmed(anyChain['armed']);
      if (typeof anyChain['name'] === 'string')   ch.setName(anyChain['name']);
    }
    try {
      const restoredChains = await VSTProjectSerializer.deserializeProject(
        data as any,
        vstContext.audioContext,
      );
      restoredChains.forEach((fxChain: FXChain, channelId: string) => {
        const ch = vstContext.getChannel(channelId);
        if (!ch) return;
        ch.clearFX();
        // Pass FXNodeBase processors, not FXSlots, to MixerChannel.addFX
        fxChain.getAllEffects().forEach(slot => {
          if (slot.processor) ch.addFX(slot.processor);
        });
      });
    } catch (fxErr) {
      const warning = 'Project loaded with warnings: one or more FX plugins could not be restored.';
      console.error('[VSTManagerPage] FX restore error:', fxErr);
      setLoadError(warning);
    }
    if (Array.isArray(data.sidechains) && data.sidechains.length > 0) {
      vstContext.sidechainRouter.getAllConnections().forEach(conn => {
        try { vstContext.sidechainRouter.removeConnection(conn.id); } catch (_) {}
      });
      data.sidechains.forEach((config: unknown) => {
        const c = config as Record<string, unknown>;
        try {
          const sourceCh = vstContext.getChannel(c['sourceChannelId'] as string);
          if (!sourceCh) {
            console.warn('[VSTManagerPage] Sidechain: source not found:', c['sourceChannelId']);
            return;
          }
          const targetCh  = vstContext.getChannel((c['targetChannelId'] ?? c['sourceChannelId']) as string);
          const targetVST = targetCh?.getVSTPlugins().find((v: { id: unknown }) => v.id === c['targetVSTId']);
          if (!targetVST) {
            console.warn('[VSTManagerPage] Sidechain: target VST not found:', c['targetVSTId']);
            return;
          }
          vstContext.sidechainRouter.createSidechain(c as any, sourceCh.output, targetVST);
        } catch (e) {
          console.warn('[VSTManagerPage] Sidechain restore skipped:', config, e);
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-[#f0f0f0] font-mono">
      <PageNav />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2 tracking-widest uppercase text-[#a3e635]">
            🔌 VST Plugin Manager
          </h1>
          <p className="text-[#888] mt-2 text-xs tracking-wider">
            Manage your VST plugins, performance monitoring, and routing
          </p>
          {saveStatus === 'saving' && (
            <p className="mt-2 text-xs text-[#888] tracking-wider">Saving…</p>
          )}
          {saveStatus === 'saved' && (
            <p className="mt-2 text-xs text-[#a3e635] tracking-wider">✓ Project saved &amp; backed up</p>
          )}
          {saveStatus === 'error' && (
            <p className="mt-2 text-xs text-red-400 tracking-wider">✗ Save failed — check console</p>
          )}
          {loadError && (
            <div className="mt-3 flex items-start gap-2 rounded-none border border-yellow-500/40
                            bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 tracking-wider">
              <span>⚠</span>
              <span className="flex-1">{loadError}</span>
              <button
                onClick={() => setLoadError(null)}
                className="text-yellow-400 hover:text-yellow-200"
                aria-label="Dismiss warning"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <ErrorBoundary>
          <Suspense fallback={<PanelFallback message="Loading VST Master Panel…" />}>
            <VSTMasterPanel
              performanceMonitor={vstContext.performanceMonitor}
              sidechainRouter={vstContext.sidechainRouter}
              automationEngine={vstContext.automationEngine}
              channels={vstContext.channels}
              onProjectSave={handleProjectSave}
              onProjectLoad={handleProjectLoad}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ROUTE PAGE SHELLS
// ─────────────────────────────────────────────────────────────────────────────
function MultiTrackPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback message="Loading MultiTrack DAW…" />}>
        <MultiTrackPanel />
      </Suspense>
    </ErrorBoundary>
  );
}
function LoopStationPage() {
  return (
    <div className="min-h-screen bg-[#060606] text-[#f0f0f0] font-mono flex flex-col">
      <PageNav />
      <div className="flex-1 flex items-start justify-center p-6 overflow-auto">
        <div className="w-full max-w-5xl">
          <ErrorBoundary>
            <Suspense fallback={<PanelFallback message="Loading Loop Station…" />}>
              <LoopStation505 />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
function VSTRoute() {
  return (
    <ErrorBoundary>
      <VSTProvider>
        <VSTManagerPage />
      </VSTProvider>
    </ErrorBoundary>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback message="Loading Instrument…" />}>
              <InstrumentPage />
            </Suspense>
          </ErrorBoundary>
        )}
      </Route>
      <Route path="/multitrack">
        {() => <MultiTrackPage />}
      </Route>
      <Route path="/vst">
        {() => <VSTRoute />}
      </Route>
      <Route path="/loopstation">
        {() => <LoopStationPage />}
      </Route>
      <Route>
      <Route path="/pricing" element={<Pricing />} /> {/* added by r3-subscription installer */}
        {() => (
          <Suspense fallback={null}>
            <NotFound />
          </Suspense>
        )}
      </Route>
    </Switch>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// APP SHELL
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
export default App;

import Pricing from './pages/Pricing'; // added by r3-subscription installer
