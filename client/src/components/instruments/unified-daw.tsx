import React, { useState, useMemo, useCallback } from "react";
import { useClipStore } from "@/store/clip-store";
import { timeToPixels } from "@/utils/time";
import { useTransportState } from "@/hooks/use-transport-state";
import { useClipDrag, useClipResize } from "@/components/tracks/clip-drag-handler";
import { ClipBlock } from "./clip-block";
import { ClipContextMenu } from "./clip-context-menu";
import { TransportBar } from "./transport-bar";
import { Timeline } from "./timeline";

export const UnifiedDaw: React.FC = () => {
  const clips            = useClipStore(s => s.clips);
  const selectedClipIds  = useClipStore(s => s.selectedClipIds);
  const selectClip       = useClipStore(s => s.selectClip);
  const removeClip       = useClipStore(s => s.removeClip);
  const getClipsForTrack = useClipStore(s => s.getClipsForTrack);
  const snapEnabled      = useClipStore(s => (s as any).snapEnabled ?? false);
  const updatePosition   = useClipStore(s => (s as any).updateClipPosition);
  const updateDuration   = useClipStore(s => (s as any).updateClipDuration);
  const duplicateClip    = useClipStore(s => (s as any).duplicateClip);
  const splitClipAt      = useClipStore(s => (s as any).splitClipAt);

  const { playing, position, bpm, play, stop, setBpm } = useTransportState();

  const [contextMenu, setContextMenu] = useState<{ clipId: string; x: number; y: number } | null>(null);
  const [dragState,   setDragState]   = useState<{ clipId: string; startX: number; initialTime: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ clipId: string; startX: number; initialDuration: number } | null>(null);

  const tracks = useMemo(() =>
    Array.from(new Set(Array.from(clips.values()).map(c => c.trackId)))
      .map(id => ({ id, name: `Track ${id}`, volume: 1, pan: 0, muted: false, solo: false })),
    [clips]
  );

  const maxTime = useMemo(() =>
    Math.max(10, ...Array.from(clips.values()).map(c => c.startTime + c.duration)),
    [clips]
  );

  const handleDragEnd   = useCallback(() => setDragState(null),   []);
  const handleResizeEnd = useCallback(() => setResizeState(null), []);

  useClipDrag(
    dragState?.clipId ?? null,
    dragState?.startX ?? 0,
    dragState?.initialTime ?? 0,
    snapEnabled,
    updatePosition,
    handleDragEnd
  );

  useClipResize(
    resizeState?.clipId ?? null,
    resizeState?.startX ?? 0,
    resizeState?.initialDuration ?? 0,
    snapEnabled,
    updateDuration,
    handleResizeEnd
  );

  const handleDrag = useCallback((clipId: string, startX: number) => {
    const clip = Array.from(clips.values()).find(c => c.id === clipId);
    if (!clip) return;
    setDragState({ clipId, startX, initialTime: clip.startTime });
  }, [clips]);

  const handleResize = useCallback((clipId: string, startX: number) => {
    const clip = Array.from(clips.values()).find(c => c.id === clipId);
    if (!clip) return;
    setResizeState({ clipId, startX, initialDuration: clip.duration });
  }, [clips]);

  return (
    <div className="flex flex-col h-screen bg-card text-white">
      <TransportBar
        playing={playing}
        position={position}
        bpm={bpm}
        onPlay={play}
        onStop={stop}
        onBpmChange={setBpm}
      />
      <Timeline maxTime={maxTime} />
      <div className="flex-1 overflow-auto relative">
        <div style={{ minWidth: timeToPixels(maxTime) + 200 }}>
          {tracks.map(t => (
            <div key={t.id} className="relative h-16 border-b border-border">
              {getClipsForTrack(t.id).map(clip => (
                <ClipBlock
                  key={clip.id}
                  clip={clip}
                  isSelected={selectedClipIds?.[0] === clip.id}
                  onDrag={handleDrag}
                  onResize={handleResize}
                  onSelect={selectClip}
                  onContext={(id, x, y) => setContextMenu({ clipId: id, x, y })}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {contextMenu && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={() => { removeClip(contextMenu.clipId); setContextMenu(null); }}
          onDuplicate={() => { duplicateClip?.(contextMenu.clipId); setContextMenu(null); }}
          onSplit={() => { splitClipAt?.(contextMenu.clipId, position); setContextMenu(null); }}
        />
      )}
    </div>
  );
};

export default UnifiedDaw;
