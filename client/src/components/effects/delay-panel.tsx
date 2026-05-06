// client/src/components/effects/delay-panel.tsx
import { useState } from "react";
const T = { bg:"#0a0a0a",border:"#1c1c1c",accent:"#b8ff00",dim:"#555",text:"#f0f0f0",font:"monospace" } as const;
interface DelaySettings { time:number; feedback:number; cutoff:number; wet:number; dry:number; sync:boolean; }
interface DelayPanelProps { settings?:DelaySettings; onChange?:(s:DelaySettings)=>void; disabled?:boolean; bpm?:number; }
const DEFAULT:DelaySettings = { time:250, feedback:0.4, cutoff:8000, wet:0.3, dry:0.8, sync:false };
const SYNC_NOTES = [{l:"1/32",f:0.125},{l:"1/16",f:0.25},{l:"1/8",f:0.5},{l:"1/4",f:1},{l:"1/2",f:2},{l:"1",f:4}];
function Row({ label, value, min, max, step, unit, onChange }:{label:string;value:number;min:number;max:number;step:number;unit:string;onChange:(v:number)=>void}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
      <span style={{ width:64,fontSize:8,letterSpacing:".15em",textTransform:"uppercase",color:T.dim,fontFamily:T.font,flexShrink:0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex:1, accentColor:T.accent, cursor:"pointer" }} />
      <span style={{ width:52,fontSize:9,color:T.text,fontFamily:T.font,textAlign:"right",flexShrink:0 }}>
        {value.toFixed(step<1?2:0)}{unit}
      </span>
    </div>
  );
}
export function DelayPanel({ settings=DEFAULT, onChange, disabled=false, bpm=120 }:DelayPanelProps) {
  const [s, setS] = useState<DelaySettings>(settings);
  const update = (k:keyof DelaySettings) => (v:number|boolean) => { const n={...s,[k]:v}; setS(n); onChange?.(n as DelaySettings); };
  const beatMs = 60000/bpm;
  return (
    <div style={{ background:T.bg,border:`1px solid ${T.border}`,padding:12,opacity:disabled?0.5:1,pointerEvents:disabled?"none":"auto" }}>
      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
        <span style={{ fontSize:8,letterSpacing:".15em",textTransform:"uppercase",color:T.dim,fontFamily:T.font }}>BPM Sync</span>
        <button onClick={() => update("sync")(!s.sync)} style={{ height:18,padding:"0 8px",background:s.sync?T.accent:"transparent",border:`1px solid ${s.sync?T.accent:T.border}`,color:s.sync?"#000":T.dim,fontFamily:T.font,fontSize:7,cursor:"pointer" }}>
          {s.sync?"ON":"OFF"}
        </button>
      </div>
      {s.sync && (
        <div style={{ display:"flex",gap:3,marginBottom:8,flexWrap:"wrap" }}>
          {SYNC_NOTES.map(sv => {
            const ms = beatMs*sv.f;
            const active = Math.abs(s.time-ms)<5;
            return <button key={sv.l} onClick={() => update("time")(ms)} style={{ height:18,padding:"0 6px",background:active?T.accent:"transparent",border:`1px solid ${active?T.accent:T.border}`,color:active?"#000":T.dim,fontFamily:T.font,fontSize:7,cursor:"pointer" }}>{sv.l}</button>;
          })}
        </div>
      )}
      <Row label="Time"     value={s.time}     min={1}   max={2000}  step={1}    unit="ms" onChange={update("time") as (v:number)=>void} />
      <Row label="Feedback" value={s.feedback} min={0}   max={0.99}  step={0.01} unit=""   onChange={update("feedback") as (v:number)=>void} />
      <Row label="Filter"   value={s.cutoff}   min={200} max={20000} step={100}  unit="Hz" onChange={update("cutoff") as (v:number)=>void} />
      <div style={{ height:1,background:T.border,margin:"8px 0" }} />
      <Row label="Wet" value={s.wet} min={0} max={1} step={0.01} unit="" onChange={update("wet") as (v:number)=>void} />
      <Row label="Dry" value={s.dry} min={0} max={1} step={0.01} unit="" onChange={update("dry") as (v:number)=>void} />
    </div>
  );
}

