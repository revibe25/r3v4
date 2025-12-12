import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Moon, Sun, Zap, Music, Save, FolderOpen } from 'lucide-react';

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
}: HeaderControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          data-testid="button-save"
        >
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-load"
        >
          <FolderOpen className="w-4 h-4 mr-1" />
          Load
        </Button>
      </div>
    </div>
  );
}
