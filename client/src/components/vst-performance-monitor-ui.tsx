// client/src/components/vst-performance-monitor-ui.tsx
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Zap, AlertTriangle, TrendingUp, MemoryStick, Clock } from 'lucide-react';
import type { VSTPerformanceMonitor } from '@/types/audio';

interface PerformanceMetrics { cpuUsage:number; memoryUsage:number; latency:number; processingTime:number; peakProcessingTime:number; bufferUnderruns:number; }
interface VSTPerformanceUIProps { monitor:VSTPerformanceMonitor; vstIds:string[]; }

const TL = "w-full grid bg-[#0a0a0a] border-b border-[#1a1a1a] rounded-none h-auto p-0";
const TT = "rounded-none border-r border-[#1a1a1a] last:border-r-0 text-[10px] tracking-widest uppercase font-mono py-2.5 text-[#f0f0f0] hover:text-[#a3e635] transition-colors data-[state=active]:bg-transparent data-[state=active]:text-[#a3e635] data-[state=active]:border-b-2 data-[state=active]:border-b-[#a3e635] data-[state=active]:shadow-none";

function MonoBar({ value, max=100, warn=50, danger=80 }: { value:number; max?:number; warn?:number; danger?:number }) {
  const pct=Math.min((value/max)*100,100);
  const color=value>=danger?'#ef4444':value>=warn?'#f59e0b':'#a3e635';
  return <div className="h-1.5 bg-[#0d0d0d] border border-[#1a1a1a] overflow-hidden"><div className="h-full transition-all duration-100" style={{width:`${pct}%`,background:color}} /></div>;
}

function StatBox({ icon, label, value, pct, warn, danger }: { icon:React.ReactNode; label:string; value:string; pct:number; warn?:number; danger?:number }) {
  return (
    <div className="border border-[#1a1a1a] p-4 space-y-3">
      <div className="flex items-center gap-2"><span className="text-[#555]">{icon}</span><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">{label}</span></div>
      <div className="text-xl font-mono text-[#f0f0f0] tracking-wider">{value}</div>
      <MonoBar value={pct} warn={warn} danger={danger} />
    </div>
  );
}

