// client/src/components/vst-project-manager-ui.tsx
import { useState, useCallback } from 'react';
import { Save, Upload, Download, Clock, FileJson, RotateCcw } from 'lucide-react';
import { VSTProjectSerializer, SerializedVSTChain } from '@/audio/fx/vst-project-serializer';
import { format } from 'date-fns';

interface ProjectManagerUIProps { onSave: () => SerializedVSTChain; onLoad: (data: SerializedVSTChain) => Promise<void>; }

const P = "bg-[#a3e635] hover:bg-[#84cc16] text-[#060606] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const G = "border border-[#a3e635] text-[#a3e635] hover:bg-[#a3e635] hover:text-[#060606] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const I = "border border-[#2a2a2a] p-2 text-[#f0f0f0] hover:text-[#a3e635] hover:border-[#a3e635]/40 rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export function VSTProjectManagerUI({ onSave, onLoad }: ProjectManagerUIProps) {
  const [projectName,setProjectName]=useState('');
  const [backups,setBackups]=useState(VSTProjectSerializer.getBackups());
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState<{type:'ok'|'err';msg:string}|null>(null);
  const flash=(type:'ok'|'err',msg:string)=>{setStatus({type,msg});setTimeout(()=>setStatus(null),3000);};

  const handleSave=useCallback(()=>{
    try{const data=onSave();const fn=projectName.trim()||`project_${Date.now()}`;VSTProjectSerializer.exportToFile(data,`${fn}.vstchain`);flash('ok',`Saved "${fn}.vstchain"`);}
    catch(err){console.error(err);flash('err','Save failed — check console');}
  },[onSave,projectName]);

  const handleLoad=useCallback(async(file:File)=>{
    setLoading(true);
    try{const data=await VSTProjectSerializer.importFromFile(file);await onLoad(data);flash('ok',`Loaded "${file.name}"`);}
    catch(err){console.error(err);flash('err','Load failed — invalid project file');}
    finally{setLoading(false);}
  },[onLoad]);

  const handleBackup=useCallback(()=>{
    try{const data=onSave();VSTProjectSerializer.createBackup(data,projectName.trim()||`Backup ${new Date().toLocaleString()}`);setBackups(VSTProjectSerializer.getBackups());flash('ok','Backup created');}
    catch{flash('err','Backup failed');}
  },[onSave,projectName]);

  const handleRestore=useCallback(async(index:number)=>{
    const data=VSTProjectSerializer.restoreBackup(index);if(!data)return;
    setLoading(true);
    try{await onLoad(data);flash('ok','Backup restored');}catch{flash('err','Restore failed');}finally{setLoading(false);}
  },[onLoad]);

  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono space-y-6">
      {status&&(
        <div className={`px-3 py-2 text-[10px] tracking-widest border ${status.type==='ok'?'border-[#a3e635]/30 bg-[#a3e635]/5 text-[#a3e635]':'border-red-900/40 bg-red-900/5 text-red-400'}`}>
          {status.type==='ok'?'✓':'✗'} {status.msg}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] tracking-widest uppercase text-[#f0f0f0] mb-1.5">Project Name</label>
          <input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="untitled-project" disabled={loading}
            className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-[#f0f0f0] font-mono text-xs tracking-wider px-3 py-2 focus:outline-none focus:border-[#a3e635] placeholder:text-[#333] disabled:opacity-40 rounded-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSave} disabled={loading} className={P}><Save className="h-3 w-3" /> Save to File</button>
          <button onClick={()=>document.getElementById('vst-file-input')?.click()} disabled={loading} className={G}><Upload className="h-3 w-3" /> Load File</button>
          <input id="vst-file-input" type="file" accept=".vstchain" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleLoad(f);e.target.value='';}} />
        </div>
      </div>
      <div className="border-t border-[#1a1a1a]" />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">Backups <span className="text-[#555]">({backups.length}/10)</span></span>
          <button onClick={handleBackup} disabled={loading} className={G}><Download className="h-3 w-3" /> Create Backup</button>
        </div>
        {backups.length===0?(
          <div className="border border-dashed border-[#1a1a1a] py-8 text-center">
            <FileJson className="h-6 w-6 mx-auto mb-2 text-[#333]" />
            <p className="text-[10px] tracking-widest uppercase text-[#f0f0f0]">No backups yet</p>
            <p className="text-[10px] text-[#555] mt-1 tracking-wider">Create a backup to save your work</p>
          </div>
        ):(
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {backups.map((backup,idx)=><BackupRow key={idx} backup={backup} onRestore={()=>handleRestore(idx)} disabled={loading} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function BackupRow({ backup, onRestore, disabled }: { backup:{name:string;timestamp:number;data:SerializedVSTChain}; onRestore:()=>void; disabled:boolean }) {
  const chainCount=backup.data.chains.length;
  const fxCount=backup.data.chains.reduce((s,c)=>s+c.effects.length,0);
  return (
    <div className="border border-[#1a1a1a] px-4 py-3 flex items-center justify-between gap-4 hover:border-[#2a2a2a] transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="text-xs tracking-wider text-[#f0f0f0] truncate">{backup.name}</div>
        <div className="flex items-center gap-1.5 text-[10px] tracking-wider text-[#555]">
          <Clock className="h-2.5 w-2.5 shrink-0"/>
          {format(new Date(backup.timestamp),'MMM d, yyyy · HH:mm')}
        </div>
        <div className="flex gap-3 text-[10px] tracking-widest uppercase">
          <span className="text-[#f0f0f0]">{chainCount} chain{chainCount!==1?'s':''}</span>
          <span className="text-[#333]">·</span>
          <span className="text-[#f0f0f0]">{fxCount} effect{fxCount!==1?'s':''}</span>
        </div>
      </div>
      <button onClick={onRestore} disabled={disabled} title="Restore backup" className={I}>
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
