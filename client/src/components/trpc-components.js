import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/ProjectsList.tsx
// Usage: drop anywhere — fully typed, no manual fetch/error handling
// ─────────────────────────────────────────────────────────────────────────────
import { trpc } from '@/lib/trpc';
export function ProjectsList() {
    const { data: projects, isLoading, error } = trpc.projects.list.useQuery();
    if (isLoading)
        return _jsx("div", { className: "text-muted-foreground", children: "Loading projects..." });
    if (error)
        return _jsxs("div", { className: "text-destructive", children: ["Error: ", error.message] });
    if (!projects?.length)
        return _jsx("div", { className: "text-muted-foreground", children: "No projects yet." });
    return (_jsx("ul", { className: "space-y-2", children: projects.map((p) => (_jsxs("li", { className: "rounded-md border px-4 py-2 text-sm", children: [_jsx("span", { className: "font-medium", children: p.name }), p.bpm && _jsxs("span", { className: "ml-2 text-muted-foreground", children: [p.bpm, " BPM"] })] }, p.id))) }));
}
// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/CreateProject.tsx
// Usage: form that creates a project and auto-refreshes the list
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
export function CreateProject() {
    const [name, setName] = useState('');
    const utils = trpc.useUtils();
    const create = trpc.projects.create.useMutation({
        onSuccess: () => {
            setName('');
            // Invalidate the list so ProjectsList auto-refreshes
            utils.projects.list.invalidate();
        },
    });
    return (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "flex-1 rounded-md border bg-background px-3 py-2 text-sm", placeholder: "Project name", value: name, onChange: (e) => setName(e.target.value), onKeyDown: (e) => e.key === 'Enter' && create.mutate({ name }) }), _jsx("button", { className: "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50", disabled: !name || create.isPending, onClick: () => create.mutate({ name }), children: create.isPending ? 'Saving...' : 'New Project' }), create.error && (_jsx("p", { className: "text-xs text-destructive", children: create.error.message }))] }));
}
export function PresetSelector({ type, onSelect }) {
    const { data: presets, isLoading } = trpc.presets.list.useQuery({ type });
    const utils = trpc.useUtils();
    const deletePreset = trpc.presets.delete.useMutation({
        onSuccess: () => utils.presets.list.invalidate(),
    });
    if (isLoading)
        return _jsx("div", { className: "text-xs text-muted-foreground", children: "Loading presets..." });
    return (_jsxs("div", { className: "space-y-1", children: [presets?.map((preset) => (_jsxs("div", { className: "flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent cursor-pointer", onClick: () => onSelect(preset), children: [_jsx("span", { children: preset.name }), _jsx("button", { className: "ml-2 text-xs text-muted-foreground hover:text-destructive", onClick: (e) => {
                            e.stopPropagation();
                            deletePreset.mutate({ id: preset.id });
                        }, children: "\u2715" })] }, preset.id))), !presets?.length && (_jsx("p", { className: "text-xs text-muted-foreground px-1", children: "No presets saved." }))] }));
}
// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/SessionStatus.tsx
// Usage: show current session info — polling every 5s for live state
// ─────────────────────────────────────────────────────────────────────────────
export function SessionStatus({ sessionId }) {
    const { data: session } = trpc.sessions.byId.useQuery({ id: sessionId }, {
        refetchInterval: 5000, // poll every 5s — useful for collaborative sessions
        enabled: !!sessionId,
    });
    if (!session)
        return null;
    return (_jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-accent" }), _jsx("span", { children: session.name }), session.bpm && _jsxs("span", { children: ["\u00B7 ", session.bpm, " BPM"] })] }));
}
