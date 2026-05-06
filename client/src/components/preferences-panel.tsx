// client/src/components/preferences-panel.tsx
// Full preferences panel — Audio / MIDI / Display / Recording / Shortcuts
import { useState } from "react";
import { X } from "lucide-react";
const T = { bg:"#060606",panel:"#0a0a0a",border:"#1c1c1c",accent:"#b8ff00",dim:"#555",text:"#f0f0f0",font:"monospace" } as const;
type PrefTab = "audio"|"midi"|"display"|"recording"|"shortcuts";
interface PreferencesPanelProps { onClose:()=>void; }
function TabBtn({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}) {
  return <button onClick={onClick} style={{ padding:"8px 14px",background:active?T.accent:"transparent",border:"none",borderBottom:active?"none":`1px solid ${T.border}`,color:active?"#000":T.dim,fontFamily:T.font,fontSize:8,letterSpacing:".15em",textTransform:"uppercase",cursor:"pointer",flexShrink:0 }}>{label}</button>;
}
function Row({label,children}:{label:string;children:React.ReactNode}) {
  return <div style={{ display:"flex",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`,gap:16 }}><span style={{ width:160,fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:T.dim,fontFamily:T.font,flexShrink:0 }}>{label}</span><div style={{ flex:1 }}>{children}</div></div>;
}
function Sel({options,value,onChange}:{options:string[];value:string;onChange:(v:string)=>void}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:T.panel,border:`1px solid ${T.border}`,color:T.text,fontFamily:T.font,fontSize:9,padding:"4px 8px",cursor:"pointer",outline:"none",minWidth:160 }}>{options.map(o=><option key={o}>{o}</option>)}</select>;
}
function Toggle({value,onChange}:{value:boolean;onChange:(v:boolean)=>void}) {
  return <button onClick={()=>onChange(!value)} style={{ height:22,padding:"0 12px",background:value?T.accent:"transparent",border:`1px solid ${value?T.accent:T.border}`,color:value?"#000":T.dim,fontFamily:T.font,fontSize:8,cursor:"pointer" }}>{value?"ON":"OFF"}</button>;
}
const SHORTCUTS=[["Space","Play / Pause"],[".", "Stop"],["Ctrl+R","Record"],["Ctrl+Z","Undo"],["Ctrl+Y","Redo"],["Ctrl+S","Save"],["Ctrl+D","Duplicate region"],["Delete","Delete selected"],["+/-","Zoom in/out"],["[/]","Prev/Next marker"],["Ctrl+A","Select all"],["Escape","Deselect all"]];
export function PreferencesPanel({ onClose }:PreferencesPanelProps) {
  const [tab,setTab]=useState<PrefTab>("audio");
  const [p,setP]=useState({ audioDevice:"Default",sampleRate:"44100",bufferSize:"256",bitDepth:"24",midiDevice:"None",midiThru:false,theme:"Dark",fontSize:"Medium",showMeters:true,recordFormat:"WAV",autoSave:true,autoSaveMin:5,undoSteps:50 });
  const u=(k:string)=>(v:unknown)=>setP(prev=>({...prev,[k]:v}));
  const tabs:PrefTab[]=["audio","midi","display","recording","shortcuts"];
  return (
    <div style={{ position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)" }}>
      <div style={{ width:600,maxHeight:"80vh",background:T.panel,border:`1px solid ${T.border}`,borderTop:`2px solid ${T.accent}`,display:"flex",flexDirection:"column",fontFamily:T.font }}>
        <div style={{ display:"flex",alignItems:"center",padding:"10px 16px",borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:T.dim,flex:1 }}>Preferences</span>
          <button onClick={onClose} style={{ background:"none",border:"none",color:T.dim,cursor:"pointer",padding:0,display:"flex" }}><X size={14} /></button>
        </div>
        <div style={{ display:"flex",borderBottom:`1px solid ${T.border}` }}>{tabs.map(t=><TabBtn key={t} label={t} active={tab===t} onClick={()=>setTab(t)} />)}</div>
        <div style={{ flex:1,overflowY:"auto",padding:"16px 20px",scrollbarWidth:"thin",scrollbarColor:`${T.accent} ${T.bg}` }}>
          {tab==="audio"&&<><Row label="Output Device"><Sel options={["Default","Built-in Output","USB Audio"]} value={p.audioDevice} onChange={u("audioDevice")} /></Row><Row label="Sample Rate"><Sel options={["44100","48000","88200","96000"]} value={p.sampleRate} onChange={u("sampleRate")} /></Row><Row label="Buffer Size"><Sel options={["64","128","256","512","1024"]} value={p.bufferSize} onChange={u("bufferSize")} /></Row></>}
          {tab==="midi"&&<><Row label="MIDI Input"><Sel options={["None","All Devices"]} value={p.midiDevice} onChange={u("midiDevice")} /></Row><Row label="MIDI Thru"><Toggle value={p.midiThru} onChange={u("midiThru") as (v:boolean)=>void} /></Row></>}
          {tab==="display"&&<><Row label="Theme"><Sel options={["Dark","Light","Acid"]} value={p.theme} onChange={u("theme")} /></Row><Row label="Font Size"><Sel options={["Small","Medium","Large"]} value={p.fontSize} onChange={u("fontSize")} /></Row><Row label="Show Meters"><Toggle value={p.showMeters} onChange={u("showMeters") as (v:boolean)=>void} /></Row></>}
          {tab==="recording"&&<><Row label="Format"><Sel options={["WAV","FLAC","MP3"]} value={p.recordFormat} onChange={u("recordFormat")} /></Row><Row label="Bit Depth"><Sel options={["16","24","32"]} value={p.bitDepth} onChange={u("bitDepth")} /></Row><Row label="Auto-Save"><Toggle value={p.autoSave} onChange={u("autoSave") as (v:boolean)=>void} /></Row></>}
          {tab==="shortcuts"&&<div style={{ fontSize:9,color:T.dim,fontFamily:T.font }}>{SHORTCUTS.map(([k,a])=><div key={k} style={{ display:"flex",padding:"4px 0",borderBottom:`1px solid ${T.border}` }}><span style={{ width:100,color:T.accent }}>{k}</span><span>{a}</span></div>)}<p style={{ marginTop:12,fontSize:8,color:T.dim }}>Custom shortcut editing coming in a future update.</p></div>}
        </div>
        <div style={{ padding:"10px 16px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ height:28,padding:"0 20px",background:T.accent,border:"none",color:"#000",fontFamily:T.font,fontSize:9,letterSpacing:".15em",textTransform:"uppercase",cursor:"pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
}

