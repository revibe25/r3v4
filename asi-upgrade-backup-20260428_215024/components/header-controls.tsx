// @ts-nocheck
// client/src/components/header-controls.tsx
import React, { useRef, useState, useMemo, useCallback, memo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, getQueryFn, apiRequest } from '@/lib/queryClient';

import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { Moon, Sun, Music, Clock, Palette, Save, FolderOpen, Upload } from 'lucide-react';
import { LogoutButton } from '@/components/logout-button';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import type { Session } from '@shared/schema';

interface HeaderControlsProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  metronomeOn: boolean;
  onMetronomeToggle: () => void;
  onSave: () => void;
  onLoad: (json: string) => void;
  getSessionData: () => any;
}

// ─── Theme config ──────────────────────────────────────────────────────────────
const THEME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dark: Moon, light: Sun, chrome: Palette, purple: Palette, blue: Palette, forest: Palette,
};

const THEMES: Record<string, { label: string; description: string }> = {
  dark:   { label: 'Dark',   description: 'Classic dark theme'    },
  light:  { label: 'Light',  description: 'Clean light theme'     },
  chrome: { label: 'Chrome', description: 'Polished chrome finish' },
  purple: { label: 'Purple', description: 'Rich purple tones'     },
  blue:   { label: 'Blue',   description: 'Cool blue shades'      },
  forest: { label: 'Forest', description: 'Natural forest green'  },
};

// ─── Design tokens — mirrors waveform-editor.tsx exactly ──────────────────────
const S = {
  bg:         '#000000',
  bgPanel:    '#0c0c0c',
  border:     '#222',
  accent:     '#a3e635',
  textDim:    '#555',
  textMuted:  '#444',
  textActive: '#fff',
  font:       "'IBM Plex Mono', 'JetBrains Mono', monospace",
} as const;

// Tiny reusable styled button (matches waveform-editor ghost button pattern)
const BarButton = React.forwardRef<
  HTMLButtonElement,
  {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title?: string;
  }
>(function BarButton({ onClick, active = false, children, title }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 h-7 px-2 transition-colors"
      style={{
        background:   active ? S.accent    : 'transparent',
        color:        active ? '#000'       : S.textDim,
        border:       `1px solid ${active ? S.accent : S.border}`,
        borderRadius: 0,
        fontFamily:   S.font,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.color = S.textActive;
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.color = S.textDim;
      }}
    >
      {children}
    </button>
  );
});

