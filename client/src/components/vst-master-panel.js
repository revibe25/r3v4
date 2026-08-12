import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
// client/src/components/vst-master-panel.tsx
import { useState, Suspense, useRef } from 'react';
import { VSTProjectSerializer } from '@/audio/fx/vst-project-serializer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { VSTProjectManagerUI } from './vst-project-manager-ui';
import { VSTAutomationUI } from './vst-automation-ui';
import { VSTSidechainUI } from './vst-sidechain-ui';
import { VSTPerformanceUI } from './vst-performance-monitor-ui';
import { getAudioContext } from '@/audio/core/audio-context';
// ============================================
// PLACEHOLDER
// ============================================
function VSTPluginManagerPlaceholder() {
    return (_jsxs("div", { className: "border border-[var(--dj-border)] p-8 text-center", children: [_jsx("div", { className: "text-4xl mb-4", children: "\uD83D\uDD0C" }), _jsx("p", { className: "text-xs tracking-widest uppercase text-[var(--text-dim)]", children: "VST Plugin Manager" }), _jsx("p", { className: "text-xs text-[var(--dj-dim)] mt-1 tracking-wider", children: "Coming soon..." })] }));
}
// ============================================
// LOADING FALLBACK
// ============================================
function LoadingFallback() {
    return (_jsxs("div", { className: "flex items-center justify-center p-8 font-mono", children: [_jsx(Loader2, { className: "animate-spin h-6 w-6 text-[#a3e635] mr-3" }), _jsx("span", { className: "text-xs tracking-widest text-[var(--text-dim)]", children: "LOADING..." })] }));
}
// ============================================
// SECTION HEADER
// ============================================
function SectionHeader({ label, sub }) {
    return (_jsxs("div", { className: "mb-4 border-b border-[var(--t-b2x)] pb-3", children: [_jsx("h2", { className: "text-xs font-bold tracking-widest uppercase text-[#a3e635]", children: label }), sub && (_jsx("p", { className: "text-[10px] tracking-wider text-[#555] mt-1", children: sub }))] }));
}
// ============================================
// MAIN COMPONENT
// ============================================
function VSTMasterPanel({ performanceMonitor, sidechainRouter, automationEngine, channels, onProjectSave, onProjectLoad, }) {
    const [loadingProject, setLoadingProject] = useState(false);
    const [activeTab, setActiveTab] = useState('project');
    // Lazy AudioContext for serializer (only needed for sampleRate)
    const audioCtxRef = useRef(null);
    const getAudioCtx = () => {
        if (!audioCtxRef.current)
            audioCtxRef.current = getAudioContext();
        return audioCtxRef.current;
    };
    const _handleSaveProject = async () => {
        try {
            const projectData = await onProjectSave();
            console.log('Project saved:', projectData);
            return projectData;
        }
        catch (error) {
            console.error('Failed to save project:', error);
            throw error;
        }
    };
    const _handleLoadProject = async (data) => {
        setLoadingProject(true);
        try {
            await onProjectLoad(data);
            console.log('Project loaded successfully');
        }
        catch (error) {
            console.error('Failed to load project:', error);
            throw error;
        }
        finally {
            setLoadingProject(false);
        }
    };
    return (_jsxs("div", { className: "w-full bg-[var(--void)] text-[var(--daw-fg)] font-mono", children: [loadingProject && (_jsxs("div", { className: "border border-[#a3e635]/20 bg-[#a3e635]/5 px-4 py-3 mb-4 flex items-center gap-3", children: [_jsx(Loader2, { className: "animate-spin h-4 w-4 text-[#a3e635] shrink-0" }), _jsx("span", { className: "text-xs tracking-widest uppercase text-[#a3e635]", children: "Loading project..." })] })), _jsxs(Tabs, { value: activeTab, onValueChange: setActiveTab, children: [_jsx(TabsList, { className: "\n          w-full grid grid-cols-5\n          bg-[#0a0a0a] border-b border-[var(--t-b2x)]\n          rounded-none h-auto p-0\n        ", children: [
                            { value: 'project', label: 'Project' },
                            { value: 'plugins', label: 'Plugins' },
                            { value: 'automation', label: 'Automation' },
                            { value: 'sidechain', label: 'Sidechain' },
                            { value: 'monitor', label: 'Performance' },
                        ].map(({ value, label }) => (_jsx(TabsTrigger, { value: value, className: "\n                rounded-none border-r border-[var(--t-b2x)] last:border-r-0\n                text-[10px] tracking-widest uppercase font-mono py-3\n                text-[#555] hover:text-[var(--text-dim)] transition-colors\n                data-[state=active]:bg-transparent\n                data-[state=active]:text-[#a3e635]\n                data-[state=active]:border-b-2\n                data-[state=active]:border-b-[#a3e635]\n                data-[state=active]:shadow-none\n              ", children: label }, value))) }), _jsxs("div", { className: "pt-6", children: [_jsxs(TabsContent, { value: "project", className: "mt-0", children: [_jsx(SectionHeader, { label: "Project Manager", sub: "Save, load, and back up your VST project state" }), _jsx(VSTProjectManagerUI, { onSave: () => {
                                            // Build chains Map directly from channel fxChains
                                            const chains = new Map();
                                            channels.forEach(ch => chains.set(ch.id, ch.fxChain));
                                            return VSTProjectSerializer.serializeProject(chains, sidechainRouter, getAudioCtx());
                                        }, onLoad: async (data) => {
                                            const audioCtx = getAudioCtx();
                                            const restoredChains = await VSTProjectSerializer.deserializeProject(data, audioCtx);
                                            // Convert SerializedVSTChain → ProjectData for onProjectLoad
                                            await onProjectLoad({
                                                version: data.version,
                                                timestamp: data.timestamp,
                                                chains: Array.from(restoredChains.entries()).map(([channelId, chain]) => ({
                                                    channelId,
                                                    effects: chain.getAllEffects().map(fx => ({
                                                        id: fx.id,
                                                        type: fx.type ?? 'vst',
                                                        bypassed: fx.bypassed ?? false,
                                                    })),
                                                })),
                                                sidechains: data.sidechains,
                                                globalSettings: data.globalSettings,
                                            });
                                        } })] }), _jsxs(TabsContent, { value: "plugins", className: "mt-0", children: [_jsx(SectionHeader, { label: "VST Plugins", sub: "Browse and manage installed VST plugins" }), _jsx(VSTPluginManagerPlaceholder, {})] }), _jsxs(TabsContent, { value: "automation", className: "mt-0", children: [_jsx(SectionHeader, { label: "Automation", sub: "Parameter automation lanes and recording" }), _jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(VSTAutomationUI, { automationEngine: automationEngine, paramId: 0, paramName: "Master Volume", minValue: 0, maxValue: 1, currentValue: 0.8 }) })] }), _jsxs(TabsContent, { value: "sidechain", className: "mt-0", children: [_jsx(SectionHeader, { label: "Sidechain Routing", sub: "Route audio between channels for sidechain compression" }), _jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(VSTSidechainUI, { router: sidechainRouter, channels: channels, onUpdate: () => { } }) })] }), _jsxs(TabsContent, { value: "monitor", className: "mt-0", children: [_jsx(SectionHeader, { label: "Performance Monitor", sub: "CPU, latency, and buffer usage per plugin" }), _jsx(Suspense, { fallback: _jsx(LoadingFallback, {}), children: _jsx(VSTPerformanceUI, { monitor: performanceMonitor, vstIds: channels.map(c => c.id) }) })] })] })] })] }));
}
// ============================================
// EXPORTS
// ============================================
export default VSTMasterPanel;
export { VSTMasterPanel };
