#!/usr/bin/env python3
"""Run from ~/Stable/R3 v4/client/  ->  python3 patch_vst_styles.py"""
import pathlib, shutil

BTN_PRIMARY = "bg-[#a3e635] hover:bg-[#84cc16] text-[#060606] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
BTN_GHOST   = "border border-[#a3e635] text-[#a3e635] hover:bg-[#a3e635] hover:text-[#060606] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
BTN_DANGER  = "border border-red-500 text-red-400 hover:bg-red-500 hover:text-[#060606] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-2 py-1.5 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
BTN_ICON    = "border border-[#2a2a2a] p-2 text-[#f0f0f0] hover:text-[#a3e635] hover:border-[#a3e635]/40 rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
TAB_LIST    = "w-full grid bg-[#0a0a0a] border-b border-[#1a1a1a] rounded-none h-auto p-0"
TAB_TRIGGER = "rounded-none border-r border-[#1a1a1a] last:border-r-0 text-[10px] tracking-widest uppercase font-mono py-2.5 text-[#f0f0f0] hover:text-[#a3e635] transition-colors data-[state=active]:bg-transparent data-[state=active]:text-[#a3e635] data-[state=active]:border-b-2 data-[state=active]:border-b-[#a3e635] data-[state=active]:shadow-none"

