// @ts-nocheck
// client/src/components/vst-sidechain-ui.tsx
import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowRight, Activity, X } from 'lucide-react';
import { VSTFXNode } from '@/audio/fx/vst-fx-node';
import type { MixerChannel, SidechainConfig } from '@/types/audio';
import type { SidechainRouter } from '@/audio/fx/vst-sidechain';

interface SidechainUIProps { router: SidechainRouter; channels: MixerChannel[]; onUpdate: () => void; }

const P = "bg-[#a3e635] hover:bg-[var(--looper-lime)] text-[var(--void)] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const G = "border border-[#a3e635] text-[#a3e635] hover:bg-[#a3e635] hover:text-[var(--void)] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const D = "border border-red-500 text-red-400 hover:bg-red-500 hover:text-[var(--void)] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-2 py-1.5 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";

function MonoSlider(props: React.ComponentProps<typeof Slider>) {
  return <Slider {...props} className="[&>span:first-child]:bg-[var(--t-b2x)] [&>span:first-child]:rounded-none [&>span>span]:bg-[#a3e635] [&>span>span]:rounded-none [&_[role=slider]]:bg-[#a3e635] [&_[role=slider]]:border-0 [&_[role=slider]]:rounded-none [&_[role=slider]]:h-3 [&_[role=slider]]:w-1" />;
}

function MonoSelect({ value, onValueChange, options, placeholder, disabled, className }: { value:string; onValueChange:(v:string)=>void; options:{value:string;label:string}[]; placeholder?:string; disabled?:boolean; className?:string; }) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={`rounded-none border-[#2a2a2a] bg-[#0d0d0d] text-[var(--daw-fg)] font-mono text-xs tracking-wider focus:ring-0 focus:border-[#a3e635] disabled:opacity-40 ${className??''}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-none border-[#2a2a2a] bg-[#0d0d0d] font-mono text-xs">
        {options.map(o=><SelectItem key={o.value} value={o.value} className="text-[var(--daw-fg)] tracking-wider focus:bg-[var(--t-b2x)] focus:text-[#a3e635]">{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function VSTSidechainUI({ router, channels, onUpdate }: SidechainUIProps) {
  const [connections,setConnections]=useState(router.getAllConnections());
  const [showAdd,setShowAdd]=useState(false);
  useEffect(()=>{const id=setInterval(()=>setConnections(router.getAllConnections()),100);return()=>clearInterval(id);},[router]);
  const handleRemove=(id:string)=>{router.removeConnection(id);setConnections(router.getAllConnections());onUpdate();};

  return (
    <div className="w-full bg-[var(--void)] text-[var(--daw-fg)] font-mono space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)]">{connections.length} Connection{connections.length!==1?'s':''}</span>
        <button onClick={()=>setShowAdd(true)} className={P}><Plus className="h-3 w-3" /> Add Connection</button>
      </div>

      {connections.length===0&&(
        <div className="border border-dashed border-[var(--t-b2x)] py-12 text-center">
          <ArrowRight className="h-8 w-8 mx-auto mb-3 text-[var(--dj-dimmer)]" />
          <p className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)]">No sidechain connections</p>
          <p className="text-[10px] text-[#555] mt-1 tracking-wider">Click Add Connection to create one</p>
        </div>
      )}

      <div className="space-y-3">
        {connections.map(conn=><ConnectionRow key={conn.id} connection={conn} router={router} onRemove={()=>handleRemove(conn.id)} />)}
      </div>

      {showAdd&&<AddSidechainDialog channels={channels} router={router} onClose={()=>setShowAdd(false)} onAdd={()=>{setShowAdd(false);setConnections(router.getAllConnections());onUpdate();}} />}
    </div>
  );
}

function ConnectionRow({ connection, router, onRemove }: { connection:any; router:SidechainRouter; onRemove:()=>void }) {
  const [level,setLevel]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setLevel(router.getSidechainLevel(connection.id)),50);return()=>clearInterval(id);},[connection.id,router]);
  return (
    <div className={`border border-[var(--t-b2x)] p-4 space-y-4 ${!connection.enabled?'opacity-50':''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-wider">
          <span className="border border-[#2a2a2a] px-2 py-0.5 text-[var(--daw-fg)]">{connection.config.sourceChannelId}</span>
          <ArrowRight className="h-3 w-3 text-[#555]" />
          <span className="border border-[#a3e635]/40 px-2 py-0.5 text-[#a3e635]">{connection.config.targetVSTId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={()=>connection.enabled?router.disableConnection(connection.id):router.enableConnection(connection.id)}
            className={`text-[10px] tracking-widest uppercase px-2 py-0.5 border rounded-none font-mono transition-colors ${connection.enabled?'border-[#a3e635] bg-[#a3e635] text-[var(--void)]':'border-[#2a2a2a] text-[var(--daw-fg)] hover:border-[#a3e635] hover:text-[#a3e635]'}`}>
            {connection.enabled?'ON':'OFF'}
          </button>
          <button onClick={onRemove} className={D}><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)]">Sidechain Gain</span>
          <span className="text-xs font-mono text-[#a3e635]">{connection.config.gainCompensation.toFixed(2)}</span>
        </div>
        <MonoSlider value={[connection.config.gainCompensation]} min={0} max={2} step={0.01} disabled={!connection.enabled} onValueChange={([v])=>router.setSidechainGain(connection.id,v)} />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-3 w-3 text-[#555]" />
          <span className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)]">Signal</span>
          <span className="ml-auto text-[10px] font-mono text-[#a3e635]">{(level*100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-[#0d0d0d] border border-[var(--t-b2x)] overflow-hidden">
          <div className="h-full bg-[#a3e635] transition-all duration-75" style={{width:`${Math.min(level*100,100)}%`}} />
        </div>
      </div>
    </div>
  );
}

function AddSidechainDialog({ channels, router, onClose, onAdd }: { channels:MixerChannel[]; router:SidechainRouter; onClose:()=>void; onAdd:()=>void }) {
  const [sourceId,setSourceId]=useState('');
  const [targetChId,setTargetChId]=useState('');
  const [targetVSTId,setTargetVSTId]=useState('');
  const [gain,setGain]=useState(1);
  const targetCh=channels.find(c=>c.id===targetChId);
  const vstPlugins=targetCh?.getEffects().filter(fx=>fx instanceof VSTFXNode)??[];
  const channelOpts=channels.map(c=>({value:c.id,label:c.id}));
  const vstOpts=vstPlugins.map(v=>({value:v.id,label:v.id}));
  const handleCreate=()=>{
    if(!sourceId||!targetVSTId) return;
    const sourceCh=channels.find(c=>c.id===sourceId);
    const targetVST=vstPlugins.find(v=>v.id===targetVSTId);
    if(!sourceCh||!targetVST) return;
    router.createSidechain({sourceChannelId:sourceId,targetVSTId,sidechainInput:1,gain} as any,sourceCh.output,targetVST as VSTFXNode);
    onAdd();
  };
  return (
    <div className="fixed inset-0 bg-background/70 flex items-center justify-center z-50 font-mono">
      <div className="bg-[var(--t-b0x)] border border-[#2a2a2a] w-[480px]">
        <div className="flex items-center justify-between border-b border-[var(--t-b2x)] px-5 py-4">
          <span className="text-xs tracking-widest uppercase text-[#a3e635]">Add Sidechain Connection</span>
          <button onClick={onClose} className="text-[var(--daw-fg)] hover:text-[#a3e635] transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div><div className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)] mb-1.5">Source Channel</div><MonoSelect value={sourceId} onValueChange={setSourceId} options={channelOpts} placeholder="Select source..." /></div>
          <div><div className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)] mb-1.5">Target Channel</div><MonoSelect value={targetChId} onValueChange={v=>{setTargetChId(v);setTargetVSTId('');}} options={channelOpts} placeholder="Select target..." /></div>
          {targetChId&&(
            <div>
              <div className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)] mb-1.5">Target VST Plugin</div>
              {vstOpts.length===0?<p className="text-[10px] tracking-wider text-[#555] mt-1">No VST plugins on this channel</p>:<MonoSelect value={targetVSTId} onValueChange={setTargetVSTId} options={vstOpts} placeholder="Select VST..." />}
            </div>
          )}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] tracking-widest uppercase text-[var(--daw-fg)]">Sidechain Gain</span>
              <span className="text-xs font-mono text-[#a3e635]">{gain.toFixed(2)}</span>
            </div>
            <MonoSlider value={[gain]} min={0} max={2} step={0.01} onValueChange={([v])=>setGain(v)} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-[var(--t-b2x)]">
            <button onClick={onClose} className={`${G} flex-1 justify-center`}>Cancel</button>
            <button onClick={handleCreate} disabled={!sourceId||!targetVSTId} className={`${P} flex-1 justify-center`}>Create Connection</button>
          </div>
        </div>
      </div>
    </div>
  );
}