export function VSTPerformanceUI({ monitor, vstIds }: VSTPerformanceUIProps) {
  const [metrics,setMetrics]=useState<Map<string,PerformanceMetrics>>(new Map());
  const [totalCPU,setTotalCPU]=useState(0);
  useEffect(()=>{const id=setInterval(()=>{setMetrics(monitor.getAllMetrics());setTotalCPU(monitor.getTotalCPUUsage());},100);return()=>clearInterval(id);},[monitor]);
  const cpuColor=totalCPU>=80?'text-red-400':totalCPU>=50?'text-yellow-400':'text-[#a3e635]';

  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-[#1a1a1a] pb-3">
        <span className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#f0f0f0]">
          <Activity className="h-3.5 w-3.5 text-[#555]" /> Performance Monitor
        </span>
        <span className={`text-xs font-mono tracking-wider ${cpuColor}`}>{totalCPU.toFixed(1)}% CPU</span>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className={`${TL} grid-cols-3`}>
          {['overview','details','optimization'].map(tab=>(
            <TabsTrigger key={tab} value={tab} className={TT}>{tab}</TabsTrigger>
          ))}
        </TabsList>
        <div className="pt-5">
          <TabsContent value="overview"     className="mt-0"><SystemOverview totalCPU={totalCPU} metrics={metrics} /></TabsContent>
          <TabsContent value="details"      className="mt-0">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {(vstIds??[]).map(id=>{const m=metrics.get(id);if(!m)return null;return <VSTMetricsRow key={id} vstId={id} metrics={m} />;}).filter(Boolean)}
              {vstIds.length===0&&<p className="text-[10px] tracking-widest uppercase text-[#555] text-center py-8">No active VST plugins</p>}
            </div>
          </TabsContent>
          <TabsContent value="optimization" className="mt-0"><OptimizationPanel monitor={monitor} vstIds={vstIds} metrics={metrics} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function SystemOverview({ totalCPU, metrics }: { totalCPU:number; metrics:Map<string,PerformanceMetrics> }) {
  const totalMemory=Array.from(metrics.values()).reduce((s,m)=>s+m.memoryUsage,0);
  const avgLatency=metrics.size>0?Array.from(metrics.values()).reduce((s,m)=>s+m.latency,0)/metrics.size:0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatBox icon={<Zap className="h-3.5 w-3.5"/>}        label="Total CPU"   value={`${totalCPU.toFixed(1)}%`}      pct={totalCPU}                warn={50} danger={80} />
      <StatBox icon={<MemoryStick className="h-3.5 w-3.5"/>} label="Memory"      value={`${totalMemory.toFixed(0)} MB`} pct={(totalMemory/1024)*100} />
      <StatBox icon={<Clock className="h-3.5 w-3.5"/>}       label="Avg Latency" value={`${avgLatency.toFixed(1)} ms`}  pct={(avgLatency/50)*100}     warn={40} danger={80} />
      <StatBox icon={<Activity className="h-3.5 w-3.5"/>}    label="Active VSTs" value={metrics.size.toString()}         pct={(metrics.size/10)*100} />
    </div>
  );
}

function VSTMetricsRow({ vstId, metrics }: { vstId:string; metrics:PerformanceMetrics }) {
  return (
    <div className="border border-[#1a1a1a] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-wider text-[#f0f0f0]">{vstId}</span>
        {metrics.bufferUnderruns>0&&(
          <span className="flex items-center gap-1 text-[10px] tracking-wider text-red-400 border border-red-900/40 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3"/>{metrics.bufferUnderruns} underrun{metrics.bufferUnderruns>1?'s':''}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><div className="flex justify-between mb-1"><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">CPU</span><span className="text-[10px] font-mono text-[#a3e635]">{metrics.cpuUsage.toFixed(1)}%</span></div><MonoBar value={metrics.cpuUsage} warn={50} danger={80} /></div>
        <div><div className="flex justify-between mb-1"><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Latency</span><span className="text-[10px] font-mono text-[#a3e635]">{metrics.latency.toFixed(1)} ms</span></div><MonoBar value={metrics.latency} max={50} warn={20} danger={40} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[#1a1a1a] px-3 py-2"><div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1">Proc. Time</div><div className="text-sm font-mono text-[#f0f0f0]">{metrics.processingTime.toFixed(2)} ms</div></div>
        <div className="border border-[#1a1a1a] px-3 py-2"><div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1">Peak Time</div><div className="text-sm font-mono text-[#f0f0f0]">{metrics.peakProcessingTime.toFixed(2)} ms</div></div>
      </div>
    </div>
  );
}

function OptimizationPanel({ monitor, vstIds, metrics }: { monitor:VSTPerformanceMonitor; vstIds:string[]; metrics:Map<string,PerformanceMetrics> }) {
  const recs:{vstId:string;items:string[]}[]=[];
  (vstIds??[]).forEach(id=>{const items=monitor.getOptimizationRecommendations(id);if(items.length>0)recs.push({vstId:id,items});});
  if(recs.length===0) return (
    <div className="border border-dashed border-[#1a1a1a] py-12 text-center">
      <TrendingUp className="h-8 w-8 mx-auto mb-3 text-[#333]" />
      <p className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">All systems optimal</p>
      <p className="text-[10px] text-[#555] mt-1 tracking-wider">No recommendations at this time</p>
    </div>
  );
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {recs.map(({vstId,items})=>(
        <div key={vstId} className="border border-yellow-900/30 bg-yellow-900/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500"/><span className="text-xs tracking-wider text-yellow-400">{vstId}</span></div>
          <ul className="space-y-1.5 pl-5">{items.map((rec,i)=><li key={i} className="text-[10px] tracking-wider text-[#f0f0f0] flex gap-2"><span className="text-[#555]">—</span><span>{rec}</span></li>)}</ul>
        </div>
      ))}
    </div>
  );
}