AUTOMATION = """// client/src/components/vst-automation-ui.tsx
import {{ useState, useRef, useEffect }} from 'react';
import {{ Slider }} from '@/components/ui/slider';
import {{ Select, SelectContent, SelectItem, SelectTrigger, SelectValue }} from '@/components/ui/select';
import {{ Tabs, TabsContent, TabsList, TabsTrigger }} from '@/components/ui/tabs';
import {{ Trash2, TrendingUp, Activity, Move }} from 'lucide-react';
import {{ VSTAutomationEngine, AutomationPoint, AutomationCurve }} from '@/types/audio';

interface LFOConfig {{ waveform: 'sine'|'triangle'|'square'|'saw'|'random'; frequency: number; depth: number; phase: number; sync: boolean; }}
interface EnvelopeConfig {{ attack: number; decay: number; sustain: number; release: number; }}
interface AutomationUIProps {{ automationEngine: VSTAutomationEngine; paramId: number; paramName: string; minValue: number; maxValue: number; currentValue: number; }}

function RowLabel({{ label, value }}: {{ label: string; value: string }}) {{
  return (
    <div className="flex justify-between items-center mb-1">
      <span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">{{label}}</span>
      <span className="text-xs font-mono text-[#a3e635]">{{value}}</span>
    </div>
  );
}}

function MonoSlider(props: React.ComponentProps<typeof Slider>) {{
  return <Slider {{...props}} className="[&>span:first-child]:bg-[#1a1a1a] [&>span:first-child]:rounded-none [&>span>span]:bg-[#a3e635] [&>span>span]:rounded-none [&_[role=slider]]:bg-[#a3e635] [&_[role=slider]]:border-0 [&_[role=slider]]:rounded-none [&_[role=slider]]:h-3 [&_[role=slider]]:w-1" />;
}}

function MonoSelect({{ value, onValueChange, options, placeholder, className }}: {{ value: string; onValueChange: (v: any) => void; options: {{value:string;label:string}}[]; placeholder?: string; className?: string; }}) {{
  return (
    <Select value={{value}} onValueChange={{onValueChange}}>
      <SelectTrigger className={{`rounded-none border-[#2a2a2a] bg-[#0d0d0d] text-[#f0f0f0] font-mono text-xs tracking-wider focus:ring-0 focus:border-[#a3e635] ${{className ?? ''}}`}}>
        <SelectValue placeholder={{placeholder}} />
      </SelectTrigger>
      <SelectContent className="rounded-none border-[#2a2a2a] bg-[#0d0d0d] font-mono text-xs">
        {{options.map(o => <SelectItem key={{o.value}} value={{o.value}} className="text-[#f0f0f0] tracking-wider focus:bg-[#1a1a1a] focus:text-[#a3e635]">{{o.label}}</SelectItem>)}}
      </SelectContent>
    </Select>
  );
}}

export function VSTAutomationUI({{ automationEngine, paramId, paramName, minValue, maxValue, currentValue }}: AutomationUIProps) {{
  const [mode, setMode] = useState<'manual'|'automation'|'lfo'|'envelope'>('manual');
  const tabs = [
    {{ value: 'manual',     label: 'Manual',     icon: <Move className="h-3 w-3" /> }},
    {{ value: 'automation', label: 'Automation',  icon: <TrendingUp className="h-3 w-3" /> }},
    {{ value: 'lfo',        label: 'LFO',         icon: <Activity className="h-3 w-3" /> }},
    {{ value: 'envelope',   label: 'Envelope',    icon: <Activity className="h-3 w-3" /> }},
  ];
  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-[#1a1a1a] pb-3">
        <span className="text-xs tracking-widest uppercase text-[#f0f0f0]">{{paramName}} Automation</span>
        <span className="text-[10px] border border-[#2a2a2a] px-2 py-0.5 text-[#a3e635] tracking-widest">PARAM {{paramId}}</span>
      </div>
      <Tabs value={{mode}} onValueChange={{(v: any) => setMode(v)}}>
        <TabsList className="{tab_list} grid-cols-4">
          {{tabs.map(t => <TabsTrigger key={{t.value}} value={{t.value}} className="{tab_trigger} flex items-center gap-1.5">{{t.icon}}{{t.label}}</TabsTrigger>)}}
        </TabsList>
        <div className="pt-5">
          <TabsContent value="manual"     className="mt-0"><ManualControl paramName={{paramName}} currentValue={{currentValue}} minValue={{minValue}} maxValue={{maxValue}} /></TabsContent>
          <TabsContent value="automation" className="mt-0"><AutomationLaneEditor automationEngine={{automationEngine}} paramId={{paramId}} minValue={{minValue}} maxValue={{maxValue}} /></TabsContent>
          <TabsContent value="lfo"        className="mt-0"><LFOEditor automationEngine={{automationEngine}} paramId={{paramId}} /></TabsContent>
          <TabsContent value="envelope"   className="mt-0"><EnvelopeEditor automationEngine={{automationEngine}} paramId={{paramId}} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}}

function ManualControl({{ paramName, currentValue, minValue, maxValue }}: {{ paramName: string; currentValue: number; minValue: number; maxValue: number }}) {{
  return (
    <div className="space-y-3 py-2">
      <RowLabel label={{paramName}} value={{(currentValue ?? 0).toFixed(2)}} />
      <MonoSlider value={{[currentValue]}} min={{minValue}} max={{maxValue}} step={{0.01}} />
    </div>
  );
}}

function AutomationLaneEditor({{ automationEngine, paramId, minValue, maxValue }}: {{ automationEngine: VSTAutomationEngine; paramId: number; minValue: number; maxValue: number }}) {{
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<AutomationPoint[]>([]);
  const [selectedCurve, setSelectedCurve] = useState<AutomationCurve>(AutomationCurve.LINEAR);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  useEffect(() => {{ drawAutomation(); }}, [points, selectedPointIndex]);

  const drawAutomation = () => {{
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const {{ width, height }} = canvas;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {{
      ctx.beginPath(); ctx.moveTo(0, (height/10)*i); ctx.lineTo(width, (height/10)*i); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((width/10)*i, 0); ctx.lineTo((width/10)*i, height); ctx.stroke();
    }}
    if (points.length === 0) return;
    ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = 0; x < width; x++) {{
      const y = height - ((interp((x/width)*10, points) - minValue) / (maxValue - minValue)) * height;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }}
    ctx.stroke();
    ctx.fillStyle = 'rgba(163,230,53,0.06)'; ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
    points.forEach((p, i) => {{
      const x = (p.time/10)*width, y = height - ((p.value - minValue)/(maxValue - minValue))*height;
      ctx.fillStyle = i === selectedPointIndex ? '#ffffff' : '#a3e635';
      ctx.fillRect(x-4, y-4, 8, 8);
    }});
  }};

  const interp = (time: number, pts: AutomationPoint[]): number => {{
    if (pts.length === 0) return minValue;
    if (time <= pts[0].time) return pts[0].value;
    if (time >= pts[pts.length-1].time) return pts[pts.length-1].value;
    let i = 0; while (i < pts.length-1 && pts[i+1].time <= time) i++;
    const p1 = pts[i], p2 = pts[i+1]; if (!p2) return p1.value;
    return p1.value + (p2.value - p1.value) * ((time - p1.time)/(p2.time - p1.time));
  }};

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {{
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const clicked = points.findIndex(p => {{
      const px = (p.time/10)*canvas.width, py = canvas.height - ((p.value-minValue)/(maxValue-minValue))*canvas.height;
      return Math.abs(px-x) < 10 && Math.abs(py-y) < 10;
    }});
    if (clicked !== -1) {{ setSelectedPointIndex(clicked); return; }}
    const newPoints = [...points, {{ time: (x/canvas.width)*10, value: minValue+(1-y/canvas.height)*(maxValue-minValue), curve: selectedCurve }}].sort((a,b) => a.time-b.time);
    setPoints(newPoints); automationEngine.createAutomationLane(`param_${{paramId}}`, paramId, newPoints);
  }};

  const curves = [{{ value:'linear',label:'Linear' }},{{ value:'exponential',label:'Exponential' }},{{ value:'logarithmic',label:'Logarithmic' }},{{ value:'smooth',label:'Smooth' }},{{ value:'step',label:'Step' }}];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <MonoSelect value={{selectedCurve}} onValueChange={{setSelectedCurve}} options={{curves}} className="w-36" />
        <div className="flex gap-2">
          <button onClick={{() => {{ if (selectedPointIndex===null) return; setPoints(p=>p.filter((_,i)=>i!==selectedPointIndex)); setSelectedPointIndex(null); }}}} disabled={{selectedPointIndex===null}} className="{btn_ghost}"><Trash2 className="h-3 w-3" /> Del Point</button>
          <button onClick={{() => {{ setPoints([]); setSelectedPointIndex(null); }}}} className="{btn_ghost}">Clear</button>
        </div>
      </div>
      <div className="border border-[#1a1a1a]">
        <canvas ref={{canvasRef}} width={{800}} height={{200}} className="w-full cursor-crosshair block" onClick={{handleClick}} />
      </div>
      <p className="text-[10px] tracking-wider text-[#555]">CLICK — Add point · Click point — Select · Del Point — Remove</p>
    </div>
  );
}}

function LFOEditor({{ automationEngine, paramId }}: {{ automationEngine: VSTAutomationEngine; paramId: number }}) {{
  const [cfg, setCfg] = useState<LFOConfig>({{ waveform:'sine', frequency:1, depth:0.5, phase:0, sync:false }});
  const upd = (u: Partial<LFOConfig>) => {{ const n={{...cfg,...u}}; setCfg(n); automationEngine.createLFO(`lfo_${{paramId}}`,paramId,n); }};
  const waveforms=[{{value:'sine',label:'Sine'}},{{value:'triangle',label:'Triangle'}},{{value:'square',label:'Square'}},{{value:'saw',label:'Saw'}},{{value:'random',label:'Random'}}];
  return (
    <div className="space-y-5">
      <div><RowLabel label="Waveform" value={{cfg.waveform.toUpperCase()}} /><MonoSelect value={{cfg.waveform}} onValueChange={{v=>upd({{waveform:v}})}} options={{waveforms}} /></div>
      <div><RowLabel label="Frequency" value={{`${{cfg.frequency.toFixed(2)}} Hz`}} /><MonoSlider value={{[cfg.frequency]}} min={{0.1}} max={{20}} step={{0.1}} onValueChange={{([v])=>upd({{frequency:v}})}} /></div>
      <div><RowLabel label="Depth" value={{`${{(cfg.depth*100).toFixed(0)}}%`}} /><MonoSlider value={{[cfg.depth]}} min={{0}} max={{1}} step={{0.01}} onValueChange={{([v])=>upd({{depth:v}})}} /></div>
      <div><RowLabel label="Phase" value={{`${{(cfg.phase*360).toFixed(0)}}°`}} /><MonoSlider value={{[cfg.phase]}} min={{0}} max={{1}} step={{0.01}} onValueChange={{([v])=>upd({{phase:v}})}} /></div>
    </div>
  );
}}

function EnvelopeEditor({{ automationEngine, paramId }}: {{ automationEngine: VSTAutomationEngine; paramId: number }}) {{
  const [cfg, setCfg] = useState<EnvelopeConfig>({{ attack:0.1, decay:0.2, sustain:0.7, release:0.5 }});
  const upd = (u: Partial<EnvelopeConfig>) => {{ const n={{...cfg,...u}}; setCfg(n); automationEngine.createEnvelope(`env_${{paramId}}`,paramId,n); }};
  return (
    <div className="space-y-5">
      <div><RowLabel label="Attack"  value={{`${{cfg.attack.toFixed(3)}} s`}} /><MonoSlider value={{[cfg.attack]}}  min={{0.001}} max={{2}} step={{0.001}} onValueChange={{([v])=>upd({{attack:v}})}}  /></div>
      <div><RowLabel label="Decay"   value={{`${{cfg.decay.toFixed(3)}} s`}} /><MonoSlider value={{[cfg.decay]}}   min={{0.001}} max={{2}} step={{0.001}} onValueChange={{([v])=>upd({{decay:v}})}}   /></div>
      <div><RowLabel label="Sustain" value={{`${{(cfg.sustain*100).toFixed(0)}}%`}} /><MonoSlider value={{[cfg.sustain]}} min={{0}} max={{1}} step={{0.01}} onValueChange={{([v])=>upd({{sustain:v}})}} /></div>
      <div><RowLabel label="Release" value={{`${{cfg.release.toFixed(3)}} s`}} /><MonoSlider value={{[cfg.release]}} min={{0.001}} max={{5}} step={{0.001}} onValueChange={{([v])=>upd({{release:v}})}} /></div>
      <div className="border border-[#1a1a1a] h-16 relative overflow-hidden">
        <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
          <polyline fill="rgba(163,230,53,0.08)" stroke="#a3e635" strokeWidth="1.5"
            points={{`0,60 ${{cfg.attack*40}},0 ${{cfg.attack*40+cfg.decay*30}},${{(1-cfg.sustain)*60}} ${{cfg.attack*40+cfg.decay*30+40}},${{(1-cfg.sustain)*60}} 200,60`}} />
        </svg>
        <span className="absolute bottom-1 left-1 text-[9px] text-[#333] tracking-widest">ADSR</span>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={{()=>automationEngine.triggerEnvelope(`env_${{paramId}}`)}} className="{btn_primary} flex-1 justify-center">Trigger</button>
        <button onClick={{()=>automationEngine.releaseEnvelope(`env_${{paramId}}`)}} className="{btn_ghost} flex-1 justify-center">Release</button>
      </div>
    </div>
  );
}}
""".format(
    tab_list=TAB_LIST, tab_trigger=TAB_TRIGGER,
    btn_primary=BTN_PRIMARY, btn_ghost=BTN_GHOST,
)

