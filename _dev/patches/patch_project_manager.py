#!/usr/bin/env python3
"""Run from ~/Stable/R3 v4/client/  →  python3 patch_project_manager.py"""
import pathlib

content = '''\
// client/src/components/vst-project-manager-ui.tsx
import { useState, useCallback } from \'react\';
import { Save, Upload, Download, Clock, FileJson, RotateCcw } from \'lucide-react\';
import { VSTProjectSerializer, SerializedVSTChain } from \'@/audio/fx/vst-project-serializer\';
import { format } from \'date-fns\';

interface ProjectManagerUIProps {
  onSave: () => SerializedVSTChain;
  onLoad: (data: SerializedVSTChain) => Promise<void>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] tracking-widest uppercase text-[#555] mb-1.5">
      {children}
    </label>
  );
}

function MonoInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-[#0d0d0d] border border-[#2a2a2a] text-[#f0f0f0] font-mono text-xs tracking-wider px-3 py-2 focus:outline-none focus:border-[#a3e635] placeholder:text-[#333] disabled:opacity-40 ${props.className ?? \'\'}`}
    />
  );
}

function ActionBtn({
  onClick, disabled, icon, children, variant = \'primary\',
}: {
  onClick?: () => void; disabled?: boolean;
  icon?: React.ReactNode; children: React.ReactNode;
  variant?: \'primary\' | \'ghost\';
}) {
  const base = \'flex items-center gap-1.5 text-[10px] tracking-widest uppercase font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed\';
  const styles = {
    primary: \'border border-[#a3e635] px-4 py-2 text-[#060606] bg-[#a3e635] hover:bg-[#84cc16]\',
    ghost:   \'border border-[#2a2a2a] px-4 py-2 text-[#888] hover:text-[#f0f0f0] hover:border-[#444] bg-transparent\',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {icon}{children}
    </button>
  );
}

export function VSTProjectManagerUI({ onSave, onLoad }: ProjectManagerUIProps) {
  const [projectName, setProjectName] = useState(\'\');
  const [backups, setBackups] = useState(VSTProjectSerializer.getBackups());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: \'ok\' | \'err\'; msg: string } | null>(null);

  const flash = (type: \'ok\' | \'err\', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleSave = useCallback(() => {
    try {
      const data = onSave();
      const filename = projectName.trim() || `project_${Date.now()}`;
      VSTProjectSerializer.exportToFile(data, `${filename}.vstchain`);
      flash(\'ok\', `Saved "${filename}.vstchain"`);
    } catch (err) {
      console.error(err);
      flash(\'err\', \'Save failed — check console\');
    }
  }, [onSave, projectName]);

  const handleLoad = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const data = await VSTProjectSerializer.importFromFile(file);
      await onLoad(data);
      flash(\'ok\', `Loaded "${file.name}"`);
    } catch (err) {
      console.error(err);
      flash(\'err\', \'Load failed — invalid project file\');
    } finally {
      setLoading(false);
    }
  }, [onLoad]);

  const handleBackup = useCallback(() => {
    try {
      const data = onSave();
      const name = projectName.trim() || `Backup ${new Date().toLocaleString()}`;
      VSTProjectSerializer.createBackup(data, name);
      setBackups(VSTProjectSerializer.getBackups());
      flash(\'ok\', \'Backup created\');
    } catch (err) {
      flash(\'err\', \'Backup failed\');
    }
  }, [onSave, projectName]);

  const handleRestore = useCallback(async (index: number) => {
    const data = VSTProjectSerializer.restoreBackup(index);
    if (!data) return;
    setLoading(true);
    try {
      await onLoad(data);
      flash(\'ok\', \'Backup restored\');
    } catch (err) {
      flash(\'err\', \'Restore failed\');
    } finally {
      setLoading(false);
    }
  }, [onLoad]);

  return (
    <div className="w-full bg-[#060606] text-[#f0f0f0] font-mono space-y-6">

      {status && (
        <div className={`px-3 py-2 text-[10px] tracking-widest border ${
          status.type === \'ok\'
            ? \'border-[#a3e635]/30 bg-[#a3e635]/5 text-[#a3e635]\'
            : \'border-red-900/40 bg-red-900/5 text-red-400\'
        }`}>
          {status.type === \'ok\' ? \'✓\' : \'✗\'} {status.msg}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <FieldLabel>Project Name</FieldLabel>
          <MonoInput
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="untitled-project"
            disabled={loading}
          />
        </div>
        <div className="flex gap-2">
          <ActionBtn onClick={handleSave} disabled={loading} icon={<Save className="h-3 w-3" />} variant="primary">
            Save to File
          </ActionBtn>
          <ActionBtn
            onClick={() => document.getElementById(\'vst-file-input\')?.click()}
            disabled={loading}
            icon={<Upload className="h-3 w-3" />}
            variant="ghost"
          >
            Load File
          </ActionBtn>
          <input
            id="vst-file-input"
            type="file"
            accept=".vstchain"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLoad(f); e.target.value = \'\'; }}
          />
        </div>
      </div>

      <div className="border-t border-[#1a1a1a]" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-widest uppercase text-[#555]">
            Backups <span className="text-[#333]">({backups.length}/10)</span>
          </span>
          <ActionBtn onClick={handleBackup} disabled={loading} icon={<Download className="h-3 w-3" />} variant="ghost">
            Create Backup
          </ActionBtn>
        </div>

        {backups.length === 0 ? (
          <div className="border border-dashed border-[#1a1a1a] py-8 text-center">
            <FileJson className="h-6 w-6 mx-auto mb-2 text-[#333]" />
            <p className="text-[10px] tracking-widest uppercase text-[#444]">No backups yet</p>
            <p className="text-[10px] text-[#333] mt-1 tracking-wider">Create a backup to save your work</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {backups.map((backup, idx) => (
              <BackupRow key={idx} backup={backup} onRestore={() => handleRestore(idx)} disabled={loading} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackupRow({
  backup, onRestore, disabled,
}: {
  backup: { name: string; timestamp: number; data: SerializedVSTChain };
  onRestore: () => void; disabled: boolean;
}) {
  const chainCount = backup.data.chains.length;
  const fxCount = backup.data.chains.reduce((s, c) => s + c.effects.length, 0);

  return (
    <div className="border border-[#1a1a1a] px-4 py-3 flex items-center justify-between gap-4 hover:border-[#2a2a2a] transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="text-xs tracking-wider text-[#f0f0f0] truncate">{backup.name}</div>
        <div className="flex items-center gap-1.5 text-[10px] tracking-wider text-[#444]">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {format(new Date(backup.timestamp), \'MMM d, yyyy · HH:mm\')}
        </div>
        <div className="flex gap-3 text-[10px] tracking-widest uppercase">
          <span className="text-[#555]">{chainCount} chain{chainCount !== 1 ? \'s\' : \'\'}</span>
          <span className="text-[#333]">·</span>
          <span className="text-[#555]">{fxCount} effect{fxCount !== 1 ? \'s\' : \'\'}</span>
        </div>
      </div>
      <button
        onClick={onRestore}
        disabled={disabled}
        className="shrink-0 border border-[#2a2a2a] p-2 text-[#444] hover:text-[#a3e635] hover:border-[#a3e635]/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Restore this backup"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
'''

path = pathlib.Path('src/components/vst-project-manager-ui.tsx')
path.write_text(content)
print(f"✓ Written {path} ({len(content)} chars)")

# Verify the export is present
if 'export function VSTProjectManagerUI' in content:
    print("✓ Export verified")
else:
    print("ERROR: export not found!")
