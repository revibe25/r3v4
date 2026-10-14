// @ts-nocheck
// client/src/components/header-controls.tsx [POLISHED]
import React, { useRef, useState, useMemo, useCallback, memo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, getQueryFn, apiRequest } from '@/lib/queryClient';

import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useLocation } from 'wouter';
import { Music, Clock, Save, FolderOpen, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

// ─── Design tokens — mirrors waveform-editor.tsx exactly ──────────────────────
const S = {
  bg:         'var(--dj-black)',
  bgPanel:    'var(--dj-surface)',
  border:     'var(--dj-border)',
  accent:     '#a3e635',
  accentGlow: '#a3e63588',
  textDim:    '#555',
  textMuted:  'var(--dj-dim)',
  textActive: 'var(--white)',
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
      className="flex items-center gap-1.5 h-7 px-2 transition-all"
      style={{
        background:   active ? S.accent    : 'transparent',
        color:        active ? 'var(--dj-black)'       : S.textDim,
        border:       `1px solid ${active ? S.accent : S.border}`,
        borderRadius: 0,
        fontFamily:   S.font,
        fontSize:     10,
        letterSpacing: '0.05em',
        fontWeight:    active ? 500 : 400,
        boxShadow:     active ? `inset 0 0 8px ${S.accentGlow}, 0 0 6px ${S.accent}22` : 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = S.textActive;
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--dj-dim)';
          (e.currentTarget as HTMLElement).style.background = 'rgba(163, 230, 53, 0.06)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = S.textDim;
          (e.currentTarget as HTMLElement).style.borderColor = S.border;
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {children}
    </button>
  );
});

const tipStyle = {
  background:   'var(--dj-surface)',
  border:       '1px solid var(--dj-border)',
  borderRadius: 0,
  fontFamily:   "'IBM Plex Mono', 'JetBrains Mono', monospace",
  fontSize:     10,
  color:        'var(--white)',
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
  const [location, navigate] = useLocation();
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

  const _createSessionMutation = useMutation({
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
          className="flex items-center gap-3 px-4 py-2 border-r flex-shrink-0"
          style={{ borderColor: S.border }}
        >
          <div
            className="flex items-center justify-center w-6 h-6"
            style={{ background: S.accent, borderRadius: 0 }}
          >
            <Music className="w-3.5 h-3.5" style={{ color: 'var(--dj-black)' }} />
          </div>
          <div>
            <div
              className="text-xs font-bold leading-none"
              style={{ color: S.textActive, letterSpacing: 2, textTransform: 'uppercase' }}
            >
              R3
            </div>
          </div>
        </div>

        {/* ── BPM / Metronome ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-2 border-r"
          style={{ borderColor: S.border }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <BarButton onClick={onMetronomeToggle} active={metronomeOn}>
                <Clock className="w-3 h-3" />
                <span className="text-[9px] uppercase" style={{ letterSpacing: 1 }}>
                  {metronomeOn ? 'CLICK' : 'CLICK'}
                </span>
              </BarButton>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>
              {metronomeOn ? 'Disable' : 'Enable'} metronome
            </TooltipContent>
          </Tooltip>

          {/* BPM readout */}
          <div
            className="flex items-center gap-2 px-2 h-7 border"
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
            className="text-[9px] tabular-nums hidden lg:block"
            style={{ color: S.textDim, letterSpacing: 1 }}
          >
            {msPerBeat}ms
          </span>
        </div>

        {/* ── Session controls ───────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <BarButton onClick={onSave}>
                <Save className="w-3 h-3" />
                <span className="text-[9px] uppercase hidden sm:inline" style={{ letterSpacing: 1 }}>
                  Save
                </span>
              </BarButton>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>Save session</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <BarButton
                onClick={() => setLoadDialogOpen(v => !v)}
                active={loadDialogOpen}
              >
                <FolderOpen className="w-3 h-3" />
                <span className="text-[9px] uppercase hidden sm:inline" style={{ letterSpacing: 1 }}>
                  SESSIONS
                </span>
              </BarButton>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>Browse saved sessions</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <BarButton onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3" />
                <span className="text-[9px] uppercase hidden sm:inline" style={{ letterSpacing: 1 }}>
                  Load
                </span>
              </BarButton>
            </TooltipTrigger>
            <TooltipContent style={tipStyle}>Load session from file</TooltipContent>
          </Tooltip>
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
            className="flex items-center gap-2 px-4 py-2 border-b"
            style={{ background: S.bgPanel, borderColor: S.border }}
          >
            <span
              className="text-[9px] uppercase"
              style={{ color: S.textDim, letterSpacing: 2 }}
            >
              Saved Sessions
            </span>
            <input
              type="text"
              placeholder="Filter…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ml-auto h-5 px-2 text-[9px] bg-transparent outline-none"
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
              <div className="px-4 py-2 text-[9px]" style={{ color: '#ef4444' }}>
                Failed to load sessions
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="px-4 py-2 text-[9px]" style={{ color: S.textDim }}>
                {sessions.length === 0 ? 'No saved sessions' : 'No matches'}
              </div>
            ) : (
              filteredSessions.map(session => (
                <button
                  key={session.id}
                  className="w-full flex items-center gap-3 px-4 py-1.5 border-b text-left"
                  style={{
                    borderColor: `${S.border}55`,
                    background:  'transparent',
                    fontFamily:  S.font,
                    transition:  'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--t-b1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={() => {
                    onLoad(JSON.stringify(session));
                    setLoadDialogOpen(false);
                  }}
                >
                  <span className="text-[10px] flex-1" style={{ color: S.textActive }}>
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