SIDECHAIN = """// client/src/components/vst-sidechain-ui.tsx
import {{ useState, useEffect }} from 'react';
import {{ Slider }} from '@/components/ui/slider';
import {{ Select, SelectContent, SelectItem, SelectTrigger, SelectValue }} from '@/components/ui/select';
import {{ Plus, Trash2, ArrowRight, Activity, X }} from 'lucide-react';
import {{ VSTFXNode }} from '@/audio/fx/vst-fx-node';
import type {{ MixerChannel, SidechainConfig }} from '@/types/audio';
import {{ SidechainRouter }} from '@/audio/fx/vst-sidechain';

interface SidechainUIProps {{ router: SidechainRouter; channels: MixerChannel[]; onUpdate: () => void; }}

function MonoSlider(props: React.ComponentProps<typeof Slider>) {{
  return <Slider {{...props}} className="[&>span:first-child]:bg-[#1a1a1a] [&>span:first-child]:rounded-none [&>span>span]:bg-[#a3e635] [&>span>span]:rounded-none [&_[role=slider]]:bg-[#a3e635] [&_[role=slider]]:border-0 [&_[role=slider]]:rounded-none [&_[role=slider]]:h-3 [&_[role=slider]]:w-1" />;
}}

function MonoSelect({{ value, onValueChange, options, placeholder, disabled, className }}: {{ value:string; onValueChange:(v:string)=>void; options:{{value:string;label:string}}[]; placeholder?:string; disabled?:boolean; className?:string; }}) {{
  return (
    <Select value={{value}} onValueChange={{onValueChange}} disabled={{disabled}}>
      <SelectTrigger className={{`rounded-none border-[#2a2a2a] bg-[#0d0d0d] text-[#f0f0f0] font-mono text-xs tracking-wider focus:ring-0 focus:border-[#a3e635] disabled:opacity-40 ${{className??''}}`}}>
        <SelectValue placeholder={{placeholder}} />
      </SelectTrigger>
      <SelectContent className="rounded-none border-[#2a2a2a] bg-[#0d0d0d] font-mono text-xs">
        {{options.map(o=><SelectItem key={{o.value}} value={{o.value}} className="text-[#f0f0f0] tracking-wider focus:bg-[#1a1a1a] focus:text-[#a3e635]">{{o.label}}</SelectItem>)}}
      </SelectContent>
    </Select>
  );
}}

export function VSTSidechainUI({{ router, channels, onUpdate }}: SidechainUIProps) {{
  const [connections, setConnections] = useState(router.getAllConnections());
  const [showAdd, setShowAdd] = useState(false);
  useEffect(() => {{ const id=setInterval(()=>setConnections(router.getAllConnections()),100); return ()=>clearInterval(id); }}, [router]);
  const handleRemove = (id: string) => {{ router.removeConnection(id); setConnections(router.getAllConnections()); onUpdate(); }};

  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">{{connections.length}} Connection{{connections.length!==1?'s':''}}</span>
        <button onClick={{()=>setShowAdd(true)}} className="{btn_primary}"><Plus className="h-3 w-3" /> Add Connection</button>
      </div>

      {{connections.length===0 && (
        <div className="border border-dashed border-[#1a1a1a] py-12 text-center">
          <ArrowRight className="h-8 w-8 mx-auto mb-3 text-[#333]" />
          <p className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">No sidechain connections</p>
          <p className="text-[10px] text-[#555] mt-1 tracking-wider">Click Add Connection to create one</p>
        </div>
      )}}

      <div className="space-y-3">
        {{connections.map(conn=><ConnectionRow key={{conn.id}} connection={{conn}} router={{router}} onRemove={{()=>handleRemove(conn.id)}} />)}}
      </div>

      {{showAdd && <AddSidechainDialog channels={{channels}} router={{router}} onClose={{()=>setShowAdd(false)}} onAdd={{()=>{{setShowAdd(false);setConnections(router.getAllConnections());onUpdate();}}}} />}}
    </div>
  );
}}

function ConnectionRow({{ connection, router, onRemove }}: {{ connection:any; router:SidechainRouter; onRemove:()=>void }}) {{
  const [level, setLevel] = useState(0);
  useEffect(() => {{ const id=setInterval(()=>setLevel(router.getSidechainLevel(connection.id)),50); return ()=>clearInterval(id); }}, [connection.id,router]);
  return (
    <div className={{`border border-[#1a1a1a] p-4 space-y-4 ${{!connection.enabled?'opacity-50':''}}`}}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-wider">
          <span className="border border-[#2a2a2a] px-2 py-0.5 text-[#f0f0f0]">{{connection.config.sourceChannelId}}</span>
          <ArrowRight className="h-3 w-3 text-[#555]" />
          <span className="border border-[#a3e635]/40 px-2 py-0.5 text-[#a3e635]">{{connection.config.targetVSTId}}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={{()=>connection.enabled?router.disableConnection(connection.id):router.enableConnection(connection.id)}}
            className={{`text-[10px] tracking-widest uppercase px-2 py-0.5 border rounded-none font-mono transition-colors ${{connection.enabled?'border-[#a3e635] bg-[#a3e635] text-[#060606]':'border-[#2a2a2a] text-[#f0f0f0] hover:border-[#a3e635] hover:text-[#a3e635]'}}`}}>
            {{connection.enabled?'ON':'OFF'}}
          </button>
          <button onClick={{onRemove}} className="{btn_danger}"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Sidechain Gain</span>
          <span className="text-xs font-mono text-[#a3e635]">{{connection.config.gainCompensation.toFixed(2)}}</span>
        </div>
        <MonoSlider value={{[connection.config.gainCompensation]}} min={{0}} max={{2}} step={{0.01}} disabled={{!connection.enabled}} onValueChange={{([v])=>router.setSidechainGain(connection.id,v)}} />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-3 w-3 text-[#555]" />
          <span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Signal</span>
          <span className="ml-auto text-[10px] font-mono text-[#a3e635]">{{(level*100).toFixed(0)}}%</span>
        </div>
        <div className="h-1.5 bg-[#0d0d0d] border border-[#1a1a1a] overflow-hidden">
          <div className="h-full bg-[#a3e635] transition-all duration-75" style={{{{width:`${{Math.min(level*100,100)}}%`}}}} />
        </div>
      </div>
    </div>
  );
}}

function AddSidechainDialog({{ channels, router, onClose, onAdd }}: {{ channels:MixerChannel[]; router:SidechainRouter; onClose:()=>void; onAdd:()=>void }}) {{
  const [sourceId,setSourceId]=useState('');
  const [targetChId,setTargetChId]=useState('');
  const [targetVSTId,setTargetVSTId]=useState('');
  const [gain,setGain]=useState(1);
  const targetCh=channels.find(c=>c.id===targetChId);
  const vstPlugins=targetCh?.getEffects().filter(fx=>fx instanceof VSTFXNode)??[];
  const channelOpts=channels.map(c=>{{return{{value:c.id,label:c.id}}}});
  const vstOpts=vstPlugins.map(v=>{{return{{value:v.id,label:v.id}}}});
  const handleCreate=()=>{{
    if(!sourceId||!targetVSTId) return;
    const sourceCh=channels.find(c=>c.id===sourceId);
    const targetVST=vstPlugins.find(v=>v.id===targetVSTId);
    if(!sourceCh||!targetVST) return;
    router.createSidechain({{sourceChannelId:sourceId,targetVSTId,sidechainInput:1,gain}} as any,sourceCh.output,targetVST as VSTFXNode);
    onAdd();
  }};
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 font-mono">
      <div className="bg-[#080808] border border-[#2a2a2a] w-[480px]">
        <div className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4">
          <span className="text-xs tracking-widest uppercase text-[#a3e635]">Add Sidechain Connection</span>
          <button onClick={{onClose}} className="text-[#f0f0f0] hover:text-[#a3e635] transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div><div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1.5">Source Channel</div><MonoSelect value={{sourceId}} onValueChange={{setSourceId}} options={{channelOpts}} placeholder="Select source..." /></div>
          <div><div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1.5">Target Channel</div><MonoSelect value={{targetChId}} onValueChange={{v=>{{setTargetChId(v);setTargetVSTId('');}}}} options={{channelOpts}} placeholder="Select target..." /></div>
          {{targetChId && (
            <div>
              <div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1.5">Target VST Plugin</div>
              {{vstOpts.length===0?<p className="text-[10px] tracking-wider text-[#555] mt-1">No VST plugins on this channel</p>:<MonoSelect value={{targetVSTId}} onValueChange={{setTargetVSTId}} options={{vstOpts}} placeholder="Select VST..." />}}
            </div>
          )}}
          <div>
            <div className="flex justify-between mb-1"><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Sidechain Gain</span><span className="text-xs font-mono text-[#a3e635]">{{gain.toFixed(2)}}</span></div>
            <MonoSlider value={{[gain]}} min={{0}} max={{2}} step={{0.01}} onValueChange={{([v])=>setGain(v)}} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-[#1a1a1a]">
            <button onClick={{onClose}} className="{btn_ghost} flex-1 justify-center">Cancel</button>
            <button onClick={{handleCreate}} disabled={{!sourceId||!targetVSTId}} className="{btn_primary} flex-1 justify-center">Create Connection</button>
          </div>
        </div>
      </div>
    </div>
  );
}}
""".format(btn_primary=BTN_PRIMARY, btn_ghost=BTN_GHOST, btn_danger=BTN_DANGER)

