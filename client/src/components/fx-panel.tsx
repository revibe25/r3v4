import type { FXState } from '@/lib/audio-engine';

interface FXPanelProps {
  fx: FXState;
  onToggle: (fx: keyof FXState) => void;
}

const fxList: { key: keyof FXState; label: string }[] = [
  { key: 'reverb', label: 'Reverb' },
  { key: 'delay', label: 'Delay' },
  { key: 'flange', label: 'Flanger' },
  { key: 'reverse', label: 'Reverse' },
  { key: 'vinyl', label: 'Vinyl' },
];

export function FXPanel({ fx, onToggle }: FXPanelProps) {
  return (
    <div className="grid grid-cols-5 gap-2 md:gap-3 p-3 rounded-lg bg-card/50 border border-border/30">
      {fxList.map(({ key, label }) => (
        <button
          key={key}
          data-testid={`button-fx-${key}`}
          onClick={() => onToggle(key)}
          className={`
            flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg
            font-semibold text-xs md:text-sm transition-all duration-150
            border
            ${fx[key]
              ? 'bg-gradient-to-b from-primary to-primary/70 text-primary-foreground border-primary shadow-md shadow-primary/20'
              : 'bg-card text-muted-foreground border-border/50 hover:bg-muted/50'
            }
          `}
        >
          <span className="hidden md:inline">{label}</span>
          <span className="md:hidden">{label.slice(0, 3)}</span>
          <span
            className={`
              w-2 h-2 rounded-full transition-all
              ${fx[key]
                ? 'bg-white shadow-lg shadow-white/50'
                : 'bg-muted-foreground/30'
              }
            `}
          />
        </button>
      ))}
    </div>
  );
}
