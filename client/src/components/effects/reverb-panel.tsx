// client/src/components/effects/reverb-panel.tsx
import { useState } from "react";
const T = { bg:"#0a0a0a",border:"#1c1c1c",accent:"#b8ff00",dim:"#555",text:"#f0f0f0",font:"monospace" } as const;
interface ReverbSettings { roomSize:number; decay:number; preDelay:number; damping:number; wet:number; dry:number; }
interface ReverbPanelProps { settings?:ReverbSettings; onChange?:(s:ReverbSettings)=>void; disabled?:boolean; }
const DEFAULT:ReverbSettings = { roomSize:0.5, decay:2.0, preDelay:20, damping:0.5, wet:0.3, dry:0.8 };
function Row({ label, value, min, max, step, unit, onChange }:{label:string;value:number;min:number;max:number;step:number;unit:string;onChange:(v:number)=>void}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
      <span style={{ width:72,fontSize:8,letterSpacing:".15em",textTransform:"uppercase",color:T.dim,fontFamily:T.font,flexShrink:0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex:1, accentColor:T.accent, cursor:"pointer" }} />
      <span style={{ width:48,fontSize:9,color:T.text,fontFamily:T.font,textAlign:"right",flexShrink:0 }}>
        {value.toFixed(step<1?1:0)}{unit}
      </span>
    </div>
  );
}
export function ReverbPanel({ settings=DEFAULT, onChange, disabled=false }:ReverbPanelProps) {
  const [s, setS] = useState<ReverbSettings>(settings);
  const update = (k:keyof ReverbSettings) => (v:number) => { const n={...s,[k]:v}; setS(n); onChange?.(n); };
  return (
    <div style={{ background:T.bg,border:`1px solid ${T.border}`,padding:12,opacity:disabled?0.5:1,pointerEvents:disabled?"none":"auto" }}>
      <Row label="Room"     value={s.roomSize} min={0}   max={1}   step={0.01} unit=""   onChange={update("roomSize")} />
      <Row label="Decay"    value={s.decay}    min={0.1} max={10}  step={0.1}  unit="s"  onChange={update("decay")} />
      <Row label="PreDelay" value={s.preDelay} min={0}   max={100} step={1}    unit="ms" onChange={update("preDelay")} />
      <Row label="Damping"  value={s.damping}  min={0}   max={1}   step={0.01} unit=""   onChange={update("damping")} />
      <div style={{ height:1,background:T.border,margin:"8px 0" }} />
      <Row label="Wet" value={s.wet} min={0} max={1} step={0.01} unit="" onChange={update("wet")} />
      <Row label="Dry" value={s.dry} min={0} max={1} step={0.01} unit="" onChange={update("dry")} />
    </div>
  );
}