PERFORMANCE = """// client/src/components/vst-performance-monitor-ui.tsx
import {{ useState, useEffect }} from 'react';
import {{ Tabs, TabsContent, TabsList, TabsTrigger }} from '@/components/ui/tabs';
import {{ Activity, Zap, AlertTriangle, TrendingUp, MemoryStick, Clock }} from 'lucide-react';
import type {{ VSTPerformanceMonitor }} from '@/types/audio';

interface PerformanceMetrics {{ cpuUsage:number; memoryUsage:number; latency:number; processingTime:number; peakProcessingTime:number; bufferUnderruns:number; }}
interface VSTPerformanceUIProps {{ monitor:VSTPerformanceMonitor; vstIds:string[]; }}

function MonoBar({{ value, max=100, warn=50, danger=80 }}: {{ value:number; max?:number; warn?:number; danger?:number }}) {{
  const pct=Math.min((value/max)*100,100);
  const color=value>=danger?'#ef4444':value>=warn?'#f59e0b':'#a3e635';
  return <div className="h-1.5 bg-[#0d0d0d] border border-[#1a1a1a] overflow-hidden"><div className="h-full transition-all duration-100" style={{{{width:`${{pct}}%`,background:color}}}} /></div>;
}}

function StatBox({{ icon, label, value, pct, warn, danger }}: {{ icon:React.ReactNode; label:string; value:string; pct:number; warn?:number; danger?:number }}) {{
  return (
    <div className="border border-[#1a1a1a] p-4 space-y-3">
      <div className="flex items-center gap-2"><span className="text-[#555]">{{icon}}</span><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">{{label}}</span></div>
      <div className="text-xl font-mono text-[#f0f0f0] tracking-wider">{{value}}</div>
      <MonoBar value={{pct}} warn={{warn}} danger={{danger}} />
    </div>
  );
}}

export function VSTPerformanceUI({{ monitor, vstIds }}: VSTPerformanceUIProps) {{
  const [metrics,setMetrics]=useState<Map<string,PerformanceMetrics>>(new Map());
  const [totalCPU,setTotalCPU]=useState(0);
  useEffect(()=>{{ const id=setInterval(()=>{{setMetrics(monitor.getAllMetrics());setTotalCPU(monitor.getTotalCPUUsage());}},100); return ()=>clearInterval(id); }},[monitor]);
  const cpuColor=totalCPU>=80?'text-red-400':totalCPU>=50?'text-yellow-400':'text-[#a3e635]';
  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono">
      <div className="flex items-center justify-between mb-4 border-b border-[#1a1a1a] pb-3">
        <span className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#f0f0f0]"><Activity className="h-3.5 w-3.5 text-[#555]" />Performance Monitor</span>
        <span className={{`text-xs font-mono tracking-wider ${{cpuColor}}`}}>{{totalCPU.toFixed(1)}}% CPU</span>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="{tab_list} grid-cols-3">
          {{['overview','details','optimization'].map(tab=><TabsTrigger key={{tab}} value={{tab}} className="{tab_trigger}">{{tab}}</TabsTrigger>)}}
        </TabsList>
        <div className="pt-5">
          <TabsContent value="overview"      className="mt-0"><SystemOverview totalCPU={{totalCPU}} metrics={{metrics}} /></TabsContent>
          <TabsContent value="details"       className="mt-0">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {{(vstIds??[]).map(id=>{{const m=metrics.get(id);if(!m)return null;return <VSTMetricsRow key={{id}} vstId={{id}} metrics={{m}} />;}})}
              {{vstIds.length===0&&<p className="text-[10px] tracking-widest uppercase text-[#555] text-center py-8">No active VST plugins</p>}}
            </div>
          </TabsContent>
          <TabsContent value="optimization"  className="mt-0"><OptimizationPanel monitor={{monitor}} vstIds={{vstIds}} metrics={{metrics}} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}}

function SystemOverview({{ totalCPU, metrics }}: {{ totalCPU:number; metrics:Map<string,PerformanceMetrics> }}) {{
  const totalMemory=Array.from(metrics.values()).reduce((s,m)=>s+m.memoryUsage,0);
  const avgLatency=metrics.size>0?Array.from(metrics.values()).reduce((s,m)=>s+m.latency,0)/metrics.size:0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatBox icon={{<Zap className="h-3.5 w-3.5"/>}}        label="Total CPU"   value={{`${{totalCPU.toFixed(1)}}%`}}       pct={{totalCPU}}                  warn={{50}} danger={{80}} />
      <StatBox icon={{<MemoryStick className="h-3.5 w-3.5"/>}} label="Memory"      value={{`${{totalMemory.toFixed(0)}} MB`}}  pct={{(totalMemory/1024)*100}} />
      <StatBox icon={{<Clock className="h-3.5 w-3.5"/>}}       label="Avg Latency" value={{`${{avgLatency.toFixed(1)}} ms`}}   pct={{(avgLatency/50)*100}}    warn={{40}} danger={{80}} />
      <StatBox icon={{<Activity className="h-3.5 w-3.5"/>}}    label="Active VSTs" value={{metrics.size.toString()}}           pct={{(metrics.size/10)*100}} />
    </div>
  );
}}

function VSTMetricsRow({{ vstId, metrics }}: {{ vstId:string; metrics:PerformanceMetrics }}) {{
  return (
    <div className="border border-[#1a1a1a] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-wider text-[#f0f0f0]">{{vstId}}</span>
        {{metrics.bufferUnderruns>0&&<span className="flex items-center gap-1 text-[10px] tracking-wider text-red-400 border border-red-900/40 px-2 py-0.5"><AlertTriangle className="h-3 w-3"/>{{metrics.bufferUnderruns}} underrun{{metrics.bufferUnderruns>1?'s':''}}</span>}}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><div className="flex justify-between mb-1"><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">CPU</span><span className="text-[10px] font-mono text-[#a3e635]">{{metrics.cpuUsage.toFixed(1)}}%</span></div><MonoBar value={{metrics.cpuUsage}} warn={{50}} danger={{80}} /></div>
        <div><div className="flex justify-between mb-1"><span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Latency</span><span className="text-[10px] font-mono text-[#a3e635]">{{metrics.latency.toFixed(1)}} ms</span></div><MonoBar value={{metrics.latency}} max={{50}} warn={{20}} danger={{40}} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-[#1a1a1a] px-3 py-2"><div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1">Proc. Time</div><div className="text-sm font-mono text-[#f0f0f0]">{{metrics.processingTime.toFixed(2)}} ms</div></div>
        <div className="border border-[#1a1a1a] px-3 py-2"><div className="text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1">Peak Time</div><div className="text-sm font-mono text-[#f0f0f0]">{{metrics.peakProcessingTime.toFixed(2)}} ms</div></div>
      </div>
    </div>
  );
}}

function OptimizationPanel({{ monitor, vstIds, metrics }}: {{ monitor:VSTPerformanceMonitor; vstIds:string[]; metrics:Map<string,PerformanceMetrics> }}) {{
  const recs: Array<{{vstId:string;items:string[]}}>=[];
  (vstIds??[]).forEach(id=>{{const items=monitor.getOptimizationRecommendations(id);if(items.length>0)recs.push({{vstId:id,items}});}});
  if(recs.length===0) return (
    <div className="border border-dashed border-[#1a1a1a] py-12 text-center">
      <TrendingUp className="h-8 w-8 mx-auto mb-3 text-[#333]" />
      <p className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">All systems optimal</p>
      <p className="text-[10px] text-[#555] mt-1 tracking-wider">No recommendations at this time</p>
    </div>
  );
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
      {{recs.map(({{vstId,items}})=>(
        <div key={{vstId}} className="border border-yellow-900/30 bg-yellow-900/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500"/><span className="text-xs tracking-wider text-yellow-400">{{vstId}}</span></div>
          <ul className="space-y-1.5 pl-5">{{items.map((rec,i)=><li key={{i}} className="text-[10px] tracking-wider text-[#f0f0f0] flex gap-2"><span className="text-[#555]">—</span><span>{{rec}}</span></li>)}}</ul>
        </div>
      ))}}
    </div>
  );
}}
""".format(tab_list=TAB_LIST, tab_trigger=TAB_TRIGGER)

