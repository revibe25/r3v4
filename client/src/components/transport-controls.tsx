import { Button } from '@/components/ui/button';
import { Circle, Square, Play, Undo, Redo, Download, Target } from 'lucide-react';

interface TransportControlsProps {
  isArmed: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  recordedEventsCount: number;
  onArm: () => void;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export function TransportControls({
  isArmed,
  isRecording,
  isPlaying,
  recordedEventsCount,
  onArm,
  onRecord,
  onStop,
  onPlay,
  onUndo,
  onRedo,
  onExport,
}: TransportControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        variant={isArmed ? 'default' : 'outline'}
        size="sm"
        onClick={onArm}
        className={isArmed ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
        data-testid="button-arm"
      >
        <Target className="w-4 h-4 mr-1" />
        Arm
      </Button>

      <Button
        variant={isRecording ? 'destructive' : 'outline'}
        size="sm"
        onClick={onRecord}
        disabled={!isArmed}
        className={isRecording ? 'animate-pulse' : ''}
        data-testid="button-record"
      >
        <Circle className={`w-4 h-4 mr-1 ${isRecording ? 'fill-current' : ''}`} />
        Rec
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onStop}
        data-testid="button-stop"
      >
        <Square className="w-4 h-4 mr-1 fill-current" />
        Stop
      </Button>

      <Button
        variant={isPlaying ? 'default' : 'outline'}
        size="sm"
        onClick={onPlay}
        disabled={recordedEventsCount === 0}
        data-testid="button-play"
      >
        <Play className="w-4 h-4 mr-1 fill-current" />
        Play
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onUndo}
        disabled={recordedEventsCount === 0}
        data-testid="button-undo"
      >
        <Undo className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRedo}
        data-testid="button-redo"
      >
        <Redo className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        data-testid="button-export"
      >
        <Download className="w-4 h-4 mr-1" />
        Export
      </Button>

      {recordedEventsCount > 0 && (
        <span className="text-xs text-muted-foreground ml-2">
          {recordedEventsCount} events
        </span>
      )}
    </div>
  );
}
