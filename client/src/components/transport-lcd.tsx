// client/src/components/transport-lcd.tsx
// Transport LCD — bars:beats:ticks / timecode / samples — click to toggle
import { useState } from "react";
const T = { bg:"#000",border:"#1c1c1c",accent:"#b8ff00",dim:"#3a5c00",text:"#b8ff00",font:"monospace" } as const;
type DisplayMode = "bars" | "timecode" | "samples";
interface TransportLCDProps {
  bar:number; beat:number; tick:number; bpm:number;
  timeSignature:{ numerator:number; denominator:number };
  keyName?:string; sampleRate?:number; seconds?:number;
}
function Seg({ label, value, width="auto" }:{ label:string; value:string|number; width?:string|number }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",minWidth:width }}>
      <span style={{ fontSize:6,letterSpacing:".2em",textTransform:"uppercase",color:T.dim,fontFamily:T.font,marginBottom:1 }}>{label}</span>
      <span style={{ fontSize:16,fontWeight:700,color:T.text,fontFamily:T.font,letterSpacing:".08em",fontVariantNumeric:"tabular-nums",textShadow:`0 0 8px ${T.accent}66` }}>{value}</span>
    </div>
  );
}
function Div() { return <div style={{ width:1,height:24,background:T.dim,margin:"0 8px",alignSelf:"center" }} />; }
export function TransportLCD({ bar,beat,tick,bpm,timeSignature,keyName,sampleRate=44100,seconds=0 }:TransportLCDProps) {
  const [mode, setMode] = useState<DisplayMode>("bars");
  const mins=Math.floor(seconds/60), secs=Math.floor(seconds%60), frames=Math.floor((seconds%1)*30);
  const tc=`${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}:${String(frames).padStart(2,"0")}`;
  return (
    <div onClick={() => setMode(m => m==="bars"?"timecode":m==="timecode"?"samples":"bars")}
      title="Click to toggle display mode"
      style={{ display:"flex",alignItems:"center",height:44,padding:"0 16px",background:T.bg,border:`1px solid ${T.border}`,borderTop:`1px solid ${T.dim}`,cursor:"pointer",userSelect:"none",flexShrink:0 }}>
      {mode==="bars" && <>
        <Seg label="Bar"  value={String(bar).padStart(4,"0")} width={52} />
        <span style={{ fontSize:18,color:T.dim,margin:"0 4px",alignSelf:"center",marginTop:8 }}>:</span>
        <Seg label="Beat" value={beat} width={24} />
        <span style={{ fontSize:18,color:T.dim,margin:"0 4px",alignSelf:"center",marginTop:8 }}>:</span>
        <Seg label="Tick" value={String(tick).padStart(3,"0")} width={40} />
      </>}
      {mode==="timecode" && <Seg label="Timecode" value={tc} width={80} />}
      {mode==="samples"  && <Seg label="Samples" value={Math.floor(seconds*sampleRate).toLocaleString()} width={100} />}
      <Div /><Seg label="BPM" value={bpm.toFixed(1)} width={56} />
      <Div /><Seg label="Sig" value={`${timeSignature.numerator}/${timeSignature.denominator}`} width={32} />
      {keyName && <><Div /><Seg label="Key" value={keyName} width={32} /></>}
      <div style={{ marginLeft:"auto",fontSize:6,letterSpacing:".15em",textTransform:"uppercase",color:T.dim,fontFamily:T.font }}>{mode}</div>
    </div>
  );
}

