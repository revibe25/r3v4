import { useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';

interface DJControlsProps {
  filterVal: number;
  pitchSemitones: number;
  crossfade: number;
  onFilterChange: (value: number) => void;
  onPitchChange: (semitones: number) => void;
  onCrossfadeChange: (value: number) => void;
}

interface KnobProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  testId: string;
}

function Knob({ value, min, max, label, onChange, formatValue, testId }: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    e.preventDefault();
  }, [value]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    const range = max - min;
    const sensitivity = range / 100;
    const newValue = Math.min(max, Math.max(min, startValue + deltaY * sensitivity));
    onChange(newValue);
  }, [isDragging, startY, startValue, min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useState(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        data-testid={testId}
        onMouseDown={handleMouseDown}
        className={`
          relative w-12 h-12 rounded-full cursor-grab
          bg-gradient-to-b from-muted/80 to-card
          border border-border/50
          flex items-center justify-center
          shadow-inner shadow-black/20
          ${isDragging ? 'cursor-grabbing' : ''}
        `}
      >
        <div
          className="absolute w-1 h-4 bg-muted-foreground rounded-full origin-bottom"
          style={{
            transform: `rotate(${rotation}deg) translateY(-6px)`,
            top: '8px',
          }}
        />
        <div className="absolute inset-2 rounded-full bg-card border border-border/30" />
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground/60 font-mono">
        {formatValue ? formatValue(value) : value.toFixed(2)}
      </span>
    </div>
  );
}

export function DJControls({
  filterVal,
  pitchSemitones,
  crossfade,
  onFilterChange,
  onPitchChange,
  onCrossfadeChange,
}: DJControlsProps) {
  return (
    <div className="flex items-center justify-between gap-6 p-4 rounded-lg bg-card/30 border border-border/20">
      <div className="flex items-center gap-6">
        <Knob
          value={filterVal}
          min={0}
          max={1}
          label="Filter"
          onChange={onFilterChange}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          testId="knob-filter"
        />
        <Knob
          value={pitchSemitones}
          min={-12}
          max={12}
          label="Pitch"
          onChange={(v) => onPitchChange(Math.round(v))}
          formatValue={(v) => `${v > 0 ? '+' : ''}${Math.round(v)} st`}
          testId="knob-pitch"
        />
        <Knob
          value={0}
          min={-1}
          max={1}
          label="Scratch"
          onChange={() => {}}
          formatValue={() => 'Jog'}
          testId="knob-scratch"
        />
      </div>

      <div className="flex flex-col items-center gap-2 min-w-32">
        <span className="text-[11px] text-muted-foreground">Crossfader</span>
        <Slider
          value={[crossfade]}
          min={-1}
          max={1}
          step={0.01}
          onValueChange={([v]) => onCrossfadeChange(v)}
          className="w-full"
          data-testid="slider-crossfader"
        />
        <div className="flex justify-between w-full text-[10px] text-muted-foreground/60">
          <span>A</span>
          <span>B</span>
        </div>
      </div>
    </div>
  );
}
