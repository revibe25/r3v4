import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Moon, Sun, Zap, Music, Save, FolderOpen, Trash2, Download, Upload } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Session } from '@shared/schema';

type Theme = 'dark' | 'light' | 'neon';

interface HeaderControlsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  metronomeOn: boolean;
  onMetronomeToggle: () => void;
  onSave: () => void;
  onLoad: (json: string) => void;
  getSessionData: () => { bpm: number; fx: any; filterVal: number; pitchSemitones: number; recordedEvents: any[] };
}

export function HeaderControls({
  theme,
  onThemeChange,
  bpm,
  onBpmChange,
  metronomeOn,
  onMetronomeToggle,
  onSave,
  onLoad,
  getSessionData,
}: HeaderControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const { toast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['/api/sessions'],
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: { name: string; bpm: number; fx: any; filterVal: number; pitchSemitones: number; recordedEvents: any[] }) => {
      const res = await apiRequest('POST', '/api/sessions', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      setSaveDialogOpen(false);
      setSessionName('');
      toast({ title: 'Session saved', description: 'Your session has been saved to the cloud.' });
    },
    onError: () => {
      toast({ title: 'Save failed', description: 'Could not save session. Please try again.', variant: 'destructive' });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({ title: 'Session deleted' });
    },
    onError: () => {
      toast({ title: 'Delete failed', description: 'Could not delete session.', variant: 'destructive' });
    },
  });

  const cycleTheme = () => {
    const themes: Theme[] = ['dark', 'light', 'neon'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    onThemeChange(themes[nextIndex]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onLoad(text);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveToServer = () => {
    if (!sessionName.trim()) return;
    const data = getSessionData();
    createSessionMutation.mutate({
      name: sessionName.trim(),
      ...data,
    });
  };

  const handleLoadFromServer = (session: Session) => {
    try {
      const json = JSON.stringify({
        bpm: session.bpm,
        fx: session.fx,
        filterVal: session.filterVal,
        pitchSemitones: session.pitchSemitones,
        recordedEvents: session.recordedEvents,
      });
      onLoad(json);
      setLoadDialogOpen(false);
      toast({ title: 'Session loaded', description: `Loaded "${session.name}"` });
    } catch {
      toast({ title: 'Load failed', description: 'Could not load session data.', variant: 'destructive' });
    }
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'neon' ? Zap : Moon;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={cycleTheme}
        data-testid="button-theme"
      >
        <ThemeIcon className="w-4 h-4 mr-1" />
        {theme.charAt(0).toUpperCase() + theme.slice(1)}
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant={metronomeOn ? 'default' : 'outline'}
          size="sm"
          onClick={onMetronomeToggle}
          data-testid="button-metronome"
        >
          <Music className="w-4 h-4 mr-1" />
          <span className="font-mono">{bpm}</span>
        </Button>
        <Slider
          value={[bpm]}
          min={40}
          max={240}
          step={1}
          onValueChange={([v]) => onBpmChange(v)}
          className="w-24"
          data-testid="slider-bpm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-save-server">
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Session name..."
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                data-testid="input-session-name"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveToServer}
                  disabled={!sessionName.trim() || createSessionMutation.isPending}
                  data-testid="button-save-confirm"
                >
                  {createSessionMutation.isPending ? 'Saving...' : 'Save to Cloud'}
                </Button>
                <Button variant="outline" onClick={onSave} data-testid="button-download">
                  <Download className="w-4 h-4 mr-1" />
                  Download File
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-load-server">
              <FolderOpen className="w-4 h-4 mr-1" />
              Load
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Load Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sessionsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading sessions...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No saved sessions yet.</p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate"
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => handleLoadFromServer(session)}
                        data-testid={`button-load-session-${session.id}`}
                      >
                        <span className="font-medium">{session.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {session.bpm} BPM
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => session.id && deleteSessionMutation.mutate(session.id)}
                        disabled={deleteSessionMutation.isPending}
                        data-testid={`button-delete-session-${session.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t pt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Upload File
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
