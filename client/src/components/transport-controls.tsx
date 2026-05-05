import { memo, useCallback } from 'react';
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
  disabled?: boolean;
}

export const TransportControls = memo(function TransportControls({
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
  // Guard: only fire onRecord if not already recording
  const handleRecord = useCallback(() => {
    if (!isRecording) onRecord();
  }, [isRecording, onRecord]);

  // Guard: only fire onPlay if not already playing
  const handlePlay = useCallback(() => {
    if (!isPlaying) onPlay();
  }, [isPlaying, onPlay]);

  const hasEvents = recordedEventsCount > 0;

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
        onClick={handleRecord}
        // Disabled if not armed, or if currently playing (can't record during playback)
        disabled={!isArmed || isPlaying}
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
        onClick={handlePlay}
        // Disabled if no events to play, or if currently recording
        disabled={!hasEvents || isRecording}
        data-testid="button-play"
      >
        <Play className="w-4 h-4 mr-1 fill-current" />
        Play
      </Button>

      <div className="w-px h-6 bg-border mx-1" aria-hidden />

      <Button
        variant="ghost"
        size="sm"
        onClick={onUndo}
        disabled={!hasEvents}
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

      <div className="w-px h-6 bg-border mx-1" aria-hidden />

      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        data-testid="button-export"
      >
        <Download className="w-4 h-4 mr-1" />
        Export
      </Button>

      {hasEvents && (
        <span className="text-xs text-muted-foreground ml-2">
          {recordedEventsCount} events
        </span>
      )}
    </div>
  );
});