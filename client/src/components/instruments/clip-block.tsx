import React from "react";
import type { Clip } from "@/types/daw.types";
import { useDAWStore } from "@/hooks/useDAWStore";
import { timeToPixels } from "@/utils/time";

interface ClipBlockProps {
  clip: Clip;
  isSelected: boolean;
  onDrag: (clipId: string, startX: number) => void;
  onResize: (clipId: string, startX: number) => void;
  onSelect: (clipId: string) => void;
  onContext: (clipId: string, x: number, y: number) => void;
}

export const ClipBlock: React.FC<ClipBlockProps> = ({
  clip,
  isSelected,
  onDrag,
  onResize,
  onSelect,
  onContext,
}) => {
  const _zoom = useDAWStore(s => s.zoom);
  const _left = timeToPixels(clip.startTime, zoom);
  const _width = timeToPixels(clip.duration, zoom);

  return (
    <div
      className={`absolute h-14 rounded ${
        isSelected ? "border-2 border-blue-400" : ""
      }`}
      style={{ left, width }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(clip.id);
        onDrag(clip.id, e.clientX);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(clip.id, e.clientX, e.clientY);
      }}
    >
      <div className="bg-indigo-500 h-full relative">
        <div
          className="absolute right-0 top-0 h-full w-2 bg-indigo-700 cursor-ew-resize"
          onMouseDown={(e) => {
            e.stopPropagation();
            onResize(clip.id, e.clientX);
          }}
        />
        <span className="text-xs text-foreground px-1 truncate">
          {clip.name || clip.id}
        </span>
      </div>
    </div>
  );
};
