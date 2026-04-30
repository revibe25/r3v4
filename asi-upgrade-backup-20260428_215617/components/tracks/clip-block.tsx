import React from 'react';
import { FileAudio, Music } from 'lucide-react';

export interface ClipData {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  name?: string;
  color?: string;
  type?: 'audio' | 'midi';
}

interface ClipBlockProps {
  clip: ClipData;
  isSelected: boolean;
  pixelsPerSecond?: number;
  onStartDrag: (clipId: string, startX: number) => void;
  onStartResize?: (clipId: string, startX: number) => void;
  onClick?: (clipId: string) => void;
}

export const ClipBlock: React.FC<ClipBlockProps> = ({ 
  clip, 
  isSelected, 
  pixelsPerSecond = 100,
  onStartDrag,
  onStartResize,
  onClick
}) => {
  const width = clip.duration * pixelsPerSecond;
  const left = clip.startTime * pixelsPerSecond;
  
  const defaultColor = clip.type === 'midi' ? '#6366f1' : '#8b5cf6';
  const selectedColor = clip.type === 'midi' ? '#3b82f6' : '#a78bfa';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick(clip.id);
    onStartDrag(clip.id, e.clientX);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartResize) {
      onStartResize(clip.id, e.clientX);
    }
  };

  return (
    <div
      className="absolute h-14 rounded cursor-move transition-all select-none overflow-hidden group"
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: clip.color || (isSelected ? selectedColor : defaultColor),
        border: isSelected ? '2px solid #60a5fa' : '2px solid rgba(255,255,255,0.2)',
        boxShadow: isSelected ? '0 0 0 1px rgba(96, 165, 250, 0.5)' : 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Clip Content */}
      <div className="p-2 flex items-center gap-2 h-full">
        {clip.type === 'midi' ? (
          <Music className="w-3 h-3 text-foreground/70 flex-shrink-0" />
        ) : (
          <FileAudio className="w-3 h-3 text-foreground/70 flex-shrink-0" />
        )}
        <div className="text-xs text-foreground font-medium truncate flex-1">
          {clip.name || clip.id}
        </div>
      </div>

      {/* Duration Label */}
      <div className="absolute bottom-1 right-2 text-xs text-foreground/60 pointer-events-none">
        {clip.duration.toFixed(2)}s
      </div>

      {/* Resize Handle (Right edge) */}
      {onStartResize && (
        <div
          className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity bg-white/20"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {/* Activity placeholder (optional) */}
      <div className="absolute bottom-0 left-0 right-0 h-6 opacity-30">
        {/* You can add actual waveform rendering here */}
        <svg width="100%" height="100%" className="opacity-50">
          <rect x="0" y="40%" width="100%" height="20%" fill="currentColor" className="text-foreground" />
        </svg>
      </div>
    </div>
  );
};

export default ClipBlock;
