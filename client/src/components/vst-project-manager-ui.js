import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// client/src/components/vst-project-manager-ui.tsx
import { useState, useCallback } from 'react';
import { Save, Upload, Download, Clock, FileJson, RotateCcw } from 'lucide-react';
import { VSTProjectSerializer } from '@/audio/fx/vst-project-serializer';
import { format } from 'date-fns';
const P = "bg-[#a3e635] hover:bg-[var(--looper-lime)] text-[var(--void)] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const G = "border border-[#a3e635] text-[#a3e635] hover:bg-[#a3e635] hover:text-[var(--void)] rounded-none font-mono text-xs tracking-widest uppercase transition-colors px-4 py-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
const I = "border border-[#2a2a2a] p-2 text-[var(--daw-fg)] hover:text-[#a3e635] hover:border-[#a3e635]/40 rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
export function VSTProjectManagerUI({ onSave, onLoad }) {
    const [projectName, setProjectName] = useState('');
    const [backups, setBackups] = useState(VSTProjectSerializer.getBackups());
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const flash = (type, msg) => { setStatus({ type, msg }); setTimeout(() => setStatus(null), 3000); };
    const handleSave = useCallback(() => {
        try {
            const data = onSave();
            const fn = projectName.trim() || `project_${Date.now()}`;
            VSTProjectSerializer.exportToFile(data, `${fn}.vstchain`);
            flash('ok', `Saved "${fn}.vstchain"`);
        }
        catch (err) {
            console.error(err);
            flash('err', 'Save failed — check console');
        }
    }, [onSave, projectName]);
    const handleLoad = useCallback(async (file) => {
        setLoading(true);
        try {
            const data = await VSTProjectSerializer.importFromFile(file);
            await onLoad(data);
            flash('ok', `Loaded "${file.name}"`);
        }
        catch (err) {
            console.error(err);
            flash('err', 'Load failed — invalid project file');
        }
        finally {
            setLoading(false);
        }
    }, [onLoad]);
    const handleBackup = useCallback(() => {
        try {
            const data = onSave();
            VSTProjectSerializer.createBackup(data, projectName.trim() || `Backup ${new Date().toLocaleString()}`);
            setBackups(VSTProjectSerializer.getBackups());
            flash('ok', 'Backup created');
        }
        catch {
            flash('err', 'Backup failed');
        }
    }, [onSave, projectName]);
    const handleRestore = useCallback(async (index) => {
        const data = VSTProjectSerializer.restoreBackup(index);
        if (!data)
            return;
        setLoading(true);
        try {
            await onLoad(data);
            flash('ok', 'Backup restored');
        }
        catch {
            flash('err', 'Restore failed');
        }
        finally {
            setLoading(false);
        }
    }, [onLoad]);
    return (_jsxs("div", { className: "w-full bg-[var(--void)] text-[var(--daw-fg)] font-mono space-y-6", children: [status && (_jsxs("div", { className: `px-3 py-2 text-[10px] tracking-widest border ${status.type === 'ok' ? 'border-[#a3e635]/30 bg-[#a3e635]/5 text-[#a3e635]' : 'border-red-900/40 bg-red-900/5 text-red-400'}`, children: [status.type === 'ok' ? '✓' : '✗', " ", status.msg] })), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[10px] tracking-widest uppercase text-[var(--daw-fg)] mb-1.5", children: "Project Name" }), _jsx("input", { value: projectName, onChange: e => setProjectName(e.target.value), placeholder: "untitled-project", disabled: loading, className: "w-full bg-[#0d0d0d] border border-[#2a2a2a] text-[var(--daw-fg)] font-mono text-xs tracking-wider px-3 py-2 focus:outline-none focus:border-[#a3e635] placeholder:text-[var(--dj-dimmer)] disabled:opacity-40 rounded-none" })] }), _jsxs("div", { className: "flex gap-2 flex-wrap", children: [_jsxs("button", { onClick: handleSave, disabled: loading, className: P, children: [_jsx(Save, { className: "h-3 w-3" }), " Save to File"] }), _jsxs("button", { onClick: () => document.getElementById('vst-file-input')?.click(), disabled: loading, className: G, children: [_jsx(Upload, { className: "h-3 w-3" }), " Load File"] }), _jsx("input", { id: "vst-file-input", type: "file", accept: ".vstchain", className: "hidden", onChange: e => { const f = e.target.files?.[0]; if (f)
                                    handleLoad(f); e.target.value = ''; } })] })] }), _jsx("div", { className: "border-t border-[var(--t-b2x)]" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-[10px] tracking-widest uppercase text-[var(--daw-fg)]", children: ["Backups ", _jsxs("span", { className: "text-[#555]", children: ["(", backups.length, "/10)"] })] }), _jsxs("button", { onClick: handleBackup, disabled: loading, className: G, children: [_jsx(Download, { className: "h-3 w-3" }), " Create Backup"] })] }), backups.length === 0 ? (_jsxs("div", { className: "border border-dashed border-[var(--t-b2x)] py-8 text-center", children: [_jsx(FileJson, { className: "h-6 w-6 mx-auto mb-2 text-[var(--dj-dimmer)]" }), _jsx("p", { className: "text-[10px] tracking-widest uppercase text-[var(--daw-fg)]", children: "No backups yet" }), _jsx("p", { className: "text-[10px] text-[#555] mt-1 tracking-wider", children: "Create a backup to save your work" })] })) : (_jsx("div", { className: "space-y-2 max-h-[320px] overflow-y-auto pr-1", children: backups.map((backup, idx) => _jsx(BackupRow, { backup: backup, onRestore: () => handleRestore(idx), disabled: loading }, idx)) }))] })] }));
}
function BackupRow({ backup, onRestore, disabled }) {
    const chainCount = backup.data.chains.length;
    const fxCount = backup.data.chains.reduce((s, c) => s + c.effects.length, 0);
    return (_jsxs("div", { className: "border border-[var(--t-b2x)] px-4 py-3 flex items-center justify-between gap-4 hover:border-[#2a2a2a] transition-colors", children: [_jsxs("div", { className: "min-w-0 space-y-1", children: [_jsx("div", { className: "text-xs tracking-wider text-[var(--daw-fg)] truncate", children: backup.name }), _jsxs("div", { className: "flex items-center gap-1.5 text-[10px] tracking-wider text-[#555]", children: [_jsx(Clock, { className: "h-2.5 w-2.5 shrink-0" }), format(new Date(backup.timestamp), 'MMM d, yyyy · HH:mm')] }), _jsxs("div", { className: "flex gap-3 text-[10px] tracking-widest uppercase", children: [_jsxs("span", { className: "text-[var(--daw-fg)]", children: [chainCount, " chain", chainCount !== 1 ? 's' : ''] }), _jsx("span", { className: "text-[var(--dj-dimmer)]", children: "\u00B7" }), _jsxs("span", { className: "text-[var(--daw-fg)]", children: [fxCount, " effect", fxCount !== 1 ? 's' : ''] })] })] }), _jsx("button", { onClick: onRestore, disabled: disabled, title: "Restore backup", className: I, children: _jsx(RotateCcw, { className: "h-3.5 w-3.5" }) })] }));
}
