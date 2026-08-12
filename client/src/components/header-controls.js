import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
// client/src/components/header-controls.tsx [POLISHED]
import React, { useRef, useState, useMemo, useCallback, memo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, getQueryFn, apiRequest } from '@/lib/queryClient';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from '@/components/ui/tooltip';
import { useLocation } from 'wouter';
import { Moon, Sun, Music, Clock, Palette, Save, FolderOpen, Upload } from 'lucide-react';
import { LogoutButton } from '@/components/logout-button';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
// ─── Theme config ──────────────────────────────────────────────────────────────
const THEME_ICONS = {
    dark: Moon, light: Sun, acid: Palette, neon: Palette,
    chrome: Palette, forest: Palette, sunset: Palette, aurora: Palette,
};
const THEMES = {
    dark: { label: 'Dark', description: 'Classic dark theme' },
    light: { label: 'Light', description: 'Clean light theme' },
    acid: { label: 'Acid', description: 'Acid lime — DAW core' },
    neon: { label: 'Neon', description: 'Cyan neon — high contrast' },
    chrome: { label: 'Chrome', description: 'Polished chrome finish' },
    forest: { label: 'Forest', description: 'Natural forest green' },
    sunset: { label: 'Sunset', description: 'Warm sunset tones' },
    aurora: { label: 'Aurora', description: 'Northern lights palette' },
};
// ─── Design tokens — mirrors waveform-editor.tsx exactly ──────────────────────
const S = {
    bg: 'var(--dj-black)',
    bgPanel: 'var(--dj-surface)',
    border: 'var(--dj-border)',
    accent: '#a3e635',
    accentGlow: '#a3e63588',
    textDim: '#555',
    textMuted: 'var(--dj-dim)',
    textActive: 'var(--white)',
    font: "'IBM Plex Mono', 'JetBrains Mono', monospace",
};
// Tiny reusable styled button (matches waveform-editor ghost button pattern)
const BarButton = React.forwardRef(function BarButton({ onClick, active = false, children, title }, ref) {
    return (_jsx("button", { ref: ref, onClick: onClick, title: title, className: "flex items-center gap-1.5 h-7 px-2 transition-all", style: {
            background: active ? S.accent : 'transparent',
            color: active ? 'var(--dj-black)' : S.textDim,
            border: `1px solid ${active ? S.accent : S.border}`,
            borderRadius: 0,
            fontFamily: S.font,
            fontSize: 10,
            letterSpacing: '0.05em',
            fontWeight: active ? 500 : 400,
            boxShadow: active ? `inset 0 0 8px ${S.accentGlow}, 0 0 6px ${S.accent}22` : 'none',
        }, onMouseEnter: e => {
            if (!active) {
                e.currentTarget.style.color = S.textActive;
                e.currentTarget.style.borderColor = 'var(--dj-dim)';
                e.currentTarget.style.background = 'rgba(163, 230, 53, 0.06)';
            }
        }, onMouseLeave: e => {
            if (!active) {
                e.currentTarget.style.color = S.textDim;
                e.currentTarget.style.borderColor = S.border;
                e.currentTarget.style.background = 'transparent';
            }
        }, children: children }));
});
const tipStyle = {
    background: 'var(--dj-surface)',
    border: '1px solid var(--dj-border)',
    borderRadius: 0,
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
    fontSize: 10,
    color: 'var(--white)',
};
// ─── Main Component ────────────────────────────────────────────────────────────
export const HeaderControls = memo(function HeaderControls({ bpm, onBpmChange, metronomeOn, onMetronomeToggle, onSave, onLoad, getSessionData, }) {
    const { theme, setTheme, themes, themeMetadata } = useTheme();
    const [location, navigate] = useLocation();
    const fileInputRef = useRef(null);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [sessionDescription, setSessionDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const { data: sessions = [], isError: sessionsError } = useQuery({
        queryFn: getQueryFn({ on401: 'returnNull' }),
        queryKey: ['/api/sessions'],
        enabled: loadDialogOpen,
        staleTime: 60000,
        retry: 1,
    });
    // TanStack v5 — no onError in useQuery; handle via isError
    const prevErr = useRef(false);
    if (sessionsError && !prevErr.current) {
        prevErr.current = true;
        toast({ title: 'Sessions unavailable', variant: 'default' });
    }
    if (!sessionsError)
        prevErr.current = false;
    const _createSessionMutation = useMutation({
        mutationFn: async (data) => apiRequest('POST', '/api/sessions', data).then(r => r.json()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
            setSaveDialogOpen(false);
            setSessionName('');
            setSessionDescription('');
            toast({ title: 'Session saved' });
        },
        onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
    });
    const filteredSessions = useMemo(() => sessions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())), [sessions, searchQuery]);
    const ThemeIcon = THEME_ICONS[theme] ?? Moon;
    const msPerBeat = useMemo(() => (60000 / bpm).toFixed(0), [bpm]);
    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            onLoad(await file.text());
            toast({ title: `Loaded ${file.name}` });
        }
        catch {
            toast({ title: 'Load failed', description: 'Invalid file format', variant: 'destructive' });
        }
        finally {
            if (fileInputRef.current)
                fileInputRef.current.value = '';
        }
    }, [onLoad, toast]);
    const handleThemeChange = useCallback((t) => {
        if (themes.includes(t))
            setTheme(t);
    }, [themes, setTheme]);
    const handleBpmChange = useCallback(([v]) => onBpmChange(v), [onBpmChange]);
    // ─── Render ──────────────────────────────────────────────────────────────────
    return (_jsxs(TooltipProvider, { children: [_jsx("input", { ref: fileInputRef, type: "file", accept: ".json", className: "hidden", onChange: handleFileChange, "aria-hidden": true }), _jsxs("div", { className: "flex items-center flex-wrap gap-0 sticky top-0 z-50 flex-shrink-0", style: {
                    background: S.bgPanel,
                    borderBottom: `1px solid ${S.border}`,
                    fontFamily: S.font,
                }, children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-2 border-r flex-shrink-0", style: { borderColor: S.border }, children: [_jsx("div", { className: "flex items-center justify-center w-6 h-6", style: { background: S.accent, borderRadius: 0 }, children: _jsx(Music, { className: "w-3.5 h-3.5", style: { color: 'var(--dj-black)' } }) }), _jsxs("div", { children: [_jsx("div", { className: "text-xs font-bold leading-none", style: { color: S.textActive, letterSpacing: 2, textTransform: 'uppercase' }, children: "R3" }), _jsx("div", { className: "text-[9px] leading-tight mt-0.5", style: { color: S.textMuted, letterSpacing: 1 }, children: "STUDIO \u00B7 DAW" })] })] }), _jsxs("div", { className: "flex items-center gap-3 px-4 py-2 border-r", style: { borderColor: S.border }, children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(BarButton, { onClick: onMetronomeToggle, active: metronomeOn, children: [_jsx(Clock, { className: "w-3 h-3" }), _jsx("span", { className: "text-[9px] uppercase", style: { letterSpacing: 1 }, children: metronomeOn ? 'CLICK' : 'CLICK' })] }) }), _jsxs(TooltipContent, { style: tipStyle, children: [metronomeOn ? 'Disable' : 'Enable', " metronome"] })] }), _jsxs("div", { className: "flex items-center gap-2 px-2 h-7 border", style: { borderColor: S.border, background: S.bg }, children: [_jsx("span", { className: "text-xs font-bold tabular-nums", style: { color: S.accent, letterSpacing: 1 }, children: bpm }), _jsx("span", { className: "text-[9px]", style: { color: S.textDim, letterSpacing: 1 }, children: "BPM" })] }), _jsx(Slider, { value: [bpm], min: 40, max: 240, step: 1, onValueChange: handleBpmChange, className: "w-24" }), _jsxs("span", { className: "text-[9px] tabular-nums hidden lg:block", style: { color: S.textDim, letterSpacing: 1 }, children: [msPerBeat, "ms"] })] }), _jsx("div", { className: "flex items-center px-4 py-2 border-r", style: { borderColor: S.border }, children: _jsxs(DropdownMenu, { children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { className: "flex items-center gap-2 h-7 px-2", style: {
                                                        background: 'transparent',
                                                        color: S.textDim,
                                                        border: `1px solid ${S.border}`,
                                                        borderRadius: 0,
                                                        fontFamily: S.font,
                                                        transition: 'all 0.15s ease-out',
                                                    }, onMouseEnter: e => {
                                                        e.currentTarget.style.color = S.textActive;
                                                        e.currentTarget.style.borderColor = 'var(--dj-dim)';
                                                    }, onMouseLeave: e => {
                                                        e.currentTarget.style.color = S.textDim;
                                                        e.currentTarget.style.borderColor = S.border;
                                                    }, children: [_jsx(ThemeIcon, { className: "w-3 h-3" }), _jsx("span", { className: "text-[9px] uppercase hidden sm:inline", style: { letterSpacing: 1 }, children: themeMetadata?.label ?? theme })] }) }) }), _jsx(TooltipContent, { style: tipStyle, children: "Change theme" })] }), _jsxs(DropdownMenuContent, { align: "start", className: "w-52", style: {
                                        background: S.bgPanel,
                                        border: `1px solid ${S.border}`,
                                        borderRadius: 0,
                                        fontFamily: S.font,
                                    }, children: [_jsx(DropdownMenuLabel, { className: "text-[9px] uppercase", style: { color: S.textDim, letterSpacing: 2 }, children: "Theme" }), _jsx(DropdownMenuSeparator, { style: { background: S.border } }), _jsx(DropdownMenuRadioGroup, { value: theme, onValueChange: handleThemeChange, children: themes.map(t => {
                                                const Icon = THEME_ICONS[t] ?? Moon;
                                                const meta = THEMES[t] ?? {};
                                                const active = t === theme;
                                                return (_jsxs(DropdownMenuRadioItem, { value: t, className: "gap-2", style: {
                                                        color: active ? S.accent : S.textActive,
                                                        background: active ? 'var(--dj-surface2)' : 'transparent',
                                                        borderRadius: 0,
                                                    }, children: [_jsx(Icon, { className: "w-3 h-3" }), _jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium", children: meta?.label ?? t }), _jsx("div", { className: "text-[9px]", style: { color: S.textDim }, children: meta?.description ?? '' })] })] }, t));
                                            }) })] })] }) }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-2 ml-auto", children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(BarButton, { onClick: onSave, children: [_jsx(Save, { className: "w-3 h-3" }), _jsx("span", { className: "text-[9px] uppercase hidden sm:inline", style: { letterSpacing: 1 }, children: "Save" })] }) }), _jsx(TooltipContent, { style: tipStyle, children: "Save session" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(BarButton, { onClick: () => setLoadDialogOpen(v => !v), active: loadDialogOpen, children: [_jsx(FolderOpen, { className: "w-3 h-3" }), _jsxs("span", { className: "text-[9px] uppercase hidden sm:inline", style: { letterSpacing: 1 }, children: ["Sessions", loadDialogOpen && filteredSessions.length > 0
                                                            ? ` (${filteredSessions.length})`
                                                            : ''] })] }) }), _jsx(TooltipContent, { style: tipStyle, children: "Browse saved sessions" })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(BarButton, { onClick: () => fileInputRef.current?.click(), children: [_jsx(Upload, { className: "w-3 h-3" }), _jsx("span", { className: "text-[9px] uppercase hidden sm:inline", style: { letterSpacing: 1 }, children: "Load" })] }) }), _jsx(TooltipContent, { style: tipStyle, children: "Load session from file" })] })] }), _jsx("div", { style: { marginLeft: 8, display: 'flex', alignItems: 'center' }, children: _jsx(LogoutButton, { variant: "compact" }) })] }), loadDialogOpen && (_jsxs("div", { className: "border-b flex-shrink-0", style: { background: S.bg, borderColor: S.border, fontFamily: S.font }, children: [_jsxs("div", { className: "flex items-center gap-2 px-4 py-2 border-b", style: { background: S.bgPanel, borderColor: S.border }, children: [_jsx("span", { className: "text-[9px] uppercase", style: { color: S.textDim, letterSpacing: 2 }, children: "Saved Sessions" }), _jsx("input", { type: "text", placeholder: "Filter\u2026", value: searchQuery, onChange: e => setSearchQuery(e.target.value), className: "ml-auto h-5 px-2 text-[9px] bg-transparent outline-none", style: {
                                    border: `1px solid ${S.border}`,
                                    color: S.textActive,
                                    fontFamily: S.font,
                                    borderRadius: 0,
                                    width: 120,
                                } })] }), _jsx("div", { className: "max-h-40 overflow-y-auto", children: sessionsError ? (_jsx("div", { className: "px-4 py-2 text-[9px]", style: { color: '#ef4444' }, children: "Failed to load sessions" })) : filteredSessions.length === 0 ? (_jsx("div", { className: "px-4 py-2 text-[9px]", style: { color: S.textDim }, children: sessions.length === 0 ? 'No saved sessions' : 'No matches' })) : (filteredSessions.map(session => (_jsxs("button", { className: "w-full flex items-center gap-3 px-4 py-1.5 border-b text-left", style: {
                                borderColor: `${S.border}55`,
                                background: 'transparent',
                                fontFamily: S.font,
                                transition: 'background 0.1s',
                            }, onMouseEnter: e => { e.currentTarget.style.background = 'var(--t-b1)'; }, onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; }, onClick: () => {
                                onLoad(JSON.stringify(session));
                                setLoadDialogOpen(false);
                            }, children: [_jsx("span", { className: "text-[10px] flex-1", style: { color: S.textActive }, children: session.name }), session.bpm != null && (_jsxs("span", { className: "text-[9px] tabular-nums", style: { color: S.accent, letterSpacing: 1 }, children: [session.bpm, " BPM"] }))] }, session.id)))) })] }))] }));
});
