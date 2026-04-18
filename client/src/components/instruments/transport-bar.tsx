import React from "react";
import { Play, Square, Circle } from "lucide-react";

interface Props {
  playing: boolean;
  position: number;
  bpm: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
}

export const TransportBar: React.FC<Props> = ({
  playing,
  position,
  bpm,
  onPlay,
  onStop,
  onBpmChange,
}) => (
  <div className="h-14 bg-background border-b border-border px-4 flex items-center gap-4">
    <button
      onClick={playing ? onStop : onPlay}
      className="p-2 bg-muted rounded"
    >
      {playing ? <Square /> : <Play />}
    </button>
    <div className="font-mono text-white">
      {Math.floor(position / 60)}:
      {String(Math.floor(position % 60)).padStart(2, "0")}:
      {String(Math.floor((position % 1) * 100)).padStart(2, "0")}
    </div>
    <label className="text-muted-foreground">
      BPM
      <input
        type="number"
        value={bpm}
        onChange={(e) => onBpmChange(Number(e.target.value))}
        className="w-16 ml-2 bg-muted text-white rounded px-1"
      />
    </label>
  </div>
);
