// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/ProjectsList.tsx
// Usage: drop anywhere — fully typed, no manual fetch/error handling
// ─────────────────────────────────────────────────────────────────────────────
import { trpc } from '@/lib/trpc';

export function ProjectsList() {
  const { data: projects, isLoading, error } = trpc.projects.list.useQuery();

  if (isLoading) return <div className="text-muted-foreground">Loading projects...</div>;
  if (error)    return <div className="text-destructive">Error: {error.message}</div>;
  if (!projects?.length) return <div className="text-muted-foreground">No projects yet.</div>;

  return (
    <ul className="space-y-2">
      {projects.map((p) => (
        <li key={p.id} className="rounded-md border px-4 py-2 text-sm">
          <span className="font-medium">{p.name}</span>
          {p.bpm && <span className="ml-2 text-muted-foreground">{p.bpm} BPM</span>}
        </li>
      ))}
    </ul>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/CreateProject.tsx
// Usage: form that creates a project and auto-refreshes the list
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

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

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create.mutate({ name })}
      />
      <button
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={!name || create.isPending}
        onClick={() => create.mutate({ name })}
      >
        {create.isPending ? 'Saving...' : 'New Project'}
      </button>
      {create.error && (
        <p className="text-xs text-destructive">{create.error.message}</p>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/PresetSelector.tsx
// Usage: load presets by type (e.g. type="synth" or type="fx")
// ─────────────────────────────────────────────────────────────────────────────
import { trpc } from '@/lib/trpc';

interface PresetSelectorProps {
  type?: string;
  onSelect: (preset: { id: string; name: string; settings: unknown }) => void;
}

export function PresetSelector({ type, onSelect }: PresetSelectorProps) {
  const { data: presets, isLoading } = trpc.presets.list.useQuery({ type });
  const utils = trpc.useUtils();

  const deletePreset = trpc.presets.delete.useMutation({
    onSuccess: () => utils.presets.list.invalidate(),
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading presets...</div>;

  return (
    <div className="space-y-1">
      {presets?.map((preset) => (
        <div
          key={preset.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent cursor-pointer"
          onClick={() => onSelect(preset)}
        >
          <span>{preset.name}</span>
          <button
            className="ml-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              deletePreset.mutate({ id: preset.id });
            }}
          >
            ✕
          </button>
        </div>
      ))}
      {!presets?.length && (
        <p className="text-xs text-muted-foreground px-1">No presets saved.</p>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// FILE: client/src/components/SessionStatus.tsx
// Usage: show current session info — polling every 5s for live state
// ─────────────────────────────────────────────────────────────────────────────
import { trpc } from '@/lib/trpc';

export function SessionStatus({ sessionId }: { sessionId: string }) {
  const { data: session } = trpc.sessions.byId.useQuery(
    { id: sessionId },
    {
      refetchInterval: 5000, // poll every 5s — useful for collaborative sessions
      enabled: !!sessionId,
    }
  );

  if (!session) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      <span>{session.name}</span>
      {session.bpm && <span>· {session.bpm} BPM</span>}
    </div>
  );
}