const tipStyle = {
  background:   '#0c0c0c',
  border:       '1px solid #222',
  borderRadius: 0,
  fontFamily:   "'IBM Plex Mono', 'JetBrains Mono', monospace",
  fontSize:     10,
  color:        '#fff',
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const HeaderControls = memo(function HeaderControls({
  bpm,
  onBpmChange,
  metronomeOn,
  onMetronomeToggle,
  onSave,
  onLoad,
  getSessionData,
}: HeaderControlsProps) {
  const { theme, setTheme, themes, themeMetadata } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen]         = useState(false);
  const [loadDialogOpen, setLoadDialogOpen]         = useState(false);
  const [sessionName, setSessionName]               = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [searchQuery, setSearchQuery]               = useState('');
  const { toast } = useToast();

  const { data: sessions = [], isError: sessionsError } = useQuery<Session[]>({
    queryFn: getQueryFn({ on401: 'returnNull' }),
    queryKey: ['/api/sessions'],
    enabled: loadDialogOpen,
    staleTime: 60_000,
    retry: 1,
  });

  // TanStack v5 — no onError in useQuery; handle via isError
  const prevErr = useRef(false);
  if (sessionsError && !prevErr.current) {
    prevErr.current = true;
    toast({ title: 'Sessions unavailable', variant: 'default' });
  }
  if (!sessionsError) prevErr.current = false;

  const createSessionMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('POST', '/api/sessions', data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      setSaveDialogOpen(false);
      setSessionName('');
      setSessionDescription('');
      toast({ title: 'Session saved' });
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const filteredSessions = useMemo(
    () => sessions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [sessions, searchQuery],
  );

  const ThemeIcon  = THEME_ICONS[theme] ?? Moon;
  const msPerBeat  = useMemo(() => (60_000 / bpm).toFixed(0), [bpm]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onLoad(await file.text());
      toast({ title: `Loaded ${file.name}` });
    } catch {
      toast({ title: 'Load failed', description: 'Invalid file format', variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onLoad, toast]);

  const handleThemeChange = useCallback((t: string) => {
    if (themes.includes(t as any)) setTheme(t as any);
  }, [themes, setTheme]);

  const handleBpmChange = useCallback(([v]: number[]) => onBpmChange(v), [onBpmChange]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
      />

      {/* ═══ HEADER BAR ══════════════════════════════════════════════════════ */}
      <div
        className="flex items-center flex-wrap gap-0 sticky top-0 z-50 flex-shrink-0"
        style={{
          background:   S.bgPanel,
          borderBottom: `1px solid ${S.border}`,
          fontFamily:   S.font,
        }}
      >
        {/* ── Logo / identity ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-r flex-shrink-0"
          style={{ borderColor: S.border }}
        >
          <div
            className="flex items-center justify-center w-6 h-6"
            style={{ background: S.accent, borderRadius: 0 }}
          >
            <Music className="w-3.5 h-3.5" style={{ color: '#000' }} />
          </div>
          <div>
            <div
              className="text-xs font-bold leading-none"
              style={{ color: S.textActive, letterSpacing: 2, textTransform: 'uppercase' }}
            >
              R3
            </div>
            <div
              className="text-[9px] leading-tight mt-0.5"
              style={{ color: S.textMuted, letterSpacing: 1 }}
            >
              STUDIO · DAW
            </div>
          </div>
        </div>

        {/* ── BPM / Metronome ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-r"
          style={{ borderColor: S.border }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <BarButton onClick={onMetronomeToggle} active={metronomeOn}>
                <Clock className="w-3 h-3" />
                <span className="text-[10px] uppercase" style={{ letterSpacing: 1 }}>
                  {metronomeOn ? 'CLICK ON' : 'CLICK'}
                </span>
              </BarButton>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>
              {metronomeOn ? 'Disable' : 'Enable'} metronome
            </TooltipContent>
          </Tooltip>

          {/* BPM readout */}
          <div
            className="flex items-center gap-1.5 px-2 h-7 border"
            style={{ borderColor: S.border, background: S.bg }}
          >
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: S.accent, letterSpacing: 1 }}
            >
              {bpm}
            </span>
            <span className="text-[9px]" style={{ color: S.textDim, letterSpacing: 1 }}>
              BPM
            </span>
          </div>

          <Slider
            value={[bpm]}
            min={40}
            max={240}
            step={1}
            onValueChange={handleBpmChange}
            className="w-24"
          />

          <span
            className="text-[10px] tabular-nums hidden lg:block"
            style={{ color: S.textDim, letterSpacing: 1 }}
          >
            {msPerBeat}ms
          </span>
        </div>

        {/* ── Theme selector ───────────────────────────────────────────────── */}
        <div
          className="flex items-center px-3 py-2 border-r"
          style={{ borderColor: S.border }}
        >
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 h-7 px-2"
                    style={{
                      background:   'transparent',
                      color:        S.textDim,
                      border:       `1px solid ${S.border}`,
                      borderRadius: 0,
                      fontFamily:   S.font,
                    }}
                  >
                    <ThemeIcon className="w-3 h-3" />
                    <span
                      className="text-[10px] uppercase hidden sm:inline"
                      style={{ letterSpacing: 1 }}
                    >
                      {themeMetadata?.label ?? theme}
                    </span>
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent style={tipStyle}>Change theme</TooltipContent>
            </Tooltip>

            <DropdownMenuContent
              align="start"
              className="w-52"
              style={{
                background:   S.bgPanel,
                border:       `1px solid ${S.border}`,
                borderRadius: 0,
                fontFamily:   S.font,
              }}
            >
              <DropdownMenuLabel
                className="text-[10px] uppercase"
                style={{ color: S.textDim, letterSpacing: 2 }}
              >
                Theme
              </DropdownMenuLabel>
              <DropdownMenuSeparator style={{ background: S.border }} />
              <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
                {themes.map(t => {
                  const Icon   = THEME_ICONS[t] ?? Moon;
                  const meta   = THEMES[t] ?? {};
                  const active = t === theme;
                  return (
                    <DropdownMenuRadioItem
                      key={t}
                      value={t}
                      className="gap-2"
                      style={{
                        color:        active ? S.accent : S.textActive,
                        background:   active ? '#111'   : 'transparent',
                        borderRadius: 0,
                      }}
                    >
                      <Icon className="w-3 h-3" />
                      <div>
                        <div className="text-xs font-medium">{meta?.label ?? t}</div>
                        <div className="text-[10px]" style={{ color: S.textDim }}>
                          {meta?.description ?? ''}
                        </div>
                      </div>
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Session controls (pushed to right) ───────────────────────────── */}
        <div className="flex items-center gap-0.5 px-3 py-2 ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <BarButton onClick={onSave}>
                <Save className="w-3 h-3" />
                <span className="text-[10px] uppercase hidden sm:inline" style={{ letterSpacing: 1 }}>
                  Save
                </span>
              </BarButton>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>Save session</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div style={{ marginLeft: 2 }}>
                <BarButton
                  onClick={() => setLoadDialogOpen(v => !v)}
                  active={loadDialogOpen}
                >
                  <FolderOpen className="w-3 h-3" />
                  <span className="text-[10px] uppercase hidden sm:inline" style={{ letterSpacing: 1 }}>
                    Sessions{loadDialogOpen && filteredSessions.length > 0
                      ? ` (${filteredSessions.length})`
                      : ''}
                  </span>
                </BarButton>
              </div>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>Browse saved sessions</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div style={{ marginLeft: 2 }}>
                <BarButton onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3 h-3" />
                  <span className="text-[10px] uppercase hidden sm:inline" style={{ letterSpacing: 1 }}>
                    Load
                  </span>
                </BarButton>
              </div>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>Load session from file</TooltipContent>
          </Tooltip>
        </div>
        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
          <LogoutButton variant="compact" />
        </div>
      </div>

      {/* ═══ SESSION LIST PANEL (inline below header) ════════════════════════ */}
      {loadDialogOpen && (
        <div
          className="border-b flex-shrink-0"
          style={{ background: S.bg, borderColor: S.border, fontFamily: S.font }}
        >
          {/* Filter bar */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 border-b"
            style={{ background: S.bgPanel, borderColor: S.border }}
          >
            <span
              className="text-[10px] uppercase"
              style={{ color: S.textDim, letterSpacing: 2 }}
            >
              Saved Sessions
            </span>
            <input
              type="text"
              placeholder="Filter…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ml-auto h-5 px-2 text-[10px] bg-transparent outline-none"
              style={{
                border:       `1px solid ${S.border}`,
                color:        S.textActive,
                fontFamily:   S.font,
                borderRadius: 0,
                width:        120,
              }}
            />
          </div>

          {/* Session rows */}
          <div className="max-h-40 overflow-y-auto">
            {sessionsError ? (
              <div className="px-3 py-2 text-[10px]" style={{ color: '#ef4444' }}>
                Failed to load sessions
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="px-3 py-2 text-[10px]" style={{ color: S.textDim }}>
                {sessions.length === 0 ? 'No saved sessions' : 'No matches'}
              </div>
            ) : (
              filteredSessions.map(session => (
                <button
                  key={session.id}
                  className="w-full flex items-center gap-3 px-3 py-1.5 border-b text-left"
                  style={{
                    borderColor: `${S.border}55`,
                    background:  'transparent',
                    fontFamily:  S.font,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0f0f0f'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={() => {
                    onLoad(JSON.stringify(session));
                    setLoadDialogOpen(false);
                  }}
                >
                  <span className="text-xs flex-1" style={{ color: S.textActive }}>
                    {session.name}
                  </span>
                  {session.bpm != null && (
                    <span
                      className="text-[9px] tabular-nums"
                      style={{ color: S.accent, letterSpacing: 1 }}
                    >
                      {session.bpm} BPM
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
});