PROJECT = """// client/src/components/vst-project-manager-ui.tsx
import {{ useState, useCallback }} from 'react';
import {{ Save, Upload, Download, Clock, FileJson, RotateCcw }} from 'lucide-react';
import {{ VSTProjectSerializer, SerializedVSTChain }} from '@/audio/fx/vst-project-serializer';
import {{ format }} from 'date-fns';

interface ProjectManagerUIProps {{ onSave: () => SerializedVSTChain; onLoad: (data: SerializedVSTChain) => Promise<void>; }}

export function VSTProjectManagerUI({{ onSave, onLoad }}: ProjectManagerUIProps) {{
  const [projectName,setProjectName]=useState('');
  const [backups,setBackups]=useState(VSTProjectSerializer.getBackups());
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState<{{type:'ok'|'err';msg:string}}|null>(null);
  const flash=(type:'ok'|'err',msg:string)=>{{setStatus({{type,msg}});setTimeout(()=>setStatus(null),3000);}};

  const handleSave=useCallback(()=>{{
    try{{const data=onSave();const filename=projectName.trim()||`project_${{Date.now()}}`;VSTProjectSerializer.exportToFile(data,`${{filename}}.vstchain`);flash('ok',`Saved "${{filename}}.vstchain"`);}}
    catch(err){{console.error(err);flash('err','Save failed — check console');}}
  }},[onSave,projectName]);

  const handleLoad=useCallback(async(file:File)=>{{
    setLoading(true);
    try{{const data=await VSTProjectSerializer.importFromFile(file);await onLoad(data);flash('ok',`Loaded "${{file.name}}"`);}}
    catch(err){{console.error(err);flash('err','Load failed — invalid project file');}}
    finally{{setLoading(false);}}
  }},[onLoad]);

  const handleBackup=useCallback(()=>{{
    try{{const data=onSave();VSTProjectSerializer.createBackup(data,projectName.trim()||`Backup ${{new Date().toLocaleString()}}`);setBackups(VSTProjectSerializer.getBackups());flash('ok','Backup created');}}
    catch{{flash('err','Backup failed');}}
  }},[onSave,projectName]);

  const handleRestore=useCallback(async(index:number)=>{{
    const data=VSTProjectSerializer.restoreBackup(index);if(!data)return;
    setLoading(true);
    try{{await onLoad(data);flash('ok','Backup restored');}}catch{{flash('err','Restore failed');}}finally{{setLoading(false);}}
  }},[onLoad]);

  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono space-y-6">
      {{status&&<div className={{`px-3 py-2 text-[10px] tracking-widest border ${{status.type==='ok'?'border-[#a3e635]/30 bg-[#a3e635]/5 text-[#a3e635]':'border-red-900/40 bg-red-900/5 text-red-400'}}`}}>{{status.type==='ok'?'✓':'✗'}} {{status.msg}}</div>}}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1.5">Project Name</label>
          <input value={{projectName}} onChange={{e=>setProjectName(e.target.value)}} placeholder="untitled-project" disabled={{loading}}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-[#f0f0f0] font-mono text-xs tracking-wider px-3 py-2 focus:outline-none focus:border-[#a3e635] placeholder:text-[#333] disabled:opacity-40 rounded-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={{handleSave}} disabled={{loading}} className="{btn_primary}"><Save className="h-3 w-3" /> Save to File</button>
          <button onClick={{()=>document.getElementById('vst-file-input')?.click()}} disabled={{loading}} className="{btn_ghost}"><Upload className="h-3 w-3" /> Load File</button>
          <input id="vst-file-input" type="file" accept=".vstchain" className="hidden" onChange={{e=>{{const f=e.target.files?.[0];if(f)handleLoad(f);e.target.value='';}}}} />
        </div>
      </div>
      <div className="border-t border-[#1a1a1a]" />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Backups <span className="text-[#555]">({{backups.length}}/10)</span></span>
          <button onClick={{handleBackup}} disabled={{loading}} className="{btn_ghost}"><Download className="h-3 w-3" /> Create Backup</button>
        </div>
        {{backups.length===0?(
          <div className="border border-dashed border-[#1a1a1a] py-8 text-center">
            <FileJson className="h-6 w-6 mx-auto mb-2 text-[#333]" />
            <p className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">No backups yet</p>
            <p className="text-[10px] text-[#555] mt-1 tracking-wider">Create a backup to save your work</p>
          </div>
        ):(
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {{backups.map((backup,idx)=><BackupRow key={{idx}} backup={{backup}} onRestore={{()=>handleRestore(idx)}} disabled={{loading}} />)}}
          </div>
        )}}
      </div>
    </div>
  );
}}

function BackupRow({{ backup, onRestore, disabled }}: {{ backup:{{name:string;timestamp:number;data:SerializedVSTChain}}; onRestore:()=>void; disabled:boolean }}) {{
  const chainCount=backup.data.chains.length;
  const fxCount=backup.data.chains.reduce((s,c)=>s+c.effects.length,0);
  return (
    <div className="border border-[#1a1a1a] px-4 py-3 flex items-center justify-between gap-4 hover:border-[#2a2a2a] transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="text-xs tracking-wider text-[#f0f0f0] truncate">{{backup.name}}</div>
        <div className="flex items-center gap-1.5 text-[10px] tracking-wider text-[#555]"><Clock className="h-2.5 w-2.5 shrink-0"/>{{format(new Date(backup.timestamp),'MMM d, yyyy · HH:mm')}}</div>
        <div className="flex gap-3 text-[10px] tracking-widest uppercase">
          <span className="text-[#f0f0f0]">{{chainCount}} chain{{chainCount!==1?'s':''}}</span>
          <span className="text-[#333]">·</span>
          <span className="text-[#f0f0f0]">{{fxCount}} effect{{fxCount!==1?'s':''}}</span>
        </div>
      </div>
      <button onClick={{onRestore}} disabled={{disabled}} title="Restore backup" className="{btn_icon}"><RotateCcw className="h-3.5 w-3.5" /></button>
    </div>
  );
}}
""".format(btn_primary=BTN_PRIMARY, btn_ghost=BTN_GHOST, btn_icon=BTN_ICON)

FILES = {
    'src/components/vst-automation-ui.tsx':         AUTOMATION,
    'src/components/vst-sidechain-ui.tsx':           SIDECHAIN,
    'src/components/vst-performance-monitor-ui.tsx': PERFORMANCE,
    'src/components/vst-project-manager-ui.tsx':     PROJECT,
}

for path_str, content in FILES.items():
    p = pathlib.Path(path_str)
    if p.exists():
        shutil.copy(p, str(p) + '.bak')
    p.write_text(content)
    # Quick export check for project manager
    if 'project-manager' in path_str:
        assert 'export function VSTProjectManagerUI' in content, 'MISSING EXPORT!'
    print(f"  {path_str}  ({content.count(chr(10))} lines)")

print("\nDone — run: npm run dev")
